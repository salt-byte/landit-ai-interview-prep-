# LandIt Backend — AI Career Engine

FastAPI backend for the LandIt PM interview preparation platform. It stores candidate profiles and target roles, extracts structured resume/JD data with Gemini, computes deterministic PM competency gaps, and generates interview prep and feedback.

## Prerequisites

- Python 3.11+
- Gemini API key
- Supabase project for production auth/database, or SQLite for local development
- Optional Tavily API key for stronger job-posting URL extraction

## Quick Start

```bash
cd landit-backend

# 1. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install reproducible backend dependencies
pip install -r requirements.txt

# 3. Configure environment variables
cp .env.example .env
# Edit .env and set GEMINI_API_KEY at minimum.

# 4. Run the API server
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for generated OpenAPI documentation.

## Required Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=sqlite+aiosqlite:///./landit.db
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=
ALLOWED_ORIGINS=http://localhost:3000
```

Optional:

```env
TAVILY_API_KEY=your_tavily_api_key_here
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=20
```

For production PostgreSQL, set `DATABASE_URL` to a `postgresql+asyncpg://...` connection string. The app also normalizes `postgres://` and `postgresql://` URLs for async SQLAlchemy.

## Backend Layers

| Layer | Responsibility | Implementation |
|---|---|---|
| Layer 1 | User input, file upload, raw storage | FastAPI, SQLAlchemy, local upload directory |
| Layer 2 | Resume/JD extraction | Gemini JSON prompts, `pypdf`, `python-docx`, Tavily, `httpx` |
| Layer 3 | 10-dimension PM mapping | Gemini role/profile scoring prompts |
| Memory | Short-term session state and long-term weakness tracking | PostgreSQL/SQLite records + weakness vector |
| Layer 4 | Gap matrix, match score, ability curve | Pure Python computation, no LLM |
| Layer 5 | Interview prep, live questions, feedback | Gemini generation and structured feedback |

The 10 PM dimensions are defined in `config.py` and used consistently across profile scoring, JD role models, gap computation, interview focus, and feedback.

## Main API Endpoints

### Profile

- `GET /api/profile` — Get the current user's profile
- `PUT /api/profile` — Update profile, education, work experience, and projects
- `POST /api/profile/documents/upload` — Upload a supporting document
- `POST /api/profile/documents/upload-and-parse` — Upload and parse a resume
- `GET /api/profile/documents` — List uploaded profile documents

### Target Roles

- `GET /api/roles` — List target roles
- `POST /api/roles` — Create a target role
- `PUT /api/roles/{id}` — Update a target role
- `DELETE /api/roles/{id}` — Delete a target role
- `POST /api/roles/parse-link` — Extract JD content from a URL
- `POST /api/roles/{id}/analyze-jd` — Build the 10-dimension role model
- `GET /api/roles/{id}/dimension-model` — Read the role dimension model

### Computation

- `GET /api/compute/gap-matrix/{role_id}` — Compute match score and dimension gaps
- `GET /api/compute/user-dimensions` — Read candidate competency scores
- `POST /api/compute/extract-user-dimensions` — Extract competency scores from profile data
- `GET /api/compute/weakness-vector` — Read long-term weakness memory
- `GET /api/compute/ability-curve` — Read interview performance trend

### Interview Prep and Feedback

- `POST /api/prep/{role_id}/generate` — Generate role-specific prep content
- `GET /api/prep/{role_id}` — Read saved prep content
- `PUT /api/prep/{role_id}` — Save user-edited prep content
- `POST /api/prep/{role_id}/chat` — Refine prep content through chat
- `POST /api/interview/sessions` — Create a mock interview session
- `WS /api/interview/sessions/{id}/stream` — WebSocket interview fallback mode
- `POST /api/interview/sessions/{id}/finish` — Finish a Gemini Live session and generate feedback
- `GET /api/interview/sessions/{id}/feedback` — Read structured feedback

## Validation

From the repository root:

```bash
npm run lint
```

From `landit-backend/`:

```bash
python -m compileall .
```

These checks validate TypeScript types and Python syntax/import structure. Runtime LLM and Supabase flows require valid environment variables.
