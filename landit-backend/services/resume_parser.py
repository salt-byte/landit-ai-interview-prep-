"""
Resume parser: GLM-4-Flash (primary) → heuristic fallback.

Set ZHIPUAI_API_KEY in .env or Render env vars to enable GLM parsing.
Falls back to pure-Python heuristics if the API key is absent or the call fails.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime

logger = logging.getLogger(__name__)

# ── GLM prompt ────────────────────────────────────────────────────────────────

_GLM_SYSTEM = """\
You are a resume parser. Extract structured data from the resume text and return ONLY valid JSON — no markdown, no explanation.

Return this exact schema (all fields required, use empty string "" or [] if missing):
{
  "name": "",
  "headline": "",
  "bio": "",
  "location": "",
  "target_roles": "",
  "education_level": "",
  "years_of_experience": "",
  "interests": "",
  "skills": {
    "technical": "",
    "product": "",
    "communication": ""
  },
  "education": [
    {
      "school": "",
      "degree": "",
      "major": "",
      "year": "",
      "key_coursework": "",
      "academic_focus": ""
    }
  ],
  "experience": [
    {
      "company": "",
      "role": "",
      "type": "",
      "duration": "",
      "responsibilities": ""
    }
  ],
  "projects": [
    {
      "name": "",
      "context": "",
      "role": "",
      "tools": "",
      "outcome": "",
      "learnings": ""
    }
  ]
}

