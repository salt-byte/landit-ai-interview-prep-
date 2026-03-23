"""
FastAPI dependencies — shared across routers.
Validates Supabase-issued JWTs and extracts user_key (Supabase user UUID).
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="n/a")


async def get_current_user_key(token: str = Depends(oauth2_scheme)) -> str:
    """Extract user_key from Supabase JWT. Raises 401 if invalid or expired."""
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_aud": False},
        )
        user_key: str = payload.get("sub")
        if not user_key:
            raise JWTError("Missing sub claim")
        return user_key
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
