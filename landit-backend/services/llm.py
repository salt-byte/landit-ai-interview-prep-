"""
LLM service — all Gemini API calls go through here.
Keeps API logic in one place, easy to swap models.
"""
import json
import re
from google import genai
from config import settings, DIMENSIONS, DIMENSION_LABELS

client = genai.Client(api_key=settings.gemini_api_key)
MODEL = "gemini-2.0-flash"


async def _generate(prompt: str, max_tokens: int = 4096, system: str = "") -> str:
    """Unified async wrapper for Gemini generateContent."""
    config = {"max_output_tokens": max_tokens}
    if system:
        config["system_instruction"] = system

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=config,
    )
    return response.text.strip()


def _parse_json(raw: str) -> dict | list:
    """Strip markdown fences and parse JSON."""
    raw = re.sub(r"^```(?:json)?\n?", "", raw).rstrip("```").strip()
    return json.loads(raw)


async def extract_profile_from_resume(resume_text: str) -> dict:
    """Layer 2: Parse raw resume text -> structured profile fields."""
    prompt = f"""Extract structured information from this resume. Return ONLY valid JSON with this exact schema:
{{
  "fullName": "string",
  "targetRole": "string (comma-separated role types they target)",
  "employmentType": "string (Full-time/Part-time/Internship)",
  "email": "string",
  "phoneNumber": "string",
  "location": "string",
  "personalWebsite": "string (if found)",
  "linkedInProfile": "string (if found)",
  "skills": {{
    "technicalSkills": "string (comma-separated)",
    "toolsAndTechnologies": "string (comma-separated)",
    "softSkills": "string (comma-separated)"
  }},
  "education": [
    {{
      "institutionName": "string",
      "degree": "string",
      "fieldOfStudy": "string",
      "startDate": "string",
      "endDate": "string",
      "gpa": "string",
      "relevantCoursework": "string",
      "additionalDetails": "string"
    }}
  ],
  "workExperience": [
    {{
      "companyName": "string",
      "jobTitle": "string",
      "startDate": "string",
      "endDate": "string",
      "description": "string (bullet points, each line starting with bullet)"
    }}
  ],
  "projects": [
    {{
      "projectName": "string",
      "projectDescription": "string",
      "startDate": "string",
      "endDate": "string",
      "projectLink": "string (if found, else empty)"
    }}
  ]
}}

Resume:
{resume_text}"""

    raw = await _generate(prompt, max_tokens=4096)
    return _parse_json(raw)


async def extract_dimension_scores(profile_text: str) -> dict:
    """Layer 3: Map user experience -> 15 dimension scores (1-5) + evidence."""
    dims_str = "\n".join([f"- {k}: {v}" for k, v in DIMENSION_LABELS.items()])
    prompt = f"""You are an expert career assessor. Score the candidate on 15 competency dimensions based on their background.

DIMENSIONS:
{dims_str}

SCORING RUBRIC (1-5):
1 = No evidence / not demonstrated
2 = Basic / junior level evidence
3 = Competent / mid-level evidence
4 = Strong / senior level evidence
5 = Exceptional / expert level evidence

IMPORTANT: Every score MUST include specific evidence from the profile. Do not infer without basis.

Return ONLY valid JSON:
{{
  "dimension_key": {{
    "score": <float 1.0-5.0>,
    "evidence": "specific quote or example from profile",
    "confidence": "confirmed" | "inferred" | "mentioned"
  }},
  ...
}}

Candidate profile:
{profile_text}"""

    raw = await _generate(prompt, max_tokens=2048)
    return _parse_json(raw)


async def extract_jd_dimension_model(jd_text: str, role_title: str, company: str) -> dict:
    """Layer 3: Map JD -> 15 dimension required scores + weights."""
    dims_str = "\n".join([f"- {k}: {v}" for k, v in DIMENSION_LABELS.items()])
    prompt = f"""You are an expert talent assessor. Analyze this job description and map it to 15 competency dimensions.

Role: {role_title} at {company}

DIMENSIONS:
{dims_str}

For each dimension, output:
- required_score: How high does the candidate need to score? (1.0-5.0)
- weight: How important is this dimension for THIS role? (will be normalized, use 0-10 scale)

Return ONLY valid JSON:
{{
  "dimension_key": {{
    "required_score": <float 1.0-5.0>,
    "weight": <float 0-10>
  }},
  ...
}}

All 15 dimensions must be present. Set weight=0 for irrelevant dimensions.

Job Description:
{jd_text}"""

    raw = await _generate(prompt, max_tokens=1024)
    return _parse_json(raw)


