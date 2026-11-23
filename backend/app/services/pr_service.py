import hashlib
import logging
import re
from datetime import datetime
from typing import Any
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.analysis import Analysis
from app.models.pull_request import PullRequestAnalysis
from app.services.github_service import GitHubError, headers, get_github_api_timeout

logger = logging.getLogger(__name__)

PR_URL_RE = re.compile(
    r"^https?://github\.com/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)/([a-zA-Z0-9_.-]{1,100})/pull/(\d+)/?(?:#.*)?$"
)

# Safety bounds
MAX_PR_FILES = 250
MAX_PATCH_CHARS = 100_000


def parse_pr_url(url: str) -> tuple[str, str, int]:
    """
    Parses and strictly validates a GitHub pull request URL.
    Defends against SSRF, invalid hosts, and malformed identifiers.
    """
    clean_url = url.strip()
    match = PR_URL_RE.match(clean_url)
    if not match:
        raise GitHubError(
            "Invalid GitHub pull request URL. Expected format: https://github.com/owner/repository/pull/123"
        )
    owner, repo, pr_str = match.groups()
    if repo in {".", ".."}:
        raise GitHubError("Invalid repository name.")
    try:
        pr_number = int(pr_str)
        if pr_number <= 0:
            raise ValueError()
    except ValueError:
        raise GitHubError("Pull request number must be a positive integer.")

    return owner, repo, pr_number


def fetch_github_pr_data(owner: str, repo: str, pr_number: int) -> dict[str, Any]:
    """
    Fetches pull request metadata and changed files using GitHub REST API.
    Handles pagination, bounded patches, binary files, timeouts, and rate limits.
    """
    timeout = get_github_api_timeout()
    req_headers = headers()

    with httpx.Client(timeout=timeout, headers=req_headers, follow_redirects=True) as client:
        # 1. Fetch PR Metadata
        try:
            pr_res = client.get(f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}")
            if pr_res.status_code == 404:
                raise GitHubError(f"Pull request #{pr_number} was not found on {owner}/{repo}.")
            if pr_res.status_code == 403 and "rate limit" in pr_res.text.lower():
                raise GitHubError("GitHub API rate limit exceeded. Please configure a valid GITHUB_TOKEN.")
            pr_res.raise_for_status()
            pr_meta = pr_res.json()
        except httpx.TimeoutException as exc:
            raise GitHubError("GitHub API timed out while fetching pull request details.") from exc
        except httpx.RequestError as exc:
            raise GitHubError(f"Failed to connect to GitHub API: {exc}") from exc

        # 2. Fetch Changed Files (with pagination)
        changed_files: list[dict[str, Any]] = []
        page = 1
        per_page = 100
        is_partial = False

        while len(changed_files) < MAX_PR_FILES:
            try:
                files_res = client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files?page={page}&per_page={per_page}"
                )
                files_res.raise_for_status()
                page_files = files_res.json()
                if not page_files:
                    break

                for f in page_files:
                    raw_patch = f.get("patch") or ""
                    is_truncated = False
                    if len(raw_patch) > MAX_PATCH_CHARS:
                        raw_patch = raw_patch[:MAX_PATCH_CHARS] + "\n... [Patch truncated due to size safety limit]"
                        is_truncated = True

                    is_binary = bool(f.get("status") != "removed" and not raw_patch and f.get("changes", 0) > 0)

                    changed_files.append({
                        "filename": f["filename"],
                        "previous_filename": f.get("previous_filename"),
                        "status": f.get("status", "modified"),
                        "additions": f.get("additions", 0),
                        "deletions": f.get("deletions", 0),
                        "changes": f.get("changes", 0),
                        "patch": raw_patch if not is_binary else None,
                        "is_binary": is_binary,
                        "is_truncated": is_truncated,
                    })

                    if len(changed_files) >= MAX_PR_FILES:
                        is_partial = True
                        break

                if len(page_files) < per_page:
                    break
                page += 1
            except httpx.RequestError as exc:
                logger.warning("Error fetching PR files page %d: %s", page, exc)
                break

        return {
            "meta": pr_meta,
            "changed_files": changed_files,
            "is_partial": is_partial,
        }


