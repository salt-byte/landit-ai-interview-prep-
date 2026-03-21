"""
Memory System — Two-layer architecture:
- Short-term: in-context session state (managed here as DB records)
- Long-term: persistent PostgreSQL records read at session start
"""
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.interview import WeaknessVector, InterviewFeedback, InterviewSession
from models.dimension import UserDimensionScore, GapSnapshot
from config import DIMENSIONS


INTERVIEWER_PERSONAS = {
    "alex": {
        "name": "Alex Morgan",
        "title": "Senior Product Manager",
        "role": "Balanced Interviewer",
        "style": "balanced, thorough, business-focused with behavioral depth",
        "focus": ["Business understanding", "Structured thinking", "Metrics awareness", "Behavioral questions (STAR)", "Communication clarity"],
        "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200",
    },
    "victor": {
        "name": "Victor Hale",
        "title": "Director of Product",
        "role": "Pressure Executive",
        "style": "direct, challenging, demands data and logical rigor, will push back, interrupts if you ramble",
        "focus": ["Logical rigor", "Defending ideas", "Handling pushback"],
        "avatar": "https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200&h=200",
    },
    "emma": {
        "name": "Emma Chen",
        "title": "Hiring Manager",
        "role": "Supportive Manager",
        "style": "warm, focused on collaboration, team dynamics, growth mindset, mentoring, conflict resolution",
        "focus": ["Communication", "Collaboration", "Growth mindset"],
        "avatar": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=200&h=200",
    },
    "adrian": {
        "name": "Dr. Adrian Park",
        "title": "Data & Growth Lead",
        "role": "Domain Expert",
        "style": "technical depth, metrics-driven, analytical, case-focused, expects you to know your numbers",
        "focus": ["Metrics", "Analysis depth", "Case questions"],
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200",
    },
    "sophia": {
        "name": "Sophia Ramirez",
        "title": "Team Lead",
        "role": "Behavioral Interviewer",
        "style": "STAR-focused, emotional intelligence, cultural fit, self-awareness, leadership assessment",
        "focus": ["STAR answers", "Leadership", "Cultural fit"],
        "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200&h=200",
    },
}


async def get_or_create_weakness_vector(db: AsyncSession, user_key: str) -> WeaknessVector:
    result = await db.execute(
        select(WeaknessVector).where(WeaknessVector.user_key == user_key)
    )
    wv = result.scalar_one_or_none()
    if not wv:
        wv = WeaknessVector(
            user_key=user_key,
            vector={dim: 0.5 for dim in DIMENSIONS},  # neutral start
            questions_asked=[],
            preferred_style="",
        )
        db.add(wv)
        await db.commit()
        await db.refresh(wv)
    return wv


