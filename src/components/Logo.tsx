import Link from "next/link";

export function Logo({ size = 20, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-[10px] font-[var(--font-display)] font-semibold text-fg-0"
      style={{ fontSize: size, letterSpacing: "-0.03em" }}
    >
      <svg width={size * 1.15} height={size} viewBox="0 0 32 28" aria-hidden="true">
        <path
          d="M 2 22 Q 14 2, 28 14"
          fill="none"
          stroke="var(--color-acc)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="28" cy="14" r="3.5" fill="var(--color-acc)" />
        <circle cx="2" cy="22" r="1.6" fill="var(--color-fg-2)" />
      </svg>
      <span>
        PitchLab<span style={{ color: "var(--color-acc)" }}>.</span>
      </span>
    </Link>
  );
}
