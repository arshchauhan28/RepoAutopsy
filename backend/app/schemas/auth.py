from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    id: str
    github_id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    email: str | None = None
    is_active: bool = True
    created_at: datetime
    last_login_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionResponse(BaseModel):
    user: UserResponse
    expires_at: datetime
    session_token: str | None = None


class LoginUrlResponse(BaseModel):
    login_url: str
    state: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str
