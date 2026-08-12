"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MedicalNotice } from "@/components/Footer";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import { ScoreGauge } from "@/components/ScoreGauge";
import { MetricCard } from "@/components/MetricCard";
import { AnimatedSkeleton } from "@/components/AnimatedSkeleton";
import { PoseSkeleton } from "@/components/PoseSkeleton";
import { HistoryChart } from "@/components/HistoryChart";
import { UPPER_METRICS, LOWER_METRICS, CHAIN_SEGMENTS, LEAKS, DRILLS, type Metric } from "@/data/metrics";
import { getAnalysis, listRecentAnalyses, type AnalysisDetail } from "@/lib/api";
import { isLocalId, loadLocalAnalysis } from "@/lib/analysis/localStore";
import { metricsFromApi, type Drill, type Leak } from "@/lib/adapt";
import type { HistoryPoint } from "@/components/HistoryChart";

type ChainSeg = { id: string; pct: number; state: "ok" | "warn" | "bad"; delta: string };

export function DashboardView() {
  const params = useSearchParams();
  const id = params.get("id");

  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [polling, setPolling] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);

  // Load analysis history for the chart
  useEffect(() => {
    listRecentAnalyses()
      .then((list) => {
        const pts: HistoryPoint[] = list
          .filter((a) => a.status === "completed" && a.kinetic_score !== null)
          .reverse()
          .map((a, i) => ({
            session: `#${String(i + 1).padStart(2, "0")}`,
            score: a.kinetic_score ?? 0,
          }));
        if (pts.length > 0) setHistoryData(pts);
      })
      .catch(() => {/* backend down — fall back to mock */});
  }, []);

  // Poll API when we have an id
  useEffect(() => {
    if (!id) return;

    // Locally-analyzed (in-browser) report — read it from sessionStorage, no polling.
    if (isLocalId(id)) {
      const local = loadLocalAnalysis(id);
      if (local) setDetail(local);
      else setErr("로컬 분석 결과를 찾을 수 없습니다. 영상을 다시 업로드해 주세요.");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    setPolling(true);
    const tick = async () => {
      try {
        const a = await getAnalysis(id);
        if (cancelled) return;
        setDetail(a);
        if (a.status === "queued" || a.status === "processing") {
          timer = setTimeout(tick, 1800);
        } else {
          setPolling(false);
        }
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "백엔드 연결 실패");
        setPolling(false);
      }
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  // ── derive what to render ──
  const usingApi = !!id;
  const adapted = detail && detail.status === "completed" ? metricsFromApi(detail) : null;

  const upperMetrics: Metric[] = adapted?.upper ?? UPPER_METRICS;
  const lowerMetrics: Metric[] = adapted?.lower ?? LOWER_METRICS;
  const chain: ChainSeg[] = adapted?.chain.length ? adapted.chain : (CHAIN_SEGMENTS as readonly ChainSeg[] as ChainSeg[]);
  const drills: Drill[] = adapted?.drills.length ? adapted.drills : (DRILLS as readonly Drill[] as Drill[]);
  const leaks: Leak[] = adapted?.leaks.length ? adapted.leaks : (LEAKS as readonly Leak[] as Leak[]);
  const score = adapted?.kineticScore ?? 78;
  const comment =
    adapted?.comment ||
    "어깨 외회전 각속도(7,214 deg/s)는 프로 평균에 안정적으로 진입했어요. 다만 골반–어깨 분리(X-Factor)가 38°로 정상범위(40–55°) 아래라 상체가 먼저 열리고 있어요. 그 결과 골반 → 트렁크 전달 효율이 79%까지 떨어졌고, 이어서 릴리스 시 팔꿈치도 견봉선보다 4.1° 낮게 빠져 코킹→가속 구간에서 약 12%의 에너지가 추가로 손실됩니다.";

  const okUpper = upperMetrics.filter((m) => m.ok).length;
  const okLower = lowerMetrics.filter((m) => m.ok).length;
  const sessionTag = id ? `SESSION ${id.slice(0, 8)}` : "SESSION SAMPLE";

  return (
    <>
      {/* Report header */}
      <header
        className="px-[clamp(20px,4vw,56px)] py-9 pb-6"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div
          className="flex items-center gap-3.5 mono mb-3.5"
          style={{ fontSize: 11, color: "var(--color-fg-3)", letterSpacing: "0.14em" }}
        >
          <Link href="/upload" style={{ color: "var(--color-fg-2)" }}>분석</Link>
          <span>/</span>
          <Link href="#" style={{ color: "var(--color-fg-2)" }}>히스토리</Link>
          <span>/</span>
          <span style={{ color: "var(--color-fg-0)" }}>{sessionTag}</span>
        </div>

        <div className="flex justify-between items-end gap-6 flex-wrap">
          <div>
            <h1 style={{ fontSize: "clamp(34px, 5vw, 48px)", lineHeight: 1.0, letterSpacing: "-0.03em" }}>
              분석 리포트 <span style={{ color: "var(--color-fg-3)" }}>{id ? `#${id.slice(0, 6)}` : "#sample"}</span>
            </h1>
            <div
              className="flex gap-6 mt-3.5 mono flex-wrap"
              style={{ fontSize: 12, color: "var(--color-fg-2)", letterSpacing: "0.08em" }}
            >
              {detail ? (
                <>
                  <span>{new Date(detail.created_at).toLocaleString("ko-KR")}</span>
                  <span>{detail.video_width && detail.video_height ? `${detail.video_width}×${detail.video_height}` : "DEMO MODE"}</span>
                  <span>{detail.video_fps ? `${detail.video_fps.toFixed(0)}FPS` : ""}</span>
                  <span>{detail.video_frames ? `${detail.video_frames} FRAMES` : ""}</span>
                  <span
                    style={{
                      color:
                        detail.status === "completed" ? "var(--color-acc)"
                          : detail.status === "rejected" ? "var(--color-danger)"
                          : detail.status === "failed" ? "var(--color-danger)"
                          : "var(--color-warn)",
                    }}
                  >
                    ● {detail.status.toUpperCase()}
                  </span>
                </>
              ) : (
                <>
                  <span>2026.05.20 · 샘플 리포트</span>
                  <span>RH PITCHER</span>
                  <span>SIDE VIEW · 60FPS · 1080P</span>
                  <span>5 PITCHES · 8 INDICATORS</span>
                  <span style={{ color: "var(--color-acc)" }}>● SAMPLE</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" size="sm">PDF 내보내기</Button>
            <Button variant="ghost" size="sm">공유 링크</Button>
            <Button variant="primary" size="sm">이전 분석과 비교</Button>
          </div>
        </div>

        {usingApi && (polling || err || detail?.status === "rejected" || detail?.status === "failed") && (
          <div
            className="mt-4 mono"
            style={{
              fontSize: 12,
              color:
                err || detail?.status === "rejected" || detail?.status === "failed" ? "var(--color-danger)" : "var(--color-warn)",
              letterSpacing: "0.1em",
              padding: "10px 14px",
              border: `1px solid ${err ? "var(--color-danger)" : "var(--color-warn)"}`,
              background: "var(--color-bg-1)",
              borderRadius: "var(--radius-pl-sm)",
            }}
          >
            {err
              ? `백엔드 연결 실패: ${err}`
              : detail?.status === "rejected"
              ? `분석 거부: ${detail.error_message ?? "품질 검증 미통과"}`
              : detail?.status === "failed"
              ? `분석 실패: ${detail.error_message ?? "내부 오류"}`
              : `분석 중… (status=${detail?.status ?? "loading"}). 평균 60~120초 소요됩니다.`}
          </div>
        )}
      </header>

      {/* Main grid */}
      <section
        className="grid lg:grid-cols-[1fr_420px]"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div
          className="px-[clamp(20px,4vw,56px)] py-6"
          style={{ borderRight: "1px solid var(--color-line)" }}
        >
          {adapted?.skeleton ? (
            <PoseSkeleton skeleton={adapted.skeleton} handedness={adapted.handedness} />
          ) : (
            <AnimatedSkeleton />
          )}
        </div>

        <div className="p-7 pl-7" style={{ background: "var(--color-bg-1)" }}>
          <div className="eyebrow mb-4">KINETICSCORE · v0.1</div>
          <div className="flex justify-center mb-4">
            <ScoreGauge size={260} value={score} />
          </div>

          <div
            className="grid grid-cols-2 mb-5"
            style={{ gap: 1, background: "var(--color-line)", border: "1px solid var(--color-line-2)" }}
          >
            <div className="p-4" style={{ background: "var(--color-bg-1)" }}>
              <div className="eyebrow">PRO 분포 대비</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: "var(--color-fg-0)", marginTop: 4 }}>
                {score}<span style={{ color: "var(--color-fg-3)", fontSize: 13 }}>/100</span>
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--color-acc)", marginTop: 4, letterSpacing: "0.1em" }}>
                {adapted ? "REAL DATA" : "↑ +6 vs LAST"}
              </div>
            </div>
            <div className="p-4" style={{ background: "var(--color-bg-1)" }}>
              <div className="eyebrow">이상 모델 거리</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: "var(--color-fg-0)", marginTop: 4 }}>
                {Math.max(0, 100 - score)}%<span style={{ color: "var(--color-fg-3)", fontSize: 13 }}> DEV</span>
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--color-fg-3)", marginTop: 4, letterSpacing: "0.1em" }}>
                z-score normalized
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--color-bg-2)",
              border: "1px solid var(--color-line-2)",
              borderRadius: "var(--radius-pl-sm)",
              padding: 18,
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="eyebrow eyebrow-acc">LLM 코멘트{adapted ? " · Claude" : ""}</div>
              <span className="mono" style={{ fontSize: 10, color: "var(--color-fg-3)", letterSpacing: "0.12em" }}>FILTER · OK</span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-fg-0)", margin: 0, whiteSpace: "pre-line" }}>
              {comment}
            </p>
          </div>
        </div>
      </section>

      {/* Upper body metrics */}
      <section className="px-[clamp(20px,4vw,56px)] py-8">
        <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
          <div className="eyebrow">STAGE 02-A · UPPER BODY METRICS · 05 / 05</div>
          <div className="flex gap-2">
            <Chip variant="acc">{okUpper} OK</Chip>
            <Chip variant="danger">{5 - okUpper} ALERT</Chip>
          </div>
        </div>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
          style={{ gap: 1, background: "var(--color-line)", border: "1px solid var(--color-line-2)" }}
        >
          {upperMetrics.map((m) => <MetricCard key={m.n} m={m} />)}
        </div>

        <div className="flex justify-between items-center mt-10 mb-5 flex-wrap gap-2">
          <div className="eyebrow">STAGE 02-B · LOWER BODY · PELVIS · 03 / 03</div>
          <div className="flex gap-2">
            <Chip variant="acc">{okLower} OK</Chip>
            <Chip variant="danger">{3 - okLower} ALERT</Chip>
          </div>
        </div>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{ gap: 1, background: "var(--color-line)", border: "1px solid var(--color-line-2)" }}
        >
          {lowerMetrics.map((m) => <MetricCard key={m.n} m={m} />)}
        </div>
      </section>

      {/* Energy chain + drills */}
      <section id="stage-drills" className="grid lg:grid-cols-[1.4fr_1fr] gap-6 px-[clamp(20px,4vw,56px)] pb-8">
        <div
          style={{
            background: "var(--color-bg-1)",
            border: "1px solid var(--color-line-2)",
            borderRadius: "var(--radius-pl-md)",
            padding: 24,
          }}
        >
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="eyebrow">STAGE 03 · 운동연쇄 에너지 흐름 · UPPER + LOWER</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--color-fg-3)", letterSpacing: "0.14em" }}>
              RELEASE ±0.30s
            </div>
          </div>

          <div
            className="mt-5"
            style={{ padding: "18px 20px", background: "var(--color-bg-0)", border: "1px solid var(--color-line)" }}
          >
            <div
              className="flex justify-between items-center mb-3.5 mono"
              style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--color-fg-3)" }}
            >
              <span>SEGMENT-BY-SEGMENT TRANSFER · GROUND → BALL</span>
              <span>EFFICIENCY %</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0.5">
              {chain.map((seg, i) => {
                const colorMap = {
                  ok: "var(--color-acc)", bad: "var(--color-danger)", warn: "var(--color-warn)",
                };
                const color = colorMap[seg.state];
                return (
                  <div
                    key={seg.id}
                    className="relative flex flex-col gap-1.5"
                    style={{
                      padding: "14px 10px 12px",
                      background: seg.state === "bad" ? "rgba(255,90,74,0.06)" : "var(--color-bg-1)",
                      border: `1px solid ${color}`,
                      minHeight: 92,
                    }}
                  >
                    <span className="mono" style={{ fontSize: 10, letterSpacing: "0.14em", color }}>
                      {String(i + 1).padStart(2, "0")} · {seg.id}
                    </span>
                    <span className="mono" style={{ fontSize: 22, fontWeight: 500, color: "var(--color-fg-0)" }}>
                      {seg.pct}
                      <small style={{ fontSize: 12, color: "var(--color-fg-3)" }}>%</small>
                    </span>
                    <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color }}>
                      {seg.delta}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3.5" style={{ fontSize: 12.5, color: "var(--color-fg-2)", lineHeight: 1.55 }}>
              누적 전달 효율{" "}
              <span className="mono" style={{ color: "var(--color-fg-0)" }}>
                {(chain.reduce((acc, s) => acc * (s.pct / 100), 1) * 100).toFixed(1)}%
              </span>{" "}
              — 프로 코호트 평균 <span className="mono" style={{ color: "var(--color-acc)" }}>68.1%</span> 대비.
            </div>
          </div>

          <div className="mt-4.5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {leaks.map((leak, i) => {
              const colorMap = { ok: "var(--color-acc)", bad: "var(--color-danger)", warn: "var(--color-warn)" };
              const color = colorMap[leak.state];
              return (
                <div key={i} style={{ padding: "14px 16px", border: `1px solid ${color}`, background: "var(--color-bg-2)" }}>
                  <div className="mono" style={{ fontSize: 26, fontWeight: 500, color }}>{leak.v}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--color-fg-3)", letterSpacing: "0.12em", marginTop: 4 }}>{leak.p}</div>
                  <div style={{ fontSize: 12.5, color: "var(--color-fg-1)", marginTop: 6 }}>{leak.d}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            background: "var(--color-bg-1)",
            border: "1px solid var(--color-line-2)",
            borderRadius: "var(--radius-pl-md)",
            padding: 24,
          }}
        >
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="eyebrow">STAGE 04 · 추천 드릴</div>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--color-fg-3)", letterSpacing: "0.14em" }}>EXPERT-CURATED</span>
          </div>

          <div className="flex flex-col gap-3">
            {drills.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: 16,
                  background: d.top ? "var(--color-acc-soft)" : "var(--color-bg-2)",
                  border: d.top ? "1px solid var(--color-acc)" : "1px solid var(--color-line-2)",
                }}
              >
                <div className="flex justify-between items-start">
                  <span className="mono" style={{ fontSize: 10.5, color: d.top ? "var(--color-acc)" : "var(--color-fg-1)", letterSpacing: "0.18em" }}>
                    DRILL · {d.id}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 9.5,
                      color: d.top ? "var(--color-acc-fg)" : "var(--color-fg-3)",
                      background: d.top ? "var(--color-acc)" : "transparent",
                      padding: d.top ? "2px 6px" : 0,
                      borderRadius: 2,
                      letterSpacing: "0.12em",
                    }}
                  >
                    {d.priority}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, color: "var(--color-fg-0)" }}>{d.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--color-fg-2)", marginTop: 4 }}>{d.desc}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--color-fg-3)", letterSpacing: "0.12em", marginTop: 10 }}>
                  {d.reps}
                </div>
              </div>
            ))}
          </div>

          <Button variant="ghost" full style={{ marginTop: 14 }}>
            전체 드릴 라이브러리 →
          </Button>
        </div>
      </section>

      <section id="stage-history" className="px-[clamp(20px,4vw,56px)] pb-12">
        <div
          style={{
            background: "var(--color-bg-1)",
            border: "1px solid var(--color-line-2)",
            borderRadius: "var(--radius-pl-md)",
            padding: 24,
          }}
        >
          {(() => {
            const realData = historyData.length > 0;
            const sessions = realData ? historyData.length : 14;
            const delta = realData && historyData.length >= 2
              ? historyData[historyData.length - 1].score - historyData[0].score
              : 23;
            return (
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div className="eyebrow">
                  STAGE 05 · KINETICSCORE {sessions}-SESSION HISTORY · RECHARTS
                </div>
                <div className="flex gap-2">
                  <Chip>{sessions} SESSIONS{realData ? " · REAL" : " · DEMO"}</Chip>
                  <Chip variant="acc">
                    {delta >= 0 ? "+" : ""}{delta} vs FIRST
                  </Chip>
                </div>
              </div>
            );
          })()}
          <HistoryChart data={historyData.length > 0 ? historyData : undefined} />
        </div>
      </section>

      <MedicalNotice extra={detail ? `ORIGINAL VIDEO · 30 DAYS UNTIL AUTO-DELETE` : "DEMO MODE — backend not connected"} />
    </>
  );
}
