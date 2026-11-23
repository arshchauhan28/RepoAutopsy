from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.analysis import Analysis
from app.models.pull_request import PullRequestAnalysis
from app.models.workspace import Workspace, WorkspaceMember, ConnectedRepository
from app.models.interview import InterviewSession
from app.models.automation import Notification
from app.api.deps import get_current_user
from app.services.entitlement_service import get_workspace_usage_summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_dashboard_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. User's workspaces
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).all()
    workspace_ids = [m.workspace_id for m in memberships]

    workspaces = (
        db.query(Workspace)
        .filter(Workspace.id.in_(workspace_ids), Workspace.status == "active")
        .all()
    )

    # 2. Connected repositories in user's workspaces
    connected_repos = (
        db.query(ConnectedRepository)
        .filter(ConnectedRepository.workspace_id.in_(workspace_ids))
        .all()
    ) if workspace_ids else []

    # 3. Recent Analyses (user-initiated or in user workspaces)
    recent_analyses = (
        db.query(Analysis)
        .order_by(Analysis.created_at.desc())
        .limit(6)
        .all()
    )

    # 4. Recent PR Analyses
    recent_pr_analyses = (
        db.query(PullRequestAnalysis)
        .order_by(PullRequestAnalysis.created_at.desc())
        .limit(6)
        .all()
    )

    # 5. Recent CodeVitals Sessions
    recent_assessments = (
        db.query(InterviewSession)
        .order_by(InterviewSession.created_at.desc())
        .limit(6)
        .all()
    )

    # 6. Unread notification count
    unread_notifs = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,
    ).count()

    # 7. Usage summary
    usage_summary = get_workspace_usage_summary(db, user_id=user.id)

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "email": user.email,
        },
        "metrics": {
            "connected_repositories_count": len(connected_repos),
            "workspaces_count": len(workspaces),
            "analyses_count": len(recent_analyses),
            "pr_analyses_count": len(recent_pr_analyses),
            "codevitals_sessions_count": len(recent_assessments),
            "unread_notifications_count": unread_notifs,
        },
        "workspaces": [
            {
                "id": w.id,
                "name": w.name,
                "description": w.description,
                "workspace_type": w.workspace_type,
                "created_at": w.created_at,
            }
            for w in workspaces[:5]
        ],
        "connected_repositories": [
            {
                "id": r.id,
                "workspace_id": r.workspace_id,
                "owner": r.owner,
                "repo_name": r.repo_name,
                "github_url": r.github_url,
                "default_branch": r.default_branch,
                "is_private": r.is_private,
                "status": r.connection_status,
                "last_synced_at": r.last_synced_at,
            }
            for r in connected_repos[:8]
        ],
        "recent_analyses": [
            {
                "id": a.id,
                "owner": a.owner,
                "repo_name": a.repo_name,
                "status": a.status,
                "created_at": a.created_at,
                "metrics": a.metrics or {},
            }
            for a in recent_analyses
        ],
        "recent_pr_analyses": [
            {
                "id": pr.id,
                "repo_owner": pr.repo_owner,
                "repo_name": pr.repo_name,
                "pr_number": pr.pr_number,
                "pr_title": pr.pr_title,
                "review_priority": pr.review_priority,
                "changed_files_count": pr.changed_files_count,
                "additions": pr.additions,
                "deletions": pr.deletions,
                "created_at": pr.created_at,
            }
            for pr in recent_pr_analyses
        ],
        "recent_assessments": [
            {
                "id": s.id,
                "analysis_id": s.analysis_id,
                "participant_name": s.participant_name,
                "assessment_type": s.assessment_type,
                "status": s.status,
                "score": s.score,
                "created_at": s.created_at,
            }
            for s in recent_assessments
        ],
        "usage": usage_summary.model_dump(),
    }
