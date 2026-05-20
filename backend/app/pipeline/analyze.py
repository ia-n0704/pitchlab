"""
End-to-end analysis driver. Wires quality gate → pose extraction → metric computation → LLM coaching.
This module is intentionally side-effect free — DB writes happen in the Celery task that calls it.
"""
from pathlib import Path

from app.llm import generate_coaching_comment

from .metrics import compute_metrics
from .pose import extract_pose_sequence
from .quality import inspect


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
    frames, meta = extract_pose_sequence(video_path)
    if len(frames) < 10:
        return {
            "status": "rejected",
            "quality": {"fps": meta["fps"], "width": meta["width"], "height": meta["height"], "frames": meta["frames"], "issues": ["사람을 충분히 탐지하지 못했습니다."]},
        }

    # 3. Metrics
    metrics = compute_metrics(frames, fps=meta["fps"])

    # 4. LLM coaching
    comment = generate_coaching_comment(metrics)

    return {
        "status": "completed",
        "meta": meta,
        "metrics": metrics,
        "comment": comment,
    }
