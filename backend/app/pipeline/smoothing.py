"""
Temporal refinement for 2D keypoint tracks.

Per the SmoothNet finding (ECCV 2022 — temporal-only refinement removes jitter
*without* hurting accuracy, validated on fast-motion AIST++), we post-process the
per-frame estimator output along the time axis:

  1. Gap fill — joints whose confidence dips below a threshold are treated as
     missing and linearly interpolated from their confident neighbours.
  2. Savitzky–Golay filter — a short polynomial-fit window per joint coordinate.
     Unlike a moving average it preserves velocity peaks (release frame!), which
     matters because metrics.py detects release via wrist-speed argmax.

This is a dependency-light stand-in for SmoothNet itself; the interface takes a
plain (F, J, C) array so a learned refiner can drop in later.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import savgol_filter

# BlazePose-33 left/right joint pairs (the ones we render + their anchors).
# Order: shoulder, elbow, wrist, hip, knee, ankle, foot-index, heel, eye, ear.
_LR_LEFT = [11, 13, 15, 23, 25, 27, 31, 29, 2, 7]
_LR_RIGHT = [12, 14, 16, 24, 26, 28, 32, 30, 5, 8]
# Slow, high-confidence torso joints used to *decide* whether a frame is flipped.
_TORSO_L = [11, 23]
_TORSO_R = [12, 24]


def fix_lr_consistency(pts: np.ndarray, conf: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Undo per-frame left/right label swaps by enforcing temporal consistency.

    Top-down estimators frequently flip the anatomical L/R labels on a side-view
    subject (here: shoulder x-order flips 25× across a single pitch), which makes
    the throwing arm jump to the other side. We walk the clip forward and, at each
    frame, test whether the torso anchors (shoulders + hips) sit closer to the
    previous frame *as-is* or *swapped*; if swapped is closer, we swap every L/R
    pair for that frame. Torso joints drive the decision because they move slowly
    and stay confident even when the throwing arm is a fast blur.

    pts: (F, 33, 2), conf: (F, 33). Returns corrected copies.
    """
    F = pts.shape[0]
    if F < 2:
        return pts, conf
    pts = pts.copy()
    conf = conf.copy()

    for i in range(1, F):
        prev_l = pts[i - 1, _TORSO_L]
        prev_r = pts[i - 1, _TORSO_R]
        cur_l = pts[i, _TORSO_L]
        cur_r = pts[i, _TORSO_R]
        # weight each anchor by its confidence (both frames) so a garbage joint
        # doesn't drive the decision.
        w = np.minimum(conf[i, _TORSO_L], conf[i - 1, _TORSO_L]) * np.minimum(
            conf[i, _TORSO_R], conf[i - 1, _TORSO_R]
        )
        if w.sum() < 1e-3:
            continue
        keep = (w * (np.linalg.norm(cur_l - prev_l, axis=1) + np.linalg.norm(cur_r - prev_r, axis=1))).sum()
        swap = (w * (np.linalg.norm(cur_l - prev_r, axis=1) + np.linalg.norm(cur_r - prev_l, axis=1))).sum()
        if swap < keep:
            pts[i, _LR_LEFT], pts[i, _LR_RIGHT] = pts[i, _LR_RIGHT].copy(), pts[i, _LR_LEFT].copy()
            conf[i, _LR_LEFT], conf[i, _LR_RIGHT] = conf[i, _LR_RIGHT].copy(), conf[i, _LR_LEFT].copy()
    return pts, conf


