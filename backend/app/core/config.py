from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "RepoAutopsy API"
    environment: str = "development"
    database_url: str = "sqlite:///./repolens.db"
    frontend_url: str = "http://localhost:3000"
    backend_url: str | None = None
    github_token: str | None = None
    github_client_id: str | None = None
    github_client_secret: str | None = None
    github_app_id: str | None = None
    github_app_private_key: str | None = None
    github_webhook_secret: str | None = None
    session_secret: str = "insecure-dev-session-secret-change-in-production-repoautopsy"
    session_cookie_name: str = "repoautopsy_session"
    session_expire_days: int = 14
    ai_api_key: str | None = None
    ai_base_url: str | None = None
    ai_model: str = "openai/gpt-oss-20b"
    max_repo_size_mb: int = 40
    max_files: int = 2500
    max_file_bytes: int = 750_000
    analysis_timeout_seconds: int = 90
    analyzer_version: str = "2.2.0"
    github_connect_timeout: float = 10.0
    github_read_timeout: float = 30.0
    github_archive_timeout: float = 60.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    def validate_production_settings(self) -> list[str]:
        """
        Validates critical configuration parameters when running in production mode.
        Returns a list of validation error messages.
        """
        errors: list[str] = []
        if self.environment.lower() == "production":
            if not self.session_secret or "insecure-dev" in self.session_secret or len(self.session_secret) < 32:
                errors.append("SESSION_SECRET must be set to a secure secret of at least 32 characters in production.")
            if self.frontend_url == "http://localhost:3000":
                errors.append("FRONTEND_URL must be configured to the production domain, not localhost.")
            if not self.github_client_id or not self.github_client_secret:
                errors.append("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required in production for GitHub OAuth.")
        return errors


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
