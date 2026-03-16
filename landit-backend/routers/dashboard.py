"""
Dashboard router — aggregated stats for the Dashboard view.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models.interview import InterviewSession, SavedQuestion
from models.role import TargetRole
from models.user import UserProfile, Education, Experience, Project

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

USER_KEY = "default"


@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """
    Aggregated stats for the Dashboard view.
    Returns interview count, questions prepared, profile completion, and role count.
    """
    # Count completed interview sessions
    interview_count_result = await db.execute(
        select(func.count(InterviewSession.id)).where(
            InterviewSession.user_key == USER_KEY,
            InterviewSession.status == "completed",
        )
    )
    live_interviews = interview_count_result.scalar() or 0

    # Count saved questions
    question_count_result = await db.execute(
        select(func.count(SavedQuestion.id)).where(
            SavedQuestion.user_key == USER_KEY
        )
    )
    mock_questions = question_count_result.scalar() or 0

    # Count roles
    role_count_result = await db.execute(
        select(func.count(TargetRole.id)).where(
            TargetRole.user_key == USER_KEY
        )
    )
    roles_count = role_count_result.scalar() or 0

    # Profile completion
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_key == USER_KEY)
    )
    profile = profile_result.scalar_one_or_none()

    profile_completion = 0
    if profile:
        edu = (await db.execute(
            select(Education).where(Education.profile_id == profile.id)
        )).scalars().all()
        exp = (await db.execute(
            select(Experience).where(Experience.profile_id == profile.id)
        )).scalars().all()
        proj = (await db.execute(
            select(Project).where(Project.profile_id == profile.id)
        )).scalars().all()

        fields = [
            profile.name, profile.headline, profile.bio,
            profile.target_roles, profile.location, profile.education_level,
            profile.years_of_experience, profile.interests,
            profile.skills_technical, profile.skills_product, profile.skills_communication,
        ]
        filled = sum(1 for f in fields if f and f.strip())
        base = filled / len(fields) * 60

        section_score = 0
        if edu:
            section_score += 15
        if exp:
            section_score += 15
        if proj:
            section_score += 10

        profile_completion = min(int(base + section_score), 100)

    return {
        "live_interviews": live_interviews,
        "mock_questions": mock_questions,
        "profile_completion": profile_completion,
        "roles_count": roles_count,
    }
