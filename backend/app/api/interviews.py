import secrets
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.interview import InterviewSession, InterviewTurn, TeamSession, TeamMember
from app.schemas.interview import (
    StartInterviewRequest,
    StartAssessmentRequest,
    AnswerRequest,
    BatchSubmitRequest,
    InterviewOut,
    InterviewCreationOut,
    TurnOut,
    PracticeRetryRequest,
    RetakeAssessmentRequest,
    ShareableReportOut,
    CreateTeamSessionRequest,
    JoinTeamRequest,
    JoinTeamResponse,
)
from app.services.interview_service import start_interview, answer_current, submit_batch_answers
from app.services.codevitals_service import (
    get_assessable_components,
    build_repository_knowledge_model,
    start_practice_session,
    retry_practice_turn,
    create_retake_session,
    generate_shareable_report,
    create_team_session,
    start_member_assessment,
    aggregate_team_dashboard,
)
from app.core.rate_limit import check_rate_limit

router = APIRouter(prefix="/interviews", tags=["interviews"])


# -------------------------------------------------------------
# 1. COMPONENT DISCOVERY & METADATA
# -------------------------------------------------------------
@router.get("/analysis/{analysis_id}/components")
def get_components(analysis_id: str, request: Request, db: Session = Depends(get_db)):
    """
    Returns dynamically discovered assessable components for this repository analysis.
    """
    check_rate_limit(request, "get_components", max_requests=60, window_seconds=60)
    analysis = db.get(Analysis, analysis_id)
    if not analysis or analysis.status != "completed":
        raise HTTPException(status_code=409, detail="Analysis must be completed first.")
    return get_assessable_components(analysis)


@router.get("/analysis/{analysis_id}/knowledge-model")
def get_knowledge_model(analysis_id: str, request: Request, db: Session = Depends(get_db)):
    """
    Returns the complete structured repository knowledge model:
    Components, nested subcomponents, verified symbols, dependency edges, and confidence ratings.
    """
    check_rate_limit(request, "get_knowledge_model", max_requests=60, window_seconds=60)
    analysis = db.get(Analysis, analysis_id)
    if not analysis or analysis.status != "completed":
        raise HTTPException(status_code=409, detail="Analysis must be completed first.")
    return build_repository_knowledge_model(analysis)


