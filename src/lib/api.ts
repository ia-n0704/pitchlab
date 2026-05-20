/**
 * Client-side helpers for talking to the FastAPI backend.
 * Falls back to the bundled mock data when NEXT_PUBLIC_API_BASE is not configured
 * (or the server is down) so the app remains demoable without docker-compose.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type AnalysisStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "rejected";

export type MetricValue = {
  value: number;
  unit: string;
  norm_min: number;
  norm_max: number;
  ok: boolean;
  ko: string;
};

export type AnalysisDetail = {
  id: string;
  status: AnalysisStatus;
  created_at: string;
  completed_at: string | null;
  kinetic_score: number | null;
  metrics: Record<string, MetricValue | unknown> | null;
  llm_comment: string | null;
  error_message: string | null;
  video_fps: number | null;
  video_frames: number | null;
  video_width: number | null;
  video_height: number | null;
};

export type AnalysisSummary = {
  id: string;
  status: AnalysisStatus;
  created_at: string;
  kinetic_score: number | null;
  original_filename: string;
};

export type UploadResponse = {
  analysis_id: string;
  status: AnalysisStatus;
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  return (await res.json()) as T;
}

export async function uploadVideo(file: File): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/uploads`, { method: "POST", body: fd });
  return jsonOrThrow<UploadResponse>(res);
}

export async function getAnalysis(id: string): Promise<AnalysisDetail> {
  const res = await fetch(`${API_BASE}/analyses/${id}`, { cache: "no-store" });
  return jsonOrThrow<AnalysisDetail>(res);
}

export async function listRecentAnalyses(): Promise<AnalysisSummary[]> {
  const res = await fetch(`${API_BASE}/analyses?limit=14`, { cache: "no-store" });
  return jsonOrThrow<AnalysisSummary[]>(res);
}

/** Polls until status is terminal. Resolves with the final detail object. */
export async function waitForAnalysis(
  id: string,
  { intervalMs = 1500, timeoutMs = 5 * 60_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<AnalysisDetail> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const a = await getAnalysis(id);
    if (a.status === "completed" || a.status === "failed" || a.status === "rejected") {
      return a;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Analysis timed out");
}

export async function isBackendUp(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
