from __future__ import annotations

import hashlib
import re
from collections import Counter
from pathlib import PurePosixPath
from app.analyzers.classifier import (
    classify_file,
    get_file_language,
    get_language_support_tier,
    is_eligible_for_ast_parsing,
    FileTypeCategory,
)

IGNORED_DIRS = {"node_modules", ".git", "dist", "build", ".next", "coverage", "venv", ".venv", "__pycache__"}


def is_lockfile(path: str) -> bool:
    cat = classify_file(path)
    return cat == "generated_code" and (path.endswith(".lock") or "lock" in PurePosixPath(path).name.lower())


def is_generated_or_data_file(path: str) -> bool:
    cat = classify_file(path)
    return cat in {"generated_code", "build_output", "vendored_dependency", "asset"}


def is_configuration_file(path: str) -> bool:
    return classify_file(path) == "configuration"


def is_test_or_fixture_file(path: str) -> bool:
    return classify_file(path) == "test"


def is_source_code(path: str) -> bool:
    cat = classify_file(path)
    return cat in {"application_source", "test"}


def is_maintainable_source_candidate(path: str) -> bool:
    """
    Checks if a file is an application source code file eligible for maintainability/architectural refactoring.
    Strictly excludes lockfiles, generated code, vendors, configuration files, and test fixtures.
    """
    return classify_file(path) == "application_source"


def language_for(path: str) -> str:
    return get_file_language(path)


def analyze_metrics(files: dict[str, str]) -> dict:
    """
    Computes verified repository metrics with exact lines breakdown:
    - physical_lines: total physical lines
    - blank_lines: empty or whitespace lines
    - comment_lines: full-line comments (#, //, /*, *)
    - source_lines: executable / code lines (physical - blank - comment)
    - first_party_source_files: application_source category
    - test_files: test category
    - category_counts: breakdown by 10 canonical categories
    - languages: file count by language
    - language_tiers: tier per language
    """
    languages = Counter()
    category_counts: Counter[str] = Counter()
    total_physical_lines = 0
    total_blank_lines = 0
    total_comment_lines = 0
    total_source_lines = 0
    total_files = 0
    first_party_source_files = 0
    test_files = 0

    largest_all = []
    largest_sources = []
    function_count = 0
    class_count = 0
    hashes: dict[str, list[str]] = {}

    for path, content in files.items():
        if any(part in IGNORED_DIRS for part in PurePosixPath(path).parts):
            continue

        total_files += 1
        cat = classify_file(path)
        category_counts[cat] += 1

        if cat == "application_source":
            first_party_source_files += 1
        elif cat == "test":
            test_files += 1

        lang = get_file_language(path)
        languages[lang] += 1

        lines = content.splitlines()
        p_lines = len(lines) if lines else (1 if content else 0)
        b_lines = 0
        c_lines = 0

        for line in lines:
            stripped = line.strip()
            if not stripped:
                b_lines += 1
            elif stripped.startswith(("#", "//", "/*", "*")):
                c_lines += 1

        s_lines = max(0, p_lines - b_lines - c_lines)

        total_physical_lines += p_lines
        total_blank_lines += b_lines
        total_comment_lines += c_lines
        total_source_lines += s_lines

        largest_all.append((p_lines, path))
        if cat == "application_source":
            largest_sources.append((p_lines, path))

        if is_eligible_for_ast_parsing(path, cat):
            function_count += len(re.findall(r"\b(?:def|function|func)\s+[A-Za-z_][\w]*", content))
            function_count += len(re.findall(r"\b(?:const|let|var)\s+[A-Za-z_][\w]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>", content))
            class_count += len(re.findall(r"\bclass\s+[A-Za-z_][\w]*", content))

        normalized = "\n".join(line.strip() for line in lines if line.strip())
        if len(normalized) >= 120 and cat in {"application_source", "test"}:
            h = hashlib.sha1(normalized.encode()).hexdigest()
            hashes.setdefault(h, []).append(path)

    duplicates = [paths for paths in hashes.values() if len(paths) > 1]

    # Map each language to its support tier
    language_tiers = {
        lang: get_language_support_tier(lang)
        for lang in languages.keys()
    }

    return {
        "total_files": total_files,
        "first_party_source_files": first_party_source_files,
        "test_files": test_files,
        # Verified line breakdown
        "total_lines": total_physical_lines,
        "physical_lines": total_physical_lines,
        "blank_lines": total_blank_lines,
        "comment_lines": total_comment_lines,
        "code_lines": total_source_lines,
        "source_lines": total_source_lines,
        # Categorical distributions
        "category_counts": dict(category_counts),
        "languages": dict(languages.most_common()),
        "language_tiers": language_tiers,
        "functions": function_count,
        "classes": class_count,
        "largest_files": [{"path": p, "lines": n} for n, p in sorted(largest_all, reverse=True)[:8]],
        "largest_source_files": [{"path": p, "lines": n} for n, p in sorted(largest_sources, reverse=True)[:8]],
        "duplicate_groups": duplicates[:10],
    }
