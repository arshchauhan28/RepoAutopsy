from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = None
    workspace_type: str = Field("team", pattern="^(personal|team|org)$")


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=150)
    description: str | None = None


class WorkspaceMemberResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    role: str  # owner, admin, member, viewer
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    workspace_type: str
    owner_id: str
    status: str
    member_count: int = 1
    repository_count: int = 0
    current_user_role: str = "viewer"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkspaceInvitationCreate(BaseModel):
    role: str = Field("member", pattern="^(admin|member|viewer)$")
    target_email: str | None = None
    target_github_username: str | None = None
    expires_in_days: int = Field(7, ge=1, le=30)


class WorkspaceInvitationResponse(BaseModel):
    id: str
    workspace_id: str
    role: str
    invite_url: str
    invite_token: str
    target_email: str | None = None
    target_github_username: str | None = None
    expires_at: datetime
    created_at: datetime


class JoinWorkspaceRequest(BaseModel):
    invite_token: str


class ChangeMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(admin|member|viewer)$")


class ConnectedRepoCreate(BaseModel):
    github_url: str
    is_private: bool = False
    default_branch: str = "main"


class AutomationSettingsResponse(BaseModel):
    id: str
    connected_repo_id: str
    is_enabled: bool
    analyze_on_pr_opened: bool
    analyze_on_pr_synchronize: bool
    analyze_on_pr_reopened: bool
    max_files_limit: int
    notify_on_priority: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AutomationSettingsUpdate(BaseModel):
    is_enabled: bool | None = None
    analyze_on_pr_opened: bool | None = None
    analyze_on_pr_synchronize: bool | None = None
    analyze_on_pr_reopened: bool | None = None
    max_files_limit: int | None = None
    notify_on_priority: str | None = None


class ConnectedRepoResponse(BaseModel):
    id: str
    workspace_id: str
    github_repo_id: str | None = None
    owner: str
    repo_name: str
    github_url: str
    default_branch: str
    is_private: bool
    connection_status: str
    last_synced_at: datetime | None = None
    created_at: datetime
    automation_settings: AutomationSettingsResponse | None = None

    model_config = ConfigDict(from_attributes=True)
