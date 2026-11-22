from __future__ import annotations

import json
import logging
from pathlib import PurePosixPath
from collections import defaultdict
from app.analyzers.metrics import (
    is_source_code,
    is_lockfile,
    is_maintainable_source_candidate,
)

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI
except ImportError:  # optional dependency at runtime when AI is disabled
    OpenAI = None

from app.core.config import settings


def _client() -> OpenAI | None:
    if not settings.ai_api_key or OpenAI is None:
        return None
    kwargs = {"api_key": settings.ai_api_key}
    if settings.ai_base_url:
        kwargs["base_url"] = settings.ai_base_url
    return OpenAI(**kwargs)


def _parse_json(content: str) -> dict | None:
    content = (content or "").strip()
    if not content:
        return None

    try:
        value = json.loads(content)
        if isinstance(value, dict):
            return value
        logger.debug("Parsed JSON payload is not a dict (type=%s)", type(value).__name__)
        return None
    except json.JSONDecodeError as exc:
        logger.debug("Direct JSON decode failed: %s; attempting object boundary extraction", exc)

    # Handle ```json ... ``` and responses containing a JSON object after reasoning
    start = content.find("{")
    end = content.rfind("}")
    if start >= 0 and end > start:
        try:
            value = json.loads(content[start : end + 1])
            if isinstance(value, dict):
                return value
            logger.debug("Extracted substring JSON is not a dict (type=%s)", type(value).__name__)
            return None
        except json.JSONDecodeError as exc:
            logger.debug("Substring JSON decode failed: %s", exc)
            return None
    return None


def _call_json(system: str, user: str) -> dict | None:
    client = _client()
    if not client:
        return None

    request = {
        "model": settings.ai_model,
        "temperature": 0.2,
        "reasoning_format": "hidden",
        "max_completion_tokens": 3500,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": system
                + "\nReturn ONLY one valid JSON object. Do not include markdown, commentary, or reasoning outside the JSON object.",
            },
            {"role": "user", "content": user},
        ],
    }

    try:
        response = client.chat.completions.create(**request)
        content = response.choices[0].message.content if response.choices else ""
        result = _parse_json(content or "")
        if result is not None:
            return result
        logger.warning("AI model returned non-JSON response in structured mode; attempting fallback request")
    except Exception as exc:
        logger.warning(
            "AI structured request failed (model=%s, error_type=%s): %s",
            settings.ai_model,
            type(exc).__name__,
            exc,
        )

    try:
        fallback_request = {
            "model": settings.ai_model,
            "temperature": 0.2,
            "reasoning_format": "hidden",
            "max_completion_tokens": 3500,
            "messages": [
                {
                    "role": "system",
                    "content": system
                    + "\nReturn ONLY one valid JSON object. No markdown or commentary.",
                },
                {"role": "user", "content": user},
            ],
        }
        response = client.chat.completions.create(**fallback_request)
        content = response.choices[0].message.content if response.choices else ""
        result = _parse_json(content or "")
        if result is not None:
            return result
        logger.warning("AI fallback request returned invalid JSON format")
        return None
    except Exception as exc:
        logger.warning(
            "AI fallback request failed (model=%s, error_type=%s): %s",
            settings.ai_model,
            type(exc).__name__,
            exc,
        )
        return None


