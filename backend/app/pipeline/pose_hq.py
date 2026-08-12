"""
High-quality pose extraction: ViTPose 2D + MediaPipe GHUM 3D fusion + temporal refinement.

Division of labour:
  - ViTPose (top-down, SOTA accuracy) owns the 2D image-space keypoints — this is
    what the dashboard skeleton overlay renders, and where BlazePose visibly
    fails on fast/blurred pitching motion.
  - MediaPipe BlazePose GHUM still owns world_xyz (metric 3D, hip-centered) —
    all 8 biomechanical metrics keep their existing formulas untouched.
  - smoothing.refine_2d_tracks removes jitter from the fused 2D tracks
    (gap-fill + Savitzky-Golay; SmoothNet-style temporal-only refinement).

Frames where MediaPipe fails but ViTPose succeeds are kept: their world_xyz is
linearly interpolated from neighbouring MediaPipe frames, so blurred release
frames no longer vanish from the sequence.

Exposes the same signature as pose.extract_pose_sequence so analyze.py can
switch backends via settings.pose_backend.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

from .pose import PoseFrame
from .pose_vitpose import COCO_TO_BLAZE, estimate_2d_sequence
from .smoothing import fix_lr_consistency, refine_2d_tracks

mp_pose = mp.solutions.pose

# BlazePose landmark ids for foot points that COCO-17 lacks.
_L_ANKLE, _R_ANKLE = 27, 28
_L_FOOT, _R_FOOT = 31, 32


def _mediapipe_pass(video_path: Path) -> tuple[dict[int, tuple[np.ndarray, np.ndarray, np.ndarray]], dict]:
    """Run BlazePose Heavy; return {frame_idx: (image_xy, world_xyz, visibility)}."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {video_path}")
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 60.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    out: dict[int, tuple[np.ndarray, np.ndarray, np.ndarray]] = {}
    with mp_pose.Pose(
        static_image_mode=False,
        model_complexity=2,
        smooth_landmarks=True,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as pose:
        idx = 0
        while True:
            ok, frame_bgr = cap.read()
            if not ok:
                break
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            frame_rgb.flags.writeable = False
            result = pose.process(frame_rgb)
            if result.pose_landmarks and result.pose_world_landmarks:
                lms = result.pose_landmarks.landmark
                wlms = result.pose_world_landmarks.landmark
                out[idx] = (
                    np.array([[lm.x * width, lm.y * height] for lm in lms], dtype=np.float32),
                    np.array([[w.x, w.y, w.z] for w in wlms], dtype=np.float32),
                    np.array([lm.visibility for lm in lms], dtype=np.float32),
                )
            idx += 1
    cap.release()
    meta = {"fps": fps, "width": width, "height": height, "frames": total}
    return out, meta


def _interp_world(target_idx: int, mp_frames: dict[int, tuple], keys: list[int]) -> np.ndarray | None:
    """Linear-interpolate world_xyz for a frame MediaPipe missed."""
    prev = max((k for k in keys if k < target_idx), default=None)
    nxt = min((k for k in keys if k > target_idx), default=None)
    if prev is None and nxt is None:
        return None
    if prev is None:
        return mp_frames[nxt][1].copy()
    if nxt is None:
        return mp_frames[prev][1].copy()
    a = (target_idx - prev) / (nxt - prev)
    return ((1 - a) * mp_frames[prev][1] + a * mp_frames[nxt][1]).astype(np.float32)


def extract_pose_sequence_hq(
    video_path: Path, max_frames: int | None = None
) -> tuple[list[PoseFrame], dict]:
    """ViTPose 2D + MediaPipe 3D fused sequence with temporal refinement."""
    mp_frames, meta = _mediapipe_pass(video_path)
    vit_results, vit_meta = estimate_2d_sequence(video_path)
    meta["pose_backend"] = f"vitpose+mediapipe ({vit_meta['device']})"

    mp_keys = sorted(mp_frames.keys())
    fps = meta["fps"]

    frames: list[PoseFrame] = []
    for idx in range(len(vit_results)):
        if max_frames and len(frames) >= max_frames:
            break
        vit = vit_results[idx]
        has_mp = idx in mp_frames
        if vit is None and not has_mp:
            continue

        if has_mp:
            image_xy, world_xyz, visibility = (a.copy() for a in mp_frames[idx])
        else:
            world_xyz = _interp_world(idx, mp_frames, mp_keys)
            if world_xyz is None:
                continue  # no 3D anchor anywhere — cannot serve metrics
            image_xy = np.zeros((33, 2), dtype=np.float32)
            visibility = np.zeros(33, dtype=np.float32)

        if vit is not None:
            # ViTPose owns the shared 17 joints in image space.
            for ci, bi in COCO_TO_BLAZE.items():
                image_xy[bi] = vit.kpts[ci]
                visibility[bi] = vit.scores[ci]
            if not has_mp:
                # COCO has no foot-index points — approximate with the ankles so
                # the overlay stays connected on MediaPipe-missed frames.
                image_xy[_L_FOOT] = image_xy[_L_ANKLE]
                image_xy[_R_FOOT] = image_xy[_R_ANKLE]
                visibility[_L_FOOT] = visibility[_L_ANKLE] * 0.8
                visibility[_R_FOOT] = visibility[_R_ANKLE] * 0.8

        frames.append(
            PoseFrame(
                t=idx / fps,
                frame_idx=idx,
                image_xy=image_xy,
                world_xyz=world_xyz,
                visibility=visibility,
            )
        )

    if len(frames) >= 5:
        pts = np.stack([f.image_xy for f in frames])          # (F, 33, 2)
        conf = np.stack([f.visibility for f in frames])       # (F, 33)

        # 1) Fix per-frame L/R label swaps (throwing arm jumping sides) BEFORE
        #    smoothing — otherwise a swapped frame drags the average across the body.
        pts, conf = fix_lr_consistency(pts, conf)

        # 2) Zigzag outlier rejection + PCHIP gap-fill + velocity-adaptive
        #    smoothing. Blurred release frames make the wrist oscillate between
        #    two distant candidates (true hand vs glove side, 300-400px apart);
        #    plain averaging lands on neither. Rejecting the temporally
        #    inconsistent detections and re-filling along the curved whip arc
        #    keeps the release-frame arm on the real trajectory, and adaptive
        #    smoothing preserves the speed peak instead of flattening it.
        refined = refine_2d_tracks(pts, conf, min_conf=0.5, outlier_base=30.0, velocity_adaptive=True)
        for f, p, c in zip(frames, refined, conf):
            f.image_xy = p.astype(np.float32)
            f.visibility = c.astype(np.float32)

        # Refine world tracks too: a single collapsed MediaPipe frame (occlusion,
        # blur) otherwise poisons release detection and ratio metrics (e.g. a
        # near-zero body height explodes stride %). MediaPipe's own visibility is
        # the confidence; interpolated frames count as zero-confidence so they are
        # re-derived from confident neighbours after smoothing.
        world = np.stack([f.world_xyz for f in frames])       # (F, 33, 3)
        world_conf = np.stack(
            [f.visibility if f.frame_idx in mp_frames else np.zeros(33, dtype=np.float32) for f in frames]
        )
        world_refined = refine_2d_tracks(world, world_conf)
        for f, w in zip(frames, world_refined):
            f.world_xyz = w.astype(np.float32)

    meta["analysed_frames"] = len(frames)
    return frames, meta
