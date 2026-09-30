from pydantic import BaseModel, ConfigDict, Field


class StartInterviewRequest(BaseModel):
    question_count: int = Field(default=8, ge=3, le=12)


class AnswerRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=10000)


class TurnOut(BaseModel):
    id: str
    question_index: int
    question: str
    answer: str | None
    evaluation: dict | None

    model_config = ConfigDict(from_attributes=True)


class InterviewOut(BaseModel):
    id: str
    analysis_id: str
    status: str
    current_index: int
    score: int | None
    feedback: dict | None
    turns: list[TurnOut]

    model_config = ConfigDict(from_attributes=True)
