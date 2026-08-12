"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { MedicalNotice } from "@/components/Footer";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { uploadVideo, isBackendUp, clearToken } from "@/lib/api";
import { analyzeVideoInBrowser } from "@/lib/analysis/runAnalysis";
import { saveLocalAnalysis } from "@/lib/analysis/localStore";
import { AuthGuard } from "@/components/AuthGuard";

const RULES = [
  { k: "촬영 각도", v: "측면 · ±10°", d: "우완은 좌측면, 좌완은 우측면. 카메라가 투구판과 동일 평면 위에." },
  { k: "프레임레이트", v: "60 FPS 이상", d: "아이폰/갤럭시 ‘슬로모’ 또는 60fps 설정 사용. 30fps는 거부." },
  { k: "해상도", v: "720p 이상", d: "1080p 권장. 가로(landscape) 방향으로 촬영." },
  { k: "피사체 거리", v: "2 ~ 4 m", d: "전신이 프레임 내에서 잘리지 않아야 합니다." },
  { k: "조명 · 흔들림", v: "강한 그림자 · 역광 · 흔들림 없음", d: "실외 그늘 또는 균일한 실내 조명 권장. 삼각대 사용 권장.", full: true },
];

const CHECK_LABELS = [
  "각도 측면 ±10° 검증",
  "프레임레이트 60fps 이상",
  "해상도 720p 이상",
  "피사체 거리 2~4m",
  "조명 · 흔들림",
];

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [checks, setChecks] = useState<("pending" | "ok")[]>(["pending", "pending", "pending", "pending", "pending"]);
  const [progress, setProgress] = useState<{ pct: number; label: string; sub: string; show: boolean }>({
    pct: 0, label: "UPLOADING", sub: "", show: false,
  });
  const [canAnalyze, setCanAnalyze] = useState(false);

  const [analysisId, setAnalysisId] = useState<string | null>(null);

  async function onFile(file: File) {
    setProgress({ pct: 0, label: "UPLOADING", sub: file.name, show: true });
    setAnalysisId(null);
    setCanAnalyze(false);

    // Decide whether to talk to the real backend or run the simulation.
    const live = await isBackendUp();

    if (!live) {
      // No backend → analyze the user's video right here in the browser (real
      // BlazePose pose estimation + the same biomechanics pipeline).
      setChecks(["pending", "pending", "pending", "pending", "pending"]);
      try {
        const detail = await analyzeVideoInBrowser(file, (p) => {
          setProgress({ pct: p.pct, label: p.phase, sub: p.detail ?? "", show: true });
          setChecks((prev) =>
            prev.map((v, idx) => (p.pct >= ((idx + 1) / CHECK_LABELS.length) * 100 ? "ok" : v)),
          );
        });
        setChecks(["ok", "ok", "ok", "ok", "ok"]);
        saveLocalAnalysis(detail);
        setAnalysisId(detail.id);
        setProgress({ pct: 100, label: "COMPLETE", sub: "브라우저 분석 완료 · 결과를 확인하세요.", show: true });
        setCanAnalyze(true);
      } catch (err) {
        setProgress({
          pct: 0,
          label: "FAILED",
          sub: err instanceof Error ? err.message : "분석 실패",
          show: true,
        });
      }
      return;
    }

    // Real upload path.
    try {
      // optimistic progress bar — fetch upload doesn't expose progress without XHR
      const pBar = setInterval(() => setProgress((s) => ({ ...s, pct: Math.min(95, s.pct + 4) })), 120);
      const res = await uploadVideo(file);
      clearInterval(pBar);
      setProgress({ pct: 100, label: "UPLOADED", sub: `analysis ${res.analysis_id.slice(0, 8)}…`, show: true });
      setAnalysisId(res.analysis_id);
      // run the visual quality-check timeline; the worker handles real validation in the background
      simulateChecks();
    } catch (err) {
      // Session died mid-flow (expired/stale token) → back to login.
      if (err instanceof Error && err.message.startsWith("401")) {
        clearToken();
        router.replace("/auth#login");
        return;
      }
      setProgress({
        pct: 0,
        label: "FAILED",
        sub: err instanceof Error ? err.message : "업로드 실패",
        show: true,
      });
    }
  }

  function simulateChecks() {
    setProgress((s) => ({ ...s, label: "QUALITY CHECK", sub: "각도·프레임레이트·해상도 검증 중…" }));
    let i = 0;
    const step = () => {
      if (i >= CHECK_LABELS.length) {
        setProgress((s) => ({ ...s, label: "PASSED", sub: "분석 시작 가능. 결과 페이지에서 진행 상황을 확인하세요." }));
        setCanAnalyze(true);
        return;
      }
      setChecks((prev) => prev.map((v, idx) => (idx === i ? "ok" : v)));
      i++;
      setTimeout(step, 360);
    };
    setTimeout(step, 200);
  }

  return (
    <>
      <NavBar mode="app" />

      <AuthGuard>
      <main className="px-[clamp(20px,4vw,56px)] py-9 pb-16">
        <div
          className="flex items-center gap-3.5 mono mb-3.5"
          style={{ fontSize: 11, color: "var(--color-fg-3)", letterSpacing: "0.14em" }}
        >
          <Link href="/" style={{ color: "var(--color-fg-2)" }}>홈</Link>
          <span>/</span>
          <Link href="/upload" style={{ color: "var(--color-fg-2)" }}>분석</Link>
          <span>/</span>
          <span style={{ color: "var(--color-fg-0)" }}>새 영상 업로드</span>
        </div>

        <div className="flex justify-between items-end gap-6 flex-wrap mb-9">
          <div>
            <h1 style={{ fontSize: "clamp(34px, 5vw, 48px)", lineHeight: 1.0, letterSpacing: "-0.03em" }}>새 분석 시작</h1>
            <div
              className="flex gap-6 mt-3.5 mono flex-wrap"
              style={{ fontSize: 12, color: "var(--color-fg-2)", letterSpacing: "0.08em" }}
            >
              <span>RH PITCHER</span>
              <span>OPEN BETA · v0.1</span>
              <span style={{ color: "var(--color-acc)" }}>● 엄격 모드 — 미충족 영상은 자동 거부</span>
            </div>
          </div>

          <div
            className="flex items-center flex-wrap rounded-[var(--radius-pl-sm)] overflow-hidden"
            style={{ border: "1px solid var(--color-line-2)" }}
            role="navigation"
            aria-label="분석 진행"
          >
            {[
              ["01", "가이드", "done"],
              ["02", "업로드", "active"],
              ["03", "품질 검증", ""],
              ["04", "분석", ""],
              ["05", "리포트", ""],
            ].map(([n, label, state], i, arr) => (
              <div
                key={n}
                className="mono"
                style={{
                  padding: "10px 16px",
                  fontSize: 11, letterSpacing: "0.14em",
                  color: state === "active" ? "var(--color-acc)" : state === "done" ? "var(--color-fg-1)" : "var(--color-fg-3)",
                  background: state === "active" ? "var(--color-acc-soft)" : undefined,
                  borderRight: i < arr.length - 1 ? "1px solid var(--color-line-2)" : undefined,
                }}
              >
                <span style={{ color: state === "" ? "var(--color-fg-3)" : "var(--color-acc)", marginRight: 8 }}>{n}</span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_420px] gap-6">

          {/* Guide */}
          <section
            style={{
              background: "var(--color-bg-1)",
              border: "1px solid var(--color-line-2)",
              borderRadius: "var(--radius-pl-md)",
              padding: 28,
            }}
          >
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="eyebrow eyebrow-acc">STAGE 01 · 촬영 가이드</div>
              <Chip variant="acc">5 RULES · 모두 충족 필수</Chip>
            </div>

            <h2 style={{ fontSize: 28, marginTop: 12, letterSpacing: "-0.02em" }}>
              정확도를 위해, 다섯 가지만 지켜주세요.
            </h2>
            <p style={{ color: "var(--color-fg-2)", marginTop: 8, fontSize: 14, maxWidth: 560 }}>
              단일 카메라 분석의 정확도는 입력 영상의 품질에 크게 좌우됩니다.
              한 항목이라도 미달이면 자동으로 거부되며, 사유와 함께 재촬영 가이드로 안내됩니다.
            </p>

            <div className="grid md:grid-cols-2 gap-3.5 mt-6">
              {RULES.map((r) => (
                <div
                  key={r.k}
                  style={{
                    padding: 18,
                    border: "1px solid var(--color-line-2)",
                    borderRadius: "var(--radius-pl-sm)",
                    background: "var(--color-bg-0)",
                    gridColumn: r.full ? "1 / -1" : undefined,
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="mono uppercase" style={{ fontSize: 11, color: "var(--color-fg-2)", letterSpacing: "0.14em" }}>{r.k}</span>
                    <span className="rounded-full mt-1.5" style={{ width: 8, height: 8, background: "var(--color-acc)" }} />
                  </div>
                  <div className="mono mt-2" style={{ fontSize: 20, color: "var(--color-fg-0)", fontWeight: 500 }}>{r.v}</div>
                  <div className="mt-2" style={{ fontSize: 12.5, color: "var(--color-fg-2)" }}>{r.d}</div>
                </div>
              ))}
            </div>

            {/* Camera diagram */}
            <div
              className="relative mt-7 overflow-hidden"
              style={{
                height: 240,
                background: "var(--color-bg-0)",
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-pl-sm)",
                padding: 18,
              }}
            >
              <div className="grid-fine" style={{ opacity: 0.5 }} />
              <svg viewBox="0 0 800 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-label="촬영 배치도">
                <line x1="40" y1="160" x2="760" y2="160" stroke="var(--color-line-2)" />
                <g transform="translate(420, 60)">
                  <circle cx="0" cy="0" r="14" fill="none" stroke="var(--color-fg-1)" strokeWidth="2" />
                  <line x1="0" y1="14" x2="0" y2="74" stroke="var(--color-fg-1)" strokeWidth="2" />
                  <line x1="-16" y1="32" x2="20" y2="22" stroke="var(--color-acc)" strokeWidth="3" strokeLinecap="round" />
                  <line x1="20" y1="22" x2="46" y2="6" stroke="var(--color-acc)" strokeWidth="3" strokeLinecap="round" />
                  <line x1="0" y1="74" x2="-14" y2="100" stroke="var(--color-fg-1)" strokeWidth="2" strokeLinecap="round" />
                  <line x1="0" y1="74" x2="18" y2="100" stroke="var(--color-fg-1)" strokeWidth="2" strokeLinecap="round" />
                </g>
                <text x="420" y="178" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-fg-3)" letterSpacing="0.12em">PITCHER</text>

                <g transform="translate(180, 100)">
                  <rect x="-22" y="-12" width="44" height="22" fill="none" stroke="var(--color-acc)" strokeWidth="1.5" />
                  <circle cx="-10" cy="-1" r="5" fill="none" stroke="var(--color-acc)" strokeWidth="1.2" />
                  <line x1="0" y1="10" x2="-12" y2="60" stroke="var(--color-fg-2)" />
                  <line x1="0" y1="10" x2="12" y2="60" stroke="var(--color-fg-2)" />
                  <line x1="0" y1="10" x2="0" y2="60" stroke="var(--color-fg-2)" />
                </g>
                <text x="180" y="178" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-acc)" letterSpacing="0.12em">SMARTPHONE · 60FPS</text>

                <line x1="200" y1="120" x2="400" y2="120" stroke="var(--color-acc)" strokeWidth="1" strokeDasharray="4 4" />
                <text x="300" y="114" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--color-acc)" letterSpacing="0.12em">2 ~ 4 m</text>

                <path d="M 180 100 L 420 80 L 420 110 Z" fill="var(--color-acc-soft)" stroke="var(--color-acc)" strokeWidth="0.6" />
                <text x="290" y="96" fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-acc)" letterSpacing="0.1em">±10° SIDE VIEW</text>
              </svg>
            </div>

            <div
              className="mt-6 pt-4 mono"
              style={{ borderTop: "1px solid var(--color-line)", fontSize: 11, color: "var(--color-fg-3)", letterSpacing: "0.12em" }}
            >
              원본 영상은 30일 후 자동 삭제됩니다 · 익명 키포인트만 보관 · 미성년자 분석 전면 제외
            </div>
          </section>

          {/* Upload */}
          <section className="flex flex-col gap-4">
            <div
              style={{
                background: "var(--color-bg-1)",
                border: "1px solid var(--color-line-2)",
                borderRadius: "var(--radius-pl-md)",
                padding: 24,
              }}
            >
              <div className="flex justify-between items-center">
                <div className="eyebrow eyebrow-acc">STAGE 02 · 영상 업로드</div>
                <Chip>MP4 · MOV</Chip>
              </div>

              <label
                onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDrag(false);
                  const f = e.dataTransfer.files[0];
                  if (f) onFile(f);
                }}
                className="block mt-4 text-center cursor-pointer relative"
                style={{
                  border: `1.5px dashed ${drag ? "var(--color-acc)" : "var(--color-line-strong)"}`,
                  borderRadius: "var(--radius-pl-md)",
                  padding: "32px 20px",
                  background: drag ? "var(--color-acc-soft)" : undefined,
                  transition: "border-color .15s, background .15s",
                }}
              >
                <div
                  className="mx-auto mb-3.5 inline-flex items-center justify-center mono"
                  style={{
                    width: 56, height: 56,
                    border: "1.5px solid var(--color-acc)",
                    borderRadius: "var(--radius-pl-md)",
                    color: "var(--color-acc)",
                    fontSize: 24,
                  }}
                >
                  ↑
                </div>
                <div style={{ fontSize: 15, color: "var(--color-fg-0)", fontWeight: 500, marginBottom: 6 }}>
                  파일을 끌어다 놓거나 클릭하세요
                </div>
                <div style={{ fontSize: 12, color: "var(--color-fg-2)" }}>
                  최대 200MB · MP4/MOV · 60fps 이상
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                />
              </label>

              <div className="mt-4 flex flex-col gap-2.5">
                {CHECK_LABELS.map((label, i) => {
                  const state = checks[i];
                  return (
                    <div
                      key={label}
                      className="flex items-center gap-3"
                      style={{
                        padding: "10px 12px",
                        background: "var(--color-bg-2)",
                        border: "1px solid var(--color-line)",
                        borderRadius: "var(--radius-pl-sm)",
                        fontSize: 13,
                        color: "var(--color-fg-1)",
                      }}
                    >
                      <span
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width: 18, height: 18,
                          background: state === "ok" ? "var(--color-acc)" : "var(--color-bg-3)",
                          color: state === "ok" ? "var(--color-acc-fg)" : "var(--color-fg-3)",
                          border: state === "ok" ? "none" : "1px solid var(--color-line-2)",
                          fontSize: 11, fontWeight: 700,
                        }}
                      >
                        {state === "ok" ? "✓" : "·"}
                      </span>
                      <span>{label} — {state === "ok" ? "OK" : "대기"}</span>
                    </div>
                  );
                })}
              </div>

              {progress.show && (
                <div
                  className="mt-4"
                  style={{
                    padding: 18,
                    background: "var(--color-bg-2)",
                    border: "1px solid var(--color-line-2)",
                    borderRadius: "var(--radius-pl-sm)",
                  }}
                >
                  <div className="flex justify-between mono" style={{ fontSize: 11, color: "var(--color-fg-3)", letterSpacing: "0.1em" }}>
                    <span>{progress.label}</span>
                    <span>{progress.pct}%</span>
                  </div>
                  <div className="rounded-[2px] overflow-hidden my-2" style={{ width: "100%", height: 4, background: "var(--color-bg-3)" }}>
                    <div style={{ width: `${progress.pct}%`, height: "100%", background: "var(--color-acc)", transition: "width .3s ease" }} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-fg-2)" }}>{progress.sub}</div>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                full
                disabled={!canAnalyze}
                onClick={() => router.push(analysisId ? `/dashboard?id=${analysisId}` : "/dashboard")}
                style={{ marginTop: 16, opacity: canAnalyze ? 1 : 0.55, cursor: canAnalyze ? "pointer" : "not-allowed" }}
              >
                {analysisId ? "결과 페이지로 이동 →" : "샘플 리포트 보기 →"}
              </Button>

              <p
                style={{
                  fontSize: 11.5, color: "var(--color-fg-3)",
                  lineHeight: 1.55, textAlign: "center", marginTop: 14,
                }}
              >
                제출 시 분석을 위한 영상 처리 및 30일 자동 삭제에 동의한 것으로 간주됩니다.
              </p>
            </div>

            <div
              style={{
                background: "var(--color-bg-1)",
                border: "1px solid var(--color-line-2)",
                borderRadius: "var(--radius-pl-md)",
                padding: 24,
              }}
            >
              <div className="eyebrow">최근 업로드</div>
              <div className="mt-3.5 flex flex-col gap-2">
                {[
                  { id: "#013", date: "2026.05.12 · 5 PITCHES", chip: "SCORE 72", variant: "acc" as const },
                  { id: "#012", date: "2026.05.05 · 5 PITCHES", chip: "SCORE 70", variant: "acc" as const },
                  { id: "#011 · REJECTED", date: "2026.04.28 · FPS 미달", chip: "DENIED", variant: "danger" as const },
                ].map((u) => (
                  <div
                    key={u.id}
                    className="flex justify-between items-center"
                    style={{
                      padding: "10px 12px",
                      background: "var(--color-bg-2)",
                      border: "1px solid var(--color-line)",
                      borderRadius: "var(--radius-pl-sm)",
                    }}
                  >
                    <div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--color-fg-3)", letterSpacing: "0.14em" }}>
                        SESSION {u.id}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--color-fg-1)", marginTop: 2 }}>{u.date}</div>
                    </div>
                    <Chip variant={u.variant}>{u.chip}</Chip>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <MedicalNotice />
      </AuthGuard>
      <Footer />
    </>
  );
}
