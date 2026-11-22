import logging
from sqlalchemy import inspect, text
from app.db.session import Base, engine
from app.models import analysis, finding, interview

logger = logging.getLogger(__name__)


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
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE findings ADD COLUMN {col_name} {col_type}"))

            # Analyses migration
            if "analyses" in table_names:
                existing_analysis_cols = {c["name"] for c in inspector.get_columns("analyses")}
                if "analyzer_version" not in existing_analysis_cols:
                    conn.execute(text("ALTER TABLE analyses ADD COLUMN analyzer_version VARCHAR(20)"))

            # CodeVitals InterviewSession migration
            if "interview_sessions" in table_names:
                session_cols = {c["name"] for c in inspector.get_columns("interview_sessions")}
                session_new = [
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
                    if col_name not in session_cols:
                        conn.execute(text(f"ALTER TABLE interview_sessions ADD COLUMN {col_name} {col_type}"))

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
                    if col_name not in turn_cols:
                        conn.execute(text(f"ALTER TABLE interview_turns ADD COLUMN {col_name} {col_type}"))

            conn.commit()
    except Exception as exc:
        logger.warning("Database schema migration check encountered non-fatal error: %s", exc)
