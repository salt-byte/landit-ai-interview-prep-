"""
Resume parser: Gemini 2.5 Flash parallel extraction with a Gemini 2.0
single-call fallback.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re

logger = logging.getLogger(__name__)


def _normalize_output(data: dict) -> dict:
    """Ensure the output matches the v3 schema."""
    skills = data.get("skills") or {}
    if isinstance(skills, list):
        skills = {"technicalSkills": ", ".join(str(s) for s in skills), "toolsAndTechnologies": "", "softSkills": ""}

    def clean_str(v) -> str:
        return str(v).strip() if v else ""

    def clean_list(v, default_keys) -> list[dict]:
        if not isinstance(v, list):
            return []
        result = []
        for item in v:
            if not isinstance(item, dict):
                continue
            entry = {k: clean_str(item.get(k, "")) for k in default_keys}
            if any(entry.values()):
                result.append(entry)
        return result

    return {
        "fullName": clean_str(data.get("fullName") or data.get("name", "")),
        "targetRole": clean_str(data.get("targetRole") or data.get("target_roles") or data.get("headline", "")),
        "employmentType": clean_str(data.get("employmentType", "")),
        "email": clean_str(data.get("email", "")),
        "phoneNumber": clean_str(data.get("phoneNumber", "")),
        "location": clean_str(data.get("location", "")),
        "personalWebsite": clean_str(data.get("personalWebsite", "")),
        "linkedInProfile": clean_str(data.get("linkedInProfile", "")),
        "skills": {
            "technicalSkills": clean_str(skills.get("technicalSkills") or skills.get("technical", "")),
            "toolsAndTechnologies": clean_str(skills.get("toolsAndTechnologies") or skills.get("product", "")),
            "softSkills": clean_str(skills.get("softSkills") or skills.get("communication", "")),
        },
        "education": clean_list(data.get("education", []), [
            "institutionName", "degree", "fieldOfStudy", "startDate", "endDate", "gpa", "relevantCoursework", "additionalDetails"
        ]),
        "workExperience": clean_list(data.get("workExperience", []), [
            "companyName", "jobTitle", "startDate", "endDate", "description"
        ]),
        "projects": clean_list(data.get("projects", []), [
            "projectName", "projectDescription", "startDate", "endDate", "projectLink"
        ]),
    }


def extract_profile_with_gemini(resume_text: str) -> dict:
    """Call Gemini to parse the resume. Raises on failure."""
    from google import genai
    from config import settings

    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = f"""You are a resume parser. Extract structured data from this resume text. The resume may be in any language (English, Chinese, etc.). Return ONLY valid JSON with all values in their original language.

Return this exact schema (all fields required, use empty string "" or [] if missing):
{{
  "fullName": "person's full name",
  "targetRole": "job title or target role inferred from resume",
  "employmentType": "Full-time or Internship",
  "email": "email address if found",
  "phoneNumber": "phone number if found",
  "location": "city, state/country",
  "personalWebsite": "personal website URL if found",
  "linkedInProfile": "LinkedIn URL if found",
  "skills": {{
    "technicalSkills": "comma-separated technical skills (SQL, Python, etc.)",
    "toolsAndTechnologies": "comma-separated tools (Figma, Tableau, etc.)",
    "softSkills": "comma-separated soft skills (leadership, communication, etc.)"
  }},
  "education": [
    {{
      "institutionName": "school name",
      "degree": "degree type (B.S., M.S., etc.)",
      "fieldOfStudy": "major/field",
      "startDate": "start year or date",
      "endDate": "end year or date",
      "gpa": "GPA if mentioned",
      "relevantCoursework": "courses if mentioned",
      "additionalDetails": "honors, focus area, etc."
    }}
  ],
  "workExperience": [
    {{
      "companyName": "company name",
      "jobTitle": "job title",
      "startDate": "start date",
      "endDate": "end date or Present",
      "description": "bullet points of responsibilities, each starting with bullet character"
    }}
  ],
  "projects": [
    {{
      "projectName": "project name",
      "projectDescription": "brief description",
      "startDate": "start date if found",
      "endDate": "end date if found",
      "projectLink": "URL if found"
    }}
  ]
}}

