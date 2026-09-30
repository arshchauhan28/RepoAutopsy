from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.interview import InterviewSession
from app.schemas.interview import StartInterviewRequest, AnswerRequest, InterviewOut
from app.services.interview_service import start_interview, answer_current

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.post("/analysis/{analysis_id}", response_model=InterviewOut)
def create_interview(analysis_id: str, payload: StartInterviewRequest, db: Session = Depends(get_db)):
    analysis = db.get(Analysis, analysis_id)
    if not analysis or analysis.status != "completed":
        raise HTTPException(status_code=409, detail="Analysis must be completed before starting an interview.")
    return start_interview(db, analysis, payload.question_count)


@router.get("/{session_id}", response_model=InterviewOut)
def get_interview(session_id: str, db: Session = Depends(get_db)):
    stmt = select(InterviewSession).options(joinedload(InterviewSession.turns)).where(InterviewSession.id == session_id)
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return session


@router.post("/{session_id}/answer", response_model=InterviewOut)
def answer_interview(session_id: str, payload: AnswerRequest, db: Session = Depends(get_db)):
    stmt = select(InterviewSession).options(joinedload(InterviewSession.turns), joinedload(InterviewSession.analysis)).where(InterviewSession.id == session_id)
    session = db.execute(stmt).unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    try:
        answer_current(db, session, payload.answer)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.refresh(session)
    return session
