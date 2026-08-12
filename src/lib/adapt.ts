/**
 * Adapts the FastAPI response shape into the component-facing shape used by
 * MetricCard, HistoryChart, etc. Keeps the UI decoupled from API names.
 */

import type { MetricValue, AnalysisDetail } from "./api";
import type { Metric } from "@/data/metrics";

const UPPER_KEY_MAP: Array<{ key: string; n: string; label: string }> = [
  { key: "MER",         n: "01", label: "MER" },
  { key: "ELBOW_H",     n: "02", label: "ELBOW H" },
  { key: "ER_VEL",      n: "03", label: "ER VEL" },
  { key: "TRUNK_TILT",  n: "04", label: "TRUNK TILT" },
  { key: "CONSISTENCY", n: "05", label: "CONSISTENCY" },
];

const LOWER_KEY_MAP: Array<{ key: string; n: string; label: string }> = [
  { key: "X_FACTOR",    n: "06", label: "X-FACTOR" },
  { key: "PELVIS_VEL",  n: "07", label: "PELVIS VEL" },
  { key: "STRIDE_LEN",  n: "08", label: "STRIDE LEN" },
];

function isMetric(v: unknown): v is MetricValue {
  return !!v && typeof v === "object" && "value" in (v as object) && "norm_min" in (v as object);
}

function toMetric(
  source: Record<string, unknown>,
  spec: { key: string; n: string; label: string },
): Metric {
  const m = source[spec.key];
  if (!isMetric(m)) {
    return {
      n: spec.n, k: spec.label, ko: "—",
      val: "—", unit: "", norm: "NORM · n/a", ok: false,
      series: Array(15).fill(0.5),
      range: { min: 0, max: 1, targetStart: 0, targetEnd: 1, pos: 0 },
    };
  }
  const span = Math.max(1e-3, m.norm_max - m.norm_min);
  const min = m.norm_min - span * 1.5;
  const max = m.norm_max + span * 1.5;
  return {
    n: spec.n,
    k: spec.label,
    ko: m.ko,
    val: typeof m.value === "number" ? m.value.toLocaleString() : String(m.value),
    unit: m.unit,
    norm: `NORM · ${m.norm_min}${m.unit === "% BH" ? "" : ""}${m.norm_min === m.norm_max ? "" : "–" + m.norm_max}${m.unit}`,
    ok: m.ok,
    series: Array(15).fill(0).map((_, i) => 0.3 + 0.4 * Math.sin(i * 0.6 + (m.ok ? 1 : 2))),
    range: { min, max, targetStart: m.norm_min, targetEnd: m.norm_max, pos: m.value },
  };
}

export type Drill = {
  id: string;
  title: string;
  desc: string;
  reps: string;
  priority: string;
  top: boolean;
};

export type Leak = { v: string; p: string; d: string; state: "ok" | "warn" | "bad" };

/** Joint = [x, y, visibility], all normalized 0..1. One frame = 15 joints (see backend _SKELETON_LM). */
export type Phase = { id: string; start: number; end: number };
export type Skeleton = { fps: number; release_frame: number; frames: number[][][]; phases?: Phase[] };

const STATE_LABEL: Record<"ok" | "warn" | "bad", string> = {
  ok: "안정 출력",
  warn: "전달 효율 주의",
  bad: "에너지 누수 구간",
};

export function metricsFromApi(detail: AnalysisDetail): {
  upper: Metric[];
  lower: Metric[];
  kineticScore: number;
  comment: string;
  chain: Array<{ id: string; pct: number; state: "ok" | "warn" | "bad"; delta: string }>;
  drills: Drill[];
  leaks: Leak[];
  skeleton: Skeleton | null;
  handedness: "RH" | "LH";
} | null {
  const src = detail.metrics as Record<string, unknown> | null;
  if (!src) return null;

  const upper = UPPER_KEY_MAP.map((spec) => toMetric(src, spec));
  const lower = LOWER_KEY_MAP.map((spec) => toMetric(src, spec));

  const rawChain = src["chain_efficiency"] as
    | Array<{ id: string; pct: number; state: "ok" | "warn" | "bad" }>
    | undefined;

  const chain = (rawChain ?? []).map((c) => ({
    ...c,
    delta:
      c.state === "ok" ? "+0 NORMAL" : c.state === "warn" ? `−${Math.round(95 - c.pct)} WATCH` : `−${Math.round(95 - c.pct)} LEAK`,
  }));

  // Drills are computed deterministically on the backend and live inside metrics.
  const drills = (Array.isArray(src["drills"]) ? (src["drills"] as Drill[]) : []).filter(
    (d) => d && typeof d.title === "string",
  );

  // Energy leaks: surface the weakest chain segments first.
  const leaks: Leak[] = [...chain]
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5)
    .map((seg) => ({
      v: `${seg.pct}%`,
      p: seg.id,
      d: STATE_LABEL[seg.state],
      state: seg.state,
    }));

  // Real keypoint overlay track (anonymized). null → UI falls back to the demo animation.
  const rawSkeleton = src["skeleton"] as Skeleton | undefined;
  const skeleton =
    rawSkeleton && Array.isArray(rawSkeleton.frames) && rawSkeleton.frames.length > 0
      ? rawSkeleton
      : null;

  const handedness = src["handedness"] === "LH" ? "LH" : "RH";

  return {
    upper,
    lower,
    kineticScore: detail.kinetic_score ?? 0,
    comment: detail.llm_comment ?? "",
    chain,
    drills,
    leaks,
    skeleton,
    handedness,
  };
}
