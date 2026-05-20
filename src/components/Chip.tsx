import { ReactNode } from "react";

type Variant = "default" | "acc" | "danger";

export function Chip({
  children,
  variant = "default",
  dot = false,
}: {
  children: ReactNode;
  variant?: Variant;
  dot?: boolean;
}) {
  const palette = {
    default: {
      color: "var(--color-fg-1)",
      borderColor: "var(--color-line-2)",
      background: "transparent",
    },
    acc: {
      color: "var(--color-acc)",
      borderColor: "var(--color-acc)",
      background: "var(--color-acc-soft)",
    },
    danger: {
      color: "var(--color-danger)",
      borderColor: "rgba(255,90,74,0.4)",
      background: "rgba(255,90,74,0.08)",
    },
  }[variant];

  return (
    <span
      className="inline-flex items-center gap-[6px] h-[22px] px-[8px] mono uppercase rounded-[var(--radius-pl-sm)] border whitespace-nowrap"
      style={{
        fontSize: 10.5,
        letterSpacing: "0.08em",
        color: palette.color,
        borderColor: palette.borderColor,
        background: palette.background,
      }}
    >
      {dot && (
        <span
          className="rounded-full"
          style={{ width: 6, height: 6, background: "currentColor" }}
        />
      )}
      {children}
    </span>
  );
}
