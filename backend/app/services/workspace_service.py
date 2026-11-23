import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.user import User
from app.models.workspace import (
    Workspace,
    WorkspaceMember,
    WorkspaceInvitation,
    ConnectedRepository,
    AutomationSettings,
)
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceMemberResponse,
    WorkspaceInvitationCreate,
    WorkspaceInvitationResponse,
    ConnectedRepoCreate,
    ConnectedRepoResponse,
    AutomationSettingsUpdate,
    AutomationSettingsResponse,
)
from app.services.auth_service import generate_secure_token, hash_token
from app.services.github_service import parse_github_url, GitHubError

logger = logging.getLogger(__name__)


def create_workspace(db: Session, user: User, data: WorkspaceCreate) -> WorkspaceResponse:
    now = datetime.utcnow()
    ws = Workspace(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        workspace_type=data.workspace_type,
        owner_id=user.id,
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(ws)
    db.flush()

    member = WorkspaceMember(
        workspace_id=ws.id,
        user_id=user.id,
        role="owner",
        joined_at=now,
    )
    db.add(member)
    db.commit()
    db.refresh(ws)

    return WorkspaceResponse(
        id=ws.id,
        name=ws.name,
        description=ws.description,
        workspace_type=ws.workspace_type,
        owner_id=ws.owner_id,
        status=ws.status,
        member_count=1,
        repository_count=0,
        current_user_role="owner",
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


def list_user_workspaces(db: Session, user: User) -> list[WorkspaceResponse]:
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).all()
    results = []
    for m in memberships:
        ws = m.workspace
        if not ws or ws.status != "active":
            continue
        member_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count()
        repo_count = db.query(ConnectedRepository).filter(ConnectedRepository.workspace_id == ws.id).count()
        results.append(
            WorkspaceResponse(
                id=ws.id,
                name=ws.name,
                description=ws.description,
                workspace_type=ws.workspace_type,
                owner_id=ws.owner_id,
                status=ws.status,
                member_count=member_count,
                repository_count=repo_count,
                current_user_role=m.role,
                created_at=ws.created_at,
                updated_at=ws.updated_at,
            )
        )
    return results


def get_workspace_details(db: Session, workspace_id: str, user: User) -> WorkspaceResponse:
    m = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this workspace.")

    ws = m.workspace
    member_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count()
    repo_count = db.query(ConnectedRepository).filter(ConnectedRepository.workspace_id == ws.id).count()

    return WorkspaceResponse(
        id=ws.id,
        name=ws.name,
        description=ws.description,
        workspace_type=ws.workspace_type,
        owner_id=ws.owner_id,
        status=ws.status,
        member_count=member_count,
        repository_count=repo_count,
        current_user_role=m.role,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


def update_workspace(db: Session, workspace_id: str, user: User, data: WorkspaceUpdate) -> WorkspaceResponse:
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    if data.name:
        ws.name = data.name.strip()
    if data.description is not None:
        ws.description = data.description.strip() or None
    ws.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ws)
    return get_workspace_details(db, workspace_id, user)


def list_workspace_members(db: Session, workspace_id: str) -> list[WorkspaceMemberResponse]:
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).all()
    results = []
    for m in members:
        u = m.user
        results.append(
            WorkspaceMemberResponse(
                id=m.id,
                workspace_id=m.workspace_id,
                user_id=m.user_id,
                username=u.username if u else "unknown",
                display_name=u.display_name if u else None,
                avatar_url=u.avatar_url if u else None,
                role=m.role,
                joined_at=m.joined_at,
            )
        )
    return results


def create_invitation(db: Session, workspace_id: str, inviter: User, data: WorkspaceInvitationCreate) -> WorkspaceInvitationResponse:
    raw_token = generate_secure_token(32)
    token_hash = hash_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(days=data.expires_in_days)

    inv = WorkspaceInvitation(
        workspace_id=workspace_id,
        inviter_id=inviter.id,
        token_hash=token_hash,
        role=data.role,
        target_email=data.target_email.lower().strip() if data.target_email else None,
        target_github_username=data.target_github_username.lower().strip() if data.target_github_username else None,
        is_revoked=False,
        expires_at=expires_at,
        created_at=datetime.utcnow(),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    invite_url = f"{settings.frontend_url}/workspaces/invite/{raw_token}"
    return WorkspaceInvitationResponse(
        id=inv.id,
        workspace_id=inv.workspace_id,
        role=inv.role,
        invite_url=invite_url,
        invite_token=raw_token,
        target_email=inv.target_email,
        target_github_username=inv.target_github_username,
        expires_at=inv.expires_at,
        created_at=inv.created_at,
    )


def accept_invitation(db: Session, raw_token: str, user: User) -> WorkspaceResponse:
    token_hash = hash_token(raw_token)
    inv = db.query(WorkspaceInvitation).filter(
        WorkspaceInvitation.token_hash == token_hash,
        WorkspaceInvitation.is_revoked == False,
    ).first()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or has been revoked.")

    if inv.expires_at < datetime.utcnow():
        inv.is_revoked = True
        db.commit()
        raise HTTPException(status_code=400, detail="Invitation has expired.")

    # Target identity constraints check
    if inv.target_email and user.email and inv.target_email.lower() != user.email.lower():
        raise HTTPException(status_code=403, detail=f"This invitation was sent specifically to {inv.target_email}.")
    if inv.target_github_username and user.username.lower() != inv.target_github_username.lower():
        raise HTTPException(status_code=403, detail=f"This invitation was sent specifically to GitHub user {inv.target_github_username}.")

    # Check if already a member
    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == inv.workspace_id,
        WorkspaceMember.user_id == user.id,
    ).first()
    if existing:
        return get_workspace_details(db, inv.workspace_id, user)

    # Add member
    member = WorkspaceMember(
        workspace_id=inv.workspace_id,
        user_id=user.id,
        role=inv.role,
        joined_at=datetime.utcnow(),
    )
    db.add(member)
    db.commit()

    return get_workspace_details(db, inv.workspace_id, user)


