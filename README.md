# PitchLab

**AI 기반 투구 동작 생체역학 분석 플랫폼**
*Upper + Lower Body Kinetic Chain Analyzer · Open Beta v0.1*

스마트폰으로 촬영한 단일 카메라 영상만으로 투구 동작의 상체·골반 운동연쇄(Kinetic Chain)를
정량 분석하고, 어디서 에너지가 새고 있는지를 수치로 보여준 뒤,
Claude API가 개인 맞춤 코멘트와 추천 훈련을 설명해 주는 풀스택 웹 플랫폼입니다.

## 기술 스택

| 계층 | 사용 기술 | 상태 |
|---|---|---|
| 프레임워크 | **Next.js 16 App Router + React 19 + TypeScript 5** | ✅ |
| 스타일 | **Tailwind CSS v4** + 커스텀 디자인 토큰 | ✅ |
| 차트 | **Recharts 3** (히스토리) + 인라인 SVG (스켈레톤·게이지·메트릭) | ✅ |
| 백엔드 API | **FastAPI 0.115 + Pydantic 2 + SQLAlchemy 2** | ✅ |
| 큐 | **Celery 5 + Redis 7** (비동기 분석 워커) | ✅ |
| 스토리지 | **Postgres 16** + 영상은 **로컬 fs** ↔ **Cloudflare R2** (env로 토글) | ✅ |
| 포즈 추정 (2D) | **ViTPose+ Large (HF transformers) + RT-DETR 사람 검출** — top-down SOTA. `POSE_BACKEND=mediapipe`로 경량 폴백 | ✅ |
| 지터 제거 | 저신뢰 구간 보간 + **Savitzky-Golay** 시간적 스무딩 (SmoothNet 방식의 경량 구현) | ✅ |
| 3D 리프팅 | MediaPipe BlazePose **GHUM world_landmarks** 사용 — 메트릭 계산 전용 (MotionBERT 교체 가능) | ⚠️ 대체 구현 |
| LLM 코칭 | **Anthropic Claude API** + 키 없을 시 템플릿 폴백 | ✅ |
| 컨테이너 | **Docker Compose** (db + redis + api + worker) | ✅ |

## 실행 — 한 줄

```bash
# (선택) Claude 코멘트를 실제로 사용하려면 .env에 API 키 설정
cp .env.example .env
# .env 파일을 열어 ANTHROPIC_API_KEY=sk-ant-... 채우기

# 백엔드 4개 서비스 한 번에
docker compose up --build

# 다른 터미널에서 프론트
npm install
npm run dev
```

- 프론트: http://localhost:3000
- API: http://localhost:8000 (Swagger UI: http://localhost:8000/docs)
- Postgres: localhost:5432 (pitchlab/pitchlab)
- Redis: localhost:6379

## 라우트 (Frontend)

| 경로 | 페이지 |
| --- | --- |
| `/` | 랜딩 — Hero · 8단계 파이프라인 · 비교표 · CTA |
| `/auth` | 가입 (18+) / 로그인 · `#login`으로 모드 전환 |
| `/upload` | **로그인 필요**(AuthGuard). 5가지 촬영 가이드 · 드래그·드롭 · 실제 백엔드 업로드. **백엔드 미실행 시 브라우저에서 직접 분석**(BlazePose 3D + 동일 파이프라인 포팅). 2단계 적응형 샘플링(구간 검출→릴리스 부근 고밀도) · One-Euro 지터 제거 · 속도 기반 페이즈 분할 |
| `/dashboard` | **로그인 필요**(AuthGuard). 분석 리포트 · `?id=<uuid>` 서버 분석 폴링 · `?id=local-…` 브라우저 분석 결과(sessionStorage) |

