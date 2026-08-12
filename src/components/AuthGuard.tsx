"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkSession, clearToken, loadToken } from "@/lib/api";

/**
 * Client-side route guard for pages that require a signed-in session.
 *
 * The token's mere presence is not enough — a stale, expired, or offline-demo
 * token would otherwise slip through and let visitors start an analysis without
 * logging in. When the backend is reachable we validate the token via
 * GET /auth/me and clear it if rejected; only when the backend is down do we
 * fall back to the presence check (offline demo mode, where demoAuth already
 * enforced a verified demo login before issuing its token).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!loadToken()) {
        if (!cancelled) {
          setAuthed(false);
          router.replace("/auth#login");
        }
        return;
      }
      const session = await checkSession();
      if (cancelled) return;
      if (session === "invalid") {
        clearToken();
        setAuthed(false);
        router.replace("/auth#login");
        return;
      }
      // "valid", or "offline" with a demo token — allow.
      setAuthed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (authed !== true) {
    return (
      <div
        className="mono"
        style={{ padding: "80px clamp(20px,4vw,56px)", color: "var(--color-fg-3)", letterSpacing: "0.12em", fontSize: 13 }}
      >
        {authed === null ? "인증 확인 중…" : "로그인이 필요합니다 · 로그인 화면으로 이동합니다…"}
      </div>
    );
  }
  return <>{children}</>;
}
