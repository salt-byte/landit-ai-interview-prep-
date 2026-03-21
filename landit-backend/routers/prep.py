"""
Interview Prep router — Layer 5: AI-generated Q&A, chat refinement, save/load.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.role import TargetRole, RoleDimensionModel
from models.dimension import UserDimensionScore, GapSnapshot
from services.llm import generate_interview_prep, refine_prep_with_chat
from services.computation import compute_match_score, build_gap_summary, build_profile_summary
from schemas.compute import PrepGenerateRequest, PrepChatRequest
from datetime import datetime

router = APIRouter(prefix="/prep", tags=["prep"])

USER_KEY = "default"


async def get_gap_summary_for_role(db: AsyncSession, role_id: int) -> str:
    dim_result = await db.execute(
        select(RoleDimensionModel).where(RoleDimensionModel.role_id == role_id)
    )
    dim_model = dim_result.scalar_one_or_none()

    uds_result = await db.execute(
        select(UserDimensionScore).where(UserDimensionScore.user_key == USER_KEY)
    )
    uds_list = uds_result.scalars().all()
    user_scores = {u.dimension: u.score for u in uds_list}

    if dim_model and user_scores:
        _, gaps = compute_match_score(user_scores, dim_model.dimensions)
        return build_gap_summary(gaps)

    return "No gap analysis available yet. Focus on core role requirements."


@router.post("/{role_id}/generate")
async def generate_prep(
    role_id: int,
    data: PrepGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")

    gap_summary = await get_gap_summary_for_role(db, role_id)

    from models.user import UserProfile, WorkExperience
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_key == USER_KEY)
    )
    profile = profile_result.scalar_one_or_none()

    if profile:
        exp_result = await db.execute(
            select(WorkExperience).where(WorkExperience.profile_id == profile.id)
        )
        exps = exp_result.scalars().all()
        profile_dict = {
            "name": profile.full_name,
            "target_role": profile.target_role,
            "work_experience": [
                {"company": e.company_name, "role": e.job_title, "start_date": e.start_date, "end_date": e.end_date, "description": e.description}
                for e in exps
            ],
            "skills": {
                "technical": profile.skills_technical,
                "tools": profile.skills_tools_and_technologies,
                "soft": profile.skills_soft,
            },
        }
        profile_summary = build_profile_summary(profile_dict)
    else:
        profile_summary = "No profile data available."

    content = await generate_interview_prep(
        role_title=role.title,
        company=role.company,
        jd=role.jd,
        profile_summary=profile_summary,
        gap_summary=gap_summary,
        mode=data.mode,
        categories=data.categories,
    )

    role.prep_content = content
    role.prep_version += 1
    role.is_prep_user_edited = False
    role.updated_at = datetime.utcnow()
    await db.commit()

    return {"content": content, "version": role.prep_version}


@router.get("/{role_id}")
async def get_prep(role_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    return {
        "content": role.prep_content,
        "version": role.prep_version,
        "is_user_edited": role.is_prep_user_edited,
    }


@router.put("/{role_id}")
async def save_prep(role_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    role.prep_content = data.get("content", role.prep_content)
    role.prep_version += 1
    role.is_prep_user_edited = True
    role.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "version": role.prep_version}


@router.post("/{role_id}/chat")
async def chat_refine(
    role_id: int,
    data: PrepChatRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TargetRole).where(TargetRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")

    updated_content = await refine_prep_with_chat(
        current_content=data.current_content or role.prep_content,
        user_message=data.message,
        role_title=role.title,
        company=role.company,
    )

    return {
        "content": updated_content,
        "ai_message": "I've updated the interview guide based on your request.",
    }
