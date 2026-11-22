import time
import pytest
from datetime import datetime
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db
from app.db.init_db import init_db
from app.models.analysis import Analysis
from app.models.interview import InterviewSession, InterviewTurn, TeamSession, TeamMember
from app.services.interview_service import start_interview, answer_current, submit_batch_answers
from app.services.codevitals_service import create_team_session, start_member_assessment
from app.services.github_service import parse_github_url, GitHubError
from app.core.rate_limit import check_rate_limit, get_client_ip, _hit_store, _store_lock


# In-memory SQLite test database fixture
@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def mock_analysis(test_db):
    analysis = Analysis(
        id="test-sec-analysis-1",
        github_url="https://github.com/testowner/testrepo",
        owner="testowner",
        repo_name="testrepo",
        status="completed",
        metrics={"total_files": 10, "code_lines": 500, "languages": {"Python": 500}},
        architecture={
            "components": [
                {
                    "id": "comp-backend",
                    "name": "Backend API",
                    "layer": "backend",
                    "role": "API endpoints and routing",
                    "file_count": 5,
                    "total_lines": 300,
                    "technologies": ["FastAPI", "Python"],
                    "sample_files": ["app/main.py", "app/api/interviews.py"],
                },
                {
                    "id": "comp-frontend",
                    "name": "Frontend Web",
                    "layer": "frontend",
                    "role": "User interface components",
                    "file_count": 5,
                    "total_lines": 200,
                    "technologies": ["Next.js", "React"],
                    "sample_files": ["app/page.tsx"],
                },
            ],
            "dependency_graph": {
                "nodes": [{"id": "app/main.py", "label": "main", "type": "internal"}],
                "edges": [],
                "circular_dependencies": [],
                "external_packages": [{"package": "fastapi", "usage_count": 3}],
            },
        },
    )
    test_db.add(analysis)
    test_db.commit()
    test_db.refresh(analysis)
    return analysis


# ==============================================================================
# SECTION A: ASSESSMENT SESSION TOKEN SECURITY & PRIVACY (Tests 1-10)
# ==============================================================================

