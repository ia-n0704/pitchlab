/**
 * In-browser port of the backend biomechanics pipeline
 * (backend/app/pipeline/metrics.py + llm/drills.py + coach.py fallback).
 *
 * Pure math — no DOM, no model — so it can be unit-tested and reused. Given a
 * sequence of per-frame poses (2D image coords + 3D world coords + visibility,
 * exactly what BlazePose provides), it produces the same metric panel,
 * KineticScore, chain efficiency, drills, skeleton overlay, and a templated
 * Korean comment that the server pipeline produces.
 */

export type AnalysisFrame = {
  xy: number[][]; // (33,2) image pixels
  xyz: number[][]; // (33,3) meters, hip-centered (BlazePose world)
  vis: number[]; // (33,)
};

// BlazePose 33-landmark indices (same ordering as MediaPipe / tfjs pose-detection)
export const LM = {
  nose: 0,
  left_shoulder: 11, right_shoulder: 12,
  left_elbow: 13, right_elbow: 14,
  left_wrist: 15, right_wrist: 16,
  left_hip: 23, right_hip: 24,
  left_knee: 25, right_knee: 26,
  left_ankle: 27, right_ankle: 28,
  left_foot: 31, right_foot: 32,
} as const;

type V = number[];
const sub = (a: V, b: V): V => a.map((x, i) => x - b[i]);
const add = (a: V, b: V): V => a.map((x, i) => x + b[i]);
const scale = (a: V, s: number): V => a.map((x) => x * s);
const dot = (a: V, b: V): number => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: V): number => Math.sqrt(dot(a, a));
const deg = (r: number) => (r * 180) / Math.PI;

function angleBetween(v1: V, v2: V): number {
  const n1 = norm(v1);
  const n2 = norm(v2);
  if (n1 < 1e-6 || n2 < 1e-6) return 0;
  const c = Math.min(1, Math.max(-1, dot(v1, v2) / (n1 * n2)));
  return deg(Math.acos(c));
}

/** Centered moving average (≈ numpy convolve mode="same"). */
function smooth(x: number[], k = 5): number[] {
  if (x.length < k) return x.slice();
  const half = Math.floor(k / 2);
  const out: number[] = [];
  for (let i = 0; i < x.length; i++) {
    let s = 0;
    let c = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < x.length) {
        s += x[j];
        c++;
      }
    }
    out.push(s / c);
  }
  return out;
}

function unwrapDeg(angles: number[]): number[] {
  const out = angles.slice();
  for (let i = 1; i < out.length; i++) {
    let d = out[i] - out[i - 1];
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    out[i] = out[i - 1] + d;
  }
  return out;
}

function detectHandedness(frames: AnalysisFrame[]): "RH" | "LH" {
  const range = (idx: number) => {
    const mins = [Infinity, Infinity, Infinity];
    const maxs = [-Infinity, -Infinity, -Infinity];
    for (const f of frames) {
      const p = f.xyz[idx];
      for (let k = 0; k < 3; k++) {
        mins[k] = Math.min(mins[k], p[k]);
        maxs[k] = Math.max(maxs[k], p[k]);
      }
    }
    return norm(sub(maxs, mins));
  };
  return range(LM.right_wrist) >= range(LM.left_wrist) ? "RH" : "LH";
}

function detectReleaseFrame(frames: AnalysisFrame[], side: "RH" | "LH"): number {
  const key = side === "RH" ? LM.right_wrist : LM.left_wrist;
  if (frames.length < 3) return frames.length - 1;
  const vel: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    vel.push(norm(sub(frames[i].xyz[key], frames[i - 1].xyz[key])));
  }
  const sm = smooth(vel, 5);
  let best = 0;
  for (let i = 1; i < sm.length; i++) if (sm[i] > sm[best]) best = i;
  return best + 1;
}

function shoulderER(f: AnalysisFrame, side: "RH" | "LH"): number {
  const sh = side === "RH" ? LM.right_shoulder : LM.left_shoulder;
  const el = side === "RH" ? LM.right_elbow : LM.left_elbow;
  const hp = side === "RH" ? LM.right_hip : LM.left_hip;
  const upperArm = sub(f.xyz[el], f.xyz[sh]);
  const trunkDown = sub(f.xyz[hp], f.xyz[sh]);
  return angleBetween(upperArm, trunkDown);
}

