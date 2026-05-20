import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { Footer, MedicalNotice } from "@/components/Footer";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import { ScoreGauge } from "@/components/ScoreGauge";
import { MetricCard } from "@/components/MetricCard";
import { AnimatedSkeleton } from "@/components/AnimatedSkeleton";
import { HistoryChart } from "@/components/HistoryChart";
import { UPPER_METRICS, LOWER_METRICS, CHAIN_SEGMENTS, LEAKS, DRILLS } from "@/data/metrics";

export default function DashboardPage() {
  return (
    <>
      <NavBar mode="app" />

      {/* Report header */}
      <header
        className="px-[clamp(20px,4vw,56px)] py-9 pb-6"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div
          className="flex items-center gap-3.5 mono mb-3.5"
          style={{ fontSize: 11, color: "var(--color-fg-3)", letterSpacing: "0.14em" }}
        >
          <Link href="#" style={{ color: "var(--color-fg-2)" }}>분석</Link>
          <span>/</span>
          <Link href="#" style={{ color: "var(--color-fg-2)" }}>히스토리</Link>
          <span>/</span>
          <span style={{ color: "var(--color-fg-0)" }}>SESSION #014</span>
        </div>

        <div className="flex justify-between items-end gap-6 flex-wrap">
          <div>
            <h1 style={{ fontSize: "clamp(34px, 5vw, 48px)", lineHeight: 1.0, letterSpacing: "-0.03em" }}>
              분석 리포트 <span style={{ color: "var(--color-fg-3)" }}>#014</span>
            </h1>
            <div
              className="flex gap-6 mt-3.5 mono flex-wrap"
              style={{ fontSize: 12, color: "var(--color-fg-2)", letterSpacing: "0.08em" }}
            >
              <span>2026.05.19 · 14:32</span>
              <span>RH PITCHER</span>
              <span>SIDE VIEW · 60FPS · 1080P</span>
              <span>5 PITCHES · 8 INDICATORS</span>
              <span style={{ color: "var(--color-acc)" }}>● ANALYZED OK</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" size="sm">PDF 내보내기</Button>
            <Button variant="ghost" size="sm">공유 링크</Button>
            <Button variant="primary" size="sm">이전 분석과 비교</Button>
          </div>
        </div>
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
          <AnimatedSkeleton />
        </div>

        <div className="p-7 pl-7" style={{ background: "var(--color-bg-1)" }}>
          <div className="eyebrow mb-4">KINETICSCORE · v0.1</div>

          <div className="flex justify-center mb-4">
            <ScoreGauge size={260} value={78} />
          </div>

          <div
            className="grid grid-cols-2 mb-5"
            style={{
              gap: 1, background: "var(--color-line)",
              border: "1px solid var(--color-line-2)",
            }}
          >
            <div className="p-4" style={{ background: "var(--color-bg-1)" }}>
              <div className="eyebrow">PRO 분포 대비</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: "var(--color-fg-0)", marginTop: 4 }}>
                78<span style={{ color: "var(--color-fg-3)", fontSize: 13 }}>/100</span>
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--color-acc)", marginTop: 4, letterSpacing: "0.1em" }}>
                ↑ +6 vs LAST
              </div>
            </div>
            <div className="p-4" style={{ background: "var(--color-bg-1)" }}>
              <div className="eyebrow">이상 모델 거리</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: "var(--color-fg-0)", marginTop: 4 }}>
                13.2%<span style={{ color: "var(--color-fg-3)", fontSize: 13 }}> RMSE</span>
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--color-danger)", marginTop: 4, letterSpacing: "0.1em" }}>
                ↑ +2.1 vs LAST
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
              <div className="eyebrow eyebrow-acc">LLM 코멘트</div>
              <span className="mono" style={{ fontSize: 10, color: "var(--color-fg-3)", letterSpacing: "0.12em" }}>FILTER · OK</span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-fg-0)", margin: 0 }}>
              <span style={{ color: "var(--color-acc)" }}>어깨 외회전 각속도(7,214 deg/s)</span>는 프로 평균에 안정적으로 진입했어요.
              다만 <span style={{ color: "var(--color-warn)" }}>골반–어깨 분리(X-Factor)가 38°</span>로 정상범위(40–55°) 아래라
              상체가 먼저 열리고 있어요. 그 결과 <span style={{ color: "var(--color-danger)" }}>골반 → 트렁크 전달 효율이 79%까지 떨어졌고</span>,
              이어서 릴리스 시 <span style={{ color: "var(--color-danger)" }}>팔꿈치도 견봉선보다 4.1° 낮게</span> 빠져
              코킹→가속 구간에서 약 <span style={{ color: "var(--color-danger)" }}>12%의 에너지가 추가로 손실</span>됩니다.
              하체에서 만든 회전력이 상체로 충분히 누적되지 않은 채 팔만 휘두르는 패턴이에요.
            </p>
          </div>
        </div>
      </section>

      {/* Upper body metrics */}
      <section className="px-[clamp(20px,4vw,56px)] py-8">
        <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
          <div className="eyebrow">STAGE 02-A · UPPER BODY METRICS · 05 / 05</div>
          <div className="flex gap-2">
            <Chip variant="acc">3 OK</Chip>
            <Chip variant="danger">2 ALERT</Chip>
          </div>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
          style={{ gap: 1, background: "var(--color-line)", border: "1px solid var(--color-line-2)" }}
        >
          {UPPER_METRICS.map((m) => <MetricCard key={m.n} m={m} />)}
        </div>

        {/* Lower body metrics */}
        <div className="flex justify-between items-center mt-10 mb-5 flex-wrap gap-2">
          <div className="eyebrow">STAGE 02-B · LOWER BODY · PELVIS · 03 / 03</div>
          <div className="flex gap-2">
            <Chip variant="acc">2 OK</Chip>
            <Chip variant="danger">1 ALERT</Chip>
          </div>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{ gap: 1, background: "var(--color-line)", border: "1px solid var(--color-line-2)" }}
        >
          {LOWER_METRICS.map((m) => <MetricCard key={m.n} m={m} />)}
        </div>
      </section>

      {/* Energy + drills */}
      <section className="grid lg:grid-cols-[1.4fr_1fr] gap-6 px-[clamp(20px,4vw,56px)] pb-8">

        {/* Energy panel */}
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

          {/* Energy curve chart */}
          <div
            className="relative"
            style={{
              height: 200,
              border: "1px solid var(--color-line)",
              padding: "14px 18px",
              background: "var(--color-bg-0)",
            }}
          >
            <div
              className="absolute"
              style={{
                left: 18, right: 18,
                top: "30%", height: "40%",
                background: "var(--color-acc-soft)",
                borderTop: "1px dashed var(--color-acc)",
                borderBottom: "1px dashed var(--color-acc)",
              }}
            />
            <svg viewBox="0 0 700 170" width="100%" height="170" preserveAspectRatio="none" style={{ display: "block" }}>
              <path d="M 0 130 Q 100 110, 200 90 T 360 30 Q 480 70, 560 100 T 700 140" fill="none" stroke="var(--color-acc)" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />
              <path d="M 0 135 Q 110 115, 210 95 T 360 60 Q 410 90, 470 95 T 700 145" fill="none" stroke="var(--color-acc)" strokeWidth="2.5" />
              <path d="M 320 38 L 480 100 L 480 105 L 320 60 Z" fill="var(--color-danger)" opacity="0.18" />
              <line x1="380" y1="22" x2="380" y2="60" stroke="var(--color-danger)" strokeWidth="1" />
              <circle cx="380" cy="60" r="4" fill="var(--color-danger)" />
            </svg>
            <div
              className="absolute mono"
              style={{
                left: "52%", top: "4%",
                padding: "6px 10px",
                background: "var(--color-bg-2)",
                border: "1px solid var(--color-danger)",
                fontSize: 11,
                color: "var(--color-danger)",
              }}
            >
              −12% ENERGY · COCK→ACCEL
            </div>
          </div>

          <div
            className="flex justify-between mono px-4.5 pt-2.5"
            style={{ fontSize: 10, color: "var(--color-fg-3)", letterSpacing: "0.1em" }}
          >
            <span>WIND-UP</span><span>STRIDE</span><span>COCK</span>
            <span style={{ color: "var(--color-acc)" }}>RELEASE</span>
            <span>DECEL</span><span>FOLLOW</span>
          </div>

          {/* Kinetic chain segments */}
          <div
            className="mt-5"
            style={{
              padding: "18px 20px",
              background: "var(--color-bg-0)",
              border: "1px solid var(--color-line)",
            }}
          >
            <div
              className="flex justify-between items-center mb-3.5 mono"
              style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--color-fg-3)" }}
            >
              <span>SEGMENT-BY-SEGMENT TRANSFER · GROUND → BALL</span>
              <span>EFFICIENCY %</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0.5">
              {CHAIN_SEGMENTS.map((seg, i) => {
                const colorMap = {
                  ok: "var(--color-acc)",
                  bad: "var(--color-danger)",
                  warn: "var(--color-warn)",
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
                    {i < CHAIN_SEGMENTS.length - 1 && (
                      <span
                        className="absolute"
                        style={{
                          top: "50%", right: -10, transform: "translateY(-50%)",
                          width: 0, height: 0,
                          borderTop: "6px solid transparent",
                          borderBottom: "6px solid transparent",
                          borderLeft: `8px solid ${seg.state === "bad" ? "var(--color-danger)" : "var(--color-line-strong)"}`,
                          zIndex: 2,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3.5" style={{ fontSize: 12.5, color: "var(--color-fg-2)", lineHeight: 1.55 }}>
              누적 전달 효율 <span className="mono" style={{ color: "var(--color-fg-0)" }}>59.4%</span> — 프로 표준 코호트 평균{" "}
              <span className="mono" style={{ color: "var(--color-acc)" }}>68.1%</span> 대비{" "}
              <span className="mono" style={{ color: "var(--color-danger)" }}>−8.7%p</span>.
              골반 회전과 팔꿈치 두 구간이 주된 손실 지점입니다.
            </div>
          </div>

          {/* Leak cards */}
          <div className="mt-4.5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {LEAKS.map((leak, i) => {
              const colorMap = {
                ok: "var(--color-acc)",
                bad: "var(--color-danger)",
                warn: "var(--color-warn)",
              };
              const color = colorMap[leak.state];
              return (
                <div
                  key={i}
                  style={{
                    padding: "14px 16px",
                    border: `1px solid ${color}`,
                    background: "var(--color-bg-2)",
                  }}
                >
                  <div className="mono" style={{ fontSize: 26, fontWeight: 500, color }}>{leak.v}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--color-fg-3)", letterSpacing: "0.12em", marginTop: 4 }}>{leak.p}</div>
                  <div style={{ fontSize: 12.5, color: "var(--color-fg-1)", marginTop: 6 }}>{leak.d}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drills */}
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
            {DRILLS.map((d) => (
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

      {/* History */}
      <section className="px-[clamp(20px,4vw,56px)] pb-12">
        <div
          style={{
            background: "var(--color-bg-1)",
            border: "1px solid var(--color-line-2)",
            borderRadius: "var(--radius-pl-md)",
            padding: 24,
          }}
        >
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="eyebrow">STAGE 05 · KINETICSCORE 14-SESSION HISTORY · RECHARTS</div>
            <div className="flex gap-2">
              <Chip>14 SESSIONS</Chip>
              <Chip variant="acc">+23 vs FIRST</Chip>
            </div>
          </div>
          <HistoryChart />
        </div>
      </section>

      <MedicalNotice extra="ORIGINAL VIDEO · 28 DAYS UNTIL AUTO-DELETE" />
      <Footer />
    </>
  );
}
