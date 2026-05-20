import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { Chip } from "@/components/Chip";
import { ButtonLink } from "@/components/Button";
import { SectionHead } from "@/components/SectionHead";
import { PitcherFigure } from "@/components/PitcherFigure";

const PIPELINE = [
  ["S1", "품질 검증", "촬영 각도·해상도·프레임레이트 자동 점검. 미달 시 분석 거부."],
  ["S2", "2D 포즈 추정", "BlazePose Heavy로 프레임별 33개 키포인트 추출."],
  ["S3", "3D 리프팅", "MotionBERT로 단일 카메라 영상에서 깊이 정보 복원."],
  ["S4", "키프레임 검출", "손목 속도 피크 + 발 접지 신호로 릴리스 시점 자동 추정."],
  ["S5", "지표 산출", "상체·하체 8종 지표 — MER, Elbow Height, ER Velocity, X-Factor, Pelvis Vel 등."],
  ["S6", "점수화", "z-score 정규화 → KineticScore (0–100) 및 구간별 점수."],
  ["S7", "LLM 코멘트", "수치 → 한국어 자연어 코멘트. 의료 필터 통과 후 출력."],
  ["S8", "렌더링", "스켈레톤 오버레이 영상 + 추천 드릴 1~3개."],
];

const COMPARE_ROWS = [
  ["가격", "연 수백만 원~", "사실상 무료", "오픈 베타 · 무료"],
  ["촬영 환경", "전용 케이지·센서", "불안정", "스마트폰 + 가이드"],
  ["분석 방식", "멀티 카메라 절대값", "주관적 시각 판단", "유사 3D · 상대 비교"],
  ["피드백", "수치 위주", "코치 의존", "수치 + LLM 코멘트"],
  ["언어", "영어 중심", "—", "한국어 1차"],
  ["재방문", "코치 일정 필요", "랜덤", "히스토리 자동 누적"],
];