def reject_inconsistent(
    pts: np.ndarray,
    conf: np.ndarray,
    valid: np.ndarray,
    base_px: float = 30.0,
    keep_conf: float = 0.85,
    passes: int = 2,
) -> np.ndarray:
    """Drop detections that zigzag against their temporal neighbours.

    Motion-blurred frames make the estimator oscillate between two distant
    candidates (e.g. the true hand vs the glove hand) on adjacent frames — a
    zigzag that per-frame confidence does not expose (both sides score 0.5-0.8),
    and that plain smoothing averages into a position that matches *neither*.

    For each valid interior frame we compare the point against the midpoint of
    its nearest valid neighbours. A genuine fast-but-smooth motion deviates from
    that midpoint by at most its local curvature, while a zigzag deviates by
    roughly the full step size — so the threshold scales with the local half-span
    (`|next - prev| / 2`), keeping true whip frames while dropping side-flips.
    High-confidence detections (≥ keep_conf) are always kept.

    Returns the pruned validity mask.
    """
    F, J, _ = pts.shape
    valid = valid.copy()
    for _ in range(passes):
        changed = False
        for j in range(J):
            idxs = np.flatnonzero(valid[:, j])
            if len(idxs) < 3:
                continue
            for k in range(1, len(idxs) - 1):
                i_prev, i, i_next = idxs[k - 1], idxs[k], idxs[k + 1]
                if conf[i, j] >= keep_conf:
                    continue
                pred = (pts[i_prev, j] + pts[i_next, j]) / 2.0
                halfspan = float(np.linalg.norm(pts[i_next, j] - pts[i_prev, j])) / 2.0
                err = float(np.linalg.norm(pts[i, j] - pred))
                if err > max(0.9 * halfspan, base_px):
                    valid[i, j] = False
                    changed = True
        if not changed:
            break
    return valid


def fill_gaps(pts: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Re-fill invalid frames with a shape-preserving (PCHIP) curve per joint.

    PCHIP follows the curvature of the surrounding track — unlike linear
    interpolation it does not cut the corner of a whipping wrist arc — and,
    unlike a cubic spline, it cannot overshoot. Outside the first/last valid
    frame the nearest valid value is held.
    """
    from scipy.interpolate import PchipInterpolator

    pts = pts.copy()
    F, J, C = pts.shape
    t = np.arange(F)
    for j in range(J):
        good = np.flatnonzero(valid[:, j])
        if len(good) < 2 or len(good) == F:
            continue
        bad = np.flatnonzero(~valid[:, j])
        if len(good) >= 4:
            interp = PchipInterpolator(good, pts[good, j, :], axis=0, extrapolate=False)
            vals = interp(np.clip(bad, good[0], good[-1]))
        else:
            vals = np.stack(
                [np.interp(np.clip(bad, good[0], good[-1]), good, pts[good, j, c]) for c in range(C)],
                axis=1,
            )
        pts[bad, j, :] = vals
    return pts


def smooth_tracks(pts: np.ndarray, window: int = 9, polyorder: int = 2) -> np.ndarray:
    """Savitzky–Golay smoothing along the frame axis of an (F, J, C) track."""
    F = pts.shape[0]
    if F < 5:
        return pts
    win = min(window, F if F % 2 == 1 else F - 1)
    if win <= polyorder:
        return pts
    return savgol_filter(pts, window_length=win, polyorder=polyorder, axis=0)


def refine_2d_tracks(
    pts: np.ndarray,
    conf: np.ndarray,
    min_conf: float = 0.3,
    window: int = 9,
    outlier_base: float | None = None,
    velocity_adaptive: bool = False,
) -> np.ndarray:
    """Full refinement: outlier rejection → PCHIP gap-fill → temporal smoothing.

    outlier_base: enable zigzag rejection with this pixel threshold (None = off,
    e.g. for metric-space world tracks where the scale differs).
    velocity_adaptive: blend back toward the unsmoothed track on fast frames so
    the release whip keeps its peak (jitter removal stays full-strength on slow
    frames). One-Euro principle, normalized per joint so it is scale-free.
    """
    valid = conf >= min_conf
    if outlier_base is not None:
        valid = reject_inconsistent(pts, conf, valid, base_px=outlier_base)
    filled = fill_gaps(pts, valid)
    smooth = smooth_tracks(filled, window=window)
    if not velocity_adaptive:
        return smooth

    F = pts.shape[0]
    if F < 3:
        return smooth
    vel = np.linalg.norm(np.diff(filled, axis=0), axis=2)  # (F-1, J)
    vel = np.concatenate([vel[:1], vel], axis=0)           # (F, J)
    ref = np.percentile(vel, 90, axis=0, keepdims=True) + 1e-6
    alpha = np.clip((vel / ref - 0.5) / 0.7, 0.0, 1.0) * 0.85  # cap: always keep some smoothing
    return alpha[..., None] * filled + (1.0 - alpha[..., None]) * smooth