function elbowHeightDev(f: AnalysisFrame, side: "RH" | "LH"): number {
  const sh = side === "RH" ? LM.right_shoulder : LM.left_shoulder;
  const el = side === "RH" ? LM.right_elbow : LM.left_elbow;
  const dx = f.xyz[el][0] - f.xyz[sh][0];
  const dy = f.xyz[sh][1] - f.xyz[el][1]; // up positive
  if (Math.abs(dx) < 1e-6) return 90 * (dy >= 0 ? 1 : -1);
  return deg(Math.atan2(dy, Math.abs(dx)));
}

function trunkTilt(f: AnalysisFrame): number {
  const midSh = scale(add(f.xyz[LM.right_shoulder], f.xyz[LM.left_shoulder]), 0.5);
  const midHp = scale(add(f.xyz[LM.right_hip], f.xyz[LM.left_hip]), 0.5);
  const trunk = sub(midSh, midHp);
  return Math.abs(deg(Math.atan2(trunk[0], -trunk[1])));
}

function xFactor(f: AnalysisFrame): number {
  const sh = sub(f.xyz[LM.right_shoulder], f.xyz[LM.left_shoulder]);
  const hp = sub(f.xyz[LM.right_hip], f.xyz[LM.left_hip]);
  return angleBetween([sh[0], sh[2]], [hp[0], hp[2]]);
}

function pelvisYaw(f: AnalysisFrame): number {
  const hp = sub(f.xyz[LM.right_hip], f.xyz[LM.left_hip]);
  return deg(Math.atan2(hp[2], hp[0]));
}

function bodyHeight(f: AnalysisFrame): number {
  const head = f.xyz[LM.nose][1];
  const foot = (f.xyz[LM.right_ankle][1] + f.xyz[LM.left_ankle][1]) / 2;
  return Math.abs(foot - head);
}

const band = (v: number, lo: number, hi: number) => lo <= v && v <= hi;

export type MetricCell = {
  value: number;
  unit: string;
  norm_min: number;
  norm_max: number;
  ok: boolean;
  ko: string;
};

function wrap(value: number, lo: number, hi: number, unit: string, ko: string): MetricCell {
  return {
    value: Math.round(value * 100) / 100,
    unit,
    norm_min: lo,
    norm_max: hi,
    ok: band(value, lo, hi),
    ko,
  };
}

function kineticScore(m: Record<string, MetricCell>): number {
  const weights: Record<string, number> = {
    MER: 0.18, ELBOW_H: 0.1, ER_VEL: 0.2, TRUNK_TILT: 0.1,
    CONSISTENCY: 0.1, X_FACTOR: 0.14, PELVIS_VEL: 0.1, STRIDE_LEN: 0.08,
  };
  let total = 0;
  for (const [k, w] of Object.entries(weights)) {
    const mi = m[k];
    const mid = (mi.norm_min + mi.norm_max) / 2;
    const span = Math.max(1e-3, (mi.norm_max - mi.norm_min) / 2);
    const z = Math.abs(mi.value - mid) / span;
    const score = Math.max(0, Math.min(100, 100 * (1 - 0.35 * z)));
    total += w * score;
  }
  return Math.round(total);
}

export type ChainSeg = { id: string; pct: number; state: "ok" | "warn" | "bad" };

function chainEfficiency(m: Record<string, MetricCell>): ChainSeg[] {
  const seg = (id: string, value: number, baseline: number): ChainSeg => {
    const raw = value < baseline ? 100 - (baseline - value) * 0.6 : 95 + (value - baseline) * 0.05;
    const pct = Math.round(Math.max(40, Math.min(99, raw)));
    const state: ChainSeg["state"] = pct >= 90 ? "ok" : pct >= 80 ? "warn" : "bad";
    return { id, pct, state };
  };
  const mid = (k: string) => (m[k].norm_min + m[k].norm_max) / 2;
  return [
    seg("STRIDE", m.STRIDE_LEN.value, mid("STRIDE_LEN")),
    seg("PELVIS", m.PELVIS_VEL.value, mid("PELVIS_VEL")),
    seg("TRUNK", m.TRUNK_TILT.value, mid("TRUNK_TILT")),
    seg("SHOULDER", m.ER_VEL.value, mid("ER_VEL")),
    seg("ELBOW", m.ELBOW_H.value, mid("ELBOW_H")),
    seg("RELEASE", 100 - m.CONSISTENCY.value * 5, 90),
  ];
}

