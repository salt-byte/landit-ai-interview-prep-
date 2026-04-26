"""
Target Roles router — workspace CRUD, source management, JD parsing.
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.role import TargetRole, RoleSource, RoleDimensionModel
from schemas.role import TargetRoleCreate, TargetRoleUpdate, ParseLinkRequest
from services.storage import upload_file, detect_file_type, delete_file
from services.web_scraper import extract_jd_from_url
from services.llm import extract_jd_dimension_model
from services.computation import normalize_weights
from deps import get_current_user_key
from datetime import datetime

router = APIRouter(prefix="/roles", tags=["roles"])


def role_to_dict(role: TargetRole, sources=None) -> dict:
    return {
        "id": str(role.id),
        "title": role.title,
        "company": role.company,
        "jd": role.jd,
        "teamInfo": role.team_info,
        # New v3 fields
        "location": role.location,
        "employmentType": role.employment_type,
        "keyResponsibilities": role.key_responsibilities,
        "qualifications": role.qualifications,
        "companyOverview": role.company_overview,
        "teamOverview": role.team_overview,
        "additionalInfo": role.additional_info,
        "interviewQuestionsList": role.interview_questions_list or [],
        "generalNotes": role.general_notes,
        "preparationNotes": role.preparation_notes,
        "insights": role.insights,
        # Legacy
        "companyBackground": role.company_background,
        "teamBackground": role.team_background,
        "additionalNotes": role.additional_notes,
        "interviewQuestions": role.interview_questions or [],
        "sources": [
            {
                "id": str(s.id),
                "name": s.name,
                "type": s.type,
                "date": s.created_at.strftime("%Y-%m-%d"),
            }
            for s in (sources or [])
        ],
    }


@router.get("")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    result = await db.execute(
        select(TargetRole)
        .where(TargetRole.user_key == user_key)
        .order_by(TargetRole.created_at.desc())
    )
    roles = result.scalars().all()
    return [role_to_dict(r) for r in roles]


@router.post("")
async def create_role(
    data: TargetRoleCreate,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    role = TargetRole(
        user_key=user_key,
        title=data.title,
        company=data.company,
        jd=data.jd,
        team_info=data.team_info,
        location=data.location,
        employment_type=data.employment_type,
        key_responsibilities=data.key_responsibilities,
        qualifications=data.qualifications,
        company_overview=data.company_overview,
        team_overview=data.team_overview,
        additional_info=data.additional_info,
        interview_questions_list=data.interview_questions_list if data.interview_questions_list else [],
        general_notes=data.general_notes,
        preparation_notes=data.preparation_notes,
        insights=data.insights,
        company_background=data.company_background,
        team_background=data.team_background,
        additional_notes=data.additional_notes,
        interview_questions=data.interview_questions,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role_to_dict(role)


@router.get("/{role_id}")
async def get_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id, TargetRole.user_key == user_key))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    sources = (await db.execute(select(RoleSource).where(RoleSource.role_id == role_id))).scalars().all()
    return role_to_dict(role, sources)


@router.put("/{role_id}")
async def update_role(
    role_id: int,
    data: TargetRoleUpdate,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id, TargetRole.user_key == user_key))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")

    role.title = data.title
    role.company = data.company
    role.jd = data.jd
    role.team_info = data.team_info
    role.location = data.location
    role.employment_type = data.employment_type
    role.key_responsibilities = data.key_responsibilities
    role.qualifications = data.qualifications
    role.company_overview = data.company_overview
    role.team_overview = data.team_overview
    role.additional_info = data.additional_info
    role.interview_questions_list = data.interview_questions_list if data.interview_questions_list else []
    role.general_notes = data.general_notes
    role.preparation_notes = data.preparation_notes
    role.insights = data.insights
    role.company_background = data.company_background
    role.team_background = data.team_background
    role.additional_notes = data.additional_notes
    role.interview_questions = data.interview_questions
    role.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(role)
    sources = (await db.execute(select(RoleSource).where(RoleSource.role_id == role_id))).scalars().all()
    return role_to_dict(role, sources)


@router.delete("/{role_id}")
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id, TargetRole.user_key == user_key))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    await db.delete(role)
    await db.commit()
    return {"ok": True}


@router.post("/parse-link")
async def parse_link(data: ParseLinkRequest):
    result = await extract_jd_from_url(data.url)
    return result


@router.post("/{role_id}/sources/upload")
async def upload_role_source(
    role_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")

    file_path, file_size = await upload_file(file, subfolder=f"roles/{role_id}")
    detected_type = detect_file_type(file.filename or "")

    source = RoleSource(
        role_id=role_id,
        name=file.filename or "upload",
        type=detected_type if "jd" in detected_type.lower() else "PDF Document",
        file_path=file_path,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)

    return {
        "id": str(source.id),
        "name": source.name,
        "type": source.type,
        "date": source.created_at.strftime("%Y-%m-%d"),
    }


@router.post("/{role_id}/sources/add-link")
async def add_link_source(
    role_id: int,
    data: ParseLinkRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")

    extracted = await extract_jd_from_url(data.url)

    source = RoleSource(
        role_id=role_id,
        name=data.url,
        type="Link",
        extracted_content=extracted.get("jd", ""),
    )
    db.add(source)

    # Backfill role context fields from the extracted link content. Only fill
    # empty fields — never overwrite user-edited content. The LLM returns
    # camelCase keys (companyOverview, teamOverview, keyResponsibilities,
    # qualifications, additionalInfo) per the parse_jd_from_url_content schema.
    field_map = [
        ("companyOverview", "company_overview"),
        ("teamOverview", "team_overview"),
        ("keyResponsibilities", "key_responsibilities"),
        ("qualifications", "qualifications"),
        ("additionalInfo", "additional_info"),
    ]
    role_was_updated = False
    for src_key, role_attr in field_map:
        new_val = (extracted.get(src_key) or "").strip()
        if not new_val:
            continue
        existing = (getattr(role, role_attr) or "").strip()
        if not existing:
            setattr(role, role_attr, new_val)
            role_was_updated = True
    if role_was_updated:
        role.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(source)

    return {
        "id": str(source.id),
        "name": source.name,
        "type": source.type,
        "date": source.created_at.strftime("%Y-%m-%d"),
        "extracted_preview": extracted.get("jd", "")[:300],
        "role_updated": role_was_updated,
    }


@router.delete("/{role_id}/sources/{source_id}")
async def delete_role_source(role_id: int, source_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RoleSource).where(RoleSource.id == source_id, RoleSource.role_id == role_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Source not found")
    if source.file_path:
        await delete_file(source.file_path)
    await db.delete(source)
    await db.commit()
    return {"ok": True}


@router.post("/{role_id}/analyze-jd")
async def analyze_jd(role_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    if not role.jd:
        raise HTTPException(400, "Role has no JD — please add one first")

    raw_dims = await extract_jd_dimension_model(role.jd, role.title, role.company)
    normalized = normalize_weights(raw_dims)

    existing = (await db.execute(
        select(RoleDimensionModel).where(RoleDimensionModel.role_id == role_id)
    )).scalar_one_or_none()

    if existing:
        if not existing.is_user_edited:
            existing.dimensions = normalized
            existing.version += 1
            existing.updated_at = datetime.utcnow()
    else:
        existing = RoleDimensionModel(
            role_id=role_id,
            dimensions=normalized,
            version=1,
        )
        db.add(existing)

    await db.commit()
    await db.refresh(existing)

    return {
        "role_id": role_id,
        "version": existing.version,
        "is_user_edited": existing.is_user_edited,
        "dimensions": existing.dimensions,
    }


@router.get("/{role_id}/dimension-model")
async def get_dimension_model(role_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RoleDimensionModel).where(RoleDimensionModel.role_id == role_id)
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(404, "No dimension model yet — run /analyze-jd first")
    return {
        "role_id": role_id,
        "version": model.version,
        "is_user_edited": model.is_user_edited,
        "dimensions": model.dimensions,
    }


@router.put("/{role_id}/dimension-model")
async def update_dimension_model(role_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RoleDimensionModel).where(RoleDimensionModel.role_id == role_id)
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(404, "No dimension model found")

    normalized = normalize_weights(data.get("dimensions", {}))
    model.dimensions = normalized
    model.is_user_edited = True
    model.version += 1
    model.updated_at = datetime.utcnow()

    await db.commit()
    return {"ok": True, "version": model.version}