async def generate_interview_prep(
    role_title: str,
    company: str,
    jd: str,
    profile_summary: str,
    gap_summary: str,
    mode: str,
    categories: list[str],
) -> str:
    """Layer 5: Generate interview Q&A tailored to role + user gap."""
    include_answers = mode == "QA"
    cat_list = ", ".join(categories)
    answer_instruction = (
        "Include detailed answer frameworks using STAR method where applicable, key points, and pitfalls to avoid."
        if include_answers
        else "List questions only - no answers."
    )

    prompt = f"""You are an expert interview coach preparing a candidate for: {role_title} at {company}.

Candidate profile summary:
{profile_summary}

Key skill gaps vs role requirements:
{gap_summary}

Generate a comprehensive interview preparation guide covering these categories: {cat_list}.

{answer_instruction}

Format in clean Markdown with:
- ## for category headers
- ### Q: for each question
- **Answer Framework:** or **Key Points:** for guidance (if including answers)
- Focus questions on the candidate's actual gaps and role-specific requirements

Job Description context:
{jd[:1500]}"""

    return await _generate(prompt, max_tokens=4096)


async def refine_prep_with_chat(
    current_content: str,
    user_message: str,
    role_title: str,
    company: str,
) -> str:
    """Chat refinement for interview prep content."""
    prompt = f"""You are an interview coach helping refine an interview prep document for {role_title} at {company}.

Current prep document:
---
{current_content[:3000]}
---

User request: {user_message}

Apply the requested changes and return the COMPLETE updated document in Markdown format.
Keep existing good content, only modify what was requested."""

    return await _generate(prompt, max_tokens=4096)


async def parse_jd_from_url_content(url: str, page_content: str) -> dict:
    """Extract job details from scraped page content."""
    prompt = f"""Extract job posting details from this web page content. Return ONLY valid JSON with ALL fields populated (use empty string if not found):
{{
  "title": "job title",
  "company": "company name",
  "jd": "full job description text (responsibilities + requirements combined)",
  "team_info": "team or department name if mentioned",
  "location": "job location (city, state, remote, hybrid, etc.)",
  "employmentType": "Full-time, Part-time, Internship, or Contract",
  "keyResponsibilities": "key responsibilities as bullet points, each starting with bullet",
  "qualifications": "required and preferred qualifications as bullet points",
  "companyOverview": "company description / about the company section",
  "teamOverview": "team description if mentioned",
  "additionalInfo": "salary, benefits, or other notable info"
}}

IMPORTANT: If the page content is minimal (e.g. from a JavaScript-rendered site like Workday, Lever, Greenhouse), use the URL and any available hints to infer the job title, company, and other details. For the "jd" field, if the actual description is unavailable, write a realistic and helpful job description based on the role title and company that the candidate can use for interview prep. Clearly note it is inferred.

URL: {url}
Content:
{page_content[:6000]}"""

    raw = await _generate(prompt, max_tokens=3000)
    return _parse_json(raw)


async def generate_session_feedback(
    transcript: str,
    role_title: str,
    company: str,
    interviewer_name: str,
    gap_summary: str,
) -> dict:
    """Generate structured feedback after a mock interview session."""
    prompt = f"""You are {interviewer_name}, an experienced interviewer. Analyze this mock interview transcript for the role of {role_title} at {company}.

Known skill gaps for this candidate:
{gap_summary}

Transcript:
{transcript[:4000]}

Provide structured feedback. Return ONLY valid JSON:
{{
  "overall_score": <int 0-100>,
  "overall_rating": "Excellent" | "Good" | "Needs Improvement",
  "summary": "2-3 sentence summary of the candidate's overall performance",
  "strengths": ["point 1", "point 2", "point 3"],
  "improvements": ["point 1", "point 2", "point 3"],
  "recommended_actions": ["specific action 1", "specific action 2"],
  "dimension_scores": {{
    "communication_clarity": <float 1-5>,
    "structured_thinking": <float 1-5>,
    "narrative_coherence": <float 1-5>
  }},
  "transcript_items": [
    {{
      "question": "the interviewer question",
      "answer": "the candidate answer",
      "rating": "Strong" | "Pass" | "Needs Improvement",
      "feedback": "one sentence of specific feedback on this answer"
    }}
  ]
}}

For overall_rating: use "Excellent" if overall_score >= 85, "Good" if >= 60, "Needs Improvement" otherwise.
Extract each distinct Q&A exchange from the transcript into transcript_items."""

    raw = await _generate(prompt, max_tokens=2048)
    return _parse_json(raw)


async def get_next_interview_question(
    system_prompt: str,
    conversation_history: list[dict],
    interviewer_id: str,
) -> str:
    """Generate next interview question from the AI interviewer (WebSocket use)."""
    # Build a single prompt from system + conversation history
    history_text = "\n".join(
        f"{'Interviewer' if m['role'] == 'assistant' else 'Candidate'}: {m['content']}"
        for m in conversation_history
    )

    return await _generate(
        prompt=history_text,
        max_tokens=512,
        system=system_prompt,
    )
