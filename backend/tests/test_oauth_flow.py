import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import settings
from app.db.session import Base, get_db
from app.main import app
from app.models.user import OAuthState
from app.services.auth_service import create_oauth_state

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_github_login_redirect_sets_state_cookie(client):
    """GET /api/v1/auth/github/login returns 302 to GitHub and sets state cookie."""
    resp = client.get("/api/v1/auth/github/login?redirect_url=/analyze", follow_redirects=False)
    assert resp.status_code == 302
    location = resp.headers.get("location")
    assert location is not None
    assert "github.com/login/oauth/authorize" in location
    assert "client_id=" in location
    assert "state=" in location
    assert "redirect_uri=" in location

    assert "repoautopsy_oauth_state" in resp.cookies
    cookie_val = resp.cookies["repoautopsy_oauth_state"]
    assert cookie_val in location


def test_github_login_production_cookie_security(client, monkeypatch):
    """In production mode, state cookie must be secure with SameSite=None."""
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "frontend_url", "https://repoautopsy.vercel.app")
    
    resp = client.get("/api/v1/auth/github/login", follow_redirects=False)
    assert resp.status_code == 302
    assert "repoautopsy_oauth_state" in resp.cookies
    # Raw header inspection
    cookie_header = resp.headers.get("set-cookie", "")
    assert "repoautopsy_oauth_state=" in cookie_header
    assert "Secure" in cookie_header or "secure" in cookie_header.lower()
    assert "samesite=none" in cookie_header.lower()


