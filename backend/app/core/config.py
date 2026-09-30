from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "RepoAutopsy API"
    environment: str = "development"
    database_url: str = "sqlite:///./repolens.db"
    frontend_url: str = "http://localhost:3000"
    github_token: str | None = None
    ai_api_key: str | None = None
    ai_base_url: str | None = None
    ai_model: str = "gpt-4o-mini"
    max_repo_size_mb: int = 40
    max_files: int = 2500
    max_file_bytes: int = 750_000
    analysis_timeout_seconds: int = 90

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
