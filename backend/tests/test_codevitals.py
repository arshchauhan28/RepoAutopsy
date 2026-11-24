import pytest
from datetime import datetime
from unittest.mock import MagicMock
from app.models.analysis import Analysis
from app.models.interview import InterviewSession, InterviewTurn, TeamSession, TeamMember
from app.services.codevitals_service import (
    get_assessable_components,
    generate_assessment_questions,
    evaluate_turn,
    compute_assessment_summary,
    create_team_session,
    start_member_assessment,
    aggregate_team_dashboard,
)


def create_sample_analysis():
    analysis = Analysis(
        id="test-analysis-1",
        owner="testowner",
        repo_name="RepoAutopsy",
        status="completed",
        summary="A comprehensive codebase analysis and intelligence platform.",
        languages={"Python": 12, "TypeScript": 18},
        metrics={"total_files": 30, "code_lines": 3500},
        created_at=datetime.utcnow(),
        architecture={
            "components": [
                {
                    "id": "comp-api-routes",
                    "name": "API Routes & Endpoints",
                    "layer": "api",
                    "role": "Handles HTTP requests and route matching.",
                    "file_count": 5,
                    "total_lines": 600,
                    "technologies": ["FastAPI"],
                    "sample_files": ["backend/app/api/interviews.py", "backend/app/api/analyses.py"],
                    "files": [{"path": "backend/app/api/interviews.py", "lines": 300}],
                },
                {
                    "id": "comp-frontend-pages",
                    "name": "Frontend Pages & Routing",
                    "layer": "presentation",
                    "role": "Renders user-facing pages and handles navigation.",
                    "file_count": 8,
                    "total_lines": 1200,
                    "technologies": ["Next.js", "React"],
                    "sample_files": ["frontend/app/repositories/[id]/page.tsx"],
                    "files": [{"path": "frontend/app/repositories/[id]/page.tsx", "lines": 400}],
                },
                {
                    "id": "comp-data-models",
                    "name": "Data Models & Storage",
                    "layer": "data",
                    "role": "Defines database schemas and ORM entities.",
                    "file_count": 4,
                    "total_lines": 500,
                    "technologies": ["SQLAlchemy"],
                    "sample_files": ["backend/app/models/interview.py"],
                    "files": [{"path": "backend/app/models/interview.py", "lines": 150}],
                },
            ],
            "overview_edges": [
                {
                    "source": "comp-frontend-pages",
                    "target": "comp-api-routes",
                    "label": "Dispatches Requests",
                    "weight": 5,
                },
                {
                    "source": "comp-api-routes",
                    "target": "comp-data-models",
                    "label": "Queries & Persists",
                    "weight": 3,
                },
            ],
            "dependency_graph": {
                "circular_dependencies": [["a.py", "b.py", "a.py"]],
                "external_packages": [{"package": "fastapi", "usage_count": 5}],
            },
        },
    )
    return analysis


def test_component_discovery():
    analysis = create_sample_analysis()
    comps = get_assessable_components(analysis)
    assert len(comps) == 3
    ids = {c["id"] for c in comps}
    assert "comp-api-routes" in ids
    assert "comp-frontend-pages" in ids
    assert "comp-data-models" in ids
    assert all(c["has_sufficient_evidence"] is True for c in comps)


def test_complete_codebase_question_generation():
    analysis = create_sample_analysis()
    questions = generate_assessment_questions(
        analysis=analysis,
        scope_type="complete",
        difficulty="intermediate",
        target_count=10,
    )
    assert len(questions) >= 3
    # Check that questions have required fields
    for q in questions:
        assert "question" in q
        assert "category" in q
        assert "difficulty" in q
        assert q["question_type"] in {"multiple_choice", "short_answer", "scenario", "code_interpretation", "code_understanding"}


def test_component_scoped_question_generation():
    analysis = create_sample_analysis()
    # Scoped only to API routes
    questions = generate_assessment_questions(
        analysis=analysis,
        scope_type="component",
        selected_components=["comp-api-routes"],
        difficulty="intermediate",
        target_count=5,
    )
    assert len(questions) >= 1
    # Check that questions are scoped
    api_qs = [q for q in questions if q.get("scope") == "comp-api-routes" or "api" in q.get("question", "").lower()]
    assert len(api_qs) >= 1


