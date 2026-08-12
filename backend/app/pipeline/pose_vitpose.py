"""
High-accuracy 2D pose backend: RT-DETR person detection + ViTPose top-down.

Why this stack (research-verified, 2026-07):
  - ViTPose(+) defines the practical accuracy ceiling for 2D pose (~79-81 COCO AP
    vs MoveNet/BlazePose's much lower tier) and is Apache-2.0 via HF transformers.
  - Top-down (detect person → crop → pose) is the accuracy-first configuration
    recommended for offline server processing.

Models are lazy-loaded singletons; device auto-selects cuda → mps → cpu.
The detector runs every `detect_every` frames — between detections the last
person box is reused with a margin, which is safe for a single pitcher who
moves continuously (and is the standard top-down + tracking trick).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from app.config import settings

# COCO-17 keypoint order produced by ViTPose.
COCO_KP = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

# COCO-17 index → BlazePose-33 landmark index (shared joints only).
COCO_TO_BLAZE = {
    0: 0,    # nose
    1: 2,    # left_eye
    2: 5,    # right_eye
    3: 7,    # left_ear
    4: 8,    # right_ear
    5: 11, 6: 12,    # shoulders
    7: 13, 8: 14,    # elbows
    9: 15, 10: 16,   # wrists
    11: 23, 12: 24,  # hips
    13: 25, 14: 26,  # knees
    15: 27, 16: 28,  # ankles
}


@dataclass
class VitPoseResult:
    """Per-frame ViTPose output in image pixels."""
    kpts: np.ndarray    # (17, 2)
    scores: np.ndarray  # (17,)
    box: np.ndarray | None = None  # crop box [x, y, w, h] actually fed to ViTPose


_models: dict | None = None


def _load_models() -> dict:
    global _models
    if _models is not None:
        return _models

    import torch
    from transformers import (
        AutoProcessor,
        RTDetrForObjectDetection,
        VitPoseForPoseEstimation,
    )

    if settings.pose_device:
        device = settings.pose_device
    elif torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"

    det_proc = AutoProcessor.from_pretrained(settings.vitpose_detector)
    detector = RTDetrForObjectDetection.from_pretrained(settings.vitpose_detector).to(device).eval()
    pose_proc = AutoProcessor.from_pretrained(settings.vitpose_model)
    pose_model = VitPoseForPoseEstimation.from_pretrained(settings.vitpose_model).to(device).eval()

    _models = {
        "torch": torch,
        "device": device,
        "det_proc": det_proc,
        "detector": detector,
        "pose_proc": pose_proc,
        "pose_model": pose_model,
        # ViTPose+ checkpoints are MoE — they need a dataset expert index (0 = COCO).
        # num_experts lives on the backbone config in HF transformers.
        "needs_dataset_index": getattr(
            getattr(pose_model.config, "backbone_config", pose_model.config), "num_experts", 1
        ) > 1,
    }
    return _models


def _detect_person(m: dict, rgb: np.ndarray, prev_box: np.ndarray | None) -> np.ndarray | None:
    """Detect people, return the best [x, y, w, h] box (pixel coords) or None.

    Prefers the box nearest the previously tracked person; falls back to the
    largest person (the pitcher dominates the frame in PitchLab's shooting guide).
    """
    torch = m["torch"]
    h, w = rgb.shape[:2]
    inputs = m["det_proc"](images=rgb, return_tensors="pt").to(m["device"])
    with torch.no_grad():
        outputs = m["detector"](**inputs)
    dets = m["det_proc"].post_process_object_detection(
        outputs, target_sizes=torch.tensor([(h, w)]), threshold=0.4
    )[0]

    boxes = []
    for label, box, score in zip(dets["labels"], dets["boxes"], dets["scores"]):
        if label.item() != 0:  # COCO class 0 = person
            continue
        x0, y0, x1, y1 = box.tolist()
        boxes.append(np.array([x0, y0, x1 - x0, y1 - y0], dtype=np.float32))
    if not boxes:
        return None

    if prev_box is not None:
        pc = prev_box[:2] + prev_box[2:] / 2
        boxes.sort(key=lambda b: float(np.linalg.norm(b[:2] + b[2:] / 2 - pc)))
        return boxes[0]
    boxes.sort(key=lambda b: float(b[2] * b[3]), reverse=True)
    return boxes[0]


def _expand_box(box: np.ndarray, w: int, h: int, margin: float = 0.12) -> np.ndarray:
    x, y, bw, bh = box
    dx, dy = bw * margin, bh * margin
    x0 = max(0.0, x - dx)
    y0 = max(0.0, y - dy)
    x1 = min(float(w), x + bw + dx)
    y1 = min(float(h), y + bh + dy)
    return np.array([x0, y0, x1 - x0, y1 - y0], dtype=np.float32)


def _estimate_pose(m: dict, rgb: np.ndarray, box: np.ndarray) -> VitPoseResult | None:
    torch = m["torch"]
    inputs = m["pose_proc"](rgb, boxes=[[box.tolist()]], return_tensors="pt").to(m["device"])
    if m["needs_dataset_index"]:
        inputs["dataset_index"] = torch.zeros(1, dtype=torch.int64, device=m["device"])
    with torch.no_grad():
        outputs = m["pose_model"](**inputs)
    res = m["pose_proc"].post_process_pose_estimation(outputs, boxes=[[box.tolist()]])[0]
    if not res:
        return None
    kpts = res[0]["keypoints"].cpu().numpy().astype(np.float32)
    scores = res[0]["scores"].cpu().numpy().astype(np.float32)
    return VitPoseResult(kpts=kpts, scores=scores, box=box.copy())


def estimate_2d_sequence(video_path: Path) -> tuple[list[VitPoseResult | None], dict]:
    """Run detector + ViTPose over every frame of the video.

    Returns a per-frame list (None where no person was found) and video meta.
    """
    m = _load_models()

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {video_path}")
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 60.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    detect_every = max(1, settings.vitpose_detect_every)
    results: list[VitPoseResult | None] = []
    box: np.ndarray | None = None
    idx = 0
    while True:
        ok, frame_bgr = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

        if box is None or idx % detect_every == 0:
            found = _detect_person(m, rgb, box)
            if found is not None:
                box = found
        if box is None:
            results.append(None)
            idx += 1
            continue

        crop_box = _expand_box(box, width, height)
        pose = _estimate_pose(m, rgb, crop_box)
        results.append(pose)

        # keep tracking: tighten the box around the detected keypoints
        if pose is not None and (pose.scores > 0.3).sum() >= 6:
            good = pose.kpts[pose.scores > 0.3]
            x0, y0 = good.min(axis=0)
            x1, y1 = good.max(axis=0)
            new_box = _expand_box(
                np.array([x0, y0, x1 - x0, y1 - y0], dtype=np.float32), width, height, margin=0.25
            )
            # Guards against fast-motion tracking failures:
            #  - a blurred frame can leave only a cluster of torso joints confident,
            #    collapsing the box (seen: 69×342 for a full pitcher) and cropping
            #    the arm out of the next inference → never shrink >30%/frame.
            if new_box[2] < 0.7 * box[2] or new_box[3] < 0.7 * box[3]:
                cx, cy = new_box[0] + new_box[2] / 2, new_box[1] + new_box[3] / 2
                bw2, bh2 = max(new_box[2], 0.7 * box[2]), max(new_box[3], 0.7 * box[3])
                new_box = _expand_box(
                    np.array([cx - bw2 / 2, cy - bh2 / 2, bw2, bh2], dtype=np.float32),
                    width, height, margin=0.0,
                )
            # (No velocity-based margin: measured wrist-to-edge stays >100px even
            #  at release, and inflating the crop shrinks the person → worse raw.)
            box = new_box
        idx += 1

    cap.release()
    meta = {"fps": fps, "width": width, "height": height, "frames": idx, "device": m["device"]}
    return results, meta
