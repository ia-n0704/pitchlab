/**
 * Tiny localStorage helpers for in-browser analysis results.
 *
 * Kept free of any ML / heavy imports so the dashboard can read a local report
 * without pulling the BlazePose/tfjs dependency graph into its bundle.
 */
import type { AnalysisDetail } from "../api";

const LOCAL_PREFIX = "pitchlab_analysis_";

export function saveLocalAnalysis(detail: AnalysisDetail): void {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(LOCAL_PREFIX + detail.id, JSON.stringify(detail));
    } catch {
      /* sessionStorage full — the skeleton track can be large; reader falls back */
    }
  }
}

export function loadLocalAnalysis(id: string): AnalysisDetail | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(LOCAL_PREFIX + id);
  return raw ? (JSON.parse(raw) as AnalysisDetail) : null;
}

export function isLocalId(id: string | null): id is string {
  return !!id && id.startsWith("local-");
}
