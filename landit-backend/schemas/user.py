from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class EducationSchema(BaseModel):
    id: Optional[str] = None
    institution_name: str = Field("", alias="institutionName")
    degree: str = ""
    field_of_study: str = Field("", alias="fieldOfStudy")
    start_date: str = Field("", alias="startDate")
    end_date: str = Field("", alias="endDate")
    gpa: str = ""
    relevant_coursework: str = Field("", alias="relevantCoursework")
    additional_details: str = Field("", alias="additionalDetails")

    model_config = {"populate_by_name": True}


class WorkExperienceSchema(BaseModel):
    id: Optional[str] = None
    company_name: str = Field("", alias="companyName")
    job_title: str = Field("", alias="jobTitle")
    start_date: str = Field("", alias="startDate")
    end_date: str = Field("", alias="endDate")
    description: str = ""

    model_config = {"populate_by_name": True}


class ProjectSchema(BaseModel):
    id: Optional[str] = None
    project_name: str = Field("", alias="projectName")
    project_description: str = Field("", alias="projectDescription")
    start_date: str = Field("", alias="startDate")
    end_date: str = Field("", alias="endDate")
    project_link: str = Field("", alias="projectLink")

    model_config = {"populate_by_name": True}


class UserSkillsSchema(BaseModel):
    technical_skills: str = Field("", alias="technicalSkills")
    tools_and_technologies: str = Field("", alias="toolsAndTechnologies")
    soft_skills: str = Field("", alias="softSkills")

    model_config = {"populate_by_name": True}


class UserProfileUpdate(BaseModel):
    full_name: str = Field("", alias="fullName")
    profile_photo: str = Field("", alias="profilePhoto")
    target_role: str = Field("", alias="targetRole")
    employment_type: str = Field("", alias="employmentType")
    email: str = ""
    phone_number: str = Field("", alias="phoneNumber")
    location: str = ""
    personal_website: str = Field("", alias="personalWebsite")
    linkedin_profile: str = Field("", alias="linkedInProfile")
    education: list[EducationSchema] = []
    work_experience: list[WorkExperienceSchema] = Field([], alias="workExperience")
    projects: list[ProjectSchema] = []
    skills: UserSkillsSchema = UserSkillsSchema()

    model_config = {"populate_by_name": True}


class UserProfileResponse(BaseModel):
    id: int
    fullName: str = ""
    profilePhoto: str = ""
    targetRole: str = ""
    employmentType: str = ""
    email: str = ""
    phoneNumber: str = ""
    location: str = ""
    personalWebsite: str = ""
    linkedInProfile: str = ""
    education: list[EducationSchema] = []
    workExperience: list[WorkExperienceSchema] = []
    projects: list[ProjectSchema] = []
    skills: UserSkillsSchema = UserSkillsSchema()
    completion_percentage: int = 0

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: str
    name: str
    type: str
    date: str
    file_size: Optional[int] = None

    model_config = {"from_attributes": True}