def compute_findings_summary(findings: list[dict]) -> dict:
    """
    Computes consistent counts separating distinct grouped issues from raw occurrences.
    """
    groups_map: dict[str, str] = {}
    occ_crit = occ_high = occ_med = occ_low = 0
    for idx, f in enumerate(findings):
        s = (f.get("severity") or "low").lower()
        if s == "critical":
            occ_crit += 1
        elif s == "high":
            occ_high += 1
        elif s == "medium":
            occ_med += 1
        else:
            occ_low += 1

        group_key = f"{f.get('root_cause_group') or f.get('title')}::{f.get('file_path') or 'global'}"
        if group_key not in groups_map:
            groups_map[group_key] = s

    dist_crit = sum(1 for s in groups_map.values() if s == "critical")
    dist_high = sum(1 for s in groups_map.values() if s == "high")
    dist_med = sum(1 for s in groups_map.values() if s == "medium")
    dist_low = sum(1 for s in groups_map.values() if s == "low")
    dist_total_high = dist_crit + dist_high + dist_med
    occ_total_high = occ_crit + occ_high + occ_med

    return {
        "distinct_critical": dist_crit,
        "distinct_high": dist_high,
        "distinct_medium": dist_med,
        "distinct_low": dist_low,
        "distinct_total_high_priority": dist_total_high,
        "distinct_total": len(groups_map),
        "total_occurrences": len(findings),
        "occurrences_high_priority": occ_total_high,
        # For full backward compatibility with UI components reading existing fields
        "critical_count": dist_crit,
        "high_count": dist_high,
        "medium_count": dist_med,
        "low_count": dist_low,
        "total_high_priority": dist_total_high,
    }


