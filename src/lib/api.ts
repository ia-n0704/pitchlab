/**
 * Client-side helpers for talking to the FastAPI backend.
 * Falls back to the bundled mock data when NEXT_PUBLIC_API_BASE is not configured
 * (or the server is down) so the app remains demoable without docker-compose.
 */

import { demoLogin, demoRegister, demoResend, demoVerify, NotVerifiedError } from "./demoAuth";

export { NotVerifiedError };

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

/** Result of starting signup — verification is always required before login. */
export type SignupResult = {
  email: string;
  verificationRequired: boolean;
  /** Present only in dev/demo (no SMTP) so the code can be shown on screen. */
  devCode?: string;
};

/** A thrown fetch (vs. an HTTP error response) means the backend is unreachable. */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

/** Start signup: creates an unverified account and triggers the verification code.
 *  Does NOT log the user in — they must verify first. */
export async function signup(payload: {
  email: string;
  password: string;
  date_of_birth: string; // "YYYY-MM-DD"
  handedness: "RH" | "LH";
  consent_age: boolean;
  consent_processing: boolean;
  consent_analytics?: boolean;
  consent_share?: boolean;
}): Promise<SignupResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (isNetworkError(err)) {
      console.info("[PitchLab] 백엔드 미연결 — 로컬 데모 계정으로 가입합니다.");
      return demoRegister(payload);
    }
    throw err;
  }
  const data = await jsonOrThrow<{ email: string; verification_required: boolean; dev_code: string | null }>(res);
  return { email: data.email, verificationRequired: data.verification_required, devCode: data.dev_code ?? undefined };
}

/** Confirm the emailed code → marks the account verified and issues a token. */
export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
  } catch (err) {
    if (isNetworkError(err)) {
      const data = demoVerify(email, code);
      saveToken(data.access_token);
      return data;
    }
    throw err;
  }
  const data = await jsonOrThrow<AuthResponse>(res);
  saveToken(data.access_token);
  return data;
}

/** Re-issue a verification code for an unverified account. */
export async function resendCode(email: string): Promise<SignupResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch (err) {
    if (isNetworkError(err)) return demoResend(email);
    throw err;
  }
  const data = await jsonOrThrow<{ email: string; verification_required: boolean; dev_code: string | null }>(res);
  return { email: data.email, verificationRequired: data.verification_required, devCode: data.dev_code ?? undefined };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    if (isNetworkError(err)) {
      console.info("[PitchLab] 백엔드 미연결 — 로컬 데모 계정으로 로그인합니다.");
      const data = demoLogin(email, password); // throws if not registered / wrong pw / unverified
      saveToken(data.access_token);
      return data;
    }
    throw err;
  }
  // Backend reached: 403 means the account exists but isn't verified yet.
  if (res.status === 403) {
    throw new NotVerifiedError(email);
  }
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

/** Validate the stored token against the backend.
 *  "valid"   → real, live session.
 *  "invalid" → backend reachable but rejected the token (stale/demo/expired).
 *  "offline" → backend unreachable; caller may accept a demo session. */
export async function checkSession(): Promise<"valid" | "invalid" | "offline"> {
  const token = loadToken();
  if (!token) return "invalid";
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { cache: "no-store", headers: authHeaders() });
    return res.ok ? "valid" : "invalid";
  } catch {
    return "offline";
  }
}
