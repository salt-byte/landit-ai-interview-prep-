from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class InterviewSessionCreate(BaseModel):
    role_id: Optional[int] = None
    interviewer_id: str = "alex"
    transcript_consent: bool = True


class InterviewSessionResponse(BaseModel):
    id: int
    role_id: Optional[int]
    interviewer_id: str
    status: str
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewFeedbackResponse(BaseModel):
    id: int
    session_id: int
    overall_score: float
    strengths: list[str]
    improvements: list[str]
    recommended_actions: list[str]
    transcript: str
    dimension_scores: dict[str, float]
    created_at: datetime

    model_config = {"from_attributes": True}


class WSMessage(BaseModel):
    type: str  # "question" | "answer" | "next" | "end" | "feedback"
    content: str = ""
    question_index: Optional[int] = None
    total_questions: Optional[int] = None
