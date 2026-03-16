from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class UserDimensionScore(Base):
    """
    Aggregated user ability score per dimension (Long-term Memory).
    Updated after each interview session ends.
    """
    __tablename__ = "user_dimension_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_key: Mapped[str] = mapped_column(String(64), index=True, default="default")
    dimension: Mapped[str] = mapped_column(String(64))  # one of DIMENSIONS
    score: Mapped[float] = mapped_column(Float, default=0.0)  # 1.0 - 5.0
    confidence: Mapped[str] = mapped_column(String(32), default="inferred")  # confirmed/inferred/mentioned
    evidence: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GapSnapshot(Base):
    """
    Snapshot of gap matrix at a point in time (per role version).
    gap = required_score - user_score per dimension.
    """
    __tablename__ = "gap_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("target_roles.id"))
    user_key: Mapped[str] = mapped_column(String(64), default="default")
    match_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100%
    # {dim_key: {user_score, required_score, weight, gap}}
    gap_data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    role: Mapped["TargetRole"] = relationship("TargetRole", back_populates="gap_snapshots")
