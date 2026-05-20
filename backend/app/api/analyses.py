"""
GET /analyses/{id} → status + (if completed) metrics + LLM comment.
GET /analyses → recent list.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Analysis, AnalysisStatus

router = APIRouter(prefix="/analyses", tags=["analyses"])


class AnalysisSummary(BaseModel):
    id: uuid.UUID
    status: AnalysisStatus
    created_at: datetime
    kinetic_score: int | None
    original_filename: str


class AnalysisDetail(BaseModel):
    id: uuid.UUID
    status: AnalysisStatus
    created_at: datetime
    completed_at: datetime | None
    kinetic_score: int | None
    metrics: dict | None
    llm_comment: str | None
    error_message: str | None
    video_fps: float | None
    video_frames: int | None
    video_width: int | None
    video_height: int | None


@router.get("", response_model=list[AnalysisSummary])
def list_recent(limit: int = 14, db: Session = Depends(get_session)) -> list[AnalysisSummary]:
    rows = db.query(Analysis).order_by(desc(Analysis.created_at)).limit(limit).all()
    return [
        AnalysisSummary(
            id=r.id,
            status=r.status,
            created_at=r.created_at,
            kinetic_score=r.kinetic_score,
            original_filename=r.original_filename,
        )
        for r in rows
    ]


@router.get("/{analysis_id}", response_model=AnalysisDetail)
def get_one(analysis_id: uuid.UUID, db: Session = Depends(get_session)) -> AnalysisDetail:
    r = db.get(Analysis, analysis_id)
    if r is None:
        raise HTTPException(404, "분석 결과를 찾을 수 없습니다.")
    return AnalysisDetail(
        id=r.id,
        status=r.status,
        created_at=r.created_at,
        completed_at=r.completed_at,
        kinetic_score=r.kinetic_score,
        metrics=r.metrics,
        llm_comment=r.llm_comment,
        error_message=r.error_message,
        video_fps=r.video_fps,
        video_frames=r.video_frames,
        video_width=r.video_width,
        video_height=r.video_height,
    )
