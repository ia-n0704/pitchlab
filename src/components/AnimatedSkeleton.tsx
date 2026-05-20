"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Point = [number, number];
type JointKey =
  | "head" | "neck" | "pelvis"
  | "Rsh" | "Rel" | "Rwr"
  | "Lsh" | "Lel" | "Lwr"
  | "Rhip" | "Lhip"
  | "Rkn" | "Lkn"
  | "Rfo" | "Lfo";

type Pose = Record<JointKey, Point> & {
  labels: { mer: number; elbow: number; xfactor: number };
};

const POSES: Record<string, Pose> = {
  windup: {
    head: [270, 100], neck: [275, 150],
    Rsh: [262, 170], Rel: [262, 232], Rwr: [268, 294],
    Lsh: [290, 170], Lel: [298, 232], Lwr: [306, 292],
    pelvis: [280, 300], Rhip: [270, 300], Lhip: [290, 300],
    Rkn: [260, 400], Rfo: [260, 510],
    Lkn: [295, 355], Lfo: [315, 400],
    labels: { mer: 30, elbow: -38, xfactor: 5 },
  },
  cocking: {
    head: [280, 90], neck: [275, 140],
    Rsh: [255, 160], Rel: [200, 110], Rwr: [155, 70],
    Lsh: [300, 160], Lel: [345, 210], Lwr: [395, 180],
    pelvis: [270, 290], Rhip: [250, 290], Lhip: [290, 290],
    Rkn: [235, 395], Rfo: [225, 510],
    Lkn: [330, 380], Lfo: [400, 500],
    labels: { mer: 172.4, elbow: 8, xfactor: 38 },
  },
  release: {
    head: [285, 95], neck: [285, 145],
    Rsh: [265, 165], Rel: [305, 135], Rwr: [365, 115],
    Lsh: [305, 170], Lel: [270, 225], Lwr: [230, 270],
    pelvis: [280, 290], Rhip: [265, 290], Lhip: [300, 290],
    Rkn: [245, 395], Rfo: [210, 510],
    Lkn: [345, 395], Lfo: [420, 500],
    labels: { mer: 155, elbow: -4.1, xfactor: 18 },
  },
  follow: {
    head: [290, 110], neck: [290, 160],
    Rsh: [275, 180], Rel: [330, 235], Rwr: [300, 310],
    Lsh: [310, 180], Lel: [280, 220], Lwr: [245, 255],
    pelvis: [285, 300], Rhip: [270, 300], Lhip: [305, 300],
    Rkn: [290, 400], Rfo: [330, 510],
    Lkn: [345, 400], Lfo: [420, 500],
    labels: { mer: 60, elbow: -25, xfactor: -8 },
  },
};

const KEYS = [
  { t: 0.0, pose: POSES.windup },
  { t: 0.45, pose: POSES.cocking },
  { t: 0.65, pose: POSES.release },
  { t: 1.0, pose: POSES.follow },
];

const JOINTS: JointKey[] = ["Rsh","Rel","Rwr","Lsh","Lel","Lwr","Rhip","Lhip","Rkn","Rfo","Lkn","Lfo"];

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpPt = (a: Point, b: Point, u: number): Point => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];

function poseAt(t: number): Pose {
  for (let i = 1; i < KEYS.length; i++) {
    if (t <= KEYS[i].t) {
      const k0 = KEYS[i - 1], k1 = KEYS[i];
      const u = (t - k0.t) / (k1.t - k0.t);
      const p0 = k0.pose, p1 = k1.pose;
      const out: Partial<Pose> = { labels: { mer: 0, elbow: 0, xfactor: 0 } };
      const keys: JointKey[] = ["head", "neck", "pelvis", ...JOINTS];
      for (const k of keys) out[k] = lerpPt(p0[k], p1[k], u);
      out.labels = {
        mer: lerp(p0.labels.mer, p1.labels.mer, u),
        elbow: lerp(p0.labels.elbow, p1.labels.elbow, u),
        xfactor: lerp(p0.labels.xfactor, p1.labels.xfactor, u),
      };
      return out as Pose;
    }
  }
  return KEYS[KEYS.length - 1].pose;
}

function phaseFor(t: number) {
  if (t < 0.18) return "WIND-UP";
  if (t < 0.3) return "STRIDE";
  if (t < 0.5) return "COCKING";
  if (t < 0.64) return "ACCEL";
  if (t < 0.66) return "RELEASE";
  return "FOLLOW";
}

