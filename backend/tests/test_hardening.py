import uuid
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.session import Base, get_db
from app.main import app
from app.models.analysis import Analysis
from app.models.automation import AnalysisJob
from app.models.pull_request import PullRequestAnalysis
from app.models.user import User, UserSession, OAuthState
from app.models.workspace import Workspace, WorkspaceMember
from app.services.auth_service import (
    create_oauth_state,
    create_user_session,
    fetch_github_user_profile,
    get_or_create_user,
)
from app.services.github_app_service import (
    generate_github_app_jwt,
    get_installation_access_token,
    _INSTALLATION_TOKEN_CACHE,
)
from app.services.worker_service import recover_stale_jobs

# In-memory SQLite with StaticPool so all connections share the same database
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


# =========================================================================
# 1. OAuth Login CSRF Cookie Binding Tests
# =========================================================================

def test_oauth_login_csrf_cookie_issuance(client):
    """GET /api/v1/auth/login-url must set a secure repoautopsy_oauth_state cookie."""
    resp = client.get("/api/v1/auth/login-url")
    assert resp.status_code == 200
    data = resp.json()
    assert "login_url" in data
    assert "state=" in data["login_url"]

    # Verify cookie was set
    assert "repoautopsy_oauth_state" in resp.cookies
    cookie_state = resp.cookies["repoautopsy_oauth_state"]
    assert cookie_state in data["login_url"]


def test_oauth_callback_blocks_missing_or_mismatched_state_cookie(client, db_session, monkeypatch):
    """Callback must reject attempts if the browser cookie does not match the state parameter."""
    state = create_oauth_state(db_session)

    # 1. Missing cookie in production
    monkeypatch.setattr(settings, "environment", "production")
    resp = client.post("/api/v1/auth/callback", json={"code": "test_code", "state": state})
    assert resp.status_code == 400
    assert "Missing OAuth browser state cookie" in resp.json()["detail"]

    # 2. Mismatched cookie
    state2 = create_oauth_state(db_session)
    client.cookies.set("repoautopsy_oauth_state", "mismatched_attacker_state")
    resp2 = client.post("/api/v1/auth/callback", json={"code": "test_code", "state": state2})
    assert resp2.status_code == 400
    assert "cookie mismatch" in resp2.json()["detail"]
    client.cookies.clear()


def test_oauth_callback_succeeds_with_matching_state_cookie(client, db_session):
    """Callback succeeds and consumes state when the browser cookie matches."""
    state = create_oauth_state(db_session)
    client.cookies.set("repoautopsy_oauth_state", state)

    resp = client.post("/api/v1/auth/callback", json={"code": "simulated_code", "state": state})
    assert resp.status_code == 200
    assert "session_token" in resp.json()
    assert resp.json()["user"]["username"].startswith("user_")


# =========================================================================
# 2. Strict Production Environment Checks
# =========================================================================

def test_production_blocks_simulated_tokens(monkeypatch):
    """In production mode, simulated OAuth tokens must be strictly rejected."""
    import asyncio
    monkeypatch.setattr(settings, "environment", "production")
    with pytest.raises(ValueError, match="Simulated authentication tokens are strictly forbidden in production"):
        asyncio.run(fetch_github_user_profile("gho_simulated_token_123"))


def test_production_config_validator(monkeypatch):
    """Production validator flags insecure default session secret."""
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "session_secret", "insecure-dev-session-secret-change-in-production-repoautopsy")
    errors = settings.validate_production_settings()
    assert len(errors) > 0
    assert any("SESSION_SECRET" in e for e in errors)


# =========================================================================
# 3. Multi-Tenant Private Resource Authorization
# =========================================================================

