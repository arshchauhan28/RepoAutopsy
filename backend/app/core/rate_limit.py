import ipaddress
import time
from collections import defaultdict
from threading import Lock
from fastapi import HTTPException, Request, status
from app.core.config import settings

# In-memory sliding window store: { "bucket_key:client_ip": [timestamp1, timestamp2, ...] }
_hit_store: dict[str, list[float]] = defaultdict(list)
_store_lock = Lock()
_last_cleanup = time.time()

# Direct peers permitted to pass forwarded proxy headers
TRUSTED_PROXIES = {"127.0.0.1", "::1", "localhost", "testclient"}


def get_client_ip(request: Request) -> str:
    """
    Extract client IP address safely.
    Only inspects X-Forwarded-For or X-Real-IP if the immediate peer is a trusted proxy.
    Validates that the extracted IP is a syntactically valid IPv4/IPv6 address to prevent spoofing.
    """
    direct_host = request.client.host if request.client else "127.0.0.1"

    # Only trust forwarded headers if incoming connection originates from a trusted local reverse proxy
    if direct_host in TRUSTED_PROXIES:
        forwarded = request.headers.get("X-Forwarded-For")
        real_ip = request.headers.get("X-Real-IP")
        candidate = None

        if real_ip:
            candidate = real_ip.strip()
        elif forwarded:
            # Leftmost IP in forwarded chain represents original client
            candidate = forwarded.split(",")[0].strip()

        if candidate:
            try:
                # Validate syntax of IP address
                ipaddress.ip_address(candidate)
                return candidate
            except ValueError:
                # If spoofed/invalid format, ignore and fall back to direct peer
                pass

    return direct_host


def check_rate_limit(
    request: Request,
    scope: str,
    max_requests: int,
    window_seconds: int = 60,
):
    """
    Evaluates in-memory sliding window rate limit for the requesting client.
    Raises HTTPException 429 with Retry-After header when rate limit is exceeded.
    Disabled during automated testing.
    """
    if getattr(settings, "environment", "") == "testing":
        return

    client_ip = get_client_ip(request)
    now = time.time()
    cutoff = now - window_seconds
    bucket_key = f"{scope}:{client_ip}"

    global _last_cleanup
    with _store_lock:
        # Periodic cleanup of expired entries every 5 minutes
        if now - _last_cleanup > 300:
            for k in list(_hit_store.keys()):
                _hit_store[k] = [t for t in _hit_store[k] if t > cutoff]
                if not _hit_store[k]:
                    del _hit_store[k]
            _last_cleanup = now

        # Clean old timestamps for current client
        client_hits = [t for t in _hit_store[bucket_key] if t > cutoff]
        if len(client_hits) >= max_requests:
            retry_after = int(client_hits[0] + window_seconds - now) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {scope}. Please retry in {retry_after} seconds.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        client_hits.append(now)
        _hit_store[bucket_key] = client_hits