def test_multiple_choice_evaluation():
    turn = InterviewTurn(
        id="t-1",
        session_id="s-1",
        question_index=0,
        question="Which library is used for API routes?",
        question_type="multiple_choice",
        options=["Django", "FastAPI", "Flask", "Express"],
        correct_option=1,  # FastAPI
        relevant_files=["backend/app/main.py"],
    )

    # 1. Correct selection
    res_correct = evaluate_turn(turn, answer_text=None, selected_option=1, context={})
    assert res_correct["is_correct"] is True
    assert res_correct["score"] == 100
    assert turn.earned_score == 100

    # 2. Incorrect selection
    res_incorrect = evaluate_turn(turn, answer_text=None, selected_option=0, context={})
    assert res_incorrect["is_correct"] is False
    assert res_incorrect["score"] == 0
    assert turn.earned_score == 0


def test_free_text_rubric_evaluation():
    turn = InterviewTurn(
        id="t-2",
        session_id="s-1",
        question_index=1,
        question="Explain how the API routes query the data models.",
        question_type="short_answer",
        category="architecture",
        rubric={"key_concepts": ["SQLAlchemy", "session", "database"]},
        relevant_files=["backend/app/api/interviews.py"],
    )

    # Detailed answer matching rubric
    ans = "The API routes use SQLAlchemy session dependency injection to query database models and persist turns."
    res = evaluate_turn(turn, answer_text=ans, selected_option=None, context={})
    assert res["score"] >= 70
    assert "SQLAlchemy" in str(res["strengths"]) or "Addressed core question topics" in str(res["strengths"])


def test_assessment_summary_computation():
    session = InterviewSession(
        id="s-sum",
        analysis_id="a-1",
        turns=[
            InterviewTurn(
                id="t1", session_id="s-sum", question_index=0, category="architecture", earned_score=90, question="Q1"
            ),
            InterviewTurn(
                id="t2", session_id="s-sum", question_index=1, category="architecture", earned_score=80, question="Q2"
            ),
            InterviewTurn(
                id="t3", session_id="s-sum", question_index=2, category="security", earned_score=50, question="Q3"
            ),
        ],
    )
    summary = compute_assessment_summary(session)
    assert summary["overall_score"] == round((90 + 80 + 50) / 3)
    assert summary["category_scores"]["architecture"] == 85
    assert summary["category_scores"]["security"] == 50
    assert any("Architecture" in s for s in summary["strengths"])
    assert any("Security" in g for g in summary["knowledge_gaps"])


def test_team_session_creation_and_tokens():
    analysis = create_sample_analysis()
    db = MagicMock()

    members_data = [
        {"display_name": "Alice", "assigned_role": "Frontend", "assigned_components": ["comp-frontend-pages"]},
        {"display_name": "Bob", "assigned_role": "Backend", "assigned_components": ["comp-api-routes"]},
    ]

    team = create_team_session(
        db=db,
        analysis=analysis,
        team_name="Rocket Team",
        description="Hackathon 2026",
        is_hackathon_mode=True,
        hackathon_context={"problem_statement": "Fast analysis for repos"},
        members_data=members_data,
    )

    assert team.team_name == "Rocket Team"
    assert len(team.organizer_token) >= 30
    assert len(team.invite_token) >= 15
    assert team.is_hackathon_mode == 1
    assert len(team.shared_questions) > 0  # Shared questions generated
    assert db.add.called
    assert db.commit.called


def test_team_dashboard_aggregation():
    analysis = create_sample_analysis()
    team_session = TeamSession(
        id="ts-1",
        analysis_id="test-analysis-1",
        team_name="Hackathon Champs",
        organizer_token="org-token-xyz",
        invite_token="inv-token-abc",
        is_hackathon_mode=1,
        created_at=analysis.created_at,
    )
    team_session.analysis = analysis

    m1 = TeamMember(
        id="m1",
        team_session_id="ts-1",
        display_name="Alice",
        assigned_components=["comp-frontend-pages"],
        status="completed",
        score=88,
        category_scores={"frontend": 90, "architecture": 85},
    )
    m2 = TeamMember(
        id="m2",
        team_session_id="ts-1",
        display_name="Bob",
        assigned_components=["comp-api-routes"],
        status="in_progress",
        score=None,
    )
    team_session.members = [m1, m2]

    dashboard = aggregate_team_dashboard(team_session)
    assert dashboard["team_name"] == "Hackathon Champs"
    assert dashboard["total_members"] == 2
    assert dashboard["completed_members"] == 1
    assert dashboard["in_progress_members"] == 1
    assert dashboard["team_average_score"] == 88

    # Check coverage matrix
    cov = dashboard["coverage_matrix"]
    frontend_cov = next(c for c in cov if c["component_id"] == "comp-frontend-pages")
    assert frontend_cov["status"] == "assessed"
    assert "Alice" in frontend_cov["completed_members"]

    api_cov = next(c for c in cov if c["component_id"] == "comp-api-routes")
    assert api_cov["status"] == "in_progress"
    assert "Bob" in api_cov["assigned_members"]
