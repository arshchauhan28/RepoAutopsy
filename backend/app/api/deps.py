from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.services.auth_service import get_user_from_session_token

ROLE_HIERARCHY = {
    "owner": 4,
    "admin": 3,
    "member": 2,
    "viewer": 1,
}


def get_token_from_request(request: Request) -> str | None:
    # 1. Check HTTP-only cookie
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        return token

    # 2. Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()

    return None


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    token = get_token_from_request(request)
    if not token:
        return None
    return get_user_from_session_token(db, token)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    user = get_optional_user(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in with GitHub.",
        )
    return user


def require_workspace_member(
    workspace_id: str,
    min_role: str = "viewer",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkspaceMember:
    """
    Validates that user is a member of workspace_id with at least min_role.
    min_role ordering: viewer <= member <= admin <= owner
    """
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not a member of this workspace.",
        )

    user_level = ROLE_HIERARCHY.get(membership.role, 0)
    required_level = ROLE_HIERARCHY.get(min_role, 1)

    if user_level < required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required role: '{min_role}', your role: '{membership.role}'.",
        )

    return membership


def check_resource_access(
    resource_workspace_id: str | None,
    user: User | None,
    db: Session,
    min_role: str = "viewer",
) -> None:
    """
    Enforces multi-tenant authorization for private repositories and workspace resources:
    - If resource_workspace_id is None: The resource belongs to a public guest workflow (accessible).
    - If resource_workspace_id is set: The requesting user MUST be authenticated AND an active
      member of that workspace with at least min_role.
    """
    if not resource_workspace_id:
        return  # Public guest workflow

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access private workspace resources.",
        )

    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == resource_workspace_id,
            WorkspaceMember.user_id == user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not a member of the workspace owning this resource.",
        )

    user_level = ROLE_HIERARCHY.get(membership.role, 0)
    required_level = ROLE_HIERARCHY.get(min_role, 1)

    if user_level < required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required role: '{min_role}', your role: '{membership.role}'.",
        )

