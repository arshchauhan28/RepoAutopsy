from __future__ import annotations

import logging
import secrets
from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.analysis import Analysis
from app.models.interview import InterviewSession, InterviewTurn, TeamMember, TeamSession
from app.services.codevitals_service import (
    generate_assessment_questions,
    evaluate_turn,
    compute_assessment_summary,
    compute_retake_comparison,
)

logger = logging.getLogger(__name__)


def context_for_analysis(analysis: Analysis) -> dict[str, Any]:
    return {
        "repository": {"owner": analysis.owner, "name": analysis.repo_name, "summary": analysis.summary},
        "metrics": analysis.metrics or {},
        "architecture": analysis.architecture or {},
        "languages": analysis.languages or {},
        "findings": [
            {"category": f.category, "severity": f.severity, "title": f.title, "file": f.file_path}
            for f in (analysis.findings or [])[:30]
        ],
        "ai_insights": analysis.ai_insights or {},
    }


def start_interview(
    db: Session,
    analysis: Analysis,
    count: int = 10,
    assessment_type: str = "complete",
    scope_type: str = "complete",
    selected_components: list[str] | None = None,
    difficulty: str = "intermediate",
    hackathon_mode: bool = False,
    hackathon_context: dict[str, Any] | None = None,
    participant_name: str | None = None,
    team_session_id: str | None = None,
    team_member_id: str | None = None,
    mode: str = "assessment",
    parent_session_id: str | None = None,
) -> InterviewSession:
    """
    Initializes a CodeVitals assessment session with evidence-grounded questions.
    """
    questions = generate_assessment_questions(
        analysis=analysis,
        scope_type=scope_type,
        selected_components=selected_components,
        difficulty=difficulty,
        target_count=count,
        hackathon_mode=hackathon_mode,
        hackathon_context=hackathon_context,
    )

    session_token = secrets.token_urlsafe(32)

    session = InterviewSession(
        session_token=session_token,
        analysis_id=analysis.id,
        status="active",
        current_index=0,
        assessment_type=assessment_type,
        scope_type=scope_type,
        selected_components=selected_components,
        difficulty=difficulty,
        question_count=len(questions),
        evaluation_mode="deterministic",
        participant_name=participant_name,
        team_session_id=team_session_id,
        team_member_id=team_member_id,
        hackathon_mode=1 if hackathon_mode else 0,
        hackathon_context=hackathon_context,
        mode=mode,
        parent_session_id=parent_session_id,
    )
    db.add(session)
    db.flush()

    for i, q in enumerate(questions):
        db.add(
            InterviewTurn(
                session_id=session.id,
                question_index=i,
                question=q["question"],
                question_type=q.get("question_type", "short_answer"),
                category=q.get("category", "architecture"),
                difficulty=q.get("difficulty", difficulty),
                options=q.get("options"),
                correct_option=q.get("correct_option"),
                code_snippet=q.get("code_snippet"),
                relevant_files=q.get("relevant_files", []),
                evidence=q.get("evidence"),
                rubric=q.get("rubric"),
                explanation=q.get("explanation"),
                evidence_confidence=q.get("evidence_confidence", "high"),
                max_score=100,
            )
        )

    db.commit()
    db.refresh(session)
    return session


def answer_current(
    db: Session,
    session: InterviewSession,
    answer: str | None = None,
    selected_option: int | None = None,
    question_index: int | None = None,
) -> InterviewTurn:
    """
    Evaluates and records an answer for the current or specified question turn.
    """
    turns = sorted(session.turns, key=lambda t: t.question_index)
    if session.status != "active":
        raise ValueError("This assessment is already complete.")

    if question_index is not None:
        if question_index < 0 or question_index >= len(turns):
            raise ValueError(f"Question index {question_index} out of range (0-{len(turns)-1}).")
        target_idx = question_index
    else:
        target_idx = session.current_index

    if target_idx >= len(turns):
        raise ValueError("Invalid question index.")

    turn = turns[target_idx]
    if turn.earned_score is not None:
        raise ValueError(f"Question {target_idx + 1} has already been submitted and evaluated.")
    analysis = session.analysis
    context = context_for_analysis(analysis) if analysis else {}

    evaluate_turn(turn, answer_text=answer, selected_option=selected_option, context=context)

    # Advance current_index if answering sequentially
    if target_idx == session.current_index:
        session.current_index = min(len(turns), session.current_index + 1)

    # Check if all turns have been answered
    all_answered = all(
        (t.earned_score is not None or t.answer is not None or t.selected_option is not None)
        for t in turns
    )

    if all_answered:
        summary = compute_assessment_summary(session)
        session.score = summary["overall_score"]
        session.category_scores = summary["category_scores"]
        session.status = "completed"
        session.feedback = {
            "summary": f"Assessment completed with score {summary['overall_score']}/100.",
            "strengths": summary["strengths"],
            "gaps": summary["knowledge_gaps"],
            "category_scores": summary["category_scores"],
        }

        if session.parent_session_id:
            parent = db.get(InterviewSession, session.parent_session_id)
            if parent:
                session.comparison_data = compute_retake_comparison(session, parent)

        # If linked to a team member, update the member record too
        if session.team_member_id:
            member = db.get(TeamMember, session.team_member_id)
            if member:
                member.status = "completed"
                member.score = summary["overall_score"]
                member.category_scores = summary["category_scores"]
                member.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(turn)
    return turn


def submit_batch_answers(
    db: Session,
    session: InterviewSession,
    answers: list[dict[str, Any]],
) -> InterviewSession:
    """
    Atomically evaluates all questions and completes the assessment within a single transaction.
    Protects against partial submission failures, race conditions, and network dropouts.
    """
    if session.status != "active":
        raise ValueError("This assessment is already complete.")

    turns_map = {t.question_index: t for t in session.turns}
    analysis = session.analysis
    context = context_for_analysis(analysis) if analysis else {}

    for item in answers:
        q_idx = item.get("question_index")
        if q_idx is None or q_idx not in turns_map:
            continue
        turn = turns_map[q_idx]
        evaluate_turn(
            turn,
            answer_text=item.get("answer"),
            selected_option=item.get("selected_option"),
            context=context,
        )

    # Set current index to end
    session.current_index = len(session.turns)

    # Compute final score and feedback
    summary = compute_assessment_summary(session)
    session.score = summary["overall_score"]
    session.category_scores = summary["category_scores"]
    session.status = "completed"
    session.feedback = {
        "summary": f"Assessment completed with score {summary['overall_score']}/100.",
        "strengths": summary["strengths"],
        "gaps": summary["knowledge_gaps"],
        "category_scores": summary["category_scores"],
    }

    if session.parent_session_id:
        parent = db.get(InterviewSession, session.parent_session_id)
        if parent:
            session.comparison_data = compute_retake_comparison(session, parent)

    if session.team_member_id:
        member = db.get(TeamMember, session.team_member_id)
        if member:
            member.status = "completed"
            member.score = summary["overall_score"]
            member.category_scores = summary["category_scores"]
            member.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(session)
    return session

