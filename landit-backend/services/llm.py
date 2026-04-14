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
    """Layer 3: Map user experience -> 10 PM dimension scores (1-5) + evidence."""
    dims_str = "\n".join([f"- {k}: {v}" for k, v in DIMENSION_LABELS.items()])
    prompt = f"""You are an expert career assessor. Score the candidate on 10 PM competency dimensions based on their background.

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
    """Layer 3: Map JD -> 10 PM dimension required scores + weights."""
    dims_str = "\n".join([f"- {k}: {v}" for k, v in DIMENSION_LABELS.items()])
    prompt = f"""You are an expert talent assessor. Analyze this job description and map it to 10 PM competency dimensions.

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

All 10 dimensions must be present. Set weight=0 for irrelevant dimensions.

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

    prompt = f"""You are a senior PM interviewer at {company} preparing realistic interview questions for a {role_title} candidate.

---
ROLE CONTEXT
Role: {role_title} at {company}
Categories to cover: {cat_list}
Job description excerpt:
{jd[:1500]}
---
CANDIDATE SENIORITY CALIBRATION (use ONLY to set difficulty level — do NOT use to construct question topics)
{profile_summary}
Skill gaps: {gap_summary}
---

QUESTION DESIGN RULES — follow these strictly:

1. ONE TOPIC PER QUESTION. No compound questions. No "...and how would you apply that to X?" No "...also walk me through Y." If you have two angles, write two separate questions.

2. EVERY QUESTION MUST INCLUDE A REAL BUSINESS SCENARIO. Do not ask about abstract processes ("how do you approach X"). Instead, give the candidate a concrete situation and force a decision.
   - Analytical: present a real data discrepancy (e.g., "CTR is up 18% but conversion is down 12% — what's your diagnosis?")
   - Prioritization: force a genuine trade-off with real constraints (e.g., "Engineering has 6 weeks — do you fix the top user complaint that affects 40% of users, or ship the enterprise feature that Sales says is blocking 3 deals?")
   - Behavioral: name the stakeholder, the conflict, the pressure (e.g., "Your data shows the feature should launch, but legal flagged it 2 days before launch — what do you do?")
   - Strategy: frame a real threat or opportunity with stakes (e.g., "A well-funded competitor just dropped pricing to zero — you have 90 days before renewals. What's your move?")

3. DO NOT connect resume keywords with JD keywords. The candidate's background sets the depth level only. The question topic must come from realistic PM scenarios at {company}, not from the candidate's resume.

4. PRIORITIZATION AND ANALYTICAL questions must have specific numbers or constraints. Vague questions like "how would you prioritize features?" are not allowed.

5. For BEHAVIORAL questions, the situation must have genuine tension — a real conflict between two valid options. Avoid questions where the "right" answer is obvious.

---

{"INCLUDE ANSWERS: For each question, provide a detailed answer framework using STAR method where appropriate, 3-5 key points a strong answer covers, and 1-2 pitfalls to avoid." if include_answers else "LIST QUESTIONS ONLY — no answers, no hints."}

---

FORMAT:
## [Category Name]
### Q: [Question text — must be a complete, standalone scenario. No preamble like "As a PM at {company}..." — just the scenario.]
{"**Answer Framework:** [STAR or structured approach]\\n**Key Points:** [bullet list]\\n**Pitfalls:** [what weak answers do]" if include_answers else ""}

Generate questions now. Cover all requested categories: {cat_list}. Aim for 3-5 sharp, scenario-driven questions per category."""

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
  "title": "job title (clean, no internal codes)",
  "company": "company name",
  "jd": "ONLY the core job description: responsibilities and requirements. Do NOT include team introduction, company overview, or internship program descriptions here. Format cleanly with line breaks between sections. Remove any duplicated paragraphs.",
  "team_info": "team or department name (short, e.g. 'Product Growth Team')",
  "location": "job location (city, state, remote, hybrid, etc.)",
  "employmentType": "Full-time, Part-time, Internship, or Contract",
  "keyResponsibilities": "key responsibilities as bullet points, each on a new line starting with •",
  "qualifications": "required and preferred qualifications as bullet points, each on a new line starting with •",
  "companyOverview": "company description / about the company section",
  "teamOverview": "team/department introduction paragraph (e.g. 'The TikTok product team aims to...'). Extract this SEPARATELY from the jd field.",
  "additionalInfo": "salary, benefits, internship program details, or other notable info"
}}

IMPORTANT RULES:
1. SEPARATE content into the right fields: team introductions go in "teamOverview", NOT in "jd". Company descriptions go in "companyOverview", NOT in "jd".
2. DEDUPLICATE: if the same paragraph appears multiple times, include it only once.
3. FORMAT the "jd" field cleanly — use line breaks between sections (Responsibilities, Requirements, etc.).
4. If the page content is minimal (JS-rendered site), use the URL to infer details. For "jd", write a realistic description and note it is inferred.

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
    "product_intuition": <float 1-5>,
    "user_empathy": <float 1-5>,
    "metrics_driven_thinking": <float 1-5>,
    "structured_problem_solving": <float 1-5>,
    "prioritization_tradeoffs": <float 1-5>,
    "execution_delivery": <float 1-5>,
    "strategic_thinking": <float 1-5>,
    "cross_functional_leadership": <float 1-5>,
    "stakeholder_communication": <float 1-5>,
    "technical_fluency": <float 1-5>
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
