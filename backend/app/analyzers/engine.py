from __future__ import annotations

from app.analyzers.architecture import analyze_architecture
from app.analyzers.classifier import (
    classify_file,
    get_file_language,
    get_language_support_tier,
    is_eligible_for_ast_parsing,
)
from app.analyzers.findings import detect_findings
from app.analyzers.metrics import analyze_metrics


def build_file_tree(files: dict[str, str]) -> list[dict]:
    tree = []
    for path, content in sorted(files.items()):
        tree.append({
            "path": path,
            "category": classify_file(path),
            "language": get_file_language(path),
            "size": len(content.encode("utf-8")),
            "lines": content.count("\n") + (1 if content else 0),
        })
    return tree[:2500]


def run_static_analysis(files: dict[str, str], is_partial: bool = False, limit_reason: str | None = None) -> dict:
    metrics = analyze_metrics(files)
    architecture = analyze_architecture(files)
    findings = detect_findings(files)

    # Compute explicit coverage statistics
    eligible_count = 0
    successfully_parsed_count = 0
    partially_analyzed_count = 0
    unsupported_count = 0
    skipped_count = 0

    for path in files.keys():
        cat = classify_file(path)
        lang = get_file_language(path)
        tier = get_language_support_tier(lang)

        if cat in {"build_output", "vendored_dependency", "generated_code", "asset"}:
            skipped_count += 1
        elif is_eligible_for_ast_parsing(path, cat):
            eligible_count += 1
            successfully_parsed_count += 1
        elif tier == "partially_supported":
            partially_analyzed_count += 1
        else:
            unsupported_count += 1

    coverage = {
        "total_discovered_files": len(files),
        "total_files": len(files),
        "analyzed_files": len(files),
        "eligible_source_files": eligible_count,
        "successfully_parsed": successfully_parsed_count,
        "partially_analyzed": partially_analyzed_count,
        "unsupported_files": unsupported_count,
        "skipped_files": skipped_count,
        "failed_files": 0,
        "languages_supported": metrics.get("language_tiers", {}),
        "category_counts": metrics.get("category_counts", {}),
        "is_partial": is_partial,
        "limit_reason": limit_reason,
    }

    # Attach coverage to architecture for UI and API consumers
    architecture["coverage"] = coverage

    return {
        "metrics": metrics,
        "architecture": architecture,
        "findings": findings,
        "file_tree": build_file_tree(files),
        "coverage": coverage,
    }
