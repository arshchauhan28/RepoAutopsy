from datetime import datetime
from unittest.mock import patch
import pytest
from app.models.analysis import Analysis
from app.models.interview import InterviewSession
from app.services.codevitals_service import (
    generate_assessment_questions,
    get_assessable_components,
    validate_question,
)
from app.services.interview_service import start_interview, InsufficientQuestionsError


def create_rich_mock_analysis() -> Analysis:
    return Analysis(
        id="test-analysis-refill-123",
        owner="test-owner",
        repo_name="test-repo",
        github_url="https://github.com/test-owner/test-repo",
        status="completed",
        summary="A production full-stack web application with FastAPI backend and Next.js frontend.",
        created_at=datetime.utcnow(),
        metrics={
            "total_files": 42,
            "total_lines": 8500,
            "primary_language": "Python",
        },
        languages={"Python": 65.0, "TypeScript": 35.0},
        findings=[],
        architecture={
            "components": [
                {
                    "id": "comp-api-service",
                    "name": "Backend API Service",
                    "layer": "api",
                    "role": "Dispatches HTTP endpoints and orchestrates business domain services.",
                    "file_count": 8,
                    "total_lines": 2100,
                    "technologies": ["FastAPI", "Pydantic"],
                    "sample_files": [
                        "backend/app/api/interviews.py",
                        "backend/app/api/analyses.py",
                        "backend/app/api/auth.py",
                        "backend/app/api/workspaces.py",
                    ],
                    "all_files": [
                        "backend/app/api/interviews.py",
                        "backend/app/api/analyses.py",
                        "backend/app/api/auth.py",
                        "backend/app/api/workspaces.py",
                        "backend/app/services/interview_service.py",
                        "backend/app/services/codevitals_service.py",
                    ],
                    "symbols": ["create_interview", "get_components", "validate_question", "answer_current"],
                    "subcomponents": [
                        {
                            "id": "sc-api-routes",
                            "name": "HTTP Routes",
                            "files": ["backend/app/api/interviews.py", "backend/app/api/analyses.py"],
                        },
                        {
                            "id": "sc-api-services",
                            "name": "Business Services",
                            "files": ["backend/app/services/interview_service.py"],
                        },
                    ],
                },
                {
                    "id": "comp-ui-frontend",
                    "name": "Frontend Web Application",
                    "layer": "presentation",
                    "role": "Interactive user dashboard and assessment UI in Next.js.",
                    "file_count": 12,
                    "total_lines": 3400,
                    "technologies": ["Next.js", "React", "TailwindCSS"],
                    "sample_files": [
                        "frontend/app/page.tsx",
                        "frontend/components/CodeVitalsView.tsx",
                        "frontend/components/Nav.tsx",
                        "frontend/lib/api.ts",
                    ],
                    "all_files": [
                        "frontend/app/page.tsx",
                        "frontend/components/CodeVitalsView.tsx",
                        "frontend/components/Nav.tsx",
                        "frontend/lib/api.ts",
                        "frontend/components/codevitals/AssessmentRunner.tsx",
                    ],
                    "symbols": ["CodeVitalsView", "startAssessment", "AssessmentRunner"],
                    "subcomponents": [
                        {
                            "id": "sc-ui-components",
                            "name": "Core Components",
                            "files": ["frontend/components/CodeVitalsView.tsx", "frontend/components/Nav.tsx"],
                        },
                    ],
                },
                {
                    "id": "comp-data-layer",
                    "name": "Database Schema & ORM",
                    "layer": "data",
                    "role": "PostgreSQL relational schemas and SQLAlchemy database mappings.",
                    "file_count": 5,
                    "total_lines": 950,
                    "technologies": ["SQLAlchemy", "PostgreSQL"],
                    "sample_files": [
                        "backend/app/models/interview.py",
                        "backend/app/models/analysis.py",
                        "backend/app/db/session.py",
                    ],
                    "all_files": [
                        "backend/app/models/interview.py",
                        "backend/app/models/analysis.py",
                        "backend/app/db/session.py",
                    ],
                    "symbols": ["InterviewSession", "InterviewTurn", "get_db"],
                    "subcomponents": [],
                },
            ],
            "overview_edges": [
                {
                    "source": "comp-ui-frontend",
                    "target": "comp-api-service",
                    "label": "API REST Calls",
                },
                {
                    "source": "comp-api-service",
                    "target": "comp-data-layer",
                    "label": "SQL Queries & Sessions",
                },
            ],
            "overview_nodes": [
                {"label": "backend/requirements.txt"},
                {"label": "frontend/package.json"},
            ],
            "dependency_graph": {
                "circular_dependencies": [],
                "external_packages": [{"package": "fastapi"}, {"package": "react"}],
            },
        },
    )


