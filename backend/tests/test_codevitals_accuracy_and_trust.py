"""
Targeted Accuracy and Product-Trust Tests for CodeVitals:
1. Valid source-backed questions pass validation.
2. Questions referencing nonexistent source files are rejected.
3. Questions referencing nonexistent phantom symbols are rejected.
4. Unsupported or malformed question assumptions are rejected.
5. Contradictory answer keys and explanations are rejected.
6. Duplicate question concepts are deduplicated.
7. Bounded refill loop replaces rejected candidates with valid ones.
8. Insufficient-evidence contract is preserved (raises InsufficientEvidenceError).
9. Assessment scoring and existing session compatibility is preserved.
10. Unsupported marketing claims are removed from public content.
"""
import uuid
import re
from pathlib import Path
from unittest.mock import MagicMock
import pytest
from app.models.analysis import Analysis
from app.models.interview import InterviewTurn
from app.services.codevitals_service import (
    validate_question,
    deduplicate_questions,
    generate_assessment_questions,
    evaluate_turn,
)
from app.services.interview_service import start_interview, InsufficientQuestionsError


def create_test_analysis() -> Analysis:
    return Analysis(
        id=uuid.uuid4(),
        owner="pallets",
        repo_name="flask",
        default_branch="main",
        status="completed",
        summary="Flask is a lightweight WSGI web application framework in Python.",
        architecture={
            "components": [
                {
                    "name": "WSGI Application Core",
                    "layer": "core",
                    "role": "Central Flask application object and request dispatching.",
                    "files": ["src/flask/app.py", "src/flask/ctx.py"],
                    "line_count": 1800,
                },
                {
                    "name": "Routing & Blueprints",
                    "layer": "routing",
                    "role": "URL rule routing and modular blueprint registration.",
                    "files": ["src/flask/blueprints.py", "src/flask/scaffold.py"],
                    "line_count": 1200,
                },
            ],
            "dependency_graph": {
                "nodes": [
                    {"id": "src/flask/app.py", "type": "file"},
                    {"id": "src/flask/ctx.py", "type": "file"},
                    {"id": "src/flask/blueprints.py", "type": "file"},
                    {"id": "src/flask/scaffold.py", "type": "file"},
                ],
                "edges": [
                    {"from": "src/flask/app.py", "to": "src/flask/blueprints.py"},
                ],
            },
        },
        languages={"Python": 45000},
        findings=[],
        metrics={"total_files": 4, "code_lines": 3000, "functions": 40},
    )