def generate_deterministic_recommendations(context: dict) -> list[dict]:
    """
    Generate actionable, evidence-backed engineering recommendations.
    Deduplicates related findings into single high-impact improvements.
    Categorizes into 'Fix Now' vs 'Improve Later'.
    Never recommends refactoring lockfiles or generated files.
    """
    findings = context.get("findings", [])
    arch = context.get("architecture", {})
    components = arch.get("components", [])
    dep_graph = arch.get("dependency_graph", {})
    circular = dep_graph.get("circular_dependencies", [])
    metrics = context.get("metrics", {})
    total_files = metrics.get("total_files", 0)
    largest_sources = metrics.get("largest_source_files", [])

    recommendations: list[dict] = []
    seen_rec_keys: set[str] = set()

    # 1. Group findings by root_cause_group to create cohesive recommendations
    grouped_findings: dict[str, list[dict]] = defaultdict(list)
    for f in findings:
        group_key = f.get("root_cause_group") or f.get("category") or "general"
        grouped_findings[group_key].append(f)

    # 1a. Secret exposures (Fix Now - Security)
    if "secret-exposure" in grouped_findings:
        items = grouped_findings["secret-exposure"]
        locs = [f"{f.get('file_path')}:{f.get('line')}" for f in items if f.get("file_path")]
        evidence_str = f"Found exposed credentials in: {', '.join(locs[:3])}"
        recommendations.append({
            "id": "rec-secrets",
            "title": "Revoke and Externalize Exposed Credentials",
            "priority": "Fix Now",
            "category": "Security",
            "why_it_matters": "Credentials stored directly in source control can be accessed by unauthorized contributors, third-party loggers, or automated scanners.",
            "evidence": evidence_str,
            "recommended_approach": "Revoke compromised tokens immediately in your cloud/service provider console. Move secret values to an uncommitted .env file or cloud secret manager (AWS Secrets Manager, Doppler).",
            "expected_benefit": "Eliminates critical credential leakage and unauthorized infrastructure access.",
            "related_finding_ids": [f.get("id") for f in items if f.get("id")],
        })
        seen_rec_keys.add("secrets")

    # 1b. Command injection / eval / exec (Fix Now - Security)
    if "command-injection" in grouped_findings or "dynamic-evaluation" in grouped_findings:
        items = grouped_findings.get("command-injection", []) + grouped_findings.get("dynamic-evaluation", [])
        locs = [f"{f.get('file_path')}:{f.get('line')}" for f in items if f.get("file_path")]
        recommendations.append({
            "id": "rec-injection",
            "title": "Harden Process Execution and Eliminate Dynamic Evaluation Sinks",
            "priority": "Fix Now",
            "category": "Security",
            "why_it_matters": "Using shell=True with dynamic arguments or executing code via eval()/exec() allows arbitrary OS command execution if inputs are user-controlled.",
            "evidence": f"Dynamic execution sinks detected at: {', '.join(locs[:3])}",
            "recommended_approach": "Pass commands and arguments as strict, validated lists with shell=False. Replace eval() with ast.literal_eval() or explicit JSON parsing.",
            "expected_benefit": "Prevents remote code execution (RCE) and OS shell breakout vulnerabilities.",
            "related_finding_ids": [f.get("id") for f in items if f.get("id")],
        })
        seen_rec_keys.add("injection")

    # 1c. Mutable default arguments (Fix Now - Correctness)
    if "mutable-default-arg" in grouped_findings:
        items = grouped_findings["mutable-default-arg"]
        locs = [f"{f.get('file_path')}:{f.get('line')}" for f in items if f.get("file_path")]
        recommendations.append({
            "id": "rec-mutable-defaults",
            "title": "Replace Mutable Default Arguments with None Sentinel Pattern",
            "priority": "Fix Now",
            "category": "Correctness",
            "why_it_matters": "Python default arguments are evaluated once at definition time. In-place mutations persist across all subsequent function calls, creating subtle state leaks between requests.",
            "evidence": f"Mutable defaults detected in: {', '.join(locs[:3])}",
            "recommended_approach": "Change function signatures to use default=None, then assign a new list or dictionary inside the function body (e.g. if arg is None: arg = []).",
            "expected_benefit": "Guarantees function idempotency and eliminates cross-request state pollution.",
            "related_finding_ids": [f.get("id") for f in items if f.get("id")],
        })
        seen_rec_keys.add("mutable-defaults")

    # 1d. Missing timeouts in HTTP requests (Fix Now - Reliability)
    if "missing-timeout" in grouped_findings:
        items = grouped_findings["missing-timeout"]
        locs = [f"{f.get('file_path')}:{f.get('line')}" for f in items if f.get("file_path")]
        recommendations.append({
            "id": "rec-http-timeouts",
            "title": "Centralize Outbound HTTP Request Client with Explicit Timeouts",
            "priority": "Fix Now",
            "category": "Reliability",
            "why_it_matters": f"{len(items)} outbound network request call(s) lack explicit timeouts. Stalled remote servers can cause requests to hang indefinitely, depleting thread pools and causing cascading outages.",
            "evidence": f"Unbounded HTTP calls detected in: {', '.join(locs[:3])}",
            "recommended_approach": "Construct a shared HTTP client session with default connect (5s) and read (15s) timeouts, and configure standard retry logic for transient 5xx errors.",
            "expected_benefit": "Protects worker threads from resource exhaustion and prevents service degradation under slow third-party API conditions.",
            "related_finding_ids": [f.get("id") for f in items if f.get("id")],
        })
        seen_rec_keys.add("http-timeouts")

    # 1e. Silent exception swallowing (Fix Now - Reliability)
    if "silent-exception" in grouped_findings:
        items = grouped_findings["silent-exception"]
        locs = [f"{f.get('file_path')}:{f.get('line')}" for f in items if f.get("file_path")]
        recommendations.append({
            "id": "rec-silent-exceptions",
            "title": "Add Structured Logging to Exception Handlers",
            "priority": "Fix Now",
            "category": "Reliability",
            "why_it_matters": "Blank except blocks silently swallow unexpected runtime errors, making production failures invisible and debugging exceedingly difficult.",
            "evidence": f"Silent exception suppression detected in: {', '.join(locs[:3])}",
            "recommended_approach": "Log exception tracebacks with logger.exception() or capture specific expected exception classes instead of catch-all blank pass.",
            "expected_benefit": "Surfaces unexpected runtime failures in application logs and metrics for proactive debugging.",
            "related_finding_ids": [f.get("id") for f in items if f.get("id")],
        })
        seen_rec_keys.add("silent-exceptions")

    # 2. Circular module dependencies (Improve Later - Architecture)
    if circular and "circular-deps" not in seen_rec_keys:
        cyc = circular[0]
        cycle_str = " -> ".join(PurePosixPath(p).name for p in cyc[:4])
        recommendations.append({
            "id": "rec-circular-deps",
            "title": "Decouple Circular Module Dependency Cycle",
            "priority": "Improve Later",
            "category": "Architecture",
            "why_it_matters": f"Found {len(circular)} circular import cycle(s) (e.g. {cycle_str}). Circular imports create tight architectural coupling and can trigger import-time recursion or uninitialized variable defects.",
            "evidence": f"Circular cycle between {cyc[0]} and {cyc[1] if len(cyc) > 1 else cyc[0]}.",
            "recommended_approach": "Extract shared types, data models, or utility functions into a lower-level module (e.g. types.py, schemas/, or shared/) that both modules can import independently.",
            "expected_benefit": "Restores strict directed acyclic graph (DAG) structure, simplifies isolated testing, and prevents initialization errors.",
            "related_finding_ids": [],
        })
        seen_rec_keys.add("circular-deps")

    # 3. Automated Test Suite (Improve Later - Quality / DevEx)
    has_tests = any("test" in c.get("name", "").lower() for c in components)
    if not has_tests and "test-suite" not in seen_rec_keys:
        recommendations.append({
            "id": "rec-test-suite",
            "title": "Establish Automated Unit and Integration Test Suite",
            "priority": "Improve Later",
            "category": "Developer Experience",
            "why_it_matters": "No automated test directory or test runner configuration was detected in the repository. Refactorings and dependency upgrades carry high risk of regression.",
            "evidence": "Repository contains no matching tests/ or spec/ directories.",
            "recommended_approach": "Introduce an automated test framework (pytest for Python or Vitest/Jest for JS/TS) and add smoke tests covering primary API endpoints and domain services.",
            "expected_benefit": "Enables safe continuous refactoring and automated pull request verification.",
            "related_finding_ids": [],
        })
        seen_rec_keys.add("test-suite")

    # 4. Large complex source file with structural maintainability bottlenecks (Improve Later - Maintainability)
    # Strictly filter out lockfiles, generated code, vendor assets, configs, and test fixtures!
    # Requires structural evidence beyond mere line count (e.g. circular dependencies, duplication, or excessive size)
    duplicates = metrics.get("duplicate_groups", [])
    flat_duplicates = {p for group in duplicates for p in group}
    circular_files = {p for cycle in circular for p in cycle}

    valid_large_sources = [
        f for f in largest_sources
        if is_maintainable_source_candidate(f["path"]) and f.get("lines", 0) >= 400
    ]
    if valid_large_sources and "monolith" not in seen_rec_keys:
        for candidate in valid_large_sources:
            cpath = candidate["path"]
            has_structural_issue = (
                cpath in circular_files
                or cpath in flat_duplicates
                or candidate.get("lines", 0) >= 800
            )
            if has_structural_issue:
                fname = PurePosixPath(cpath).name
                evidence_reasons = []
                if cpath in circular_files:
                    evidence_reasons.append("involved in circular dependency cycles")
                if cpath in flat_duplicates:
                    evidence_reasons.append("contains duplicate code blocks")
                if candidate.get("lines", 0) >= 800:
                    evidence_reasons.append(f"high line density ({candidate.get('lines')} loc)")
                evidence_desc = f"Application source file {cpath} ({', '.join(evidence_reasons)})."

                recommendations.append({
                    "id": f"rec-modularize-{fname}",
                    "title": f"Modularize High-Complexity Module ({fname})",
                    "priority": "Improve Later",
                    "category": "Maintainability",
                    "why_it_matters": f"{cpath} concentrates multiple responsibilities in a single module, complicating testing and concurrent changes.",
                    "evidence": evidence_desc,
                    "recommended_approach": "Extract discrete sub-responsibilities (e.g. dedicated parsers, helper utilities, or domain models) into focused, single-purpose modules.",
                    "expected_benefit": "Improves unit testability, reduces coupling, and clarifies architectural boundaries.",
                    "related_finding_ids": [],
                })
                seen_rec_keys.add("monolith")
                break

    # 5. Missing README (Improve Later - Documentation)
    if any(f.get("root_cause_group") == "missing-documentation" for f in findings):
        recommendations.append({
            "id": "rec-readme",
            "title": "Add Comprehensive Repository Documentation (README)",
            "priority": "Improve Later",
            "category": "Developer Experience",
            "why_it_matters": "No top-level README was found. Clear documentation is critical for onboarding and operational clarity.",
            "evidence": "Repository root does not contain a README.md file.",
            "recommended_approach": "Add a structured README.md with project overview, local development setup, environment variables, and architecture summary.",
            "expected_benefit": "Accelerates developer onboarding and clarifies project purpose.",
            "related_finding_ids": [],
        })

    # Fallback if no issues exist
    if not recommendations:
        recommendations.append({
            "id": "rec-continuous-checks",
            "title": "Maintain Continuous Code Quality and Automated Audits",
            "priority": "Improve Later",
            "category": "Developer Experience",
            "why_it_matters": "Static analysis detected no high-priority defects or architectural anti-patterns.",
            "evidence": f"All {total_files} analyzed files passed current static checks cleanly.",
            "recommended_approach": "Set up GitHub Actions to run automated linting and Dependabot dependency scanning on each pull request.",
            "expected_benefit": "Ensures architectural standards and security hygiene remain high as the codebase scales.",
            "related_finding_ids": [],
        })

    return recommendations