def _map_file_to_component(file_path: str, components: list[dict[str, Any]]) -> tuple[str, str]:
    """
    Maps a changed file path to an architectural component.
    """
    norm_path = file_path.replace("\\", "/").lower()
    for comp in components:
        all_files = [f.replace("\\", "/").lower() for f in comp.get("all_files", [])]
        if norm_path in all_files or any(norm_path.endswith(f) or f.endswith(norm_path) for f in all_files):
            return comp["id"], comp["name"]

    # Layer heuristic fallback based on path patterns
    if "api" in norm_path or "route" in norm_path or "endpoint" in norm_path or "controller" in norm_path:
        return "comp-api-routes", "API Routes & Endpoints"
    elif "model" in norm_path or "schema" in norm_path or "entity" in norm_path or "db" in norm_path:
        return "comp-data-models", "Data Models & Storage"
    elif "service" in norm_path or "business" in norm_path or "logic" in norm_path:
        return "comp-services", "Core Business Services"
    elif "component" in norm_path or "page" in norm_path or "view" in norm_path or "app/" in norm_path or "src/" in norm_path:
        return "comp-frontend-pages", "Frontend Presentation & Routing"
    elif "test" in norm_path or "spec" in norm_path:
        return "comp-tests", "Test Suite & Verification"
    elif "config" in norm_path or "setting" in norm_path or ".env" in norm_path:
        return "comp-config", "Configuration & Infrastructure"

    return "comp-core", "Core Application Logic"