def test_exact_question_count_5_10_15_20():
    """
    Verifies that generate_assessment_questions delivers the exact requested count (5, 10, 15, 20)
    for complete codebase scope whenever evidence exists.
    """
    analysis = create_rich_mock_analysis()

    for target in [5, 10, 15, 20]:
        questions = generate_assessment_questions(
            analysis=analysis,
            scope_type="complete",
            difficulty="intermediate",
            target_count=target,
        )
        assert len(questions) == target, f"Expected exactly {target} questions, got {len(questions)}"

        # Verify all questions have unique IDs and text
        ids = [q["id"] for q in questions]
        assert len(ids) == len(set(ids)), "All question IDs must be unique"


def test_component_scoped_exact_question_count():
    """
    Verifies that Component Assessment generates exactly the target count (10)
    strictly bounded to the selected component.
    """
    analysis = create_rich_mock_analysis()
    target = 10
    questions = generate_assessment_questions(
        analysis=analysis,
        scope_type="component",
        selected_components=["comp-api-service"],
        difficulty="intermediate",
        target_count=target,
    )
    assert len(questions) == target, f"Expected exactly {target} questions for component scope, got {len(questions)}"

    # Check scope bounding
    for q in questions:
        assert q.get("scope") in {"comp-api-service", "complete"}


def test_bounded_refill_loop_replaces_invalid_candidates():
    """
    Tests that if initial candidates are filtered out by validation, the bounded refill
    loop automatically replenishes the deficit to achieve target_count.
    """
    analysis = create_rich_mock_analysis()
    target = 10

    # Mock _build_deterministic_question_bank to return only 4 valid candidates
    sparse_candidates = [
        {
            "id": f"q_sparse_{i}",
            "scope": "complete",
            "category": "architecture",
            "difficulty": "intermediate",
            "question_type": "short_answer",
            "question": f"Valid grounded architecture question number {i} covering system modules?",
            "relevant_files": ["backend/app/api/interviews.py"],
            "evidence": "Verified module.",
            "evidence_confidence": "high",
            "rubric": {"key_concepts": ["concept"]},
        }
        for i in range(4)
    ]

    with patch("app.services.codevitals_service._build_deterministic_question_bank", return_value=sparse_candidates):
        questions = generate_assessment_questions(
            analysis=analysis,
            scope_type="complete",
            difficulty="intermediate",
            target_count=target,
        )
        assert len(questions) == target, f"Refill loop failed: expected {target}, got {len(questions)}"


def test_deduplication_and_refill():
    """
    Tests that duplicate candidates are discarded and the refill loop fills the deficit.
    """
    analysis = create_rich_mock_analysis()
    target = 10

    # 10 identical candidates
    duplicate_candidates = [
        {
            "id": f"q_dup_{i}",
            "scope": "complete",
            "category": "architecture",
            "difficulty": "intermediate",
            "question_type": "short_answer",
            "question": "What is the primary role of the FastAPI router in interviews?",
            "relevant_files": ["backend/app/api/interviews.py"],
            "evidence": "Same module.",
            "evidence_confidence": "high",
            "rubric": {"key_concepts": ["fastapi", "router"]},
        }
        for i in range(10)
    ]

    with patch("app.services.codevitals_service._build_deterministic_question_bank", return_value=duplicate_candidates):
        questions = generate_assessment_questions(
            analysis=analysis,
            scope_type="complete",
            difficulty="intermediate",
            target_count=target,
        )
        assert len(questions) == target, f"Expected {target} unique questions after refill, got {len(questions)}"
        # Check all question texts are unique
        texts = [q["question"].strip().lower() for q in questions]
        assert len(set(texts)) == target, "All questions must have unique text"


