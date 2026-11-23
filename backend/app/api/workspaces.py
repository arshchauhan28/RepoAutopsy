from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceMemberResponse,
    WorkspaceInvitationCreate,
    WorkspaceInvitationResponse,
    JoinWorkspaceRequest,
    ChangeMemberRoleRequest,
    ConnectedRepoCreate,
    ConnectedRepoResponse,
    AutomationSettingsUpdate,
    AutomationSettingsResponse,
)
from app.services import workspace_service
from app.api.deps import get_current_user, require_workspace_member

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return workspace_service.create_workspace(db, user, payload)


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return workspace_service.list_user_workspaces(db, user)


@router.get("/{id}", response_model=WorkspaceResponse)
def get_workspace(
    id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return workspace_service.get_workspace_details(db, id, user)


@router.patch("/{id}", response_model=WorkspaceResponse)
def update_workspace(
    id: str,
    payload: WorkspaceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_workspace_member(id, min_role="admin", user=user, db=db)
    return workspace_service.update_workspace(db, id, user, payload)


@router.get("/{id}/members", response_model=list[WorkspaceMemberResponse])
def list_members(
    id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_workspace_member(id, min_role="viewer", user=user, db=db)
    return workspace_service.list_workspace_members(db, id)


@router.post("/{id}/invitations", response_model=WorkspaceInvitationResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(
    id: str,
    payload: WorkspaceInvitationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_workspace_member(id, min_role="admin", user=user, db=db)
    return workspace_service.create_invitation(db, id, user, payload)


@router.post("/join", response_model=WorkspaceResponse)
def join_workspace(
    payload: JoinWorkspaceRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return workspace_service.accept_invitation(db, payload.invite_token, user)


@router.patch("/{id}/members/{user_id}/role", response_model=WorkspaceMemberResponse)
def change_role(
    id: str,
    user_id: str,
    payload: ChangeMemberRoleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_workspace_member(id, min_role="admin", user=user, db=db)
    return workspace_service.change_member_role(db, id, user_id, payload.role, user)


@router.delete("/{id}/members/{user_id}")
def remove_member(
    id: str,
    user_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Members can remove themselves (leave); only admins/owners can remove others
    if user.id != user_id:
        require_workspace_member(id, min_role="admin", user=user, db=db)
    else:
        require_workspace_member(id, min_role="viewer", user=user, db=db)

    workspace_service.remove_workspace_member(db, id, user_id, user)
    return {"message": "Member removed successfully"}


@router.get("/{id}/repositories", response_model=list[ConnectedRepoResponse])
def list_repositories(
    id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_workspace_member(id, min_role="viewer", user=user, db=db)
    return workspace_service.list_workspace_repositories(db, id)


@router.post("/{id}/repositories", response_model=ConnectedRepoResponse, status_code=status.HTTP_201_CREATED)
def connect_repository(
    id: str,
    payload: ConnectedRepoCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_workspace_member(id, min_role="admin", user=user, db=db)
    return workspace_service.connect_repository_to_workspace(db, id, user, payload)


@router.delete("/{id}/repositories/{repo_id}")
def disconnect_repository(
    id: str,
    repo_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_workspace_member(id, min_role="admin", user=user, db=db)
    workspace_service.disconnect_repository(db, id, repo_id)
    return {"message": "Repository disconnected successfully"}


@router.patch("/{id}/repositories/{repo_id}/automation", response_model=AutomationSettingsResponse)
def update_automation(
    id: str,
    repo_id: str,
    payload: AutomationSettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_workspace_member(id, min_role="admin", user=user, db=db)
    return workspace_service.update_repo_automation_settings(db, id, repo_id, payload)