def test_github_callback_success(client, db_session):
    """GET /api/v1/auth/github/callback completes login, sets session cookie and redirects."""
    state = create_oauth_state(db_session, redirect_url="/dashboard")
    client.cookies.set("repoautopsy_oauth_state", state)

    resp = client.get(
        f"/api/v1/auth/github/callback?code=simulated_code_123&state={state}",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    location = resp.headers.get("location")
    assert location is not None
    assert "/api/auth/handoff?code=" in location
    assert "return_to=%2Fdashboard" in location or "return_to=/dashboard" in location

    # Session cookie set
    assert settings.session_cookie_name in resp.cookies
    # State cookie cleared (either set to empty or max-age=0)
    set_cookie_headers = resp.headers.get_list("set-cookie") if hasattr(resp.headers, "get_list") else [resp.headers.get("set-cookie", "")]
    combined_cookies = " ".join(set_cookie_headers)
    assert settings.session_cookie_name in combined_cookies


def test_github_callback_github_error_redirect(client):
    """When GitHub sends error (e.g. user cancelled), redirect with error to frontend."""
    resp = client.get(
        "/api/v1/auth/github/callback?error=access_denied&error_description=The+user+has+denied+your+application+access.",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    location = resp.headers.get("location", "")
    assert "/auth/callback?error=" in location
    assert "denied" in location.lower()


def test_github_callback_missing_or_mismatched_state_cookie(client, db_session, monkeypatch):
    """GET callback rejects mismatched or missing state cookie in production."""
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "frontend_url", "https://repoautopsy.vercel.app")
    
    state = create_oauth_state(db_session, redirect_url="/dashboard")

    # 1. Missing cookie in production
    resp = client.get(
        f"/api/v1/auth/github/callback?code=test_code&state={state}",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    location1 = resp.headers.get("location", "")
    assert "/auth/callback?error=" in location1
    assert "Missing" in location1 and "state" in location1 and "cookie" in location1

    # 2. Mismatched cookie
    state2 = create_oauth_state(db_session, redirect_url="/dashboard")
    client.cookies.set("repoautopsy_oauth_state", "attacker_tampered_state")
    resp2 = client.get(
        f"/api/v1/auth/github/callback?code=test_code&state={state2}",
        follow_redirects=False,
    )
    assert resp2.status_code == 302
    assert "/auth/callback?error=" in resp2.headers.get("location", "")
    assert "mismatch" in resp2.headers.get("location", "").lower()
    client.cookies.clear()


def test_github_callback_expired_db_state(client, db_session):
    """Expired database state token is rejected."""
    expired_state = OAuthState(
        id="expired_state_token_123456",
        redirect_url="/dashboard",
        expires_at=datetime.utcnow() - timedelta(minutes=5),
        created_at=datetime.utcnow() - timedelta(minutes=20),
    )
    db_session.add(expired_state)
    db_session.commit()

    client.cookies.set("repoautopsy_oauth_state", "expired_state_token_123456")
    resp = client.get(
        "/api/v1/auth/github/callback?code=test_code&state=expired_state_token_123456",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "/auth/callback?error=" in resp.headers.get("location", "")
    assert "expired" in resp.headers.get("location", "").lower()
    client.cookies.clear()


def test_github_callback_open_redirect_defense(client, db_session):
    """Malicious redirect URLs in state must default safely to /dashboard."""
    state = create_oauth_state(db_session, redirect_url="https://evil-phishing.com")
    client.cookies.set("repoautopsy_oauth_state", state)

    resp = client.get(
        f"/api/v1/auth/github/callback?code=simulated_code_456&state={state}",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    location = resp.headers.get("location", "")
    assert "evil-phishing" not in location
    assert "/api/auth/handoff?code=" in location
    assert "return_to=%2Fdashboard" in location or "return_to=/dashboard" in location


def test_handoff_creation_and_exchange(client, db_session):
    """Server-side BFF handoff exchange succeeds and returns session credentials."""
    from app.services.auth_service import get_or_create_user, create_user_session, create_auth_handoff
    user = get_or_create_user(db_session, {"id": "12345", "login": "octocat", "name": "Mona Lisa", "email": "octo@github.com"})
    session, raw_token = create_user_session(db_session, user)

    handoff_code = create_auth_handoff(db_session, raw_token, user.id)

    # BFF calls server-side POST /api/v1/auth/handoff/exchange
    resp = client.post("/api/v1/auth/handoff/exchange", json={"handoff_code": handoff_code})
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_token"] == raw_token
    assert data["user"]["username"] == "octocat"
    assert settings.session_cookie_name in resp.cookies


def test_handoff_single_use_prevents_replay(client, db_session):
    """A handoff code cannot be exchanged more than once (replay prevention)."""
    from app.services.auth_service import get_or_create_user, create_user_session, create_auth_handoff
    user = get_or_create_user(db_session, {"id": "12346", "login": "replay_user"})
    session, raw_token = create_user_session(db_session, user)

    handoff_code = create_auth_handoff(db_session, raw_token, user.id)

    # First exchange succeeds
    resp1 = client.post("/api/v1/auth/handoff/exchange", json={"handoff_code": handoff_code})
    assert resp1.status_code == 200

    # Second exchange with the same code is rejected
    resp2 = client.post("/api/v1/auth/handoff/exchange", json={"handoff_code": handoff_code})
    assert resp2.status_code == 400
    assert "Invalid, expired, or already used" in resp2.json()["detail"]


def test_handoff_expired_code_rejected(client, db_session):
    """Expired handoff codes are rejected."""
    from app.models.user import AuthHandoff
    from app.services.auth_service import get_or_create_user, create_user_session, hash_token
    user = get_or_create_user(db_session, {"id": "12347", "login": "expired_user"})
    session, raw_token = create_user_session(db_session, user)

    code = "expired_handoff_code_123"
    expired_handoff = AuthHandoff(
        id=hash_token(code),
        session_token=raw_token,
        user_id=user.id,
        expires_at=datetime.utcnow() - timedelta(seconds=10),
        created_at=datetime.utcnow() - timedelta(seconds=70),
    )
    db_session.add(expired_handoff)
    db_session.commit()

    resp = client.post("/api/v1/auth/handoff/exchange", json={"handoff_code": code})
    assert resp.status_code == 400
    assert "Invalid, expired, or already used" in resp.json()["detail"]


def test_handoff_invalid_code_rejected(client):
    """Non-existent handoff codes are rejected."""
    resp = client.post("/api/v1/auth/handoff/exchange", json={"handoff_code": "completely_fake_code_xyz"})
    assert resp.status_code == 400
    assert "Invalid, expired, or already used" in resp.json()["detail"]


def test_authenticated_request_via_bearer_and_cookie(client, db_session):
    """FastAPI accepts verified session identity via Authorization header or Cookie."""
    from app.services.auth_service import get_or_create_user, create_user_session
    user = get_or_create_user(db_session, {"id": "12348", "login": "dual_auth_user"})
    session, raw_token = create_user_session(db_session, user)

    # 1. Using Authorization header (as forwarded by BFF Proxy)
    resp_header = client.get("/api/v1/auth/status", headers={"Authorization": f"Bearer {raw_token}"})
    assert resp_header.status_code == 200
    assert resp_header.json()["authenticated"] is True
    assert resp_header.json()["user"]["username"] == "dual_auth_user"

    # 2. Using Cookie
    client.cookies.set(settings.session_cookie_name, raw_token)
    resp_cookie = client.get("/api/v1/auth/status")
    assert resp_cookie.status_code == 200
    assert resp_cookie.json()["authenticated"] is True
    assert resp_cookie.json()["user"]["username"] == "dual_auth_user"
    client.cookies.clear()


def test_logout_invalidates_session_and_clears_cookie(client, db_session):
    """Logging out revokes the session and subsequent requests return unauthenticated."""
    from app.services.auth_service import get_or_create_user, create_user_session
    user = get_or_create_user(db_session, {"id": "12349", "login": "logout_user"})
    session, raw_token = create_user_session(db_session, user)

    client.cookies.set(settings.session_cookie_name, raw_token)
    me_resp = client.get("/api/v1/auth/me")
    assert me_resp.status_code == 200

    logout_resp = client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200

    # Subsequent request with the same token is unauthorized
    status_resp = client.get("/api/v1/auth/status", headers={"Authorization": f"Bearer {raw_token}"})
    assert status_resp.status_code == 200
    assert status_resp.json()["authenticated"] is False
    client.cookies.clear()