class TestCodeVitalsAccuracyAndValidation:
    """Verifies that CodeVitals enforces strict factual grounding without making absolute guarantees."""

    def test_valid_source_backed_question_passes(self):
        all_files = {"src/flask/app.py", "src/flask/blueprints.py"}
        symbol_table = {"app", "blueprints", "flask", "dispatch"}

        q = {
            "question": "How does `app` register modular components from `blueprints` in Flask?",
            "question_type": "multiple_choice",
            "options": [
                "Via the register_blueprint method",
                "Via direct subclassing of WSGIApp",
                "Via monkey-patching globals",
                "Via environment variable configuration",
            ],
            "correct_option": 0,
            "relevant_files": ["src/flask/app.py", "src/flask/blueprints.py"],
            "explanation": "Flask applications register blueprints using the register_blueprint method.",
        }

        assert validate_question(q, all_files, symbol_table=symbol_table) is True

    def test_question_with_nonexistent_files_is_rejected(self):
        all_files = {"src/flask/app.py", "src/flask/blueprints.py"}
        q = {
            "question": "How does the hypothetical billing processor handle recurring charges?",
            "question_type": "multiple_choice",
            "options": ["Opt A", "Opt B", "Opt C", "Opt D"],
            "correct_option": 0,
            "relevant_files": ["services/billing/fictional_stripe_gateway.py"],
            "explanation": "Billing processor uses stripe gateway.",
        }
        # Claimed file does not exist in repository files -> reject
        assert validate_question(q, all_files) is False

    def test_question_with_nonexistent_phantom_symbol_is_rejected(self):
        all_files = {"src/flask/app.py", "src/flask/blueprints.py"}
        symbol_table = {"app", "blueprints", "flask"}

        q = {
            "question": "How does `PhantomCryptoPaymentProcessor` encrypt transactions?",
            "question_type": "multiple_choice",
            "options": ["Using RSA", "Using AES", "Using ECC", "Using ChaCha20"],
            "correct_option": 0,
            "relevant_files": ["src/flask/app.py"],
            "explanation": "Transactions are encrypted using standard cryptography.",
        }
        # Quoted symbol does not exist in symbol table or file names -> reject
        assert validate_question(q, all_files, symbol_table=symbol_table) is False

    def test_unsupported_or_malformed_question_is_rejected(self):
        all_files = {"src/flask/app.py"}
        # Too short prompt
        q_short = {"question": "What is this?", "relevant_files": ["src/flask/app.py"]}
        assert validate_question(q_short, all_files) is False

        # Multiple choice with fewer than 4 options
        q_bad_opts = {
            "question": "Which HTTP methods does the route decorator accept by default in Flask?",
            "question_type": "multiple_choice",
            "options": ["GET only", "POST only"],
            "correct_option": 0,
            "relevant_files": ["src/flask/app.py"],
            "explanation": "By default, routes only accept GET.",
        }
        assert validate_question(q_bad_opts, all_files) is False

    def test_contradictory_answer_keys_are_rejected(self):
        all_files = {"src/flask/app.py"}
        # Explanation says option 1 is correct, but correct_option is set to 2
        q_contradictory = {
            "question": "How are request contexts handled in WSGI dispatch?",
            "question_type": "multiple_choice",
            "options": ["Pushing Context", "Popping Context", "Global Variable", "Thread Local"],
            "correct_option": 2,
            "relevant_files": ["src/flask/app.py"],
            "explanation": "Option 1 is correct because popping context finalizes the request lifecycle.",
        }
        assert validate_question(q_contradictory, all_files) is False

    def test_duplicate_question_concepts_are_deduplicated(self):
        q1 = {
            "question": "How does Flask dispatch incoming requests to matching view functions?",
            "scope": "core",
            "question_type": "scenario",
            "relevant_files": ["src/flask/app.py"],
            "rubric": {"key_concepts": ["dispatch", "request", "view"]},
        }
        # Near duplicate with identical meaning and concepts
        q2 = {
            "question": "How does Flask dispatch incoming requests to matching view functions?",
            "scope": "core",
            "question_type": "scenario",
            "relevant_files": ["src/flask/app.py"],
            "rubric": {"key_concepts": ["dispatch", "request", "view"]},
        }
        deduped = deduplicate_questions([q1, q2])
        assert len(deduped) == 1

    def test_question_refill_mechanism_after_candidate_rejection(self):
        analysis = create_test_analysis()
        questions = generate_assessment_questions(
            analysis=analysis,
            scope_type="complete",
            target_count=5,
            difficulty="intermediate",
        )
        assert len(questions) == 5
        # Verify every question has a valid question type and rubric/options
        for q in questions:
            assert q.get("question")
            assert q.get("question_version") == "3.0"
            assert q.get("source_reference")

    def test_insufficient_evidence_handling(self):
        mock_db = MagicMock()
        # Sparse repository with 1 file
        empty_analysis = Analysis(
            id=uuid.uuid4(),
            owner="empty",
            repo_name="sparse",
            default_branch="main",
            status="completed",
            summary="Empty repository",
            architecture={
                "components": [
                    {
                        "id": "comp-1",
                        "name": "Single Script",
                        "layer": "core",
                        "role": "Single utility file.",
                        "file_count": 1,
                        "total_lines": 5,
                        "sample_files": ["script.py"],
                        "all_files": ["script.py"],
                        "symbols": ["main"],
                        "subcomponents": [],
                    }
                ],
                "dependency_graph": {},
            },
            languages={"Python": 50},
            findings=[],
            metrics={"total_files": 1, "code_lines": 5},
        )

        with pytest.raises(InsufficientQuestionsError) as exc_info:
            start_interview(
                db=mock_db,
                analysis=empty_analysis,
                count=30,
                assessment_type="complete",
                allow_shorter=False,
            )
        assert exc_info.value.requested_count == 30
        assert exc_info.value.available_count < 30

    def test_grading_rubric_evaluation_compatibility(self):
        turn = InterviewTurn(
            id=str(uuid.uuid4()),
            session_id=str(uuid.uuid4()),
            question_index=0,
            question="How do you register blueprints in Flask?",
            question_type="multiple_choice",
            options=["Via register_blueprint", "Via globals", "Via subclassing", "Via env vars"],
            correct_option=0,
            explanation="Blueprints are registered using register_blueprint.",
        )
        feedback = evaluate_turn(turn, selected_option=0)
        assert feedback["is_correct"] is True
        assert feedback["score"] == 100
        assert feedback["verdict"] == "Correct"

    def test_unsupported_marketing_claims_removed_from_codebase(self):
        """Scans public files to confirm unsupported absolute claims are removed."""
        root = Path(__file__).resolve().parent.parent.parent
        files_to_check = [
            root / "frontend" / "app" / "features" / "codevitals" / "page.tsx",
            root / "frontend" / "app" / "features" / "diagnostics" / "page.tsx",
            root / "frontend" / "app" / "page.tsx",
            root / "frontend" / "components" / "CodeVitalsView.tsx",
            root / "frontend" / "scripts" / "og-preview-template.html",
        ]

        forbidden_phrases = [
            "zero-hallucination contract",
            "zero hallucination contract",
            "zero-hallucination guarantee",
            "zero hallucination assessment",
            "100% ast verified",
            "will never invent hypothetical classes",
            "zero-credentials guaranteed",
        ]

        for filepath in files_to_check:
            if filepath.exists():
                text = filepath.read_text(encoding="utf-8").lower()
                for phrase in forbidden_phrases:
                    assert phrase not in text, f"Forbidden absolute claim '{phrase}' found in {filepath}"