def test_private_analysis_requires_membership(client, db_session):
    """Analyses tied to a workspace reject unauthorized users and unauthenticated guests."""
    # 1. Create Workspace A with User A
    user_a = get_or_create_user(db_session, {"id": "101", "login": "alice", "email": "alice@test.local"})
    ws_a = Workspace(name="Alice Team", owner_id=user_a.id)
    db_session.add(ws_a)
    db_session.commit()
    db_session.add(WorkspaceMember(workspace_id=ws_a.id, user_id=user_a.id, role="admin"))

    # Create private analysis in Workspace A
    analysis = Analysis(
        id=str(uuid.uuid4()),
        github_url="https://github.com/alice/private-repo",
        workspace_id=ws_a.id,
        user_id=user_a.id,
        owner="alice",
        repo_name="private-repo",
        status="completed",
        file_tree=[{"path": "src/main.py", "size": 120}],
    )
    db_session.add(analysis)
    db_session.commit()

    # 2. Unauthenticated guest attempts to access -> 401 Unauthorized
    resp_guest = client.get(f"/api/v1/analyses/{analysis.id}")
    assert resp_guest.status_code == 401

    resp_guest_files = client.get(f"/api/v1/analyses/{analysis.id}/files")
    assert resp_guest_files.status_code == 401

    resp_guest_report = client.get(f"/api/v1/reports/{analysis.id}")
    assert resp_guest_report.status_code == 401

    # 3. User B (not in Workspace A) attempts to access -> 403 Forbidden
    user_b = get_or_create_user(db_session, {"id": "102", "login": "bob", "email": "bob@test.local"})
    _, bob_token = create_user_session(db_session, user_b)
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    resp_bob = client.get(f"/api/v1/analyses/{analysis.id}", headers=bob_headers)
    assert resp_bob.status_code == 403
    assert "Access denied" in resp_bob.json()["detail"]

    resp_bob_files = client.get(f"/api/v1/analyses/{analysis.id}/files", headers=bob_headers)
    assert resp_bob_files.status_code == 403

    resp_bob_report = client.get(f"/api/v1/reports/{analysis.id}", headers=bob_headers)
    assert resp_bob_report.status_code == 403

    # 4. User A (workspace member) accesses -> 200 OK
    _, alice_token = create_user_session(db_session, user_a)
    alice_headers = {"Authorization": f"Bearer {alice_token}"}

    resp_alice = client.get(f"/api/v1/analyses/{analysis.id}", headers=alice_headers)
    assert resp_alice.status_code == 200
    assert resp_alice.json()["id"] == analysis.id

    resp_alice_files = client.get(f"/api/v1/analyses/{analysis.id}/files", headers=alice_headers)
    assert resp_alice_files.status_code == 200


def test_public_analysis_accessible_to_all(client, db_session):
    """Analyses without workspace_id (public guest analyses) remain accessible to anyone."""
    public_analysis = Analysis(
        id=str(uuid.uuid4()),
        github_url="https://github.com/public/open-repo",
        workspace_id=None,
        owner="public",
        repo_name="open-repo",
        status="completed",
        file_tree=[{"path": "README.md", "size": 100}],
    )
    db_session.add(public_analysis)
    db_session.commit()

    # Unauthenticated guest access succeeds
    resp = client.get(f"/api/v1/analyses/{public_analysis.id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == public_analysis.id


def test_private_pull_request_authorization(client, db_session):
    """PR Autopsy tied to a workspace rejects non-members and allows members."""
    user = get_or_create_user(db_session, {"id": "201", "login": "charlie", "email": "charlie@test.local"})
    ws = Workspace(name="Charlie Team", owner_id=user.id)
    db_session.add(ws)
    db_session.commit()
    db_session.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="admin"))

    pr = PullRequestAnalysis(
        id=str(uuid.uuid4()),
        workspace_id=ws.id,
        user_id=user.id,
        repo_owner="charlie",
        repo_name="confidential-app",
        pr_number=42,
        pr_title="Add secret feature",
        base_branch="main",
        head_branch="feature",
        base_sha="abcdef123456",
        head_sha="123456abcdef",
        status="completed",
    )
    db_session.add(pr)
    db_session.commit()

    # Unauthenticated -> 401
    resp_guest = client.get(f"/api/v1/pull-requests/{pr.id}")
    assert resp_guest.status_code == 401

    # Member -> 200
    _, charlie_token = create_user_session(db_session, user)
    resp_user = client.get(f"/api/v1/pull-requests/{pr.id}", headers={"Authorization": f"Bearer {charlie_token}"})
    assert resp_user.status_code == 200
    assert resp_user.json()["pr_number"] == 42


