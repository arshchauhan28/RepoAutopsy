from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db, SessionLocal
from app.models.analysis import Analysis
from app.schemas.analysis import AnalysisCreate, AnalysisOut
from app.services.github_service import parse_github_url, GitHubError
from app.services.analysis_service import analyze_repository
from app.core.rate_limit import check_rate_limit
from app.models.user import User
from app.api.deps import get_optional_user, check_resource_access

router = APIRouter(prefix="/analyses", tags=["analyses"])


def run_analysis_job(analysis_id: str):
    db = SessionLocal()
    try:
        analyze_repository(db, analysis_id)
    finally:
        db.close()


@router.post("", response_model=AnalysisOut, status_code=202)
def create_analysis(
    payload: AnalysisCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    check_rate_limit(request, "create_analysis", max_requests=10, window_seconds=60)
    try:
        owner, repo = parse_github_url(str(payload.github_url))
    except GitHubError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    analysis = Analysis(github_url=str(payload.github_url), owner=owner, repo_name=repo, status="queued")
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    background_tasks.add_task(run_analysis_job, analysis.id)
    return analysis


@router.get("/{analysis_id}", response_model=AnalysisOut)
def get_analysis(
    analysis_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    stmt = select(Analysis).options(joinedload(Analysis.findings)).where(Analysis.id == analysis_id)
    analysis = db.execute(stmt).unique().scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    check_resource_access(analysis.workspace_id, user, db, min_role="viewer")
    return analysis


@router.get("/{analysis_id}/files")
def get_files(
    analysis_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    check_resource_access(analysis.workspace_id, user, db, min_role="viewer")
    return {"files": analysis.file_tree or []}


@router.post("/{analysis_id}/rerun", response_model=AnalysisOut, status_code=202)
def rerun_analysis(
    analysis_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    check_resource_access(analysis.workspace_id, user, db, min_role="member")
    analysis.status = "queued"
    analysis.error = None
    db.commit()
    db.refresh(analysis)
    background_tasks.add_task(run_analysis_job, analysis.id)
    return analysis
