import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.models.analysis import Analysis
from app.models.finding import Finding
from app.services.github_service import GitHubError
from app.services.pr_service import (
    parse_pr_url,
    compute_change_impacts,
    compute_architecture_delta,
    compute_diagnostics_delta,
    compute_review_priority,
    compute_test_recommendations,
    analyze_pull_request,
    generate_pr_case_report,
)

client = TestClient(app)


def test_parse_pr_url_valid():
    owner, repo, pr = parse_pr_url("https://github.com/arshchauhan28/RepoAutopsy/pull/42")
    assert owner == "arshchauhan28"
    assert repo == "RepoAutopsy"
    assert pr == 42


def test_parse_pr_url_invalid_and_ssrf():
    # Non-github domain
    with pytest.raises(GitHubError):
        parse_pr_url("https://evil.com/owner/repo/pull/1")

    # Localhost SSRF
    with pytest.raises(GitHubError):
        parse_pr_url("http://127.0.0.1/owner/repo/pull/1")

    # Invalid PR number
    with pytest.raises(GitHubError):
        parse_pr_url("https://github.com/owner/repo/pull/abc")

    # Negative PR number
    with pytest.raises(GitHubError):
        parse_pr_url("https://github.com/owner/repo/pull/-5")


def test_change_impact_direct_and_downstream():
    components = [
        {"id": "comp-api-routes", "name": "API Routes & Endpoints", "all_files": ["backend/app/api/interviews.py"]},
        {"id": "comp-frontend-pages", "name": "Frontend Pages & Routing", "all_files": ["frontend/app/page.tsx"]},
    ]
    overview_edges = [
        {"source": "comp-frontend-pages", "target": "comp-api-routes", "label": "Dispatches Requests"}
    ]
    changed_files = [
        {
            "filename": "backend/app/api/interviews.py",
            "status": "modified",
            "additions": 20,
            "deletions": 5,
            "changes": 25,
            "patch": "+@router.post('/new-route')\ndef new_route(): pass",
        }
    ]

    impacts = compute_change_impacts(changed_files, components, overview_edges, {})
    assert len(impacts) >= 2

    # Direct contract risk impact on API routes
    direct_impact = next(i for i in impacts if i["affected_component_id"] == "comp-api-routes")
    assert direct_impact["impact_type"] == "contract_risk"

    # Downstream consumer impact on frontend pages
    downstream = next(i for i in impacts if i["affected_component_id"] == "comp-frontend-pages")
    assert downstream["impact_type"] == "downstream_consumer"
    assert "Dispatches Requests" in downstream["dependency_evidence"]


def test_architecture_delta():
    components = [{"id": "comp-api-routes", "name": "API Routes", "all_files": []}]
    changed_files = [
        {"filename": "backend/app/api/new_endpoint.py", "status": "added", "patch": "+# New file"},
        {"filename": "backend/app/legacy_route.py", "status": "removed", "patch": "-# Removed"},
    ]
    dep_graph = {"circular_dependencies": [["a.py", "backend/app/legacy_route.py", "a.py"]]}

    arch_delta = compute_architecture_delta(changed_files, components, dep_graph)
    assert "backend/app/api/new_endpoint.py" in arch_delta["added_modules"]
    assert "backend/app/legacy_route.py" in arch_delta["removed_modules"]
    assert len(arch_delta["resolved_circular_cycles"]) == 1


def test_diagnostics_delta_regressions_and_fixes():
    base_finding = Finding(
        id="f-1",
        analysis_id="a-1",
        category="security",
        severity="high",
        title="Token check bypassed",
        description="Missing token validation",
        file_path="backend/app/api/interviews.py",
        line=42,
    )

    changed_files = [
        {
            "filename": "backend/app/api/interviews.py",
            "status": "modified",
            "patch": "+# Fixed token check\n+api_key = 'sk_live_1234567890abcdef'",  # Introduces hardcoded secret!
        }
    ]

    diag_delta = compute_diagnostics_delta(changed_files, base_findings=[base_finding])

    # Should detect newly introduced hardcoded secret
    assert diag_delta["new_high_severity_count"] >= 1
    new_find = next(f for f in diag_delta["new_findings"] if "Secret" in f["title"])
    assert new_find["severity"] == "critical"

    # Base finding in modified file was resolved
    assert diag_delta["resolved_count"] >= 1


def test_review_priority_and_test_recommendations():
    changed_files = [
        {"filename": "backend/app/api/interviews.py", "status": "modified", "changes": 50},
        {"filename": "backend/app/models/interview.py", "status": "modified", "changes": 30},
    ]
    change_impacts = [
        {"affected_component_id": "comp-api-routes", "impact_type": "contract_risk"}
    ]
    diagnostics_delta = {"new_high_severity_count": 1}

    priority, reasons = compute_review_priority(changed_files, change_impacts, diagnostics_delta)
    assert priority == "high"
    assert any("diagnostic finding" in r for r in reasons)

    recs = compute_test_recommendations(changed_files, [])
    assert any(r["category"] == "api" for r in recs)
    assert any(r["category"] == "database" for r in recs)


def test_analyze_pull_request_flow_and_report():
    db = MagicMock()
    base_analysis = Analysis(
        id="base-analysis-1",
        owner="arshchauhan28",
        repo_name="RepoAutopsy",
        status="completed",
        architecture={
            "components": [
                {"id": "comp-api-routes", "name": "API Routes", "all_files": ["backend/app/api/interviews.py"]}
            ],
            "overview_edges": [],
            "dependency_graph": {},
        },
    )

    pr_data = {
        "meta": {
            "number": 12,
            "title": "Add CodeVitals Practice Mode",
            "body": "Implements in-place retries and active learning.",
            "user": {"login": "contributor"},
            "base": {
                "ref": "main",
                "sha": "1111111111111111111111111111111111111111",
                "repo": {"owner": {"login": "arshchauhan28"}, "name": "RepoAutopsy"},
            },
            "head": {
                "ref": "feature/practice",
                "sha": "2222222222222222222222222222222222222222",
            },
        },
        "changed_files": [
            {
                "filename": "backend/app/api/interviews.py",
                "status": "modified",
                "additions": 45,
                "deletions": 5,
                "changes": 50,
                "patch": "+@router.post('/practice')\ndef practice(): pass",
            }
        ],
        "is_partial": False,
    }

    pr = analyze_pull_request(db=db, pr_data=pr_data, base_analysis=base_analysis)
    assert pr.pr_number == 12
    assert pr.repo_owner == "arshchauhan28"
    assert pr.status == "completed"
    assert pr.changed_files_count == 1

    report = generate_pr_case_report(pr)
    assert "PULL REQUEST AUTOPSY REPORT: #12" in report["markdown"]
    assert report["review_priority"] in ("high", "medium", "low")