def build_deterministic_insights(context: dict) -> dict:
    """
    High-fidelity deterministic briefing engine.
    Produces:
    - Codebase Briefing (Project Overview, Architecture Assessment, Strengths, Concerns, Limitations)
    - Actionable Recommendations (Fix Now vs Improve Later)
    Without duplicating diagnostic finding lists.
    """
    repo = context.get("repo", {})
    repo_name = repo.get("name", "Repository")
    description = repo.get("description") or "No repository description provided."
    metrics = context.get("metrics", {})
    total_files = metrics.get("total_files", 0)
    code_lines = metrics.get("code_lines", 0)
    languages = metrics.get("languages", {})
    top_langs = list(languages.keys())[:4]

    arch = context.get("architecture", {})
    components = arch.get("components", [])
    dep_graph = arch.get("dependency_graph", {})
    circular = dep_graph.get("circular_dependencies", [])
    external_pkgs = [p["package"] for p in dep_graph.get("external_packages", [])[:6]]

    findings = context.get("findings", [])
    summary_counts = compute_findings_summary(findings)
    total_high_priority = summary_counts["distinct_total_high_priority"]

    # 1. Project Overview
    tech_stack_desc = ", ".join(top_langs) if top_langs else "various languages"
    overview_summary = (
        f"{repo_name} is a software codebase primarily built in {tech_stack_desc}, spanning "
        f"{total_files} analyzed files and {code_lines:,} lines of code. {description}"
    )

    component_names = [c["name"] for c in components]
    org_desc = (
        f"The project is structured into {len(components)} detected architectural subsystems: "
        f"{', '.join(component_names[:5])}."
        if components
        else "The project uses a flat or utility structure with files organized across the repository root."
    )

    project_overview = {
        "summary": overview_summary,
        "primary_purpose": description,
        "technologies": top_langs + external_pkgs[:5],
        "codebase_organization": org_desc,
    }

    # 2. Architecture Assessment
    strengths = []
    if len(components) >= 3:
        strengths.append(f"Clear architectural layering separating {', '.join(component_names[:3])}.")
    if any("test" in c["name"].lower() for c in components):
        strengths.append("Dedicated automated test fixtures and suite included.")
    if not circular:
        strengths.append("Acyclic dependency structure with zero circular module import cycles detected.")
    if not strengths:
        strengths.append(f"Compact codebase footprint ({total_files} files) facilitating rapid developer onboarding.")

    concerns = []
    if circular:
        concerns.append(
            f"Detected {len(circular)} circular module dependency cycle(s) (e.g. {' -> '.join(PurePosixPath(p).name for p in circular[0][:4])}). Circular imports impede isolated testing."
        )
    if not any("test" in c["name"].lower() for c in components):
        concerns.append("Lack of an automated test directory or test coverage patterns in the analyzed source code.")

    if total_high_priority > 0:
        concerns.append(
            f"{total_high_priority} distinct issue(s) identified in Diagnostics across {summary_counts['total_occurrences']} occurrence(s) ({summary_counts['distinct_critical']} critical, {summary_counts['distinct_high']} high, {summary_counts['distinct_medium']} medium)."
        )

    if not concerns:
        concerns.append("Initial single-layer structure; may require formalizing service boundaries as features scale.")

    arch_rel = (
        f"The codebase links {len(components)} key subsystems. Module dependencies flow across {dep_graph.get('summary', {}).get('total_dependencies_count', 0)} "
        f"internal and external connections. Third-party packages include: {', '.join(external_pkgs[:4])}."
    )

    architecture_assessment = {
        "key_components": component_names,
        "component_relationships": arch_rel,
        "frontend_backend_separation": "Separated full-stack architecture" if ("Frontend Pages & Routing" in component_names and "API Routes & Endpoints" in component_names) else "Unified service or library architecture",
        "data_persistence": "SQL/ORM storage layer detected" if any("Data Models" in c["name"] for c in components) else "Stateless or external API storage",
        "strengths": strengths,
        "concerns": concerns,
    }

    # 3. Analysis Limitations
    limitations = [
        "Static code analysis evaluates syntactic patterns; runtime behaviors and external environment variables cannot be fully established.",
        "Dynamic import calls (e.g. importlib or runtime variables) may not be resolved in the static dependency graph.",
    ]
    if context.get("architecture", {}).get("coverage", {}).get("is_partial"):
        limitations.append("Repository file limits were applied; analysis represents the safest subset of available files.")

    # 4. Generate Structured Recommendations
    recommendations = generate_deterministic_recommendations(context)

    # 5. Legacy top_recommendations mapping for backward compatibility
    legacy_recs = []
    for r in recommendations[:3]:
        legacy_recs.append({
            "title": r["title"],
            "priority": "Critical" if r["priority"] == "Fix Now" else "Medium",
            "explanation": r["why_it_matters"],
            "evidence": r["evidence"],
            "solution": r["recommended_approach"],
            "expected_benefit": r["expected_benefit"],
        })

    questions = [
        f"How are responsibilities divided between {component_names[0] if component_names else 'frontend'} and {component_names[1] if len(component_names) > 1 else 'backend'}?",
        "What strategy is used to handle service failures, retries, and database disconnections?",
        "If repository throughput increased tenfold, what would be the first architectural bottleneck?",
    ]

    return {
        "is_ai_generated": False,
        "mode_label": "Static Analysis Case Report",
        "model": "Deterministic Codebase Intelligence",
        "transparency_note": "Deterministic static analysis case report generated directly from codebase AST and dependency evidence.",
        # New structured briefing & recommendations
        "project_overview": project_overview,
        "architecture_assessment": architecture_assessment,
        "architectural_strengths": strengths,
        "architectural_concerns": concerns,
        "analysis_limitations": limitations,
        "findings_summary": summary_counts,
        "recommendations": recommendations,
        # Backward compatibility fields
        "summary": overview_summary,
        "strengths": strengths,
        "priorities": [r["title"] for r in recommendations[:3]],
        "architecture_explanation": arch_rel,
        "top_recommendations": legacy_recs,
        "engineering_questions": questions,
    }


