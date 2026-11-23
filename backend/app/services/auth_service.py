import hashlib
import secrets
import logging
from datetime import datetime, timedelta
import httpx
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User, UserSession, OAuthState, GitHubConnection
from app.models.workspace import Workspace, WorkspaceMember

logger = logging.getLogger(__name__)


def generate_secure_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_oauth_state(db: Session, redirect_url: str | None = None) -> str:
    state_token = generate_secure_token(24)
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    state = OAuthState(
        id=state_token,
        redirect_url=redirect_url,
        expires_at=expires_at,
        created_at=datetime.utcnow(),
    )
    db.add(state)
    db.commit()
    return state_token


def validate_and_consume_oauth_state(db: Session, state_token: str) -> OAuthState | None:
    state = db.query(OAuthState).filter(OAuthState.id == state_token).first()
    if not state:
        return None
    if state.expires_at < datetime.utcnow():
        db.delete(state)
        db.commit()
        return None
    
    # State is one-time use
    db.delete(state)
    db.commit()
    return state


def build_github_login_url(state: str) -> str:
    client_id = settings.github_client_id or "repoautopsy-dev-client-id"
    redirect_uri = f"{settings.frontend_url}/auth/callback"
    scope = "read:user user:email repo"
    return (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&state={state}"
    )


async def exchange_github_code(code: str) -> str:
    """
    Exchanges OAuth code for access token.
    Falls back to mock token in development / test if client secret is not configured
    or if test/simulated code is provided.
    """
    if settings.environment in ("development", "test") and (
        code.startswith("test_") or code.startswith("simulated_") or not settings.github_client_id or not settings.github_client_secret
    ):
        logger.info("Using simulated OAuth token for code=%s in %s environment", code, settings.environment)
        return f"gho_simulated_{code[:12]}"

    if not settings.github_client_id or not settings.github_client_secret:
        raise ValueError("GitHub OAuth credentials not configured on server.")

    url = "https://github.com/login/oauth/access_token"
    headers = {"Accept": "application/json"}
    payload = {
        "client_id": settings.github_client_id,
        "client_secret": settings.github_client_secret,
        "code": code,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        token = data.get("access_token")
        if not token:
            error = data.get("error_description") or data.get("error") or "Unknown GitHub OAuth error"
            raise ValueError(f"GitHub token exchange failed: {error}")
        return token


async def fetch_github_user_profile(access_token: str) -> dict:
    """
    Fetches user profile and primary verified email from GitHub.
    Simulates user in test/development when using mock tokens.
    """
    if access_token.startswith("gho_simulated_"):
        if settings.environment not in ("development", "test"):
            raise ValueError("Simulated authentication tokens are strictly forbidden in production.")
        sub = access_token.replace("gho_simulated_", "")
        return {
            "id": f"gh_id_{sub}",
            "login": f"user_{sub}",
            "name": f"Developer {sub.capitalize()}",
            "avatar_url": "https://avatars.githubusercontent.com/u/583231?v=4",
            "email": f"dev_{sub}@example.com",
        }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "RepoAutopsy-Auth/1.0",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get("https://api.github.com/user", headers=headers)
        resp.raise_for_status()
        user_data = resp.json()

        email = user_data.get("email")
        if not email:
            # Try fetching primary email
            try:
                emails_resp = await client.get("https://api.github.com/user/emails", headers=headers)
                if emails_resp.is_success:
                    emails = emails_resp.json()
                    primary = next((e["email"] for e in emails if e.get("primary")), None)
                    email = primary or (emails[0]["email"] if emails else None)
            except Exception as e:
                logger.warning("Failed to fetch GitHub user emails: %s", e)

        return {
            "id": str(user_data["id"]),
            "login": user_data["login"],
            "name": user_data.get("name") or user_data["login"],
            "avatar_url": user_data.get("avatar_url"),
            "email": email,
        }


def get_or_create_user(db: Session, gh_profile: dict, access_token: str | None = None) -> User:
    github_id = str(gh_profile["id"])
    user = db.query(User).filter(User.github_id == github_id).first()

    now = datetime.utcnow()
    if not user:
        user = User(
            github_id=github_id,
            username=gh_profile["login"],
            display_name=gh_profile.get("name"),
            avatar_url=gh_profile.get("avatar_url"),
            email=gh_profile.get("email"),
            is_active=True,
            created_at=now,
            last_login_at=now,
        )
        db.add(user)
        db.flush()

        # Create default Personal Workspace for user
        personal_ws = Workspace(
            name=f"{user.username}'s Workspace",
            description="Personal workspace for repository analysis",
            workspace_type="personal",
            owner_id=user.id,
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(personal_ws)
        db.flush()

        member = WorkspaceMember(
            workspace_id=personal_ws.id,
            user_id=user.id,
            role="owner",
            joined_at=now,
        )
        db.add(member)
    else:
        # Update mutable profile info
        user.username = gh_profile["login"]
        if gh_profile.get("name"):
            user.display_name = gh_profile["name"]
        if gh_profile.get("avatar_url"):
            user.avatar_url = gh_profile["avatar_url"]
        if gh_profile.get("email"):
            user.email = gh_profile["email"]
        user.last_login_at = now

    # Upsert GitHubConnection record
    if access_token:
        conn = db.query(GitHubConnection).filter(
            GitHubConnection.user_id == user.id,
            GitHubConnection.github_user_id == github_id,
        ).first()
        if not conn:
            conn = GitHubConnection(
                user_id=user.id,
                github_user_id=github_id,
                access_token_encrypted=access_token,
                scope="read:user,user:email,repo",
                status="active",
                created_at=now,
                updated_at=now,
            )
            db.add(conn)
        else:
            conn.access_token_encrypted = access_token
            conn.status = "active"
            conn.updated_at = now

    db.commit()
    db.refresh(user)
    return user


def create_user_session(db: Session, user: User, user_agent: str | None = None, ip_address: str | None = None) -> tuple[UserSession, str]:
    raw_token = generate_secure_token(32)
    token_hash = hash_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(days=settings.session_expire_days)

    session = UserSession(
        user_id=user.id,
        session_token_hash=token_hash,
        expires_at=expires_at,
        is_revoked=False,
        created_at=datetime.utcnow(),
        last_accessed_at=datetime.utcnow(),
        user_agent=user_agent[:300] if user_agent else None,
        ip_address=ip_address[:64] if ip_address else None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, raw_token


def get_user_from_session_token(db: Session, raw_token: str) -> User | None:
    if not raw_token:
        return None
    token_hash = hash_token(raw_token)
    session = db.query(UserSession).filter(
        UserSession.session_token_hash == token_hash,
        UserSession.is_revoked == False,
    ).first()

    if not session:
        return None

    if session.expires_at < datetime.utcnow():
        session.is_revoked = True
        db.commit()
        return None

    # Update last_accessed_at if >5 min since last update
    if (datetime.utcnow() - session.last_accessed_at).total_seconds() > 300:
        session.last_accessed_at = datetime.utcnow()
        db.commit()

    return session.user if session.user.is_active else None


def revoke_session(db: Session, raw_token: str) -> bool:
    if not raw_token:
        return False
    token_hash = hash_token(raw_token)
    session = db.query(UserSession).filter(UserSession.session_token_hash == token_hash).first()
    if session:
        session.is_revoked = True
        db.commit()
        return True
    return False
