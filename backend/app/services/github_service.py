import io
import re
import zipfile
from pathlib import Path, PurePosixPath
import httpx
from app.core.config import settings

GITHUB_RE = re.compile(r"^https?://github\.com/([^/]+)/([^/#?]+?)(?:\.git)?/?(?:#.*)?$")


class GitHubError(Exception):
    pass


def parse_github_url(url: str) -> tuple[str, str]:
    match = GITHUB_RE.match(url.strip())
    if not match:
        raise GitHubError("Only public GitHub repository URLs are supported, e.g. https://github.com/owner/repository")
    return match.group(1), match.group(2)


def headers() -> dict[str, str]:
    base = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "RepoLens/1.0"}
    if settings.github_token:
        base["Authorization"] = f"Bearer {settings.github_token}"
    return base


def fetch_repository(owner: str, repo: str) -> dict:
    timeout = httpx.Timeout(30.0, connect=10.0)
    with httpx.Client(timeout=timeout, headers=headers(), follow_redirects=True) as client:
        response = client.get(f"https://api.github.com/repos/{owner}/{repo}")
        if response.status_code == 404:
            raise GitHubError("Repository was not found or is not accessible with the configured GitHub token.")
        response.raise_for_status()
        meta = response.json()

        branch = meta.get("default_branch", "main")
        commit_sha = None
        commit_response = client.get(f"https://api.github.com/repos/{owner}/{repo}/commits/{branch}")
        if commit_response.is_success:
            commit_sha = commit_response.json().get("sha")

        archive = client.get(f"https://api.github.com/repos/{owner}/{repo}/zipball/{branch}")
        archive.raise_for_status()
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
