import logging
import secrets
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def get_backend_base_url(request: Request) -> str:
    if settings.backend_url:
        return settings.backend_url.rstrip("/")
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    return f"{proto}://{host}".rstrip("/")


@router.get("/login", include_in_schema=False)
@router.get("/github/login")
def github_login(
    request: Request,
    redirect_url: str | None = None,
    return_to: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Direct browser navigation endpoint for GitHub OAuth initiation.
    Issues the CSRF state cookie directly on the backend origin and issues a 302 redirect
    to GitHub's OAuth authorization portal.
    """
    target_return = redirect_url or return_to or "/dashboard"
    state = create_oauth_state(db, redirect_url=target_return)
    backend_base = get_backend_base_url(request)
    callback_url = f"{backend_base}/api/v1/auth/github/callback"
    url = build_github_login_url(state, redirect_uri=callback_url)

    is_secure = settings.environment != "development" and not settings.frontend_url.startswith("http://localhost")
    cookie_samesite = "none" if is_secure else "lax"

    redirect_resp = RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)
    redirect_resp.set_cookie(
        key="repoautopsy_oauth_state",
        value=state,
        max_age=900,  # 15 minutes
        httponly=True,
        secure=is_secure,
        samesite=cookie_samesite,
        path="/",
    )
    return redirect_resp


@router.get("/login-url", response_model=LoginUrlResponse)
def get_login_url(
    request: Request,
    response: Response,
    redirect_url: str | None = None,
    db: Session = Depends(get_db),
):
    state = create_oauth_state(db, redirect_url=redirect_url)
    backend_base = get_backend_base_url(request)
    callback_url = f"{backend_base}/api/v1/auth/github/callback"
    url = build_github_login_url(state, redirect_uri=callback_url)

    # Bind state to initiating browser (Login CSRF defense)
    is_secure = settings.environment != "development" and not settings.frontend_url.startswith("http://localhost")
    cookie_samesite = "none" if is_secure else "lax"
    response.set_cookie(
        key="repoautopsy_oauth_state",
        value=state,
        max_age=900,  # 15 minutes
        httponly=True,
        secure=is_secure,
        samesite=cookie_samesite,
        path="/",
    )
    return LoginUrlResponse(login_url=url, state=state)


@router.get("/callback", include_in_schema=False)
@router.get("/github/callback")
async def github_callback_redirect(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Direct browser callback from GitHub OAuth.
    Validates state cookie on top-level GET request, completes token exchange,
    creates user session, sets session cookie, and redirects user to frontend application.
    """
    frontend_base = settings.frontend_url.split(",")[0].strip().rstrip("/")
    is_secure = settings.environment != "development" and not settings.frontend_url.startswith("http://localhost")
    cookie_samesite = "none" if is_secure else "lax"

    def redirect_with_error(msg: str) -> RedirectResponse:
        err_url = f"{frontend_base}/auth/callback?error={urllib.parse.quote(msg)}"
        resp = RedirectResponse(url=err_url, status_code=status.HTTP_302_FOUND)
        resp.delete_cookie("repoautopsy_oauth_state", path="/")
        return resp

    if error:
        detail = error_description or error or "GitHub authorization was declined."
        return redirect_with_error(detail)

    if not code or not state:
        return redirect_with_error("Missing OAuth authorization code or state parameter.")

    # 1. Validate and consume one-time state token from DB (CSRF defense)
    state_record = validate_and_consume_oauth_state(db, state)
    if not state_record:
        return redirect_with_error("Invalid or expired OAuth state parameter. Please try signing in again.")

    # 1b. Verify browser state cookie binding
    browser_state = request.cookies.get("repoautopsy_oauth_state")
    if browser_state:
        if not secrets.compare_digest(browser_state, state):
            return redirect_with_error("OAuth state verification failed: browser state cookie mismatch (login CSRF detected).")
    elif settings.environment == "production":
        return redirect_with_error("Missing OAuth browser state cookie. Login must be initiated from the same browser.")

    # 2. Exchange code for access token
    backend_base = get_backend_base_url(request)
    callback_url = f"{backend_base}/api/v1/auth/github/callback"
    try:
        access_token = await exchange_github_code(code, redirect_uri=callback_url)
    except Exception as e:
        logger.error("GitHub code exchange failed in GET callback: %s", e)
        return redirect_with_error(f"GitHub OAuth token exchange failed: {str(e)}")

    # 3. Fetch GitHub profile
    try:
        gh_profile = await fetch_github_user_profile(access_token)
    except Exception as e:
        logger.error("GitHub profile fetch failed in GET callback: %s", e)
        return redirect_with_error(f"Failed to fetch GitHub profile: {str(e)}")

    # 4. Upsert User & create default personal workspace
    user = get_or_create_user(db, gh_profile, access_token=access_token)

    # 5. Create secure session
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    session, raw_token = create_user_session(db, user, user_agent=user_agent, ip_address=client_ip)

    # Determine frontend redirect target
    target_path = state_record.redirect_url or "/dashboard"
    if not target_path.startswith("/"):
        target_path = f"/{target_path.lstrip('/')}"
    if target_path.startswith("//") or "://" in target_path:
        target_path = "/dashboard"

    redirect_url = f"{frontend_base}{target_path}"
    resp = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)

    # 6. Set HTTP-only, SameSite cookie
    resp.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=settings.session_expire_days * 86400,
        expires=settings.session_expire_days * 86400,
        httponly=True,
        secure=is_secure,
        samesite=cookie_samesite,
        path="/",
    )
    # Clear state cookie
    resp.delete_cookie("repoautopsy_oauth_state", path="/")
    return resp


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
    backend_base = get_backend_base_url(request)
    callback_url = f"{backend_base}/api/v1/auth/github/callback"
    try:
        access_token = await exchange_github_code(payload.code, redirect_uri=callback_url)
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
    cookie_samesite = "none" if is_secure else "lax"
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=settings.session_expire_days * 86400,
        expires=settings.session_expire_days * 86400,
        httponly=True,
        secure=is_secure,
        samesite=cookie_samesite,
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
