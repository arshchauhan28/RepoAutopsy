import logging
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.webhook_service import verify_github_signature, process_webhook_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/github/webhooks", tags=["webhooks"])


@router.post("")
async def receive_github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_github_delivery: str | None = Header(None),
    x_github_event: str | None = Header(None),
    x_hub_signature_256: str | None = Header(None),
):
    # 1. Validate payload delivery headers
    delivery_id = x_github_delivery
    if not delivery_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-GitHub-Delivery header.",
        )

    event_type = x_github_event or "ping"

    # 2. Verify HMAC SHA-256 Signature (timing-safe)
    body_bytes = await request.body()
    if not verify_github_signature(body_bytes, x_hub_signature_256):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid GitHub webhook signature.",
        )

    # 3. Handle ping
    if event_type == "ping":
        return {"status": "ok", "message": "Pong from RepoAutopsy"}

    # 4. Parse JSON payload
    try:
        payload = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON webhook payload.")

    # 5. Process event idempotently
    result = process_webhook_event(db, delivery_id, event_type, payload)
    return result
