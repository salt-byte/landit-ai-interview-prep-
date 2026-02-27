from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class TargetRoleCreate(BaseModel):
    title: str
    company: str
    jd: str
    team_info: str = Field("", alias="teamInfo")
    company_background: str = Field("", alias="companyBackground")
    team_background: str = Field("", alias="teamBackground")
    additional_notes: str = Field("", alias="additionalNotes")
    interview_questions: list[str] = Field([], alias="interviewQuestions")

    model_config = {"populate_by_name": True}


class TargetRoleUpdate(TargetRoleCreate):
    pass


class RoleSourceResponse(BaseModel):
    id: str
    name: str
    type: str
    date: str

    model_config = {"from_attributes": True}


class TargetRoleResponse(BaseModel):
    id: str
    title: str
    company: str
    jd: str
    teamInfo: str
    companyBackground: str
    teamBackground: str
    additionalNotes: str
    interviewQuestions: list[str]
    sources: list[RoleSourceResponse] = []

    model_config = {"from_attributes": True}


class ParseLinkRequest(BaseModel):
    url: str


class ParseLinkResponse(BaseModel):
    title: str
    company: str
    jd: str
    team_info: str = ""


class DimensionDetail(BaseModel):
    required_score: float  # 1-5
    weight: float          # normalized, Σ=1


class RoleDimensionModelResponse(BaseModel):
    role_id: int
    version: int
    is_user_edited: bool
    dimensions: dict[str, DimensionDetail]

    model_config = {"from_attributes": True}


class RoleDimensionModelUpdate(BaseModel):
    dimensions: dict[str, DimensionDetail]
