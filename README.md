# PitchLab

**AI 기반 투구 동작 생체역학 분석 플랫폼**
*Upper + Lower Body Kinetic Chain Analyzer · Open Beta v0.1*

스마트폰으로 촬영한 단일 카메라 영상만으로 투구 동작의 상체·골반 운동연쇄(Kinetic Chain)를
정량 분석하고, 어디서 에너지가 새고 있는지를 수치로 보여준 뒤,
LLM이 개인 맞춤 코멘트와 추천 훈련을 설명해 주는 웹 플랫폼입니다.

## 페이지

| 파일 | 설명 |
| --- | --- |
| `index.html` | 랜딩 — Hero / 8단계 파이프라인 / 5종 지표 / 비교표 / CTA |
| `auth.html` | 회원가입 (만 18세 이상 확인 필수) + 로그인. `#login` 해시로 토글 |
| `upload.html` | 5가지 촬영 가이드 + 드롭존 + 품질 검증 시뮬레이션 |
| `dashboard.html` | KineticScore 게이지 / 상체 5종 + 하체 3종 지표 / 운동연쇄 에너지 흐름 / LLM 코멘트 / 추천 드릴 / 히스토리. **스켈레톤 오버레이가 4개 키프레임 사이를 보간 재생** |
| `styles.css` | 디자인 토큰 (다크 모드 + electric lime 액센트, Space Grotesk / Pretendard / JetBrains Mono) |

## 분석 지표 8종

**상체 (5종)**
1. **MER** — 최대 외전각 (NORM 165–185°)
2. **Elbow Height** — 릴리스 시 견봉 대비 (NORM 0~+5°)
3. **ER Velocity** — 어깨 외회전 각속도 (NORM 6,500–8,000°/s)
4. **Trunk Tilt** — 릴리스 시 체간 측방 기울기 (NORM 20–35°)
5. **Release Consistency** — 5구 표준편차 (NORM ≤ 3 cm)

**하체 / 골반 (3종)**
6. **X-Factor** — 골반-어깨 분리각 (NORM 40–55°)
7. **Pelvis Velocity** — 골반 회전 각속도 (NORM 500–700°/s)
8. **Stride Length** — 스트라이드 길이 (NORM 80–95% body height)

## 운동연쇄 에너지 흐름

`STRIDE → PELVIS → TRUNK → SHOULDER → ELBOW → RELEASE` 6단계 분절별 에너지 전달 효율을 시각화하여,
누적 전달 효율을 프로 표준 코호트 평균과 비교합니다.

## 정책

- **만 18세 이상**만 가입 가능 (데이터·법무 정책)
- 원본 영상은 **30일 후 자동 삭제**
- 익명화된 키포인트 좌표만 모델 개선에 활용
- 의료 진단·치료 도구가 **아님** (모든 결과 화면 하단에 고지 노출)

## 실행

정적 사이트이므로 별도 빌드 없이 임의의 정적 서버로 띄울 수 있습니다.

```bash
python -m http.server 8765
# 브라우저에서 http://localhost:8765 접속
```

## 기술 스택 (참고)

기획서 기준 풀스택 권장 스택:

- 프론트엔드: Next.js + TypeScript, Tailwind, Recharts
- 백엔드: FastAPI(Python)
- 분석 워커: Celery + Redis, GPU 인스턴스
- ML: MediaPipe BlazePose Heavy, MotionBERT 3D
- LLM: Anthropic Claude API
- 스토리지: S3 호환(R2) + Postgres + Redis

본 리포지토리는 **UI/UX 정적 프로토타입**입니다.

## 라이선스

학교 과제로 작성됨 (디미고 컴퓨터개론 과제2 · 2026.05).