Rules:
- name: person's full name only (e.g. "Yudie Deng"), not title or company
- headline: job title or professional summary in one line (e.g. "AI Product Manager")
- bio: 1-2 sentence professional summary (use the resume summary section if present)
- target_roles: comma-separated list of target/desired job titles inferred from headline + experience
- education_level: highest degree ("Bachelor's", "Master's", "PhD", "Associate's", or "")
- years_of_experience: e.g. "3 years" or ""
- skills.technical: comma-separated technical skills (tools, languages, frameworks)
- skills.product: comma-separated product/PM skills (roadmap, user research, A/B testing, etc.)
- skills.communication: comma-separated soft/communication skills
- experience[].type: "Internship", "Full-time", "Part-time", or "Contract"
- experience[].responsibilities: bullet points joined by newlines, max 6 bullets
- Return at most 5 education entries, 5 experience entries, 5 project entries
"""


def extract_profile_with_glm(resume_text: str) -> dict:
    """Call GLM-4-Flash to parse the resume. Raises on failure."""
    from zhipuai import ZhipuAI
    from config import settings

    if not settings.zhipuai_api_key:
        raise ValueError("ZHIPUAI_API_KEY not set")

    client = ZhipuAI(api_key=settings.zhipuai_api_key)

    response = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
            {"role": "system", "content": _GLM_SYSTEM},
            {"role": "user", "content": f"Parse this resume:\n\n{resume_text[:8000]}"},
        ],
        temperature=0.1,
        max_tokens=2048,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

    data = json.loads(raw)
    return _normalize_glm_output(data)


def _normalize_glm_output(data: dict) -> dict:
    """Ensure the GLM output matches the expected schema."""
    skills = data.get("skills") or {}
    if isinstance(skills, list):
        # GLM sometimes returns skills as a flat list — convert to dict
        skills = {"technical": ", ".join(str(s) for s in skills), "product": "", "communication": ""}

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
        "name": clean_str(data.get("name")),
        "headline": clean_str(data.get("headline")),
        "bio": clean_str(data.get("bio")),
        "location": clean_str(data.get("location")),
        "target_roles": clean_str(data.get("target_roles")),
        "education_level": clean_str(data.get("education_level")),
        "years_of_experience": clean_str(data.get("years_of_experience")),
        "interests": clean_str(data.get("interests")),
        "skills": {
            "technical": clean_str(skills.get("technical")),
            "product": clean_str(skills.get("product")),
            "communication": clean_str(skills.get("communication")),
        },
        "education": clean_list(data.get("education", []), [
            "school", "degree", "major", "year", "key_coursework", "academic_focus"
        ]),
        "experience": clean_list(data.get("experience", []), [
            "company", "role", "type", "duration", "responsibilities"
        ]),
        "projects": clean_list(data.get("projects", []), [
            "name", "context", "role", "tools", "outcome", "learnings"
        ]),
    }


# ── Public entrypoint ─────────────────────────────────────────────────────────

def extract_profile_from_resume(resume_text: str) -> dict:
    """
    Sync version: GLM-4-Flash first, heuristic fallback.
    Use extract_profile_from_resume_async in async contexts to avoid blocking.
    """
    try:
        result = extract_profile_with_glm(resume_text)
        logger.info("Resume parsed with GLM-4-Flash")
        return result
    except Exception as e:
        logger.warning("GLM parsing failed (%s), falling back to heuristic parser", e)
        return _heuristic_extract(resume_text)


async def extract_profile_from_resume_async(resume_text: str) -> dict:
    """
    Async version: runs GLM call in a thread pool so it doesn't block the event loop.
    Use this from FastAPI async route handlers.
    """
    return await asyncio.to_thread(extract_profile_from_resume, resume_text)


# ── Heuristic fallback ────────────────────────────────────────────────────────

SECTION_ALIASES = {
    "summary": "summary", "professional summary": "summary", "profile": "summary",
    "about": "summary", "about me": "summary", "objective": "summary",
    "career objective": "summary", "overview": "summary",
    "skills": "skills", "technical skills": "skills", "core competencies": "skills",
    "competencies": "skills", "skills & tools": "skills", "tools & technologies": "skills",
    "technologies": "skills", "technical expertise": "skills",
    "education": "education", "academic background": "education",
    "academic history": "education", "educational background": "education",
    "experience": "experience", "work experience": "experience",
    "professional experience": "experience", "employment": "experience",
    "employment history": "experience", "work history": "experience",
    "research experience": "experience", "internship experience": "experience",
    "internships": "experience", "research": "experience",
    "industry experience": "experience", "relevant experience": "experience",
    "leadership experience": "experience", "volunteer experience": "experience",
    "teaching experience": "experience",
    "projects": "projects", "project experience": "projects",
    "selected projects": "projects", "key projects": "projects",
    "personal projects": "projects", "academic projects": "projects",
    "interests": "interests", "activities": "interests", "leadership": "interests",
    "awards": "interests", "honors": "interests", "certifications": "interests",
    "publications": "interests", "languages": "interests",
}

DEGREE_PATTERNS = [
    r"ph\.?d\.?", r"doctor(?:ate)?", r"master(?:'s)?", r"m\.?s\.?", r"m\.?a\.?",
    r"mba", r"bachelor(?:'s)?", r"b\.?s\.?", r"b\.?a\.?", r"associate(?:'s)?",
]

TECHNICAL_KEYWORDS = {
    "sql", "python", "r", "java", "javascript", "typescript", "excel", "tableau",
    "power bi", "machine learning", "data analysis", "statistics", "a/b testing",
    "spark", "pandas", "numpy", "tensorflow", "pytorch", "etl", "postgresql",
}
PRODUCT_KEYWORDS = {
    "product", "product strategy", "roadmap", "prioritization", "user research",
    "go-to-market", "growth", "stakeholder management", "experimentation",
    "market analysis", "business strategy", "product analytics", "pricing",
}
COMMUNICATION_KEYWORDS = {
    "communication", "storytelling", "presentation", "writing", "leadership",
    "collaboration", "cross-functional", "stakeholder", "facilitation", "mentoring",
}


def _heuristic_extract(resume_text: str) -> dict:
    sections = _split_sections(resume_text)
    header = _parse_header(sections)
    skills = _parse_skills(sections.get("skills", []), resume_text)
    education = _parse_education(sections.get("education", []))
    experience = _parse_experience(sections.get("experience", []))
    projects = _parse_projects(sections.get("projects", []))
    interests = _parse_interests(sections.get("interests", []))

    headline = header["headline"] or _derive_headline(experience)
    years = _extract_years_of_experience(resume_text, experience)
    education_level = _extract_education_level(education)
    target_roles = _derive_target_roles(headline, experience)
    bio = _derive_bio(sections.get("summary", []), headline, experience, skills)

    return {
        "name": header["name"],
        "headline": headline,
        "bio": bio,
        "target_roles": target_roles,
        "location": header["location"],
        "education_level": education_level,
        "years_of_experience": years,
        "interests": interests,
        "skills": skills,
        "education": education,
        "experience": experience,
        "projects": projects,
    }


def _clean_line(line: str) -> str:
    line = line.replace("\u2022", "•").replace("\xa0", " ").strip()
    return re.sub(r"\s+", " ", line)


def _normalize_heading(line: str) -> str:
    line = re.sub(r"[^a-zA-Z/& ]", "", line).strip().lower()
    return re.sub(r"\s+", " ", line)


def _section_name(line: str) -> str | None:
    if not line:
        return None
    normalized = _normalize_heading(line)
    if normalized in SECTION_ALIASES:
        return SECTION_ALIASES[normalized]
    if len(normalized) <= 28 and normalized.replace(" ", "").isalpha():
        return SECTION_ALIASES.get(normalized)
    return None


def _split_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {"header": []}
    current = "header"
    for raw_line in text.splitlines():
        line = _clean_line(raw_line)
        section = _section_name(line)
        if section:
            current = section
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return sections


def _blocks(lines: list[str]) -> list[list[str]]:
    blocks: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if line:
            current.append(line)
        elif current:
            blocks.append(current)
            current = []
    if current:
        blocks.append(current)
    return blocks


def _is_contact_line(line: str) -> bool:
    low = line.lower()
    return bool(
        re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", line)
        or re.search(r"(?:\+?\d[\d\s().-]{7,}\d)", line)
        or "linkedin.com" in low or "github.com" in low
        or low.startswith("linkedin") or low.startswith("github")
    )


def _looks_like_location(line: str) -> bool:
    if not line or len(line) > 60:
        return False
    if re.search(r"\b(remote|relocate|relocation)\b", line, re.I):
        return True
    if re.fullmatch(r"[A-Za-z\s]+,\s*[A-Za-z]{2,}", line.strip()):
        return True
    if re.search(r"\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s?[A-Z]{2}\b", line) and len(line) < 50:
        return True
    return False


def _extract_name(first_line: str) -> tuple[str, str]:
    if not first_line:
        return "", ""
    for sep in [" | ", " — ", " - ", " / "]:
        if sep in first_line:
            parts = first_line.split(sep, 1)
            return parts[0].strip(), parts[1].strip()
    words = first_line.split()
    name_words = []
    for w in words:
        if w[0].isupper() and w.replace("-", "").isalpha() and len(w) <= 20:
            name_words.append(w)
            if len(name_words) == 3:
                break
        else:
            break
    if 2 <= len(name_words) <= 3:
        name = " ".join(name_words)
        return name, first_line[len(name):].strip(" ,|-")
    if len(words) <= 4:
        return first_line, ""
    return " ".join(words[:3]), " ".join(words[3:])


def _parse_header(sections: dict[str, list[str]]) -> dict[str, str]:
    header_lines = [line for line in sections.get("header", []) if line]
    non_contact = [line for line in header_lines if not _is_contact_line(line)]
    if not non_contact:
        return {"name": "", "headline": "", "location": "", "bio": ""}
    name, name_leftover = _extract_name(non_contact[0])
    headline = name_leftover
    bio_parts: list[str] = []
    location = ""
    for line in non_contact[1:]:
        if not location and _looks_like_location(line):
            location = line
            continue
        if not headline and len(line) <= 120:
            headline = line
            continue
        if len(line) > 150 or re.search(r"\b(present|current|\d{4})\b", line, re.I):
            break
        bio_parts.append(line)
    return {"name": name, "headline": headline, "location": location, "bio": " ".join(bio_parts[:3]).strip()}


def _split_skill_items(text: str) -> list[str]:
    return [item.strip(" •-") for item in re.split(r"[,\n|;/]+", text) if item.strip(" •-")]


def _categorize_skill(item: str) -> str:
    low = item.lower()
    if any(keyword in low for keyword in PRODUCT_KEYWORDS):
        return "product"
    if any(keyword in low for keyword in COMMUNICATION_KEYWORDS):
        return "communication"
    return "technical"


def _parse_skills(lines: list[str], full_text: str) -> dict[str, str]:
    text = "\n".join(line for line in lines if line)
    if not text:
        match = re.search(r"Skills?[:\s]+(.+)", full_text, re.I)
        text = match.group(1) if match else ""
    buckets: dict[str, list[str]] = {"technical": [], "product": [], "communication": []}
    seen: set[str] = set()
    for item in _split_skill_items(text):
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        buckets[_categorize_skill(item)].append(item)
    return {name: ", ".join(values) for name, values in buckets.items()}


def _extract_degree_and_major(line: str) -> tuple[str, str]:
    degree = ""
    major = ""
    low = line.lower()
    for pattern in DEGREE_PATTERNS:
        match = re.search(pattern, low, re.I)
        if match:
            degree = line[match.start():match.end()]
            break
    major_match = re.search(r"\b(?:in|of)\s+(.+)", line, re.I)
    if major_match:
        major = major_match.group(1).strip(" ,•|-")
    elif degree:
        major = line.replace(degree, "").strip(" ,•|-")
    return degree, major


def _parse_education(lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    for block in _blocks(lines):
        entry = {"school": "", "degree": "", "major": "", "year": "", "key_coursework": "", "academic_focus": ""}
        for line in block:
            low = line.lower()
            if not entry["school"] and re.search(r"\b(university|college|school|institute|academy)\b", low):
                entry["school"] = line
                continue
            if not entry["year"]:
                year_match = re.search(r"(20\d{2}\s*[-–]\s*(?:20\d{2}|present)|20\d{2})", line, re.I)
                if year_match:
                    entry["year"] = year_match.group(1)
            if "course" in low:
                entry["key_coursework"] = re.sub(r"^.*?:\s*", "", line)
            if any(t in low for t in ["focus", "specialization", "concentration"]):
                entry["academic_focus"] = re.sub(r"^.*?:\s*", "", line)
            if not entry["degree"]:
                degree, major = _extract_degree_and_major(line)
                if degree:
                    entry["degree"] = degree
                if major and not entry["major"]:
                    entry["major"] = major
        if not entry["school"] and block:
            entry["school"] = block[0]
        if not entry["degree"] and len(block) > 1:
            degree, major = _extract_degree_and_major(block[1])
            entry["degree"] = degree or entry["degree"]
            entry["major"] = major or entry["major"]
        if any(entry.values()):
            entries.append(entry)
    return entries[:3]


def _is_bullet(line: str) -> bool:
    return bool(re.match(r"^(?:•|-|\*)\s*", line))


def _extract_duration(line: str) -> str:
    match = re.search(
        r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{4}\s*[-–]\s*"
        r"(?:Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{4})"
        r"|\d{4}\s*[-–]\s*(?:Present|Current|Now|\d{4}))",
        line, re.I,
    )
    return match.group(1).strip() if match else ""


def _parse_company_role(line: str) -> tuple[str, str]:
    for sep in [" | ", " - ", " — ", " @ "]:
        if sep in line:
            left, right = line.split(sep, 1)
            return left.strip(), right.strip()
    return line, ""


def _parse_experience(lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    for block in _blocks(lines):
        non_bullets = [line for line in block if not _is_bullet(line)]
        bullets = [re.sub(r"^(?:•|-|\*)\s*", "", line).strip() for line in block if _is_bullet(line)]
        if not non_bullets and not bullets:
            continue
        company = ""
        role = ""
        duration = ""
        for line in non_bullets:
            if not duration:
                duration = _extract_duration(line)
            if not company:
                company, role = _parse_company_role(line)
                continue
            if not role and len(line) <= 100:
                role = line
        responsibilities_lines = bullets[:]
        if not responsibilities_lines:
            remaining = non_bullets[2:] if len(non_bullets) > 2 else non_bullets[1:]
            responsibilities_lines = [line for line in remaining if line != duration]
        entry = {
            "company": company,
            "role": role,
            "type": "Internship" if re.search(r"\bintern", role, re.I) else "Full-time",
            "duration": duration,
            "responsibilities": "\n".join(f"• {line}" for line in responsibilities_lines[:6]),
        }
        if entry["company"] or entry["role"] or entry["responsibilities"]:
            entries.append(entry)
    return entries[:5]


def _parse_projects(lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    for block in _blocks(lines):
        if not block:
            continue
        name = block[0]
        tools = context = outcome = role = ""
        for line in block[1:]:
            low = line.lower()
            if low.startswith("tools"):
                tools = re.sub(r"^.*?:\s*", "", line)
            elif low.startswith("role"):
                role = re.sub(r"^.*?:\s*", "", line)
            elif not context:
                context = line
            else:
                outcome += (" " if outcome else "") + line
        entries.append({"name": name, "context": context, "role": role, "tools": tools, "outcome": outcome.strip(), "learnings": ""})
    return entries[:5]


def _parse_interests(lines: list[str]) -> str:
    if not lines:
        return ""
    return ", ".join(
        item.strip(" •-")
        for item in re.split(r"[,\n|;/]+", "\n".join(lines))
        if item.strip(" •-")
    )


def _derive_headline(experience: list[dict]) -> str:
    roles = [e["role"] for e in experience if e.get("role")]
    return ", ".join(dict.fromkeys(roles[:2]))


def _derive_target_roles(headline: str, experience: list[dict]) -> str:
    if headline:
        return headline
    roles = [e["role"] for e in experience if e.get("role")]
    return ", ".join(dict.fromkeys(roles[:3]))


def _extract_education_level(education: list[dict]) -> str:
    combined = " ".join(f"{e.get('degree', '')} {e.get('major', '')}".lower() for e in education)
    if re.search(r"\b(ph\.?d\.?|doctor)", combined):
        return "PhD"
    if re.search(r"\b(master|m\.?s\.?|m\.?a\.?|mba)\b", combined):
        return "Master's"
    if re.search(r"\b(bachelor|b\.?s\.?|b\.?a\.?)\b", combined):
        return "Bachelor's"
    if re.search(r"\bassociate\b", combined):
        return "Associate's"
    return ""


def _extract_years_of_experience(text: str, experience: list[dict]) -> str:
    match = re.search(r"(\d+)\+?\s+(?:years?|yrs?)", text, re.I)
    if match:
        years = int(match.group(1))
        return f"{years} years" if years != 1 else "1 year"
    years_list: list[int] = []
    for entry in experience:
        years_list.extend(int(y) for y in re.findall(r"\b(20\d{2})\b", entry.get("duration", "")))
    if years_list:
        span = max(0, datetime.utcnow().year - min(years_list))
        if span > 0:
            return f"{span} years" if span != 1 else "1 year"
    return ""


def _derive_bio(summary_lines: list[str], headline: str, experience: list[dict], skills: dict[str, str]) -> str:
    summary = " ".join(line for line in summary_lines if line).strip()
    if summary:
        return summary
    parts: list[str] = []
    if headline:
        parts.append(headline)
    if experience and experience[0].get("company"):
        parts.append(f"with experience at {experience[0]['company']}")
    core_skills = ", ".join(s for s in [skills.get("technical", ""), skills.get("product", ""), skills.get("communication", "")] if s)
    if core_skills:
        parts.append(f"focused on {core_skills}")
    return " ".join(parts).strip()[:280]
