"""
Signup + login. Enforces the 18+ policy at signup time per the planning doc §8.
"""
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import User
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    date_of_birth: date
    handedness: Literal["RH", "LH"] = "RH"
    consent_age: bool
    consent_processing: bool
    consent_analytics: bool = False
    consent_share: bool = False


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    handedness: Literal["RH", "LH"]


def _age(dob: date) -> int:
    today = datetime.now(timezone.utc).date()
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return years


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_session)) -> AuthResponse:
    if not (body.consent_age and body.consent_processing):
        raise HTTPException(400, "필수 동의 항목이 누락되었습니다.")
    if _age(body.date_of_birth) < 18:
        raise HTTPException(400, "만 18세 이상만 가입할 수 있습니다.")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, "이미 가입된 이메일입니다.")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        handedness=body.handedness,
        date_of_birth=body.date_of_birth,
        consent_analytics=body.consent_analytics,
        consent_share=body.consent_share,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(access_token=create_access_token(str(user.id)), email=user.email, handedness=user.handedness)  # type: ignore[arg-type]


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_session)) -> AuthResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")
    return AuthResponse(access_token=create_access_token(str(user.id)), email=user.email, handedness=user.handedness)  # type: ignore[arg-type]