## API (Backend)

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/health` | 헬스체크 |
| `POST` | `/auth/signup` | 회원가입 (18+ 확인 + 동의 분리) → **미인증 계정 생성 + 인증코드 발송**. JWT 미발급 |
| `POST` | `/auth/verify` | 이메일 인증코드 확인 → 인증 완료 + JWT 발급 |
| `POST` | `/auth/resend` | 인증코드 재발송 |
| `POST` | `/auth/login` | 로그인 — **가입·인증 완료된 계정만** 성공. 미인증은 403 |
| `POST` | `/uploads` | 멀티파트 영상 업로드 → Celery 분석 큐 enqueue → `{analysis_id}` 반환 |
| `GET` | `/analyses` | 최근 분석 목록 |
| `GET` | `/analyses/{id}` | 분석 상세 (status / metrics / llm_comment) |

## 분석 파이프라인 (Worker)

> **두 가지 경로** — 백엔드 실행 시 아래 서버 파이프라인을 사용하고, 백엔드 미실행 시
> 프론트엔드가 **브라우저에서 직접** 분석합니다: `src/lib/analysis/runAnalysis.ts`가
> BlazePose(3D, `@tensorflow-models/pose-detection`)로 업로드 영상의 포즈를 추출하고,
> `src/lib/analysis/metrics.ts`(서버 `metrics.py`/`drills.py` 계산식 포팅)로 동일한 지표·
> KineticScore·운동연쇄·드릴·스켈레톤을 산출합니다. 결과는 sessionStorage에 저장되어
> `/dashboard?id=local-…`로 렌더됩니다. (LLM 코멘트는 템플릿 폴백 사용)

`backend/app/pipeline/analyze.py` 가 다음 단계를 순차 실행:

1. **품질 검증** (`quality.py`) — fps ≥ 55, 해상도 ≥ 720, frames ≥ 30. 미충족 시 `rejected`.
2. **2D + 3D 포즈** (`pose_hq.py`, 기본) — **하이브리드 융합**:
   - 2D image_xy: **RT-DETR 사람 검출 → ViTPose+ Large** top-down (`pose_vitpose.py`). 검출기는 `VITPOSE_DETECT_EVERY` 프레임마다 실행, 사이 프레임은 키포인트 기반 bbox 추적.
   - 3D world_xyz: MediaPipe BlazePose GHUM (기존 메트릭 수식 무변경). MediaPipe가 놓친 프레임(모션 블러 릴리스 등)은 이웃 프레임에서 보간해 유지.
   - 시간 정제: `smoothing.py` — 저신뢰 관절 보간 + Savitzky-Golay 필터로 지터 제거 (속도 피크 보존형이라 릴리스 검출에 안전).
   - torch/transformers 미설치·모델 로드 실패 시 자동으로 `pose.py`(MediaPipe 단독) 폴백.
3. **키프레임 검출** — 던지는 손 손목 속도 피크 = 릴리스 프레임.
4. **메트릭 계산** (`metrics.py`) — 8개 지표 (실제 벡터 연산):
   - MER, Elbow Height, ER Velocity, Trunk Tilt, Release Consistency
   - X-Factor, Pelvis Velocity, Stride Length
5. **KineticScore** — 8개 지표를 정상범위 대비 z-score → 가중합 (0-100).
6. **운동연쇄 효율** — 6분절 (STRIDE → PELVIS → TRUNK → SHOULDER → ELBOW → RELEASE) 전달 효율 합성.
7. **스켈레톤 오버레이 페이로드** — 2D 키포인트 트랙을 다운샘플(≤90프레임)·정규화(0~1, 종횡비 보존)하여 `metrics.skeleton`에 저장. 좌표·visibility만 보관(영상 없음 → §8 익명 키포인트 정책 충족). 대시보드가 이를 재생하며 실제 포즈를 오버레이.
8. **추천 드릴** (`llm/drills.py`) — 정상범위를 벗어난 지표를 편차순으로 정렬해 교정 드릴 1~3개를 **결정적**으로 선정 (LLM 비관여). 결과는 `metrics.drills`에 저장.
9. **LLM 코멘트** (`llm/coach.py`) — Claude API 호출. metric JSON in(스켈레톤 트랙 제외), 3~5문장 한국어 out. 의료 용어 후처리 필터.

## 데이터 모델

```
User                  Analysis
├ id (uuid)           ├ id (uuid)
├ email               ├ user_id (FK, nullable)
├ password_hash       ├ status (queued|processing|completed|failed|rejected)
├ handedness          ├ storage_key
├ DOB                 ├ original_filename
├ consent...          ├ video_fps / frames / width / height
├ is_verified         ├ metrics (JSONB)
├ verification_code   ├ kinetic_score
└ created_at          ├ llm_comment
                      ├ error_message
                      ├ created_at
                      └ completed_at
```

## 정책 (planning §8)

- **만 18세 이상**만 가입 가능. 가입 시 DOB 검증 + 필수 동의 2개 (연령, 영상 처리).
- 원본 영상은 **30일 후 자동 삭제** — Celery beat 일일 작업(`tasks/cleanup_task.py`, 매일 03:00 UTC)이 보존 기간 경과 영상을 삭제하고 `storage_key`를 비웁니다. 분석 지표 행은 보존.
- 익명화된 키포인트 좌표만 보관·활용 (선택 동의). 영상 삭제 후에도 `metrics.skeleton`의 정규화 키포인트로 오버레이 재생이 가능.
- 의료 진단·치료 도구가 **아님**. LLM 출력에 의료 용어 후처리 필터 적용.

## 디렉토리 구조

```
.
├── docker-compose.yml          # db + redis + api + worker
├── .env.example
├── package.json                # Next.js front
├── src/
│   ├── app/                    # App Router routes
│   ├── components/             # 공유 컴포넌트
│   ├── lib/api.ts              # FastAPI 호출 클라이언트
│   └── lib/adapt.ts            # 백엔드 응답 → UI 형태 어댑터
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    └── app/
        ├── main.py             # FastAPI app
        ├── config.py           # pydantic-settings
        ├── worker.py           # Celery app
        ├── security.py         # JWT + bcrypt
        ├── api/                # routers (auth, uploads, analyses, health)
        ├── db/                 # SQLAlchemy session
        ├── models/             # User, Analysis
        ├── storage/            # local fs ↔ R2 swap
        ├── pipeline/
        │   ├── quality.py      # OpenCV header inspection
        │   ├── pose.py         # MediaPipe BlazePose Heavy
        │   ├── metrics.py      # 8 biomech 지표 계산
        │   └── analyze.py      # full pipeline driver
        ├── tasks/              # Celery analyze task
        └── llm/coach.py        # Claude API client + medical filter
```

## 라이선스

학교 과제로 작성됨 (컴퓨터학개론 과제2 · 2026.05).
