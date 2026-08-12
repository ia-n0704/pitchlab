/**
 * In-browser analysis: extract pose from the user's uploaded video with
 * BlazePose (3D) and run the ported biomechanics pipeline — so a real user can
 * get a real report without the Python backend. Used as the fallback path when
 * the FastAPI backend isn't reachable.
 *
 * The heavy ML deps are imported dynamically so they never run on the server or
 * bloat the initial bundle.
 */
import type { AnalysisDetail } from "../api";
import { computeMetrics, detectThrowingSide, templatedComment, LM, type AnalysisFrame } from "./metrics";
import { smoothFrames } from "./smoothing";

export type Progress = { phase: string; pct: number; detail?: string };

// Capture strategy (EverySports "swing detection → analysis" + dynamic FPS):
//   • short clip → the whole clip IS roughly the pitch, so sample all of it densely.
//   • long clip  → a coarse scan locates the release, then we densely sample a wide
//     window around it that covers the full motion (leg-lift → cocking → release →
//     follow-through), not just the instant of release.
const COARSE_FPS = 12;
const COARSE_CAP = 36;
const DENSE_FPS = 45; // cap; the effective rate adapts to fit the frame budget
const DENSE_CAP = 90; // frame budget for the analysis pass
const WINDOW_PRE = 1.3; // seconds before release (covers wind-up / stride / cocking)
const WINDOW_POST = 0.9; // seconds after release (follow-through)
const SHORT_CLIP = 3.5; // ≤ this many seconds → analyze the whole clip

function waitEvent(el: HTMLMediaElement, ev: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const err = () => { cleanup(); reject(new Error("영상을 불러올 수 없습니다 (코덱 미지원 또는 손상).")); };
    const cleanup = () => { el.removeEventListener(ev, ok); el.removeEventListener("error", err); };
    el.addEventListener(ev, ok, { once: true });
    el.addEventListener("error", err, { once: true });
  });
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => finish();
    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = t;
    } catch {
      finish();
    }
    // Never hang if the 'seeked' event doesn't fire (some codecs / backgrounded tabs).
    setTimeout(finish, 600);
  });
}

/** Resolve once the current (seeked) frame is actually presented, so a canvas
 *  capture reads real pixels rather than a not-yet-painted/black frame. */
function framePresented(video: HTMLVideoElement): Promise<void> {
  const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
  if (typeof v.requestVideoFrameCallback === "function") {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      v.requestVideoFrameCallback!(finish);
      setTimeout(finish, 80); // fallback in case no new frame is presented
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 40));
}

