from pydantic_settings import BaseSettings
from pathlib import Path
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    tavily_api_key: str = ""
    zhipuai_api_key: str = ""
    app_secret_key: str = "landit-dev-secret-change-in-prod"
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    debug: bool = True
    database_url: str = "sqlite+aiosqlite:///./landit.db"
    db_init_retries: int = 5
    db_init_retry_delay_seconds: float = 2.0
    db_connect_timeout_seconds: float = 10.0
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 20
    allowed_origins: str = "*"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def normalized_database_url(self) -> str:
        """Normalize DB URL for SQLAlchemy async engine usage."""
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]

        if not url.startswith("postgresql+asyncpg://"):
            return url

        parsed = urlparse(url)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        if "ssl" not in query and "sslmode" not in query:
            query["ssl"] = "require"

        normalized_query = urlencode(query, doseq=True)
        return urlunparse(parsed._replace(query=normalized_query))

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
