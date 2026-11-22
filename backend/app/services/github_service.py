import io
import re
import zipfile
from pathlib import Path, PurePosixPath
import httpx
from app.core.config import settings

GITHUB_RE = re.compile(r"^https?://github\.com/([^/]+)/([^/#?]+?)(?:\.git)?/?(?:#.*)?$")
OWNER_RE = re.compile(r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$")
REPO_RE = re.compile(r"^[a-zA-Z0-9_.-]{1,100}$")


class GitHubError(Exception):
    pass


def parse_github_url(url: str) -> tuple[str, str]:
    match = GITHUB_RE.match(url.strip())
    if not match:
        raise GitHubError("Only public GitHub repository URLs are supported, e.g. https://github.com/owner/repository")
    owner, repo = match.group(1), match.group(2)
    if not OWNER_RE.match(owner) or not REPO_RE.match(repo) or repo in {".", ".."}:
        raise GitHubError("Invalid GitHub repository owner or repository name format.")
    return owner, repo


def headers() -> dict[str, str]:
    base = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "RepoLens/1.0"}
    if settings.github_token:
        base["Authorization"] = f"Bearer {settings.github_token}"
    return base


def get_github_api_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        settings.github_read_timeout,
        connect=settings.github_connect_timeout,
        read=settings.github_read_timeout,
        write=10.0,
        pool=10.0,
    )


def get_github_archive_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        settings.github_archive_timeout,
        connect=settings.github_connect_timeout,
        read=settings.github_archive_timeout,
        write=10.0,
        pool=10.0,
    )


def fetch_repository(owner: str, repo: str) -> dict:
    api_timeout = get_github_api_timeout()
    archive_timeout = get_github_archive_timeout()
    with httpx.Client(timeout=api_timeout, headers=headers(), follow_redirects=True) as client:
        try:
            response = client.get(f"https://api.github.com/repos/{owner}/{repo}", timeout=api_timeout)
            if response.status_code == 404:
                raise GitHubError("Repository was not found or is not accessible with the configured GitHub token.")
            response.raise_for_status()
            meta = response.json()
        except httpx.TimeoutException as exc:
            raise GitHubError("GitHub API request timed out while fetching repository metadata.") from exc
        except (httpx.ConnectError, httpx.NetworkError) as exc:
            raise GitHubError("Failed to connect to GitHub API. Please check your network connection.") from exc
        except httpx.HTTPStatusError as exc:
            raise GitHubError(f"GitHub API returned error: {exc.response.status_code}") from exc

        branch = meta.get("default_branch", "main")
        commit_sha = None
        try:
            commit_response = client.get(
                f"https://api.github.com/repos/{owner}/{repo}/commits/{branch}",
                timeout=api_timeout,
            )
            if commit_response.is_success:
                commit_sha = commit_response.json().get("sha")
        except (httpx.TimeoutException, httpx.RequestError):
            commit_sha = None

        try:
            archive = client.get(
                f"https://api.github.com/repos/{owner}/{repo}/zipball/{branch}",
                timeout=archive_timeout,
            )
            archive.raise_for_status()
        except httpx.TimeoutException as exc:
            raise GitHubError("GitHub request timed out while downloading repository archive.") from exc
        except (httpx.ConnectError, httpx.NetworkError) as exc:
            raise GitHubError("Failed to connect to GitHub while downloading repository archive.") from exc
        except httpx.HTTPStatusError as exc:
            raise GitHubError(f"GitHub archive download returned error: {exc.response.status_code}") from exc

        max_bytes = settings.max_repo_size_mb * 1024 * 1024
        if len(archive.content) > max_bytes:
            raise GitHubError(f"Repository archive exceeds the {settings.max_repo_size_mb} MB limit.")
        files = extract_safe_archive(archive.content)
        return {"meta": meta, "commit_sha": commit_sha, "files": files}


def extract_safe_archive(data: bytes) -> dict[str, str]:
    result: dict[str, str] = {}
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise GitHubError("GitHub returned an invalid repository archive.") from exc

    members = [m for m in zf.infolist() if not m.is_dir()]
    total_uncompressed = sum(m.file_size for m in members)
    if total_uncompressed > settings.max_repo_size_mb * 1024 * 1024 * 3:
        raise GitHubError("Repository archive expands beyond the configured safety limit.")
    if len(members) > settings.max_files:
        raise GitHubError(f"Repository contains more than {settings.max_files} files; analysis was stopped to protect the service.")

    for member in members:
        path = PurePosixPath(member.filename)
        parts = path.parts
        if not parts or ".." in parts or path.is_absolute():
            continue
        relative = "/".join(parts[1:]) if len(parts) > 1 else parts[0]
        if not relative or relative.startswith(".git/") or "/.git/" in relative:
            continue
        if member.file_size > settings.max_file_bytes:
            continue
        raw = zf.read(member)
        if b"\x00" in raw[:8192]:
            continue
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("utf-8", errors="ignore")
        result[relative] = text
    return result
