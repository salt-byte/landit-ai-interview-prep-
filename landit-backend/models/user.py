from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # In a real app, this would link to an auth User table
    user_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, default="default")

    name: Mapped[str] = mapped_column(String(128), default="")
    headline: Mapped[str] = mapped_column(String(256), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    avatar_url: Mapped[str] = mapped_column(String(512), default="")

    target_roles: Mapped[str] = mapped_column(String(256), default="")
    location: Mapped[str] = mapped_column(String(128), default="")
    education_level: Mapped[str] = mapped_column(String(64), default="")
    years_of_experience: Mapped[str] = mapped_column(String(32), default="")
    interests: Mapped[str] = mapped_column(Text, default="")

    # Skills stored as simple strings (comma-separated)
    skills_technical: Mapped[str] = mapped_column(Text, default="")
    skills_product: Mapped[str] = mapped_column(Text, default="")
    skills_communication: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    education: Mapped[list["Education"]] = relationship("Education", back_populates="profile", cascade="all, delete-orphan")
    experience: Mapped[list["Experience"]] = relationship("Experience", back_populates="profile", cascade="all, delete-orphan")
    projects: Mapped[list["Project"]] = relationship("Project", back_populates="profile", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="profile", cascade="all, delete-orphan")


class Education(Base):
    __tablename__ = "educations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_profiles.id"))
    school: Mapped[str] = mapped_column(String(256), default="")
    degree: Mapped[str] = mapped_column(String(64), default="")
    major: Mapped[str] = mapped_column(String(128), default="")
    year: Mapped[str] = mapped_column(String(32), default="")
    key_coursework: Mapped[str] = mapped_column(Text, default="")
    academic_focus: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="education")


class Experience(Base):
    __tablename__ = "experiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_profiles.id"))
    company: Mapped[str] = mapped_column(String(256), default="")
    role: Mapped[str] = mapped_column(String(128), default="")
    type: Mapped[str] = mapped_column(String(64), default="Full-time")
    duration: Mapped[str] = mapped_column(String(64), default="")
    responsibilities: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="experience")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_profiles.id"))
    name: Mapped[str] = mapped_column(String(256), default="")
    context: Mapped[str] = mapped_column(Text, default="")
    role: Mapped[str] = mapped_column(String(128), default="")
    tools: Mapped[str] = mapped_column(String(256), default="")
    outcome: Mapped[str] = mapped_column(Text, default="")
    learnings: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="projects")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_profiles.id"))
    name: Mapped[str] = mapped_column(String(256))
    type: Mapped[str] = mapped_column(String(64), default="Notes")  # Resume/Portfolio/Work Sample/Notes
    file_path: Mapped[str] = mapped_column(String(512), default="")
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    mime_type: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="documents")
