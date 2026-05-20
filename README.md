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
| 포즈 추정 | **MediaPipe BlazePose Heavy (33 keypoints, GHUM 3D)** | ✅ |
| 3D 리프팅 | MediaPipe **world_landmarks** 사용 (MotionBERT 교체 가능) | ⚠️ 대체 구현 |
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
| `/upload` | 5가지 촬영 가이드 · 드래그·드롭 · 실제 백엔드 업로드 (백엔드 미실행 시 mock) |
| `/dashboard` | 분석 리포트 · `?id=<uuid>`로 특정 분석 폴링 |

## API (Backend)

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/health` | 헬스체크 |
| `POST` | `/auth/signup` | 회원가입 (18+ 확인 + 동의 분리) |
| `POST` | `/auth/login` | 로그인 (JWT 발급) |
| `POST` | `/uploads` | 멀티파트 영상 업로드 → Celery 분석 큐 enqueue → `{analysis_id}` 반환 |
| `GET` | `/analyses` | 최근 분석 목록 |
| `GET` | `/analyses/{id}` | 분석 상세 (status / metrics / llm_comment) |

## 분석 파이프라인 (Worker)

`backend/app/pipeline/analyze.py` 가 다음 단계를 순차 실행:

1. **품질 검증** (`quality.py`) — fps ≥ 55, 해상도 ≥ 720, frames ≥ 30. 미충족 시 `rejected`.
2. **2D + 3D 포즈** (`pose.py`) — MediaPipe BlazePose Heavy. 프레임마다 33 keypoint × (image_xy, world_xyz, visibility).
3. **키프레임 검출** — 던지는 손 손목 속도 피크 = 릴리스 프레임.
4. **메트릭 계산** (`metrics.py`) — 8개 지표 (실제 벡터 연산):
   - MER, Elbow Height, ER Velocity, Trunk Tilt, Release Consistency
   - X-Factor, Pelvis Velocity, Stride Length
5. **KineticScore** — 8개 지표를 정상범위 대비 z-score → 가중합 (0-100).
6. **운동연쇄 효율** — 6분절 (STRIDE → PELVIS → TRUNK → SHOULDER → ELBOW → RELEASE) 전달 효율 합성.
7. **LLM 코멘트** (`llm/coach.py`) — Claude API 호출. metric JSON in, 3~5문장 한국어 out. 의료 용어 후처리 필터.

## 데이터 모델

```
User           Analysis
├ id (uuid)    ├ id (uuid)
├ email        ├ user_id (FK, nullable)
├ password_hash├ status (queued|processing|completed|failed|rejected)
├ handedness   ├ storage_key
├ DOB          ├ original_filename
├ consent...   ├ video_fps / frames / width / height
└ created_at   ├ metrics (JSONB)
               ├ kinetic_score
               ├ llm_comment
               ├ error_message
               ├ created_at
               └ completed_at
```

## 정책 (planning §8)

- **만 18세 이상**만 가입 가능. 가입 시 DOB 검증 + 필수 동의 2개 (연령, 영상 처리).
- 원본 영상은 **30일 후 자동 삭제** (스토리지 retention 정책으로 운영).
- 익명화된 키포인트 좌표만 모델 개선에 활용 (선택 동의).
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
