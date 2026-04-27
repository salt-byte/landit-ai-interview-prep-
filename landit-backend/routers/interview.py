"""
Mock Interview router — WebSocket + REST.
Short-term memory: session transcript (DB).
Long-term memory: written after session end.
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError
from database import get_db, AsyncSessionLocal
from models.interview import InterviewSession, InterviewMessage, InterviewFeedback, SavedQuestion
from models.role import TargetRole, RoleDimensionModel
from models.dimension import UserDimensionScore
from schemas.interview import (
    InterviewSessionCreate, InterviewSessionResponse,
    SavedQuestionCreate, SavedQuestionUpdate,
)
from services.llm import generate_session_feedback, get_next_interview_question
from services.memory_manager import (
    build_session_system_prompt,
    update_long_term_memory,
    build_context_window,
    INTERVIEWER_PERSONAS,
)
from services.computation import (
    compute_match_score,
    compute_weakness_vector,
    build_gap_summary,
)
from deps import get_current_user_key, verify_supabase_token

router = APIRouter(prefix="/interview", tags=["interview"])

# Per-session state (in-memory for WebSocket duration)
# In production, use Redis for multi-instance support
active_sessions: dict[int, dict] = {}


DEFAULT_DIMENSION_SCORES = {
    "product_intuition": 3.0,
    "user_empathy": 3.0,
    "metrics_driven_thinking": 3.0,
    "structured_problem_solving": 3.0,
    "prioritization_tradeoffs": 3.0,
    "execution_delivery": 3.0,
    "strategic_thinking": 3.0,
    "cross_functional_leadership": 3.0,
    "stakeholder_communication": 3.0,
    "technical_fluency": 3.0,
}


def _clean_string_list(value, max_items: int = 3) -> list[str]:
    if not isinstance(value, list):
        return []

    cleaned = []
    for item in value:
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = str(item.get("text") or item.get("point") or item.get("feedback") or "").strip()
        else:
            text = str(item).strip()

        if text:
            cleaned.append(text)

    return cleaned[:max_items]


def _rating_for_answer(answer: str, overall_score: float) -> str:
    word_count = len(answer.split())
    has_metric = any(char.isdigit() for char in answer) or any(
        token in answer.lower()
        for token in ("metric", "kpi", "conversion", "retention", "revenue", "percent", "%")
    )

    if word_count >= 45 and (has_metric or overall_score >= 80):
        return "Strong"
    if word_count < 12:
        return "Needs Improvement"
    return "Pass"


def _fallback_transcript_items(conversation_history: list[dict], overall_score: float) -> list[dict]:
    items = []
    pending_question = ""

    for msg in conversation_history:
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        if msg.get("role") == "assistant":
            pending_question = content
            continue
        if msg.get("role") == "user" and pending_question:
            rating = _rating_for_answer(content, overall_score)
            feedback = (
                "Clear answer with enough detail to evaluate the response."
                if rating == "Strong"
                else "Reasonable answer, but it would be stronger with more specific impact and trade-offs."
                if rating == "Pass"
                else "Answer was brief; add a concrete example, actions taken, and measurable result."
            )
            items.append({
                "question": pending_question,
                "answer": content,
                "rating": rating,
                "feedback": feedback,
            })
            pending_question = ""

    return items


def _normalize_transcript_items(value, conversation_history: list[dict], overall_score: float) -> list[dict]:
    normalized = []
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue
            question = str(item.get("question") or "").strip()
            answer = str(item.get("answer") or "").strip()
            if not question and not answer:
                continue
            rating = str(item.get("rating") or "Pass").strip()
            if rating not in {"Strong", "Pass", "Needs Improvement", "Needs improvement"}:
                rating = "Pass"
            if rating == "Needs improvement":
                rating = "Needs Improvement"
            normalized.append({
                "question": question,
                "answer": answer,
                "rating": rating,
                "feedback": str(item.get("feedback") or "").strip(),
                "note": str(item.get("note") or "").strip(),
                "timestamp": item.get("timestamp"),
            })

    return normalized or _fallback_transcript_items(conversation_history, overall_score)


def _fallback_strengths(items: list[dict], overall_score: float) -> list[str]:
    answered = [item for item in items if (item.get("answer") or "").strip()]
    strong = [item for item in answered if item.get("rating") == "Strong"]

    strengths = []
    if answered:
        strengths.append(f"Completed {len(answered)} recorded interview answer{'s' if len(answered) != 1 else ''} with enough context for review")
    if strong:
        strengths.append("Delivered at least one strong response with clear structure and substance")
    elif overall_score >= 60:
        strengths.append("Maintained a solid baseline across the interview and stayed engaged with the questions")
    else:
        strengths.append("Stayed present through the interview and provided material to build from")
    strengths.append("Created a transcript that can be reviewed for targeted practice")
    return strengths[:3]


def _fallback_improvements(items: list[dict], overall_score: float) -> list[str]:
    answers = [(item.get("answer") or "") for item in items]
    combined = " ".join(answers).lower()
    improvements = []

    if not any(char.isdigit() for char in combined):
        improvements.append("Add specific metrics or measurable outcomes to make answers more evidence-based")
    if any(len(answer.split()) < 25 for answer in answers) or not answers:
        improvements.append("Expand shorter answers with the situation, action, result, and trade-off")
    if not any(token in combined for token in ("trade-off", "tradeoff", "priorit", "because", "decided")):
        improvements.append("Explain decision reasoning and trade-offs more explicitly")
    if overall_score < 60 and len(improvements) < 3:
        improvements.append("Practice structuring answers before speaking to improve clarity")

    return (improvements or ["Add more concrete examples, metrics, and reflection in future answers"])[:3]


def _normalize_feedback_data(feedback_data, conversation_history: list[dict]) -> dict:
    if not isinstance(feedback_data, dict):
        feedback_data = {}

    try:
        score = float(feedback_data.get("overall_score", 70))
    except (TypeError, ValueError):
        score = 70.0
    score = max(0.0, min(100.0, score))

    transcript_items = _normalize_transcript_items(
        feedback_data.get("transcript_items", []),
        conversation_history,
        score,
    )
    strengths = _clean_string_list(feedback_data.get("strengths", [])) or _fallback_strengths(transcript_items, score)
    improvements = _clean_string_list(feedback_data.get("improvements", [])) or _fallback_improvements(transcript_items, score)
    recommended_actions = _clean_string_list(feedback_data.get("recommended_actions", []), max_items=5)
    if not recommended_actions:
        recommended_actions = [
            "Review the transcript and rewrite one answer using STAR structure",
            "Add one metric and one trade-off to each practice answer",
        ]

    dimension_scores = feedback_data.get("dimension_scores")
    if not isinstance(dimension_scores, dict):
        dimension_scores = {}
    normalized_dimensions = DEFAULT_DIMENSION_SCORES | {
        key: max(1.0, min(5.0, float(value)))
        for key, value in dimension_scores.items()
        if key in DEFAULT_DIMENSION_SCORES and isinstance(value, (int, float))
    }

    summary = str(feedback_data.get("summary") or "").strip()
    if not summary:
        summary = "Interview completed. The report was generated from the recorded transcript and highlights the clearest practice priorities."

    overall_rating = feedback_data.get("overall_rating") or (
        "Excellent" if score >= 85 else "Good" if score >= 60 else "Needs Improvement"
    )
    if overall_rating not in {"Excellent", "Good", "Needs Improvement"}:
        overall_rating = "Excellent" if score >= 85 else "Good" if score >= 60 else "Needs Improvement"

    return {
        "overall_score": score,
        "overall_rating": overall_rating,
        "summary": summary,
        "strengths": strengths,
        "improvements": improvements,
        "recommended_actions": recommended_actions,
        "dimension_scores": normalized_dimensions,
        "transcript_items": transcript_items,
    }


def _feedback_response_data(fb: InterviewFeedback | None) -> dict:
    if not fb:
        return {
            "overall_score": 70.0,
            "overall_rating": "Good",
            "summary": "",
            "strengths": [],
            "improvements": [],
            "recommended_actions": [],
            "transcript_items": [],
            "dimension_scores": {},
        }

    return _normalize_feedback_data({
        "overall_score": fb.overall_score,
        "strengths": fb.strengths,
        "improvements": fb.improvements,
        "recommended_actions": fb.recommended_actions,
        "dimension_scores": fb.dimension_scores,
        "transcript_items": fb.transcript_items,
    }, [])


@router.post("/sessions")
async def create_session(
    data: InterviewSessionCreate,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    persona = INTERVIEWER_PERSONAS.get(data.interviewer_id, INTERVIEWER_PERSONAS["alex"])
    session = InterviewSession(
        user_key=user_key,
        role_id=data.role_id,
        interviewer_id=data.interviewer_id,
        interviewer_name=persona["name"],
        interviewer_avatar=persona["avatar"],
        transcript_consent=data.transcript_consent,
        status="pending",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"id": session.id, "status": session.status}


@router.post("/sessions/{session_id}/finish")
async def finish_session(
    session_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    """Finish a Gemini Live session: receive transcript, generate feedback."""
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.user_key == user_key,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    # Build conversation_history from transcript entries
    transcript_entries = data.get("transcript", [])
    conversation_history = []
    questions_asked = []
    for entry in transcript_entries:
        role = entry.get("role", "")
        text = entry.get("text", "")
        if role == "ai":
            conversation_history.append({"role": "assistant", "content": text})
            questions_asked.append(text)
        elif role == "user":
            conversation_history.append({"role": "user", "content": text})

    # Resolve role info
    role_title = ""
    company = ""
    gap_summary = ""
    if session.role_id:
        role_result = await db.execute(select(TargetRole).where(TargetRole.id == session.role_id))
        role = role_result.scalar_one_or_none()
        if role:
            role_title = role.title
            company = role.company

    # Update interviewer if provided (fixes mismatch between session record and actual persona)
    new_interviewer_id = data.get("interviewer_id")
    if new_interviewer_id and new_interviewer_id in INTERVIEWER_PERSONAS:
        persona = INTERVIEWER_PERSONAS[new_interviewer_id]
        session.interviewer_id = new_interviewer_id
        session.interviewer_name = persona["name"]
        session.interviewer_avatar = persona["avatar"]

    session.started_at = session.started_at or session.created_at
    await _end_session(
        db=db,
        session=session,
        conversation_history=conversation_history,
        questions_asked=questions_asked,
        role_title=role_title,
        company=company,
        session_id=session_id,
        gap_summary=gap_summary,
        user_scores={},
    )

    return {"status": "completed", "session_id": session_id}


@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.user_key == user_key)
        .order_by(InterviewSession.created_at.desc())
        .limit(20)
    )
    sessions = result.scalars().all()

    out = []
    for s in sessions:
        # Resolve role title and company
        role_title = ""
        company = ""
        if s.role_id:
            role_result = await db.execute(select(TargetRole).where(TargetRole.id == s.role_id))
            role = role_result.scalar_one_or_none()
            if role:
                role_title = role.title
                company = role.company

        # Get feedback for strengths/improvements
        fb_result = await db.execute(
            select(InterviewFeedback).where(InterviewFeedback.session_id == s.id)
        )
        fb = fb_result.scalar_one_or_none()
        fb_data = _feedback_response_data(fb)

        out.append({
            "id": str(s.id),
            "roleId": str(s.role_id) if s.role_id else None,
            "roleTitle": role_title or s.interviewer_id,
            "company": company,
            "date": (s.started_at or s.created_at).isoformat(),
            "duration": s.duration,
            "interviewer": {
                "name": s.interviewer_name or s.interviewer_id,
                "avatar": s.interviewer_avatar or "",
            },
            "overallRating": s.overall_rating or (fb_data["overall_rating"] if fb else ""),
            "summary": s.summary or (fb_data["summary"] if fb else ""),
            "strengths": fb_data["strengths"] if fb else [],
            "improvements": fb_data["improvements"] if fb else [],
            "transcript": fb_data["transcript_items"] if fb else [],
            "status": s.status,
        })

    return out


@router.get("/sessions/{session_id}/detail")
async def get_session_detail(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    """Get full interview session detail for Interview Reports view."""
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.user_key == user_key,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    # Resolve role
    role_title = ""
    company = ""
    if session.role_id:
        role_result = await db.execute(select(TargetRole).where(TargetRole.id == session.role_id))
        role = role_result.scalar_one_or_none()
        if role:
            role_title = role.title
            company = role.company

    # Get feedback
    fb_result = await db.execute(
        select(InterviewFeedback).where(InterviewFeedback.session_id == session_id)
    )
    fb = fb_result.scalar_one_or_none()
    fb_data = _feedback_response_data(fb)

    return {
        "id": str(session.id),
        "roleId": str(session.role_id) if session.role_id else None,
        "roleTitle": role_title,
        "company": company,
        "date": (session.started_at or session.created_at).isoformat(),
        "duration": session.duration,
        "interviewer": {
            "name": session.interviewer_name or session.interviewer_id,
            "avatar": session.interviewer_avatar or "",
        },
        "overallRating": session.overall_rating or (fb_data["overall_rating"] if fb else ""),
        "summary": session.summary or (fb_data["summary"] if fb else ""),
        "strengths": fb_data["strengths"] if fb else [],
        "improvements": fb_data["improvements"] if fb else [],
        "transcript": fb_data["transcript_items"] if fb else [],
    }


@router.get("/sessions/{session_id}/feedback")
async def get_session_feedback(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    result = await db.execute(
        select(InterviewFeedback).where(
            InterviewFeedback.session_id == session_id,
            InterviewFeedback.user_key == user_key,
        )
    )
    fb = result.scalar_one_or_none()
    if not fb:
        raise HTTPException(404, "No feedback yet for this session")
    fb_data = _feedback_response_data(fb)
    return {
        "session_id": fb.session_id,
        "overall_score": fb_data["overall_score"],
        "summary": fb_data["summary"],
        "overall_rating": fb_data["overall_rating"],
        "strengths": fb_data["strengths"],
        "improvements": fb_data["improvements"],
        "recommended_actions": fb_data["recommended_actions"],
        "transcript": fb.transcript,
        "transcript_items": fb_data["transcript_items"],
        "dimension_scores": fb_data["dimension_scores"],
        "created_at": fb.created_at.isoformat(),
    }


@router.websocket("/sessions/{session_id}/stream")
async def interview_websocket(
    websocket: WebSocket,
    session_id: int,
    token: str = Query(...),
):
    """
    WebSocket for live mock interview.

    Short-term Memory: In-context conversation history.
    Context Manager: Sliding window to manage token budget.
    Long-term Memory: Written when session ends.

    Message protocol (JSON):
    Client → Server:
      {"type": "start"}                          — begin session
      {"type": "answer", "content": "..."}       — candidate answer
      {"type": "next"}                            — advance to next question
      {"type": "end"}                             — end interview early

    Server → Client:
      {"type": "question", "content": "...", "index": N, "total": M}
      {"type": "feedback_ready"}                  — feedback generated, fetch via REST
      {"type": "error", "content": "..."}
    """
    # Authenticate via query-param token (WebSocket can't set headers)
    try:
        ws_user_key = await verify_supabase_token(token)
    except (JWTError, Exception):
        await websocket.close(code=4001)
        return

    await websocket.accept()

    async with AsyncSessionLocal() as db:
        # Load session and verify ownership
        result = await db.execute(
            select(InterviewSession).where(
                InterviewSession.id == session_id,
                InterviewSession.user_key == ws_user_key,
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            await websocket.send_json({"type": "error", "content": "Session not found"})
            await websocket.close()
            return

        # Load role context
        role_title = "General"
        company = ""
        jd_snippet = ""
        gap_summary = "No gap analysis available."

        if session.role_id:
            role_result = await db.execute(select(TargetRole).where(TargetRole.id == session.role_id))
            role = role_result.scalar_one_or_none()
            if role:
                role_title = role.title
                company = role.company
                jd_snippet = role.jd[:500]

                # Compute gap summary
                dim_result = await db.execute(
                    select(RoleDimensionModel).where(RoleDimensionModel.role_id == session.role_id)
                )
                dim_model = dim_result.scalar_one_or_none()
                uds_result = await db.execute(
                    select(UserDimensionScore).where(UserDimensionScore.user_key == ws_user_key)
                )
                uds_list = uds_result.scalars().all()
                user_scores = {u.dimension: u.score for u in uds_list}

                if dim_model and user_scores:
                    _, gaps = compute_match_score(user_scores, dim_model.dimensions)
                    gap_summary = build_gap_summary(gaps)

        # Build system prompt from long-term memory
        system_prompt = await build_session_system_prompt(
            db=db,
            user_key=ws_user_key,
            interviewer_id=session.interviewer_id,
            role_title=role_title,
            company=company,
            jd_snippet=jd_snippet,
            gap_summary=gap_summary,
            session_id=session_id,
        )

        # Session state (Short-term Memory)
        conversation_history: list[dict] = []
        questions_asked: list[str] = []
        question_index = 0
        MAX_QUESTIONS = 10

        # Mark session as active
        session.status = "active"
        session.started_at = datetime.utcnow()
        await db.commit()

        try:
            while True:
                raw = await websocket.receive_text()
                msg = json.loads(raw)
                msg_type = msg.get("type")

                if msg_type == "start":
                    # First question from AI
                    conversation_history.append({
                        "role": "user",
                        "content": f"Please start the interview for {role_title} at {company}. Begin with your first question."
                    })

                    windowed = build_context_window(conversation_history, system_prompt)
                    ai_response = await get_next_interview_question(
                        system_prompt=system_prompt,
                        conversation_history=windowed,
                        interviewer_id=session.interviewer_id,
                    )

                    conversation_history.append({"role": "assistant", "content": ai_response})
                    questions_asked.append(ai_response)
                    question_index += 1

                    # Save to DB (Short-term Memory)
                    db.add(InterviewMessage(
                        session_id=session_id,
                        role="ai",
                        content=ai_response,
                        question_index=question_index,
                    ))
                    await db.commit()

                    await websocket.send_json({
                        "type": "question",
                        "content": ai_response,
                        "index": question_index,
                        "total": MAX_QUESTIONS,
                    })

                elif msg_type == "answer":
                    candidate_answer = msg.get("content", "")

                    # Save candidate answer
                    db.add(InterviewMessage(
                        session_id=session_id,
                        role="user",
                        content=candidate_answer,
                        question_index=question_index,
                    ))
                    conversation_history.append({"role": "user", "content": candidate_answer})

                    if question_index >= MAX_QUESTIONS:
                        # End interview
                        await _end_session(
                            db, session, conversation_history, questions_asked,
                            role_title, company, session_id, gap_summary, user_scores if 'user_scores' in dir() else {}
                        )
                        await websocket.send_json({"type": "feedback_ready"})
                        break

                    # AI follow-up or next question
                    windowed = build_context_window(conversation_history, system_prompt)
                    ai_response = await get_next_interview_question(
                        system_prompt=system_prompt,
                        conversation_history=windowed,
                        interviewer_id=session.interviewer_id,
                    )

                    conversation_history.append({"role": "assistant", "content": ai_response})
                    question_index += 1

                    if "[INTERVIEW_COMPLETE]" in ai_response:
                        clean_response = ai_response.replace("[INTERVIEW_COMPLETE]", "").strip()
                        db.add(InterviewMessage(
                            session_id=session_id,
                            role="ai",
                            content=clean_response,
                            question_index=question_index,
                        ))
                        await db.commit()

                        await _end_session(
                            db, session, conversation_history, questions_asked,
                            role_title, company, session_id, gap_summary,
                            user_scores if 'user_scores' in dir() else {}
                        )
                        await websocket.send_json({"type": "feedback_ready"})
                        break
                    else:
                        if "[NEXT_QUESTION]" in ai_response:
                            clean_response = ai_response.replace("[NEXT_QUESTION]", "").strip()
                        else:
                            clean_response = ai_response
                            questions_asked.append(clean_response)

                        db.add(InterviewMessage(
                            session_id=session_id,
                            role="ai",
                            content=clean_response,
                            question_index=question_index,
                        ))
                        await db.commit()

                        await websocket.send_json({
                            "type": "question",
                            "content": clean_response,
                            "index": question_index,
                            "total": MAX_QUESTIONS,
                        })

                elif msg_type == "end":
                    await _end_session(
                        db, session, conversation_history, questions_asked,
                        role_title, company, session_id, gap_summary,
                        user_scores if 'user_scores' in dir() else {}
                    )
                    await websocket.send_json({"type": "feedback_ready"})
                    break

        except WebSocketDisconnect:
            # Session abandoned — still save what we have
            if session.status == "active":
                session.status = "completed"
                session.ended_at = datetime.utcnow()
                await db.commit()
        except Exception as e:
            await websocket.send_json({"type": "error", "content": str(e)})


async def _end_session(
    db: AsyncSession,
    session: InterviewSession,
    conversation_history: list[dict],
    questions_asked: list[str],
    role_title: str,
    company: str,
    session_id: int,
    gap_summary: str,
    user_scores: dict,
):
    """Generate feedback and write to Long-term Memory."""
    persona = INTERVIEWER_PERSONAS.get(session.interviewer_id, INTERVIEWER_PERSONAS["alex"])

    # Build transcript text
    transcript_lines = []
    for msg in conversation_history:
        prefix = persona["name"] if msg["role"] == "assistant" else "Candidate"
        transcript_lines.append(f"{prefix}: {msg['content']}")
    transcript = "\n\n".join(transcript_lines)

    # Generate feedback via LLM
    try:
        feedback_data = await generate_session_feedback(
            transcript=transcript,
            role_title=role_title,
            company=company,
            interviewer_name=persona["name"],
            gap_summary=gap_summary,
        )
    except Exception:
        feedback_data = {
            "overall_score": 70,
            "overall_rating": "Good",
            "summary": "The candidate completed the interview session.",
            "strengths": ["Completed the interview session"],
            "improvements": ["Add more specific examples with metrics"],
            "recommended_actions": ["Practice STAR method responses"],
            "dimension_scores": {
                "product_intuition": 3.0,
                "user_empathy": 3.0,
                "metrics_driven_thinking": 3.0,
                "structured_problem_solving": 3.0,
                "prioritization_tradeoffs": 3.0,
                "execution_delivery": 3.0,
                "strategic_thinking": 3.0,
                "cross_functional_leadership": 3.0,
                "stakeholder_communication": 3.0,
                "technical_fluency": 3.0,
            },
            "transcript_items": [],
        }

    feedback_data = _normalize_feedback_data(feedback_data, conversation_history)
    score = feedback_data["overall_score"]
    overall_rating = feedback_data["overall_rating"]

    # Update session fields
    session.status = "completed"
    session.ended_at = datetime.utcnow()
    session.overall_rating = overall_rating
    session.summary = feedback_data.get("summary", "")
    if session.started_at and session.ended_at:
        session.duration = int((session.ended_at - session.started_at).total_seconds())

    # Save or update feedback. Finishing can be retried from the client, and the
    # session_id column is unique.
    fb_result = await db.execute(
        select(InterviewFeedback).where(InterviewFeedback.session_id == session_id)
    )
    fb = fb_result.scalar_one_or_none()
    if not fb:
        fb = InterviewFeedback(session_id=session_id, user_key=session.user_key)
        db.add(fb)

    fb.user_key = session.user_key
    fb.overall_score = score
    fb.strengths = feedback_data["strengths"]
    fb.improvements = feedback_data["improvements"]
    fb.recommended_actions = feedback_data["recommended_actions"]
    fb.transcript = transcript if session.transcript_consent else ""
    fb.dimension_scores = feedback_data["dimension_scores"]
    fb.transcript_items = feedback_data["transcript_items"]

    await db.commit()
    await db.refresh(fb)

    # Write to Long-term Memory
    dim_scores = fb.dimension_scores
    weakness_vector = compute_weakness_vector(
        {d: v for d, v in dim_scores.items()},
        role_model=None,
    )

    await update_long_term_memory(
        db=db,
        user_key=session.user_key,
        session_id=session_id,
        feedback=fb,
        weakness_vector=weakness_vector,
        questions_asked=questions_asked,
    )


# ─── Transcript Notes ────────────────────────────────────────────────────────

@router.patch("/sessions/{session_id}/feedback/notes/{item_index}")
async def update_transcript_note(
    session_id: int,
    item_index: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    """Persist a user's reflection note on a specific transcript Q&A item."""
    result = await db.execute(
        select(InterviewFeedback).where(
            InterviewFeedback.session_id == session_id,
            InterviewFeedback.user_key == user_key,
        )
    )
    fb = result.scalar_one_or_none()
    if not fb:
        raise HTTPException(404, "Feedback not found for this session")

    items = list(fb.transcript_items or [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(404, f"transcript_items index {item_index} out of range")

    items[item_index] = {**items[item_index], "note": body.get("note", "")}
    fb.transcript_items = items
    await db.commit()
    return {"ok": True}


# ─── Question Bank CRUD ──────────────────────────────────────────────────────

@router.get("/questions")
async def list_saved_questions(
    role_id: str | None = None,
    question_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    """List saved questions, optionally filtered by role_id and/or type."""
    query = select(SavedQuestion).where(SavedQuestion.user_key == user_key)
    if role_id:
        query = query.where(SavedQuestion.role_id == role_id)
    if question_type:
        query = query.where(SavedQuestion.type == question_type)
    query = query.order_by(SavedQuestion.last_modified.desc())

    result = await db.execute(query)
    questions = result.scalars().all()

    return [
        {
            "id": str(q.id),
            "roleId": q.role_id,
            "type": q.type,
            "question": q.question,
            "answer": q.answer,
            "source": q.source,
            "chatHistory": q.chat_history,
            "transcription": q.transcription,
            "savedAt": q.saved_at.isoformat(),
            "lastModified": q.last_modified.isoformat(),
        }
        for q in questions
    ]


@router.post("/questions")
async def create_saved_question(
    data: SavedQuestionCreate,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    """Save a question to the Question Bank."""
    # Check for duplicates
    existing = await db.execute(
        select(SavedQuestion).where(
            SavedQuestion.user_key == user_key,
            SavedQuestion.role_id == data.role_id,
            SavedQuestion.question == data.question,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "This question is already saved for this role")

    q = SavedQuestion(
        user_key=user_key,
        role_id=data.role_id,
        type=data.type,
        question=data.question,
        answer=data.answer or "",
        source=data.source or "MOCK_PREP",
        chat_history=data.chat_history or [],
        transcription=data.transcription or "",
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)

    return {
        "id": str(q.id),
        "roleId": q.role_id,
        "type": q.type,
        "question": q.question,
        "answer": q.answer,
        "source": q.source,
        "chatHistory": q.chat_history,
        "transcription": q.transcription,
        "savedAt": q.saved_at.isoformat(),
        "lastModified": q.last_modified.isoformat(),
    }


@router.put("/questions/{question_id}")
async def update_saved_question(
    question_id: int,
    data: SavedQuestionUpdate,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    """Update a saved question's answer, chat history, or transcription."""
    result = await db.execute(
        select(SavedQuestion).where(
            SavedQuestion.id == question_id,
            SavedQuestion.user_key == user_key,
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Question not found")

    if data.answer is not None:
        q.answer = data.answer
    if data.chat_history is not None:
        q.chat_history = data.chat_history
    if data.transcription is not None:
        q.transcription = data.transcription
    q.last_modified = datetime.utcnow()

    await db.commit()
    await db.refresh(q)

    return {
        "id": str(q.id),
        "roleId": q.role_id,
        "type": q.type,
        "question": q.question,
        "answer": q.answer,
        "source": q.source,
        "chatHistory": q.chat_history,
        "transcription": q.transcription,
        "savedAt": q.saved_at.isoformat(),
        "lastModified": q.last_modified.isoformat(),
    }


@router.delete("/questions/{question_id}")
async def delete_saved_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    user_key: str = Depends(get_current_user_key),
):
    """Delete a saved question."""
    result = await db.execute(
        select(SavedQuestion).where(
            SavedQuestion.id == question_id,
            SavedQuestion.user_key == user_key,
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Question not found")

    await db.delete(q)
    await db.commit()
    return {"ok": True}
