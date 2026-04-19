"""Auth API: login, logout, me, admin user management."""
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

from src.models.database import User, get_db
from src.auth.constants import ACCESS_TOKEN_COOKIE
from src.auth.jwt_utils import create_access_token, safe_decode
from src.auth.passwords import hash_password, verify_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])

COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "false").lower() == "true"


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    id: int
    email: str
    role: str


class MeResponse(BaseModel):
    user: Optional[UserOut] = None


class CreateUserBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Min 8 characters")
    role: str = Field(pattern="^(admin|user)$")


class UserListOut(BaseModel):
    id: int
    email: str
    role: str
    created_at: str


class PatchUserBody(BaseModel):
    role: str = Field(pattern="^(admin|user)$")


def _created_at_iso(u: User) -> str:
    dt = u.created_at
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        s = dt.isoformat(timespec="seconds")
        if s.endswith("+00:00"):
            return s.replace("+00:00", "Z")
        if "T" in s and not s.endswith("Z") and "+" not in s[-6:]:
            return s + "Z"
        return s
    return str(dt)


def _user_to_list_out(u: User) -> UserListOut:
    return UserListOut(
        id=u.id,
        email=u.email,
        role=u.role,
        created_at=_created_at_iso(u),
    )


def _get_token_from_request(request: Request) -> Optional[str]:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if token:
        return token
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


def require_admin(request: Request, db: Session = Depends(get_db)) -> User:
    token = _get_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = safe_decode(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user


@router.post("/login")
async def login(body: LoginBody, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.email, user.role)
    r = JSONResponse(
        content={"user": {"id": user.id, "email": user.email, "role": user.role}}
    )
    r.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=token,
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )
    return r


@router.post("/logout")
async def logout():
    r = JSONResponse(content={"ok": True})
    r.delete_cookie(key=ACCESS_TOKEN_COOKIE, path="/")
    return r


@router.get("/me", response_model=MeResponse)
async def me(request: Request, db: Session = Depends(get_db)):
    token = _get_token_from_request(request)
    if not token:
        return MeResponse(user=None)
    payload = safe_decode(token)
    if not payload:
        return MeResponse(user=None)
    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        return MeResponse(user=None)
    return MeResponse(user=UserOut(id=user.id, email=user.email, role=user.role))


@router.get("/users", response_model=List[UserListOut])
async def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    users = db.query(User).order_by(User.id.asc()).all()
    return [_user_to_list_out(u) for u in users]


@router.post("/users", response_model=UserOut)
async def create_user(
    body: CreateUserBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    email = body.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="User already exists")
    u = User(
        email=email,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return UserOut(id=u.id, email=u.email, role=u.role)


@router.patch("/users/{user_id}", response_model=UserListOut)
async def patch_user(
    user_id: int,
    body: PatchUserBody,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == admin.id and body.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    if target.role == "admin" and body.role == "user":
        other = (
            db.query(User)
            .filter(User.role == "admin", User.id != user_id)
            .count()
        )
        if other < 1:
            raise HTTPException(status_code=400, detail="Cannot remove last admin role")
    target.role = body.role
    db.commit()
    db.refresh(target)
    return _user_to_list_out(target)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if target.role == "admin":
        others = (
            db.query(User)
            .filter(User.role == "admin", User.id != user_id)
            .count()
        )
        if others < 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    db.delete(target)
    db.commit()
    return {"ok": True}
