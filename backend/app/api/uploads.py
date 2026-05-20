"""
POST /uploads — accept a video, drop it into storage, create an Analysis row in
status=queued, and enqueue the Celery task.
"""
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Analysis, AnalysisStatus
from app.storage import get_storage
from app.tasks import analyze_video

router = APIRouter(prefix="/uploads", tags=["uploads"])

ACCEPTED_TYPES = {"video/mp4", "video/quicktime", "video/x-matroska", "video/webm"}
MAX_BYTES = 200 * 1024 * 1024  # 200 MB


class UploadResponse(BaseModel):
    analysis_id: uuid.UUID
    status: AnalysisStatus


@router.post("", response_model=UploadResponse, status_code=201)
async def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
) -> UploadResponse:
    if file.content_type not in ACCEPTED_TYPES:
        raise HTTPException(415, f"허용되지 않는 형식입니다: {file.content_type}")

    # spool to a temp file so we can size-check & hand off to storage backend
    suffix = Path(file.filename or "upload").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        size = 0
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                tmp.close()
                Path(tmp.name).unlink(missing_ok=True)
                raise HTTPException(413, f"파일이 200MB를 초과합니다.")
            tmp.write(chunk)
        tmp_path = Path(tmp.name)

    try:
        analysis_id = uuid.uuid4()
        storage_key = f"{analysis_id}{suffix}"
        get_storage().put(storage_key, tmp_path, content_type=file.content_type or "video/mp4")

        row = Analysis(
            id=analysis_id,
            storage_key=storage_key,
            original_filename=file.filename or storage_key,
            status=AnalysisStatus.queued,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        # fire-and-forget; worker will move it through processing → completed/rejected
        analyze_video.delay(str(analysis_id))

        return UploadResponse(analysis_id=row.id, status=row.status)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass
