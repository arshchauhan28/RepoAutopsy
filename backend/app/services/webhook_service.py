import hashlib
import hmac
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.workspace import ConnectedRepository, AutomationSettings
from app.models.automation import WebhookDelivery, AnalysisJob
from app.services.worker_service import process_analysis_job

logger = logging.getLogger(__name__)


def verify_github_signature(payload_bytes: bytes, signature_header: str | None) -> bool:
    webhook_secret = settings.github_webhook_secret
    if not webhook_secret:
        if settings.environment in ("development", "test"):
            logger.info("GitHub webhook secret not configured in dev/test mode; permitting unsigned payload.")
            return True
        return False

    if not signature_header:
        return False

    if not signature_header.startswith("sha256="):
        return False

    given_signature = signature_header[7:].strip()
    mac = hmac.new(webhook_secret.encode("utf-8"), msg=payload_bytes, digestmod=hashlib.sha256)
    expected_signature = mac.hexdigest()

    return hmac.compare_digest(expected_signature, given_signature)


def process_webhook_event(db: Session, delivery_id: str, event_type: str, payload: dict) -> dict:
    now = datetime.utcnow()

    # 1. Idempotency Check: Reject duplicate delivery IDs
    existing = db.query(WebhookDelivery).filter(WebhookDelivery.id == delivery_id).first()
    if existing:
        logger.info("Duplicate webhook delivery %s ignored (status: %s)", delivery_id, existing.status)
        return {
            "delivery_id": delivery_id,
            "status": "duplicate_ignored",
            "previous_status": existing.status,
        }

    delivery = WebhookDelivery(
        id=delivery_id,
        event_type=event_type,
        installation_id=str(payload.get("installation", {}).get("id")) if payload.get("installation") else None,
        repository_id=str(payload.get("repository", {}).get("id")) if payload.get("repository") else None,
        status="processing",
        payload_summary={
            "action": payload.get("action"),
            "repository": payload.get("repository", {}).get("full_name"),
            "sender": payload.get("sender", {}).get("login"),
        },
        received_at=now,
    )
    db.add(delivery)
    db.commit()

    jobs_created = []

    try:
        # Handle pull_request events
        if event_type == "pull_request":
            action = payload.get("action")
            pr_data = payload.get("pull_request", {})
            repo_data = payload.get("repository", {})

            owner = repo_data.get("owner", {}).get("login")
            repo_name = repo_data.get("name")
            pr_number = pr_data.get("number")
            base_sha = pr_data.get("base", {}).get("sha")
            head_sha = pr_data.get("head", {}).get("sha")

            if action in ("opened", "synchronize", "reopened") and owner and repo_name and pr_number:
                # Find connected repositories in any workspace
                connected_repos = db.query(ConnectedRepository).filter(
                    ConnectedRepository.owner.ilike(owner),
                    ConnectedRepository.repo_name.ilike(repo_name),
                ).all()

                for cr in connected_repos:
                    auto: AutomationSettings = cr.automation_settings
                    if not auto or not auto.is_enabled:
                        continue

                    # Check trigger permissions
                    if action == "opened" and not auto.analyze_on_pr_opened:
                        continue
                    if action == "synchronize" and not auto.analyze_on_pr_synchronize:
                        continue
                    if action == "reopened" and not auto.analyze_on_pr_reopened:
                        continue

                    # Idempotency check for pending or running job with identical head_sha
                    existing_job = db.query(AnalysisJob).filter(
                        AnalysisJob.connected_repo_id == cr.id,
                        AnalysisJob.pr_number == pr_number,
                        AnalysisJob.head_sha == head_sha,
                        AnalysisJob.status.in_(["queued", "running", "completed"]),
                    ).first()

                    if existing_job:
                        logger.info("Job already exists for PR #%s (head=%s) in repo %s", pr_number, head_sha, cr.id)
                        continue

                    job = AnalysisJob(
                        workspace_id=cr.workspace_id,
                        connected_repo_id=cr.id,
                        repo_owner=cr.owner,
                        repo_name=cr.repo_name,
                        job_type="pr_autopsy",
                        pr_number=pr_number,
                        base_sha=base_sha,
                        head_sha=head_sha,
                        status="queued",
                        retry_count=0,
                        max_retries=3,
                        created_at=now,
                    )
                    db.add(job)
                    db.flush()
                    jobs_created.append(job.id)

                    # Trigger worker immediately
                    try:
                        process_analysis_job(db, job.id)
                    except Exception as e:
                        logger.error("Error processing job %s: %s", job.id, e)

        # Handle installation events
        elif event_type in ("installation", "installation_repositories"):
            action = payload.get("action")
            inst_id = str(payload.get("installation", {}).get("id"))
            if action == "deleted":
                # Mark connected repositories access_required
                db.query(ConnectedRepository).filter(
                    ConnectedRepository.installation_id == inst_id
                ).update({"connection_status": "access_required"})

        delivery.status = "completed"
        delivery.processed_at = datetime.utcnow()
        db.commit()

        return {
            "delivery_id": delivery_id,
            "status": "completed",
            "jobs_created": jobs_created,
        }

    except Exception as e:
        logger.exception("Webhook processing failed for delivery %s: %s", delivery_id, e)
        delivery.status = "failed"
        delivery.error_message = str(e)
        delivery.processed_at = datetime.utcnow()
        db.commit()
        raise
