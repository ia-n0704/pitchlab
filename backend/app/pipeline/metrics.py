"""
Compute the 8 PitchLab biomechanical metrics from a sequence of PoseFrame.

We auto-detect handedness by which wrist swings faster, then derive:
  Upper body (5):
    1. MER             — peak shoulder external rotation (deg) during cocking
    2. Elbow height    — elbow Y vs throwing-shoulder Y at release (deg)
    3. ER velocity     — peak angular velocity of the upper-arm vector (deg/s)
    4. Trunk tilt      — lateral trunk lean at release (deg)
    5. Release consistency — stddev of wrist position at release across release windows (cm)
  Lower body (3):
    6. X-Factor        — peak pelvis–shoulder separation angle (deg)
    7. Pelvis velocity — peak pelvis rotation angular velocity (deg/s)
    8. Stride length   — distance between feet at plant, % of body height

All formulas use BlazePose GHUM world_xyz coordinates (meters, hip-centered).
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np

from .pose import LM, PoseFrame


# ─────────────────────────────────────────────────────────────
# Vector math helpers
# ─────────────────────────────────────────────────────────────
def _angle_between(v1: np.ndarray, v2: np.ndarray) -> float:
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 0.0
    c = float(np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0))
    return math.degrees(math.acos(c))


def _smooth(x: np.ndarray, k: int = 5) -> np.ndarray:
    if len(x) < k:
        return x
    kernel = np.ones(k) / k
    return np.convolve(x, kernel, mode="same")


# ─────────────────────────────────────────────────────────────
# Handedness detection: whichever wrist sweeps further is the throwing arm
# ─────────────────────────────────────────────────────────────
def detect_handedness(frames: list[PoseFrame]) -> str:
    rw = np.array([f.world_xyz[LM["right_wrist"]] for f in frames])
    lw = np.array([f.world_xyz[LM["left_wrist"]] for f in frames])
    r_range = np.linalg.norm(rw.max(axis=0) - rw.min(axis=0))
    l_range = np.linalg.norm(lw.max(axis=0) - lw.min(axis=0))
    return "RH" if r_range >= l_range else "LH"


# ─────────────────────────────────────────────────────────────
# Release-frame detection: wrist forward velocity peaks at release
# ─────────────────────────────────────────────────────────────
def detect_release_frame(frames: list[PoseFrame], throwing_side: str) -> int:
    key = "right_wrist" if throwing_side == "RH" else "left_wrist"
    pts = np.array([f.world_xyz[LM[key]] for f in frames])
    if len(pts) < 3:
        return len(pts) - 1
    vel = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    vel = _smooth(vel, 5)
    return int(np.argmax(vel)) + 1  # +1 because diff shifts by 1


# ─────────────────────────────────────────────────────────────
# Metric primitives
# ─────────────────────────────────────────────────────────────
def _shoulder_external_rotation_deg(f: PoseFrame, side: str) -> float:
    """Approx peak shoulder external rotation.

    Defined here as the angle (in the trunk plane) between the upper-arm vector
    (shoulder→elbow) and the trunk-down axis (shoulder→hip on same side).
    180° means the upper arm is fully cocked back/up — i.e. peak external rotation.
    """
    sh = LM["right_shoulder"] if side == "RH" else LM["left_shoulder"]
    el = LM["right_elbow"] if side == "RH" else LM["left_elbow"]
    hp = LM["right_hip"] if side == "RH" else LM["left_hip"]

    upper_arm = f.world_xyz[el] - f.world_xyz[sh]
    trunk_down = f.world_xyz[hp] - f.world_xyz[sh]
    return _angle_between(upper_arm, trunk_down)


def _elbow_height_deviation_deg(f: PoseFrame, side: str) -> float:
    """Angle of elbow vs shoulder line in the camera frame (deg).

    Positive = elbow above the shoulder line.
    Negative = elbow below (inverted-W risk).
    """
    sh = LM["right_shoulder"] if side == "RH" else LM["left_shoulder"]
    el = LM["right_elbow"] if side == "RH" else LM["left_elbow"]
    dx = f.world_xyz[el][0] - f.world_xyz[sh][0]
    dy = f.world_xyz[sh][1] - f.world_xyz[el][1]  # invert: up is positive
    if abs(dx) < 1e-6:
        return 90.0 * (1 if dy >= 0 else -1)
    return math.degrees(math.atan2(dy, abs(dx)))


def _trunk_tilt_deg(f: PoseFrame) -> float:
    """Lateral trunk lean — angle between trunk vector (mid-hip → mid-shoulder) and world vertical."""
    mid_sh = (f.world_xyz[LM["right_shoulder"]] + f.world_xyz[LM["left_shoulder"]]) / 2
    mid_hp = (f.world_xyz[LM["right_hip"]] + f.world_xyz[LM["left_hip"]]) / 2
    trunk = mid_sh - mid_hp
    # project onto the X (lateral) and Y (vertical) plane; ignore depth
    return abs(math.degrees(math.atan2(trunk[0], -trunk[1])))


def _x_factor_deg(f: PoseFrame) -> float:
    """Hip–shoulder separation angle in the transverse plane (deg)."""
    sh_vec = f.world_xyz[LM["right_shoulder"]] - f.world_xyz[LM["left_shoulder"]]
    hp_vec = f.world_xyz[LM["right_hip"]] - f.world_xyz[LM["left_hip"]]
    # project to horizontal plane (XZ) — ignore vertical Y
    sh_h = np.array([sh_vec[0], sh_vec[2]])
    hp_h = np.array([hp_vec[0], hp_vec[2]])
    return _angle_between(sh_h, hp_h)


def _pelvis_yaw_deg(f: PoseFrame) -> float:
    """Signed yaw angle of pelvis line in the horizontal plane (deg). Used for derivative."""
    hp_vec = f.world_xyz[LM["right_hip"]] - f.world_xyz[LM["left_hip"]]
    return math.degrees(math.atan2(hp_vec[2], hp_vec[0]))


def _body_height(f: PoseFrame) -> float:
    head_y = f.world_xyz[LM["nose"]][1]
    foot_y = (f.world_xyz[LM["right_ankle"]][1] + f.world_xyz[LM["left_ankle"]][1]) / 2
    return abs(foot_y - head_y)


# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────
@dataclass
class MetricResult:
    value: float
    unit: str
    norm_min: float
    norm_max: float
    ok: bool


def _band(value: float, lo: float, hi: float) -> bool:
    return lo <= value <= hi


def compute_metrics(frames: list[PoseFrame], fps: float) -> dict:
    """Run the full metric panel. Returns a JSON-serializable dict."""
    if len(frames) < 10:
        raise ValueError("not enough frames to analyse (need ≥ 10).")

    side = detect_handedness(frames)
    rel_idx = detect_release_frame(frames, side)
    rel_idx = max(2, min(len(frames) - 3, rel_idx))

    # ── MER (peak external rotation in cocking phase, i.e. just before release)
    cocking_window = frames[max(0, rel_idx - int(0.3 * fps)) : rel_idx + 1]
    mer_series = [_shoulder_external_rotation_deg(f, side) for f in cocking_window]
    mer = float(max(mer_series)) if mer_series else 0.0

    # ── Elbow height at release
    elbow_h = _elbow_height_deviation_deg(frames[rel_idx], side)

    # ── ER velocity: peak angular velocity of the upper-arm vector (deg / s)
    er_angles = np.array([_shoulder_external_rotation_deg(f, side) for f in frames], dtype=np.float64)
    er_angles_s = _smooth(er_angles, 3)
    er_dot = np.diff(er_angles_s) * fps  # deg / sec (per-frame * fps)
    er_velocity = float(np.max(np.abs(er_dot))) if len(er_dot) else 0.0

    # ── Trunk tilt @ release
    trunk_tilt = _trunk_tilt_deg(frames[rel_idx])

    # ── Release consistency: stddev of wrist position across release windows (cm).
    #    Single-pitch clips → use stddev of wrist over a small window as a proxy.
    key_wrist = "right_wrist" if side == "RH" else "left_wrist"
    window = frames[max(0, rel_idx - 2) : rel_idx + 3]
    wrist_pts = np.array([f.world_xyz[LM[key_wrist]] for f in window])
    if len(wrist_pts) >= 2:
        spread_m = float(np.linalg.norm(wrist_pts.std(axis=0)))
    else:
        spread_m = 0.0
    release_consistency_cm = spread_m * 100.0

    # ── X-Factor: peak hip–shoulder separation across the throw
    xf_series = [_x_factor_deg(f) for f in frames]
    x_factor = float(max(xf_series)) if xf_series else 0.0

    # ── Pelvis velocity: derivative of pelvis yaw
    pelvis_yaw = np.array([_pelvis_yaw_deg(f) for f in frames], dtype=np.float64)
    # unwrap to avoid 180° jumps
    pelvis_yaw = np.unwrap(np.deg2rad(pelvis_yaw))
    pelvis_yaw = np.rad2deg(pelvis_yaw)
    pelvis_dot = np.diff(_smooth(pelvis_yaw, 3)) * fps
    pelvis_velocity = float(np.max(np.abs(pelvis_dot))) if len(pelvis_dot) else 0.0

    # ── Stride length: % of body height
    plant = frames[rel_idx]  # near plant is close enough to release for an MVP
    foot_dist = float(
        np.linalg.norm(plant.world_xyz[LM["right_foot"]] - plant.world_xyz[LM["left_foot"]])
    )
    bh = _body_height(plant) or 1.0
    stride_pct = foot_dist / bh * 100.0

    metrics = {
        "handedness": side,
        "release_frame": rel_idx,
        "MER":           _wrap(mer,           165, 185, "°",   "최대 외전각"),
        "ELBOW_H":       _wrap(elbow_h,       0,   5,   "°",   "릴리스 시 견봉 대비"),
        "ER_VEL":        _wrap(er_velocity,   6500, 8000, "°/s", "어깨 외회전 각속도"),
        "TRUNK_TILT":    _wrap(trunk_tilt,    20,  35,  "°",   "릴리스 시 측방 기울기"),
        "CONSISTENCY":   _wrap(release_consistency_cm, 0, 3, "cm", "릴리스 일관성"),
        "X_FACTOR":      _wrap(x_factor,      40,  55,  "°",   "골반–어깨 분리각"),
        "PELVIS_VEL":    _wrap(pelvis_velocity, 500, 700, "°/s", "골반 회전 각속도"),
        "STRIDE_LEN":    _wrap(stride_pct,    80,  95,  "% BH", "스트라이드 길이"),
    }

    metrics["kinetic_score"] = _kinetic_score(metrics)
    metrics["chain_efficiency"] = _chain_efficiency(metrics)
    return metrics


def _wrap(value: float, lo: float, hi: float, unit: str, ko: str) -> dict:
    return {
        "value": round(float(value), 2),
        "unit": unit,
        "norm_min": lo,
        "norm_max": hi,
        "ok": _band(value, lo, hi),
        "ko": ko,
    }


def _kinetic_score(m: dict) -> int:
    """KineticScore (0–100) — z-score of each metric, mapped to 0–100, then weighted sum."""
    weights = {
        "MER": 0.18, "ELBOW_H": 0.10, "ER_VEL": 0.20, "TRUNK_TILT": 0.10,
        "CONSISTENCY": 0.10, "X_FACTOR": 0.14, "PELVIS_VEL": 0.10, "STRIDE_LEN": 0.08,
    }
    total = 0.0
    for k, w in weights.items():
        m_i = m[k]
        mid = (m_i["norm_min"] + m_i["norm_max"]) / 2
        span = max(1e-3, (m_i["norm_max"] - m_i["norm_min"]) / 2)
        z = abs(m_i["value"] - mid) / span
        score = max(0.0, min(100.0, 100.0 * (1 - 0.35 * z)))
        total += w * score
    return int(round(total))


def _chain_efficiency(m: dict) -> list[dict]:
    """Synthesize a 6-segment chain. Each segment's efficiency is driven by adjacent metrics."""
    def seg(name: str, value: float, baseline: float) -> dict:
        pct = int(round(max(40, min(99, 100 - (baseline - value) * 0.6 if value < baseline else 95 + (value - baseline) * 0.05))))
        state = "ok" if pct >= 90 else "warn" if pct >= 80 else "bad"
        return {"id": name, "pct": pct, "state": state}

    return [
        seg("STRIDE",   m["STRIDE_LEN"]["value"], (m["STRIDE_LEN"]["norm_min"] + m["STRIDE_LEN"]["norm_max"]) / 2),
        seg("PELVIS",   m["PELVIS_VEL"]["value"], (m["PELVIS_VEL"]["norm_min"] + m["PELVIS_VEL"]["norm_max"]) / 2),
        seg("TRUNK",    m["TRUNK_TILT"]["value"], (m["TRUNK_TILT"]["norm_min"] + m["TRUNK_TILT"]["norm_max"]) / 2),
        seg("SHOULDER", m["ER_VEL"]["value"],     (m["ER_VEL"]["norm_min"]    + m["ER_VEL"]["norm_max"]) / 2),
        seg("ELBOW",    m["ELBOW_H"]["value"],    (m["ELBOW_H"]["norm_min"]   + m["ELBOW_H"]["norm_max"]) / 2),
        seg("RELEASE",  100 - m["CONSISTENCY"]["value"] * 5, 90),
    ]