def test_01_create_assessment_returns_session_token(client, mock_analysis):
    """
    Test 1: Assessment creation returns valid participant session_token.
    """
    res = client.post(
        f"/api/v1/interviews/analysis/{mock_analysis.id}",
        json={"question_count": 5, "assessment_type": "complete", "scope_type": "complete"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "session_token" in data
    assert data["session_token"] is not None
    assert len(data["session_token"]) >= 32


def test_02_generic_get_does_not_reveal_session_token(client, test_db, mock_analysis):
    """
    Test 2: GET /interviews/{id} NEVER returns session_token.
    """
    session = start_interview(test_db, mock_analysis, count=3)
    res = client.get(
        f"/api/v1/interviews/{session.id}",
        headers={"X-Session-Token": session.session_token},
    )
    assert res.status_code == 200
    data = res.json()
    assert "session_token" not in data


def test_03_active_assessment_get_without_token_rejected(client, test_db, mock_analysis):
    """
    Test 3: Active assessment GET without valid session_token returns 403.
    """
    session = start_interview(test_db, mock_analysis, count=3)
    # Attempting to query someone else's active assessment without token
    res = client.get(f"/api/v1/interviews/{session.id}")
    assert res.status_code == 403
    assert "Active assessment requires a valid participant session token" in res.json()["detail"]


def test_04_submission_without_credential_rejected(client, test_db, mock_analysis):
    """
    Test 4: Submitting an answer without session_token returns 403 Forbidden.
    """
    session = start_interview(test_db, mock_analysis, count=3)
    res = client.post(
        f"/api/v1/interviews/{session.id}/answer",
        json={"selected_option": 0, "question_index": 0},
    )
    assert res.status_code == 403
    assert "Missing or invalid participant session token" in res.json()["detail"]


def test_05_submission_with_invalid_credential_rejected(client, test_db, mock_analysis):
    """
    Test 5: Submitting with an invalid session_token returns 403 Forbidden.
    """
    session = start_interview(test_db, mock_analysis, count=3)
    res = client.post(
        f"/api/v1/interviews/{session.id}/answer",
        headers={"X-Session-Token": "completely_fake_token"},
        json={"selected_option": 0, "question_index": 0},
    )
    assert res.status_code == 403
    assert "Missing or invalid participant session token" in res.json()["detail"]


def test_06_submission_with_another_participant_credential_rejected(client, test_db, mock_analysis):
    """
    Test 6: Using participant A's token on participant B's session returns 403.
    """
    session_a = start_interview(test_db, mock_analysis, count=3)
    session_b = start_interview(test_db, mock_analysis, count=3)

    res = client.post(
        f"/api/v1/interviews/{session_b.id}/answer",
        headers={"X-Session-Token": session_a.session_token},
        json={"selected_option": 0, "question_index": 0},
    )
    assert res.status_code == 403


def test_07_authorized_submission_succeeds(client, test_db, mock_analysis):
    """
    Test 7: Submitting with valid participant session_token succeeds (200 OK).
    """
    session = start_interview(test_db, mock_analysis, count=3)
    res = client.post(
        f"/api/v1/interviews/{session.id}/answer",
        headers={"X-Session-Token": session.session_token},
        json={"selected_option": 0, "question_index": 0},
    )
    assert res.status_code == 200
    assert res.json()["turns"][0]["earned_score"] is not None


def test_08_duplicate_submission_protection(test_db, mock_analysis):
    """
    Test 8: Re-answering an already graded turn is rejected (tamper protection).
    """
    session = start_interview(test_db, mock_analysis, count=3)
    answer_current(test_db, session, selected_option=0, question_index=0)

    with pytest.raises(ValueError, match="already been submitted and evaluated"):
        answer_current(test_db, session, selected_option=1, question_index=0)


def test_09_legacy_null_token_records_cannot_be_modified(client, test_db, mock_analysis):
    """
    Test 9: Historical assessment records with null session_token cannot be modified anonymously.
    """
    legacy_session = InterviewSession(
        analysis_id=mock_analysis.id,
        status="active",
        current_index=0,
        session_token=None,  # Legacy record
    )
    test_db.add(legacy_session)
    test_db.flush()
    test_db.add(InterviewTurn(session_id=legacy_session.id, question_index=0, question="Legacy Q"))
    test_db.commit()

    res = client.post(
        f"/api/v1/interviews/{legacy_session.id}/answer",
        json={"selected_option": 0, "question_index": 0},
    )
    assert res.status_code == 403
    assert "legacy session" in res.json()["detail"].lower()


def test_10_hidden_rubrics_and_explanations_masked_before_submission(client, test_db, mock_analysis):
    """
    Test 10: Unanswered turns mask explanation, evaluation, rubrics, and correct options.
    """
    session = start_interview(test_db, mock_analysis, count=3)
    res = client.get(
        f"/api/v1/interviews/{session.id}",
        headers={"X-Session-Token": session.session_token},
    )
    assert res.status_code == 200
    for turn in res.json()["turns"]:
        assert turn["explanation"] is None
        assert turn["evaluation"] is None
        assert "rubric" not in turn
        assert "correct_option" not in turn


# ==============================================================================
# SECTION B: TEAM PERMISSIONS & INVITATION PRIVILEGES (Tests 11-22)
# ==============================================================================

def test_11_create_team_as_organizer(client, mock_analysis):
    """
    Test 11: Organizer creates team session and receives organizer_token and invite_token.
    """
    res = client.post(
        "/api/v1/interviews/team/sessions",
        json={
            "analysis_id": mock_analysis.id,
            "team_name": "Phoenix Hackers",
            "members": [{"display_name": "Bob", "assigned_components": ["comp-backend"]}],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "organizer_token" in data
    assert "invite_token" in data
    assert "invite_url" in data


def test_12_generate_invitation_url(client, mock_analysis):
    """
    Test 12: Team creation generates proper shareable invite URL.
    """
    res = client.post(
        "/api/v1/interviews/team/sessions",
        json={"analysis_id": mock_analysis.id, "team_name": "Delta Squad"},
    )
    assert res.status_code == 200
    invite_url = res.json()["invite_url"]
    assert "/codevitals/invite/" in invite_url


def test_13_access_invitation_details_without_joining(client, test_db, mock_analysis):
    """
    Test 13: Invitation holder inspects available slots without joining.
    """
    team = create_team_session(
        test_db,
        mock_analysis,
        "Alpha Team",
        members_data=[{"display_name": "Charlie", "assigned_role": "Backend Lead"}],
    )
    res = client.get(f"/api/v1/interviews/team/invite/{team.invite_token}")
    assert res.status_code == 200
    data = res.json()
    assert data["team_name"] == "Alpha Team"
    assert len(data["available_slots"]) == 1
    assert data["available_slots"][0]["display_name"] == "Charlie"


def test_14_invitation_holder_receives_minimal_info(client, test_db, mock_analysis):
    """
    Test 14: Public invite endpoint does NOT leak organizer token or private scores.
    """
    team = create_team_session(test_db, mock_analysis, "Beta Team")
    res = client.get(f"/api/v1/interviews/team/invite/{team.invite_token}")
    assert res.status_code == 200
    data = res.json()
    assert "organizer_token" not in data
    assert "shared_questions" not in data


def test_15_join_as_participant_returns_session_token(client, test_db, mock_analysis):
    """
    Test 15: Joining team issues participant session_token.
    """
    team = create_team_session(
        test_db,
        mock_analysis,
        "Gamma Team",
        members_data=[{"display_name": "Dave"}],
    )
    slot_id = team.members[0].id
    res = client.post(
        f"/api/v1/interviews/team/join/{team.invite_token}",
        json={"display_name": "Dave", "member_id": slot_id},
    )
    assert res.status_code == 200
    data = res.json()
    assert "session_token" in data
    assert data["session_token"] is not None


def test_16_participant_cannot_access_organizer_actions(client, test_db, mock_analysis):
    """
    Test 16: Non-organizer cannot revoke invite token or close session.
    """
    team = create_team_session(test_db, mock_analysis, "Zeta Team")
    # Attempt revoke without organizer token
    rev_res = client.post(f"/api/v1/interviews/team/sessions/{team.id}/revoke-invite")
    assert rev_res.status_code == 403

    # Attempt close without organizer token
    close_res = client.post(f"/api/v1/interviews/team/sessions/{team.id}/close")
    assert close_res.status_code == 403


def test_17_participant_cannot_modify_assignments(client, test_db, mock_analysis):
    """
    Test 17: Public invite join cannot modify pre-assigned component scope.
    """
    team = create_team_session(
        test_db,
        mock_analysis,
        "Scoped Team",
        members_data=[{"display_name": "Eve", "assigned_components": ["comp-backend"]}],
    )
    member = team.members[0]
    res = client.post(
        f"/api/v1/interviews/team/join/{team.invite_token}",
        json={"display_name": "Eve", "member_id": member.id},
    )
    assert res.status_code == 200
    sess_id = res.json()["assessment_session_id"]
    sess_row = test_db.get(InterviewSession, sess_id)
    assert sess_row.selected_components == ["comp-backend"]


def test_18_participant_view_masks_individual_member_scores(client, test_db, mock_analysis):
    """
    Test 18: Viewing dashboard via invite_token masks teammates' private scores.
    """
    team = create_team_session(
        test_db,
        mock_analysis,
        "Privacy Team",
        members_data=[{"display_name": "Frank"}],
    )
    member = team.members[0]
    member.status = "completed"
    member.score = 92
    member.category_scores = {"backend": 95}
    test_db.commit()

    # Participant accesses via invite_token
    res = client.get(
        f"/api/v1/interviews/team/sessions/{team.id}",
        headers={"X-Invite-Token": team.invite_token},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_organizer"] is False
    # Frank's score must be sanitized to None for other members
    frank_summary = next(m for m in data["members"] if m["display_name"] == "Frank")
    assert frank_summary["score"] is None
    assert frank_summary["category_scores"] is None


def test_19_participant_cannot_submit_another_members_answers(client, test_db, mock_analysis):
    """
    Test 19: Participant A cannot submit answers to Participant B's assessment.
    """
    team = create_team_session(
        test_db,
        mock_analysis,
        "Multi Team",
        members_data=[{"display_name": "Member1"}, {"display_name": "Member2"}],
    )
    sess1 = start_member_assessment(test_db, team, team.members[0])
    sess2 = start_member_assessment(test_db, team, team.members[1])

    # Member 1 attempts to submit using Member 1's token on Member 2's session
    res = client.post(
        f"/api/v1/interviews/{sess2.id}/answer",
        headers={"X-Session-Token": sess1.session_token},
        json={"selected_option": 0, "question_index": 0},
    )
    assert res.status_code == 403


def test_20_invitation_revocation_lifecycle(client, test_db, mock_analysis):
    """
    Test 20: Organizer revokes invite; old invite is 404, new invite works.
    """
    team = create_team_session(test_db, mock_analysis, "Revoke Team")
    old_token = team.invite_token

    rev_res = client.post(
        f"/api/v1/interviews/team/sessions/{team.id}/revoke-invite",
        headers={"X-Organizer-Token": team.organizer_token},
    )
    assert rev_res.status_code == 200
    new_token = rev_res.json()["new_invite_token"]
    assert new_token != old_token

    # Old token fails
    assert client.get(f"/api/v1/interviews/team/invite/{old_token}").status_code == 404
    # New token succeeds
    assert client.get(f"/api/v1/interviews/team/invite/{new_token}").status_code == 200


def test_21_expired_or_closed_session_rejection(client, test_db, mock_analysis):
    """
    Test 21: Closed team session rejects new join attempts with HTTP 410 Gone.
    """
    team = create_team_session(test_db, mock_analysis, "Closed Team")
    client.post(
        f"/api/v1/interviews/team/sessions/{team.id}/close",
        headers={"X-Organizer-Token": team.organizer_token},
    )

    # Joining closed team returns 410 Gone
    res = client.post(
        f"/api/v1/interviews/team/join/{team.invite_token}",
        json={"display_name": "Late Teammate"},
    )
    assert res.status_code == 410


def test_22_cross_team_access_rejection(client, test_db, mock_analysis):
    """
    Test 22: Invite token from Team 1 cannot view dashboard for Team 2.
    """
    team1 = create_team_session(test_db, mock_analysis, "Team 1")
    team2 = create_team_session(test_db, mock_analysis, "Team 2")

    res = client.get(
        f"/api/v1/interviews/team/sessions/{team2.id}",
        headers={"X-Invite-Token": team1.invite_token},
    )
    assert res.status_code == 403


# ==============================================================================
# SECTION C: ORGANIZER PRIVILEGES & CREDENTIAL CONFIDENTIALITY (Tests 23-27)
# ==============================================================================

def test_23_organizer_credentials_never_exposed_to_invitees(client, test_db, mock_analysis):
    """
    Test 23: Dashboard with invite_token does NOT include organizer_token.
    """
    team = create_team_session(test_db, mock_analysis, "Secret Org Team")
    res = client.get(
        f"/api/v1/interviews/team/sessions/{team.id}",
        headers={"X-Invite-Token": team.invite_token},
    )
    assert res.status_code == 200
    assert "organizer_token" not in res.json()


def test_24_unauthorized_invitation_revocation_fails(client, test_db, mock_analysis):
    """
    Test 24: Revoking invite with invalid organizer token returns 403.
    """
    team = create_team_session(test_db, mock_analysis, "Revoke Fail Team")
    res = client.post(
        f"/api/v1/interviews/team/sessions/{team.id}/revoke-invite",
        headers={"X-Organizer-Token": "bad_token"},
    )
    assert res.status_code == 403


def test_25_unauthorized_session_closure_fails(client, test_db, mock_analysis):
    """
    Test 25: Closing session with invalid organizer token returns 403.
    """
    team = create_team_session(test_db, mock_analysis, "Close Fail Team")
    res = client.post(
        f"/api/v1/interviews/team/sessions/{team.id}/close",
        headers={"X-Organizer-Token": "bad_token"},
    )
    assert res.status_code == 403


def test_26_organizer_dashboard_access_works(client, test_db, mock_analysis):
    """
    Test 26: Organizer accesses dashboard and views all member scores and tokens.
    """
    team = create_team_session(
        test_db,
        mock_analysis,
        "Full Org Team",
        members_data=[{"display_name": "Grace"}],
    )
    member = team.members[0]
    member.status = "completed"
    member.score = 88
    test_db.commit()

    res = client.get(
        f"/api/v1/interviews/team/sessions/{team.id}",
        headers={"X-Organizer-Token": team.organizer_token},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_organizer"] is True
    assert data["organizer_token"] == team.organizer_token
    grace_summary = next(m for m in data["members"] if m["display_name"] == "Grace")
    assert grace_summary["score"] == 88


def test_27_participant_credentials_do_not_grant_organizer_permissions(client, test_db, mock_analysis):
    """
    Test 27: Passing participant session_token to organizer routes returns 403.
    """
    team = create_team_session(test_db, mock_analysis, "Token Escalation Team")
    member_sess = start_member_assessment(test_db, team, team.members[0])

    res = client.post(
        f"/api/v1/interviews/team/sessions/{team.id}/close",
        headers={"X-Organizer-Token": member_sess.session_token},
    )
    assert res.status_code == 403


# ==============================================================================
# SECTION D: DATABASE SAFETY & MIGRATION COMPATIBILITY (Tests 28-31)
# ==============================================================================

def test_28_existing_records_remain_compatible(client, test_db, mock_analysis):
    """
    Test 28: Existing completed assessment with null session_token reads cleanly.
    """
    completed_legacy = InterviewSession(
        analysis_id=mock_analysis.id,
        status="completed",
        score=85,
        session_token=None,
    )
    test_db.add(completed_legacy)
    test_db.commit()

    res = client.get(f"/api/v1/interviews/{completed_legacy.id}")
    assert res.status_code == 200
    assert res.json()["score"] == 85
    assert "session_token" not in res.json()


def test_29_migrations_are_repeatable():
    """
    Test 29: Running init_db() repeatedly is idempotent and does not crash.
    """
    # Calling init_db multiple times simulates multi-worker startup
    init_db()
    init_db()
    assert True


def test_30_null_tokens_do_not_bypass_authorization(client, test_db, mock_analysis):
    """
    Test 30: Null session_token records cannot be modified via batch submit.
    """
    legacy = InterviewSession(
        analysis_id=mock_analysis.id,
        status="active",
        session_token=None,
    )
    test_db.add(legacy)
    test_db.commit()

    res = client.post(
        f"/api/v1/interviews/{legacy.id}/submit",
        json={"answers": [{"question_index": 0, "selected_option": 0}]},
    )
    assert res.status_code == 403


def test_31_database_transaction_consistency_on_failure(test_db, mock_analysis):
    """
    Test 31: If an error occurs during assessment answering, database state rolls back cleanly.
    """
    session = start_interview(test_db, mock_analysis, count=3)
    turn = session.turns[0]

    with pytest.raises(ValueError):
        # Invalid turn index triggers rollback
        answer_current(test_db, session, question_index=999)

    test_db.refresh(session)
    assert session.status == "active"
    assert turn.earned_score is None


# ==============================================================================
# SECTION E: RATE LIMITING & SPOOFING PREVENTION (Tests 32-35)
# ==============================================================================

class DummyClient:
    def __init__(self, host):
        self.host = host

class DummyRequest:
    def __init__(self, host, headers=None):
        self.client = DummyClient(host)
        self.headers = headers or {}


def test_32_rate_limit_enforced_on_rapid_requests():
    """
    Test 32: Rate limit threshold raises HTTP 429 when exceeded.
    """
    req = DummyRequest("198.51.100.5")
    # Reset store for test
    with _store_lock:
        _hit_store.clear()

    # 3 allowed hits
    for _ in range(3):
        check_rate_limit(req, "test_scope", max_requests=3, window_seconds=60)

    # 4th hit should be blocked
    with pytest.raises(HTTPException) as exc_info:
        check_rate_limit(req, "test_scope", max_requests=3, window_seconds=60)

    assert exc_info.value.status_code == 429


def test_33_rate_limit_returns_429():
    """
    Test 33: Rate limit returns HTTP 429 status code.
    """
    req = DummyRequest("198.51.100.6")
    with _store_lock:
        _hit_store.clear()

    check_rate_limit(req, "single_hit", max_requests=1, window_seconds=60)
    with pytest.raises(HTTPException) as exc_info:
        check_rate_limit(req, "single_hit", max_requests=1, window_seconds=60)
    assert exc_info.value.status_code == 429


def test_34_rate_limit_retry_after_header():
    """
    Test 34: 429 response contains Retry-After header.
    """
    req = DummyRequest("198.51.100.7")
    with _store_lock:
        _hit_store.clear()

    check_rate_limit(req, "header_check", max_requests=1, window_seconds=60)
    with pytest.raises(HTTPException) as exc_info:
        check_rate_limit(req, "header_check", max_requests=1, window_seconds=60)

    assert "Retry-After" in exc_info.value.headers
    assert int(exc_info.value.headers["Retry-After"]) >= 1


def test_35_spoofed_forwarded_headers_cannot_bypass_rate_limit():
    """
    Test 35: Untrusted external client cannot bypass rate limits by spoofing X-Forwarded-For.
    """
    with _store_lock:
        _hit_store.clear()

    # Client connecting from untrusted external IP 203.0.113.195
    # Sending fake forwarded headers to pretend to be different IPs
    req1 = DummyRequest("203.0.113.195", {"X-Forwarded-For": "1.1.1.1"})
    req2 = DummyRequest("203.0.113.195", {"X-Forwarded-For": "2.2.2.2"})

    # Both requests must be attributed to 203.0.113.195 (direct peer)
    assert get_client_ip(req1) == "203.0.113.195"
    assert get_client_ip(req2) == "203.0.113.195"

    check_rate_limit(req1, "spoof_scope", max_requests=1, window_seconds=60)
    # req2 with fake header must still be blocked under direct IP 203.0.113.195!
    with pytest.raises(HTTPException) as exc_info:
        check_rate_limit(req2, "spoof_scope", max_requests=1, window_seconds=60)
    assert exc_info.value.status_code == 429
