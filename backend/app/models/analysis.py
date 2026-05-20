import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class AnalysisStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    rejected = "rejected"  # quality check failed


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus, name="analysis_status"), default=AnalysisStatus.queued, nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    video_fps: Mapped[float | None] = mapped_column(default=None)
    video_frames: Mapped[int | None] = mapped_column(Integer, default=None)
    video_width: Mapped[int | None] = mapped_column(Integer, default=None)
    video_height: Mapped[int | None] = mapped_column(Integer, default=None)
    metrics: Mapped[dict | None] = mapped_column(JSONB, default=None)
    kinetic_score: Mapped[int | None] = mapped_column(Integer, default=None)
    llm_comment: Mapped[str | None] = mapped_column(Text, default=None)
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