Resume text:
{resume_text[:8000]}"""

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

    data = json.loads(raw)
    return _normalize_output(data)


# ── Parallel async path: 3 concurrent Gemini 2.5 Flash calls ─────────────────
# Why split 3-way: each call's bottleneck is output token count. Splitting the
# response across 3 small calls means each finishes faster, and we run them
# concurrently — so total ≈ max of the slowest, ~6-10s instead of 18-22s.
# Why response_mime_type=application/json: the model emits strict JSON without
# markdown fences and stops sooner, ~20-30% faster than free-form prompting.

_FAST_MODEL = "gemini-2.5-flash"

# NOTE: prompts use a __TEXT__ placeholder rather than .format() because the
# JSON-shape examples below contain literal `{` and `}` that would otherwise
# need double-escaping.

_BASICS_PROMPT = """Extract ONLY contact info and skills from this resume.
Use "" for any missing string field. Keep values in their original language.

Required keys: fullName, targetRole, employmentType (Full-time/Internship),
email, phoneNumber, location, personalWebsite, linkedInProfile,
skills (object with technicalSkills, toolsAndTechnologies, softSkills as
comma-separated strings).

Resume:
__TEXT__"""


_EDUCATION_PROMPT = """Extract ONLY the education section from this resume as a JSON
object with one key "education" — a list of objects with fields:
institutionName, degree, fieldOfStudy, startDate, endDate, gpa,
relevantCoursework, additionalDetails. Use "" for missing string fields.
Return {"education": []} if no education found. Keep values in original language.

Resume:
__TEXT__"""


_HISTORY_PROMPT = """Extract ONLY work experience and projects from this resume as
a JSON object with two keys:
- "workExperience": list of objects with companyName, jobTitle, startDate,
  endDate, description (bullet points, each starting with a bullet character).
- "projects": list of objects with projectName, projectDescription,
  startDate, endDate, projectLink.
Use "" for missing string fields. Use [] for missing sections.

Resume:
__TEXT__"""


def _strip_json_fence(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    return raw.strip()


async def _gemini_call_async(prompt: str, max_tokens: int) -> dict:
    from google import genai
    from config import settings

    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=settings.gemini_api_key)
    # IMPORTANT: Gemini 2.5 Flash has "thinking" mode enabled by default which
    # adds 5-15s of latency. We disable it here for fast structured extraction.
    response = await client.aio.models.generate_content(
        model=_FAST_MODEL,
        contents=prompt,
        config={
            "max_output_tokens": max_tokens,
            "response_mime_type": "application/json",
            "thinking_config": {"thinking_budget": 0},
        },
    )
    return json.loads(_strip_json_fence(response.text))


# ── Public entrypoint ─────────────────────────────────────────────────────────

def extract_profile_from_resume(resume_text: str) -> dict:
    """Sync version: single Gemini call. Used as fallback if async path fails."""
    try:
        result = extract_profile_with_gemini(resume_text)
        logger.info("Resume parsed with Gemini 2.0 Flash (single call)")
        return result
    except Exception as e:
        logger.warning("Gemini parsing failed (%s), returning empty profile", e)
        return _normalize_output({})


async def extract_profile_from_resume_async(resume_text: str) -> dict:
    """Async parallel version: 3 concurrent Gemini 2.5 Flash calls."""
    text = resume_text[:6000]
    try:
        basics, edu, history = await asyncio.gather(
            _gemini_call_async(_BASICS_PROMPT.replace("__TEXT__", text), max_tokens=400),
            _gemini_call_async(_EDUCATION_PROMPT.replace("__TEXT__", text), max_tokens=600),
            _gemini_call_async(_HISTORY_PROMPT.replace("__TEXT__", text), max_tokens=1500),
        )
        logger.info("Resume parsed with Gemini 2.5 Flash (3-way parallel)")
        return _normalize_output({**basics, **edu, **history})
    except Exception as e:
        logger.warning("Parallel resume parsing failed (%s), falling back to single call", e)
        return await asyncio.to_thread(extract_profile_from_resume, resume_text)
