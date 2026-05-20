"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { Chip } from "./Chip";
import { ButtonLink } from "./Button";
import { ReactNode } from "react";

type NavItem = { href: string; label: string };

const PUBLIC_NAV: NavItem[] = [
  { href: "/", label: "HOME" },
  { href: "/#how", label: "HOW IT WORKS" },
  { href: "/#science", label: "SCIENCE" },
  { href: "/#beta", label: "BETA" },
];

const APP_NAV: NavItem[] = [
  { href: "/dashboard", label: "분석" },
  { href: "/dashboard", label: "히스토리" },
  { href: "#", label: "드릴" },
  { href: "#", label: "설정" },
];

export function NavBar({ mode = "public" }: { mode?: "public" | "app" }) {
  const pathname = usePathname();
  const items = mode === "app" ? APP_NAV : PUBLIC_NAV;

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between border-b"
      style={{
        borderColor: "var(--color-line)",
        padding: "22px clamp(20px, 4vw, 56px)",
        background: "color-mix(in srgb, var(--color-bg-0) 86%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Logo size={20} />
      <nav className="hidden md:flex gap-9">
        {items.map((it, idx) => {
          const active = it.href !== "#" && pathname === it.href.split("#")[0];
          return (
            <Link
              key={`${it.href}-${idx}`}
              href={it.href}
              className="mono uppercase pb-1 border-b transition-colors"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                color: active ? "var(--color-fg-0)" : "var(--color-fg-2)",
                borderColor: active ? "var(--color-acc)" : "transparent",
              }}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex gap-[10px] items-center">
        {mode === "public" ? (
          <>
            <ButtonLink href="/auth#login" variant="ghost" size="sm">
              로그인
            </ButtonLink>
            <ButtonLink href="/upload" variant="primary" size="sm">
              분석 시작
            </ButtonLink>
          </>
        ) : (
          <>
            <Chip variant="acc" dot>BETA · 무료</Chip>
            <ButtonLink href="/upload" variant="ghost" size="sm">
              새 영상 업로드
            </ButtonLink>
            <Avatar initial="K" />
          </>
        )}
      </div>
    </header>
  );
}

function Avatar({ initial }: { initial: string }): ReactNode {
  return (
    <div
      className="rounded-full flex items-center justify-center mono font-semibold"
      style={{
        width: 32,
        height: 32,
        background: "var(--color-bg-2)",
        border: "1px solid var(--color-line-2)",
        fontSize: 11,
        color: "var(--color-acc)",
      }}
    >
      {initial}
    </div>
  );
}
