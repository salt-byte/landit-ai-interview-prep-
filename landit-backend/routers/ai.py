"""
AI proxy router — generic Gemini text-generation endpoint used by the Mock Prep
frontend (Workspace.tsx) so the Gemini API key never leaves the backend.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.llm import _generate, MODEL_SMART, MODEL_FAST

router = APIRouter(prefix="/ai", tags=["ai"])

# Map of tier name (used by the frontend) -> Gemini model id. Keeping the
# mapping server-side means the frontend never picks raw model strings, so
# we can swap models without redeploying the bundle.
_TIER_MODELS = {
    "smart": MODEL_SMART,
    "fast": MODEL_FAST,
}


class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int | None = 4096
    system: str | None = None
    tier: str | None = "smart"


@router.post("/generate")
async def generate(data: GenerateRequest):
    if not data.prompt or not data.prompt.strip():
        raise HTTPException(400, "prompt is required")
    model = _TIER_MODELS.get((data.tier or "smart").lower(), MODEL_SMART)
    text = await _generate(
        prompt=data.prompt,
        max_tokens=data.max_tokens or 4096,
        system=data.system or "",
        model=model,
    )
    return {"text": text}
