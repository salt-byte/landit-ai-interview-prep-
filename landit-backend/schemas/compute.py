from pydantic import BaseModel
from typing import Optional


class DimensionGap(BaseModel):
    dimension: str
    label: str
    user_score: float
    required_score: float
    weight: float
    gap: float  # required - user (positive = deficit)


class GapMatrixResponse(BaseModel):
    role_id: int
    match_score: float  # 0-100
    gaps: list[DimensionGap]
    snapshot_id: int


class AbilityCurvePoint(BaseModel):
    date: str
    session_id: int
    dimension_scores: dict[str, float]
    overall_score: float


class WeaknessVectorResponse(BaseModel):
    vector: dict[str, float]  # dim_key -> weakness weight 0-1
    questions_asked_count: int
    preferred_style: str


class PrepGenerateRequest(BaseModel):
    mode: str = "QA"  # "QUESTIONS" or "QA"
    categories: list[str] = ["fundamentals", "business", "case", "behavioral", "technical"]


class PrepChatRequest(BaseModel):
    message: str
    current_content: str
