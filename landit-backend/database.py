import asyncio
import logging
from urllib.parse import urlparse, urlunparse

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.exc import SQLAlchemyError
from config import settings

logger = logging.getLogger(__name__)


def _safe_db_url(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.password:
        return url
    netloc = parsed.netloc.replace(parsed.password, "***")
    return urlunparse(parsed._replace(netloc=netloc))

engine = create_async_engine(
    settings.normalized_database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    connect_args={"timeout": settings.db_connect_timeout_seconds},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    for attempt in range(1, settings.db_init_retries + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database initialized successfully")
            return
        except (OSError, asyncio.TimeoutError, SQLAlchemyError) as exc:
            if attempt >= settings.db_init_retries:
                logger.exception(
                    "DB init failed after %s attempts (url=%s): %s",
                    settings.db_init_retries,
                    _safe_db_url(settings.normalized_database_url),
                    exc,
                )
                raise

            delay = settings.db_init_retry_delay_seconds * attempt
            logger.warning(
                "DB init attempt %s/%s failed, retrying in %.1fs: %s",
                attempt,
                settings.db_init_retries,
                delay,
                exc,
            )
            await asyncio.sleep(delay)
