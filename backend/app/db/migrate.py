"""
Non-destructive Database Migration Script for RepoAutopsy.

Checks for missing tables and ensures all required columns across Sprints 1-4
exist on SQLite and PostgreSQL databases without dropping data.

Usage:
    python -m app.db.migrate
"""

import logging
from sqlalchemy import inspect, text
from app.db.session import engine, Base
import app.models  # Load all models into Base.metadata

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("repoautopsy.migrate")


# Schema column expectations across all sprints for existing tables
EXPECTED_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "analyses": [
        ("workspace_id", "VARCHAR(36)"),
        ("user_id", "VARCHAR(36)"),
        ("analyzer_version", "VARCHAR(20) DEFAULT '2.1.0'"),
    ],
    "pull_request_analyses": [
        ("workspace_id", "VARCHAR(36)"),
        ("user_id", "VARCHAR(36)"),
        ("error", "TEXT"),
    ],
    "analysis_jobs": [
        ("retry_count", "INTEGER DEFAULT 0"),
        ("max_retries", "INTEGER DEFAULT 3"),
        ("error_message", "TEXT"),
        ("started_at", "DATETIME"),
        ("completed_at", "DATETIME"),
    ],
    "workspaces": [
        ("plan", "VARCHAR(50) DEFAULT 'free'"),
        ("is_active", "BOOLEAN DEFAULT TRUE"),
    ],
    "findings": [
        ("rule_id", "VARCHAR(50)"),
        ("evidence_type", "VARCHAR(50)"),
    ],
}


def run_migrations():
    logger.info("Starting safe non-destructive migration check on %s...", engine.url.drivername)

    # 1. Create any missing tables defined in models
    Base.metadata.create_all(bind=engine)
    logger.info("Verified all core table definitions exist.")

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table_name, columns in EXPECTED_COLUMNS.items():
            if table_name not in existing_tables:
                continue

            current_cols = {col["name"].lower() for col in inspector.get_columns(table_name)}

            for col_name, col_type in columns:
                if col_name.lower() not in current_cols:
                    logger.info("Adding missing column '%s' to table '%s'...", col_name, table_name)
                    alter_query = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"
                    conn.execute(text(alter_query))
                    logger.info("Successfully added '%s' to '%s'.", col_name, table_name)
                else:
                    logger.debug("Column '%s' already exists on '%s'.", col_name, table_name)

    logger.info("Migration check completed successfully. All tables and columns are up to date.")


if __name__ == "__main__":
    run_migrations()
