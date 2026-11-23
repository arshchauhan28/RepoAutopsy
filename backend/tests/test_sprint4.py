import hashlib
import hmac
import uuid
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import Base, get_db
from app.main import app
from app.models.user import User, UserSession, OAuthState
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceInvitation, ConnectedRepository, AutomationSettings
from app.models.automation import WebhookDelivery, AnalysisJob, Notification, UsageEvent
from app.models.analysis import Analysis
from app.services.auth_service import (
    create_oauth_state,
    validate_and_consume_oauth_state,
    create_user_session,
    get_user_from_session_token,
    revoke_session,
    get_or_create_user,
)
from app.services.webhook_service import verify_github_signature, process_webhook_event
from app.services.worker_service import process_analysis_job
from app.services.entitlement_service import record_usage_event, get_workspace_usage_summary

from sqlalchemy.pool import StaticPool

# In-memory SQLite for test isolation with StaticPool so all connections share tables
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
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
# 1. AUTHENTICATION & SESSION TESTS
# =========================================================================

def test_oauth_state_generation_and_consumption(db_session):
    state_token = create_oauth_state(db_session, redirect_url="/dashboard")
    assert state_token is not None
    assert len(state_token) >= 24

    # Consume once
    consumed = validate_and_consume_oauth_state(db_session, state_token)
    assert consumed is not None
    assert consumed.redirect_url == "/dashboard"

    # Consuming a second time must fail (one-time CSRF defense)
    assert validate_and_consume_oauth_state(db_session, state_token) is None


def test_oauth_state_expiration(db_session):
    state_token = create_oauth_state(db_session)
    # Manually backdate state
    state = db_session.query(OAuthState).filter(OAuthState.id == state_token).first()
    state.expires_at = datetime.utcnow() - timedelta(minutes=5)
    db_session.commit()

    consumed = validate_and_consume_oauth_state(db_session, state_token)
    assert consumed is None


def test_user_session_creation_lookup_and_revocation(db_session):
    gh_profile = {
        "id": "12345",
        "login": "octocat",
        "name": "Mona Lisa Octocat",
        "avatar_url": "https://github.com/images/error/octocat_happy.gif",
        "email": "octocat@github.com",
    }
    user = get_or_create_user(db_session, gh_profile, access_token="mock_token_123")
    assert user.id is not None
    assert user.username == "octocat"

    # Verify automatic personal workspace creation
    personal_ws = db_session.query(Workspace).filter(
        Workspace.owner_id == user.id,
        Workspace.workspace_type == "personal",
    ).first()
    assert personal_ws is not None
    assert "octocat" in personal_ws.name

    # Create session
    session, raw_token = create_user_session(db_session, user)
    assert raw_token is not None
    assert session.is_revoked is False

    # Lookup by raw token
    looked_up_user = get_user_from_session_token(db_session, raw_token)
    assert looked_up_user is not None
    assert looked_up_user.id == user.id

    # Revoke session (logout)
    assert revoke_session(db_session, raw_token) is True
    assert get_user_from_session_token(db_session, raw_token) is None


