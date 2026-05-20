import { ReactNode } from "react";

export function SectionHead({
  index,
  eyebrow,
  title,
  blurb,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  blurb?: ReactNode;
}) {
  return (
    <div className="grid gap-8 md:grid-cols-[80px_1fr] items-start">
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--color-fg-3)",
          letterSpacing: "0.18em",
          paddingTop: 4,
        }}
      >
        {index}
      </div>
      <div>
        <div className="eyebrow eyebrow-acc">{eyebrow}</div>
        <h2
          className="mt-3.5"
          style={{
            fontSize: "clamp(28px, 4.5vw, 42px)",
            lineHeight: 1.05,
            maxWidth: 760,
          }}
        >
          {title}
        </h2>
        {blurb && (
          <p style={{ color: "var(--color-fg-2)", maxWidth: 540, marginTop: 16, fontSize: 15 }}>
            {blurb}
          </p>
        )}
      </div>
    </div>
  );
}