export async function analyzeVideoInBrowser(
  file: File,
  onProgress: (p: Progress) => void,
): Promise<AnalysisDetail> {
  onProgress({ phase: "LOADING MODEL", pct: 2, detail: "포즈 추정 모델 로드 중…" });

  // Dynamic imports — client-only.
  const tf = await import("@tensorflow/tfjs-core");
  await import("@tensorflow/tfjs-converter");
  await import("@tensorflow/tfjs-backend-webgl");
  const poseDetection = await import("@tensorflow-models/pose-detection");
  try {
    await tf.setBackend("webgl");
  } catch {
    /* fall back to whatever backend tf.ready() selects */
  }
  await tf.ready();

  const detector = await poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
    runtime: "tfjs",
    modelType: "full",
  });

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // Some browsers won't decode/paint a fully offscreen <video>; keep it attached
  // but visually hidden so seeked frames actually rasterize for canvas capture.
  video.style.cssText = "position:fixed;left:-10000px;top:0;width:320px;height:auto;opacity:0;pointer-events:none";
  document.body.appendChild(video);
  video.src = url;

  let width = 0;
  let height = 0;
  let duration = 0;
  let analysisFrames: AnalysisFrame[] = [];
  let usedFps = DENSE_FPS;

  try {
    await waitEvent(video, "loadedmetadata");
    width = video.videoWidth || 0;
    height = video.videoHeight || 0;
    duration = isFinite(video.duration) ? video.duration : 0;
    if (!width || !height) throw new Error("영상 해상도를 읽을 수 없습니다.");
    if (!duration || duration < 0.3) throw new Error("영상 길이가 너무 짧습니다.");

    // Downscaled capture canvas (keeps aspect) — faster, and forces the frame to rasterize.
    const maxW = 640;
    const cw = width > maxW ? maxW : width;
    const ch = Math.max(1, Math.round((cw / width) * height));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("브라우저가 분석에 필요한 캔버스를 지원하지 않습니다.");

    // Detects an undecodable video (e.g. HEVC where the browser has no decoder):
    // drawImage yields an all-black frame. We sample brightness on the coarse pass.
    let sawContent = false;
    const probeBright = (): number => {
      try {
        const s = 16;
        const data = ctx.getImageData(Math.max(0, (cw >> 1) - s), Math.max(0, (ch >> 1) - s), s * 2, s * 2).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
        return sum / (data.length / 4) / 3;
      } catch {
        return 255; // getImageData blocked → assume content, don't false-positive
      }
    };

    // Sample [startT, endT] uniformly at `fps`, capped by `budget`. Returns
    // detected frames paired with their timestamps.
    const capture = async (
      startT: number, endT: number, fps: number, budget: number,
      label: string, progBase: number, progSpan: number, probe = false,
    ): Promise<Array<{ frame: AnalysisFrame; t: number }>> => {
      const dt = 1 / fps;
      const planned = Math.min(budget, Math.max(1, Math.floor((endT - startT) / dt)));
      const out: Array<{ frame: AnalysisFrame; t: number }> = [];
      for (let i = 0; i < planned; i++) {
        const t = startT + i * dt;
        if (t >= endT) break;
        await seek(video, t);
        await framePresented(video);
        ctx.drawImage(video, 0, 0, cw, ch);
        if (probe && !sawContent && probeBright() > 6) sawContent = true;
        const poses = await detector.estimatePoses(canvas, { flipHorizontal: false });
        const p = poses[0];
        if (p && p.keypoints && p.keypoints3D && p.keypoints.length >= 33 && p.keypoints3D.length >= 33) {
          out.push({
            frame: {
              xy: p.keypoints.map((k) => [k.x, k.y]),
              xyz: p.keypoints3D.map((k) => [k.x, k.y, k.z ?? 0]),
              vis: p.keypoints.map((k) => k.score ?? 0),
            },
            t,
          });
        }
        onProgress({ phase: label, pct: progBase + Math.round((i / planned) * progSpan), detail: `${label} ${out.length}/${i + 1}` });
      }
      return out;
    };

    const codecErr =
      "이 영상을 브라우저에서 디코딩하지 못했습니다 (HEVC/H.265 등 미지원 코덱일 수 있습니다). H.264(mp4)로 변환 후 다시 시도해 주세요.";

    if (duration <= SHORT_CLIP) {
      // Short clip — the whole thing is roughly the pitch; sample it all densely.
      const denseFps = Math.min(DENSE_FPS, DENSE_CAP / Math.max(duration, 0.001));
      const dense = await capture(0, duration, denseFps, DENSE_CAP, "ANALYZING", 5, 90, true);
      if (!sawContent) throw new Error(codecErr);
      analysisFrames = dense.map((d) => d.frame);
      usedFps = denseFps;
    } else {
      // Long clip — coarse scan locates the release, then a WIDE dense window
      // around it captures the full motion (wind-up → cocking → release → follow).
      const coarseFps = Math.min(COARSE_FPS, COARSE_CAP / duration);
      const coarse = await capture(0, duration, coarseFps, COARSE_CAP, "SCANNING", 5, 25, true);
      if (!sawContent) throw new Error(codecErr);

      let startT = 0;
      let endT = duration;
      if (coarse.length >= 6) {
        const side = detectThrowingSide(coarse.map((c) => c.frame));
        const key = side === "RH" ? LM.right_wrist : LM.left_wrist;
        let peak = 0;
        let peakV = -1;
        for (let i = 1; i < coarse.length; i++) {
          const dtc = coarse[i].t - coarse[i - 1].t || 1e-3;
          const a = coarse[i].frame.xyz[key];
          const b = coarse[i - 1].frame.xyz[key];
          const v = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / dtc;
          if (v > peakV) { peakV = v; peak = i; }
        }
        const relT = coarse[peak].t;
        startT = Math.max(0, relT - WINDOW_PRE);
        endT = Math.min(duration, relT + WINDOW_POST);
      }

      const winLen = Math.max(0.5, endT - startT);
      const denseFps = Math.min(DENSE_FPS, DENSE_CAP / winLen);
      const dense = await capture(startT, endT, denseFps, DENSE_CAP, "ANALYZING", 30, 65);
      if (dense.length >= 10) {
        analysisFrames = dense.map((d) => d.frame);
        usedFps = denseFps;
      } else {
        analysisFrames = coarse.map((c) => c.frame);
        usedFps = coarseFps;
      }
    }
  } finally {
    detector.dispose();
    URL.revokeObjectURL(url);
    video.remove();
  }

  if (analysisFrames.length < 10) {
    throw new Error("사람을 충분히 탐지하지 못했습니다. 전신이 보이는 측면 영상으로 다시 시도해 주세요.");
  }

  onProgress({ phase: "COMPUTING", pct: 97, detail: "지터 제거 · 페이즈 분할 · 지표 계산 중…" });
  // Temporal smoothing (jitter removal) before metrics + skeleton build.
  const smoothed = smoothFrames(analysisFrames, usedFps);
  const metrics = computeMetrics(smoothed, usedFps);
  const comment = templatedComment(metrics);

  const now = new Date().toISOString();
  const id = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const detail: AnalysisDetail = {
    id,
    status: "completed",
    created_at: now,
    completed_at: now,
    kinetic_score: metrics.kinetic_score,
    metrics: metrics as unknown as AnalysisDetail["metrics"],
    llm_comment: comment,
    error_message: null,
    video_fps: usedFps,
    video_frames: analysisFrames.length,
    video_width: width,
    video_height: height,
  };
  onProgress({ phase: "DONE", pct: 100, detail: "분석 완료" });
  return detail;
}
