/**
 * Temporal smoothing for the per-frame pose track.
 *
 * Raw BlazePose landmarks jitter frame-to-frame (and occasionally jump when a
 * joint is briefly low-confidence). We apply:
 *   1. low-confidence carry-forward — hold the last good position so a momentary
 *      detection dropout doesn't yank the point, then
 *   2. a One-Euro filter per coordinate — a velocity-adaptive low-pass that kills
 *      jitter when a joint is still but still tracks fast motion (the throwing
 *      arm) without lag.
 *
 * Applied to both image coords (skeleton overlay) and world coords (metrics).
 */
import type { AnalysisFrame } from "./metrics";

class LowPass {
  private s = 0;
  private initialized = false;
  filter(x: number, alpha: number): number {
    if (!this.initialized) {
      this.s = x;
      this.initialized = true;
    } else {
      this.s = alpha * x + (1 - alpha) * this.s;
    }
    return this.s;
  }
}

function alpha(cutoff: number, freq: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  const te = 1 / freq;
  return 1 / (1 + tau / te);
}

class OneEuro {
  private xf = new LowPass();
  private dxf = new LowPass();
  private prev: number | null = null;
  // Tuned on synthetic still+fast signals: ~80% jitter reduction with ~2.6px
  // lag on a fast joint. minCutoff↓ smooths still joints; beta keeps the fast
  // throwing arm tracking; dCutoff↓ stops jitter-driven derivative spikes from
  // defeating the smoothing.
  constructor(
    private freq: number,
    private minCutoff = 0.6,
    private beta = 0.15,
    private dCutoff = 0.5,
  ) {}
  filter(x: number): number {
    const dx = this.prev === null ? 0 : (x - this.prev) * this.freq;
    const edx = this.dxf.filter(dx, alpha(this.dCutoff, this.freq));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const fx = this.xf.filter(x, alpha(cutoff, this.freq));
    this.prev = x;
    return fx;
  }
}

const VIS_THRESHOLD = 0.3;

export function smoothFrames(frames: AnalysisFrame[], freq: number): AnalysisFrame[] {
  if (frames.length < 3) return frames;
  const J = frames[0].xy.length;

  const xyF = Array.from({ length: J }, () => [new OneEuro(freq), new OneEuro(freq)]);
  const xyzF = Array.from({ length: J }, () => [new OneEuro(freq), new OneEuro(freq), new OneEuro(freq)]);
  const visF = Array.from({ length: J }, () => new LowPass());

  const lastXY = frames[0].xy.map((p) => [p[0], p[1]]);
  const lastXYZ = frames[0].xyz.map((p) => [p[0], p[1], p[2]]);
  const visAlpha = alpha(2.5, freq);

  return frames.map((f) => {
    const xy: number[][] = [];
    const xyz: number[][] = [];
    const vis: number[] = [];
    for (let j = 0; j < J; j++) {
      const good = (f.vis[j] ?? 0) >= VIS_THRESHOLD;

      const rx = good ? f.xy[j][0] : lastXY[j][0];
      const ry = good ? f.xy[j][1] : lastXY[j][1];
      if (good) { lastXY[j][0] = f.xy[j][0]; lastXY[j][1] = f.xy[j][1]; }
      xy.push([xyF[j][0].filter(rx), xyF[j][1].filter(ry)]);

      const wx = good ? f.xyz[j][0] : lastXYZ[j][0];
      const wy = good ? f.xyz[j][1] : lastXYZ[j][1];
      const wz = good ? f.xyz[j][2] : lastXYZ[j][2];
      if (good) { lastXYZ[j][0] = f.xyz[j][0]; lastXYZ[j][1] = f.xyz[j][1]; lastXYZ[j][2] = f.xyz[j][2]; }
      xyz.push([xyzF[j][0].filter(wx), xyzF[j][1].filter(wy), xyzF[j][2].filter(wz)]);

      vis.push(visF[j].filter(f.vis[j] ?? 0, visAlpha));
    }
    return { xy, xyz, vis };
  });
}
