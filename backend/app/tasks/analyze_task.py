"""
Celery task: fetch video from storage → run pipeline → write result back to Postgres.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from app.db import SessionLocal
from app.models import Analysis, AnalysisStatus
from app.pipeline import run_analysis
from app.storage import get_storage
from app.worker import celery_app

log = logging.getLogger(__name__)


@celery_app.task(name="pitchlab.analyze_video", bind=True, soft_time_limit=600, time_limit=900)
def analyze_video(self, analysis_id: str) -> dict:  # noqa: ARG001 (bind=True needs self)
    db = SessionLocal()
    try:
        a = db.get(Analysis, uuid.UUID(analysis_id))
        if a is None:
            return {"error": "analysis not found"}

        a.status = AnalysisStatus.processing
        db.commit()

        storage = get_storage()
        local_path = storage.open_path(a.storage_key)

        result = run_analysis(local_path)

        if result["status"] == "rejected":
            a.status = AnalysisStatus.rejected
            a.error_message = "; ".join(result["quality"]["issues"])
            a.video_fps = result["quality"].get("fps")
            a.video_frames = result["quality"].get("frames")
            a.video_width = result["quality"].get("width")
            a.video_height = result["quality"].get("height")
        else:
            meta = result["meta"]
            a.video_fps = meta["fps"]
            a.video_frames = meta["frames"]
            a.video_width = meta["width"]
            a.video_height = meta["height"]
            a.metrics = result["metrics"]
            a.kinetic_score = result["metrics"].get("kinetic_score")
            a.llm_comment = result["comment"]
            a.status = AnalysisStatus.completed
            a.completed_at = datetime.now(timezone.utc)

        db.commit()
        return {"status": a.status.value, "analysis_id": analysis_id}

    except Exception as exc:  # noqa: BLE001 — record failure on the row
        log.exception("analysis %s failed", analysis_id)
        a = db.get(Analysis, uuid.UUID(analysis_id))
        if a is not None:
            a.status = AnalysisStatus.failed
            a.error_message = f"{type(exc).__name__}: {exc}"
            db.commit()
        raise
    finally:
        db.close()
