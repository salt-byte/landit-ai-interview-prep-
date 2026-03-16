from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class EducationSchema(BaseModel):
    id: Optional[str] = None
    school: str = ""
    degree: str = ""
    major: str = ""
    year: str = ""
    key_coursework: str = Field("", alias="keyCoursework")
    academic_focus: Optional[str] = Field("", alias="academicFocus")

    model_config = {"populate_by_name": True}


class ExperienceSchema(BaseModel):
    id: Optional[str] = None
    company: str = ""
    role: str = ""
    type: str = "Full-time"
    duration: str = ""
    responsibilities: str = ""

    model_config = {"populate_by_name": True}


class ProjectSchema(BaseModel):
    id: Optional[str] = None
    name: str = ""
    context: str = ""
    role: str = ""
    tools: str = ""
    outcome: str = ""
    learnings: Optional[str] = ""

    model_config = {"populate_by_name": True}


class UserSkillsSchema(BaseModel):
    technical: str = ""
    product: str = ""
    communication: str = ""


class UserProfileUpdate(BaseModel):
    name: str = ""
    headline: str = ""
    bio: str = ""
    avatar: Optional[str] = ""
    target_roles: str = Field("", alias="targetRoles")
    location: str = ""
    education_level: str = Field("", alias="educationLevel")
    years_of_experience: str = Field("", alias="yearsOfExperience")
    education: list[EducationSchema] = []
    experience: list[ExperienceSchema] = []
    projects: list[ProjectSchema] = []
    skills: UserSkillsSchema = UserSkillsSchema()
    interests: str = ""

    model_config = {"populate_by_name": True}


class UserProfileResponse(BaseModel):
    id: int
    name: str
    headline: str
    bio: str
    avatar: str
    targetRoles: str
    location: str
    educationLevel: str
    yearsOfExperience: str
    education: list[EducationSchema]
    experience: list[ExperienceSchema]
    projects: list[ProjectSchema]
    skills: UserSkillsSchema
    interests: str
    completion_percentage: int = 0

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: str
    name: str
    type: str
    date: str
    file_size: Optional[int] = None

    model_config = {"from_attributes": True}
