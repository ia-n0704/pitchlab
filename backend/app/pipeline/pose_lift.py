"""
2D→3D lifting with MotionBERT (DSTformer).

Replaces MediaPipe GHUM `world_xyz` — whose single-camera depth is physically
inconsistent (upper-arm length CV ~32% on our pitching clips) — with a temporal
lifting model that learns anatomical + temporal constraints. Input is the ViTPose
COCO-17 track we already compute; output is a per-frame 3D pose.

MotionBERT output is root-relative and in a *normalized* (unitless) scale, not
meters, and uses the H36M axis convention. `lift_sequence` converts it back into
the GHUM-compatible frame the rest of the pipeline expects:
  - axes remapped to GHUM (x right, y down, z toward camera),
  - hip-centered,
  - scaled to meters via a fixed anatomical anchor (shoulder width ≈ 0.36 m),
so metrics.py and the 3D viewer consume it unchanged.

Model code is vendored (motionbert/DSTformer.py + drop.py); weights auto-download
from HF `walterzhu/MotionBERT` on first use and are cached.
"""
from __future__ import annotations

from functools import partial

import numpy as np

from app.config import settings

# COCO-17 index → BlazePose-33 landmark (same table pose_vitpose fills into image_xy).
from .pose_vitpose import COCO_TO_BLAZE

# H36M-17 joint order MotionBERT emits.
H36M = [
    "hip", "r_hip", "r_knee", "r_ankle", "l_hip", "l_knee", "l_ankle",
    "spine", "thorax", "nose", "head", "l_shoulder", "l_elbow", "l_wrist",
    "r_shoulder", "r_elbow", "r_wrist",
]
# H36M index → BlazePose-33 landmark, so we can write lifted 3D back into world_xyz[33,3].
H36M_TO_BLAZE = {
    0: 23,  # hip → use left_hip slot as an anchor; midpoint written separately below
    1: 24, 2: 26, 3: 28,          # r hip/knee/ankle
    4: 23, 5: 25, 6: 27,          # l hip/knee/ankle
    9: 0,                          # nose
    11: 11, 12: 13, 13: 15,        # l shoulder/elbow/wrist
    14: 12, 15: 14, 16: 16,        # r shoulder/elbow/wrist
}

MAXLEN = 243
_model = None


def coco2h36m(x: np.ndarray) -> np.ndarray:
    """COCO-17 (T,17,3 = x,y,conf) → H36M-17 (T,17,3), MotionBERT convention."""
    y = np.zeros_like(x)
    y[:, 0] = (x[:, 11] + x[:, 12]) * 0.5   # hip
    y[:, 1] = x[:, 12]                        # r hip
    y[:, 2] = x[:, 14]                        # r knee
    y[:, 3] = x[:, 16]                        # r ankle
    y[:, 4] = x[:, 11]                        # l hip
    y[:, 5] = x[:, 13]                        # l knee
    y[:, 6] = x[:, 15]                        # l ankle
    y[:, 8] = (x[:, 5] + x[:, 6]) * 0.5      # thorax
    y[:, 7] = (y[:, 0] + y[:, 8]) * 0.5      # spine
    y[:, 9] = x[:, 0]                         # nose
    y[:, 10] = (x[:, 1] + x[:, 2]) * 0.5     # head ≈ eyes mid
    y[:, 11] = x[:, 5]                        # l shoulder
    y[:, 12] = x[:, 7]                        # l elbow
    y[:, 13] = x[:, 9]                        # l wrist
    y[:, 14] = x[:, 6]                        # r shoulder
    y[:, 15] = x[:, 8]                        # r elbow
    y[:, 16] = x[:, 10]                       # r wrist
    return y


def _crop_scale(motion: np.ndarray) -> np.ndarray:
    """Normalize a (T,17,3) clip into [-1,1] by its own bbox (MotionBERT utils_data)."""
    result = motion.copy()
    valid = motion[motion[..., 2] != 0][:, :2]
    if len(valid) < 4:
        return np.zeros_like(motion)
    xmin, xmax = valid[:, 0].min(), valid[:, 0].max()
    ymin, ymax = valid[:, 1].min(), valid[:, 1].max()
    scale = max(xmax - xmin, ymax - ymin)
    if scale == 0:
        return np.zeros_like(motion)
    xs = (xmin + xmax - scale) / 2
    ys = (ymin + ymax - scale) / 2
    result[..., :2] = (motion[..., :2] - [xs, ys]) / scale
    result[..., :2] = (result[..., :2] - 0.5) * 2
    result[..., 2] = motion[..., 2]
    return np.clip(result, -1, 1)


