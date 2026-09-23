"""
API Routes - Auth endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Organization, OrgMember, UserRole
from app.auth import hash_password, verify_password, create_access_token

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    await db.flush()
    
    # Create default org and membership
    org = Organization(name=f"{req.email}'s Organization")
    db.add(org)
    await db.flush()
    
    member = OrgMember(org_id=org.id, user_id=user.id, role=UserRole.admin)
    db.add(member)
    await db.flush()
    
    token = create_access_token(str(user.id), str(org.id), "admin")
    
    return TokenResponse(
        access_token=token,
        user={"id": str(user.id), "email": user.email},
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Get user's org membership
    member_result = await db.execute(
        select(OrgMember).where(OrgMember.user_id == user.id)
    )
    member = member_result.scalar_one_or_none()
    
    org_id = str(member.org_id) if member else "default"
    role = member.role.value if member else "viewer"
    
    token = create_access_token(str(user.id), org_id, role)
    
    return TokenResponse(
        access_token=token,
        user={"id": str(user.id), "email": user.email},
    )
