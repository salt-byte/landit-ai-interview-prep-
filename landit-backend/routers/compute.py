"""
Compute router — Layer 4: pure deterministic backend.
Gap matrix, match score, ability curve, weakness vector.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.role import TargetRole, RoleDimensionModel
from models.dimension import UserDimensionScore, GapSnapshot
from models.interview import InterviewFeedback, InterviewSession
from services.computation import (
    compute_match_score,
    aggregate_user_scores,
    compute_weakness_vector,
    build_gap_summary,
)
from services.memory_manager import get_or_create_weakness_vector
from config import DIMENSIONS, DIMENSION_LABELS
from datetime import datetime

router = APIRouter(prefix="/compute", tags=["compute"])

USER_KEY = "default"


def get_user_scores_from_db(uds_list) -> dict[str, float]:
    """Convert UserDimensionScore records to simple dict."""
    return {u.dimension: u.score for u in uds_list}


@router.get("/gap-matrix/{role_id}")
async def get_gap_matrix(role_id: int, db: AsyncSession = Depends(get_db)):
    """
    Compute and return gap matrix for a given role.
    Also creates a GapSnapshot record for traceability.
    """
    # Load role dimension model
    dim_model_result = await db.execute(
        select(RoleDimensionModel).where(RoleDimensionModel.role_id == role_id)
    )
    dim_model = dim_model_result.scalar_one_or_none()
    if not dim_model:
        raise HTTPException(404, "Run /roles/{id}/analyze-jd first to generate dimension model")

    # Load user dimension scores
    uds_result = await db.execute(
        select(UserDimensionScore).where(UserDimensionScore.user_key == USER_KEY)
    )
    uds_list = uds_result.scalars().all()
    user_scores = get_user_scores_from_db(uds_list)

    # Compute
    match_score, gaps = compute_match_score(user_scores, dim_model.dimensions)

    # Save snapshot
    snapshot = GapSnapshot(
        role_id=role_id,
        user_key=USER_KEY,
        match_score=match_score,
        gap_data={g["dimension"]: g for g in gaps},
    )
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)

    return {
        "role_id": role_id,
        "match_score": match_score,
        "snapshot_id": snapshot.id,
        "gaps": gaps,
    }


@router.get("/user-dimensions")
async def get_user_dimensions(db: AsyncSession = Depends(get_db)):
    """Get current aggregated user dimension scores (from Long-term Memory)."""
    result = await db.execute(
        select(UserDimensionScore).where(UserDimensionScore.user_key == USER_KEY)
    )
    uds_list = result.scalars().all()

    return {
        "dimensions": [
            {
                "dimension": u.dimension,
                "label": DIMENSION_LABELS.get(u.dimension, u.dimension),
                "score": u.score,
                "confidence": u.confidence,
                "evidence": u.evidence,
            }
            for u in uds_list
        ]
    }


@router.post("/extract-user-dimensions")
async def extract_user_dimensions(db: AsyncSession = Depends(get_db)):
    """
    Layer 2-3: Extract dimension scores from user profile via LLM.
    Requires profile to be populated.
    """
    from models.user import UserProfile, Education, Experience, Project
    from services.llm import extract_dimension_scores
    from services.computation import build_profile_summary

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_key == USER_KEY)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    edu = (await db.execute(select(Education).where(Education.profile_id == profile.id))).scalars().all()
    exp = (await db.execute(select(Experience).where(Experience.profile_id == profile.id))).scalars().all()
    proj = (await db.execute(select(Project).where(Project.profile_id == profile.id))).scalars().all()

    profile_dict = {
        "name": profile.name,
        "headline": profile.headline,
        "years_of_experience": profile.years_of_experience,
        "education": [{"school": e.school, "degree": e.degree, "major": e.major} for e in edu],
        "experience": [
            {"company": e.company, "role": e.role, "duration": e.duration, "responsibilities": e.responsibilities}
            for e in exp
        ],
        "skills": {
            "technical": profile.skills_technical,
            "product": profile.skills_product,
            "communication": profile.skills_communication,
        },
    }

    profile_text = build_profile_summary(profile_dict)
    raw_scores = await extract_dimension_scores(profile_text)

    # Upsert dimension scores
    for dim in DIMENSIONS:
        dim_data = raw_scores.get(dim, {})
        score = float(dim_data.get("score", 0.0))
        confidence = dim_data.get("confidence", "inferred")
        evidence = dim_data.get("evidence", "")

        result = await db.execute(
            select(UserDimensionScore).where(
                UserDimensionScore.user_key == USER_KEY,
                UserDimensionScore.dimension == dim,
            )
        )
        uds = result.scalar_one_or_none()
        if uds:
            # Only update if not user-confirmed
            if uds.confidence != "confirmed":
                uds.score = score
                uds.confidence = confidence
                uds.evidence = evidence
                uds.version += 1
                uds.updated_at = datetime.utcnow()
        else:
            db.add(UserDimensionScore(
                user_key=USER_KEY,
                dimension=dim,
                score=score,
                confidence=confidence,
                evidence=evidence,
            ))

    await db.commit()
    return {"ok": True, "dimensions_extracted": len(raw_scores)}


@router.get("/weakness-vector")
async def get_weakness_vector(db: AsyncSession = Depends(get_db)):
    """Long-term Memory: Get weakness vector for this user."""
    wv = await get_or_create_weakness_vector(db, USER_KEY)
    return {
        "vector": wv.vector,
        "questions_asked_count": len(wv.questions_asked),
        "preferred_style": wv.preferred_style,
        "updated_at": wv.updated_at.isoformat(),
    }


@router.get("/ability-curve")
async def get_ability_curve(db: AsyncSession = Depends(get_db)):
    """Long-term Memory: Get ability curve (score history across sessions)."""
    result = await db.execute(
        select(InterviewFeedback, InterviewSession.started_at)
        .join(InterviewSession)
        .where(InterviewSession.user_key == USER_KEY)
        .order_by(InterviewFeedback.created_at.asc())
        .limit(20)
    )
    rows = result.all()

    return {
        "curve": [
            {
                "session_id": fb.session_id,
                "date": (started_at or fb.created_at).strftime("%Y-%m-%d"),
                "overall_score": fb.overall_score,
                "dimension_scores": fb.dimension_scores,
            }
            for fb, started_at in rows
        ]
    }
