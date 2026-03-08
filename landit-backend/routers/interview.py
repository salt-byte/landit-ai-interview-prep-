"""
Mock Interview router — WebSocket + REST.
Short-term memory: session transcript (DB).
Long-term memory: written after session end.
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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

router = APIRouter(prefix="/interview", tags=["interview"])

USER_KEY = "default"

# Per-session state (in-memory for WebSocket duration)
# In production, use Redis for multi-instance support
active_sessions: dict[int, dict] = {}


@router.post("/sessions")
async def create_session(
    data: InterviewSessionCreate,
    db: AsyncSession = Depends(get_db),
):
    session = InterviewSession(
        user_key=USER_KEY,
        role_id=data.role_id,
        interviewer_id=data.interviewer_id,
        transcript_consent=data.transcript_consent,
        status="pending",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"id": session.id, "status": session.status}


@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.user_key == USER_KEY)
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
            "overallRating": s.overall_rating or "",
            "summary": s.summary or "",
            "strengths": fb.strengths if fb else [],
            "improvements": fb.improvements if fb else [],
            "transcript": fb.transcript_items if fb else [],
            "status": s.status,
        })

    return out


@router.get("/sessions/{session_id}/detail")
async def get_session_detail(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get full interview session detail for Interview Reports view."""
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
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
        "overallRating": session.overall_rating or "",
        "summary": session.summary or "",
        "strengths": fb.strengths if fb else [],
        "improvements": fb.improvements if fb else [],
        "transcript": fb.transcript_items if fb else [],
    }


@router.get("/sessions/{session_id}/feedback")
async def get_session_feedback(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InterviewFeedback).where(InterviewFeedback.session_id == session_id)
    )
    fb = result.scalar_one_or_none()
    if not fb:
        raise HTTPException(404, "No feedback yet for this session")
    return {
        "session_id": fb.session_id,
        "overall_score": fb.overall_score,
        "strengths": fb.strengths,
        "improvements": fb.improvements,
        "recommended_actions": fb.recommended_actions,
        "transcript": fb.transcript,
        "transcript_items": fb.transcript_items,
        "dimension_scores": fb.dimension_scores,
        "created_at": fb.created_at.isoformat(),
    }


@router.websocket("/sessions/{session_id}/stream")
async def interview_websocket(websocket: WebSocket, session_id: int):
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
    await websocket.accept()

    async with AsyncSessionLocal() as db:
        # Load session
        result = await db.execute(
            select(InterviewSession).where(InterviewSession.id == session_id)
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
                    select(UserDimensionScore).where(UserDimensionScore.user_key == USER_KEY)
                )
                uds_list = uds_result.scalars().all()
                user_scores = {u.dimension: u.score for u in uds_list}

                if dim_model and user_scores:
                    _, gaps = compute_match_score(user_scores, dim_model.dimensions)
                    gap_summary = build_gap_summary(gaps)

        # Build system prompt from long-term memory
        system_prompt = await build_session_system_prompt(
            db=db,
            user_key=USER_KEY,
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
            "strengths": ["Completed the interview session"],
            "improvements": ["Add more specific examples with metrics"],
            "recommended_actions": ["Practice STAR method responses"],
            "dimension_scores": {"communication_clarity": 3.0},
        }

    # Save feedback
    fb = InterviewFeedback(
        session_id=session_id,
        user_key=USER_KEY,
        overall_score=feedback_data.get("overall_score", 70),
        strengths=feedback_data.get("strengths", []),
        improvements=feedback_data.get("improvements", []),
        recommended_actions=feedback_data.get("recommended_actions", []),
        transcript=transcript if session.transcript_consent else "",
        dimension_scores=feedback_data.get("dimension_scores", {}),
    )
    db.add(fb)

    session.status = "completed"
    session.ended_at = datetime.utcnow()
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
        user_key=USER_KEY,
        session_id=session_id,
        feedback=fb,
        weakness_vector=weakness_vector,
        questions_asked=questions_asked,
    )


# ─── Question Bank CRUD ──────────────────────────────────────────────────────

@router.get("/questions")
async def list_saved_questions(
    role_id: str | None = None,
    question_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List saved questions, optionally filtered by role_id and/or type."""
    query = select(SavedQuestion).where(SavedQuestion.user_key == USER_KEY)
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
):
    """Save a question to the Question Bank."""
    # Check for duplicates
    existing = await db.execute(
        select(SavedQuestion).where(
            SavedQuestion.user_key == USER_KEY,
            SavedQuestion.role_id == data.role_id,
            SavedQuestion.question == data.question,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "This question is already saved for this role")

    q = SavedQuestion(
        user_key=USER_KEY,
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
):
    """Update a saved question's answer, chat history, or transcription."""
    result = await db.execute(
        select(SavedQuestion).where(
            SavedQuestion.id == question_id,
            SavedQuestion.user_key == USER_KEY,
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
):
    """Delete a saved question."""
    result = await db.execute(
        select(SavedQuestion).where(
            SavedQuestion.id == question_id,
            SavedQuestion.user_key == USER_KEY,
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Question not found")

    await db.delete(q)
    await db.commit()
    return {"ok": True}

