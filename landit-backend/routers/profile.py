"""
Profile router — CRUD for user profile, education, work experience, projects, documents.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import UserProfile, Education, WorkExperience, Project, Document
from schemas.user import UserProfileUpdate
from services.resume_parser import extract_profile_from_resume_async
from services.storage import upload_file, detect_file_type, delete_file, read_text_file
from deps import get_current_user_key

router = APIRouter(prefix="/profile", tags=["profile"])


def document_to_response(doc: Document) -> dict:
    return {
        "id": str(doc.id),
        "name": doc.name,
        "type": doc.type,
        "date": doc.created_at.strftime("%Y-%m-%d"),
        "file_size": doc.file_size,
    }


def document_key(doc: Document) -> tuple[str, str]:
    return ((doc.name or "").strip().lower(), (doc.type or "").strip().lower())


def dedupe_documents(docs: list[Document]) -> list[Document]:
    seen = set()
    deduped = []
    for doc in docs:
        key = document_key(doc)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(doc)
    return deduped


async def find_recent_document(
    db: AsyncSession,
    profile_id: int,
    name: str,
    doc_type: str,
    within_seconds: int = 300,
) -> Document | None:
    recent_cutoff = datetime.utcnow() - timedelta(seconds=within_seconds)
    result = await db.execute(
        select(Document)
        .where(
            Document.profile_id == profile_id,
            Document.name == name,
            Document.type == doc_type,
            Document.created_at >= recent_cutoff,
        )
        .order_by(Document.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_or_create_profile(db: AsyncSession, user_key: str) -> UserProfile:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_key == user_key)
    )
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    profile = UserProfile(user_key=user_key)
    db.add(profile)
    try:
        await db.commit()
        await db.refresh(profile)
        return profile
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_key == user_key)
        )
        profile = result.scalar_one_or_none()
        if profile:
            return profile
        raise


def calculate_completion(profile: UserProfile, edu_list, exp_list, proj_list) -> int:
    fields = [
        profile.full_name, profile.target_role, profile.email,
        profile.location, profile.phone_number,
        profile.skills_technical, profile.skills_tools_and_technologies, profile.skills_soft,
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
            "institutionName": e.institution_name,
            "degree": e.degree,
            "fieldOfStudy": e.field_of_study,
            "startDate": e.start_date,
            "endDate": e.end_date,
            "gpa": e.gpa,
            "relevantCoursework": e.relevant_coursework,
            "additionalDetails": e.additional_details,
        }

    def exp_to_dict(e):
        return {
            "id": str(e.id),
            "companyName": e.company_name,
            "jobTitle": e.job_title,
            "startDate": e.start_date,
            "endDate": e.end_date,
            "description": e.description,
        }

    def proj_to_dict(p):
        return {
            "id": str(p.id),
            "projectName": p.project_name,
            "projectDescription": p.project_description,
            "startDate": p.start_date,
            "endDate": p.end_date,
            "projectLink": p.project_link,
        }

    return {
        "id": profile.id,
        "fullName": profile.full_name,
        "profilePhoto": profile.profile_photo,
        "targetRole": profile.target_role,
        "employmentType": profile.employment_type,
        "email": profile.email,
        "phoneNumber": profile.phone_number,
        "location": profile.location,
        "personalWebsite": profile.personal_website,
        "linkedInProfile": profile.linkedin_profile,
        "skills": {
            "technicalSkills": profile.skills_technical,
            "toolsAndTechnologies": profile.skills_tools_and_technologies,
            "softSkills": profile.skills_soft,
        },
        "education": [edu_to_dict(e) for e in sorted(edu, key=lambda x: x.sort_order)],
        "workExperience": [exp_to_dict(e) for e in sorted(exp, key=lambda x: x.sort_order)],
        "projects": [proj_to_dict(p) for p in sorted(proj, key=lambda x: x.sort_order)],
        "completion_percentage": calculate_completion(profile, edu, exp, proj),
    }


@router.get("")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    profile = await get_or_create_profile(db, user_key)
    edu = (await db.execute(select(Education).where(Education.profile_id == profile.id))).scalars().all()
    exp = (await db.execute(select(WorkExperience).where(WorkExperience.profile_id == profile.id))).scalars().all()
    proj = (await db.execute(select(Project).where(Project.profile_id == profile.id))).scalars().all()
    return profile_to_response(profile, edu, exp, proj)


@router.put("")
async def update_profile(
    data: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    profile = await get_or_create_profile(db, user_key)

    profile.full_name = data.full_name
    profile.profile_photo = data.profile_photo
    profile.target_role = data.target_role
    profile.employment_type = data.employment_type
    profile.email = data.email
    profile.phone_number = data.phone_number
    profile.location = data.location
    profile.personal_website = data.personal_website
    profile.linkedin_profile = data.linkedin_profile
    profile.skills_technical = data.skills.technical_skills
    profile.skills_tools_and_technologies = data.skills.tools_and_technologies
    profile.skills_soft = data.skills.soft_skills
    profile.updated_at = datetime.utcnow()

    # Replace education
    await db.execute(
        Education.__table__.delete().where(Education.profile_id == profile.id)
    )
    for i, edu in enumerate(data.education):
        db.add(Education(
            profile_id=profile.id,
            institution_name=edu.institution_name,
            degree=edu.degree,
            field_of_study=edu.field_of_study,
            start_date=edu.start_date,
            end_date=edu.end_date,
            gpa=edu.gpa,
            relevant_coursework=edu.relevant_coursework,
            additional_details=edu.additional_details,
            sort_order=i,
        ))

    # Replace work experience
    await db.execute(
        WorkExperience.__table__.delete().where(WorkExperience.profile_id == profile.id)
    )
    for i, exp in enumerate(data.work_experience):
        db.add(WorkExperience(
            profile_id=profile.id,
            company_name=exp.company_name,
            job_title=exp.job_title,
            start_date=exp.start_date,
            end_date=exp.end_date,
            description=exp.description,
            sort_order=i,
        ))

    # Replace projects
    await db.execute(
        Project.__table__.delete().where(Project.profile_id == profile.id)
    )
    for i, proj in enumerate(data.projects):
        db.add(Project(
            profile_id=profile.id,
            project_name=proj.project_name,
            project_description=proj.project_description,
            start_date=proj.start_date,
            end_date=proj.end_date,
            project_link=proj.project_link,
            sort_order=i,
        ))

    await db.commit()
    await db.refresh(profile)

    edu = (await db.execute(select(Education).where(Education.profile_id == profile.id))).scalars().all()
    exp_list = (await db.execute(select(WorkExperience).where(WorkExperience.profile_id == profile.id))).scalars().all()
    proj_list = (await db.execute(select(Project).where(Project.profile_id == profile.id))).scalars().all()
    return profile_to_response(profile, edu, exp_list, proj_list)


@router.get("/documents")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    profile = await get_or_create_profile(db, user_key)
    result = await db.execute(
        select(Document).where(Document.profile_id == profile.id).order_by(Document.created_at.desc())
    )
    docs = dedupe_documents(result.scalars().all())
    return [document_to_response(d) for d in docs]


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    type_override: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    profile = await get_or_create_profile(db, user_key)
    detected_type = type_override or detect_file_type(file.filename or "")
    doc_name = file.filename or "upload"

    duplicate = await find_recent_document(db, profile.id, doc_name, detected_type)
    if duplicate:
        response = document_to_response(duplicate)
        response["detected_type"] = detected_type
        response["deduplicated"] = True
        return response

    file_path, file_size = await upload_file(file, subfolder="profile")

    doc = Document(
        profile_id=profile.id,
        name=doc_name,
        type=detected_type,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type or "",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    response = document_to_response(doc)
    response["detected_type"] = detected_type
    return response


@router.post("/documents/upload-and-parse")
async def upload_and_parse_resume(
    file: UploadFile = File(...),
    extracted_text: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    profile = await get_or_create_profile(db, user_key)

    # Dedupe: if the same filename was uploaded by this profile recently,
    # treat as a duplicate (e.g. accidental double-click, abandoned-but-still-
    # in-flight pre-upload from a closed modal). Skip both file save and parse.
    doc_name = file.filename or "resume"
    dup_doc = await find_recent_document(db, profile.id, doc_name, "Resume")
    if dup_doc:
        return {
            "extracted": {},
            "document_id": dup_doc.id,
            "document": document_to_response(dup_doc),
            "parse_error": None,
            "deduplicated": True,
        }

    file_path, file_size = await upload_file(file, subfolder="profile")
    # If the client pre-extracted text (e.g. via pdf.js), skip backend PDF parsing.
    if extracted_text and extracted_text.strip():
        text = extracted_text
    else:
        text = await read_text_file(file_path)
    parse_error = None
    extracted = {}

    try:
        if not text.strip():
            raise ValueError("Could not extract readable text from this file.")
        extracted = await extract_profile_from_resume_async(text)
    except Exception as exc:
        parse_error = str(exc) or "Resume parsing failed."

    doc = Document(
        profile_id=profile.id,
        name=doc_name,
        type="Resume",
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type or "",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "extracted": extracted,
        "document_id": doc.id,
        "document": document_to_response(doc),
        "parse_error": parse_error,
    }


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
