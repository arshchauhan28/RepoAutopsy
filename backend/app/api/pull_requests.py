import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.core.rate_limit import check_rate_limit
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.pull_request import PullRequestAnalysis
from app.models.user import User
from app.api.deps import get_optional_user, check_resource_access
from app.schemas.pull_request import (
    AnalyzePRRequest,
    PullRequestAnalysisOut,
)
from app.services.github_service import GitHubError
from app.services.pr_service import (
    parse_pr_url,
    fetch_github_pr_data,
    analyze_pull_request,
    generate_pr_case_report,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pull-requests", tags=["pull-requests"])


@router.post("/analyze", response_model=PullRequestAnalysisOut, status_code=200)
def analyze_pr_endpoint(
    payload: AnalyzePRRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Ingests and analyzes a GitHub Pull Request URL.
    Checks cache by (repo_owner, repo_name, pr_number) to avoid duplicate expensive API calls.
    Links with existing base repository analysis if available.
    """
    check_rate_limit(request, "analyze_pr", max_requests=15, window_seconds=60)

    try:
        owner, repo, pr_number = parse_pr_url(payload.url)
    except GitHubError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Find base repository analysis if provided or latest completed
    base_analysis = None
    if payload.repository_id:
        base_analysis = db.get(Analysis, payload.repository_id)

    if not base_analysis:
        stmt = (
            select(Analysis)
            .where(Analysis.owner == owner, Analysis.repo_name == repo, Analysis.status == "completed")
            .order_by(desc(Analysis.created_at))
            .limit(1)
        )
        base_analysis = db.execute(stmt).scalar_one_or_none()

    # Check for existing cached completed PR analysis
    cached_stmt = (
        select(PullRequestAnalysis)
        .where(
            PullRequestAnalysis.repo_owner == owner,
            PullRequestAnalysis.repo_name == repo,
            PullRequestAnalysis.pr_number == pr_number,
            PullRequestAnalysis.status == "completed",
        )
        .order_by(desc(PullRequestAnalysis.created_at))
        .limit(1)
    )
    cached = db.execute(cached_stmt).scalar_one_or_none()
    if cached:
        logger.info("Returning cached PR analysis for %s/%s#%d (%s)", owner, repo, pr_number, cached.id)
        return cached

    # Ingest from GitHub
    try:
        pr_data = fetch_github_pr_data(owner, repo, pr_number)
    except GitHubError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Failed to fetch PR data from GitHub: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to fetch pull request data from GitHub API.") from exc

    # Analyze
    try:
        pr_analysis = analyze_pull_request(db, pr_data, base_analysis=base_analysis)
        return pr_analysis
    except Exception as exc:
        logger.error("PR analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to analyze pull request: {exc}") from exc


@router.get("/{pr_analysis_id}", response_model=PullRequestAnalysisOut)
def get_pr_analysis_endpoint(
    pr_analysis_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """
    Retrieves a completed Pull Request analysis by ID with workspace authorization.
    """
    pr = db.get(PullRequestAnalysis, pr_analysis_id)
    if not pr:
        raise HTTPException(status_code=404, detail="Pull request analysis not found.")
    check_resource_access(pr.workspace_id, user, db, min_role="viewer")
    return pr


@router.get("/by-repo/{owner}/{repo}/{pr_number}", response_model=PullRequestAnalysisOut)
def get_pr_by_number_endpoint(
    owner: str,
    repo: str,
    pr_number: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """
    Retrieves the latest analysis for a specific PR in a repository with authorization.
    """
    stmt = (
        select(PullRequestAnalysis)
        .where(
            PullRequestAnalysis.repo_owner == owner,
            PullRequestAnalysis.repo_name == repo,
            PullRequestAnalysis.pr_number == pr_number,
        )
        .order_by(desc(PullRequestAnalysis.created_at))
        .limit(1)
    )
    pr = db.execute(stmt).scalar_one_or_none()
    if not pr:
        raise HTTPException(status_code=404, detail=f"No analysis found for {owner}/{repo}#{pr_number}.")
    check_resource_access(pr.workspace_id, user, db, min_role="viewer")
    return pr


@router.get("/{pr_analysis_id}/report")
def get_pr_report_endpoint(
    pr_analysis_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """
    Generates change-focused Case Report ready for Markdown download or UI display.
    """
    pr = db.get(PullRequestAnalysis, pr_analysis_id)
    if not pr:
        raise HTTPException(status_code=404, detail="Pull request analysis not found.")
    check_resource_access(pr.workspace_id, user, db, min_role="viewer")
    return generate_pr_case_report(pr)
