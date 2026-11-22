import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id: Mapped[str] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, completed, abandoned
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # CodeVitals 2.0 extensions
    assessment_type: Mapped[str] = mapped_column(String(30), default="complete")  # complete, component, team
    scope_type: Mapped[str] = mapped_column(String(30), default="complete")  # complete, component
    selected_components: Mapped[list | None] = mapped_column(JSON, nullable=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="intermediate")  # beginner, intermediate, advanced
    question_count: Mapped[int] = mapped_column(Integer, default=10)
    evaluation_mode: Mapped[str] = mapped_column(String(30), default="deterministic")  # ai, deterministic
    category_scores: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    participant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    team_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    team_member_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    hackathon_mode: Mapped[int] = mapped_column(Integer, default=0)
    hackathon_context: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    analysis = relationship("Analysis", back_populates="interviews")
    turns = relationship(
        "InterviewTurn",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="InterviewTurn.question_index",
    )


class InterviewTurn(Base):
    __tablename__ = "interview_turns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    question_index: Mapped[int] = mapped_column(Integer)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # CodeVitals 2.0 question details
    question_type: Mapped[str] = mapped_column(String(30), default="short_answer")  # multiple_choice, short_answer, code_interpretation, scenario
    category: Mapped[str] = mapped_column(String(50), default="architecture")
    difficulty: Mapped[str] = mapped_column(String(20), default="intermediate")
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)  # Multiple-choice 4 options
    correct_option: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-indexed correct option
    selected_option: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Option index selected by user
    code_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    relevant_files: Mapped[list | None] = mapped_column(JSON, nullable=True)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    rubric: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    earned_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_score: Mapped[int] = mapped_column(Integer, default=100)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    session = relationship("InterviewSession", back_populates="turns")


class TeamSession(Base):
    __tablename__ = "team_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id: Mapped[str] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"), index=True)
    team_name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    organizer_token: Mapped[str] = mapped_column(String(64), index=True)
    invite_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, completed, expired
    is_hackathon_mode: Mapped[int] = mapped_column(Integer, default=0)
    hackathon_context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    shared_questions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    analysis = relationship("Analysis")
    members = relationship(
        "TeamMember",
        back_populates="team_session",
        cascade="all, delete-orphan",
        order_by="TeamMember.created_at",
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    team_session_id: Mapped[str] = mapped_column(ForeignKey("team_sessions.id", ondelete="CASCADE"), index=True)
    display_name: Mapped[str] = mapped_column(String(100))
    assigned_role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    assigned_components: Mapped[list] = mapped_column(JSON, default=list)  # e.g. ["comp-frontend-pages"] or ["complete"]
    difficulty: Mapped[str] = mapped_column(String(20), default="intermediate")
    question_count: Mapped[int] = mapped_column(Integer, default=10)
    status: Mapped[str] = mapped_column(String(20), default="invited")  # invited, in_progress, completed
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)  # FK to InterviewSession
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category_scores: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    team_session = relationship("TeamSession", back_populates="members")
