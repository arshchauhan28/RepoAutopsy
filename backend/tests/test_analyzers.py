from app.analyzers.engine import run_static_analysis
from app.analyzers.dependencies import analyze_dependencies, find_cycles
from app.analyzers.findings import detect_findings
from app.analyzers.metrics import is_lockfile, is_source_code
from app.services.ai_service import build_deterministic_insights, generate_deterministic_recommendations


def test_static_analysis_detects_secret():
    result = run_static_analysis({
        "README.md": "# Demo",
        "app.py": "API_KEY = 'AKIAIOSFODNN7EXAMPLE'\n\ndef hello():\n    return 'ok'\n",
    })
    assert result["metrics"]["total_files"] == 2
    assert any(f["category"] == "security" and f["severity"] == "critical" for f in result["findings"])


def test_python_ast_command_injection_and_mutable_defaults():
    files = {
        "README.md": "# Title",
        "service.py": """
import subprocess

def run_cmd(user_arg, default_list=[]):
    subprocess.run(f"echo {user_arg}", shell=True)
    return default_list
""",
    }
    findings = detect_findings(files)
    titles = [f["title"] for f in findings]
    assert any("Command Injection Sink" in t for t in titles)
    assert any("Mutable Default Argument" in t for t in titles)
    # Check severity and confidence
    cmd_finding = next(f for f in findings if "Command Injection Sink" in f["title"])
    assert cmd_finding["severity"] in {"critical", "high"}
    assert cmd_finding["confidence"] == "high"
    assert cmd_finding["file_path"] == "service.py"
    assert cmd_finding["line"] > 0
    assert len(cmd_finding["evidence"]) > 0
    assert len(cmd_finding["suggested_fix"]) > 0


def test_javascript_typescript_security():
    files = {
        "README.md": "# App",
        "frontend/src/Component.tsx": """
import React from 'react';

export function Widget({ content }: { content: string }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />;
}
""",
    }
    findings = detect_findings(files)
    assert any("dangerouslySetInnerHTML" in f["title"] for f in findings)
    xss_finding = next(f for f in findings if "dangerouslySetInnerHTML" in f["title"])
    assert xss_finding["severity"] == "high"
    assert xss_finding["confidence"] == "high"


def test_low_priority_findings_classified_properly():
    files = {
        "README.md": "# Demo",
        "app.py": "# TODO: refactor this calculation later\nx = 42\n",
    }
    findings = detect_findings(files)
    todo = [f for f in findings if "TODO" in f["title"]]
    assert len(todo) == 1
    assert todo[0]["severity"] == "low"


def test_dependency_extraction_and_resolution():
    files = {
        "backend/app/main.py": "from backend.app.core.config import settings\nimport fastapi\n",
        "backend/app/core/config.py": "class Settings:\n    pass\nsettings = Settings()\n",
    }
    dep_data = analyze_dependencies(files)
    edges = dep_data["edges"]
    assert any(e["source"] == "backend/app/main.py" and e["target"] == "backend/app/core/config.py" for e in edges)
    # External package fastapi detected
    ext_pkgs = [p["package"] for p in dep_data["external_packages"]]
    assert "fastapi" in ext_pkgs


def test_circular_dependency_detection():
    adj = {
        "a.py": {"b.py"},
        "b.py": {"c.py"},
        "c.py": {"a.py"},
        "d.py": {"a.py"},
    }
    cycles = find_cycles(adj)
    assert len(cycles) == 1
    assert cycles[0] == ["a.py", "b.py", "c.py", "a.py"]


def test_complete_file_hierarchy():
    files = {
        "README.md": "# Project",
        "src/components/Button.tsx": "export const Button = () => null;",
        "src/utils/math.ts": "export const add = (a: number, b: number) => a + b;",
    }
    res = run_static_analysis(files)
    arch = res["architecture"]
    hierarchy = arch["file_hierarchy"]
    assert hierarchy["type"] == "directory"
    assert hierarchy["file_count"] == 3
    # Check components detected
    assert len(arch["components"]) > 0


def test_lockfile_classification_helper():
    assert is_lockfile("frontend/package-lock.json") is True
    assert is_lockfile("yarn.lock") is True
    assert is_lockfile("backend/poetry.lock") is True
    assert is_lockfile("backend/app/main.py") is False
    assert is_source_code("frontend/package-lock.json") is False
    assert is_source_code("backend/app/main.py") is True
    assert is_source_code("frontend/components/Nav.tsx") is True