def test_truthful_evidence_exhaustion_contract():
    """
    Verifies that when evidence is genuinely exhausted:
    1. If allow_shorter=False, start_interview raises InsufficientQuestionsError.
    2. If allow_shorter=True, start_interview creates the session with available count
       and stores requested_question_count.
    """
    from unittest.mock import MagicMock
    mock_db = MagicMock()

    # Create minimal analysis with only 1 component and 1 file
    tiny_analysis = Analysis(
        id="tiny-analysis-001",
        owner="tiny-owner",
        repo_name="tiny-repo",
        github_url="https://github.com/tiny-owner/tiny-repo",
        status="completed",
        summary="A tiny single-script repository.",
        created_at=datetime.utcnow(),
        metrics={"total_files": 1, "total_lines": 10},
        languages={"Python": 100.0},
        findings=[],
        architecture={
            "components": [
                {
                    "id": "comp-script",
                    "name": "Standalone Script",
                    "layer": "core",
                    "role": "Single utility script.",
                    "file_count": 1,
                    "total_lines": 10,
                    "technologies": [],
                    "sample_files": ["main.py"],
                    "all_files": ["main.py"],
                    "symbols": ["main"],
                    "subcomponents": [],
                }
            ],
            "overview_edges": [],
            "overview_nodes": [],
            "dependency_graph": {},
        },
    )

    # Request 30 questions on a 1-file repository
    # 1. allow_shorter=False should raise InsufficientQuestionsError
    with pytest.raises(InsufficientQuestionsError) as exc_info:
        start_interview(
            db=mock_db,
            analysis=tiny_analysis,
            count=30,
            assessment_type="complete",
            allow_shorter=False,
        )

    err = exc_info.value
    assert err.requested_count == 30
    assert err.available_count < 30
    assert "insufficient evidence" in str(err).lower() or "verified repository-grounded" in str(err).lower()

    # 2. allow_shorter=True should succeed and record requested_question_count vs question_count
    session = start_interview(
        db=mock_db,
        analysis=tiny_analysis,
        count=30,
        assessment_type="complete",
        allow_shorter=True,
    )

    assert session.requested_question_count == 30
    assert session.question_count == err.available_count


def test_zero_hallucination_guarantee():
    """
    Verifies that all relevant_files referenced in questions actually exist in the repository knowledge model.
    """
    analysis = create_rich_mock_analysis()
    all_repo_files = {
        "backend/app/api/interviews.py",
        "backend/app/api/analyses.py",
        "backend/app/api/auth.py",
        "backend/app/api/workspaces.py",
        "backend/app/services/interview_service.py",
        "backend/app/services/codevitals_service.py",
        "frontend/app/page.tsx",
        "frontend/components/CodeVitalsView.tsx",
        "frontend/components/Nav.tsx",
        "frontend/lib/api.ts",
        "frontend/components/codevitals/AssessmentRunner.tsx",
        "backend/app/models/interview.py",
        "backend/app/models/analysis.py",
        "backend/app/db/session.py",
        "backend/requirements.txt",
        "frontend/package.json",
    }

    questions = generate_assessment_questions(
        analysis=analysis,
        scope_type="complete",
        difficulty="intermediate",
        target_count=15,
    )

    for q in questions:
        for rf in q.get("relevant_files") or []:
            # Must match a known repo file
            has_match = any(rf.lower() in f.lower() or f.lower() in rf.lower() for f in all_repo_files)
            assert has_match, f"Fictional file reference detected in question: {rf}"