def repository_insights(context: dict) -> dict:
    """
    Produce intelligent repository briefing and recommendations.
    Uses LLM if available, otherwise runs the deterministic engine.
    """
    client = _client()
    if not client:
        return build_deterministic_insights(context)

    prompt = f"""
You are a Staff Software Architect writing a technical Codebase Briefing and recommending engineering actions.
Your output must be based STRICTLY on the provided static analysis evidence.
DO NOT invent files, functions, vulnerabilities, or dependencies that are not in the evidence.
NEVER recommend refactoring package-lock.json, lockfiles, or generated files.

Return a JSON object with this EXACT structure:
{{
  "project_overview": {{
    "summary": "What the project appears to do in 2-3 concise sentences.",
    "primary_purpose": "Concise statement of what problem it solves.",
    "technologies": ["list", "of", "detected", "technologies"],
    "codebase_organization": "How files and modules are arranged."
  }},
  "architecture_assessment": {{
    "key_components": ["list of main architectural components"],
    "component_relationships": "Explanation of how components interact based on evidence.",
    "frontend_backend_separation": "Description of separation between client and server layers.",
    "data_persistence": "How data is persisted or managed."
  }},
  "architectural_strengths": [
    "2-3 concrete architectural strengths supported by evidence"
  ],
  "architectural_concerns": [
    "1-3 architectural weaknesses or scaling concerns supported by evidence"
  ],
  "analysis_limitations": [
    "1-2 limitations of static analysis relevant to this project"
  ],
  "recommendations": [
    {{
      "id": "rec-unique-id",
      "title": "Action-oriented title",
      "priority": "Fix Now" or "Improve Later",
      "category": "Security" or "Reliability" or "Architecture" or "Performance" or "Maintainability" or "Developer Experience",
      "why_it_matters": "Why this is necessary in this repository",
      "evidence": "Concrete file path or pattern observed",
      "recommended_approach": "Specific actionable implementation guidance",
      "expected_benefit": "Concrete technical outcome",
      "related_finding_ids": []
    }}
  ],
  "engineering_questions": [
    "Question 1 testing author's knowledge of architecture tradeoffs",
    "Question 2 testing implementation decisions",
    "Question 3 testing edge cases or scaling"
  ]
}}

Repository evidence:
{json.dumps(context, ensure_ascii=False)[:40000]}
"""

    result = _call_json(
        "You are an expert software engineer reviewing a codebase. Never invent facts. Base conclusions strictly on evidence.",
        prompt,
    )

    if result and isinstance(result.get("recommendations"), list):
        overview = result.get("project_overview") or {}
        arch = result.get("architecture_assessment") or {}
        strengths = result.get("architectural_strengths") or []
        concerns = result.get("architectural_concerns") or []
        limitations = result.get("analysis_limitations") or [
            "Static analysis evaluates syntactic patterns; dynamic behaviors cannot be fully established."
        ]
        recs = result.get("recommendations", [])

        # Validate recommendations against false positives (e.g. lockfiles, configs, generated files)
        valid_recs = []
        for r in recs:
            if not isinstance(r, dict):
                continue
            title = r.get("title", "")
            evidence = r.get("evidence", "")
            combined_text = f"{title} {evidence}".lower()

            # Filter any lockfile, config, or generated file recommendations
            if is_lockfile(title) or is_lockfile(evidence):
                continue
            if any(lk in combined_text for lk in ["package-lock", "yarn.lock", "pnpm-lock", "poetry.lock", "cargo.lock", ".lock"]):
                continue
            if any(k in title.lower() for k in ["refactor", "monolith", "modularize", "split"]):
                if any(ext in combined_text for ext in [".json", ".yaml", ".yml", ".toml", ".xml", ".min.", ".bundle."]):
                    continue

            # Ensure priority is normalized to Fix Now or Improve Later
            p = r.get("priority", "Improve Later")
            if "fix" in p.lower() or "now" in p.lower() or "critical" in p.lower() or "high" in p.lower():
                r["priority"] = "Fix Now"
            else:
                r["priority"] = "Improve Later"
            valid_recs.append(r)

        # Merge with deterministic recommendations if LLM missed critical security issues
        det_recs = generate_deterministic_recommendations(context)
        det_fix_now = [dr for dr in det_recs if dr["priority"] == "Fix Now"]
        for d in det_fix_now:
            if not any(d["category"] == vr.get("category") for vr in valid_recs):
                valid_recs.insert(0, d)

        # Legacy top_recommendations mapping
        legacy_recs = []
        for r in valid_recs[:3]:
            legacy_recs.append({
                "title": r["title"],
                "priority": "Critical" if r["priority"] == "Fix Now" else "Medium",
                "explanation": r.get("why_it_matters", ""),
                "evidence": r.get("evidence", ""),
                "solution": r.get("recommended_approach", ""),
                "expected_benefit": r.get("expected_benefit", ""),
            })

        findings = context.get("findings", [])
        summary_counts = compute_findings_summary(findings)

        return {
            "is_ai_generated": True,
            "mode_label": "AI-Assisted Case Report",
            "model": settings.ai_model,
            "transparency_note": f"AI-Assisted Case Report generated by {settings.ai_model} based on static code evidence.",
            "project_overview": overview,
            "architecture_assessment": arch,
            "architectural_strengths": strengths,
            "architectural_concerns": concerns,
            "analysis_limitations": limitations,
            "findings_summary": summary_counts,
            "recommendations": valid_recs,
            # Backward compatibility
            "summary": overview.get("summary") or "Repository analysis completed.",
            "strengths": strengths or ["Modular codebase parsed."],
            "priorities": [r.get("title") for r in valid_recs if isinstance(r, dict)],
            "architecture_explanation": arch.get("component_relationships") or "Architecture derived from evidence.",
            "top_recommendations": legacy_recs,
            "engineering_questions": result.get("engineering_questions") or [
                "What are the main architectural boundaries in this repository?",
                "Where would you add tests first and why?",
                "What would you change before deploying to production?",
            ],
        }

    return build_deterministic_insights(context)


