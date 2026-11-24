"""
Regression tests for Issue #6:
- 2,500 file limit enforcement and safe rejection
- Coverage metrics calculation & non-overlapping breakdowns
- Mathematical consistency: successfully_parsed + partially_analyzed + unsupported + skipped == total_files
- Zero findings detection and transparency flags
"""
import io
import zipfile
import pytest

from app.services.github_service import extract_safe_archive, GitHubError
from app.core.config import settings
from app.analyzers.engine import run_static_analysis


def make_dummy_zip(num_files: int, prefix: str = "repo-main") -> bytes:
    """Create an in-memory zip archive with a given number of files."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for i in range(num_files):
            filename = f"{prefix}/file_{i}.py"
            z.writestr(filename, f"# test file {i}\ndef func_{i}():\n    pass\n")
    return buf.getvalue()


class TestRepositoryLimitsAndIntake:
    """Tests for repository size safeguards and error messages."""

    def test_repo_within_file_limit_is_accepted(self):
        zip_bytes = make_dummy_zip(10)
        files = extract_safe_archive(zip_bytes)
        assert len(files) == 10
        assert all(f.endswith(".py") for f in files)

    def test_repo_at_exact_file_limit_is_accepted(self):
        # Exactly settings.max_files (2500)
        zip_bytes = make_dummy_zip(settings.max_files)
        files = extract_safe_archive(zip_bytes)
        assert len(files) == settings.max_files

    def test_repo_exceeding_file_limit_raises_safe_github_error(self):
        # 1 over the limit
        excess_count = settings.max_files + 1
        zip_bytes = make_dummy_zip(excess_count)

        with pytest.raises(GitHubError) as exc_info:
            extract_safe_archive(zip_bytes)

        error_msg = str(exc_info.value)
        assert f"exceeds the analysis limit: found {excess_count} files" in error_msg
        assert f"processes up to {settings.max_files} files" in error_msg
        assert "protect backend service stability" in error_msg


class TestCoverageModelAndCalculations:
    """Tests for CoverageModel mathematical consistency, breakdowns, and transparency."""

    def test_coverage_mathematical_consistency(self):
        """Total discovered files must exactly equal the sum of non-overlapping parts."""
        sample_files = {
            # 2 AST-parseable Python source files
            "app/main.py": "def root():\n    return {'hello': 'world'}\n",
            "app/utils.py": "def add(a, b):\n    return a + b\n",
            # 1 heuristic partially analyzed markdown file
            "README.md": "# Readme\nSome overview documentation.\n",
            # 1 unsupported file type
            "config.ini": "[section]\nkey=val\n",
            # 1 skipped vendor / build file
            "dist/bundle.js": "console.log('bundled');\n",
        }

        # Analyze
        results = run_static_analysis(sample_files)
        coverage = results.get("architecture", {}).get("coverage", {})

        total_discovered = coverage["total_discovered_files"]
        successfully_parsed = coverage["successfully_parsed"]
        partially_analyzed = coverage["partially_analyzed"]
        unsupported = coverage["unsupported_files"]
        skipped = coverage["skipped_files"]

        assert total_discovered == len(sample_files)
        # Check strict partition: successfully_parsed + partially_analyzed + unsupported + skipped == total
        assert successfully_parsed + partially_analyzed + unsupported + skipped == total_discovered
        assert coverage["eligible_source_files"] >= successfully_parsed

    def test_skipped_and_partially_analyzed_breakdowns(self):
        """Ensure breakdowns properly categorize files into build_output, generated, assets, etc."""
        sample_files = {
            "src/index.js": "const express = require('express');\nconst app = express();\n",
            "docs/guide.md": "# Guide\nDocs here.\n",
            "package.json": '{"name": "test", "version": "1.0.0"}',
            "package-lock.json": '{"lockfileVersion": 2}',
            "assets/logo.png": "binary content placeholder",
            "dist/main.min.js": "function a(){}",
            "vendor/lib.js": "function vendor(){}",
        }

        results = run_static_analysis(sample_files)
        coverage = results.get("architecture", {}).get("coverage", {})

        skipped_breakdown = coverage.get("skipped_breakdown", {})
        partially_breakdown = coverage.get("partially_analyzed_breakdown", {})

        assert "build_output" in skipped_breakdown or "vendored" in skipped_breakdown or "generated" in skipped_breakdown or "asset" in skipped_breakdown
        assert partially_breakdown.get("documentation", 0) >= 1 or partially_breakdown.get("configuration", 0) >= 1

    def test_full_coverage_flag_behavior(self):
        """When 100% of eligible files are successfully AST parsed and no unsupported files exist."""
        sample_files = {
            "main.py": "def foo():\n    return 42\n",
            "helper.py": "def bar():\n    return 'ok'\n",
        }

        results = run_static_analysis(sample_files)
        coverage = results.get("architecture", {}).get("coverage", {})

        assert coverage["is_full_coverage"] is True
        assert coverage["is_partial"] is False
        assert coverage["coverage_percentage"] == 100.0

    def test_partial_coverage_flag_behavior(self):
        """When there are unparseable files or skipped files, is_full_coverage must be False."""
        sample_files = {
            "main.py": "def foo():\n    return 42\n",
            "README.md": "# Docs\n",
            "data.bin": "binary",
        }

        results = run_static_analysis(sample_files)
        coverage = results.get("architecture", {}).get("coverage", {})

        assert coverage["is_full_coverage"] is False
        assert coverage["is_partial"] is True
        assert coverage["coverage_percentage"] < 100.0
