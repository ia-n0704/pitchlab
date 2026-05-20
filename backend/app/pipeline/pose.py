"""
Frame-by-frame pose extraction using MediaPipe BlazePose Heavy.

MediaPipe gives us:
  - 33 landmarks in image coordinates (x, y in [0,1], plus visibility),
  - 33 *world_landmarks* in metric meters relative to hip center (BlazePose GHUM).

The GHUM 3D output is approximate but real and removes the need for a separate
lifting model (MotionBERT) in the MVP. We expose a clean interface so swapping
to MotionBERT 3D later is a one-module change.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

mp_pose = mp.solutions.pose

# 33-keypoint BlazePose indices — names we care about
LM = {
    "nose": 0,
    "right_shoulder": 12,
    "left_shoulder": 11,
    "right_elbow": 14,
    "left_elbow": 13,
    "right_wrist": 16,
    "left_wrist": 15,
    "right_hip": 24,
    "left_hip": 23,
    "right_knee": 26,
    "left_knee": 25,
    "right_ankle": 28,
    "left_ankle": 27,
    "right_foot": 32,
    "left_foot": 31,
}


@dataclass
class PoseFrame:
    """One frame of analysed pose."""

    t: float          # seconds since start
    frame_idx: int
    # arrays indexed by BlazePose landmark id (33)
    image_xy: np.ndarray   # shape (33, 2), pixel coords
    world_xyz: np.ndarray  # shape (33, 3), meters, hip-centered
    visibility: np.ndarray # shape (33,)


def extract_pose_sequence(video_path: Path, max_frames: int | None = None) -> tuple[list[PoseFrame], dict]:
    """Run BlazePose Heavy on every frame.

    Returns the per-frame sequence and a metadata dict (fps, frames, width, height).
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {video_path}")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 60.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    out: list[PoseFrame] = []

    with mp_pose.Pose(
        static_image_mode=False,
        model_complexity=2,           # "Heavy" — best accuracy
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
            if max_frames and idx >= max_frames:
                break

            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            frame_rgb.flags.writeable = False
            result = pose.process(frame_rgb)

            if result.pose_landmarks and result.pose_world_landmarks:
                lms = result.pose_landmarks.landmark
                wlms = result.pose_world_landmarks.landmark

                image_xy = np.array([[lm.x * width, lm.y * height] for lm in lms], dtype=np.float32)
                world_xyz = np.array([[w.x, w.y, w.z] for w in wlms], dtype=np.float32)
                visibility = np.array([lm.visibility for lm in lms], dtype=np.float32)

                out.append(
                    PoseFrame(
                        t=idx / fps,
                        frame_idx=idx,
                        image_xy=image_xy,
                        world_xyz=world_xyz,
                        visibility=visibility,
                    )
                )
            idx += 1

    cap.release()

    meta = {"fps": fps, "width": width, "height": height, "frames": total, "analysed_frames": len(out)}
    return out, meta
