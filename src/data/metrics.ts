/**
 * Mock dataset for the dashboard. In production this would come from the
 * analysis worker (FastAPI → Celery → pose pipeline → metric calculator).
 */

export type Metric = {
  n: string;
  k: string;
  ko: string;
  val: string;
  unit: string;
  norm: string;
  ok: boolean;
  series: number[];
  range: { min: number; max: number; targetStart: number; targetEnd: number; pos: number };
};

export const UPPER_METRICS: Metric[] = [
  {
    n: "01", k: "MER", ko: "최대 외전각",
    val: "172.4", unit: "°", norm: "NORM · 165–185°", ok: true,
    series: [0.4, 0.42, 0.45, 0.5, 0.55, 0.62, 0.72, 0.85, 0.95, 1, 0.95, 0.85, 0.7, 0.55, 0.4],
    range: { min: 140, max: 200, targetStart: 165, targetEnd: 185, pos: 172.4 },
  },
  {
    n: "02", k: "ELBOW H", ko: "릴리스 팔꿈치",
    val: "−4.1", unit: "°", norm: "NORM · 0~+5°", ok: false,
    series: [0.6, 0.55, 0.5, 0.45, 0.42, 0.4, 0.38, 0.36, 0.32, 0.28, 0.3, 0.34, 0.4, 0.45, 0.5],
    range: { min: -15, max: 15, targetStart: 0, targetEnd: 5, pos: -4.1 },
  },
  {
    n: "03", k: "ER VEL", ko: "외회전 각속도",
    val: "7,214", unit: "°/s", norm: "NORM · 6.5–8.0 k", ok: true,
    series: [0.2, 0.25, 0.3, 0.4, 0.55, 0.72, 0.88, 1, 0.95, 0.78, 0.55, 0.35, 0.2, 0.15, 0.1],
    range: { min: 4000, max: 10000, targetStart: 6500, targetEnd: 8000, pos: 7214 },
  },
  {
    n: "04", k: "TRUNK TILT", ko: "체간 기울기",
    val: "27.6", unit: "°", norm: "NORM · 20–35°", ok: true,
    series: [0.3, 0.35, 0.4, 0.45, 0.5, 0.58, 0.65, 0.72, 0.78, 0.74, 0.68, 0.6, 0.55, 0.5, 0.45],
    range: { min: 0, max: 50, targetStart: 20, targetEnd: 35, pos: 27.6 },
  },
  {
    n: "05", k: "CONSISTENCY", ko: "릴리스 일관성",
    val: "4.2", unit: "cm", norm: "NORM · ≤ 3.0 cm", ok: false,
    series: [0.4, 0.35, 0.5, 0.42, 0.55, 0.4, 0.6, 0.45, 0.52, 0.38, 0.5, 0.42, 0.55, 0.48, 0.52],
    range: { min: 0, max: 10, targetStart: 0, targetEnd: 3, pos: 4.2 },
  },
];

export const LOWER_METRICS: Metric[] = [
  {
    n: "06", k: "X-FACTOR", ko: "골반–어깨 분리각",
    val: "38.2", unit: "°", norm: "NORM · 40–55°", ok: false,
    series: [0.05, 0.08, 0.12, 0.2, 0.32, 0.5, 0.7, 0.78, 0.62, 0.42, 0.28, 0.2, 0.14, 0.1, 0.08],
    range: { min: 20, max: 70, targetStart: 40, targetEnd: 55, pos: 38.2 },
  },
  {
    n: "07", k: "PELVIS VEL", ko: "골반 회전 각속도",
    val: "612", unit: "°/s", norm: "NORM · 500–700 °/s", ok: true,
    series: [0.05, 0.12, 0.22, 0.4, 0.62, 0.88, 0.84, 0.62, 0.42, 0.26, 0.16, 0.1, 0.06, 0.04, 0.03],
    range: { min: 200, max: 900, targetStart: 500, targetEnd: 700, pos: 612 },
  },
  {
    n: "08", k: "STRIDE LEN", ko: "스트라이드 길이",
    val: "84", unit: "% BH", norm: "NORM · 80–95% BH", ok: true,
    series: [0.02, 0.06, 0.16, 0.32, 0.52, 0.68, 0.78, 0.84, 0.84, 0.84, 0.84, 0.84, 0.84, 0.84, 0.84],
    range: { min: 50, max: 110, targetStart: 80, targetEnd: 95, pos: 84 },
  },
];

export const CHAIN_SEGMENTS = [
  { id: "STRIDE",   pct: 98, delta: "+0 NORMAL",    state: "ok" },
  { id: "PELVIS",   pct: 79, delta: "−9 vs NORM",   state: "bad" },
  { id: "TRUNK",    pct: 94, delta: "+1 NORMAL",    state: "ok" },
  { id: "SHOULDER", pct: 96, delta: "+2 STRONG",    state: "ok" },
  { id: "ELBOW",    pct: 82, delta: "−12 vs NORM",  state: "bad" },
  { id: "RELEASE",  pct: 91, delta: "−4 LATE FIRE", state: "warn" },
] as const;

export const LEAKS = [
  { v: "−12%", p: "COCK → ACCEL",     d: "팔꿈치 높이 부족",      state: "bad"  },
  { v: "−09%", p: "PELVIS ROTATION", d: "X-Factor 38° · 분리 부족", state: "bad"  },
  { v: "+04%", p: "RELEASE",          d: "ER velocity 안정 출력",   state: "ok"   },
  { v: "−05%", p: "FOLLOW",           d: "감속 구간 체간 불안정",   state: "warn" },
  { v: "+02%", p: "STRIDE PLANT",     d: "접지 안정 · 84% BH",      state: "ok"   },
] as const;

export const DRILLS = [
  {
    id: "01 · 골반",
    title: "Hip-Shoulder Separation Hold",
    desc: "발 접지 후 골반만 먼저 회전 · 상체는 닫은 채로 유지 (X-Factor 회복)",
    reps: "3 SET × 8 · 2초 홀드",
    priority: "HIGH PRIORITY",
    top: true,
  },
  {
    id: "02 · 팔꿈치",
    title: "Towel · Elbow Lift",
    desc: "팔꿈치를 견봉선 위로 들어 올리는 감각 회복",
    reps: "3 SET × 10",
    priority: "HIGH",
    top: false,
  },
  {
    id: "03 · 손목",
    title: "Wall Drill · 4-Seam Path",
    desc: "릴리스 시 일관된 손목 채찍 각도",
    reps: "3 SET × 12",
    priority: "MEDIUM",
    top: false,
  },
];