const fmt = (v: number, d = 1) => (v >= 0 ? "" : "−") + Math.abs(v).toFixed(d);

const TOTAL_MS = 3638;
const RELEASE_T = 0.65;
const TOTAL_FRAMES = 218;

export function AnimatedSkeleton() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.25);
  const lastRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // wrist trace path (calculated once)
  const tracePath = useMemo(() => {
    const samples = 80;
    let d = "";
    for (let i = 0; i <= samples; i++) {
      const tt = i / samples;
      const p = poseAt(tt);
      d += (i === 0 ? "M " : "L ") + p.Rwr[0].toFixed(1) + " " + p.Rwr[1].toFixed(1) + " ";
    }
    return d;
  }, []);

  // animation loop
  useEffect(() => {
    const cycleSec = 1.8;
    const tick = (now: number) => {
      const last = lastRef.current || now;
      const dt = (now - last) / 1000;
      lastRef.current = now;
      if (playing) {
        setT((prev) => {
          const next = prev + (dt * speed) / cycleSec;
          return next >= 1 ? 0 : next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [playing, speed]);

  const p = poseAt(t);

  // scrub time
  const ms = Math.round(TOTAL_MS * t);
  const ss = Math.floor(ms / 1000);
  const msec = ms % 1000;
  const scrubTime = `00:${String(ss).padStart(2, "0")}.${String(msec).padStart(3, "0")}`;

  const relSec = (t - RELEASE_T) * TOTAL_MS / 1000;
  const hudTime = `T = ${relSec >= 0 ? "+" : "−"}${Math.abs(relSec).toFixed(3)}s`;
  const hudPhase = phaseFor(t);
  const hudFrame = `FRAME ${String(Math.round(t * TOTAL_FRAMES)).padStart(3, "0")} / ${TOTAL_FRAMES}`;

  const onRailClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setT(u);
  };

  return (
    <div>
      <div className="flex justify-between items-center flex-wrap gap-2 mb-3.5">
        <div className="eyebrow">STAGE 01 · SKELETON OVERLAY</div>
        <div className="flex gap-1.5 mono" style={{ fontSize: 10.5, letterSpacing: "0.1em" }}>
          {["원본", "2D", "3D", "오버레이"].map((label, i) => {
            const active = i === 3;
            return (
              <span
                key={label}
                className="px-2.5 py-1 rounded-[2px]"
                style={{
                  background: active ? "var(--color-acc-soft)" : "var(--color-bg-1)",
                  color: active ? "var(--color-acc)" : "var(--color-fg-2)",
                  border: `1px solid ${active ? "var(--color-acc)" : "var(--color-line-2)"}`,
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      <div
        className="relative overflow-hidden"
        style={{
          height: 540,
          background: "var(--color-bg-1)",
          border: "1px solid var(--color-line-2)",
          borderRadius: "var(--radius-pl-md)",
        }}
      >
        <div className="grid-fine" style={{ opacity: 0.5 }} />

        <svg
          viewBox="0 0 480 560"
          className="absolute inset-0 m-auto"
          style={{ width: "min(520px, 90%)", height: "auto", display: "block" }}
          aria-label="pitcher skeleton animation"
        >
          {/* ground */}
          <line x1="0" y1="514" x2="480" y2="514" stroke="var(--color-line-2)" strokeWidth={1} />

          {/* wrist trace */}
          <path d={tracePath} fill="none" stroke="var(--color-acc)" strokeWidth={1} strokeDasharray="2 3" opacity={0.45} />

          {/* head */}
          <circle cx={p.head[0]} cy={p.head[1] - 12} r={22} fill="none" stroke="var(--color-fg-1)" strokeWidth={2} />

          {/* bones */}
          <Bone a={p.neck} b={p.pelvis} stroke="var(--color-fg-1)" w={2.5} />
          <Bone a={p.Rsh} b={p.Lsh} stroke="var(--color-fg-2)" w={2} />
          <Bone a={p.Rhip} b={p.Lhip} stroke="var(--color-fg-2)" w={2} />
          <Bone a={p.Rsh} b={p.Rel} stroke="var(--color-acc)" w={3} round />
          <Bone a={p.Rel} b={p.Rwr} stroke="var(--color-acc)" w={3} round />
          <Bone a={p.Lsh} b={p.Lel} stroke="var(--color-fg-1)" w={2} />
          <Bone a={p.Lel} b={p.Lwr} stroke="var(--color-fg-1)" w={2} />
          <Bone a={p.Rhip} b={p.Rkn} stroke="var(--color-fg-1)" w={2} />
          <Bone a={p.Rkn} b={p.Rfo} stroke="var(--color-fg-1)" w={2} />
          <Bone a={p.Lhip} b={p.Lkn} stroke="var(--color-fg-1)" w={2} />
          <Bone a={p.Lkn} b={p.Lfo} stroke="var(--color-fg-1)" w={2} />

          {/* joints */}
          <Joint pt={p.Rsh} r={5} color="var(--color-acc)" />
          <Joint pt={p.Rel} r={5} color="var(--color-danger)" />
          <Joint pt={p.Rwr} r={5} color="var(--color-acc)" />
          <Joint pt={p.Lsh} r={4.5} color="var(--color-acc)" />
          <Joint pt={p.Lel} r={4.5} color="var(--color-acc)" />
          <Joint pt={p.Lwr} r={4.5} color="var(--color-acc)" />
          <Joint pt={p.Rhip} r={4} color="var(--color-fg-1)" />
          <Joint pt={p.Lhip} r={4} color="var(--color-fg-1)" />
          <Joint pt={p.Rkn} r={4} color="var(--color-fg-1)" />
          <Joint pt={p.Lkn} r={4} color="var(--color-fg-1)" />
          <Joint pt={p.Rfo} r={4} color="var(--color-fg-1)" />
          <Joint pt={p.Lfo} r={4} color="var(--color-fg-1)" />
          <Joint pt={p.pelvis} r={3} color="var(--color-warn)" />

          {/* shoulder reference */}
          <line
            x1={p.Rsh[0] - 60} y1={p.Rsh[1]}
            x2={p.Rel[0] + 30} y2={p.Rsh[1]}
            stroke="var(--color-line-strong)" strokeWidth={1} strokeDasharray="3 3"
          />

          {/* x-factor pelvis line */}
          <line
            x1={p.Rhip[0] - 24} y1={p.Rhip[1]}
            x2={p.Lhip[0] + 24} y2={p.Lhip[1]}
            stroke="var(--color-warn)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7}
          />
          {/* x-factor shoulder line */}
          <line
            x1={p.Rsh[0] - 24} y1={p.Rsh[1]}
            x2={p.Lsh[0] + 24} y2={p.Lsh[1]}
            stroke="var(--color-warn)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7}
          />

          {/* MER arc */}
          <path
            d={`M ${p.Rsh[0] + 26} ${p.Rsh[1]} A 26 26 0 0 0 ${p.Rsh[0]} ${p.Rsh[1] - 26}`}
            fill="none" stroke="var(--color-acc)" strokeWidth={1}
          />

          {/* annotation pills */}
          <PillSvg x={p.Rsh[0] + 30} y={p.Rsh[1] - 14} stroke="var(--color-acc)" textColor="var(--color-acc)" width={86}>
            {`MER · ${fmt(p.labels.mer)}°`}
          </PillSvg>
          <PillSvg x={p.Rel[0] - 100} y={p.Rel[1] + 40} stroke="var(--color-danger)" textColor="var(--color-danger)" width={96}>
            {`ELBOW · ${fmt(p.labels.elbow)}°`}
          </PillSvg>
          <PillSvg x={p.pelvis[0] - 135} y={p.pelvis[1] + 4} stroke="var(--color-warn)" textColor="var(--color-warn)" width={102}>
            {`X-FACTOR · ${fmt(p.labels.xfactor)}°`}
          </PillSvg>

          <text
            x={14} y={544}
            fontFamily="var(--font-mono)" fontSize={10}
            fill="var(--color-fg-3)" letterSpacing="0.12em"
          >
            33 KEYPOINTS · BLAZEPOSE HEAVY + MOTIONBERT 3D
          </text>
        </svg>

        {/* HUD */}
        <div
          className="absolute mono flex gap-3.5 flex-wrap"
          style={{ top: 14, left: 14, fontSize: 10.5, color: "var(--color-fg-2)", letterSpacing: "0.12em" }}
        >
          <span style={{ color: "var(--color-acc)" }}>● REC</span>
          <span>PITCH 03/05</span>
          <span>{hudTime}</span>
          <span>{hudPhase}</span>
        </div>
        <div
          className="absolute mono"
          style={{ top: 14, right: 14, fontSize: 10.5, color: "var(--color-fg-3)", letterSpacing: "0.12em" }}
        >
          {hudFrame} · 60FPS
        </div>
      </div>

      {/* SCRUBBER */}
      <div className="mt-4">
        <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
          <div className="flex gap-2.5 items-center">
            <button
              aria-label={playing ? "일시정지" : "재생"}
              onClick={() => setPlaying((s) => !s)}
              className="rounded-full inline-flex items-center justify-center border-0 cursor-pointer"
              style={{
                width: 36, height: 36,
                background: "var(--color-acc)",
                color: "var(--color-acc-fg)",
                fontSize: 13,
              }}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <span className="mono" style={{ fontSize: 13 }}>
              {scrubTime} <span style={{ color: "var(--color-fg-3)" }}>/ 00:03.638</span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {[0.125, 0.25, 0.5, 1].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="mono cursor-pointer rounded-[2px]"
                style={{
                  padding: "4px 10px",
                  fontSize: 10.5,
                  border: `1px solid ${speed === s ? "var(--color-line-2)" : "transparent"}`,
                  background: speed === s ? "var(--color-bg-2)" : "transparent",
                  color: speed === s ? "var(--color-fg-0)" : "var(--color-fg-3)",
                }}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div
          ref={railRef}
          onClick={onRailClick}
          className="relative cursor-pointer"
          style={{ height: 48, background: "var(--color-bg-1)", border: "1px solid var(--color-line-2)", borderRadius: 2 }}
        >
          {[
            ["WIND-UP", 0, 18, "var(--color-fg-3)"],
            ["STRIDE", 18, 30, "var(--color-fg-2)"],
            ["COCKING", 30, 50, "var(--color-fg-1)"],
            ["ACCEL", 50, 64, "var(--color-acc)"],
            ["", 64, 66, "var(--color-acc)"],
            ["FOLLOW", 66, 100, "var(--color-fg-2)"],
          ].map(([label, start, end, color], i) => (
            <div
              key={`${label}-${i}`}
              className="absolute top-0 bottom-0 flex items-center justify-center mono"
              style={{
                left: `${start}%`,
                width: `${(end as number) - (start as number)}%`,
                borderRight: i < 5 ? "1px dashed var(--color-line-2)" : "none",
                fontSize: 9,
                color: color as string,
                letterSpacing: "0.08em",
              }}
            >
              {(end as number) - (start as number) > 6 && label}
            </div>
          ))}

          {/* keyframe pips */}
          {[12, 30, 58, 70].map((x) => (
            <div
              key={x}
              className="absolute"
              style={{ left: `${x}%`, top: -3, width: 4, height: 4, background: "var(--color-fg-1)", transform: "translateX(-50%) rotate(45deg)" }}
            />
          ))}

          {/* cursor */}
          <div className="absolute" style={{ left: `${t * 100}%`, top: -4, bottom: -4, width: 2, background: "var(--color-acc)" }} />
          <div
            className="absolute"
            style={{
              left: `${t * 100}%`, top: -10, transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "6px solid var(--color-acc)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Bone({ a, b, stroke, w, round }: { a: Point; b: Point; stroke: string; w: number; round?: boolean }) {
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={stroke} strokeWidth={w} strokeLinecap={round ? "round" : "butt"} />;
}

function Joint({ pt, r, color }: { pt: Point; r: number; color: string }) {
  return <circle cx={pt[0]} cy={pt[1]} r={r} fill={color} stroke="var(--color-bg-0)" strokeWidth={1.5} />;
}

function PillSvg({
  x,
  y,
  stroke,
  textColor,
  width,
  children,
}: {
  x: number;
  y: number;
  stroke: string;
  textColor: string;
  width: number;
  children: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-6} y={-15} width={width} height={20} fill="var(--color-bg-2)" stroke={stroke} strokeWidth={1} />
      <text x={-2} y={-1} fontFamily="var(--font-mono)" fontSize={11} fill={textColor} letterSpacing="0.04em">
        {children}
      </text>
    </g>
  );
}
