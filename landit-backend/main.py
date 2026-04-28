"""
LandIt AI Career Engine — FastAPI Backend
Architecture: 5-layer system with 2-layer memory (short-term + long-term)
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from database import init_db
from config import settings
from routers import profile, roles, compute, prep, interview, dashboard, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize DB tables
    await init_db()
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title="LandIt AI Career Engine",
    description="""
    Backend for the LandIt interview prep platform.

    **Architecture:**
    - Layer 1: User Input & Raw Storage
    - Layer 2-3: LLM Extraction + Dimension Mapping (15 dims)
    - Memory: Short-term (session) + Long-term (persistent)
    - Layer 4: Pure Python Computation (Gap Matrix, Match Score)
    - Layer 5: LLM Generation (Interview Prep, Feedback)
    """,
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(profile.router, prefix="/api")
app.include_router(roles.router, prefix="/api")
app.include_router(compute.router, prefix="/api")
app.include_router(prep.router, prefix="/api")
app.include_router(interview.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(ai.router, prefix="/api")

# Serve uploaded files statically (dev only — use CDN/S3 in prod)
upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")


@app.get("/")
async def root():
    return {
        "name": "LandIt AI Career Engine",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}
