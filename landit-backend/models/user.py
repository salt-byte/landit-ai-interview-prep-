from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, default="default")

    full_name: Mapped[str] = mapped_column(String(128), default="")
    profile_photo: Mapped[str] = mapped_column(Text, default="")
    target_role: Mapped[str] = mapped_column(String(256), default="")
    employment_type: Mapped[str] = mapped_column(String(64), default="")
    email: Mapped[str] = mapped_column(String(256), default="")
    phone_number: Mapped[str] = mapped_column(String(64), default="")
    location: Mapped[str] = mapped_column(String(128), default="")
    personal_website: Mapped[str] = mapped_column(String(512), default="")
    linkedin_profile: Mapped[str] = mapped_column(String(512), default="")

    # Skills
    skills_technical: Mapped[str] = mapped_column(Text, default="")
    skills_tools_and_technologies: Mapped[str] = mapped_column(Text, default="")
    skills_soft: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    education: Mapped[list["Education"]] = relationship("Education", back_populates="profile", cascade="all, delete-orphan")
    work_experience: Mapped[list["WorkExperience"]] = relationship("WorkExperience", back_populates="profile", cascade="all, delete-orphan")
    projects: Mapped[list["Project"]] = relationship("Project", back_populates="profile", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="profile", cascade="all, delete-orphan")


class Education(Base):
    __tablename__ = "educations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_profiles.id"))
    institution_name: Mapped[str] = mapped_column(String(256), default="")
    degree: Mapped[str] = mapped_column(String(64), default="")
    field_of_study: Mapped[str] = mapped_column(String(128), default="")
    start_date: Mapped[str] = mapped_column(String(32), default="")
    end_date: Mapped[str] = mapped_column(String(32), default="")
    gpa: Mapped[str] = mapped_column(String(16), default="")
    relevant_coursework: Mapped[str] = mapped_column(Text, default="")
    additional_details: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="education")


class WorkExperience(Base):
    __tablename__ = "work_experiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_profiles.id"))
    company_name: Mapped[str] = mapped_column(String(256), default="")
    job_title: Mapped[str] = mapped_column(String(128), default="")
    start_date: Mapped[str] = mapped_column(String(32), default="")
    end_date: Mapped[str] = mapped_column(String(32), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="work_experience")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_profiles.id"))
    project_name: Mapped[str] = mapped_column(String(256), default="")
    project_description: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[str] = mapped_column(String(32), default="")
    end_date: Mapped[str] = mapped_column(String(32), default="")
    project_link: Mapped[str] = mapped_column(String(512), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="projects")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_profiles.id"))
    name: Mapped[str] = mapped_column(String(256))
    type: Mapped[str] = mapped_column(String(64), default="Notes")
    file_path: Mapped[str] = mapped_column(String(512), default="")
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    mime_type: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="documents")
