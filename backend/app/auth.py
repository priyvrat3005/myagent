"""
Authentication and RBAC (Role-Based Access Control).

JWT-based session auth with FastAPI dependency injection.
Roles: viewer (read-only), editor (can write), admin (full access).
"""
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, OrgMember, UserRole

# TODO: Move to environment variables
SECRET_KEY = "swarmblocks-dev-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, org_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "org_id": org_id,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Dependency: extract and validate the current user from JWT."""
    token_data = decode_token(credentials.credentials)
    
    user_id = token_data.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return {
        "id": user.id,
        "email": user.email,
        "org_id": token_data.get("org_id"),
        "role": token_data.get("role", "viewer"),
    }


def require_role(minimum_role: str):
    """
    Dependency factory: enforce minimum role for a route.
    
    Usage:
        @router.post("/workflows", dependencies=[Depends(require_role("editor"))])
    
    Role hierarchy: viewer < editor < admin
    """
    role_hierarchy = {"viewer": 0, "editor": 1, "admin": 2}
    min_level = role_hierarchy.get(minimum_role, 0)
    
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_level = role_hierarchy.get(current_user.get("role", "viewer"), 0)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum_role}' role or higher. You have '{current_user.get('role')}'.",
            )
        return current_user
    
    return role_checker
