from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class AnalyzePRRequest(BaseModel):
    url: str = Field(..., description="GitHub Pull Request URL, e.g. https://github.com/owner/repo/pull/123")
    repository_id: str | None = Field(None, description="Optional existing repository analysis ID to link with")


class PRChangedFileOut(BaseModel):
    filename: str
    previous_filename: str | None = None
    status: str = "modified"  # modified, added, removed, renamed
    additions: int = 0
    deletions: int = 0
    changes: int = 0
    patch: str | None = None
    is_binary: bool = False
    is_truncated: bool = False
    component_id: str | None = None
    component_name: str | None = None


class PRChangeImpactOut(BaseModel):
    affected_component_id: str
    affected_component_name: str
    impact_type: str  # direct, downstream_consumer, contract_risk, test_impact
    confidence: str = "high"  # high, medium, low
    relevant_changed_file: str
    dependency_evidence: str
    explanation: str


class DiagnosticsDeltaFinding(BaseModel):
    fingerprint: str
    title: str
    category: str
    severity: str
    file_path: str | None = None
    line: int | None = None
    description: str
    status: str = "new"  # new, resolved, unchanged


class DiagnosticsDeltaOut(BaseModel):
    new_findings: list[DiagnosticsDeltaFinding] = []
    resolved_findings: list[DiagnosticsDeltaFinding] = []
    unchanged_findings: list[DiagnosticsDeltaFinding] = []
    new_high_severity_count: int = 0
    resolved_count: int = 0


class ArchitectureDeltaOut(BaseModel):
    added_modules: list[str] = []
    removed_modules: list[str] = []
    new_dependencies: list[dict[str, Any]] = []
    new_circular_cycles: list[list[str]] = []
    resolved_circular_cycles: list[list[str]] = []
    changed_service_boundaries: list[str] = []


class TestRecommendationOut(BaseModel):
    category: str
    target_module: str
    recommended_test_files: list[str] = []
    rationale: str


class PullRequestAnalysisOut(BaseModel):
    id: str
    analysis_id: str | None = None
    repo_owner: str
    repo_name: str
    pr_number: int
    pr_title: str
    pr_description: str | None = None
    pr_author: str | None = None
    base_branch: str
    head_branch: str
    base_sha: str
    head_sha: str
    status: str
    changed_files_count: int = 0
    additions: int = 0
    deletions: int = 0
    review_priority: str = "low"  # high, medium, low
    review_priority_reasons: list[str] = []
    summary: dict[str, Any] | None = None
    changed_files: list[dict[str, Any]] = []
    change_impacts: list[dict[str, Any]] = []
    architecture_delta: dict[str, Any] | None = None
    diagnostics_delta: dict[str, Any] | None = None
    test_recommendations: list[dict[str, Any]] = []
    limitations: list[str] = []
    created_at: datetime
    completed_at: datetime | None = None

    class Config:
        from_attributes = True
