export function ScoreGauge({
  value = 78,
  size = 260,
  label = "KINETICSCORE",
  sub = "OVERALL",
}: {
  value?: number;
  size?: number;
  label?: string;
  sub?: string;
}) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label={`${label} ${value}`}>
      <g stroke="var(--color-fg-3)" strokeWidth={1}>
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const r1 = size / 2 - 4;
          const r2 = size / 2 - (i % 5 === 0 ? 12 : 8);
          return (
            <line
              key={i}
              x1={size / 2 + Math.cos(a) * r1}
              y1={size / 2 + Math.sin(a) * r1}
              x2={size / 2 + Math.cos(a) * r2}
              y2={size / 2 + Math.sin(a) * r2}
              opacity={i % 5 === 0 ? 0.8 : 0.35}
            />
          );
        })}
      </g>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line-2)" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-acc)"
        strokeWidth={6}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize={size * 0.32}
        fontWeight={600}
        fill="var(--color-fg-0)"
        letterSpacing="-0.04em"
      >
        {value}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 18}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing="0.16em"
        fill="var(--color-fg-2)"
      >
        {label}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 34}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={9}
        letterSpacing="0.1em"
        fill="var(--color-fg-3)"
      >
        {sub}
      </text>
    </svg>
  );
}