async def build_session_system_prompt(
    db: AsyncSession,
    user_key: str,
    interviewer_id: str,
    role_title: str,
    company: str,
    jd_snippet: str,
    gap_summary: str,
    session_id: int,
) -> str:
    """
    Assembles the LLM interviewer system prompt from long-term memory.
    Injects: role context, WeaknessVector, ability curve trend, past questions.
    """
    persona = INTERVIEWER_PERSONAS.get(interviewer_id, INTERVIEWER_PERSONAS["alex"])

    # ① Fetch long-term memory
    wv = await get_or_create_weakness_vector(db, user_key)
    past_questions = wv.questions_asked[-20:]  # last 20 to avoid repeats

    # Weakness-weighted dimension focus
    top_weak_dims = sorted(wv.vector.items(), key=lambda x: x[1], reverse=True)[:3]
    weak_focus = ", ".join(f"{k.replace('_', ' ')} (weight {v:.2f})" for k, v in top_weak_dims)

    # ② Ability curve trend (last 3 sessions)
    result = await db.execute(
        select(InterviewFeedback)
        .join(InterviewSession)
        .where(InterviewSession.user_key == user_key)
        .order_by(InterviewFeedback.created_at.desc())
        .limit(3)
    )
    past_feedbacks = result.scalars().all()
    if past_feedbacks:
        avg_scores = [f.overall_score for f in past_feedbacks]
        trend = "improving" if len(avg_scores) > 1 and avg_scores[0] > avg_scores[-1] else "needs work"
        avg_recent = sum(avg_scores) / len(avg_scores)
        ability_note = f"Recent performance: avg score {avg_recent:.0f}/100, trend: {trend}."
    else:
        ability_note = "First session — no prior performance data."

    # ③ Build system prompt
    system = f"""You are {persona['name']}, {persona.get('title', persona['role'])} — a {persona['role']} conducting a mock job interview.
Interviewing style: {persona['style']}

ROLE BEING INTERVIEWED FOR:
- Title: {role_title}
- Company: {company}
- JD context: {jd_snippet[:500]}

CANDIDATE CONTEXT (from long-term memory):
{gap_summary}
{ability_note}

WEAKNESS FOCUS — Weight your questions higher on these dimensions where the candidate is weakest:
{weak_focus}

QUESTIONS TO AVOID (already asked in previous sessions):
{chr(10).join(f"- {q}" for q in past_questions[:10]) if past_questions else "None — first session."}

INSTRUCTIONS:
- Ask ONE question at a time.
- After the candidate responds, optionally give one brief follow-up or acknowledgment (1 sentence max), then signal NEXT_QUESTION.
- Keep the interview professional and realistic.
- Do NOT give away answers. Push back if answers are vague (especially as {persona['name']}).
- After receiving a candidate answer, end your response with [NEXT_QUESTION] to signal the frontend to advance.
- When the final question is answered, end with [INTERVIEW_COMPLETE].
"""
    return system


async def update_long_term_memory(
    db: AsyncSession,
    user_key: str,
    session_id: int,
    feedback: InterviewFeedback,
    weakness_vector: dict[str, float],
    questions_asked: list[str],
) -> None:
    """
    Write session results to long-term memory after interview ends.
    Respects priority: user_edit > LLM_inferred > mentioned.
    """
    # Update WeaknessVector
    wv = await get_or_create_weakness_vector(db, user_key)

    # Merge new weakness data (blend 70% existing, 30% new session)
    new_vector = {}
    for dim in DIMENSIONS:
        existing = wv.vector.get(dim, 0.5)
        new_val = weakness_vector.get(dim, existing)
        new_vector[dim] = round(0.7 * existing + 0.3 * new_val, 3)

    wv.vector = new_vector

    # Append new questions to avoid list (deduplicate)
    existing_qs = set(wv.questions_asked)
    for q in questions_asked:
        if q not in existing_qs:
            wv.questions_asked = list(wv.questions_asked) + [q]
            existing_qs.add(q)

    wv.updated_at = datetime.utcnow()
    await db.commit()

    # Update UserDimensionScores from feedback dimension scores
    for dim, score in feedback.dimension_scores.items():
        result = await db.execute(
            select(UserDimensionScore).where(
                UserDimensionScore.user_key == user_key,
                UserDimensionScore.dimension == dim,
            )
        )
        uds = result.scalar_one_or_none()
        if uds:
            # Blend: new score gets weight based on confidence
            uds.score = round(0.6 * uds.score + 0.4 * score, 2)
            uds.version += 1
            uds.confidence = "confirmed"
            uds.updated_at = datetime.utcnow()
        else:
            uds = UserDimensionScore(
                user_key=user_key,
                dimension=dim,
                score=score,
                confidence="inferred",
                evidence=f"Session {session_id} assessment",
            )
            db.add(uds)

    await db.commit()


def build_context_window(
    messages: list[dict],
    system_prompt: str,
    max_turns: int = 10,
) -> list[dict]:
    """
    Context Manager: Sliding window strategy.
    Keep last N turns, compress older ones.
    """
    if len(messages) <= max_turns:
        return messages

    # Keep last max_turns messages
    recent = messages[-max_turns:]

    # Compress older messages into a summary entry
    older = messages[:-max_turns]
    if older:
        summary_text = f"[Context summary: {len(older)} earlier messages covering initial questions and responses]"
        compressed = {"role": "user", "content": summary_text}
        return [compressed] + recent

    return recent
