"""
End-to-end analysis driver. Wires quality gate → pose extraction → metric computation → LLM coaching.
This module is intentionally side-effect free — DB writes happen in the Celery task that calls it.
"""
import logging
from pathlib import Path

from app.config import settings
from app.llm import generate_coaching_comment, select_drills

from .metrics import compute_metrics
from .pose import extract_pose_sequence
from .quality import inspect

logger = logging.getLogger(__name__)


def _extract(video_path: Path):
    """Pick the pose backend per settings; HQ falls back to MediaPipe-only."""
    if settings.pose_backend == "hq":
        try:
            from .pose_hq import extract_pose_sequence_hq

            return extract_pose_sequence_hq(video_path)
        except Exception:
            logger.exception("HQ pose backend failed — falling back to MediaPipe")
    return extract_pose_sequence(video_path)


def run_analysis(video_path: Path) -> dict:
    """Run all pipeline stages. Returns a result dict (or raises)."""
    # 1. Quality gate
    qr = inspect(video_path)
    if not qr.passed:
        return {
            "status": "rejected",
            "quality": {"fps": qr.fps, "width": qr.width, "height": qr.height, "frames": qr.frames, "issues": qr.issues},
        }

    # 2. Pose extraction
    frames, meta = _extract(video_path)
    if len(frames) < 10:
        return {
            "status": "rejected",
            "quality": {"fps": meta["fps"], "width": meta["width"], "height": meta["height"], "frames": meta["frames"], "issues": ["사람을 충분히 탐지하지 못했습니다."]},
        }

    # 3. Metrics
    metrics = compute_metrics(frames, fps=meta["fps"])

    # 4. Corrective drills — deterministic, derived from the metrics (not the LLM).
    metrics["drills"] = select_drills(metrics)

    # 5. LLM coaching
    comment = generate_coaching_comment(metrics)

    return {
        "status": "completed",
        "meta": meta,
        "metrics": metrics,
        "comment": comment,
    }
