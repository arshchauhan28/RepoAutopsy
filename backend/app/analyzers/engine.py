from __future__ import annotations

from app.analyzers.architecture import analyze_architecture
from app.analyzers.findings import detect_findings
from app.analyzers.metrics import analyze_metrics


def build_file_tree(files: dict[str, str]) -> list[dict]:
    tree = []
    for path, content in sorted(files.items()):
        tree.append({
            "path": path,
            "size": len(content.encode("utf-8")),
            "lines": content.count("\n") + (1 if content else 0),
        })
    return tree[:2500]


def run_static_analysis(files: dict[str, str], is_partial: bool = False, limit_reason: str | None = None) -> dict:
    metrics = analyze_metrics(files)
    architecture = analyze_architecture(files)
    findings = detect_findings(files)
    coverage = {
        "analyzed_files": len(files),
        "total_discovered_files": len(files),
        "is_partial": is_partial,
        "limit_reason": limit_reason,
    }
    return {
        "metrics": metrics,
        "architecture": architecture,
        "findings": findings,
        "file_tree": build_file_tree(files),
        "coverage": coverage,
    }
