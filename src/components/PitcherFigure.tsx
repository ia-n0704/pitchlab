/**
 * Static side-view pitcher SVG used on landing / auth pages.
 * For the dashboard we use AnimatedSkeleton instead.
 */
export function PitcherFigure({
  pose = "cocking",
  showAnnotations = true,
  showGrid = true,
}: {
  pose?: "cocking" | "release" | "follow";
  showAnnotations?: boolean;
  showGrid?: boolean;
}) {
  const POSES = {
    cocking: {
      head: [280, 78], neck: [275, 140],
      Rsh: [255, 160], Rel: [200, 110], Rwr: [155, 70],
      Lsh: [300, 160], Lel: [345, 210], Lwr: [395, 180],
      Rhip: [250, 290], Lhip: [290, 290], pelvis: [270, 290],
      Rkn: [235, 395], Rfo: [225, 510],
      Lkn: [330, 380], Lfo: [400, 500],
    },
    release: {
      head: [285, 83], neck: [285, 145],
      Rsh: [265, 165], Rel: [305, 135], Rwr: [365, 115],
      Lsh: [305, 170], Lel: [270, 225], Lwr: [230, 270],
      Rhip: [265, 290], Lhip: [300, 290], pelvis: [280, 290],
      Rkn: [245, 395], Rfo: [210, 510],
      Lkn: [345, 395], Lfo: [420, 500],
    },
    follow: {
      head: [290, 98], neck: [290, 160],
      Rsh: [275, 180], Rel: [330, 235], Rwr: [300, 310],
      Lsh: [310, 180], Lel: [280, 220], Lwr: [245, 255],
      Rhip: [270, 300], Lhip: [305, 300], pelvis: [285, 300],
      Rkn: [290, 400], Rfo: [330, 510],
      Lkn: [345, 400], Lfo: [420, 500],
    },
  } as const;

  const p = POSES[pose];

  return (
    <svg
      viewBox="0 0 480 560"
      style={{ display: "block", width: "100%", height: "auto" }}
      aria-label={`pitcher ${pose} pose`}
    >
      {showGrid && (
        <g opacity={0.45} stroke="var(--color-line)" strokeWidth={1}>
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={560} />
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 40} x2={480} y2={i * 40} />
          ))}
        </g>
      )}
      <line x1="0" y1="514" x2="480" y2="514" stroke="var(--color-line-2)" strokeWidth={1} />

      <circle cx={p.head[0]} cy={p.head[1]} r={22} fill="none" stroke="var(--color-fg-1)" strokeWidth={2} />

      <line x1={p.neck[0]} y1={p.neck[1]} x2={p.pelvis[0]} y2={p.pelvis[1]} stroke="var(--color-fg-1)" strokeWidth={2.5} />
      <line x1={p.Rsh[0]} y1={p.Rsh[1]} x2={p.Lsh[0]} y2={p.Lsh[1]} stroke="var(--color-fg-2)" strokeWidth={2} />
      <line x1={p.Rhip[0]} y1={p.Rhip[1]} x2={p.Lhip[0]} y2={p.Lhip[1]} stroke="var(--color-fg-2)" strokeWidth={2} />

      <line x1={p.Rsh[0]} y1={p.Rsh[1]} x2={p.Rel[0]} y2={p.Rel[1]} stroke="var(--color-acc)" strokeWidth={3} strokeLinecap="round" />
      <line x1={p.Rel[0]} y1={p.Rel[1]} x2={p.Rwr[0]} y2={p.Rwr[1]} stroke="var(--color-acc)" strokeWidth={3} strokeLinecap="round" />

      <line x1={p.Lsh[0]} y1={p.Lsh[1]} x2={p.Lel[0]} y2={p.Lel[1]} stroke="var(--color-fg-1)" strokeWidth={2} />
      <line x1={p.Lel[0]} y1={p.Lel[1]} x2={p.Lwr[0]} y2={p.Lwr[1]} stroke="var(--color-fg-1)" strokeWidth={2} />

      <line x1={p.Rhip[0]} y1={p.Rhip[1]} x2={p.Rkn[0]} y2={p.Rkn[1]} stroke="var(--color-fg-1)" strokeWidth={2} />
      <line x1={p.Rkn[0]} y1={p.Rkn[1]} x2={p.Rfo[0]} y2={p.Rfo[1]} stroke="var(--color-fg-1)" strokeWidth={2} />
      <line x1={p.Lhip[0]} y1={p.Lhip[1]} x2={p.Lkn[0]} y2={p.Lkn[1]} stroke="var(--color-fg-1)" strokeWidth={2} />
      <line x1={p.Lkn[0]} y1={p.Lkn[1]} x2={p.Lfo[0]} y2={p.Lfo[1]} stroke="var(--color-fg-1)" strokeWidth={2} />

      {[
        [p.Rsh, "var(--color-acc)", 5],
        [p.Rel, "var(--color-acc)", 5],
        [p.Rwr, "var(--color-acc)", 5],
        [p.Lsh, "var(--color-acc)", 4.5],
        [p.Lel, "var(--color-acc)", 4.5],
        [p.Lwr, "var(--color-acc)", 4.5],
        [p.Rhip, "var(--color-fg-1)", 4],
        [p.Lhip, "var(--color-fg-1)", 4],
        [p.Rkn, "var(--color-fg-1)", 4],
        [p.Lkn, "var(--color-fg-1)", 4],
        [p.Rfo, "var(--color-fg-1)", 4],
        [p.Lfo, "var(--color-fg-1)", 4],
      ].map(([pt, color, r], i) => {
        const point = pt as readonly number[];
        return (
          <circle
            key={i}
            cx={point[0]}
            cy={point[1]}
            r={r as number}
            fill={color as string}
            stroke="var(--color-bg-0)"
            strokeWidth={1.5}
          />
        );
      })}

      {showAnnotations && pose === "cocking" && (
        <g fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-fg-2)">
          <path d="M 285 160 A 30 30 0 0 0 255 130" fill="none" stroke="var(--color-acc)" strokeWidth={1} />
          <text x={295} y={158} fill="var(--color-acc)" fontWeight={600}>MER 172°</text>
          <line x1={205} y1={160} x2={210} y2={160} stroke="var(--color-line-strong)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={110} y={156}>SHOULDER LINE</text>
          <text x={175} y={150}>TRUNK TILT 28°</text>
          <text x={14} y={22} fill="var(--color-fg-3)" fontSize={10} letterSpacing="0.12em">33 KEYPOINTS · BLAZEPOSE HEAVY</text>
          <text x={14} y={544} fill="var(--color-fg-3)" fontSize={10} letterSpacing="0.12em">FRAME 142 / 218 · 60 FPS</text>
        </g>
      )}
    </svg>
  );
}
