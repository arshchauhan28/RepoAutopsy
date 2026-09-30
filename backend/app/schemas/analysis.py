from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class AnalysisCreate(BaseModel):
    github_url: HttpUrl


class FindingOut(BaseModel):
    id: str
    category: str
    severity: str
    title: str
    description: str
    file_path: str | None = None
    line: int | None = None
    recommendation: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AnalysisOut(BaseModel):
    id: str
    github_url: str
    owner: str
    repo_name: str
    default_branch: str | None
    commit_sha: str | None
    status: str
    error: str | None
    summary: str | None
    architecture: dict | None
    metrics: dict | None
    file_tree: list | None
    languages: dict | None
    ai_insights: dict | None
    created_at: datetime
    findings: list[FindingOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
