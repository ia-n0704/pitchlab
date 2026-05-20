/**
 * Client-side helpers for talking to the FastAPI backend.
 * Falls back to the bundled mock data when NEXT_PUBLIC_API_BASE is not configured
 * (or the server is down) so the app remains demoable without docker-compose.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// ── Token helpers (client-only) ─────────────────────────────────────────────
const TOKEN_KEY = "pitchlab_token";

export function saveToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}
export function loadToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function clearToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

/** Returns auth headers if a token exists, empty object otherwise. */
function authHeaders(): Record<string, string> {
  const token = loadToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

// ── Auth ────────────────────────────────────────────────────────────────────

export type AuthResponse = {
  access_token: string;
  token_type: string;
  email: string;
  handedness: "RH" | "LH";
};

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await jsonOrThrow<AuthResponse>(res);
  saveToken(data.access_token);
  return data;
}

export async function signup(payload: {
  email: string;
  password: string;
  date_of_birth: string; // "YYYY-MM-DD"
  handedness: "RH" | "LH";
  consent_age: boolean;
  consent_processing: boolean;
  consent_analytics?: boolean;
  consent_share?: boolean;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await jsonOrThrow<AuthResponse>(res);
  saveToken(data.access_token);
  return data;
}

// ── Analyses ─────────────────────────────────────────────────────────────────

export async function uploadVideo(file: File): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/uploads`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  return jsonOrThrow<UploadResponse>(res);
}

export async function getAnalysis(id: string): Promise<AnalysisDetail> {
  const res = await fetch(`${API_BASE}/analyses/${id}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  return jsonOrThrow<AnalysisDetail>(res);
}

export async function listRecentAnalyses(): Promise<AnalysisSummary[]> {
  const res = await fetch(`${API_BASE}/analyses?limit=14`, {
    cache: "no-store",
    headers: authHeaders(),
  });
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