// ── Drills (port of llm/drills.py) ───────────────────────────────────────────
type DrillTemplate = { group: string; title: string; desc: string; reps: string };
const DRILL_CATALOG: Record<string, DrillTemplate> = {
  X_FACTOR: { group: "골반", title: "Hip-Shoulder Separation Hold", desc: "발 접지 후 골반만 먼저 회전 · 상체는 닫은 채로 유지 (X-Factor 회복)", reps: "3 SET × 8 · 2초 홀드" },
  ELBOW_H: { group: "팔꿈치", title: "Towel · Elbow Lift", desc: "팔꿈치를 견봉선 위로 들어 올리는 감각 회복", reps: "3 SET × 10" },
  CONSISTENCY: { group: "손목", title: "Wall Drill · 4-Seam Path", desc: "릴리스 시 일관된 손목 채찍 각도 반복 학습", reps: "3 SET × 12" },
  MER: { group: "어깨", title: "Sleeper Stretch · ER Mobility", desc: "어깨 외회전 가동범위 확보로 코킹 구간 안정화", reps: "3 SET × 30초" },
  ER_VEL: { group: "가속", title: "Med-Ball Rotational Throw", desc: "코킹→가속 전환 속도 향상 (어깨 외회전 각속도 출력)", reps: "3 SET × 6 · 최대 강도" },
  TRUNK_TILT: { group: "체간", title: "Trunk Stack Drill", desc: "릴리스 시 측방 기울기 정렬 · 체간 안정성 회복", reps: "3 SET × 10" },
  PELVIS_VEL: { group: "골반회전", title: "Step-Through Hip Fire", desc: "골반 회전 각속도 증대 · 하체 주도 전달 강화", reps: "3 SET × 8" },
  STRIDE_LEN: { group: "스트라이드", title: "Stride Length Walkout", desc: "안정적인 스트라이드 길이 확보 · 접지 일관성", reps: "3 SET × 6" },
};
const MAINTENANCE: DrillTemplate[] = [
  { group: "유지", title: "Long-Toss Progression", desc: "현재 폼을 유지하며 거리 점증 · 운동연쇄 일관성 점검", reps: "3 SET × 10" },
  { group: "유지", title: "Plyo-Ball Routine", desc: "전반 출력 유지 · 회복 루틴", reps: "2 SET × 8" },
];

export type Drill = { id: string; title: string; desc: string; reps: string; priority: string; top: boolean };

function selectDrills(m: Record<string, MetricCell>, limit = 3): Drill[] {
  const deviation = (c: MetricCell) => {
    const mid = (c.norm_min + c.norm_max) / 2;
    const span = Math.max(1e-3, (c.norm_max - c.norm_min) / 2);
    return Math.abs(c.value - mid) / span;
  };
  const scored: Array<{ dev: number; key: string; tmpl: DrillTemplate }> = [];
  for (const [key, tmpl] of Object.entries(DRILL_CATALOG)) {
    const cell = m[key];
    if (cell && cell.ok === false) scored.push({ dev: deviation(cell), key, tmpl });
  }
  scored.sort((a, b) => b.dev - a.dev || a.key.localeCompare(b.key));
  const chosen = scored.length ? scored.slice(0, limit).map((s) => s.tmpl) : MAINTENANCE.slice(0, 2);
  return chosen.map((t, i) => {
    const top = i === 0 && scored.length > 0;
    return {
      id: `${String(i + 1).padStart(2, "0")} · ${t.group}`,
      title: t.title,
      desc: t.desc,
      reps: t.reps,
      priority: top ? "HIGH PRIORITY" : i === 0 ? "HIGH" : "MEDIUM",
      top,
    };
  });
}

// ── Skeleton overlay (port of _build_skeleton) ───────────────────────────────
const SKELETON_LM = [
  LM.nose, LM.left_shoulder, LM.right_shoulder, LM.left_elbow, LM.right_elbow,
  LM.left_wrist, LM.right_wrist, LM.left_hip, LM.right_hip, LM.left_knee,
  LM.right_knee, LM.left_ankle, LM.right_ankle, LM.left_foot, LM.right_foot,
];

