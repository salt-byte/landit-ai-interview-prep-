from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, Float, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class TargetRole(Base):
    __tablename__ = "target_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_key: Mapped[str] = mapped_column(String(64), index=True, default="default")

    title: Mapped[str] = mapped_column(String(256))
    company: Mapped[str] = mapped_column(String(256))
    jd: Mapped[str] = mapped_column(Text, default="")
    team_info: Mapped[str] = mapped_column(String(256), default="")
    company_background: Mapped[str] = mapped_column(Text, default="")
    team_background: Mapped[str] = mapped_column(Text, default="")
    additional_notes: Mapped[str] = mapped_column(Text, default="")

    # Interview questions stored as JSON array
    interview_questions: Mapped[list] = mapped_column(JSON, default=list)

    # Generated content - stored after AI generation
    prep_content: Mapped[str] = mapped_column(Text, default="")
    prep_version: Mapped[int] = mapped_column(Integer, default=0)
    is_prep_user_edited: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sources: Mapped[list["RoleSource"]] = relationship("RoleSource", back_populates="role", cascade="all, delete-orphan")
    dimension_model: Mapped["RoleDimensionModel | None"] = relationship("RoleDimensionModel", back_populates="role", uselist=False, cascade="all, delete-orphan")
    gap_snapshots: Mapped[list["GapSnapshot"]] = relationship("GapSnapshot", back_populates="role", cascade="all, delete-orphan")
    interview_sessions: Mapped[list["InterviewSession"]] = relationship("InterviewSession", back_populates="role", cascade="all, delete-orphan")


class RoleSource(Base):
    __tablename__ = "role_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("target_roles.id"))
    name: Mapped[str] = mapped_column(String(512))
    type: Mapped[str] = mapped_column(String(64))  # Link / PDF Document / etc.
    file_path: Mapped[str] = mapped_column(String(512), default="")
    extracted_content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    role: Mapped["TargetRole"] = relationship("TargetRole", back_populates="sources")


class RoleDimensionModel(Base):
    """
    Required dimension scores + weights for a target role (JD → 15 dims).
    Σ(weights) normalized to 1.0 on write.
    """
    __tablename__ = "role_dimension_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("target_roles.id"), unique=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_user_edited: Mapped[bool] = mapped_column(Boolean, default=False)

    # Stored as JSON: {dim_key: {required_score: float, weight: float}}
    dimensions: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role: Mapped["TargetRole"] = relationship("TargetRole", back_populates="dimension_model")
