"""
Celery app entry. Worker process discovers tasks below.
"""
from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "pitchlab",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_max_tasks_per_child=20,  # restart workers periodically to release MediaPipe TF allocations
    task_acks_late=True,
    # Retention policy (planning §8): purge expired videos daily at 03:00 UTC.
    beat_schedule={
        "purge-expired-videos": {
            "task": "pitchlab.cleanup_expired_videos",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)
