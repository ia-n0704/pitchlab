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

export function metricsFromApi(detail: AnalysisDetail): {
  upper: Metric[];
  lower: Metric[];
  kineticScore: number;
  comment: string;
  chain: Array<{ id: string; pct: number; state: "ok" | "warn" | "bad"; delta: string }>;
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

  return {
    upper,
    lower,
    kineticScore: detail.kinetic_score ?? 0,
    comment: detail.llm_comment ?? "",
    chain,
  };
}
