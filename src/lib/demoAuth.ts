/**
 * Client-side account store used only when the FastAPI backend is unreachable,
 * so the auth flow stays demoable without docker — while still enforcing the
 * real rules: you can only log in with an account you actually registered, with
 * the correct password, and after completing email verification.
 *
 * Accounts live in localStorage. Passwords are stored as a non-reversible hash
 * (this is a local demo, not a security boundary). Since there's no SMTP, the
 * verification code is returned to the UI and shown on screen.
 */

import type { AuthResponse, SignupResult } from "./api";

const STORE_KEY = "pitchlab_demo_accounts";

type DemoAccount = {
  email: string;
  passwordHash: string;
  handedness: "RH" | "LH";
  verified: boolean;
  code: string | null;
};

/** Raised when an unverified account tries to log in (UI routes to verification). */
export class NotVerifiedError extends Error {
  email: string;
  constructor(email: string) {
    super("이메일 인증이 완료되지 않았습니다.");
    this.name = "NotVerifiedError";
    this.email = email;
  }
}

function loadStore(): Record<string, DemoAccount> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStore(s: Record<string, DemoAccount>): void {
  if (typeof window !== "undefined") localStorage.setItem(STORE_KEY, JSON.stringify(s));
}

// Small non-reversible hash (djb2) — adequate for a local demo store.
function hash(pw: string): string {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function genCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

const norm = (email: string) => email.trim().toLowerCase();

export function demoRegister(payload: {
  email: string;
  password: string;
  handedness: "RH" | "LH";
}): SignupResult {
  const store = loadStore();
  const key = norm(payload.email);
  const existing = store[key];
  if (existing && existing.verified) {
    throw new Error("이미 가입된 이메일입니다.");
  }
  const code = genCode();
  store[key] = {
    email: payload.email,
    passwordHash: hash(payload.password),
    handedness: payload.handedness,
    verified: false,
    code,
  };
  saveStore(store);
  return { email: payload.email, verificationRequired: true, devCode: code };
}

export function demoResend(email: string): SignupResult {
  const store = loadStore();
  const acct = store[norm(email)];
  if (!acct) throw new Error("가입되지 않은 이메일입니다.");
  if (acct.verified) throw new Error("이미 인증된 계정입니다.");
  acct.code = genCode();
  saveStore(store);
  return { email, verificationRequired: true, devCode: acct.code };
}

export function demoVerify(email: string, code: string): AuthResponse {
  const store = loadStore();
  const acct = store[norm(email)];
  if (!acct) throw new Error("가입되지 않은 이메일입니다.");
  if (!acct.verified) {
    if (!acct.code || code.trim() !== acct.code) {
      throw new Error("인증 코드가 올바르지 않습니다.");
    }
    acct.verified = true;
    acct.code = null;
    saveStore(store);
  }
  return tokenFor(acct);
}

export function demoLogin(email: string, password: string): AuthResponse {
  const store = loadStore();
  const acct = store[norm(email)];
  if (!acct) throw new Error("가입되지 않은 이메일입니다.");
  if (acct.passwordHash !== hash(password)) {
    throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
  }
  if (!acct.verified) throw new NotVerifiedError(email);
  return tokenFor(acct);
}

function tokenFor(acct: DemoAccount): AuthResponse {
  return {
    access_token: `demo.${typeof btoa !== "undefined" ? btoa(acct.email) : acct.email}`,
    token_type: "bearer",
    email: acct.email,
    handedness: acct.handedness,
  };
}
