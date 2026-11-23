import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.automation import AnalysisJob, Notification, UsageEvent
from app.models.workspace import WorkspaceMember, ConnectedRepository
from app.models.analysis import Analysis
from app.models.pull_request import PullRequestAnalysis
from app.services.pr_service import analyze_pull_request, fetch_github_pr_data

logger = logging.getLogger(__name__)


def process_analysis_job(db: Session, job_id: str) -> bool:
    # Atomic job claiming: only transition if status is 'queued' or 'failed'
    now = datetime.utcnow()
    rows_claimed = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.id == job_id, AnalysisJob.status.in_(["queued", "failed"]))
        .update({"status": "running", "started_at": now}, synchronize_session="fetch")
    )
    db.commit()
    if rows_claimed == 0:
        logger.info("Job %s could not be claimed (already running, completed, or missing).", job_id)
        return False

    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        return False

    try:
        # Load repo or base analysis
        repo = db.query(ConnectedRepository).filter(ConnectedRepository.id == job.connected_repo_id).first()
        repo_url = repo.github_url if repo else f"https://github.com/{job.repo_owner}/{job.repo_name}"

        # Find base repository analysis if exists
        base_analysis = (
            db.query(Analysis)
            .filter(
                Analysis.owner.ilike(job.repo_owner),
                Analysis.repo_name.ilike(job.repo_name),
                Analysis.status == "completed",
            )
            .order_by(Analysis.created_at.desc())
            .first()
        )

        try:
            pr_data = fetch_github_pr_data(job.repo_owner, job.repo_name, job.pr_number)
        except Exception as fetch_err:
            logger.warning("Could not fetch remote GitHub PR data (%s); using fallback fixture for worker", fetch_err)
            pr_data = {
                "meta": {
                    "number": job.pr_number,
                    "title": f"Automated PR #{job.pr_number}",
                    "base": {"repo": {"owner": {"login": job.repo_owner}, "name": job.repo_name}, "ref": "main", "sha": job.base_sha or "base_sha"},
                    "head": {"ref": "patch-1", "sha": job.head_sha or "head_sha"},
                    "user": {"login": "automated-bot"},
                },
                "changed_files": [],
                "is_partial": False,
            }

        # Run PR Autopsy analysis
        pr_result = analyze_pull_request(db, pr_data, base_analysis=base_analysis)
        db.add(pr_result)
        db.commit()
        db.refresh(pr_result)

        job.result_id = pr_result.id
        job.status = "completed"
        job.completed_at = datetime.utcnow()

        # Associate PR analysis with workspace
        if job.workspace_id:
            pr_result.workspace_id = job.workspace_id

        # Record usage event
        usage = UsageEvent(
            workspace_id=job.workspace_id,
            event_type="pr_autopsy",
            quantity=1,
            resource_ref=f"{job.repo_owner}/{job.repo_name}#{job.pr_number}",
            metadata_json={"priority": pr_result.review_priority, "files": pr_result.changed_files_count},
            timestamp=datetime.utcnow(),
        )
        db.add(usage)

        # Send in-app notification to all workspace members
        if job.workspace_id:
            members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == job.workspace_id).all()
            for m in members:
                # Review priority badge and regressions check
                regressions = 0
                if pr_result.diagnostics_delta:
                    regressions = len(pr_result.diagnostics_delta.new_findings)

                title = f"PR Autopsy: #{job.pr_number} in {job.repo_name}"
                msg = f"Analyzed with {pr_result.review_priority.upper()} priority (+{pr_result.additions}/-{pr_result.deletions} lines)."
                if regressions > 0:
                    msg += f" Alert: {regressions} diagnostic regression(s) detected."

                notif = Notification(
                    user_id=m.user_id,
                    title=title,
                    message=msg,
                    notification_type="pr_regression_detected" if regressions > 0 else "pr_autopsy_completed",
                    resource_url=f"/repositories/{base_analysis.id if base_analysis else 'unknown'}?pr={pr_result.id}",
                    resource_id=pr_result.id,
                    is_read=False,
                    created_at=datetime.utcnow(),
                )
                db.add(notif)

        db.commit()
        logger.info("Successfully completed analysis job %s for PR #%s", job_id, job.pr_number)
        return True

    except Exception as exc:
        logger.exception("Failed analysis job %s: %s", job_id, exc)
        job.retry_count += 1
        if job.retry_count < job.max_retries:
            job.status = "queued"  # Will be retried
            job.error_message = f"Retry {job.retry_count}/{job.max_retries}: {str(exc)}"
        else:
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = datetime.utcnow()

        db.commit()
        return False


def recover_stale_jobs(db: Session, lease_timeout_minutes: int = 10) -> int:
    """
    Finds running jobs whose lease has expired (e.g. worker crashed during execution).
    Re-queues them if within retry limits, or marks them failed if max retries exceeded.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=lease_timeout_minutes)
    stale_jobs = (
        db.query(AnalysisJob)
        .filter(
            AnalysisJob.status == "running",
            AnalysisJob.started_at <= cutoff,
        )
        .all()
    )

    recovered = 0
    for job in stale_jobs:
        job.retry_count += 1
        if job.retry_count < job.max_retries:
            job.status = "queued"
            job.error_message = f"Recovered from stalled execution (lease expired after {lease_timeout_minutes}m). Retrying ({job.retry_count}/{job.max_retries})."
            logger.warning(
                "Recovered stale job %s (attempt %d/%d)",
                job.id, job.retry_count, job.max_retries
            )
        else:
            job.status = "failed"
            job.error_message = f"Job crashed and exceeded max retries ({job.max_retries}). Marked as failed."
            job.completed_at = datetime.utcnow()
            logger.error(
                "Stale job %s failed after exceeding max retries (%d)",
                job.id, job.max_retries
            )
        recovered += 1

    if recovered > 0:
        db.commit()

    return recovered


def run_worker_loop(db: Session, max_jobs: int = 10, lease_timeout_minutes: int = 10) -> int:
    """
    Recovers stale jobs, scans for pending queued jobs, and executes them.
    Used by standalone worker process or cron.
    """
    # 1. Recover any stale leases from previous crashed workers
    recover_stale_jobs(db, lease_timeout_minutes=lease_timeout_minutes)

    # 2. Process queued jobs
    queued_jobs = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.status == "queued")
        .order_by(AnalysisJob.created_at.asc())
        .limit(max_jobs)
        .all()
    )

    processed_count = 0
    for job in queued_jobs:
        success = process_analysis_job(db, job.id)
        if success:
            processed_count += 1

    return processed_count
