from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.interview import InterviewSession, InterviewTurn, TeamSession, TeamMember
from app.schemas.interview import (
    StartInterviewRequest,
    StartAssessmentRequest,
    AnswerRequest,
    InterviewOut,
    CreateTeamSessionRequest,
    JoinTeamRequest,
)
from app.services.interview_service import start_interview, answer_current
from app.services.codevitals_service import (
    get_assessable_components,
    create_team_session,
    start_member_assessment,
    aggregate_team_dashboard,
)

router = APIRouter(prefix="/interviews", tags=["interviews"])


# -------------------------------------------------------------
# 1. COMPONENT DISCOVERY & METADATA
# -------------------------------------------------------------
@router.get("/analysis/{analysis_id}/components")
def get_components(analysis_id: str, db: Session = Depends(get_db)):
    """
    Returns dynamically discovered assessable components for this repository analysis.
    """
    analysis = db.get(Analysis, analysis_id)
    if not analysis or analysis.status != "completed":
        raise HTTPException(status_code=409, detail="Analysis must be completed first.")
    return get_assessable_components(analysis)


# -------------------------------------------------------------
# 2. INDIVIDUAL ASSESSMENTS (COMPLETE & COMPONENT)
# -------------------------------------------------------------
@router.post("/analysis/{analysis_id}", response_model=InterviewOut)
def create_interview(
    analysis_id: str,
    payload: StartInterviewRequest,
    db: Session = Depends(get_db),
):
    """
    Starts an individual assessment (Complete Codebase or Component Assessment).
    """
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
    )


@router.get("/analysis/{analysis_id}/history")
def get_assessment_history(analysis_id: str, db: Session = Depends(get_db)):
    """
    Returns previous assessment sessions for this repository.
    """
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
def get_interview(session_id: str, db: Session = Depends(get_db)):
    """
    Retrieves an assessment session and its turns.
    """
    stmt = (
        select(InterviewSession)
        .options(joinedload(InterviewSession.turns))
        .where(InterviewSession.id == session_id)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")
    return session


@router.post("/{session_id}/answer", response_model=InterviewOut)
def answer_interview(
    session_id: str,
    payload: AnswerRequest,
    db: Session = Depends(get_db),
):
    """
    Submits an answer for the active assessment turn.
    """
    stmt = (
        select(InterviewSession)
        .options(joinedload(InterviewSession.turns), joinedload(InterviewSession.analysis))
        .where(InterviewSession.id == session_id)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")

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


# -------------------------------------------------------------
# 3. TEAM ASSESSMENTS & HACKATHON READINESS
# -------------------------------------------------------------
@router.post("/team/sessions")
def create_team(payload: CreateTeamSessionRequest, db: Session = Depends(get_db)):
    """
    Creates a new shared team assessment session with persistent database storage
    and cryptographic organizer & invite tokens.
    """
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
    organizer_token: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Returns the comprehensive team dashboard including completion progress,
    coverage matrix, and aggregated hackathon readiness insights.
    """
    stmt = (
        select(TeamSession)
        .options(joinedload(TeamSession.members), joinedload(TeamSession.analysis))
        .where(TeamSession.id == session_id)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Team session not found")

    is_organizer = (organizer_token is not None and organizer_token == session.organizer_token)
    dashboard = aggregate_team_dashboard(session)
    dashboard["is_organizer"] = is_organizer
    if is_organizer:
        dashboard["organizer_token"] = session.organizer_token
        dashboard["invite_token"] = session.invite_token

    return dashboard


@router.get("/team/invite/{invite_token}")
def get_team_invite_info(invite_token: str, db: Session = Depends(get_db)):
    """
    Public invite landing endpoint to inspect team session details before joining.
    """
    stmt = (
        select(TeamSession)
        .options(joinedload(TeamSession.members), joinedload(TeamSession.analysis))
        .where(TeamSession.invite_token == invite_token)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired team invitation.")

    if session.status != "active":
        raise HTTPException(status_code=410, detail="This team assessment session is no longer active.")

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


@router.post("/team/join/{invite_token}")
def join_team_session(
    invite_token: str,
    payload: JoinTeamRequest,
    db: Session = Depends(get_db),
):
    """
    Teammate joins a team session and receives their component-assigned assessment.
    """
    stmt = (
        select(TeamSession)
        .options(joinedload(TeamSession.members), joinedload(TeamSession.analysis))
        .where(TeamSession.invite_token == invite_token)
    )
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session or session.status != "active":
        raise HTTPException(status_code=404, detail="Invalid or inactive team session.")

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
        "status": member.status,
    }


@router.get("/team/analysis/{analysis_id}/sessions")
def get_team_sessions_for_repo(analysis_id: str, db: Session = Depends(get_db)):
    """
    Returns previous team assessment sessions for this repository.
    """
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
