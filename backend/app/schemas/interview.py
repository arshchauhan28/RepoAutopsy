from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Any


class StartInterviewRequest(BaseModel):
    question_count: int = Field(default=10, ge=3, le=30)
    assessment_type: str = Field(default="complete")  # "complete" | "component" | "team"
    scope_type: str = Field(default="complete")  # "complete" | "component"
    selected_components: list[str] | None = None
    difficulty: str = Field(default="intermediate")  # "beginner" | "intermediate" | "advanced"
    hackathon_mode: bool = False
    hackathon_context: dict[str, Any] | None = None


class StartAssessmentRequest(BaseModel):
    assessment_type: str = "complete"  # "complete" | "component"
    scope_type: str = "complete"
    selected_components: list[str] | None = None
    difficulty: str = "intermediate"
    question_count: int = Field(default=10, ge=3, le=30)
    hackathon_mode: bool = False
    hackathon_context: dict[str, Any] | None = None
    participant_name: str | None = None
    mode: str = "assessment"  # "assessment" | "practice"
    parent_session_id: str | None = None


class AnswerRequest(BaseModel):
    answer: str | None = Field(default=None, max_length=15000)
    selected_option: int | None = None
    question_index: int | None = None


class TurnOut(BaseModel):
    id: str
    question_index: int
    question: str
    question_type: str = "short_answer"
    category: str = "architecture"
    difficulty: str = "intermediate"
    options: list[str] | None = None
    code_snippet: str | None = None
    relevant_files: list[str] | None = None
    selected_option: int | None = None
    answer: str | None = None
    earned_score: int | None = None
    max_score: int = 100
    evaluation: dict[str, Any] | None = None
    explanation: str | None = None
    evidence_confidence: str | None = "high"
    retry_count: int = 0
    user_notes: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def mask_unanswered_turn_data(self) -> "TurnOut":
        """
        SEC-01: Prevent leakage of answers, rubrics, and explanations
        before the candidate has answered and been evaluated on this turn.
        """
        if self.earned_score is None:
            self.explanation = None
            self.evaluation = None
        return self


class BatchAnswerItem(BaseModel):
    question_index: int
    answer: str | None = Field(default=None, max_length=15000)
    selected_option: int | None = None


class BatchSubmitRequest(BaseModel):
    answers: list[BatchAnswerItem]


class InterviewOut(BaseModel):
    id: str
    analysis_id: str
    status: str
    current_index: int
    score: int | None
    feedback: dict[str, Any] | None
    assessment_type: str = "complete"
    scope_type: str = "complete"
    selected_components: list[str] | None = None
    difficulty: str = "intermediate"
    question_count: int = 10
    evaluation_mode: str = "deterministic"
    category_scores: dict[str, Any] | None = None
    participant_name: str | None = None
    team_session_id: str | None = None
    team_member_id: str | None = None
    hackathon_mode: int = 0
    hackathon_context: dict[str, Any] | None = None
    mode: str = "assessment"
    knowledge_gaps: list[dict[str, Any]] | None = None
    parent_session_id: str | None = None
    comparison_data: dict[str, Any] | None = None
    turns: list[TurnOut]

    model_config = ConfigDict(from_attributes=True)


class InterviewCreationOut(InterviewOut):
    """
    SEC-02: Returned ONLY upon explicit authorized assessment creation.
    Exposes the newly minted session_token to the participant so they can store it.
    Generic GET responses return InterviewOut which never includes session_token.
    """
    session_token: str | None = None


class JoinTeamResponse(BaseModel):
    team_session_id: str
    member_id: str
    assessment_session_id: str
    session_token: str | None = None
    status: str


# Team Assessment Schemas
class TeamMemberSlot(BaseModel):
    display_name: str
    assigned_role: str | None = None
    assigned_components: list[str] = ["complete"]
    difficulty: str = "intermediate"
    question_count: int = Field(default=10, ge=3, le=30)


class CreateTeamSessionRequest(BaseModel):
    analysis_id: str
    team_name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    is_hackathon_mode: bool = False
    hackathon_context: dict[str, Any] | None = None
    members: list[TeamMemberSlot] = []


class JoinTeamRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    member_id: str | None = None


# Sprint 2 CodeVitals 3.0 Learning, Practice, Retake & Sharing Schemas
class PracticeRetryRequest(BaseModel):
    selected_option: int | None = None
    answer: str | None = Field(default=None, max_length=15000)
    user_notes: str | None = Field(default=None, max_length=5000)


class RetakeAssessmentRequest(BaseModel):
    difficulty: str = "intermediate"
    question_count: int = Field(default=10, ge=3, le=30)
    target_weak_areas: bool = True
    participant_name: str | None = None


class KnowledgeGapDetail(BaseModel):
    category: str
    component: str | None = None
    title: str
    description: str
    missing_concepts: list[str] = []
    supporting_files: list[str] = []
    actionable_recommendation: str
    suggested_review_topics: list[str] = []


class ShareableReportOut(BaseModel):
    """
    SEC-SAFE: Authorized public/export summary.
    Omits session_token, organizer_token, secret rubrics, and raw credentials.
    """
    repository_name: str
    assessment_id: str
    assessment_type: str
    scope_type: str
    selected_components: list[str] | None = None
    difficulty: str
    overall_score: int | None = None
    category_scores: dict[str, Any] | None = None
    total_questions: int
    completed_questions: int
    completion_date: str | None = None
    strengths: list[str] = []
    knowledge_gaps: list[dict[str, Any]] = []
    coverage_limitations: str | None = None
    is_team: bool = False
    team_name: str | None = None
    team_coverage_matrix: list[dict[str, Any]] | None = None
    team_readiness_summary: str | None = None
    hackathon_insights: list[str] = []