def test_auth_api_flow(client, db_session):
    # 1. Get login URL
    resp = client.get("/api/v1/auth/login-url")
    assert resp.status_code == 200
    data = resp.json()
    assert "login_url" in data
    assert "state" in data
    state = data["state"]

    # 2. Callback with valid state
    cb_resp = client.post("/api/v1/auth/callback", json={"code": "test_auth_code", "state": state})
    assert cb_resp.status_code == 200
    cb_data = cb_resp.json()
    assert "user" in cb_data
    assert "session_token" in cb_data
    assert "repoautopsy_session" in cb_resp.cookies

    # 3. Check /me with cookie
    me_resp = client.get("/api/v1/auth/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["id"] == cb_data["user"]["id"]

    # 4. Logout
    logout_resp = client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200

    # 5. Subsequent /me is unauthorized
    me_after = client.get("/api/v1/auth/me")
    assert me_after.status_code == 401


# =========================================================================
# 2. WORKSPACE & RBAC TESTS
# =========================================================================

def test_workspace_creation_and_membership(client, db_session):
    # Create user
    user = get_or_create_user(db_session, {"id": "101", "login": "alice", "email": "alice@test.com"})
    _, token = create_user_session(db_session, user)
    headers = {"Authorization": f"Bearer {token}"}

    # Create team workspace
    ws_resp = client.post(
        "/api/v1/workspaces",
        json={"name": "Frontend Guild", "description": "UI architects", "workspace_type": "team"},
        headers=headers,
    )
    assert ws_resp.status_code == 201
    ws_data = ws_resp.json()
    assert ws_data["name"] == "Frontend Guild"
    assert ws_data["current_user_role"] == "owner"
    ws_id = ws_data["id"]

    # List workspaces
    list_resp = client.get("/api/v1/workspaces", headers=headers)
    assert list_resp.status_code == 200
    ws_names = [w["name"] for w in list_resp.json()]
    assert "Frontend Guild" in ws_names


def test_workspace_invitations_and_roles(client, db_session):
    alice = get_or_create_user(db_session, {"id": "1", "login": "alice", "email": "alice@corp.com"})
    bob = get_or_create_user(db_session, {"id": "2", "login": "bob", "email": "bob@corp.com"})
    charlie = get_or_create_user(db_session, {"id": "3", "login": "charlie", "email": "charlie@other.com"})

    _, alice_token = create_user_session(db_session, alice)
    _, bob_token = create_user_session(db_session, bob)
    _, charlie_token = create_user_session(db_session, charlie)

    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    bob_headers = {"Authorization": f"Bearer {bob_token}"}
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    # Alice creates workspace
    ws_res = client.post("/api/v1/workspaces", json={"name": "Security Team", "workspace_type": "team"}, headers=alice_headers)
    ws_id = ws_res.json()["id"]

    # Alice invites Bob
    inv_res = client.post(
        f"/api/v1/workspaces/{ws_id}/invitations",
        json={"role": "member", "target_email": "bob@corp.com", "expires_in_days": 7},
        headers=alice_headers,
    )
    assert inv_res.status_code == 201
    invite_token = inv_res.json()["invite_token"]

    # Charlie attempts to join with Bob's email invitation -> Rejected 403
    fail_join = client.post("/api/v1/workspaces/join", json={"invite_token": invite_token}, headers=charlie_headers)
    assert fail_join.status_code == 403

    # Bob joins -> Success
    join_res = client.post("/api/v1/workspaces/join", json={"invite_token": invite_token}, headers=bob_headers)
    assert join_res.status_code == 200

    # Bob verifies membership
    members_res = client.get(f"/api/v1/workspaces/{ws_id}/members", headers=bob_headers)
    assert members_res.status_code == 200
    member_logins = [m["username"] for m in members_res.json()]
    assert "bob" in member_logins

    # Alice changes Bob's role to admin
    role_res = client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{bob.id}/role",
        json={"role": "admin"},
        headers=alice_headers,
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "admin"


def test_connected_repository_and_automation_settings(client, db_session):
    user = get_or_create_user(db_session, {"id": "1", "login": "alice"})
    _, token = create_user_session(db_session, user)
    headers = {"Authorization": f"Bearer {token}"}

    ws_res = client.post("/api/v1/workspaces", json={"name": "Dev Workspace"}, headers=headers)
    ws_id = ws_res.json()["id"]

    # Connect repository
    repo_res = client.post(
        f"/api/v1/workspaces/{ws_id}/repositories",
        json={"github_url": "https://github.com/my-org/core-service", "default_branch": "main"},
        headers=headers,
    )
    assert repo_res.status_code == 201
    repo_data = repo_res.json()
    assert repo_data["repo_name"] == "core-service"
    repo_id = repo_data["id"]

    # Update automation settings
    auto_res = client.patch(
        f"/api/v1/workspaces/{ws_id}/repositories/{repo_id}/automation",
        json={"is_enabled": True, "analyze_on_pr_opened": True, "notify_on_priority": "high_only"},
        headers=headers,
    )
    assert auto_res.status_code == 200
    assert auto_res.json()["is_enabled"] is True
    assert auto_res.json()["notify_on_priority"] == "high_only"


# =========================================================================
# 3. WEBHOOKS & BACKGROUND JOBS TESTS
# =========================================================================

def test_webhook_signature_and_idempotency(db_session):
    payload = b'{"action": "ping"}'
    secret = "test_webhook_secret_key"

    # Set temporary secret
    from app.core.config import settings
    orig_secret = settings.github_webhook_secret
    settings.github_webhook_secret = secret

    try:
        # Valid signature
        valid_mac = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        assert verify_github_signature(payload, valid_mac) is True

        # Invalid signature
        assert verify_github_signature(payload, "sha256=invalid") is False

        # Webhook idempotency test
        delivery_id = f"guid-{uuid.uuid4()}"
        res1 = process_webhook_event(db_session, delivery_id, "ping", {"action": "ping"})
        assert res1["status"] == "completed"

        # Sending the identical delivery ID again must be safely ignored
        res2 = process_webhook_event(db_session, delivery_id, "ping", {"action": "ping"})
        assert res2["status"] == "duplicate_ignored"

    finally:
        settings.github_webhook_secret = orig_secret


def test_pr_webhook_creates_job_and_worker_processes(db_session):
    user = get_or_create_user(db_session, {"id": "1", "login": "maintainer"})
    ws = Workspace(name="Automation WS", owner_id=user.id)
    db_session.add(ws)
    db_session.flush()

    cr = ConnectedRepository(
        workspace_id=ws.id,
        owner="test-owner",
        repo_name="test-repo",
        github_url="https://github.com/test-owner/test-repo",
    )
    db_session.add(cr)
    db_session.flush()

    auto = AutomationSettings(
        connected_repo_id=cr.id,
        is_enabled=True,
        analyze_on_pr_opened=True,
    )
    db_session.add(auto)
    db_session.commit()

    # Webhook PR opened event
    payload = {
        "action": "opened",
        "repository": {"name": "test-repo", "owner": {"login": "test-owner"}},
        "pull_request": {
            "number": 42,
            "title": "Fix security leak",
            "base": {"ref": "main", "sha": "base_sha_123"},
            "head": {"ref": "patch-1", "sha": "head_sha_456"},
        },
    }

    delivery_id = f"delivery-{uuid.uuid4()}"
    webhook_res = process_webhook_event(db_session, delivery_id, "pull_request", payload)
    assert webhook_res["status"] == "completed"
    assert len(webhook_res["jobs_created"]) == 1

    job_id = webhook_res["jobs_created"][0]
    job = db_session.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    assert job is not None
    assert job.status == "completed"
    assert job.pr_number == 42


# =========================================================================
# 4. NOTIFICATIONS, USAGE & DASHBOARD TESTS
# =========================================================================

def test_notifications_and_dashboard_summary(client, db_session):
    user = get_or_create_user(db_session, {"id": "1", "login": "alice"})
    _, token = create_user_session(db_session, user)
    headers = {"Authorization": f"Bearer {token}"}

    # Add notification
    notif = Notification(
        user_id=user.id,
        title="PR Autopsy Ready",
        message="Pull request #10 analyzed with MEDIUM priority.",
        notification_type="pr_autopsy_completed",
        is_read=False,
    )
    db_session.add(notif)

    # Record usage event
    record_usage_event(
        db_session,
        event_type="repo_analysis",
        user_id=user.id,
        quantity=1,
    )
    db_session.commit()

    # 1. Unread notifications count
    unread_res = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert unread_res.status_code == 200
    assert unread_res.json()["unread_count"] >= 1

    # 2. Mark notification read
    mark_res = client.patch(f"/api/v1/notifications/{notif.id}/read", headers=headers)
    assert mark_res.status_code == 200
    assert mark_res.json()["is_read"] is True

    # 3. Dashboard summary endpoint
    dash_res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "metrics" in dash_data
    assert "workspaces" in dash_data
    assert "usage" in dash_data
    assert dash_data["usage"]["total_repo_analyses"] >= 1
