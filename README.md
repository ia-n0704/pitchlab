# PitchLab

**AI 기반 투구 동작 생체역학 분석 플랫폼**
*Upper + Lower Body Kinetic Chain Analyzer · Open Beta v0.1*

스마트폰으로 촬영한 단일 카메라 영상만으로 투구 동작의 상체·골반 운동연쇄(Kinetic Chain)를
정량 분석하고, 어디서 에너지가 새고 있는지를 수치로 보여준 뒤,
LLM이 개인 맞춤 코멘트와 추천 훈련을 설명해 주는 웹 플랫폼입니다.

## 기술 스택 (현재 구현 범위)

| 계층 | 사용 기술 | 상태 |
|---|---|---|
| 프레임워크 | **Next.js 16 (App Router) + TypeScript** | ✅ |
| 스타일 | **Tailwind CSS v4** (`@theme` 토큰) + 커스텀 CSS 변수 | ✅ |
| 차트 | **Recharts 3** (히스토리 차트) + 인라인 SVG (스켈레톤·게이지·메트릭) | ✅ |
| 폰트 | Space Grotesk · Pretendard · JetBrains Mono | ✅ |
| 백엔드 | FastAPI · Celery · Redis | ❌ mock 데이터 |
| ML | MediaPipe BlazePose Heavy + MotionBERT 3D | ❌ 정적 키프레임 보간 |
| LLM | Anthropic Claude API | ❌ 코멘트 하드코딩 |
| 스토리지 | R2 + Postgres + Redis | ❌ |

본 리포지토리는 **프론트엔드 프로토타입**입니다. 백엔드/ML 파이프라인은 기획서 §10 로드맵의 M1~M3 단계에 해당합니다.

## 라우트

| 경로 | 페이지 | 설명 |
| --- | --- | --- |
| `/` | 랜딩 | Hero · 8단계 파이프라인 · 비교표 · CTA |
| `/auth` | 가입/로그인 | 18+ 확인 · 동의 분리 · OAuth 슬롯 · `#login` 해시로 모드 전환 |
| `/upload` | 업로드 | 5가지 촬영 가이드 · 드롭존 · 품질 검증 시뮬레이션 |
| `/dashboard` | 분석 리포트 | KineticScore · 상체 5종 + 하체 3종 지표 · 운동연쇄 6분절 흐름 · 애니메이션 스켈레톤 오버레이 · LLM 코멘트 · 추천 드릴 · Recharts 히스토리 |

## 분석 지표 8종

**상체 (5종)** — `STAGE 02-A`
1. **MER** — 최대 외전각 (NORM 165–185°)
2. **Elbow Height** — 릴리스 시 견봉 대비 (NORM 0~+5°)
3. **ER Velocity** — 어깨 외회전 각속도 (NORM 6,500–8,000°/s)
4. **Trunk Tilt** — 릴리스 시 체간 측방 기울기 (NORM 20–35°)
5. **Release Consistency** — 5구 표준편차 (NORM ≤ 3 cm)

**하체 / 골반 (3종)** — `STAGE 02-B`
6. **X-Factor** — 골반-어깨 분리각 (NORM 40–55°)
7. **Pelvis Velocity** — 골반 회전 각속도 (NORM 500–700°/s)
8. **Stride Length** — 스트라이드 길이 (NORM 80–95% body height)

## 운동연쇄 에너지 흐름

`STRIDE → PELVIS → TRUNK → SHOULDER → ELBOW → RELEASE` 6분절 전달 효율을 시각화 (`STAGE 03`).
누적 전달 효율을 프로 표준 코호트 평균과 비교합니다.

## 애니메이션 스켈레톤 오버레이

대시보드의 `STAGE 01`은 4개 키프레임(windup → cocking → release → follow) 사이를
선형 보간으로 1.8초 주기에 재생합니다 (`AnimatedSkeleton.tsx`).
라벨(MER · ELBOW · X-FACTOR)이 관절을 따라 움직이며 값도 프레임마다 갱신됩니다.
스크러버, 재생/일시정지, 속도(0.125×/0.25×/0.5×/1×), 타임라인 클릭 시킹 동작.

## 정책

- **만 18세 이상**만 가입 가능 (데이터·법무 정책)
- 원본 영상은 **30일 후 자동 삭제**
- 익명화된 키포인트 좌표만 모델 개선에 활용
- 의료 진단·치료 도구가 **아님** (모든 결과 화면 하단에 고지 노출)

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

빌드:

```bash
npm run build
npm start
```

> **참고**: Turbopack은 현재 경로에 비-ASCII 문자(한글 등)가 포함되면 패닉하는 버그가 있어
> `--webpack` 플래그로 강제 빌드합니다 (v16.2.6 기준).

## 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx          # 메타데이터·폰트·전역 레이아웃
│   ├── page.tsx            # 랜딩
│   ├── globals.css         # @theme 토큰 + 유틸리티 클래스
│   ├── auth/page.tsx       # 가입/로그인
│   ├── upload/page.tsx     # 업로드 + 품질 검증 시뮬레이션
│   └── dashboard/page.tsx  # 분석 리포트
├── components/
│   ├── NavBar.tsx          # 공통 네비
│   ├── Logo.tsx
│   ├── Chip.tsx · Button.tsx · SectionHead.tsx
│   ├── Footer.tsx          # Footer + MedicalNotice
│   ├── PitcherFigure.tsx   # 정적 SVG (랜딩·auth)
│   ├── AnimatedSkeleton.tsx # 키프레임 보간 client component
│   ├── ScoreGauge.tsx
│   ├── MetricCard.tsx
│   └── HistoryChart.tsx    # Recharts AreaChart
└── data/
    └── metrics.ts          # mock 8 metrics + chain + leaks + drills
```

## 라이선스

학교 과제로 작성됨 (디미고 컴퓨터개론 과제2 · 2026.05).
