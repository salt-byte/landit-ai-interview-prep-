"""
Auth router — user registration and login.
Returns JWT access tokens.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database import get_db
from models.auth import User
from services.auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthRequest(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: AuthRequest, db: AsyncSession = Depends(get_db)):
    """Create a new account and return a JWT token."""
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        user_key=str(uuid.uuid4()),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.user_key)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login")
async def login(data: AuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate and return a JWT token."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(user.user_key)
    return {"access_token": token, "token_type": "bearer"}
