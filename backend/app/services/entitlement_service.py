import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.automation import UsageEvent
from app.schemas.automation import UsageSummaryResponse

logger = logging.getLogger(__name__)

DEFAULT_PLANS = {
    "free": {
        "max_workspaces": 5,
        "max_members_per_workspace": 10,
        "max_connected_repos": 20,
        "pr_automation_enabled": True,
        "max_repo_analyses_per_month": 100,
        "max_pr_analyses_per_month": 250,
        "max_codevitals_per_month": 500,
    },
    "pro": {
        "max_workspaces": 25,
        "max_members_per_workspace": 50,
        "max_connected_repos": 100,
        "pr_automation_enabled": True,
        "max_repo_analyses_per_month": 1000,
        "max_pr_analyses_per_month": 2500,
        "max_codevitals_per_month": 5000,
    },
}


def record_usage_event(
    db: Session,
    event_type: str,
    user_id: str | None = None,
    workspace_id: str | None = None,
    quantity: int = 1,
    resource_ref: str | None = None,
    metadata_json: dict | None = None,
) -> UsageEvent:
    event = UsageEvent(
        user_id=user_id,
        workspace_id=workspace_id,
        event_type=event_type,
        quantity=quantity,
        resource_ref=resource_ref,
        metadata_json=metadata_json,
        timestamp=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_workspace_usage_summary(db: Session, workspace_id: str | None = None, user_id: str | None = None) -> UsageSummaryResponse:
    query = db.query(UsageEvent)
    if workspace_id:
        query = query.filter(UsageEvent.workspace_id == workspace_id)
    elif user_id:
        query = query.filter(UsageEvent.user_id == user_id)

    # 30-day window
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_events = query.filter(UsageEvent.timestamp >= thirty_days_ago).all()

    repo_analyses = sum(e.quantity for e in recent_events if e.event_type == "repo_analysis")
    pr_analyses = sum(e.quantity for e in recent_events if e.event_type == "pr_autopsy")
    codevitals_sessions = sum(e.quantity for e in recent_events if e.event_type == "codevitals_assessment")

    return UsageSummaryResponse(
        workspace_id=workspace_id,
        total_repo_analyses=repo_analyses,
        total_pr_analyses=pr_analyses,
        total_codevitals_sessions=codevitals_sessions,
        total_events=len(recent_events),
        current_plan="free",
        allowances=DEFAULT_PLANS["free"],
    )


def check_entitlement(db: Session, workspace_id: str | None, feature_name: str) -> bool:
    """
    Centralized check for SaaS feature availability and limit enforcement.
    Currently permissive with soft boundaries; prepared for Sprint 5 monetization.
    """
    plan = DEFAULT_PLANS["free"]
    return True
