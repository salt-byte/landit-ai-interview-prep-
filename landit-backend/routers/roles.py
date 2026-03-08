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
from datetime import datetime

router = APIRouter(prefix="/roles", tags=["roles"])

USER_KEY = "default"


def role_to_dict(role: TargetRole, sources=None) -> dict:
    return {
        "id": str(role.id),
        "title": role.title,
        "company": role.company,
        "jd": role.jd,
        "teamInfo": role.team_info,
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
async def list_roles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TargetRole)
        .where(TargetRole.user_key == USER_KEY)
        .order_by(TargetRole.created_at.desc())
    )
    roles = result.scalars().all()
    return [role_to_dict(r) for r in roles]


@router.post("")
async def create_role(data: TargetRoleCreate, db: AsyncSession = Depends(get_db)):
    role = TargetRole(
        user_key=USER_KEY,
        title=data.title,
        company=data.company,
        jd=data.jd,
        team_info=data.team_info,
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
async def get_role(role_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id, TargetRole.user_key == USER_KEY))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    sources = (await db.execute(select(RoleSource).where(RoleSource.role_id == role_id))).scalars().all()
    return role_to_dict(role, sources)


@router.put("/{role_id}")
async def update_role(role_id: int, data: TargetRoleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id, TargetRole.user_key == USER_KEY))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")

    role.title = data.title
    role.company = data.company
    role.jd = data.jd
    role.team_info = data.team_info
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
async def delete_role(role_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id, TargetRole.user_key == USER_KEY))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    await db.delete(role)
    await db.commit()
    return {"ok": True}


@router.post("/parse-link")
async def parse_link(data: ParseLinkRequest):
    """AI-parse a job posting URL and return structured fields."""
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
    """Add a URL as a source and extract content via AI."""
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

    # Optionally enrich role with extracted data
    if extracted.get("company_background"):
        role.company_background = (role.company_background or "") + f"\n\n[AI Extracted from {data.url}]:\n{extracted.get('jd', '')[:500]}"
        role.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(source)

    return {
        "id": str(source.id),
        "name": source.name,
        "type": source.type,
        "date": source.created_at.strftime("%Y-%m-%d"),
        "extracted_preview": extracted.get("jd", "")[:300],
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
    """
    Layer 3: Run LLM on JD → extract RoleDimensionModel.
    Requires role to have a JD. Returns the dimension model.
    """
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    if not role.jd:
        raise HTTPException(400, "Role has no JD — please add one first")

    raw_dims = await extract_jd_dimension_model(role.jd, role.title, role.company)
    normalized = normalize_weights(raw_dims)

    # Upsert RoleDimensionModel
    existing = (await db.execute(
        select(RoleDimensionModel).where(RoleDimensionModel.role_id == role_id)
    )).scalar_one_or_none()

    if existing:
        if not existing.is_user_edited:  # don't overwrite user edits
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
    """Human checkpoint — user can edit dimension model, treated as ground truth."""
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
