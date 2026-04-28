from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, Float, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class InterviewSession(Base):
    """
    A single mock interview session (Short-term Memory scope).
    After session ends, feedback is written to Long-term Memory.
    """
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_key: Mapped[str] = mapped_column(String(64), index=True, default="default")
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("target_roles.id"), nullable=True)

    interviewer_id: Mapped[str] = mapped_column(String(32), default="alex")
    interviewer_name: Mapped[str] = mapped_column(String(128), default="")
    interviewer_avatar: Mapped[str] = mapped_column(String(512), default="")
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending/active/completed
    transcript_consent: Mapped[bool] = mapped_column(Boolean, default=True)

    # New fields for frontend InterviewSession type
    duration: Mapped[int] = mapped_column(Integer, default=0)  # seconds
    overall_rating: Mapped[str] = mapped_column(String(32), default="")  # 'Good'/'Excellent'/'Needs Improvement'
    summary: Mapped[str] = mapped_column(Text, default="")

    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    messages: Mapped[list["InterviewMessage"]] = relationship("InterviewMessage", back_populates="session", cascade="all, delete-orphan")
    feedback: Mapped["InterviewFeedback | None"] = relationship("InterviewFeedback", back_populates="session", uselist=False, cascade="all, delete-orphan")
    role: Mapped["TargetRole"] = relationship("TargetRole", back_populates="interview_sessions")


class InterviewMessage(Base):
    """Individual messages in an interview session (Short-term Memory)."""
    __tablename__ = "interview_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("interview_sessions.id"))
    role: Mapped[str] = mapped_column(String(16))  # "ai" or "user"
    content: Mapped[str] = mapped_column(Text)
    question_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="messages")


class InterviewFeedback(Base):
    """
    Post-session feedback written to Long-term Memory.
    Scores along 3 real-time dimensions + overall.
    """
    __tablename__ = "interview_feedbacks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("interview_sessions.id"), unique=True)
    user_key: Mapped[str] = mapped_column(String(64), default="default")

    overall_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    improvements: Mapped[list] = mapped_column(JSON, default=list)
    recommended_actions: Mapped[list] = mapped_column(JSON, default=list)
    transcript: Mapped[str] = mapped_column(Text, default="")

    # Structured transcript items: [{question, answer, rating, feedback, note, timestamp}]
    transcript_items: Mapped[list] = mapped_column(JSON, default=list)

    # Dimension-level scores from this session (3 key dims assessed live)
    dimension_scores: Mapped[dict] = mapped_column(JSON, default=dict)
    # One sentence of evidence per dimension explaining the score. Stored
    # separately from dimension_scores so existing Layer-2 consumers
    # (compute_weakness_vector, aggregate_user_scores, dashboard) keep working
    # against the plain {dim_key: float} shape.
    dimension_evidence: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="feedback")


class WeaknessVector(Base):
    """
    Aggregated weakness profile (Long-term Memory).
    Updated after each session. Used to weight interview question generation.
    """
    __tablename__ = "weakness_vectors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, default="default")
    # {dim_key: weakness_weight (0-1, higher = weaker)}
    vector: Mapped[dict] = mapped_column(JSON, default=dict)
    # Questions asked across all sessions to avoid repeats
    questions_asked: Mapped[list] = mapped_column(JSON, default=list)
    # Preferred response style if detected
    preferred_style: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SavedQuestion(Base):
    """
    Questions saved from Mock Prep or Live Interview sessions.
    Displayed in the Question Bank view.
    """
    __tablename__ = "saved_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_key: Mapped[str] = mapped_column(String(64), index=True, default="default")
    role_id: Mapped[str] = mapped_column(String(64), index=True)  # string ID from frontend
    type: Mapped[str] = mapped_column(String(128), default="")  # e.g., 'Behavioral & Experience'
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(32), default="MOCK_PREP")
    chat_history: Mapped[list] = mapped_column(JSON, default=list)  # [{sender, text, quote?}]
    transcription: Mapped[str] = mapped_column(Text, default="")
    saved_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_modified: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
