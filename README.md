# LandIt — AI-Powered PM Interview Prep Platform

A full-stack interview preparation system that analyzes your profile, identifies skill gaps against target roles, conducts real-time voice mock interviews with AI personas, and generates structured feedback — all within a continuous, dimension-aware improvement loop.

**Live Demo:** [landit-ai-interview-prep.vercel.app](https://landit-ai-interview-prep.vercel.app)

## Architecture

LandIt uses a **5-layer architecture** that separates LLM intelligence from deterministic computation:

```
Layer 1: User Input & Raw Storage
    ↓  Resume PDF, Job Description URL/text
Layer 2: LLM Extraction (Gemini 2.0 Flash)
    ↓  Structured JSON extraction
Layer 3: Dimension Mapping
    ↓  10-dimension PM competency scoring
Layer 4: Pure Python Computation (No LLM)
    ↓  Gap analysis, match scores, weakness tracking
Layer 5: LLM Generation
    ↓  Interview prep, live mock interview, feedback
```

**Key design decision:** Layer 4 is intentionally LLM-free. Gap calculations, match scores, and score aggregation are pure math — reproducible, instant, and debuggable.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 6 |
| Backend | Python FastAPI (async) + Uvicorn |
| Database | PostgreSQL (Supabase) / SQLite (dev) |
| ORM | SQLAlchemy 2.0 (async) |
| LLM (text) | Gemini 2.0 Flash |
| LLM (voice) | Gemini 2.5 Flash Native Audio |
| Auth | Supabase Auth + JWT |
| Real-time | WebSocket + Gemini Live API |
| Rich Text | TipTap Editor |

## 10-Dimension PM Competency System

Derived from Google/Meta/Amazon PM interview rubrics + a 46-skill PM taxonomy from 91 product leaders:

| # | Dimension | Interview Round |
|---|-----------|----------------|
| 1 | Product Intuition | Meta Product Sense |
| 2 | User Empathy | Meta Product Sense |
| 3 | Metrics & Data Thinking | Meta Analytical |
| 4 | Structured Problem Solving | Google Cognitive Ability |
| 5 | Prioritization & Trade-offs | Amazon Bias for Action |
| 6 | Execution & Delivery | Amazon Deliver Results |
| 7 | Strategic Thinking | Strategy rounds |
| 8 | Cross-functional Leadership | Meta Leadership & Drive |
| 9 | Stakeholder Communication | Google Leadership |
| 10 | Technical Fluency | Google Technical |

These dimensions are the **shared language** connecting every layer: resume extraction → gap computation → interview focus → feedback scoring → weakness vector update (70/30 exponential blend).

## Features

- **Resume Parsing** — Upload PDF, AI extracts structured profile (English + Chinese)
- **Role Analysis** — Paste JD URL, 3-tier scraping fallback (Tavily → httpx → Gemini inference)
- **Gap Analysis** — Pure Python computation across 10 PM dimensions
- **Mock Prep** — AI-generated Q&A tailored to weak dimensions, with chat refinement
- **Live Interview** — Real-time voice with 5 AI interviewer personas via Gemini Live API
- **Interview Reports** — Per-question scoring, dimension-level feedback
- **PM Competency Radar** — Dashboard radar chart of your dimension scores
- **Continuous Improvement** — Weakness vector updates after each session; next interview auto-focuses on weak areas

## Project Structure

```
/
├── App.tsx                          # Main app component
├── api.ts                           # API client with Supabase auth
├── types.ts                         # TypeScript type definitions
├── vite.config.ts                   # Vite configuration
├── vercel.json                      # Vercel deployment config
├── lib/
│   └── supabase.ts                  # Supabase client
├── components/
│   ├── Dashboard.tsx                # Dashboard with radar chart
│   ├── Profile.tsx                  # User profile management
│   ├── Login.tsx                    # Authentication
│   ├── RoleList.tsx                 # Target role management
│   ├── Workspace.tsx                # Role context & prep workspace
│   ├── MockInterview.tsx            # Live interview (Gemini Live API)
│   ├── InterviewReports.tsx         # Interview history & reports
│   ├── QuestionBank.tsx             # Saved prep questions
│   ├── AddSourceModal.tsx           # File/link upload modal
│   └── RichTextEditor.tsx           # TipTap rich text editor
│
└── landit-backend/
    ├── main.py                      # FastAPI app entry
    ├── config.py                    # Settings + 10 PM dimensions
    ├── database.py                  # Async SQLAlchemy engine
    ├── deps.py                      # Auth (Supabase JWT / JWKS)
    ├── routers/
    │   ├── profile.py               # Profile CRUD + resume upload
    │   ├── roles.py                 # Role management + JD parsing
    │   ├── compute.py               # Gap matrix, dimensions, ability curve
    │   ├── prep.py                  # Interview prep generation
    │   ├── interview.py             # Mock interview sessions + feedback
    │   └── dashboard.py             # Analytics stats
    ├── services/
    │   ├── llm.py                   # Gemini API (extraction + generation)
    │   ├── resume_parser.py         # PDF resume parsing
    │   ├── web_scraper.py           # JD scraping (Tavily + httpx + inference)
    │   ├── computation.py           # Pure Python gap analysis & scoring
    │   ├── memory_manager.py        # 2-layer memory system
    │   └── storage.py               # File upload handling
    ├── models/
    │   ├── user.py                  # UserProfile, Education, WorkExperience
    │   ├── role.py                  # TargetRole, RoleDimensionModel
    │   ├── interview.py             # InterviewSession, InterviewFeedback
    │   └── dimension.py             # UserDimensionScore, WeaknessVector
    └── schemas/                     # Pydantic request/response models
```

## API Endpoints

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/profile` | Get / update user profile |
| POST | `/api/profile/documents/upload-and-parse` | Upload resume + AI parse |
| GET | `/api/profile/documents` | List uploaded documents |

### Roles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/roles` | List / create target roles |
| POST | `/api/roles/parse-link` | Parse JD from URL |
| POST | `/api/roles/{id}/analyze-jd` | Analyze JD → dimension model |

### Compute (Layer 4 — No LLM)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/compute/gap-matrix/{role_id}` | Gap analysis for role |
| GET | `/api/compute/user-dimensions` | User dimension scores |
| GET | `/api/compute/weakness-vector` | Current weakness vector |
| GET | `/api/compute/ability-curve` | Score trend over time |

### Interview
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/interview/sessions` | Create session |
| POST | `/api/interview/sessions/{id}/finish` | Finish + generate feedback |
| GET | `/api/interview/sessions/{id}/feedback` | Get feedback |
| GET | `/api/interview/sessions` | List all sessions |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Aggregated user stats |

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- [Supabase](https://supabase.com) project (auth + database)
- [Google AI](https://ai.google.dev) API key (Gemini)

### Frontend
```bash
npm install
```

Create `.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### Backend
```bash
cd landit-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `landit-backend/.env`:
```env
GEMINI_API_KEY=your-gemini-api-key
DATABASE_URL=sqlite+aiosqlite:///./landit.db
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
```

### Run
```bash
# Backend
cd landit-backend && uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
npm run dev
```

Open http://localhost:3000

## Deployment

**Frontend → Vercel**
```bash
vercel --prod
```

**Backend → Render**
- Root directory: `landit-backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Key Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| Gemini 2.0 Flash | Fastest + cheapest for extraction/generation |
| Gemini 2.5 Flash Native Audio | Only model with built-in bidirectional voice |
| Layer 4 Pure Python | Deterministic gap calculations, no LLM variance |
| 10 PM dimensions | From real Google/Meta/Amazon interview rubrics |
| 70/30 weakness blend | Recency bias while stabilizing against noise |
| Pre-connection pattern | API connects during device check, not on Start |
| 3-tier JD scraping | Tavily → httpx + JSON-LD → URL parsing + inference |

## License

MIT
