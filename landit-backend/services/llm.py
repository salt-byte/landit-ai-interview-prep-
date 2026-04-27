"""
LLM service — all Gemini API calls go through here.
Keeps API logic in one place, easy to swap models.
"""
import json
import re
from google import genai
from config import settings, DIMENSIONS, DIMENSION_LABELS

client = genai.Client(api_key=settings.gemini_api_key)
MODEL = "gemini-2.5-flash"


async def _generate(
    prompt: str,
    max_tokens: int = 4096,
    system: str = "",
    json_mode: bool = False,
) -> str:
    """Unified async wrapper for Gemini generateContent.

    json_mode=True asks Gemini to emit application/json directly. This avoids
    the markdown-fenced output and most "unterminated string" failures we
    used to see when the model wrapped JSON in prose.
    """
    config = {"max_output_tokens": max_tokens}
    if system:
        config["system_instruction"] = system
    if json_mode:
        config["response_mime_type"] = "application/json"

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=config,
    )
    return response.text.strip()


def _parse_json(raw: str) -> dict | list:
    """Parse JSON from an LLM response, defensively.

    Handles markdown fences, leading/trailing prose, and truncated outputs by
    extracting the largest balanced ``{...}`` or ``[...]`` block before
    delegating to ``json.loads``.
    """
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fall back: scan for the first balanced JSON object/array. Useful when
    # the model prepends explanatory prose or appends a trailing comment.
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        if start == -1:
            continue
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
            else:
                if ch == '"':
                    in_string = True
                elif ch == opener:
                    depth += 1
                elif ch == closer:
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start : i + 1])
                        except json.JSONDecodeError:
                            break

    # Last resort: re-raise the original error so callers can decide what to do.
    return json.loads(text)


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

    raw = await _generate(prompt, max_tokens=4096, json_mode=True)
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

    raw = await _generate(prompt, max_tokens=2048, json_mode=True)
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

    raw = await _generate(prompt, max_tokens=1024, json_mode=True)
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
    # Extracted out of the f-string below: Python 3.11 disallows backslashes in
    # f-string expression parts. (Relaxed in 3.12, but Render runs 3.11.)
    answer_format_block = (
        "\n**Model Answer:** [S in 1-2 sentences → A in depth: one decision, why, the friction point → R with one number + one trade-off or learning. 150-200 words total.]\n\n**Pitfalls:**\n- [specific weak behavior 1]\n- [specific weak behavior 2]"
        if include_answers
        else ""
    )
    answer_instruction = (
        """INCLUDE ANSWERS. For each question, write a model answer that sounds like a real senior PM speaking in an interview — not filling out a template.

ANSWER STRUCTURE: You may use the STAR framework as an internal guide, but apply it with correct proportions and depth. Here is how each part should work:

S — Situation (1-2 sentences MAX): One sentence of context. What product, what stage, what constraint. Do NOT narrate the entire background. Do NOT repeat in Task.
  BAD: "I was working at a company that operated across 12 markets, managing a cross-functional team of engineers, designers, and data scientists, during a challenging period when we were trying to..."
  GOOD: "We were relaunching the checkout flow for a 3-month-old marketplace product with about 80K MAU."

T — Task (skip if redundant with S, or merge into one sentence): State the specific decision or outcome you personally owned. If T would just restate S with different words, skip it entirely.

A — Action (this is 70% of the answer — go deep here): Do NOT list multiple frameworks or methods (no "1. I ran user research 2. I built a prioritization matrix 3. I aligned stakeholders"). Instead: pick ONE key decision or action, explain WHY you made that specific choice over the alternatives, and show your reasoning process. Include the moment where something was harder than expected — a metric came back wrong, a stakeholder disagreed, your first solution didn't work.
  BAD: "I conducted user research, ran A/B tests, built a prioritization matrix, and aligned all stakeholders through regular cross-functional meetings."
  GOOD: "We ran two rounds of usability testing — the first showed users trusted the checkout, so I was set to ship. But when we added transaction data, abandonment was still 38%. That forced me to go back and talk to 6 users directly. Turns out the trust issue wasn't the UI — it was the return policy copy buried in a modal. I pushed to surface it inline, which engineering said would take 2 extra weeks. I made the call to delay."

R — Result (1-2 sentences, must include a number AND a trade-off or learning): State what changed with a specific metric. Then add what you gave up, what surprised you, or what you'd do differently. Do NOT end with a generic win.
  BAD: "The cross-functional collaboration improved, leading to a more streamlined launch process and better business outcomes."
  GOOD: "Abandonment dropped from 38% to 24% in the first 4 weeks. We missed our original launch date by 2 weeks — in hindsight I should have pulled the return policy data earlier instead of assuming UX was the problem."

After the model answer, add:
**Pitfalls:**
- [One specific weak behavior, e.g. "Lists 4 frameworks without explaining why they chose one over another"]
- [One specific weak behavior, e.g. "Result is generic — 'things improved' with no metric or honest reflection"]"""
        if include_answers
        else "LIST QUESTIONS ONLY — no answers, no hints."
    )

    prompt = f"""You are a senior PM interviewer at {company} preparing realistic interview questions for a {role_title} candidate.

---
ROLE CONTEXT
Role: {role_title} at {company}
Categories to cover: {cat_list}
Job description excerpt:
{jd[:1500]}

---
CANDIDATE PROFILE:
{profile_summary}

HOW TO USE THE PROFILE:
1. DOMAIN/CONTEXT: Use the candidate's industry and product domain (e-commerce, fintech, SaaS, consumer app, etc.) to set the scenario domain. If they have e-commerce PM experience, frame scenarios as "you're PM on a marketplace/checkout/growth team at {company}." Match the scenario domain to where they'd realistically land.
2. DEPTH CALIBRATION: Use seniority and experience to calibrate expected answer depth — a 5-year senior PM vs. a 2-year APM should get different complexity and ambiguity.
3. ASSUMED KNOWLEDGE: You can assume the candidate understands their domain. Do not explain basic terms they'd already know from their background.
DO NOT name-drop resume keywords. Do NOT write "given your experience with X..." or "using your background in Y..." The resume informs scenario CONTEXT and FRAMING, not question WORDING.

---
SKILL GAPS (use to select which competency each question targets):
{gap_summary}

For each question you write, pick ONE gap dimension and design a scenario that specifically exposes that gap. Label each question with the dimension it targets.

---
QUESTION DESIGN RULES — follow these strictly:

1. ONE TOPIC PER QUESTION. Test exactly one thing. No compound questions. No "...and how would you apply that to X?" No "...also walk me through Y." If you have two angles, write two separate questions.

2. KEEP QUESTIONS UNDER 30 WORDS. The candidate should talk more than the interviewer. State the scenario, then ask one sharp question. Cut all filler.
   BAD (too long, compound): "Walk me through how you would identify user needs, prioritize features based on business impact, and communicate your roadmap to stakeholders."
   GOOD (concise, one focus): "DAU up 12%, revenue per user down 8%. Is this a win? What do you do next?"

3. EVERY QUESTION MUST INCLUDE A REAL BUSINESS SCENARIO with a forced decision — not an abstract process question.
   - Analytical: data discrepancy with specific numbers (e.g., "CTR up 18%, checkout conversion down 12% WoW. What's your diagnosis?")
   - Prioritization: forced choice with real constraints (e.g., "6 weeks of eng capacity. Fix top user complaint (40% affected) or ship the enterprise feature blocking $2M in deals. Pick one.")
   - Behavioral: name the stakeholder, the conflict, the pressure. Both options must be defensible.
   - Strategy: specific threat or opportunity with real stakes and a deadline.

4. ANALYTICAL AND PRIORITIZATION questions must have specific numbers or hard constraints. Vague questions are not allowed.

5. Questions must feel like they could actually be asked at a real interview at {company} for this candidate's background — not generic questions pulled from a list.

---

{answer_instruction}

---
FORMAT:
## [Category Name]
### Q: [Scenario question — standalone, no "As a PM..." preamble]
*Targets: [dimension label from gap summary]*
{answer_format_block}

Generate questions now. Cover all requested categories: {cat_list}. Write 3-5 sharp, scenario-driven questions per category."""

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
4. DO NOT FABRICATE. If a section (responsibilities, qualifications, company overview, etc.) is not clearly present in the content below, return an empty string "" for that field. NEVER write placeholder text like "Section incomplete in original posting", "to be completed", or "inferred from job title". An empty string is the correct answer when content is missing.
5. If the entire page content is clearly empty or just navigation/SEO meta (typical of JS-rendered SPA pages), return all fields as empty strings except whatever you can derive from the URL itself (title, company).

URL: {url}
Content:
{page_content[:16000]}"""

    raw = await _generate(prompt, max_tokens=3000, json_mode=True)
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

    raw = await _generate(prompt, max_tokens=2048, json_mode=True)
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
