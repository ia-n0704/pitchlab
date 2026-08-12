"""
Signup + email verification + login.

Flow:
  1. POST /auth/signup  → creates an *unverified* account, generates a 6-digit
     code, "sends" it (SMTP if configured, otherwise logged), returns
     {email, verification_required, dev_code?}. Does NOT issue a token.
  2. POST /auth/verify  → confirms the code, marks the account verified, issues a JWT.
  3. POST /auth/login   → only succeeds for an existing, verified account with the
     correct password.

Enforces the 18+ policy at signup time per the planning doc §8.
"""
import random
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_required_user_id
from app.config import settings
from app.db import get_session
from app.models import User
from app.notify import send_verification_code
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


class VerifyRequest(BaseModel):
    email: str
    code: str


class ResendRequest(BaseModel):
    email: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    handedness: Literal["RH", "LH"]


class SignupResponse(BaseModel):
    email: str
    verification_required: bool = True
    # only populated when settings.expose_verification_code is True (dev/demo)
    dev_code: str | None = None


def _age(dob: date) -> int:
    today = datetime.now(timezone.utc).date()
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return years


def _gen_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def _token_for(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(str(user.id)),
        email=user.email,
        handedness=user.handedness,  # type: ignore[arg-type]
    )


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_session)) -> SignupResponse:
    if not (body.consent_age and body.consent_processing):
        raise HTTPException(400, "필수 동의 항목이 누락되었습니다.")
    if _age(body.date_of_birth) < 18:
        raise HTTPException(400, "만 18세 이상만 가입할 수 있습니다.")

    existing = db.query(User).filter(User.email == body.email).first()
    if existing and existing.is_verified:
        raise HTTPException(409, "이미 가입된 이메일입니다.")

    code = _gen_code()
    if existing:
        # Unverified re-signup: refresh credentials + code instead of erroring out.
        existing.password_hash = hash_password(body.password)
        existing.handedness = body.handedness
        existing.date_of_birth = body.date_of_birth
        existing.consent_analytics = body.consent_analytics
        existing.consent_share = body.consent_share
        existing.verification_code = code
        user = existing
    else:
        user = User(
            email=body.email,
            password_hash=hash_password(body.password),
            handedness=body.handedness,
            date_of_birth=body.date_of_birth,
            consent_analytics=body.consent_analytics,
            consent_share=body.consent_share,
            is_verified=False,
            verification_code=code,
        )
        db.add(user)
    db.commit()

    send_verification_code(body.email, code)
    return SignupResponse(
        email=body.email,
        dev_code=code if settings.expose_verification_code else None,
    )


@router.post("/verify", response_model=AuthResponse)
def verify(body: VerifyRequest, db: Session = Depends(get_session)) -> AuthResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if user is None:
        raise HTTPException(404, "가입되지 않은 이메일입니다.")
    if user.is_verified:
        return _token_for(user)
    if not user.verification_code or body.code.strip() != user.verification_code:
        raise HTTPException(400, "인증 코드가 올바르지 않습니다.")

    user.is_verified = True
    user.verification_code = None
    db.commit()
    db.refresh(user)
    return _token_for(user)


@router.post("/resend", response_model=SignupResponse)
def resend(body: ResendRequest, db: Session = Depends(get_session)) -> SignupResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if user is None:
        raise HTTPException(404, "가입되지 않은 이메일입니다.")
    if user.is_verified:
        raise HTTPException(400, "이미 인증된 계정입니다.")
    code = _gen_code()
    user.verification_code = code
    db.commit()
    send_verification_code(body.email, code)
    return SignupResponse(email=body.email, dev_code=code if settings.expose_verification_code else None)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_session)) -> AuthResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")
    if not user.is_verified:
        raise HTTPException(403, "이메일 인증이 완료되지 않았습니다.")
    return _token_for(user)


class MeResponse(BaseModel):
    email: str
    handedness: Literal["RH", "LH"]


@router.get("/me", response_model=MeResponse)
def me(
    db: Session = Depends(get_session),
    user_id=Depends(get_required_user_id),
) -> MeResponse:
    """Validate the bearer token and return the account it belongs to.

    The frontend AuthGuard calls this so that stale/demo/expired tokens get
    rejected instead of passing a mere existence check.
    """
    user = db.get(User, user_id)
    if user is None or not user.is_verified:
        raise HTTPException(401, "로그인이 필요합니다.")
    return MeResponse(email=user.email, handedness=user.handedness)
