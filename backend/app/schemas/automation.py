from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AnalysisJobResponse(BaseModel):
    id: str
    workspace_id: str | None = None
    connected_repo_id: str | None = None
    repo_owner: str
    repo_name: str
    job_type: str
    pr_number: int | None = None
    base_sha: str | None = None
    head_sha: str | None = None
    status: str
    retry_count: int
    max_retries: int
    error_message: str | None = None
    result_id: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    notification_type: str
    resource_url: str | None = None
    resource_id: str | None = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UsageEventResponse(BaseModel):
    id: str
    event_type: str
    quantity: int
    resource_ref: str | None = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class UsageSummaryResponse(BaseModel):
    workspace_id: str | None = None
    total_repo_analyses: int = 0
    total_pr_analyses: int = 0
    total_codevitals_sessions: int = 0
    total_events: int = 0
    current_plan: str = "free"
    allowances: dict
