"""
FastAPI dependencies — shared across routers.
Validates Supabase-issued JWTs using JWKS (supports ES256/ECC and HS256).
"""
import logging
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from config import settings

logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="n/a")

# ── JWKS cache ───────────────────────────────────────────────────────────────

_jwks_cache: dict | None = None


async def _fetch_jwks() -> dict:
    """Fetch JWKS from Supabase and cache it."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


def _clear_jwks_cache():
    global _jwks_cache
    _jwks_cache = None


# ── Token verification ───────────────────────────────────────────────────────

async def verify_supabase_token(token: str) -> str:
    """
    Verify a Supabase JWT and return user_key (sub claim).
    Tries JWKS first (ES256), falls back to HS256 shared secret.
    Exported for use by both REST deps and WebSocket handlers.
    """
    # Strategy 1: JWKS verification (handles ES256/ECC keys)
    if settings.supabase_url:
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            alg = header.get("alg", "ES256")

            jwks = await _fetch_jwks()

            for key_data in jwks.get("keys", []):
                if key_data.get("kid") == kid:
                    payload = jwt.decode(
                        token,
                        key_data,
                        algorithms=[alg],
                        options={"verify_aud": False},
                    )
                    user_key = payload.get("sub")
                    if user_key:
                        return user_key

            # Key not found — maybe rotated, refresh cache and retry once
            _clear_jwks_cache()
            jwks = await _fetch_jwks()

            for key_data in jwks.get("keys", []):
                if key_data.get("kid") == kid:
                    payload = jwt.decode(
                        token,
                        key_data,
                        algorithms=[alg],
                        options={"verify_aud": False},
                    )
                    user_key = payload.get("sub")
                    if user_key:
                        return user_key

        except Exception as e:
            logger.debug("JWKS verification failed: %s", e)

    # Strategy 2: Legacy HS256 shared secret fallback
    if settings.supabase_jwt_secret:
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            user_key = payload.get("sub")
            if user_key:
                return user_key
        except Exception as e:
            logger.debug("HS256 verification failed: %s", e)

    raise JWTError("Could not verify token")


# ── FastAPI dependency ───────────────────────────────────────────────────────

async def get_current_user_key(token: str = Depends(oauth2_scheme)) -> str:
    """Extract user_key from Supabase JWT. Raises 401 if invalid or expired."""
    try:
        return await verify_supabase_token(token)
    except (JWTError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