def test_package_lock_json_never_triggers_monolithic_refactoring():
    # Simulate a repository where package-lock.json is massive (3,000 lines)
    lockfile_content = '{\n  "name": "app",\n  "version": "1.0.0"\n}\n' + ("\n" * 3000)
    files = {
        "README.md": "# Title",
        "frontend/package-lock.json": lockfile_content,
        "backend/app/main.py": "print('ok')\n",
    }
    res = run_static_analysis(files)
    context = {
        "repo": {"name": "TestRepo"},
        "metrics": res["metrics"],
        "architecture": res["architecture"],
        "findings": res["findings"],
    }
    insights = build_deterministic_insights(context)
    recs = insights["recommendations"]
    for r in recs:
        assert "package-lock.json" not in r["title"]
        assert "package-lock" not in r["title"].lower()
        assert "package-lock" not in r.get("evidence", "").lower()


def test_recommendations_fix_now_vs_improve_later_and_deduplication():
    # Context with 3 missing timeout findings in github_service.py + circular imports
    context = {
        "repo": {"name": "TestRepo"},
        "metrics": {"total_files": 10, "code_lines": 500, "largest_source_files": []},
        "architecture": {
            "components": [{"id": "comp-routes", "name": "API Routes", "layer": "api"}],
            "dependency_graph": {
                "circular_dependencies": [["a.py", "b.py", "a.py"]],
                "external_packages": [{"package": "httpx", "usage_count": 3}],
            },
        },
        "findings": [
            {
                "id": "f1",
                "category": "reliability",
                "severity": "medium",
                "root_cause_group": "missing-timeout",
                "title": "Unbounded HTTP Request (Missing Timeout)",
                "file_path": "backend/app/services/github_service.py",
                "line": 32,
            },
            {
                "id": "f2",
                "category": "reliability",
                "severity": "medium",
                "root_cause_group": "missing-timeout",
                "title": "Unbounded HTTP Request (Missing Timeout)",
                "file_path": "backend/app/services/github_service.py",
                "line": 40,
            },
            {
                "id": "f3",
                "category": "reliability",
                "severity": "medium",
                "root_cause_group": "missing-timeout",
                "title": "Unbounded HTTP Request (Missing Timeout)",
                "file_path": "backend/app/services/github_service.py",
                "line": 44,
            },
        ],
    }
    recs = generate_deterministic_recommendations(context)
    timeout_recs = [r for r in recs if r["id"] == "rec-http-timeouts"]
    # 1. Deduplication: exactly 1 recommendation for all 3 missing timeouts
    assert len(timeout_recs) == 1
    assert timeout_recs[0]["priority"] == "Fix Now"
    assert "f1" in timeout_recs[0]["related_finding_ids"]
    assert "f2" in timeout_recs[0]["related_finding_ids"]
    assert "f3" in timeout_recs[0]["related_finding_ids"]

    # 2. Circular dependency is categorized as Improve Later
    circ_recs = [r for r in recs if r["id"] == "rec-circular-deps"]
    assert len(circ_recs) == 1
    assert circ_recs[0]["priority"] == "Improve Later"


def test_ai_codebase_briefing_structure():
    context = {
        "repo": {"name": "TestRepo", "description": "A demo repository"},
        "metrics": {"total_files": 5, "code_lines": 300, "languages": {"Python": 5}, "largest_source_files": []},
        "architecture": {
            "components": [{"id": "comp-api", "name": "API Routes & Endpoints", "layer": "api"}],
            "dependency_graph": {"circular_dependencies": [], "external_packages": []},
        },
        "findings": [
            {"id": "f1", "category": "security", "severity": "critical", "root_cause_group": "secret-exposure", "title": "Exposed API Key"}
        ],
    }
    insights = build_deterministic_insights(context)
    assert insights["mode_label"] == "Static Analysis Case Report"
    assert "project_overview" in insights
    assert "architecture_assessment" in insights
    assert "architectural_strengths" in insights
    assert "architectural_concerns" in insights
    assert "analysis_limitations" in insights
    assert "recommendations" in insights
    # Check that briefing does NOT contain redundant full findings list
    assert "important_findings_summary" not in insights
    # Check summary count is accurate
    assert insights["findings_summary"]["critical_count"] == 1
    assert insights["findings_summary"]["total_high_priority"] == 1


def test_ai_service_json_parsing_and_fallback():
    from app.services.ai_service import _parse_json

    # 1. Valid pure JSON
    assert _parse_json('{"key": "value"}') == {"key": "value"}

    # 2. Markdown fenced JSON
    assert _parse_json('```json\n{"status": "ok"}\n```') == {"status": "ok"}

    # 3. Leading reasoning with trailing JSON
    assert _parse_json('Reasoning text here...\n{"result": 42}') == {"result": 42}

    # 4. Invalid JSON
    assert _parse_json("Not a json") is None
    assert _parse_json("{invalid json:") is None

    # 5. Empty or whitespace
    assert _parse_json("") is None
    assert _parse_json("   ") is None

    # 6. JSON array or literal instead of dict
    assert _parse_json("[1, 2, 3]") is None
    assert _parse_json('"hello"') is None