# =========================================================================
# 4. Background Worker Crash Recovery & Stale Lease Reclaim
# =========================================================================

def test_worker_stale_job_recovery(db_session):
    """Stale jobs running past lease timeout are recovered back to queued or marked failed."""
    # Stale job within retry limits (started 15 minutes ago)
    stale_running_job = AnalysisJob(
        id="stale-job-1",
        job_type="pr_autopsy",
        status="running",
        retry_count=0,
        max_retries=3,
        repo_owner="test",
        repo_name="repo",
        pr_number=1,
        started_at=datetime.utcnow() - timedelta(minutes=15),
    )
    # Stale job that has already exhausted retries (retry_count == 2, max_retries == 3)
    exhausted_job = AnalysisJob(
        id="stale-job-exhausted",
        job_type="pr_autopsy",
        status="running",
        retry_count=2,
        max_retries=3,
        repo_owner="test",
        repo_name="repo",
        pr_number=2,
        started_at=datetime.utcnow() - timedelta(minutes=20),
    )
    # Fresh running job (started 2 minutes ago)
    fresh_job = AnalysisJob(
        id="fresh-job",
        job_type="pr_autopsy",
        status="running",
        retry_count=0,
        max_retries=3,
        repo_owner="test",
        repo_name="repo",
        pr_number=3,
        started_at=datetime.utcnow() - timedelta(minutes=2),
    )
    db_session.add_all([stale_running_job, exhausted_job, fresh_job])
    db_session.commit()

    # Run recovery with 10-minute lease cutoff
    recovered_count = recover_stale_jobs(db_session, lease_timeout_minutes=10)
    assert recovered_count == 2

    # Check stale_running_job status -> re-queued
    db_session.refresh(stale_running_job)
    assert stale_running_job.status == "queued"
    assert stale_running_job.retry_count == 1
    assert "lease expired" in stale_running_job.error_message

    # Check exhausted_job status -> failed
    db_session.refresh(exhausted_job)
    assert exhausted_job.status == "failed"
    assert exhausted_job.retry_count == 3
    assert "exceeded max retries" in exhausted_job.error_message

    # Check fresh_job -> untouched (remains running)
    db_session.refresh(fresh_job)
    assert fresh_job.status == "running"


# =========================================================================
# 5. GitHub App Token Service & Caching Tests
# =========================================================================

def test_github_app_jwt_generation():
    """GitHub App JWT generation produces signed token with RSA key."""
    # Test fallback dummy key generates valid JWT
    token = generate_github_app_jwt()
    assert token is not None
    assert len(token.split(".")) == 3  # Header.Payload.Signature


def test_github_app_token_caching(monkeypatch):
    """Installation token caching prevents redundant API exchange calls."""
    import asyncio
    _INSTALLATION_TOKEN_CACHE.clear()
    install_id = "99999"

    token1 = asyncio.run(get_installation_access_token(install_id))
    assert token1.startswith("ghs_simulated_inst_")

    # Second call must hit cache
    token2 = asyncio.run(get_installation_access_token(install_id))
    assert token1 == token2
    assert install_id in _INSTALLATION_TOKEN_CACHE


def test_pr_autopsy_coverage_transparency(client, db_session):
    """PR Autopsy output includes transparent coverage labels."""
    pr = PullRequestAnalysis(
        id=str(uuid.uuid4()),
        repo_owner="test",
        repo_name="transparency-repo",
        pr_number=1,
        pr_title="Transparent test",
        base_branch="main",
        head_branch="patch",
        base_sha="aaa",
        head_sha="bbb",
        status="completed",
        summary={"analysis_coverage": "Changed-File with Dependency Graph Analysis"},
    )
    db_session.add(pr)
    db_session.commit()

    resp = client.get(f"/api/v1/pull-requests/{pr.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["analysis_coverage"] == "Changed-File with Dependency Graph Analysis"
    assert data["summary"]["analysis_coverage"] == "Changed-File with Dependency Graph Analysis"
