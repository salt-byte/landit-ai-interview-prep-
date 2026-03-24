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

# 10-Dimension PM Interview Scoring System
# Based on Google/Meta/Amazon PM rubrics + AIPM skill taxonomy
#
# Maps to interview rounds:
#   Product Sense  → product_intuition, user_empathy
#   Analytical     → metrics_driven_thinking, structured_problem_solving
#   Execution      → prioritization_tradeoffs, execution_delivery
#   Strategy       → strategic_thinking, market_awareness
#   Leadership     → cross_functional_leadership, stakeholder_communication
#   Technical      → technical_fluency
#
DIMENSIONS = [
    "product_intuition",           # Product sense: can you design the right product? (Meta Product Sense round)
    "user_empathy",                # User understanding: do you deeply understand user needs/pain? (conducting-user-interviews, analyzing-user-feedback)
    "metrics_driven_thinking",     # Can you define success metrics, interpret data, diagnose metric changes? (writing-north-star-metrics, setting-okrs-goals)
    "structured_problem_solving",  # Do you break down ambiguous problems systematically? (problem-definition, evaluating-trade-offs)
    "prioritization_tradeoffs",    # Can you prioritize ruthlessly and articulate trade-offs? (prioritizing-roadmap, scoping-cutting)
    "execution_delivery",          # Do you ship? Scope, plan, unblock, deliver. (shipping-products, writing-prds)
    "strategic_thinking",          # Long-term vision, competitive positioning, growth strategy (competitive-analysis, designing-growth-loops, platform-strategy)
    "cross_functional_leadership", # Can you lead without authority across eng/design/data? (cross-functional-collaboration, stakeholder-alignment)
    "stakeholder_communication",   # Clear communication, storytelling, influence (written-communication, giving-presentations)
    "technical_fluency",           # Can you go deep enough with engineers? (building-with-llms, managing-tech-debt, evaluating-new-technology)
]

DIMENSION_LABELS = {
    "product_intuition": "Product Intuition",
    "user_empathy": "User Empathy",
    "metrics_driven_thinking": "Metrics & Data Thinking",
    "structured_problem_solving": "Structured Problem Solving",
    "prioritization_tradeoffs": "Prioritization & Trade-offs",
    "execution_delivery": "Execution & Delivery",
    "strategic_thinking": "Strategic Thinking",
    "cross_functional_leadership": "Cross-functional Leadership",
    "stakeholder_communication": "Stakeholder Communication",
    "technical_fluency": "Technical Fluency",
}
