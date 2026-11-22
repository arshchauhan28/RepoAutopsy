import logging
from sqlalchemy import inspect, text
from app.db.session import Base, engine
from app.models import analysis, finding, interview

logger = logging.getLogger(__name__)


def _safe_add_column(conn, table: str, col_name: str, col_type: str, existing_cols: set[str]):
    """
    Safely adds a column if it does not exist, catching concurrent worker race conditions.
    """
    if col_name in existing_cols:
        return
    try:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
        conn.commit()
    except Exception as exc:
        err = str(exc).lower()
        if "duplicate column" in err or "already exists" in err:
            logger.debug("Column %s already added to table %s by another worker.", col_name, table)
        else:
            logger.warning("Could not add column %s to %s: %s", col_name, table, exc)


def init_db():
    Base.metadata.create_all(bind=engine)
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        with engine.connect() as conn:
            # Findings migration
            if "findings" in table_names:
                existing_cols = {c["name"] for c in inspector.get_columns("findings")}
                new_cols = [
                    ("confidence", "VARCHAR(20) DEFAULT 'high'"),
                    ("why_it_matters", "TEXT"),
                    ("evidence", "TEXT"),
                    ("suggested_fix", "TEXT"),
                    ("root_cause_group", "VARCHAR(100) DEFAULT 'general'"),
                ]
                for col_name, col_type in new_cols:
                    _safe_add_column(conn, "findings", col_name, col_type, existing_cols)

            # Analyses migration
            if "analyses" in table_names:
                existing_analysis_cols = {c["name"] for c in inspector.get_columns("analyses")}
                _safe_add_column(conn, "analyses", "analyzer_version", "VARCHAR(20)", existing_analysis_cols)

            # CodeVitals InterviewSession migration
            if "interview_sessions" in table_names:
                session_cols = {c["name"] for c in inspector.get_columns("interview_sessions")}
                session_new = [
                    ("session_token", "VARCHAR(64)"),
                    ("assessment_type", "VARCHAR(30) DEFAULT 'complete'"),
                    ("scope_type", "VARCHAR(30) DEFAULT 'complete'"),
                    ("selected_components", "JSON"),
                    ("difficulty", "VARCHAR(20) DEFAULT 'intermediate'"),
                    ("question_count", "INTEGER DEFAULT 10"),
                    ("evaluation_mode", "VARCHAR(30) DEFAULT 'deterministic'"),
                    ("category_scores", "JSON"),
                    ("participant_name", "VARCHAR(100)"),
                    ("team_session_id", "VARCHAR(36)"),
                    ("team_member_id", "VARCHAR(36)"),
                    ("hackathon_mode", "INTEGER DEFAULT 0"),
                    ("hackathon_context", "JSON"),
                ]
                for col_name, col_type in session_new:
                    _safe_add_column(conn, "interview_sessions", col_name, col_type, session_cols)

            # CodeVitals InterviewTurn migration
            if "interview_turns" in table_names:
                turn_cols = {c["name"] for c in inspector.get_columns("interview_turns")}
                turn_new = [
                    ("question_type", "VARCHAR(30) DEFAULT 'short_answer'"),
                    ("category", "VARCHAR(50) DEFAULT 'architecture'"),
                    ("difficulty", "VARCHAR(20) DEFAULT 'intermediate'"),
                    ("options", "JSON"),
                    ("correct_option", "INTEGER"),
                    ("selected_option", "INTEGER"),
                    ("code_snippet", "TEXT"),
                    ("relevant_files", "JSON"),
                    ("evidence", "TEXT"),
                    ("rubric", "JSON"),
                    ("earned_score", "INTEGER"),
                    ("max_score", "INTEGER DEFAULT 100"),
                    ("explanation", "TEXT"),
                ]
                for col_name, col_type in turn_new:
                    _safe_add_column(conn, "interview_turns", col_name, col_type, turn_cols)

            conn.commit()
    except Exception as exc:
        logger.warning("Database schema migration check encountered non-fatal error: %s", exc)