export default function Landing() {
  return (
    <>
      <NavBar mode="public" />

      {/* HERO */}
      <section
        className="relative"
        style={{
          padding: "60px clamp(20px, 4vw, 56px) 80px",
          borderBottom: "1px solid var(--color-line)",
        }}
      >
        <span className="crosshair" style={{ top: 24, left: 24 }} />
        <span className="crosshair" style={{ top: 24, right: 24 }} />

        <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="flex gap-3 items-center mb-9 flex-wrap">
              <Chip variant="acc" dot>OPEN BETA · v0.1</Chip>
              <Chip>UPPER + LOWER KINETIC CHAIN</Chip>
              <Chip>단일 카메라 · 60FPS</Chip>
            </div>

            <h1
              style={{
                fontSize: "clamp(48px, 8vw, 108px)",
                lineHeight: 0.92,
                letterSpacing: "-0.045em",
                marginBottom: 32,
              }}
            >
              당신의 투구는<br />
              어디서<br />
              <span style={{ color: "var(--color-acc)", fontStyle: "italic", fontWeight: 500 }}>
                새고 있는가.
              </span>
            </h1>

            <p
              style={{
                fontSize: 18,
                lineHeight: 1.55,
                color: "var(--color-fg-1)",
                maxWidth: 520,
                marginBottom: 48,
              }}
            >
              스마트폰 영상 한 편으로 상체와 골반의 운동연쇄를 함께 정량 분석합니다.
              프로 표준 분포와 생체역학 이상 모델 두 축으로,
              에너지가 손실되는 정확한 시점을 짚어냅니다.
            </p>

            <div className="flex gap-3 mb-16 flex-wrap">
              <ButtonLink href="/auth" variant="primary" size="lg">
                무료로 분석 시작
                <span className="mono" style={{ fontSize: 12, opacity: 0.7 }}>→</span>
              </ButtonLink>
              <ButtonLink href="/upload" variant="ghost" size="lg">
                촬영 가이드 보기
              </ButtonLink>
            </div>

            <div
              className="grid grid-cols-2 sm:grid-cols-4"
              style={{
                borderTop: "1px solid var(--color-line-2)",
                borderBottom: "1px solid var(--color-line-2)",
              }}
            >
              {[
                ["분석 지표", "8", "상체 5 + 하체 3"],
                ["키포인트", "33", "BlazePose Heavy"],
                ["키프레임", "4", "릴리스 ±0.30s"],
                ["평균 처리", "94s", "비동기 큐"],
              ].map(([k, v, sub], i, arr) => (
                <div
                  key={k}
                  style={{
                    padding: "20px 18px",
                    borderRight: i < arr.length - 1 ? "1px solid var(--color-line)" : undefined,
                  }}
                >
                  <div className="eyebrow" style={{ marginBottom: 8 }}>{k}</div>
                  <div className="mono" style={{ fontSize: 28, color: "var(--color-fg-0)", fontWeight: 500 }}>{v}</div>
                  <div style={{ fontSize: 11, color: "var(--color-fg-3)", marginTop: 2 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="relative"
            style={{
              minHeight: 680,
              background: "var(--color-bg-1)",
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius-pl-md)",
              backgroundImage: "radial-gradient(circle at 30% 30%, rgba(198,255,58,0.05), transparent 60%)",
              overflow: "hidden",
            }}
          >
            <div className="grid-fine" style={{ opacity: 0.5 }} />
            <div
              className="absolute mono flex gap-3.5 flex-wrap"
              style={{ top: 14, left: 14, fontSize: 10, color: "var(--color-fg-2)", letterSpacing: "0.12em" }}
            >
              <span style={{ color: "var(--color-acc)" }}>● REC</span>
              <span>SUBJECT 0142</span>
              <span>RH PITCHER</span>
              <span>SIDE VIEW · 60 FPS</span>
            </div>
            <div
              className="absolute mono"
              style={{ top: 14, right: 14, fontSize: 10, color: "var(--color-fg-2)", letterSpacing: "0.12em" }}
            >
              T = −0.150s · COCKING
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ width: "min(500px, 90%)" }}>
                <PitcherFigure pose="cocking" />
              </div>
            </div>

            <div
              className="absolute"
              style={{
                top: 120, right: 24, width: 160,
                background: "var(--color-bg-2)", border: "1px solid var(--color-acc)",
                padding: 12, borderRadius: "var(--radius-pl-sm)",
              }}
            >
              <div className="eyebrow eyebrow-acc">MER</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: "var(--color-acc)", marginTop: 4 }}>172.4°</div>
              <div style={{ fontSize: 11, color: "var(--color-fg-2)", marginTop: 4 }}>최대 외전각 — 정상범위</div>
            </div>
            <div
              className="absolute"
              style={{
                bottom: 100, left: 24, width: 170,
                background: "var(--color-bg-2)", border: "1px solid rgba(255,90,74,0.5)",
                padding: 12, borderRadius: "var(--radius-pl-sm)",
              }}
            >
              <div className="eyebrow" style={{ color: "var(--color-danger)" }}>ELBOW HEIGHT</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: "var(--color-danger)", marginTop: 4 }}>−4.1°</div>
              <div style={{ fontSize: 11, color: "var(--color-fg-2)", marginTop: 4 }}>견봉선 대비 낮음 · 부상 인자</div>
            </div>
          </div>
        </div>
      </section>

      {/* PRINCIPLE STRIP */}
      <section
        aria-hidden
        className="overflow-hidden mono"
        style={{
          padding: "32px clamp(20px, 4vw, 56px)",
          borderBottom: "1px solid var(--color-line)",
          fontSize: 13,
          color: "var(--color-fg-2)",
          letterSpacing: "0.18em",
        }}
      >
        <div className="marquee-track">
          {Array.from({ length: 2 }).flatMap((_, r) => [
            <span key={`a-${r}`}>KINETIC CHAIN ANALYSIS</span>,
            <span key={`b-${r}`} style={{ color: "var(--color-acc)" }}>◆</span>,
            <span key={`c-${r}`}>SINGLE CAMERA · QUASI-3D</span>,
            <span key={`d-${r}`} style={{ color: "var(--color-acc)" }}>◆</span>,
            <span key={`e-${r}`}>BLAZEPOSE GHUM + MOTIONBERT</span>,
            <span key={`f-${r}`} style={{ color: "var(--color-acc)" }}>◆</span>,
            <span key={`g-${r}`}>ASMI · MLB BIOMECH STANDARDS</span>,
            <span key={`h-${r}`} style={{ color: "var(--color-acc)" }}>◆</span>,
            <span key={`i-${r}`}>LLM CONTEXTUAL COACHING</span>,
            <span key={`j-${r}`} style={{ color: "var(--color-acc)" }}>◆</span>,
          ])}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: "100px clamp(20px, 4vw, 56px)", borderBottom: "1px solid var(--color-line)" }}>
        <SectionHead
          index="01 / HOW"
          eyebrow="THE PIPELINE"
          title="촬영부터 코칭까지 8단계."
          blurb="원본 영상은 30일 후 자동 삭제됩니다. 익명 키포인트만 모델 개선에 활용합니다."
        />

        <div
          className="grid grid-cols-2 lg:grid-cols-4 mt-16"
          style={{ border: "1px solid var(--color-line-2)" }}
        >
          {PIPELINE.map(([n, t, d], i) => (
            <div
              key={n}
              style={{
                padding: "28px 22px",
                minHeight: 180,
                borderRight: (i + 1) % 4 !== 0 ? "1px solid var(--color-line)" : undefined,
                borderBottom: i < 4 ? "1px solid var(--color-line)" : undefined,
                background: i === 5 ? "var(--color-bg-1)" : "transparent",
              }}
            >
              <div className="mono" style={{ fontSize: 11, color: "var(--color-acc)", letterSpacing: "0.18em" }}>{n}</div>
              <h3 style={{ fontSize: 20, marginTop: 18, marginBottom: 8 }}>{t}</h3>
              <p style={{ fontSize: 13, color: "var(--color-fg-2)", lineHeight: 1.5, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARE */}
      <section id="science" style={{ padding: "100px clamp(20px, 4vw, 56px)", borderBottom: "1px solid var(--color-line)" }}>
        <SectionHead
          index="02 / DIFFERENCE"
          eyebrow="VS THE FIELD"
          title="장비 없이도 충분히 정확한 비교."
        />

        <table
          className="mt-14 w-full"
          style={{ borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-line-2)" }}>
              {[" ", "RAPSODO / K-MOTION", "SMARTPHONE + 코치", "PITCHLAB"].map((h, i) => (
                <th
                  key={h + i}
                  className="mono uppercase text-left"
                  style={{
                    padding: "16px 18px",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    color: i === 3 ? "var(--color-acc)" : "var(--color-fg-2)",
                    background: i === 3 ? "var(--color-acc-soft)" : "transparent",
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: "1px solid var(--color-line)" }}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: 18,
                      color: ci === 0 ? "var(--color-fg-2)" : ci === 3 ? "var(--color-fg-0)" : "var(--color-fg-1)",
                      fontFamily: ci === 0 ? "var(--font-mono)" : "var(--font-body)",
                      fontSize: ci === 0 ? 11 : 14,
                      letterSpacing: ci === 0 ? "0.14em" : "normal",
                      textTransform: ci === 0 ? "uppercase" : undefined,
                      background: ci === 3 ? "var(--color-acc-soft)" : undefined,
                      borderLeft: ci === 3 ? "1px solid var(--color-acc)" : undefined,
                      borderRight: ci === 3 ? "1px solid var(--color-acc)" : undefined,
                      fontWeight: ci === 3 ? 500 : 400,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* FINAL CTA */}
      <section id="beta" className="relative" style={{ padding: "120px clamp(20px, 4vw, 56px) 60px" }}>
        <div style={{ maxWidth: 880 }}>
          <div className="eyebrow eyebrow-acc" style={{ marginBottom: 18 }}>BETA · 무료</div>
          <h2 style={{ fontSize: "clamp(48px, 7vw, 80px)", lineHeight: 0.95, letterSpacing: "-0.04em", marginBottom: 32 }}>
            첫 분석은<br />
            <span style={{ color: "var(--color-acc)" }}>오늘.</span>
          </h2>
          <p style={{ fontSize: 17, color: "var(--color-fg-1)", maxWidth: 560, marginBottom: 36 }}>
            만 18세 이상이면 회원가입 후 바로 분석을 받아볼 수 있습니다.
            촬영 가이드를 충족한 영상만 분석합니다.
          </p>
          <div className="flex gap-3 flex-wrap">
            <ButtonLink href="/auth" variant="primary" size="lg">회원가입 · 무료</ButtonLink>
            <ButtonLink href="/dashboard" variant="ghost" size="lg">샘플 리포트 보기</ButtonLink>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