export type Phase = { id: string; start: number; end: number };
export type Skeleton = { fps: number; release_frame: number; frames: number[][][]; phases?: Phase[] };

function buildSkeleton(
  frames: AnalysisFrame[],
  fps: number,
  relIdx: number,
  phasesFull: Phase[],
  maxFrames = 90,
): Skeleton {
  const n = frames.length;
  const step = Math.max(1, Math.ceil(n / maxFrames));
  const idxs: number[] = [];
  for (let i = 0; i < n; i += step) idxs.push(i);
  const sub2 = idxs.map((i) => frames[i]);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of sub2) {
    for (const lm of SKELETON_LM) {
      const [x, y] = f.xy[lm];
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  const spanX = Math.max(maxX - minX, 1e-3);
  const spanY = Math.max(maxY - minY, 1e-3);
  const sc = Math.max(spanX, spanY);
  const offX = (sc - spanX) / 2 / sc;
  const offY = (sc - spanY) / 2 / sc;

  const out = sub2.map((f) =>
    SKELETON_LM.map((lm) => {
      const x = (f.xy[lm][0] - minX) / sc + offX;
      const y = (f.xy[lm][1] - minY) / sc + offY;
      return [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4, Math.round(f.vis[lm] * 100) / 100];
    }),
  );
  const dsRel = Math.min(out.length - 1, Math.max(0, Math.round(relIdx / step)));
  const clampDs = (i: number) => Math.min(out.length - 1, Math.max(0, Math.round(i / step)));
  const phases = phasesFull
    .map((p) => ({ id: p.id, start: clampDs(p.start), end: clampDs(p.end) }))
    .filter((p) => p.end >= p.start);
  return { fps: Math.round((fps / step) * 100) / 100, release_frame: dsRel, frames: out, phases };
}

// ── Velocity-based phase segmentation (swing-detection idea, applied to a pitch)
// Splits WIND-UP → COCKING → ACCEL → RELEASE → FOLLOW from the throwing-wrist
// speed profile instead of fixed time fractions. Indices are in `frames` space.
function segmentPhases(frames: AnalysisFrame[], fps: number, relIdx: number, side: "RH" | "LH"): Phase[] {
  const key = side === "RH" ? LM.right_wrist : LM.left_wrist;
  const n = frames.length;
  const speed = new Array(n).fill(0);
  for (let i = 1; i < n; i++) speed[i] = norm(sub(frames[i].xyz[key], frames[i - 1].xyz[key])) * fps;
  const sm = smooth(speed, 3);

  const peak = relIdx;
  const peakV = Math.max(sm[peak] || 0, ...sm);
  const thr = 0.3 * peakV;

  // accel starts at the foot of the speed spike before the peak
  let accelStart = peak;
  while (accelStart > 1 && sm[accelStart - 1] > thr) accelStart--;
  const cockLen = Math.max(1, Math.round(0.18 * fps));
  const cockingStart = Math.max(0, accelStart - cockLen);
  const relEnd = Math.min(n - 1, peak + 1);

  return [
    { id: "WIND-UP", start: 0, end: cockingStart },
    { id: "COCKING", start: cockingStart, end: accelStart },
    { id: "ACCEL", start: accelStart, end: peak },
    { id: "RELEASE", start: peak, end: relEnd },
    { id: "FOLLOW", start: relEnd, end: n - 1 },
  ].filter((p) => p.end >= p.start);
}

// ── Templated comment (port of coach._fallback_comment) ──────────────────────
export function templatedComment(metrics: Record<string, unknown>): string {
  const score = (metrics.kinetic_score as number) ?? 0;
  const bad = Object.entries(metrics).filter(
    ([, v]) => v && typeof v === "object" && (v as MetricCell).ok === false,
  ) as Array<[string, MetricCell]>;
  if (!bad.length) {
    return `전반적으로 운동연쇄가 안정적입니다 (KineticScore ${score}). 현재 폼을 유지하면서 반복 측정으로 일관성을 확인해보세요.`;
  }
  const parts = [`전반 KineticScore는 ${score}점입니다.`];
  for (const [k, v] of bad.slice(0, 2)) {
    parts.push(`${v.ko || k}(${v.value}${v.unit})가 정상범위 ${v.norm_min}~${v.norm_max}${v.unit}을 벗어났습니다.`);
  }
  parts.push("운동연쇄 상류부터(STRIDE → PELVIS → TRUNK) 점검해보시는 걸 권장합니다.");
  return parts.join(" ");
}

export type ComputedMetrics = Record<string, unknown> & {
  handedness: "RH" | "LH";
  release_frame: number;
  kinetic_score: number;
  chain_efficiency: ChainSeg[];
  drills: Drill[];
  skeleton: Skeleton;
};

export function computeMetrics(frames: AnalysisFrame[], fps: number): ComputedMetrics {
  if (frames.length < 10) throw new Error("분석에 충분한 프레임을 확보하지 못했습니다 (≥ 10 필요).");

  const side = detectHandedness(frames);
  let relIdx = detectReleaseFrame(frames, side);
  relIdx = Math.max(2, Math.min(frames.length - 3, relIdx));

  const cockStart = Math.max(0, relIdx - Math.round(0.3 * fps));
  const cocking = frames.slice(cockStart, relIdx + 1);
  const mer = cocking.length ? Math.max(...cocking.map((f) => shoulderER(f, side))) : 0;

  const elbowH = elbowHeightDev(frames[relIdx], side);

  const erAngles = smooth(frames.map((f) => shoulderER(f, side)), 3);
  let erVel = 0;
  for (let i = 1; i < erAngles.length; i++) erVel = Math.max(erVel, Math.abs((erAngles[i] - erAngles[i - 1]) * fps));

  const tilt = trunkTilt(frames[relIdx]);

  const keyWrist = side === "RH" ? LM.right_wrist : LM.left_wrist;
  const win = frames.slice(Math.max(0, relIdx - 2), relIdx + 3);
  let consistencyCm = 0;
  if (win.length >= 2) {
    const means = [0, 0, 0];
    for (const f of win) for (let k = 0; k < 3; k++) means[k] += f.xyz[keyWrist][k] / win.length;
    const varv = [0, 0, 0];
    for (const f of win) for (let k = 0; k < 3; k++) varv[k] += (f.xyz[keyWrist][k] - means[k]) ** 2 / win.length;
    consistencyCm = Math.sqrt(varv[0] + varv[1] + varv[2]) * 100;
  }

  const xf = Math.max(...frames.map(xFactor));

  const yawDeg = unwrapDeg(frames.map(pelvisYaw));
  const yawSm = smooth(yawDeg, 3);
  let pelvisVel = 0;
  for (let i = 1; i < yawSm.length; i++) pelvisVel = Math.max(pelvisVel, Math.abs((yawSm[i] - yawSm[i - 1]) * fps));

  const plant = frames[relIdx];
  const footDist = norm(sub(plant.xyz[LM.right_foot], plant.xyz[LM.left_foot]));
  const bh = bodyHeight(plant) || 1;
  const stridePct = (footDist / bh) * 100;

  const cells: Record<string, MetricCell> = {
    MER: wrap(mer, 165, 185, "°", "최대 외전각"),
    ELBOW_H: wrap(elbowH, 0, 5, "°", "릴리스 시 견봉 대비"),
    ER_VEL: wrap(erVel, 6500, 8000, "°/s", "어깨 외회전 각속도"),
    TRUNK_TILT: wrap(tilt, 20, 35, "°", "릴리스 시 측방 기울기"),
    CONSISTENCY: wrap(consistencyCm, 0, 3, "cm", "릴리스 일관성"),
    X_FACTOR: wrap(xf, 40, 55, "°", "골반–어깨 분리각"),
    PELVIS_VEL: wrap(pelvisVel, 500, 700, "°/s", "골반 회전 각속도"),
    STRIDE_LEN: wrap(stridePct, 80, 95, "% BH", "스트라이드 길이"),
  };

  const phases = segmentPhases(frames, fps, relIdx, side);

  const metrics: ComputedMetrics = {
    handedness: side,
    release_frame: relIdx,
    ...cells,
    kinetic_score: kineticScore(cells),
    chain_efficiency: chainEfficiency(cells),
    drills: selectDrills(cells),
    skeleton: buildSkeleton(frames, fps, relIdx, phases),
  };
  return metrics;
}

/** Exposed for the two-stage capture (window detection needs the throwing side). */
export function detectThrowingSide(frames: AnalysisFrame[]): "RH" | "LH" {
  return detectHandedness(frames);
}
