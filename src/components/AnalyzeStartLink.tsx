"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { checkSession, clearToken, loadToken } from "@/lib/api";

/**
 * "분석 시작" CTA that refuses to navigate when signed out.
 *
 * Deliberately a <button>, NOT a <Link> — there is no /upload href to bypass via
 * middle-click, cmd-click, "open in new tab", or keyboard. Navigation happens
 * only through router.push after a session check passes. Clicking without a
 * valid session shows an in-app notice and stays put; a stored token is
 * validated against the backend first, so stale/demo tokens get the same notice.
 * AuthGuard on /upload remains the backstop for direct URL entry.
 */
export function AnalyzeStartLink({
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState(false);
  const [checking, setChecking] = useState(false);

  const onClick = () => {
    if (checking) return;
    if (!loadToken()) {
      setNotice(true);
      return;
    }
    setChecking(true);
    checkSession().then((session) => {
      setChecking(false);
      if (session === "invalid") {
        clearToken();
        setNotice(true);
        return;
      }
      // "valid", or "offline" demo session — proceed.
      router.push("/upload");
    });
  };

  return (
    <>
      <Button onClick={onClick} variant={variant} size={size} className={className}>
        {children}
      </Button>

      {/* Portal to <body>: the NavBar's backdrop-filter would otherwise trap
          position:fixed and pin the dialog inside the header. */}
      {notice && createPortal(
        <div
          role="alertdialog"
          aria-label="로그인 필요"
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setNotice(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, calc(100vw - 40px))",
              background: "var(--color-bg-1)",
              border: "1px solid var(--color-line-2)",
              borderRadius: "var(--radius-pl-md)",
              padding: "28px 28px 24px",
            }}
          >
            <div className="eyebrow mb-3" style={{ color: "var(--color-acc)" }}>
              LOGIN REQUIRED
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>로그인이 필요합니다</div>
            <p style={{ fontSize: 13.5, color: "var(--color-fg-2)", lineHeight: 1.6, marginBottom: 20 }}>
              분석을 시작하려면 먼저 로그인해 주세요.
              계정이 없다면 무료로 가입할 수 있습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setNotice(false)}>
                닫기
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setNotice(false);
                  router.push("/auth#login");
                }}
              >
                로그인 하러 가기
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
