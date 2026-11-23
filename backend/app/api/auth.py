import secrets
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserResponse, SessionResponse, LoginUrlResponse, OAuthCallbackRequest
from app.services.auth_service import (
    create_oauth_state,
    validate_and_consume_oauth_state,
    build_github_login_url,
    exchange_github_code,
    fetch_github_user_profile,
    get_or_create_user,
    create_user_session,
    revoke_session,
)
from app.api.deps import get_current_user, get_optional_user, get_token_from_request

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login-url", response_model=LoginUrlResponse)
def get_login_url(
    response: Response,
    redirect_url: str | None = None,
    db: Session = Depends(get_db),
):
    state = create_oauth_state(db, redirect_url=redirect_url)
    url = build_github_login_url(state)

    # Bind state to initiating browser (Login CSRF defense)
    is_secure = settings.environment == "production"
    response.set_cookie(
        key="repoautopsy_oauth_state",
        value=state,
        max_age=900,  # 15 minutes
        httponly=True,
        secure=is_secure,
        samesite="lax",
        path="/",
    )
    return LoginUrlResponse(login_url=url, state=state)


@router.post("/callback", response_model=SessionResponse)
async def oauth_callback(
    payload: OAuthCallbackRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    # 1. Validate and consume one-time state token from DB (CSRF defense)
    state_record = validate_and_consume_oauth_state(db, payload.state)
    if not state_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state parameter. Please try signing in again.",
        )

    # 1b. Verify browser state cookie binding if cookie is present or in production
    browser_state = request.cookies.get("repoautopsy_oauth_state")
    if browser_state:
        if not secrets.compare_digest(browser_state, payload.state):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAuth state verification failed: browser state cookie mismatch (login CSRF detected).",
            )
    elif settings.environment == "production":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth browser state cookie. Login must be initiated from the same browser.",
        )

    # Clear state cookie
    response.delete_cookie("repoautopsy_oauth_state", path="/")

    # 2. Exchange code for access token
    try:
        access_token = await exchange_github_code(payload.code)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub OAuth token exchange failed: {str(e)}",
        )

    # 3. Fetch GitHub profile
    try:
        gh_profile = await fetch_github_user_profile(access_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch GitHub profile: {str(e)}",
        )

    # 4. Upsert User & create default personal workspace
    user = get_or_create_user(db, gh_profile, access_token=access_token)

    # 5. Create secure session
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    session, raw_token = create_user_session(db, user, user_agent=user_agent, ip_address=client_ip)

    # 6. Set HTTP-only, SameSite cookie
    is_secure = settings.environment != "development" and not settings.frontend_url.startswith("http://localhost")
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=settings.session_expire_days * 86400,
        expires=settings.session_expire_days * 86400,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        path="/",
    )

    return SessionResponse(
        user=UserResponse.model_validate(user),
        expires_at=session.expires_at,
        session_token=raw_token,
    )


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.get("/status")
def get_auth_status(user: User | None = Depends(get_optional_user)):
    if not user:
        return {"authenticated": False, "user": None}
    return {
        "authenticated": True,
        "user": UserResponse.model_validate(user),
    }


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    token = get_token_from_request(request)
    if token:
        revoke_session(db, token)

    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
    )
    return {"message": "Successfully logged out"}
