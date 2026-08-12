"""
Retention cleanup (planning §8).

Original videos are deleted `VIDEO_RETENTION_DAYS` (default 30) after upload.
The analysis row and its anonymised metrics are kept; only the source video is
removed from storage. Runs on a Celery beat schedule (see worker.py).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import Analysis
from app.storage import get_storage
from app.worker import celery_app

log = logging.getLogger(__name__)


@celery_app.task(name="pitchlab.cleanup_expired_videos")
def cleanup_expired_videos() -> dict:
    """Delete source videos older than the retention window. Idempotent."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.video_retention_days)
    storage = get_storage()
    db = SessionLocal()
    deleted = 0
    try:
        # storage_key is blanked once purged, so we never re-process a row.
        rows = db.execute(
            select(Analysis).where(
                Analysis.created_at < cutoff,
                Analysis.storage_key != "",
            )
        ).scalars().all()

        for row in rows:
            try:
                storage.delete(row.storage_key)
            except Exception:  # noqa: BLE001 — best-effort; still mark as purged
                log.exception("failed to delete storage key %s", row.storage_key)
            row.storage_key = ""
            deleted += 1

        db.commit()
        if deleted:
            log.info("retention cleanup purged %d expired video(s)", deleted)
        return {"purged": deleted}
    finally:
        db.close()