def _flip(data: np.ndarray) -> np.ndarray:
    left = [4, 5, 6, 11, 12, 13]
    right = [1, 2, 3, 14, 15, 16]
    f = data.copy()
    f[..., 0] *= -1
    f[..., left + right, :] = f[..., right + left, :]
    return f


def _load_model():
    global _model
    if _model is not None:
        return _model
    import torch
    import torch.nn as nn
    from huggingface_hub import hf_hub_download

    from .motionbert.DSTformer import DSTformer

    ckpt_path = hf_hub_download(settings.motionbert_repo, settings.motionbert_ckpt)
    model = DSTformer(
        dim_in=3, dim_out=3, dim_feat=256, dim_rep=512, depth=5,
        num_heads=8, mlp_ratio=4, num_joints=17, maxlen=MAXLEN,
        norm_layer=partial(nn.LayerNorm, eps=1e-6), att_fuse=True,
    )
    state = torch.load(ckpt_path, map_location="cpu")["model_pos"]
    state = {(k[7:] if k.startswith("module.") else k): v for k, v in state.items()}
    model.load_state_dict(state, strict=True)
    model.eval()
    _model = (torch, model)
    return _model


def _infer(coco_track: np.ndarray) -> np.ndarray:
    """Run MotionBERT on a COCO-17 (T,17,3) track → H36M (T,17,3) normalized 3D."""
    torch, model = _load_model()
    h36m = coco2h36m(coco_track)
    out_chunks = []
    for s in range(0, len(h36m), MAXLEN):
        clip = _crop_scale(h36m[s : s + MAXLEN])
        x = torch.from_numpy(clip.astype(np.float32))[None]
        with torch.no_grad():
            p = (model(x) + _flip_t(torch, model, x)) / 2.0
        p = p[0].numpy()
        p = p - p[:, 0:1, :]  # root-relative
        out_chunks.append(p)
    return np.concatenate(out_chunks, axis=0)


def _flip_t(torch, model, x):
    xf = torch.from_numpy(_flip(x.numpy()))
    return torch.from_numpy(_flip(model(xf).numpy()))


def lift_sequence(coco_track: np.ndarray, shoulder_width_m: float = 0.36) -> np.ndarray:
    """ViTPose COCO-17 (T,17,3) → world_xyz array (T,33,3) in the GHUM frame.

    Only the joints present in H36M are filled; others stay 0 (metrics.py reads
    only the mapped joints). Axis + scale aligned to GHUM (meters, hip-centered).
    """
    pose3d = _infer(coco_track)  # (T,17,3), H36M, normalized, root-relative
    T = len(pose3d)

    # H36M axes → GHUM: MotionBERT emits x-right, y-up, z-forward(out of screen).
    # GHUM is x-right, y-DOWN, z-toward-camera. Flip Y; keep X; flip Z to match sign.
    p = pose3d.copy()
    p[..., 1] *= -1.0   # y-up → y-down
    p[..., 2] *= -1.0   # z-forward → z-toward-camera

    # Scale to meters using a stable anatomical anchor (shoulder width).
    sw = np.linalg.norm(p[:, 11, :] - p[:, 14, :], axis=1)  # l_sh ↔ r_sh
    med = float(np.median(sw[sw > 1e-6])) if np.any(sw > 1e-6) else 1.0
    p *= shoulder_width_m / max(med, 1e-6)

    # hip-center each frame
    p = p - p[:, 0:1, :]

    world = np.zeros((T, 33, 3), dtype=np.float32)
    for hi, bi in H36M_TO_BLAZE.items():
        world[:, bi, :] = p[:, hi, :]
    # hip landmarks explicitly (left=4, right=1)
    world[:, 23, :] = p[:, 4, :]
    world[:, 24, :] = p[:, 1, :]
    # feet: BlazePose foot indices (31/32) ≈ ankles for a connected skeleton
    world[:, 31, :] = p[:, 6, :]
    world[:, 32, :] = p[:, 3, :]
    return world