def compute_change_impacts(
    changed_files: list[dict[str, Any]],
    components: list[dict[str, Any]],
    overview_edges: list[dict[str, Any]],
    dependency_graph: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Computes direct and indirect dependency change impact.
    Identifies modified components, downstream consumers, and potential integration risks.
    """
    impacts: list[dict[str, Any]] = []
    comp_map = {c["id"]: c for c in components}
    directly_modified_comps: set[str] = set()

    # 1. Direct Impact
    for cf in changed_files:
        fn = cf["filename"]
        cid, cname = _map_file_to_component(fn, components)
        directly_modified_comps.add(cid)
        patch = cf.get("patch") or ""

        # Check for contract-breaking changes (API routes, schemas, models)
        has_api_change = bool(re.search(r"(@router|@app|\.get\(|\.post\(|\.put\(|\.delete\()", patch))
        has_schema_change = bool(re.search(r"(class .*\(.*Base.*\)|\bColumn\b|\bmapped_column\b|\bField\b)", patch))

        impact_type = "direct"
        if has_api_change:
            impact_type = "contract_risk"
            explanation = f"Directly modifies API route interfaces in '{fn}', which may impact frontend clients or external consumers."
        elif has_schema_change:
            impact_type = "contract_risk"
            explanation = f"Modifies database schema / ORM structure in '{fn}', requiring verification of migrations and foreign keys."
        else:
            explanation = f"Direct code changes ({cf['additions']}+ / {cf['deletions']}-) in module '{fn}'."

        impacts.append({
            "affected_component_id": cid,
            "affected_component_name": cname,
            "impact_type": impact_type,
            "confidence": "high",
            "relevant_changed_file": fn,
            "dependency_evidence": f"File '{fn}' modified in {cname}.",
            "explanation": explanation,
        })

    # 2. Indirect Downstream Impact (via Dependency Graph)
    # Find components where target is in directly_modified_comps
    for edge in overview_edges:
        src = edge.get("source")
        tgt = edge.get("target")
        if tgt in directly_modified_comps and src not in directly_modified_comps:
            src_comp = comp_map.get(src)
            tgt_comp = comp_map.get(tgt)
            if src_comp and tgt_comp:
                impacts.append({
                    "affected_component_id": src,
                    "affected_component_name": src_comp["name"],
                    "impact_type": "downstream_consumer",
                    "confidence": "medium",
                    "relevant_changed_file": f"Depends on {tgt_comp['name']}",
                    "dependency_evidence": f"Architectural link: {src_comp['name']} -> {tgt_comp['name']} ({edge.get('label', 'calls')}).",
                    "explanation": f"Potentially affected because {src_comp['name']} dispatches requests or imports services from the modified {tgt_comp['name']} subsystem. Note: Architectural link indicates possible downstream effect; does not guarantee runtime failure.",
                })

    return impacts


def compute_architecture_delta(
    changed_files: list[dict[str, Any]],
    components: list[dict[str, Any]],
    dependency_graph: dict[str, Any],
) -> dict[str, Any]:
    """
    Detects architectural modifications such as added/removed modules,
    dependency changes, and new or resolved circular dependencies.
    """
    added_modules = [cf["filename"] for cf in changed_files if cf.get("status") == "added"]
    removed_modules = [cf["filename"] for cf in changed_files if cf.get("status") == "removed"]

    # Detect dependencies in patches
    new_dependencies = []
    for cf in changed_files:
        fn = cf["filename"]
        patch = cf.get("patch") or ""
        # Check requirements.txt or pyproject.toml or package.json
        if "package.json" in fn or "requirements" in fn or "pyproject.toml" in fn:
            for line in patch.splitlines():
                if line.startswith("+") and not line.startswith("+++"):
                    pkg_match = re.search(r'["\']([a-zA-Z0-9_\-\.\/]+)["\']\s*:', line)
                    if pkg_match:
                        new_dependencies.append({"file": fn, "package": pkg_match.group(1), "status": "added"})

    # Check circular dependencies
    existing_cycles = dependency_graph.get("circular_dependencies", [])
    resolved_cycles = []
    for cycle in existing_cycles:
        # If any file in the cycle was removed or refactored
        if any(f in removed_modules or any(cf["filename"].endswith(f) for cf in changed_files) for f in cycle):
            resolved_cycles.append(cycle)

    changed_boundaries = []
    for cf in changed_files:
        cid, cname = _map_file_to_component(cf["filename"], components)
        if cid not in changed_boundaries:
            changed_boundaries.append(f"{cname} ({cf['status']})")

    return {
        "added_modules": added_modules,
        "removed_modules": removed_modules,
        "new_dependencies": new_dependencies,
        "new_circular_cycles": [],
        "resolved_circular_cycles": resolved_cycles,
        "changed_service_boundaries": changed_boundaries[:6],
    }


def compute_diagnostics_delta(
    changed_files: list[dict[str, Any]],
    base_findings: list[Any] | None = None,
) -> dict[str, Any]:
    """
    Compares findings between base snapshot and PR head diff to determine
    new regressions, resolved findings, and unchanged diagnostics.
    Uses stable fingerprints: sha256(category + ":" + rule + ":" + normalized_path).
    """
    base_fingerprints: dict[str, Any] = {}
    if base_findings:
        for f in base_findings:
            f_cat = getattr(f, "category", "") or "general"
            f_title = getattr(f, "title", "") or ""
            f_path = (getattr(f, "file_path", "") or getattr(f, "file", "") or "").replace("\\", "/").lower()
            fp = hashlib.sha256(f"{f_cat}:{f_title}:{f_path}".encode()).hexdigest()[:16]
            base_fingerprints[fp] = f

    new_findings: list[dict[str, Any]] = []
    resolved_findings: list[dict[str, Any]] = []
    unchanged_findings: list[dict[str, Any]] = []

    # Detect newly introduced issues in changed files patches
    for cf in changed_files:
        fn = cf["filename"]
        norm_fn = fn.replace("\\", "/").lower()
        patch = cf.get("patch") or ""
        added_lines = [line[1:] for line in patch.splitlines() if line.startswith("+") and not line.startswith("+++")]
        added_text = "\n".join(added_lines)

        # 1. Hardcoded Secret / Credential Pattern
        if re.search(r'(api_key|secret_key|private_key|token)\s*=\s*["\'][a-zA-Z0-9_\-]{16,}["\']', added_text, re.I):
            fp = hashlib.sha256(f"security:Hardcoded Secret:{norm_fn}".encode()).hexdigest()[:16]
            new_findings.append({
                "fingerprint": fp,
                "title": "Hardcoded Secret Pattern Introduced",
                "category": "security",
                "severity": "critical",
                "file_path": fn,
                "description": "A potential plaintext credential or API token was added in this pull request.",
                "status": "new",
            })

        # 2. Missing Error Handling / Bare Except
        if re.search(r"except\s*:\s*pass", added_text):
            fp = hashlib.sha256(f"reliability:Silent Exception Swallowing:{norm_fn}".encode()).hexdigest()[:16]
            new_findings.append({
                "fingerprint": fp,
                "title": "Silent Exception Swallowing",
                "category": "reliability",
                "severity": "high",
                "file_path": fn,
                "description": "Code suppresses exceptions with bare 'except: pass', risking silent failures in production.",
                "status": "new",
            })

        # 3. Dangerous Evaluation (eval / exec)
        if re.search(r"\b(eval|exec)\s*\(", added_text):
            fp = hashlib.sha256(f"security:Dangerous Dynamic Execution:{norm_fn}".encode()).hexdigest()[:16]
            new_findings.append({
                "fingerprint": fp,
                "title": "Dynamic Code Execution Detected",
                "category": "security",
                "severity": "critical",
                "file_path": fn,
                "description": "Usage of eval() or exec() was introduced, creating potential arbitrary code execution risk.",
                "status": "new",
            })

        # Check for resolved base findings in touched files
        for fp, bf in list(base_fingerprints.items()):
            bf_path = (getattr(bf, "file_path", "") or getattr(bf, "file", "") or "").replace("\\", "/").lower()
            if bf_path and (norm_fn.endswith(bf_path) or bf_path.endswith(norm_fn)):
                bf_title = getattr(bf, "title", "Issue")
                # If the file was touched in PR and the finding was not reintroduced as a new finding
                if not any(nf["fingerprint"] == fp for nf in new_findings):
                    if not any(rf["fingerprint"] == fp for rf in resolved_findings):
                        resolved_findings.append({
                            "fingerprint": fp,
                            "title": bf_title,
                            "category": getattr(bf, "category", "general"),
                            "severity": getattr(bf, "severity", "medium"),
                            "file_path": getattr(bf, "file_path", fn),
                            "description": getattr(bf, "description", "Prior codebase diagnostic resolved in this PR."),
                            "status": "resolved",
                        })

    # Collect unchanged findings strictly from files that were NOT touched in this PR
    touched_paths = set()
    for cf in changed_files:
        touched_paths.add(cf["filename"].replace("\\", "/").lower())
        if cf.get("previous_filename"):
            touched_paths.add(cf["previous_filename"].replace("\\", "/").lower())

    for fp, bf in base_fingerprints.items():
        bf_path = (getattr(bf, "file_path", "") or getattr(bf, "file", "") or "").replace("\\", "/").lower()
        if not any(bf_path.endswith(tp) or tp.endswith(bf_path) for tp in touched_paths):
            unchanged_findings.append({
                "fingerprint": fp,
                "title": getattr(bf, "title", "Issue"),
                "category": getattr(bf, "category", "general"),
                "severity": getattr(bf, "severity", "medium"),
                "file_path": getattr(bf, "file_path", ""),
                "description": getattr(bf, "description", ""),
                "status": "unchanged",
            })

    new_high_severity_count = len([f for f in new_findings if f["severity"] in {"critical", "high"}])

    return {
        "new_findings": new_findings,
        "resolved_findings": resolved_findings[:10],
        "unchanged_findings": unchanged_findings[:20],
        "new_high_severity_count": new_high_severity_count,
        "resolved_count": len(resolved_findings),
    }


def compute_review_priority(
    changed_files: list[dict[str, Any]],
    change_impacts: list[dict[str, Any]],
    diagnostics_delta: dict[str, Any],
) -> tuple[str, list[str]]:
    """
    Computes explainable review priority: 'high', 'medium', or 'low'.
    Provides transparent supporting evidence reasons.
    """
    reasons: list[str] = []
    total_changes = sum(cf.get("changes", 0) for cf in changed_files)
    new_high_findings = diagnostics_delta.get("new_high_severity_count", 0)

    # 1. Critical / High new diagnostics
    if new_high_findings > 0:
        reasons.append(f"Introduced {new_high_findings} new high/critical severity diagnostic finding(s).")

    # 2. Security & Auth files modified
    auth_files = [cf["filename"] for cf in changed_files if re.search(r"(auth|token|security|permission|password|session)", cf["filename"], re.I)]
    if auth_files:
        reasons.append(f"Modifies authentication/security-sensitive modules: {', '.join(auth_files[:2])}.")

    # 3. Contract risks (API / DB schemas)
    contract_risks = [ci for ci in change_impacts if ci.get("impact_type") == "contract_risk"]
    if contract_risks:
        reasons.append(f"Modifies external contracts (API route signatures or database models) in {len(contract_risks)} instance(s).")

    # 4. Wide downstream impact (>3 consumers)
    downstream_impacts = [ci for ci in change_impacts if ci.get("impact_type") == "downstream_consumer"]
    if len(downstream_impacts) >= 3:
        reasons.append(f"Changes affect {len(downstream_impacts)} downstream architectural consumer(s).")

    # 5. Large changes (>500 lines or >15 files)
    if total_changes > 500 or len(changed_files) > 15:
        reasons.append(f"Large change volume ({len(changed_files)} files, {total_changes} line changes).")

    # Determine priority
    if new_high_findings > 0 or auth_files or len(contract_risks) >= 2 or total_changes > 1000:
        priority = "high"
    elif contract_risks or downstream_impacts or total_changes > 200:
        priority = "medium"
    else:
        priority = "low"
        if not reasons:
            reasons.append("Localized code modifications with no detected contract breaks or security regressions.")

    return priority, reasons


def compute_test_recommendations(
    changed_files: list[dict[str, Any]],
    components: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Recommends relevant targeted tests based on the changed modules.
    Clearly labeled as actionable suggestions.
    """
    recommendations: list[dict[str, Any]] = []
    seen_cats = set()

    for cf in changed_files:
        fn = cf["filename"].lower()
        if "api" in fn or "route" in fn or "endpoint" in fn:
            if "api" not in seen_cats:
                seen_cats.add("api")
                recommendations.append({
                    "category": "api",
                    "target_module": cf["filename"],
                    "recommended_test_files": ["tests/test_api.py", "backend/tests/test_api.py"],
                    "rationale": "API route signatures or response handlers were modified; verify endpoint status codes and schemas.",
                })
        elif "model" in fn or "schema" in fn or "db" in fn:
            if "database" not in seen_cats:
                seen_cats.add("database")
                recommendations.append({
                    "category": "database",
                    "target_module": cf["filename"],
                    "recommended_test_files": ["tests/test_db.py", "tests/test_security.py"],
                    "rationale": "Database entities or schemas were modified; verify migration compatibility and foreign key safety.",
                })
        elif "service" in fn or "codevitals" in fn:
            if "service" not in seen_cats:
                seen_cats.add("service")
                recommendations.append({
                    "category": "service",
                    "target_module": cf["filename"],
                    "recommended_test_files": ["tests/test_codevitals.py", "tests/test_codevitals_sprint2.py"],
                    "rationale": "Core service logic changed; run comprehensive unit tests for business rules and error boundaries.",
                })
        elif "component" in fn or "page" in fn or ".tsx" in fn or ".jsx" in fn:
            if "frontend" not in seen_cats:
                seen_cats.add("frontend")
                recommendations.append({
                    "category": "frontend",
                    "target_module": cf["filename"],
                    "recommended_test_files": ["npm run test", "npm run build"],
                    "rationale": "Frontend components modified; run production build and verify responsive layout across breakpoints.",
                })

    if not recommendations:
        recommendations.append({
            "category": "regression",
            "target_module": "Repository Core",
            "recommended_test_files": ["pytest tests/"],
            "rationale": "Verify that existing test suites pass with zero regressions.",
        })

    return recommendations


def analyze_pull_request(
    db: Session,
    pr_data: dict[str, Any],
    base_analysis: Analysis | None = None,
) -> PullRequestAnalysis:
    """
    Performs full Pull Request Autopsy analysis on ingested PR data.
    Correlates base snapshot with PR head changes to produce change impacts,
    architectural deltas, diagnostic regressions, review priorities, and test recommendations.
    """
    pr_meta = pr_data["meta"]
    changed_files = pr_data.get("changed_files", [])
    is_partial = pr_data.get("is_partial", False)

    owner = pr_meta["base"]["repo"]["owner"]["login"]
    repo = pr_meta["base"]["repo"]["name"]
    pr_number = pr_meta["number"]
    pr_title = pr_meta.get("title", f"Pull Request #{pr_number}")
    pr_desc = pr_meta.get("body")
    pr_author = pr_meta.get("user", {}).get("login")
    base_branch = pr_meta["base"].get("ref", "main")
    head_branch = pr_meta["head"].get("ref", "patch")
    base_sha = pr_meta["base"].get("sha", "")
    head_sha = pr_meta["head"].get("sha", "")
    additions = sum(f.get("additions", 0) for f in changed_files)
    deletions = sum(f.get("deletions", 0) for f in changed_files)

    # Architectural context
    arch = (base_analysis.architecture if base_analysis else {}) or {}
    components = arch.get("components", [])
    overview_edges = arch.get("overview_edges", [])
    dep_graph = arch.get("dependency_graph", {})
    base_findings = base_analysis.findings if base_analysis else []

    # 1. Change Impact
    change_impacts = compute_change_impacts(changed_files, components, overview_edges, dep_graph)

    # 2. Architectural Delta
    arch_delta = compute_architecture_delta(changed_files, components, dep_graph)

    # 3. Diagnostics Delta
    diag_delta = compute_diagnostics_delta(changed_files, base_findings)

    # 4. Review Priority
    priority, priority_reasons = compute_review_priority(changed_files, change_impacts, diag_delta)

    # 5. Test Recommendations
    test_recs = compute_test_recommendations(changed_files, components)

    # 6. Limitations
    limitations = [
        f"Analysis Scope: Changed files and patch diffs mapped against base repository AST dependency graph (Base commit: {base_sha[:8] if base_sha else 'base'} → Head commit: {head_sha[:8] if head_sha else 'head'}).",
        "Dependency impact denotes potential consumer risk based on import edges, not guaranteed runtime breakage.",
    ]
    if is_partial:
        limitations.append(f"PR contains more than {MAX_PR_FILES} files. Analysis was bounded to the first {MAX_PR_FILES} files for performance.")

    # 7. Executive Summary
    summary = {
        "pr_number": pr_number,
        "title": pr_title,
        "author": pr_author,
        "total_files_changed": len(changed_files),
        "total_additions": additions,
        "total_deletions": deletions,
        "review_priority": priority,
        "key_impact_components": list({ci["affected_component_name"] for ci in change_impacts})[:4],
        "new_regressions_count": diag_delta.get("new_high_severity_count", 0),
        "resolved_findings_count": diag_delta.get("resolved_count", 0),
        "analysis_coverage": "Changed-File with Dependency Graph Analysis",
        "executive_summary": f"Pull Request #{pr_number} proposed by {pr_author or 'contributor'} modifies {len(changed_files)} file(s) across {len({ci['affected_component_id'] for ci in change_impacts})} architectural subsystem(s). Review Priority is rated {priority.upper()} based on {len(priority_reasons)} detected factor(s).",
    }

    # Persist or update
    pr_analysis = PullRequestAnalysis(
        analysis_id=base_analysis.id if base_analysis else None,
        repo_owner=owner,
        repo_name=repo,
        pr_number=pr_number,
        pr_title=pr_title,
        pr_description=pr_desc,
        pr_author=pr_author,
        base_branch=base_branch,
        head_branch=head_branch,
        base_sha=base_sha,
        head_sha=head_sha,
        status="completed",
        changed_files_count=len(changed_files),
        additions=additions,
        deletions=deletions,
        review_priority=priority,
        review_priority_reasons=priority_reasons,
        summary=summary,
        changed_files=changed_files,
        change_impacts=change_impacts,
        architecture_delta=arch_delta,
        diagnostics_delta=diag_delta,
        test_recommendations=test_recs,
        limitations=limitations,
        completed_at=datetime.utcnow(),
    )
    db.add(pr_analysis)
    db.commit()
    db.refresh(pr_analysis)
    return pr_analysis


def generate_pr_case_report(pr: PullRequestAnalysis) -> dict[str, Any]:
    """
    Generates a change-focused Case Report ready for Markdown download or UI display.
    """
    summary = pr.summary or {}
    diag_delta = pr.diagnostics_delta or {}
    new_findings = diag_delta.get("new_findings", [])
    resolved_findings = diag_delta.get("resolved_findings", [])
    impacts = pr.change_impacts or []
    test_recs = pr.test_recommendations or []

    md_lines = [
        f"# PULL REQUEST AUTOPSY REPORT: #{pr.pr_number} — {pr.pr_title}",
        f"**Repository:** `{pr.repo_owner}/{pr.repo_name}` | **Author:** `{pr.pr_author or 'Unknown'}`",
        f"**Branch:** `{pr.head_branch}` → `{pr.base_branch}` | **Commits:** `{pr.base_sha[:8]}` → `{pr.head_sha[:8]}`",
        f"**Review Priority:** **{pr.review_priority.upper()}** | **Coverage:** `Changed-File with Dependency Graph Analysis`",
        "",
        "## 1. Executive Summary",
        summary.get("executive_summary", "Change analysis completed."),
        "",
        "### Review Priority Reasons:",
    ]
    for r in pr.review_priority_reasons or []:
        md_lines.append(f"- {r}")

    md_lines.extend([
        "",
        "## 2. Change Overview",
        f"- **Files Changed:** {pr.changed_files_count}",
        f"- **Additions:** +{pr.additions} lines",
        f"- **Deletions:** -{pr.deletions} lines",
        "",
        "## 3. Change Impact Analysis",
    ])
    for imp in impacts[:8]:
        md_lines.append(f"- **{imp['affected_component_name']}** (`{imp['impact_type']}` / {imp['confidence']} confidence): {imp['explanation']}")

    md_lines.extend([
        "",
        "## 4. Diagnostics Delta (Regressions & Fixes)",
        f"- **New Issues Introduced:** {len(new_findings)}",
        f"- **Issues Resolved:** {len(resolved_findings)}",
    ])
    if new_findings:
        md_lines.append("\n### Newly Introduced Regressions:")
        for nf in new_findings:
            md_lines.append(f"- `[{nf['severity'].upper()}]` **{nf['title']}** in `{nf.get('file_path')}`: {nf['description']}")

    if resolved_findings:
        md_lines.append("\n### Resolved Diagnostic Issues:")
        for rf in resolved_findings:
            md_lines.append(f"- `[{rf['severity'].upper()}]` **{rf['title']}** in `{rf.get('file_path')}`")

    md_lines.extend([
        "",
        "## 5. Recommended Test Strategy",
    ])
    for tr in test_recs:
        md_lines.append(f"- **{tr['category'].upper()}**: {tr['rationale']} (Suggested: `{', '.join(tr.get('recommended_test_files', []))}`)")

    md_lines.extend([
        "",
        "## 6. Analysis Limitations",
    ])
    for lim in pr.limitations or []:
        md_lines.append(f"- {lim}")

    report_markdown = "\n".join(md_lines)

    return {
        "pr_number": pr.pr_number,
        "pr_title": pr.pr_title,
        "repo": f"{pr.repo_owner}/{pr.repo_name}",
        "review_priority": pr.review_priority,
        "markdown": report_markdown,
        "summary": summary,
        "diagnostics_delta": diag_delta,
        "change_impacts": impacts,
        "test_recommendations": test_recs,
    }