def test_distinct_count_and_occurrence_consistency():
    from app.services.ai_service import compute_findings_summary

    # 5 occurrences representing 2 distinct root cause groups across 2 files
    findings = [
        {"id": "1", "severity": "medium", "category": "reliability", "root_cause_group": "missing-timeout", "file_path": "a.py", "title": "Timeout"},
        {"id": "2", "severity": "medium", "category": "reliability", "root_cause_group": "missing-timeout", "file_path": "a.py", "title": "Timeout"},
        {"id": "3", "severity": "medium", "category": "reliability", "root_cause_group": "missing-timeout", "file_path": "a.py", "title": "Timeout"},
        {"id": "4", "severity": "medium", "category": "reliability", "root_cause_group": "silent-exception", "file_path": "b.py", "title": "Exception"},
        {"id": "5", "severity": "medium", "category": "reliability", "root_cause_group": "silent-exception", "file_path": "b.py", "title": "Exception"},
    ]

    summary = compute_findings_summary(findings)
    assert summary["distinct_total"] == 2
    assert summary["distinct_total_high_priority"] == 2
    assert summary["total_occurrences"] == 5
    assert summary["occurrences_high_priority"] == 5
    assert summary["distinct_medium"] == 2
    assert summary["distinct_critical"] == 0


def test_comprehensive_file_classification():
    from app.analyzers.metrics import (
        is_lockfile,
        is_generated_or_data_file,
        is_configuration_file,
        is_test_or_fixture_file,
        is_source_code,
        is_maintainable_source_candidate,
    )

    # Lockfiles
    assert is_lockfile("package-lock.json") is True
    assert is_lockfile("frontend/package-lock.json") is True
    assert is_lockfile("pnpm-lock.yaml") is True
    assert is_lockfile("Cargo.lock") is True
    assert is_maintainable_source_candidate("frontend/package-lock.json") is False

    # Configs
    assert is_configuration_file("package.json") is True
    assert is_configuration_file("tsconfig.json") is True
    assert is_configuration_file("pyproject.toml") is True
    assert is_maintainable_source_candidate("package.json") is False

    # Generated / bundles
    assert is_generated_or_data_file("bundle.js") is True
    assert is_generated_or_data_file("dist/index.js") is True
    assert is_generated_or_data_file("app.min.js") is True
    assert is_maintainable_source_candidate("dist/index.js") is False

    # Tests / fixtures
    assert is_test_or_fixture_file("tests/test_api.py") is True
    assert is_test_or_fixture_file("src/__tests__/Button.test.tsx") is True
    assert is_maintainable_source_candidate("tests/test_api.py") is False

    # Legitimate application source code
    assert is_source_code("backend/app/main.py") is True
    assert is_maintainable_source_candidate("backend/app/main.py") is True
    assert is_maintainable_source_candidate("frontend/components/Nav.tsx") is True


def test_github_service_timeout_handling():
    import httpx
    from unittest.mock import patch, MagicMock
    from app.services.github_service import fetch_repository, GitHubError

    # Simulate timeout during metadata fetch
    with patch("httpx.Client.get", side_effect=httpx.ReadTimeout("Connection timed out")):
        try:
            fetch_repository("test-owner", "test-repo")
            assert False, "Should have raised GitHubError"
        except GitHubError as e:
            assert "timed out" in str(e).lower()

    # Simulate network connection error
    with patch("httpx.Client.get", side_effect=httpx.ConnectError("Network unreachable")):
        try:
            fetch_repository("test-owner", "test-repo")
            assert False, "Should have raised GitHubError"
        except GitHubError as e:
            assert "failed to connect" in str(e).lower()


def test_repoautopsy_source_code_has_no_missing_timeouts_or_silent_exceptions():
    """
    Verification on RepoAutopsy's own modified source files:
    - ai_service.py must not trigger Silent Exception findings
    - github_service.py must not trigger Missing Timeout findings
    """
    from pathlib import Path

    ai_service_path = Path(__file__).resolve().parent.parent / "app" / "services" / "ai_service.py"
    github_service_path = Path(__file__).resolve().parent.parent / "app" / "services" / "github_service.py"

    files = {
        "backend/app/services/ai_service.py": ai_service_path.read_text(encoding="utf-8"),
        "backend/app/services/github_service.py": github_service_path.read_text(encoding="utf-8"),
    }

    findings = detect_findings(files)
    silent_exc_findings = [f for f in findings if f["root_cause_group"] == "silent-exception"]
    timeout_findings = [f for f in findings if f["root_cause_group"] == "missing-timeout"]

    # Must be completely resolved in our own codebase!
    assert len(silent_exc_findings) == 0, f"Found unexpected silent exceptions: {silent_exc_findings}"
    assert len(timeout_findings) == 0, f"Found unexpected missing timeouts: {timeout_findings}"
