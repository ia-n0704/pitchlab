import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost";
type Size = "sm" | "md" | "lg";

type Common = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  full?: boolean;
};

const sizes: Record<Size, { height: number; padX: number; fontSize: number }> = {
  sm: { height: 30, padX: 12, fontSize: 12 },
  md: { height: 40, padX: 18, fontSize: 13 },
  lg: { height: 52, padX: 28, fontSize: 14 },
};

function getStyles({ variant = "primary", size = "md", full }: Common) {
  const s = sizes[size];
  const base = {
    height: s.height,
    paddingLeft: s.padX,
    paddingRight: s.padX,
    fontSize: s.fontSize,
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    letterSpacing: "0.02em",
    borderRadius: "var(--radius-pl-sm)",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    border: "1px solid transparent",
    transition: "background .15s, color .15s, border-color .15s",
    whiteSpace: "nowrap" as const,
    width: full ? "100%" : undefined,
    justifyContent: full ? ("center" as const) : undefined,
    textDecoration: "none",
  };

  if (variant === "primary") {
    return {
      ...base,
      background: "var(--color-acc)",
      color: "var(--color-acc-fg)",
    };
  }
  return {
    ...base,
    background: "transparent",
    color: "var(--color-fg-0)",
    borderColor: "var(--color-line-2)",
  };
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  full,
  className,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={className}
      style={{ ...getStyles({ children, variant, size, full }), ...(rest.style ?? {}) }}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
  size = "md",
  full,
  className,
  onClick,
}: Common & { href: string; onClick?: React.MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={onClick}
      style={getStyles({ children, variant, size, full })}
    >
      {children}
    </Link>
  );
}
