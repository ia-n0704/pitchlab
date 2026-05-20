import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    handedness: Mapped[str] = mapped_column(String(2), default="RH", nullable=False)  # RH / LH
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    consent_analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_share: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
