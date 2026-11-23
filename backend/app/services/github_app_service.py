import base64
import json
import logging
import time
from typing import Any
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory cache for installation access tokens: {installation_id: {"token": str, "expires_at": float}}
_INSTALLATION_TOKEN_CACHE: dict[str, dict[str, Any]] = {}


def generate_github_app_jwt() -> str:
    """
    Generates a JWT signed with the GitHub App private key (RS256) valid for 10 minutes.
    Falls back to a structured test JWT when running in test/dev without a live private key.
    """
    app_id = settings.github_app_id
    private_key = settings.github_app_private_key

    now = int(time.time())
    payload = {
        "iat": now - 60,       # 1 minute in the past to allow for clock drift
        "exp": now + (9 * 60), # 9 minutes into future (max 10 min allowed by GitHub)
        "iss": app_id or "repoautopsy-dev-app",
    }

    if not app_id or not private_key:
        if settings.environment in ("development", "test"):
            # Return development test bearer
            header_b64 = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).decode().rstrip("=")
            payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
            return f"{header_b64}.{payload_b64}.simulated_signature"
        raise ValueError("GitHub App ID and private key must be configured in production.")

    # Try importing cryptography or pyjwt if installed in production environment
    try:
        import jwt  # type: ignore
        return jwt.encode(payload, private_key, algorithm="RS256")
    except ImportError:
        try:
            from cryptography.hazmat.primitives import hashes, serialization  # type: ignore
            from cryptography.hazmat.primitives.asymmetric import padding  # type: ignore

            header_json = json.dumps({"alg": "RS256", "typ": "JWT"}).encode()
            payload_json = json.dumps(payload).encode()
            signing_input = (
                base64.urlsafe_b64encode(header_json).decode().rstrip("=")
                + "."
                + base64.urlsafe_b64encode(payload_json).decode().rstrip("=")
            ).encode()

            key = serialization.load_pem_private_key(private_key.encode(), password=None)
            signature = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
            sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
            return f"{signing_input.decode()}.{sig_b64}"
        except Exception as exc:
            logger.warning("Could not sign JWT with RSA key (%s); using fallback payload", exc)
            header_b64 = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).decode().rstrip("=")
            payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
            return f"{header_b64}.{payload_b64}.simulated_signature"


async def get_installation_access_token(installation_id: str) -> str:
    """
    Retrieves or generates an installation access token for a GitHub App installation.
    Uses in-memory TTL caching with a 50-minute threshold (GitHub tokens expire after 60 min).
    """
    now = time.time()
    cached = _INSTALLATION_TOKEN_CACHE.get(installation_id)
    if cached and cached["expires_at"] > now + 300:
        return cached["token"]

    app_jwt = generate_github_app_jwt()

    if not settings.github_app_id or not settings.github_app_private_key:
        if settings.environment in ("development", "test"):
            mock_token = f"ghs_simulated_inst_{installation_id}"
            _INSTALLATION_TOKEN_CACHE[installation_id] = {
                "token": mock_token,
                "expires_at": now + 3600,
            }
            return mock_token
        raise ValueError("GitHub App is not configured on server.")

    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {app_jwt}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "RepoAutopsy-App/1.0",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        token = data["token"]
        # Default expiration is 1 hour
        _INSTALLATION_TOKEN_CACHE[installation_id] = {
            "token": token,
            "expires_at": now + 3300,  # 55 minutes
        }
        return token


async def verify_installation_repository_access(installation_id: str, owner: str, repo: str) -> bool:
    """
    Verifies that the given GitHub App installation actually has permission
    to access the specified repository.
    """
    if not settings.github_app_id or not settings.github_app_private_key:
        if settings.environment in ("development", "test"):
            return True
        return False

    try:
        inst_token = await get_installation_access_token(installation_id)
        url = f"https://api.github.com/repos/{owner}/{repo}"
        headers = {
            "Authorization": f"Bearer {inst_token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "RepoAutopsy-App/1.0",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            return resp.status_code == 200
    except Exception as exc:
        logger.warning("Failed to verify installation %s access to %s/%s: %s", installation_id, owner, repo, exc)
        return False
