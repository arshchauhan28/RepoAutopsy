import pytest
from datetime import datetime
from unittest.mock import MagicMock
from app.models.analysis import Analysis
from app.models.interview import InterviewTurn, InterviewSession
from app.services.codevitals_service import (
    validate_question,
    deduplicate_questions,
    evaluate_turn,
    compute_assessment_summary,
)


def test_factual_validation_real_vs_fictitious_files():
    all_files = {
        "backend/app/api/interviews.py",
        "backend/app/services/codevitals_service.py",
        "frontend/components/CodeVitalsView.tsx",
    }

    # 1. Real file question
    valid_q = {
        "question": "What is the primary technical responsibility of 'backend/app/api/interviews.py'?",
        "question_type": "short_answer",
        "relevant_files": ["backend/app/api/interviews.py"],
        "rubric": {"key_concepts": ["API", "routes", "endpoints"]},
    }
    assert validate_question(valid_q, all_repo_files=all_files) is True

    # 2. Fictitious file question
    fake_q = {
        "question": "What does non_existent_invented_service_xyz.py do in this project?",
        "question_type": "short_answer",
        "relevant_files": ["non_existent_invented_service_xyz.py"],
        "rubric": {"key_concepts": ["fake"]},
    }
    assert validate_question(fake_q, all_repo_files=all_files) is False


def test_mcq_structural_validation():
    all_files = {"backend/app/main.py"}

    # Leaking answer in question
    leaking_q = {
        "question": "Why is FastAPI used as the web framework in this project?",
        "question_type": "multiple_choice",
        "options": ["FastAPI", "Django", "Flask", "Tornado"],
        "correct_option": 0,
        "relevant_files": ["backend/app/main.py"],
    }
    assert validate_question(leaking_q, all_repo_files=all_files) is False

    # Non-leaking valid MCQ
    valid_mcq = {
        "question": "Which web framework powers the backend API routing in this project?",
        "question_type": "multiple_choice",
        "options": ["FastAPI", "Django", "Flask", "Tornado"],
        "correct_option": 0,
        "relevant_files": ["backend/app/main.py"],
    }
    assert validate_question(valid_mcq, all_repo_files=all_files) is True


def test_deduplication_preserves_conceptually_different_questions():
    # Questions with identical first 40 characters but asking about different files/concepts
    q1 = {
        "question": "Which architectural subsystem is responsible for 'API Routes and HTTP dispatch'?",
        "scope": "comp-api-routes",
        "question_type": "multiple_choice",
        "relevant_files": ["backend/app/api/interviews.py"],
        "rubric": {"key_concepts": ["API Routes", "FastAPI"]},
    }
    q2 = {
        "question": "Which architectural subsystem is responsible for 'Database schema models and persistence'?",
        "scope": "comp-data-models",
        "question_type": "multiple_choice",
        "relevant_files": ["backend/app/models/interview.py"],
        "rubric": {"key_concepts": ["Data Models", "SQLAlchemy"]},
    }

    # Both should be preserved!
    deduped = deduplicate_questions([q1, q2])
    assert len(deduped) == 2


def test_contradiction_detection_in_free_text():
    turn = InterviewTurn(
        id="t-contra",
        session_id="s-contra",
        question_index=0,
        question="How does FastAPI handle API routing in this repository?",
        question_type="short_answer",
        rubric={"key_concepts": ["FastAPI", "routing", "endpoints"]},
    )

    contradictory_answer = "FastAPI is not used for routing and does not handle endpoints."
    res = evaluate_turn(turn, answer_text=contradictory_answer, selected_option=None, context={})

    assert res["score"] == 0
    assert res["status"] == "contradiction_detected"
    assert "Contradict" in res["verdict"]
    assert turn.earned_score == 0


def test_keyword_stuffing_detection():
    turn = InterviewTurn(
        id="t-stuff",
        session_id="s-stuff",
        question_index=0,
        question="Describe how API routes interact with the service layer.",
        question_type="short_answer",
        rubric={"key_concepts": ["endpoints", "interviews", "services", "dispatch"]},
    )

    stuffed_answer = "endpoints interviews services dispatch"
    res = evaluate_turn(turn, answer_text=stuffed_answer, selected_option=None, context={})

    assert res["score"] <= 20
    assert res["status"] == "keyword_stuffing"
    assert "Keyword Stuffing" in res["verdict"]


def test_reliable_vs_provisional_scoring_distinction():
    mcq_turn = InterviewTurn(
        id="t-mcq",
        session_id="s-mix",
        question_index=0,
        question_type="multiple_choice",
        options=["A", "B", "C", "D"],
        correct_option=0,
        selected_option=0,
        earned_score=100,
        evaluation={"is_reliably_graded": True},
    )

    text_turn = InterviewTurn(
        id="t-text",
        session_id="s-mix",
        question_index=1,
        question_type="short_answer",
        earned_score=75,
        evaluation={"is_reliably_graded": False, "status": "review_required"},
    )

    session = InterviewSession(
        id="s-mix",
        analysis_id="a-1",
        turns=[mcq_turn, text_turn],
    )

    summary = compute_assessment_summary(session)
    assert summary["graded_questions_count"] == 1
    assert summary["ungraded_questions_count"] == 1
    assert summary["has_ungraded_responses"] is True
    assert summary["overall_score"] == 100  # Reliable score from MCQ
    assert summary["evaluation_status"] == "partially_graded"
