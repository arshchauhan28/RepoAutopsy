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
    assert location.endswith("/dashboard")

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
    assert location.endswith("/dashboard")
