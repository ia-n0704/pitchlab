"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Skeleton } from "@/lib/adapt";

// Joint indices — must mirror backend `_SKELETON_LM` order.
const NOSE = 0;
const L_SH = 1, R_SH = 2;
const L_EL = 3, R_EL = 4;
const L_WR = 5, R_WR = 6;
const L_HIP = 7, R_HIP = 8;
const L_KN = 9, R_KN = 10;
const L_AN = 11, R_AN = 12;
const L_FO = 13, R_FO = 14;

const EDGES: Array<[number, number]> = [
  [L_SH, R_SH], [L_HIP, R_HIP],
  [L_SH, L_HIP], [R_SH, R_HIP],
  [L_SH, L_EL], [L_EL, L_WR],
  [R_SH, R_EL], [R_EL, R_WR],
  [L_HIP, L_KN], [L_KN, L_AN], [L_AN, L_FO],
  [R_HIP, R_KN], [R_KN, R_AN], [R_AN, R_FO],
];

const SIZE = 480;
const PAD = 44;
const span = SIZE - 2 * PAD;

const px = (x: number) => PAD + x * span;
const py = (y: number) => PAD + y * span;

function phaseFor(rel: number): string {
  if (rel < -0.45) return "WIND-UP";
  if (rel < -0.12) return "COCKING";
  if (rel < -0.01) return "ACCEL";
  if (rel <= 0.01) return "RELEASE";
  return "FOLLOW";
}

const PHASE_COLOR: Record<string, string> = {
  "WIND-UP": "var(--color-fg-3)",
  COCKING: "var(--color-fg-1)",
  ACCEL: "var(--color-acc)",
  RELEASE: "var(--color-acc)",
  FOLLOW: "var(--color-fg-2)",
};