def change_member_role(db: Session, workspace_id: str, target_user_id: str, new_role: str, operator_user: User) -> WorkspaceMemberResponse:
    target_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == target_user_id,
    ).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found in workspace.")

    ws = target_member.workspace
    if target_member.role == "owner" and new_role != "owner":
        # Check if they are the sole owner
        owner_count = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.role == "owner",
        ).count()
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the sole owner of the workspace.")

    target_member.role = new_role
    db.commit()
    db.refresh(target_member)
    u = target_member.user
    return WorkspaceMemberResponse(
        id=target_member.id,
        workspace_id=target_member.workspace_id,
        user_id=target_member.user_id,
        username=u.username if u else "unknown",
        display_name=u.display_name if u else None,
        avatar_url=u.avatar_url if u else None,
        role=target_member.role,
        joined_at=target_member.joined_at,
    )


def remove_workspace_member(db: Session, workspace_id: str, target_user_id: str, operator_user: User) -> bool:
    target_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == target_user_id,
    ).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found in workspace.")

    # Owner safeguard
    if target_member.role == "owner":
        owner_count = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.role == "owner",
        ).count()
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the sole workspace owner.")

    db.delete(target_member)
    db.commit()
    return True


def connect_repository_to_workspace(db: Session, workspace_id: str, user: User, data: ConnectedRepoCreate) -> ConnectedRepoResponse:
    try:
        owner, repo_name = parse_github_url(data.github_url)
    except GitHubError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check duplicate
    existing = db.query(ConnectedRepository).filter(
        ConnectedRepository.workspace_id == workspace_id,
        ConnectedRepository.owner == owner,
        ConnectedRepository.repo_name == repo_name,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Repository {owner}/{repo_name} is already connected to this workspace.")

    repo = ConnectedRepository(
        workspace_id=workspace_id,
        owner=owner,
        repo_name=repo_name,
        github_url=f"https://github.com/{owner}/{repo_name}",
        default_branch=data.default_branch or "main",
        is_private=data.is_private,
        connection_status="connected",
        last_synced_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    db.add(repo)
    db.flush()

    # Create default automation settings
    auto = AutomationSettings(
        connected_repo_id=repo.id,
        is_enabled=False,
        analyze_on_pr_opened=True,
        analyze_on_pr_synchronize=True,
        analyze_on_pr_reopened=True,
        max_files_limit=250,
        notify_on_priority="all",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(auto)
    db.commit()
    db.refresh(repo)

    return _to_connected_repo_response(repo)


def list_workspace_repositories(db: Session, workspace_id: str) -> list[ConnectedRepoResponse]:
    repos = db.query(ConnectedRepository).filter(ConnectedRepository.workspace_id == workspace_id).all()
    return [_to_connected_repo_response(r) for r in repos]


def update_repo_automation_settings(db: Session, workspace_id: str, repo_id: str, data: AutomationSettingsUpdate) -> AutomationSettingsResponse:
    repo = db.query(ConnectedRepository).filter(
        ConnectedRepository.id == repo_id,
        ConnectedRepository.workspace_id == workspace_id,
    ).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Connected repository not found.")

    auto = repo.automation_settings
    if not auto:
        auto = AutomationSettings(connected_repo_id=repo.id)
        db.add(auto)

    if data.is_enabled is not None:
        auto.is_enabled = data.is_enabled
    if data.analyze_on_pr_opened is not None:
        auto.analyze_on_pr_opened = data.analyze_on_pr_opened
    if data.analyze_on_pr_synchronize is not None:
        auto.analyze_on_pr_synchronize = data.analyze_on_pr_synchronize
    if data.analyze_on_pr_reopened is not None:
        auto.analyze_on_pr_reopened = data.analyze_on_pr_reopened
    if data.max_files_limit is not None:
        auto.max_files_limit = data.max_files_limit
    if data.notify_on_priority is not None:
        auto.notify_on_priority = data.notify_on_priority
    auto.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(auto)
    return AutomationSettingsResponse.model_validate(auto)


def disconnect_repository(db: Session, workspace_id: str, repo_id: str) -> bool:
    repo = db.query(ConnectedRepository).filter(
        ConnectedRepository.id == repo_id,
        ConnectedRepository.workspace_id == workspace_id,
    ).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Connected repository not found in workspace.")
    db.delete(repo)
    db.commit()
    return True


def _to_connected_repo_response(repo: ConnectedRepository) -> ConnectedRepoResponse:
    auto_resp = None
    if repo.automation_settings:
        auto_resp = AutomationSettingsResponse.model_validate(repo.automation_settings)
    return ConnectedRepoResponse(
        id=repo.id,
        workspace_id=repo.workspace_id,
        github_repo_id=repo.github_repo_id,
        owner=repo.owner,
        repo_name=repo.repo_name,
        github_url=repo.github_url,
        default_branch=repo.default_branch,
        is_private=repo.is_private,
        connection_status=repo.connection_status,
        last_synced_at=repo.last_synced_at,
        created_at=repo.created_at,
        automation_settings=auto_resp,
    )