def generate_questions(context: dict, count: int) -> list[str]:
    prompt = f"""
Create exactly {count} interview questions about this specific repository. Questions should test whether the developer understands their own implementation, architecture, tradeoffs, backend, security, and deployment. Avoid generic textbook questions. Return JSON: {{"questions":[...]}}.
Repository evidence:
{json.dumps(context, ensure_ascii=False)[:50000]}
"""
    result = _call_json(
        "You are a technical interviewer. Ask concise but probing software engineering questions.",
        prompt,
    )
    if result and isinstance(result.get("questions"), list):
        return [str(q) for q in result["questions"][:count]]
    base = context.get("ai_insights", {}).get("engineering_questions", [])
    fallback = base + [
        "Explain the request flow through the main components of this repository.",
        "Which part of this codebase would you refactor first and why?",
        "What security risk would you test for before production deployment?",
        "How would you make the repository analysis more scalable for a much larger codebase?",
        "What would happen if the primary database became unavailable?",
        "How would you design automated tests for the most important behavior here?",
        "Which dependency or architectural decision would you reconsider, and what would you replace it with?",
        "How would you monitor this application in production?",
    ]
    return fallback[:count]


def evaluate_answer(question: str, answer: str, context: dict) -> dict:
    prompt = f"""
Evaluate the developer answer to this repository-specific interview question.
Return JSON with keys: score (0-100 integer), verdict, strengths (array), gaps (array), ideal_answer_points (array), follow_up.
Question: {question}
Answer: {answer}
Repository evidence: {json.dumps(context, ensure_ascii=False)[:35000]}
Do not reward confident but unsupported claims.
"""
    result = _call_json(
        "You are a fair senior interviewer evaluating technical answers against repository evidence.",
        prompt,
    )
    if result:
        return result
    length = len(answer.strip())
    score = min(85, 35 + length // 25)
    return {
        "score": score,
        "verdict": "Promising answer" if score >= 60 else "Needs more technical detail",
        "strengths": ["The answer addresses the question." if length > 30 else "The answer is concise."],
        "gaps": ["Connect the explanation to concrete files or implementation details.", "Explain tradeoffs and failure cases."],
        "ideal_answer_points": ["Reference the repository's actual architecture.", "Explain the reasoning behind the design choice.", "Mention at least one tradeoff or edge case."],
        "follow_up": "Which concrete file or component demonstrates that decision?",
    }