export function PoseSkeleton({ skeleton, handedness }: { skeleton: Skeleton; handedness: "RH" | "LH" }) {
  const frames = skeleton.frames;
  const total = frames.length;
  const fps = skeleton.fps > 0 ? skeleton.fps : 30;
  const relFrame = Math.min(total - 1, Math.max(0, skeleton.release_frame));

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.5);
  const lastRef = useRef(0);
  const holdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // throwing-arm joint indices for highlight + wrist trace
  const armEl = handedness === "RH" ? R_EL : L_EL;
  const armSh = handedness === "RH" ? R_SH : L_SH;
  const armWr = handedness === "RH" ? R_WR : L_WR;

  const tracePath = useMemo(() => {
    let d = "";
    for (let i = 0; i < total; i++) {
      const j = frames[i][armWr];
      d += (i === 0 ? "M " : "L ") + px(j[0]).toFixed(1) + " " + py(j[1]).toFixed(1) + " ";
    }
    return d;
  }, [frames, total, armWr]);

  useEffect(() => {
    const tick = (now: number) => {
      const last = lastRef.current || now;
      const dt = (now - last) / 1000;
      lastRef.current = now;
      if (playing) {
        setIdx((prev) => {
          const next = prev + dt * fps * speed;
          if (next >= total - 1) {
            // hold briefly on the last frame, then loop back to the start
            if (holdRef.current === 0) holdRef.current = now;
            if (now - holdRef.current < 500) return total - 1;
            holdRef.current = 0;
            return 0;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [playing, speed, fps, total]);

  const fi = Math.min(total - 1, Math.floor(idx));
  // Interpolate between adjacent frames for fluid playback.
  const frac = idx - fi;
  const f0 = frames[fi];
  const f1 = frames[Math.min(total - 1, fi + 1)];
  const f = f0.map((j, k) => [
    j[0] + (f1[k][0] - j[0]) * frac,
    j[1] + (f1[k][1] - j[1]) * frac,
    Math.max(j[2], f1[k][2]),
  ]);

  // mid-shoulder → nose for the neck/head
  const midSh: [number, number] = [(f[L_SH][0] + f[R_SH][0]) / 2, (f[L_SH][1] + f[R_SH][1]) / 2];
  const nose = f[NOSE];

  const relSec = (fi - relFrame) / fps;
  const hudTime = `T = ${relSec >= 0 ? "+" : "−"}${Math.abs(relSec).toFixed(3)}s`;
  // Phase from velocity-based segmentation when available; else the time heuristic.
  const phases = skeleton.phases ?? [];
  const hudPhase = phases.find((p) => fi >= p.start && fi <= p.end)?.id ?? phaseFor(relSec);
  const denom = Math.max(1, total - 1);

  const onRailClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setIdx(u * (total - 1));
  };

  const dim = (v: number) => Math.max(0.25, Math.min(1, v));

  return (
    <div>
      <div className="flex justify-between items-center flex-wrap gap-2 mb-3.5">
        <div className="eyebrow">STAGE 01 · SKELETON OVERLAY</div>
        <div className="flex gap-1.5 mono" style={{ fontSize: 10.5, letterSpacing: "0.1em" }}>
          {["원본", "2D", "오버레이"].map((label, i, arr) => {
            const active = i === arr.length - 1;
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
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0 m-auto"
          style={{ width: "min(500px, 90%)", height: "auto", display: "block" }}
          aria-label="pitcher pose overlay"
        >
          {/* wrist trace of the throwing arm */}
          <path d={tracePath} fill="none" stroke="var(--color-acc)" strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />

          {/* bones */}
          {EDGES.map(([a, b], i) => {
            const isArm = (a === armSh && b === armEl) || (a === armEl && b === armWr);
            const vis = Math.min(f[a][2], f[b][2]);
            return (
              <line
                key={i}
                x1={px(f[a][0])} y1={py(f[a][1])}
                x2={px(f[b][0])} y2={py(f[b][1])}
                stroke={isArm ? "var(--color-acc)" : "var(--color-fg-1)"}
                strokeWidth={isArm ? 3 : 2}
                strokeLinecap="round"
                opacity={dim(vis)}
              />
            );
          })}

          {/* neck + head */}
          <line x1={px(midSh[0])} y1={py(midSh[1])} x2={px(nose[0])} y2={py(nose[1])} stroke="var(--color-fg-1)" strokeWidth={2} opacity={dim(nose[2])} />
          <circle cx={px(nose[0])} cy={py(nose[1])} r={16} fill="none" stroke="var(--color-fg-1)" strokeWidth={2} opacity={dim(nose[2])} />

          {/* joints */}
          {f.map((j, i) => {
            if (i === NOSE) return null;
            const onArm = i === armSh || i === armEl || i === armWr;
            return (
              <circle
                key={i}
                cx={px(j[0])} cy={py(j[1])} r={onArm ? 5 : 4}
                fill={onArm ? "var(--color-acc)" : "var(--color-fg-1)"}
                stroke="var(--color-bg-0)" strokeWidth={1.5}
                opacity={dim(j[2])}
              />
            );
          })}

          <text x={14} y={SIZE - 14} fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-fg-3)" letterSpacing="0.12em">
            33 KEYPOINTS · BLAZEPOSE HEAVY · {handedness} PITCHER
          </text>
        </svg>

        {/* HUD */}
        <div
          className="absolute mono flex gap-3.5 flex-wrap"
          style={{ top: 14, left: 14, fontSize: 10.5, color: "var(--color-fg-2)", letterSpacing: "0.12em" }}
        >
          <span style={{ color: "var(--color-acc)" }}>● REAL DATA</span>
          <span>{hudTime}</span>
          <span>{hudPhase}</span>
        </div>
        <div
          className="absolute mono"
          style={{ top: 14, right: 14, fontSize: 10.5, color: "var(--color-fg-3)", letterSpacing: "0.12em" }}
        >
          FRAME {String(fi).padStart(3, "0")} / {total - 1}
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
              style={{ width: 36, height: 36, background: "var(--color-acc)", color: "var(--color-acc-fg)", fontSize: 13 }}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <span className="mono" style={{ fontSize: 13 }}>
              {((fi / fps)).toFixed(2)}s <span style={{ color: "var(--color-fg-3)" }}>/ {((total - 1) / fps).toFixed(2)}s</span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {[0.25, 0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="mono cursor-pointer rounded-[2px]"
                style={{
                  padding: "4px 10px", fontSize: 10.5,
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
          {/* velocity-segmented phases */}
          {phases.map((p, i) => {
            const left = (p.start / denom) * 100;
            const width = ((p.end - p.start) / denom) * 100;
            const color = PHASE_COLOR[p.id] ?? "var(--color-fg-2)";
            return (
              <div
                key={`${p.id}-${i}`}
                className="absolute top-0 bottom-0 flex items-center justify-center mono overflow-hidden"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: `color-mix(in srgb, ${color} 12%, transparent)`,
                  borderRight: i < phases.length - 1 ? "1px dashed var(--color-line-2)" : "none",
                  fontSize: 8.5,
                  color,
                  letterSpacing: "0.06em",
                }}
              >
                {width > 9 ? p.id : ""}
              </div>
            );
          })}

          {/* release marker */}
          <div
            className="absolute mono"
            style={{
              left: `${(relFrame / Math.max(1, total - 1)) * 100}%`,
              top: 0, bottom: 0, width: 0,
              borderLeft: "1px dashed var(--color-acc)",
            }}
          />
          <div
            className="absolute mono"
            style={{
              left: `${(relFrame / Math.max(1, total - 1)) * 100}%`, top: 4,
              transform: "translateX(-50%)", fontSize: 9, color: "var(--color-acc)", letterSpacing: "0.08em",
              whiteSpace: "nowrap",
            }}
          >
            RELEASE
          </div>

          {/* cursor */}
          <div className="absolute" style={{ left: `${(fi / Math.max(1, total - 1)) * 100}%`, top: -4, bottom: -4, width: 2, background: "var(--color-acc)" }} />
          <div
            className="absolute"
            style={{
              left: `${(fi / Math.max(1, total - 1)) * 100}%`, top: -10, transform: "translateX(-50%)",
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
