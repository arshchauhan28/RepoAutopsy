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

    # Compute explicit, non-overlapping coverage statistics
    eligible_count = 0
    successfully_parsed_count = 0
    partially_analyzed_count = 0
    unsupported_count = 0
    skipped_count = 0

    skipped_breakdown: dict[str, int] = {}
    partially_analyzed_breakdown: dict[str, int] = {}
    unsupported_breakdown: dict[str, int] = {}

    for path in files.keys():
        cat = classify_file(path)
        lang = get_file_language(path)
        tier = get_language_support_tier(lang)

        if cat in {"build_output", "vendored_dependency", "generated_code", "asset"}:
            skipped_count += 1
            skipped_breakdown[cat] = skipped_breakdown.get(cat, 0) + 1
        elif is_eligible_for_ast_parsing(path, cat):
            eligible_count += 1
            successfully_parsed_count += 1
        elif tier == "partially_supported":
            partially_analyzed_count += 1
            partially_analyzed_breakdown[cat] = partially_analyzed_breakdown.get(cat, 0) + 1
        else:
            unsupported_count += 1
            unsupported_breakdown[lang] = unsupported_breakdown.get(lang, 0) + 1

    total_f = len(files)
    coverage_pct = round((successfully_parsed_count / total_f * 100), 1) if total_f > 0 else 100.0
    is_full_coverage = (
        not is_partial
        and partially_analyzed_count == 0
        and unsupported_count == 0
        and skipped_count == 0
    )

    coverage = {
        "total_discovered_files": total_f,
        "total_files": total_f,
        "analyzed_files": total_f,
        "eligible_source_files": eligible_count,
        "successfully_parsed": successfully_parsed_count,
        "partially_analyzed": partially_analyzed_count,
        "unsupported_files": unsupported_count,
        "skipped_files": skipped_count,
        "failed_files": 0,
        "coverage_percentage": coverage_pct,
        "is_full_coverage": is_full_coverage,
        "is_partial": is_partial or (partially_analyzed_count > 0 or unsupported_count > 0),
        "is_intake_truncated": is_partial,
        "limit_reason": limit_reason,
        "skipped_breakdown": skipped_breakdown,
        "partially_analyzed_breakdown": partially_analyzed_breakdown,
        "unsupported_breakdown": unsupported_breakdown,
        "languages_supported": metrics.get("language_tiers", {}),
        "category_counts": metrics.get("category_counts", {}),
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
