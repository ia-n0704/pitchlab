type Metric = {
  n: string;
  k: string;
  ko: string;
  val: string;
  unit: string;
  norm: string;
  ok: boolean;
  series: number[];
  range: { min: number; max: number; targetStart: number; targetEnd: number; pos: number };
};

export function MetricCard({ m }: { m: Metric }) {
  const color = m.ok ? "var(--color-acc)" : "var(--color-danger)";
  const numColor = m.ok ? "var(--color-fg-0)" : "var(--color-danger)";

  // series → path on a 220x48 viewbox
  const seriesPath = m.series
    .map((v, i) => {
      const x = (i / (m.series.length - 1)) * 216 + 2;
      const y = 42 - v * 38;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const { min, max, targetStart, targetEnd, pos } = m.range;
  const span = max - min;
  const tStart = Math.max(0, Math.min(1, (targetStart - min) / span)) * 220;
  const tWidth = Math.max(0, Math.min(1, (targetEnd - targetStart) / span)) * 220;
  const valX = Math.max(0, Math.min(1, (pos - min) / span)) * 220;

  return (
    <div
      className="flex flex-col gap-3.5"
      style={{
        background: "var(--color-bg-0)",
        padding: "22px 20px",
      }}
    >
      <div className="flex justify-between items-start">
        <span className="mono" style={{ fontSize: 10.5, color: "var(--color-fg-3)", letterSpacing: "0.18em" }}>
          {m.n}
        </span>
        <span className="rounded-full" style={{ width: 8, height: 8, background: color }} />
      </div>
      <div>
        <div className="mono" style={{ fontSize: 11, color, letterSpacing: "0.14em" }}>
          {m.k}
        </div>
        <div style={{ fontSize: 13, color: "var(--color-fg-1)", marginTop: 2 }}>{m.ko}</div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="mono" style={{ fontSize: 36, fontWeight: 500, color: numColor }}>{m.val}</span>
        <span className="mono" style={{ fontSize: 13, color: "var(--color-fg-3)" }}>{m.unit}</span>
      </div>

      <svg viewBox="0 0 220 48" width="100%" height={48} preserveAspectRatio="none">
        <rect x={0} y={14} width={220} height={20} fill="var(--color-acc-soft)" />
        <path d={seriesPath} fill="none" stroke={color} strokeWidth={1.6} />
      </svg>

      <svg viewBox="0 0 220 40" width="100%" height={40}>
        <rect x={0} y={8} width={220} height={22} fill="var(--color-bg-2)" stroke="var(--color-line)" />
        <rect x={tStart} y={8} width={tWidth} height={22} fill="var(--color-acc-soft)" stroke={m.ok ? "var(--color-acc)" : "var(--color-line-2)"} />
        <line x1={valX} y1={4} x2={valX} y2={34} stroke={color} strokeWidth={2} />
        <circle cx={valX} cy={19} r={3.5} fill={color} />
      </svg>

      <div className="mono" style={{ fontSize: 10, color: "var(--color-fg-3)", letterSpacing: "0.1em", marginTop: -4 }}>
        {m.norm}
      </div>
    </div>
  );
}