# -------------------------------------------------------------
# 2. INDIVIDUAL ASSESSMENTS (COMPLETE & COMPONENT)
# -------------------------------------------------------------
@router.post("/analysis/{analysis_id}", response_model=InterviewCreationOut)
def create_interview(
    analysis_id: str,
    payload: StartAssessmentRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Starts an individual assessment (Complete Codebase or Component Assessment).
    SEC-02: Returns InterviewCreationOut containing the single-use session_token.
    Subsequent GET endpoints return InterviewOut which never includes session_token.
    """
    check_rate_limit(request, "start_assessment", max_requests=25, window_seconds=60)
    analysis = db.get(Analysis, analysis_id)
    if not analysis or analysis.status != "completed":
        raise HTTPException(status_code=409, detail="Analysis must be completed before starting an assessment.")

    return start_interview(
        db=db,
        analysis=analysis,
        count=payload.question_count,
        assessment_type=payload.assessment_type,
        scope_type=payload.scope_type,
        selected_components=payload.selected_components,
        difficulty=payload.difficulty,
        hackathon_mode=payload.hackathon_mode,
        hackathon_context=payload.hackathon_context,
        participant_name=payload.participant_name,
        mode=payload.mode,
        parent_session_id=payload.parent_session_id,
    )


@router.get("/analysis/{analysis_id}/history")
def get_assessment_history(analysis_id: str, request: Request, db: Session = Depends(get_db)):
    """
    Returns previous assessment sessions for this repository.
    Never exposes session_tokens or individual rubrics.
    """
    check_rate_limit(request, "get_history", max_requests=60, window_seconds=60)
    stmt = (
        select(InterviewSession)
        .where(InterviewSession.analysis_id == analysis_id)
        .order_by(desc(InterviewSession.created_at))
        .limit(20)
    )
    sessions = db.execute(stmt).scalars().all()
    return [
        {
            "id": s.id,
            "status": s.status,
            "score": s.score,
            "assessment_type": s.assessment_type,
            "scope_type": s.scope_type,
            "selected_components": s.selected_components,
            "difficulty": s.difficulty,
            "question_count": s.question_count,
            "created_at": s.created_at.isoformat(),
            "category_scores": s.category_scores,
        }
        for s in sessions
    ]


@router.get("/{session_id}", response_model=InterviewOut)
def get_interview(
    session_id: str,
    request: Request,
    session_token: str | None = Query(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    """
    Retrieves an assessment session and its turns.
    SEC-01: Unanswered turns mask explanation & rubrics to prevent cheating.
    SEC-02: Returns InterviewOut which NEVER exposes session_token.
    Active assessments require the valid participant session_token to read.
    """
    check_rate_limit(request, "get_session", max_requests=120, window_seconds=60)
    stmt = (
        select(InterviewSession)
        .options(joinedload(InterviewSession.turns))
        .where(InterviewSession.id == session_id)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")

    token = x_session_token or session_token

    # Active assessments require possession of the session_token to prevent eavesdropping
    if session.status == "active" and session.session_token:
        if not token or not secrets.compare_digest(token, session.session_token):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active assessment requires a valid participant session token.",
            )

    return session


@router.post("/{session_id}/answer", response_model=InterviewOut)
def answer_interview(
    session_id: str,
    payload: AnswerRequest,
    request: Request,
    session_token: str | None = Query(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    """
    Submits an answer for the active assessment turn.
    SEC-02: Enforces valid session_token. Rejects untokened or legacy session submissions.
    Returns InterviewOut (never leaks session_token).
    """
    check_rate_limit(request, "submit_answer", max_requests=60, window_seconds=60)
    stmt = (
        select(InterviewSession)
        .options(joinedload(InterviewSession.turns), joinedload(InterviewSession.analysis))
        .where(InterviewSession.id == session_id)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")

    token = x_session_token or session_token
    if session.session_token:
        if not token or not secrets.compare_digest(token, session.session_token):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing or invalid participant session token.",
            )
    else:
        # Legacy sessions created before authentication cannot be modified
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This assessment belongs to an unauthenticated legacy session and cannot be modified.",
        )

    try:
        answer_current(
            db=db,
            session=session,
            answer=payload.answer,
            selected_option=payload.selected_option,
            question_index=payload.question_index,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    db.refresh(session)
    return session


@router.post("/{session_id}/submit", response_model=InterviewOut)
def submit_all_answers(
    session_id: str,
    payload: BatchSubmitRequest,
    request: Request,
    session_token: str | None = Query(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    """
    Atomically evaluates all questions in a single database transaction (REL-02).
    SEC-02: Enforces valid session_token. Rejects unauthorized attempts.
    Returns InterviewOut (never leaks session_token).
    """
    check_rate_limit(request, "batch_submit", max_requests=30, window_seconds=60)
    stmt = (
        select(InterviewSession)
        .options(joinedload(InterviewSession.turns), joinedload(InterviewSession.analysis))
        .where(InterviewSession.id == session_id)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")

    token = x_session_token or session_token
    if session.session_token:
        if not token or not secrets.compare_digest(token, session.session_token):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing or invalid participant session token.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This assessment belongs to an unauthenticated legacy session and cannot be modified.",
        )

    answers_dicts = [a.model_dump() for a in payload.answers]
    try:
        session = submit_batch_answers(db, session, answers_dicts)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return session


# -------------------------------------------------------------
# 3. PRACTICE MODE, RETAKES & REPORT EXPORTS (SPRINT 2)
# -------------------------------------------------------------
@router.get("/{session_id}/report", response_model=ShareableReportOut)
def get_shareable_report(
    session_id: str,
    request: Request,
    session_token: str | None = Query(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    """
    Returns a clean, privacy-safe export summary for an assessment session.
    SEC-SAFE: Excludes session_token, organizer_token, secret rubrics, and raw credentials.
    """
    check_rate_limit(request, "get_report", max_requests=60, window_seconds=60)
    stmt = (
        select(InterviewSession)
        .options(joinedload(InterviewSession.turns), joinedload(InterviewSession.analysis))
        .where(InterviewSession.id == session_id)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")

    # If active, ensure requester is authorized
    if session.status == "active" and session.session_token:
        token = x_session_token or session_token
        if not token or not secrets.compare_digest(token, session.session_token):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to in-flight assessment report.")

    return generate_shareable_report(session)


@router.post("/{session_id}/practice", response_model=InterviewCreationOut)
def create_practice_from_session(
    session_id: str,
    request: Request,
    session_token: str | None = Query(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    """
    Creates an adaptive Practice Mode session derived from weak topics or questions
    of the specified assessment. Does NOT overwrite the parent assessment history.
    """
    check_rate_limit(request, "start_practice", max_requests=25, window_seconds=60)
    session = db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")

    token = x_session_token or session_token
    if session.session_token and (not token or not secrets.compare_digest(token, session.session_token)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid session token.")

    analysis = session.analysis
    if not analysis:
        raise HTTPException(status_code=400, detail="Associated analysis not found.")

    practice = start_practice_session(
        db=db,
        analysis=analysis,
        from_session_id=session.id,
        target_components=session.selected_components,
        difficulty=session.difficulty,
        question_count=session.question_count,
    )
    return practice


@router.post("/{session_id}/turns/{turn_id}/retry", response_model=TurnOut)
def retry_turn(
    session_id: str,
    turn_id: str,
    payload: PracticeRetryRequest,
    request: Request,
    session_token: str | None = Query(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    """
    Retries an answered turn in Practice Mode. Increments retry count and re-evaluates.
    """
    check_rate_limit(request, "retry_turn", max_requests=60, window_seconds=60)
    session = db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")

    token = x_session_token or session_token
    if session.session_token and (not token or not secrets.compare_digest(token, session.session_token)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid session token.")

    turn = db.get(InterviewTurn, turn_id)
    if not turn or turn.session_id != session.id:
        raise HTTPException(status_code=404, detail="Turn not found in this session.")

    return retry_practice_turn(
        db=db,
        session=session,
        turn=turn,
        selected_option=payload.selected_option,
        answer=payload.answer,
        user_notes=payload.user_notes,
    )


@router.post("/{session_id}/retake", response_model=InterviewCreationOut)
def create_retake(
    session_id: str,
    payload: RetakeAssessmentRequest,
    request: Request,
    session_token: str | None = Query(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    """
    Creates a new official assessment attempt linked to parent_session.
    Prioritizes previously weak categories while preserving original attempt intact.
    """
    check_rate_limit(request, "retake_assessment", max_requests=25, window_seconds=60)
    session = db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")

    token = x_session_token or session_token
    if session.session_token and (not token or not secrets.compare_digest(token, session.session_token)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid session token.")

    retake_sess = create_retake_session(
        db=db,
        parent_session=session,
        difficulty=payload.difficulty,
        question_count=payload.question_count,
        target_weak_areas=payload.target_weak_areas,
        participant_name=payload.participant_name,
    )
    return retake_sess


# -------------------------------------------------------------
# 4. TEAM ASSESSMENTS & HACKATHON READINESS
# -------------------------------------------------------------
@router.post("/team/sessions")
def create_team(
    payload: CreateTeamSessionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Creates a new shared team assessment session with persistent database storage
    and cryptographic organizer & invite tokens.
    """
    check_rate_limit(request, "create_team", max_requests=15, window_seconds=60)
    analysis = db.get(Analysis, payload.analysis_id)
    if not analysis or analysis.status != "completed":
        raise HTTPException(status_code=409, detail="Analysis must be completed first.")

    members_dicts = [m.model_dump() for m in payload.members]
    team_session = create_team_session(
        db=db,
        analysis=analysis,
        team_name=payload.team_name,
        description=payload.description,
        is_hackathon_mode=payload.is_hackathon_mode,
        hackathon_context=payload.hackathon_context,
        members_data=members_dicts,
    )

    return {
        "id": team_session.id,
        "team_name": team_session.team_name,
        "organizer_token": team_session.organizer_token,
        "invite_token": team_session.invite_token,
        "status": team_session.status,
        "is_hackathon_mode": bool(team_session.is_hackathon_mode),
        "invite_url": f"/codevitals/invite/{team_session.invite_token}",
    }


@router.get("/team/sessions/{session_id}")
def get_team_session_dashboard(
    session_id: str,
    request: Request,
    organizer_token: str | None = Query(default=None),
    invite_token: str | None = Query(default=None),
    x_organizer_token: str | None = Header(default=None, alias="X-Organizer-Token"),
    x_invite_token: str | None = Header(default=None, alias="X-Invite-Token"),
    db: Session = Depends(get_db),
):
    """
    Returns team dashboard with 3-tier access control (PHASE 3):
    - Organizer: Full dashboard, organizer_token, invite_token, and all individual scores.
    - Participant (via invite_token): Team progress & coverage matrix, but individual scores are masked.
    - Unauthorized: Rejected with HTTP 403 Forbidden.
    """
    check_rate_limit(request, "team_dashboard", max_requests=60, window_seconds=60)
    stmt = (
        select(TeamSession)
        .options(joinedload(TeamSession.members), joinedload(TeamSession.analysis))
        .where(TeamSession.id == session_id)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Team session not found")

    org_token = x_organizer_token or organizer_token
    inv_token = x_invite_token or invite_token

    is_organizer = bool(org_token and secrets.compare_digest(org_token, session.organizer_token))
    is_invited = bool(inv_token and secrets.compare_digest(inv_token, session.invite_token))

    if not is_organizer and not is_invited:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. A valid organizer token or team invite token is required to view this dashboard.",
        )

    dashboard = aggregate_team_dashboard(session)
    dashboard["is_organizer"] = is_organizer

    if is_organizer:
        dashboard["organizer_token"] = session.organizer_token
        dashboard["invite_token"] = session.invite_token
    else:
        # Participant / Invitee view: Sanitize member private scores
        for m in dashboard.get("members", []):
            m["score"] = None
            m["category_scores"] = None

    return dashboard


@router.post("/team/sessions/{session_id}/revoke-invite")
def revoke_team_invitation(
    session_id: str,
    request: Request,
    organizer_token: str | None = Query(default=None),
    x_organizer_token: str | None = Header(default=None, alias="X-Organizer-Token"),
    db: Session = Depends(get_db),
):
    """
    SEC-03 / PHASE 4: Generates a new cryptographic invite token, revoking prior invite links.
    Accepts organizer token via X-Organizer-Token header or query param.
    """
    check_rate_limit(request, "revoke_invite", max_requests=10, window_seconds=60)
    session = db.get(TeamSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Team session not found")

    org_token = x_organizer_token or organizer_token
    if not org_token or not secrets.compare_digest(org_token, session.organizer_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing organizer token.")

    session.invite_token = secrets.token_urlsafe(16)
    db.commit()
    db.refresh(session)

    return {
        "status": "revoked",
        "new_invite_token": session.invite_token,
        "invite_url": f"/codevitals/invite/{session.invite_token}",
    }


@router.post("/team/sessions/{session_id}/close")
def close_team_session(
    session_id: str,
    request: Request,
    organizer_token: str | None = Query(default=None),
    x_organizer_token: str | None = Header(default=None, alias="X-Organizer-Token"),
    db: Session = Depends(get_db),
):
    """
    Closes the team session, freezing further participation.
    Requires organizer token via X-Organizer-Token header or query.
    """
    check_rate_limit(request, "close_team", max_requests=10, window_seconds=60)
    session = db.get(TeamSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Team session not found")

    org_token = x_organizer_token or organizer_token
    if not org_token or not secrets.compare_digest(org_token, session.organizer_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing organizer token.")

    session.status = "completed"
    db.commit()
    return {"status": "completed", "id": session.id}


@router.get("/team/invite/{invite_token}")
def get_team_invite_info(invite_token: str, request: Request, db: Session = Depends(get_db)):
    """
    Public invite landing endpoint to inspect team session details before joining.
    Rejects inactive or expired invitations. Returns minimal slot information only.
    """
    check_rate_limit(request, "invite_info", max_requests=30, window_seconds=60)
    stmt = (
        select(TeamSession)
        .options(joinedload(TeamSession.members), joinedload(TeamSession.analysis))
        .where(TeamSession.invite_token == invite_token)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired team invitation.")

    if session.status != "active":
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This team assessment invitation is no longer active.")

    return {
        "session_id": session.id,
        "analysis_id": session.analysis_id,
        "team_name": session.team_name,
        "description": session.description,
        "repo_name": f"{session.analysis.owner}/{session.analysis.repo_name}" if session.analysis else "Repository",
        "is_hackathon_mode": bool(session.is_hackathon_mode),
        "available_slots": [
            {
                "id": m.id,
                "display_name": m.display_name,
                "assigned_role": m.assigned_role,
                "assigned_components": m.assigned_components,
                "status": m.status,
            }
            for m in (session.members or [])
            if m.status != "completed"
        ],
    }


@router.post("/team/join/{invite_token}", response_model=JoinTeamResponse)
def join_team_session(
    invite_token: str,
    payload: JoinTeamRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Teammate joins a team session and receives their component-assigned assessment.
    Returns session_token for secure individual submission.
    """
    check_rate_limit(request, "join_team", max_requests=20, window_seconds=60)
    stmt = (
        select(TeamSession)
        .options(joinedload(TeamSession.members), joinedload(TeamSession.analysis))
        .where(TeamSession.invite_token == invite_token)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session or session.status != "active":
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invalid or inactive team session.")

    # Find member slot or create a new slot
    member = None
    if payload.member_id:
        member = next((m for m in session.members if m.id == payload.member_id), None)

    if not member:
        # Check if already joined under this display_name
        member = next((m for m in session.members if m.display_name.lower() == payload.display_name.lower().strip()), None)

    if not member:
        # Create a new member slot with default complete codebase scope
        member = TeamMember(
            team_session_id=session.id,
            display_name=payload.display_name.strip(),
            assigned_role="Team Member",
            assigned_components=["complete"],
            status="invited",
        )
        db.add(member)
        db.flush()

    # Start or resume assessment session for this teammate
    assessment_session = start_member_assessment(db, session, member)

    return {
        "team_session_id": session.id,
        "member_id": member.id,
        "assessment_session_id": assessment_session.id,
        "session_token": assessment_session.session_token,
        "status": member.status,
    }


@router.get("/team/analysis/{analysis_id}/sessions")
def get_team_sessions_for_repo(analysis_id: str, request: Request, db: Session = Depends(get_db)):
    """
    Returns previous team assessment sessions for this repository.
    """
    check_rate_limit(request, "repo_team_sessions", max_requests=60, window_seconds=60)
    stmt = (
        select(TeamSession)
        .options(joinedload(TeamSession.members))
        .where(TeamSession.analysis_id == analysis_id)
        .order_by(desc(TeamSession.created_at))
        .limit(15)
    )
    sessions = db.execute(stmt).unique().scalars().all()
    return [
        {
            "id": s.id,
            "team_name": s.team_name,
            "description": s.description,
            "status": s.status,
            "is_hackathon_mode": bool(s.is_hackathon_mode),
            "created_at": s.created_at.isoformat(),
            "total_members": len(s.members or []),
            "completed_members": sum(1 for m in (s.members or []) if m.status == "completed"),
        }
        for s in sessions
    ]


@router.get("/team/sessions/{session_id}/readiness-report", response_model=ShareableReportOut)
def get_team_readiness_report(
    session_id: str,
    request: Request,
    organizer_token: str | None = Query(default=None),
    invite_token: str | None = Query(default=None),
    x_organizer_token: str | None = Header(default=None, alias="X-Organizer-Token"),
    x_invite_token: str | None = Header(default=None, alias="X-Invite-Token"),
    db: Session = Depends(get_db),
):
    """
    Returns a privacy-safe team readiness report for export.
    Requires authorized team organizer or invite holder credentials.
    SEC-SAFE: Excludes raw organizer/invite tokens and private individual scores.
    """
    check_rate_limit(request, "team_readiness_report", max_requests=30, window_seconds=60)
    stmt = (
        select(TeamSession)
        .options(joinedload(TeamSession.members), joinedload(TeamSession.analysis))
        .where(TeamSession.id == session_id)
    )
    team_session = db.execute(stmt).unique().scalar_one_or_none()
    if not team_session:
        raise HTTPException(status_code=404, detail="Team session not found")

    org_tok = x_organizer_token or organizer_token
    inv_tok = x_invite_token or invite_token

    has_org = org_tok and secrets.compare_digest(org_tok, team_session.organizer_token)
    has_inv = inv_tok and secrets.compare_digest(inv_tok, team_session.invite_token)

    if not (has_org or has_inv):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to team readiness report.")

    dashboard = aggregate_team_dashboard(team_session)
    analysis = team_session.analysis
    repo_name = f"{analysis.owner}/{analysis.repo_name}" if analysis else "Repository"

    return {
        "repository_name": repo_name,
        "assessment_id": team_session.id,
        "assessment_type": "team",
        "scope_type": "complete",
        "selected_components": ["complete"],
        "difficulty": "intermediate",
        "overall_score": dashboard.get("team_average_score"),
        "category_scores": None,
        "total_questions": len(team_session.shared_questions or []) * max(1, len(team_session.members or [])),
        "completed_questions": dashboard.get("completed_members", 0),
        "completion_date": team_session.created_at.isoformat() if team_session.created_at else None,
        "strengths": dashboard.get("team_strengths", []),
        "knowledge_gaps": [{"category": "Team", "title": g, "description": g, "missing_concepts": [], "supporting_files": [], "actionable_recommendation": g, "suggested_review_topics": []} for g in dashboard.get("team_knowledge_gaps", [])],
        "coverage_limitations": "Team assessment synthesized from member submissions and shared architecture questions.",
        "is_team": True,
        "team_name": team_session.team_name,
        "team_coverage_matrix": dashboard.get("coverage_matrix", []),
        "team_readiness_summary": dashboard.get("team_readiness_summary"),
        "hackathon_insights": dashboard.get("hackathon_insights", []),
    }
