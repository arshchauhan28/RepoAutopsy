import logging
from sqlalchemy import inspect, text
from app.db.session import Base, engine
from app.models import analysis, finding, interview

logger = logging.getLogger(__name__)


def init_db():
    Base.metadata.create_all(bind=engine)
    try:
        inspector = inspect(engine)
        if "findings" in inspector.get_table_names():
            existing_cols = {c["name"] for c in inspector.get_columns("findings")}
            new_cols = [
                ("confidence", "VARCHAR(20) DEFAULT 'high'"),
                ("why_it_matters", "TEXT"),
                ("evidence", "TEXT"),
                ("suggested_fix", "TEXT"),
                ("root_cause_group", "VARCHAR(100) DEFAULT 'general'"),
            ]
            with engine.connect() as conn:
                for col_name, col_type in new_cols:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE findings ADD COLUMN {col_name} {col_type}"))
                conn.commit()

        if "analyses" in inspector.get_table_names():
            existing_analysis_cols = {c["name"] for c in inspector.get_columns("analyses")}
            if "analyzer_version" not in existing_analysis_cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE analyses ADD COLUMN analyzer_version VARCHAR(20)"))
                    conn.commit()
    except Exception as exc:
        logger.warning("Database schema migration check encountered non-fatal error: %s", exc)
