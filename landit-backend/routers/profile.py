"""
Profile router — CRUD for user profile, education, experience, projects, documents.
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from database import get_db
from models.user import UserProfile, Education, Experience, Project, Document
from schemas.user import UserProfileUpdate, UserProfileResponse, DocumentResponse
from services.storage import upload_file, detect_file_type, delete_file, read_text_file
from services.llm import extract_profile_from_resume
import json
from datetime import datetime

router = APIRouter(prefix="/profile", tags=["profile"])

USER_KEY = "default"  # single-user demo; replace with JWT sub in production


async def get_or_create_profile(db: AsyncSession) -> UserProfile:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_key == USER_KEY)
    )
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    profile = UserProfile(user_key=USER_KEY)
    db.add(profile)
    try:
        await db.commit()
        await db.refresh(profile)
        return profile
    except IntegrityError:
        # Another request created the single demo profile first.
        await db.rollback()
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_key == USER_KEY)
        )
        profile = result.scalar_one_or_none()
        if profile:
            return profile
        raise
    return profile


def calculate_completion(profile: UserProfile, edu_list, exp_list, proj_list) -> int:
    """Calculate profile completion percentage."""
    fields = [
        profile.name, profile.headline, profile.bio,
        profile.target_roles, profile.location, profile.education_level,
        profile.years_of_experience, profile.interests,
        profile.skills_technical, profile.skills_product, profile.skills_communication,
    ]
    filled = sum(1 for f in fields if f and f.strip())
    base = filled / len(fields) * 60

    section_score = 0
    if edu_list:
        section_score += 15
    if exp_list:
        section_score += 15
    if proj_list:
        section_score += 10

    return min(int(base + section_score), 100)


def profile_to_response(profile: UserProfile, edu, exp, proj) -> dict:
    def edu_to_dict(e):
        return {
            "id": str(e.id),
            "school": e.school,
            "degree": e.degree,
            "major": e.major,
            "year": e.year,
            "keyCoursework": e.key_coursework,
            "academicFocus": e.academic_focus,
        }

    def exp_to_dict(e):
        return {
            "id": str(e.id),
            "company": e.company,
            "role": e.role,
            "type": e.type,
            "duration": e.duration,
            "responsibilities": e.responsibilities,
        }

    def proj_to_dict(p):
        return {
            "id": str(p.id),
            "name": p.name,
            "context": p.context,
            "role": p.role,
            "tools": p.tools,
            "outcome": p.outcome,
            "learnings": p.learnings,
        }

    return {
        "id": profile.id,
        "name": profile.name,
        "headline": profile.headline,
        "bio": profile.bio,
        "avatar": profile.avatar_url,
        "targetRoles": profile.target_roles,
        "location": profile.location,
        "educationLevel": profile.education_level,
        "yearsOfExperience": profile.years_of_experience,
        "interests": profile.interests,
        "skills": {
            "technical": profile.skills_technical,
            "product": profile.skills_product,
            "communication": profile.skills_communication,
        },
        "education": [edu_to_dict(e) for e in sorted(edu, key=lambda x: x.sort_order)],
        "experience": [exp_to_dict(e) for e in sorted(exp, key=lambda x: x.sort_order)],
        "projects": [proj_to_dict(p) for p in sorted(proj, key=lambda x: x.sort_order)],
        "completion_percentage": calculate_completion(profile, edu, exp, proj),
    }


@router.get("")
async def get_profile(db: AsyncSession = Depends(get_db)):
    profile = await get_or_create_profile(db)
    edu = (await db.execute(select(Education).where(Education.profile_id == profile.id))).scalars().all()
    exp = (await db.execute(select(Experience).where(Experience.profile_id == profile.id))).scalars().all()
    proj = (await db.execute(select(Project).where(Project.profile_id == profile.id))).scalars().all()
    return profile_to_response(profile, edu, exp, proj)


@router.put("")
async def update_profile(data: UserProfileUpdate, db: AsyncSession = Depends(get_db)):
    profile = await get_or_create_profile(db)

    profile.name = data.name
    profile.headline = data.headline
    profile.bio = data.bio
    if data.avatar:
        profile.avatar_url = data.avatar
    profile.target_roles = data.target_roles
    profile.location = data.location
    profile.education_level = data.education_level
    profile.years_of_experience = data.years_of_experience
    profile.interests = data.interests
    profile.skills_technical = data.skills.technical
    profile.skills_product = data.skills.product
    profile.skills_communication = data.skills.communication
    profile.updated_at = datetime.utcnow()

    # Replace education
    await db.execute(
        Education.__table__.delete().where(Education.profile_id == profile.id)
    )
    for i, edu in enumerate(data.education):
        db.add(Education(
            profile_id=profile.id,
            school=edu.school,
            degree=edu.degree,
            major=edu.major,
            year=edu.year,
            key_coursework=edu.key_coursework,
            academic_focus=edu.academic_focus or "",
            sort_order=i,
        ))

    # Replace experience
    await db.execute(
        Experience.__table__.delete().where(Experience.profile_id == profile.id)
    )
    for i, exp in enumerate(data.experience):
        db.add(Experience(
            profile_id=profile.id,
            company=exp.company,
            role=exp.role,
            type=exp.type,
            duration=exp.duration,
            responsibilities=exp.responsibilities,
            sort_order=i,
        ))

    # Replace projects
    await db.execute(
        Project.__table__.delete().where(Project.profile_id == profile.id)
    )
    for i, proj in enumerate(data.projects):
        db.add(Project(
            profile_id=profile.id,
            name=proj.name,
            context=proj.context,
            role=proj.role,
            tools=proj.tools,
            outcome=proj.outcome,
            learnings=proj.learnings or "",
            sort_order=i,
        ))

    await db.commit()
    await db.refresh(profile)

    edu = (await db.execute(select(Education).where(Education.profile_id == profile.id))).scalars().all()
    exp_list = (await db.execute(select(Experience).where(Experience.profile_id == profile.id))).scalars().all()
    proj_list = (await db.execute(select(Project).where(Project.profile_id == profile.id))).scalars().all()
    return profile_to_response(profile, edu, exp_list, proj_list)


@router.get("/documents")
async def list_documents(db: AsyncSession = Depends(get_db)):
    profile = await get_or_create_profile(db)
    result = await db.execute(
        select(Document).where(Document.profile_id == profile.id).order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "name": d.name,
            "type": d.type,
            "date": d.created_at.strftime("%Y-%m-%d"),
            "file_size": d.file_size,
        }
        for d in docs
    ]


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_profile(db)

    file_path, file_size = await upload_file(file, subfolder="profile")
    detected_type = detect_file_type(file.filename or "")

    doc = Document(
        profile_id=profile.id,
        name=file.filename or "upload",
        type=detected_type,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type or "",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "id": str(doc.id),
        "name": doc.name,
        "type": doc.type,
        "date": doc.created_at.strftime("%Y-%m-%d"),
        "file_size": doc.file_size,
        "detected_type": detected_type,
    }


@router.post("/documents/upload-and-parse")
async def upload_and_parse_resume(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a resume file and auto-extract profile fields via LLM."""
    profile = await get_or_create_profile(db)

    file_path, file_size = await upload_file(file, subfolder="profile")
    text = await read_text_file(file_path)

    if not text.strip():
        raise HTTPException(400, "Could not read file content. Please ensure it's a text-based PDF or .txt file.")

    extracted = await extract_profile_from_resume(text)

    doc = Document(
        profile_id=profile.id,
        name=file.filename or "resume",
        type="Resume",
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type or "",
    )
    db.add(doc)
    await db.commit()

    return {"extracted": extracted, "document_id": doc.id}


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    await delete_file(doc.file_path)
    await db.delete(doc)
    await db.commit()
    return {"ok": True}
