"""
Shared FastAPI dependencies.
"""
from __future__ import annotations

import uuid

from fastapi import Header, HTTPException

from app.security import decode_token


def get_optional_user_id(authorization: str | None = Header(default=None)) -> uuid.UUID | None:
    """Decode the bearer token if present. Returns None for anonymous requests."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    subject = decode_token(token)
    if not subject:
        return None
    try:
        return uuid.UUID(subject)
    except (ValueError, TypeError):
        return None


def get_required_user_id(authorization: str | None = Header(default=None)) -> uuid.UUID:
    """Like get_optional_user_id, but rejects anonymous/invalid tokens with 401.

    Analysis is a logged-in feature: uploads and result access must carry a
    valid JWT so every Analysis row is attributed to a verified account.
    """
    user_id = get_optional_user_id(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    return user_id
