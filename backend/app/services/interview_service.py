from sqlalchemy.orm import Session
from app.models.analysis import Analysis
from app.models.interview import InterviewSession, InterviewTurn
from app.services.ai_service import generate_questions, evaluate_answer


def context_for_analysis(analysis: Analysis) -> dict:
    return {
        "repository": {"owner": analysis.owner, "name": analysis.repo_name, "summary": analysis.summary},
        "metrics": analysis.metrics or {},
        "architecture": analysis.architecture or {},
        "languages": analysis.languages or {},
        "findings": [{"category": f.category, "severity": f.severity, "title": f.title, "file": f.file_path} for f in analysis.findings[:30]],
        "ai_insights": analysis.ai_insights or {},
    }


def start_interview(db: Session, analysis: Analysis, count: int) -> InterviewSession:
    questions = generate_questions(context_for_analysis(analysis), count)
    session = InterviewSession(analysis_id=analysis.id, current_index=0, status="active")
    db.add(session)
    db.flush()
    for i, question in enumerate(questions):
        db.add(InterviewTurn(session_id=session.id, question_index=i, question=question))
    db.commit()
    db.refresh(session)
    return session


def answer_current(db: Session, session: InterviewSession, answer: str) -> InterviewTurn:
    turns = sorted(session.turns, key=lambda t: t.question_index)
    if session.status != "active" or session.current_index >= len(turns):
        raise ValueError("This interview is already complete.")
    turn = turns[session.current_index]
    analysis = session.analysis
    evaluation = evaluate_answer(turn.question, answer, context_for_analysis(analysis))
    turn.answer = answer
    turn.evaluation = evaluation
    session.current_index += 1
    if session.current_index >= len(turns):
        scores = [int(t.evaluation.get("score", 0)) for t in turns if t.evaluation]
        session.score = round(sum(scores) / len(scores)) if scores else 0
        session.status = "completed"
        session.feedback = {
            "summary": "Interview completed. Review the answer-level gaps below and map them back to the repository.",
            "strengths": list({s for t in turns if t.evaluation for s in t.evaluation.get("strengths", [])})[:6],
            "gaps": list({g for t in turns if t.evaluation for g in t.evaluation.get("gaps", [])})[:8],
        }
    db.commit()
    db.refresh(turn)
    return turn
