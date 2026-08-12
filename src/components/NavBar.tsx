"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { Chip } from "./Chip";
import { ButtonLink } from "./Button";
import { AnalyzeStartLink } from "./AnalyzeStartLink";

type NavItem = { href: string; label: string; section?: string };

const PUBLIC_NAV: NavItem[] = [
  { href: "/", label: "HOME" },
  { href: "/#how", label: "HOW IT WORKS", section: "how" },
  { href: "/#science", label: "SCIENCE", section: "science" },
  { href: "/#beta", label: "BETA", section: "beta" },
];

const APP_NAV: NavItem[] = [
  { href: "/upload", label: "분석" },
  { href: "/dashboard", label: "결과" },
  { href: "/dashboard#stage-history", label: "히스토리", section: "stage-history" },
  { href: "/dashboard#stage-drills", label: "드릴", section: "stage-drills" },
];

export function NavBar({ mode = "public" }: { mode?: "public" | "app" }) {
  const pathname = usePathname();
  const items = mode === "app" ? APP_NAV : PUBLIC_NAV;
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Scrollspy: track which #section is currently in view.
  useEffect(() => {
    const sectionIds = items.map((it) => it.section).filter((s): s is string => !!s);
    if (sectionIds.length === 0) return;

    const observers: IntersectionObserver[] = [];
    let currentTop: string | null = null;

    const handler: IntersectionObserverCallback = () => {
      // Pick the section closest to the top of the viewport that is at least partially visible.
      const candidates = sectionIds
        .map((id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { id, top: rect.top, bottom: rect.bottom };
        })
        .filter((c): c is { id: string; top: number; bottom: number } => !!c)
        .filter((c) => c.bottom > 80 && c.top < window.innerHeight * 0.6);

      const next = candidates.length === 0 ? null : candidates.sort((a, b) => a.top - b.top)[0].id;
      if (next !== currentTop) {
        currentTop = next;
        setActiveSection(next);
      }
    };

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(handler, { threshold: [0, 0.25, 0.5, 0.75, 1] });
      obs.observe(el);
      observers.push(obs);
    });

    // also listen to scroll for snappier feedback
    window.addEventListener("scroll", () => handler([], {} as IntersectionObserver), { passive: true });
    handler([], {} as IntersectionObserver);

    return () => {
      observers.forEach((o) => o.disconnect());
    };
    // re-run when items change (mode/page swap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pathname]);

  function isActive(it: NavItem): boolean {
    const basePath = it.href.split("#")[0] || "/";

    // section-anchored link
    if (it.section) {
      return pathname === basePath && activeSection === it.section;
    }

    // exact route link (e.g. "/", "/upload", "/dashboard")
    if (pathname !== basePath) return false;
    // when on the route and any section is active, suppress the bare-route highlight
    // (so e.g. "HOME" doesn't stay lit while user scrolls past #how)
    const hasSiblingSections = items.some((sib) => sib.section);
    if (hasSiblingSections && activeSection !== null) return false;
    return true;
  }

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
          const active = isActive(it);
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
            <AnalyzeStartLink variant="primary" size="sm">
              분석 시작
            </AnalyzeStartLink>
          </>
        ) : (
          <>
            <Chip variant="acc" dot>BETA · 무료</Chip>
            <ButtonLink href="/upload" variant="ghost" size="sm">
              새 영상 업로드
            </ButtonLink>
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
              K
            </div>
          </>
        )}
      </div>
    </header>
  );
}
