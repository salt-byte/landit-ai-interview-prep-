from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class InterviewQuestionItem(BaseModel):
    text: str
    notes: Optional[str] = None


class TargetRoleCreate(BaseModel):
    title: str
    company: str
    jd: str = ""
    team_info: str = Field("", alias="teamInfo")
    # New v3 fields
    location: str = ""
    employment_type: str = Field("", alias="employmentType")
    key_responsibilities: str = Field("", alias="keyResponsibilities")
    qualifications: str = ""
    company_overview: str = Field("", alias="companyOverview")
    team_overview: str = Field("", alias="teamOverview")
    additional_info: str = Field("", alias="additionalInfo")
    interview_questions_list: list[InterviewQuestionItem] = Field([], alias="interviewQuestionsList")
    general_notes: str = Field("", alias="generalNotes")
    preparation_notes: str = Field("", alias="preparationNotes")
    insights: str = ""
    # Legacy fields
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
    teamInfo: str = ""
    # New v3 fields
    location: str = ""
    employmentType: str = ""
    keyResponsibilities: str = ""
    qualifications: str = ""
    companyOverview: str = ""
    teamOverview: str = ""
    additionalInfo: str = ""
    interviewQuestionsList: list[InterviewQuestionItem] = []
    generalNotes: str = ""
    preparationNotes: str = ""
    insights: str = ""
    # Legacy
    companyBackground: str = ""
    teamBackground: str = ""
    additionalNotes: str = ""
    interviewQuestions: list[str] = []
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
    required_score: float
    weight: float


class RoleDimensionModelResponse(BaseModel):
    role_id: int
    version: int
    is_user_edited: bool
    dimensions: dict[str, DimensionDetail]

    model_config = {"from_attributes": True}


class RoleDimensionModelUpdate(BaseModel):
    dimensions: dict[str, DimensionDetail]
