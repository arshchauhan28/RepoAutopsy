import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class PullRequestAnalysis(Base):
    __tablename__ = "pull_request_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id: Mapped[str | None] = mapped_column(ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True, index=True)
    repo_owner: Mapped[str] = mapped_column(String(100), index=True)
    repo_name: Mapped[str] = mapped_column(String(100), index=True)
    pr_number: Mapped[int] = mapped_column(Integer, index=True)
    pr_title: Mapped[str] = mapped_column(String(300))
    pr_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    pr_author: Mapped[str | None] = mapped_column(String(100), nullable=True)
    base_branch: Mapped[str] = mapped_column(String(150))
    head_branch: Mapped[str] = mapped_column(String(150))
    base_sha: Mapped[str] = mapped_column(String(40), index=True)
    head_sha: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(20), default="completed", index=True)  # queued, running, completed, failed
    changed_files_count: Mapped[int] = mapped_column(Integer, default=0)
    additions: Mapped[int] = mapped_column(Integer, default=0)
    deletions: Mapped[int] = mapped_column(Integer, default=0)
    review_priority: Mapped[str] = mapped_column(String(20), default="low", index=True)  # high, medium, low
    review_priority_reasons: Mapped[list] = mapped_column(JSON, default=list)
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    changed_files: Mapped[list] = mapped_column(JSON, default=list)
    change_impacts: Mapped[list] = mapped_column(JSON, default=list)
    architecture_delta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    diagnostics_delta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    test_recommendations: Mapped[list] = mapped_column(JSON, default=list)
    limitations: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    base_analysis = relationship("Analysis")
