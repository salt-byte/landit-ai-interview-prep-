from datetime import datetime
from pydantic import BaseModel, Field
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


# --- Transcript Item (matches frontend TranscriptItem type) ---

class TranscriptItemSchema(BaseModel):
    question: str
    answer: str
    rating: str = ""  # 'Strong' | 'Pass' | 'Needs improvement'
    feedback: str = ""
    note: Optional[str] = None
    timestamp: Optional[str] = None


# --- Interview Session Detail (for Interview Reports view) ---

class InterviewerInfo(BaseModel):
    name: str
    avatar: str


class InterviewSessionDetailResponse(BaseModel):
    id: str
    role_id: Optional[str] = None
    role_title: str = Field("", alias="roleTitle")
    company: str = ""
    date: str  # ISO string
    duration: int  # seconds
    interviewer: InterviewerInfo
    overall_rating: str = Field("", alias="overallRating")
    summary: str = ""
    strengths: list[str] = []
    improvements: list[str] = []
    transcript: list[TranscriptItemSchema] = []

    model_config = {"populate_by_name": True}


class InterviewFeedbackResponse(BaseModel):
    id: int
    session_id: int
    overall_score: float
    strengths: list[str]
    improvements: list[str]
    recommended_actions: list[str]
    transcript: str
    transcript_items: list[TranscriptItemSchema] = []
    dimension_scores: dict[str, float]
    created_at: datetime

    model_config = {"from_attributes": True}


class WSMessage(BaseModel):
    type: str  # "question" | "answer" | "next" | "end" | "feedback"
    content: str = ""
    question_index: Optional[int] = None
    total_questions: Optional[int] = None


# --- Saved Question (Question Bank) ---

class SavedQuestionCreate(BaseModel):
    role_id: str = Field(..., alias="roleId")
    type: str = ""
    question: str
    answer: Optional[str] = ""
    source: Optional[str] = "MOCK_PREP"
    chat_history: Optional[list] = Field([], alias="chatHistory")
    transcription: Optional[str] = ""

    model_config = {"populate_by_name": True}


class SavedQuestionUpdate(BaseModel):
    answer: Optional[str] = None
    chat_history: Optional[list] = Field(None, alias="chatHistory")
    transcription: Optional[str] = None

    model_config = {"populate_by_name": True}


class SavedQuestionResponse(BaseModel):
    id: str
    role_id: str = Field("", alias="roleId")
    type: str
    question: str
    answer: Optional[str] = ""
    source: Optional[str] = "MOCK_PREP"
    chat_history: Optional[list] = Field([], alias="chatHistory")
    transcription: Optional[str] = ""
    saved_at: str = Field("", alias="savedAt")
    last_modified: str = Field("", alias="lastModified")

    model_config = {"populate_by_name": True}
