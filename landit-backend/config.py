from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    app_secret_key: str = "landit-dev-secret-change-in-prod"
    debug: bool = True
    database_url: str = "sqlite+aiosqlite:///./landit.db"
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 20
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()

# 15-Dimension universal coordinate system
DIMENSIONS = [
    "problem_framing",
    "structured_thinking",
    "analytical_reasoning",
    "execution_ownership",
    "resource_orchestration",
    "detail_orientation",
    "communication_clarity",
    "stakeholder_influence",
    "cross_func_alignment",
    "business_acumen",
    "strategic_planning",
    "market_awareness",
    "narrative_coherence",
    "persuasion_effectiveness",
    "technical_proficiency",
]

DIMENSION_LABELS = {
    "problem_framing": "Problem Framing",
    "structured_thinking": "Structured Thinking",
    "analytical_reasoning": "Analytical Reasoning",
    "execution_ownership": "Execution Ownership",
    "resource_orchestration": "Resource Orchestration",
    "detail_orientation": "Detail Orientation",
    "communication_clarity": "Communication Clarity",
    "stakeholder_influence": "Stakeholder Influence",
    "cross_func_alignment": "Cross-func Alignment",
    "business_acumen": "Business Acumen",
    "strategic_planning": "Strategic Planning",
    "market_awareness": "Market Awareness",
    "narrative_coherence": "Narrative Coherence",
    "persuasion_effectiveness": "Persuasion Effectiveness",
    "technical_proficiency": "Technical Proficiency",
}
