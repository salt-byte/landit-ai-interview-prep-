"""
Local heuristic resume parser.
Uses deterministic text parsing instead of any external LLM API.
"""
from __future__ import annotations

import re
from datetime import datetime


SECTION_ALIASES = {
    "summary": "summary",
    "professional summary": "summary",
    "profile": "summary",
    "about": "summary",
    "skills": "skills",
    "technical skills": "skills",
    "core competencies": "skills",
    "competencies": "skills",
    "education": "education",
    "academic background": "education",
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "employment": "experience",
    "projects": "projects",
    "project experience": "projects",
    "selected projects": "projects",
    "interests": "interests",
    "activities": "interests",
    "leadership": "interests",
}

DEGREE_PATTERNS = [
    r"ph\.?d\.?",
    r"doctor(?:ate)?",
    r"master(?:'s)?",
    r"m\.?s\.?",
    r"m\.?a\.?",
    r"mba",
    r"bachelor(?:'s)?",
    r"b\.?s\.?",
    r"b\.?a\.?",
    r"associate(?:'s)?",
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


def extract_profile_from_resume(resume_text: str) -> dict:
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
    line = re.sub(r"\s+", " ", line)
    return line


def _normalize_heading(line: str) -> str:
    line = re.sub(r"[^a-zA-Z/& ]", "", line).strip().lower()
    line = re.sub(r"\s+", " ", line)
    return line


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
            continue
        if current:
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
        or "linkedin.com" in low
        or "github.com" in low
        or low.startswith("linkedin")
        or low.startswith("github")
    )


def _looks_like_location(line: str) -> bool:
    if not line:
        return False
    if re.search(r"\b(remote|relocate|relocation)\b", line, re.I):
        return True
    if re.search(r"\b[A-Z][a-z]+(?: [A-Z][a-z]+)*,\s?[A-Z]{2}\b", line):
        return True
    if re.search(r"\b[A-Z][a-z]+(?: [A-Z][a-z]+)*/[A-Z][a-z]+(?: [A-Z][a-z]+)*\b", line):
        return True
    return False


def _parse_header(sections: dict[str, list[str]]) -> dict[str, str]:
    header_lines = [line for line in sections.get("header", []) if line]
    non_contact = [line for line in header_lines if not _is_contact_line(line)]

    name = non_contact[0] if non_contact else ""
    headline = ""
    bio_parts: list[str] = []
    location = ""

    for line in non_contact[1:]:
        if not location and _looks_like_location(line):
            location = line
            continue
        if not headline and len(line) <= 90:
            headline = line
            continue
        bio_parts.append(line)

    return {
        "name": name,
        "headline": headline,
        "location": location,
        "bio": " ".join(bio_parts[:3]).strip(),
    }


def _split_skill_items(text: str) -> list[str]:
    return [
        item.strip(" •-")
        for item in re.split(r"[,\n|;/]+", text)
        if item.strip(" •-")
    ]


def _categorize_skill(item: str) -> str:
    low = item.lower()
    if any(keyword in low for keyword in PRODUCT_KEYWORDS):
        return "product"
    if any(keyword in low for keyword in COMMUNICATION_KEYWORDS):
        return "communication"
    if any(keyword in low for keyword in TECHNICAL_KEYWORDS):
        return "technical"
    return "technical"


def _parse_skills(lines: list[str], full_text: str) -> dict[str, str]:
    text = "\n".join(line for line in lines if line)
    if not text:
        match = re.search(r"Skills?[:\s]+(.+)", full_text, re.I)
        text = match.group(1) if match else ""

    buckets = {"technical": [], "product": [], "communication": []}
    seen = set()
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
        entry = {
            "school": "",
            "degree": "",
            "major": "",
            "year": "",
            "key_coursework": "",
            "academic_focus": "",
        }

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
            if any(token in low for token in ["focus", "specialization", "concentration"]):
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
        r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{4}\s*[-–]\s*(?:Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{4})|\d{4}\s*[-–]\s*(?:Present|Current|Now|\d{4}))",
        line,
        re.I,
    )
    return match.group(1).strip() if match else ""


def _parse_company_role(line: str) -> tuple[str, str]:
    for separator in [" | ", " - ", " — ", " @ "]:
        if separator in line:
            left, right = line.split(separator, 1)
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
        tools = ""
        context = ""
        outcome = ""
        role = ""

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

        entries.append({
            "name": name,
            "context": context,
            "role": role,
            "tools": tools,
            "outcome": outcome.strip(),
            "learnings": "",
        })

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
    if not experience:
        return ""
    roles = [entry["role"] for entry in experience if entry.get("role")]
    return ", ".join(dict.fromkeys(roles[:2]))


def _derive_target_roles(headline: str, experience: list[dict]) -> str:
    if headline:
        return headline
    roles = [entry["role"] for entry in experience if entry.get("role")]
    return ", ".join(dict.fromkeys(roles[:3]))


def _extract_education_level(education: list[dict]) -> str:
    combined = " ".join(
        f"{entry.get('degree', '')} {entry.get('major', '')}".lower()
        for entry in education
    )
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

    years: list[int] = []
    for entry in experience:
        years.extend(int(year) for year in re.findall(r"\b(20\d{2})\b", entry.get("duration", "")))

    if years:
        current_year = datetime.utcnow().year
        span = max(0, current_year - min(years))
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
    core_skills = ", ".join(
        skill
        for skill in [skills.get("technical", ""), skills.get("product", ""), skills.get("communication", "")]
        if skill
    )
    if core_skills:
        parts.append(f"focused on {core_skills}")

    sentence = " ".join(parts).strip()
    return sentence[:280]
