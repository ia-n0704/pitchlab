"""
Deterministic drill selection.

Per the planning doc (pipeline step 8) the app recommends 1~3 corrective drills.
Drill choice is **never** decided by the LLM — it is a pure function of the
computed metrics, so the same analysis always yields the same drills. The LLM
(`coach.py`) only explains the numbers in prose.

Each out-of-range metric maps to a targeted drill. Drills are ranked by how far
the metric sits outside its normal band (a z-like deviation), the worst offender
is flagged HIGH PRIORITY, and at most three are returned. When everything is in
range we return one or two maintenance drills so the panel is never empty.
"""
from __future__ import annotations

# metric key → drill template. Order here is the tie-break when deviations match.
_DRILL_CATALOG: dict[str, dict] = {
    "X_FACTOR": {
        "group": "골반",
        "title": "Hip-Shoulder Separation Hold",
        "desc": "발 접지 후 골반만 먼저 회전 · 상체는 닫은 채로 유지 (X-Factor 회복)",
        "reps": "3 SET × 8 · 2초 홀드",
    },
    "ELBOW_H": {
        "group": "팔꿈치",
        "title": "Towel · Elbow Lift",
        "desc": "팔꿈치를 견봉선 위로 들어 올리는 감각 회복",
        "reps": "3 SET × 10",
    },
    "CONSISTENCY": {
        "group": "손목",
        "title": "Wall Drill · 4-Seam Path",
        "desc": "릴리스 시 일관된 손목 채찍 각도 반복 학습",
        "reps": "3 SET × 12",
    },
    "MER": {
        "group": "어깨",
        "title": "Sleeper Stretch · ER Mobility",
        "desc": "어깨 외회전 가동범위 확보로 코킹 구간 안정화",
        "reps": "3 SET × 30초",
    },
    "ER_VEL": {
        "group": "가속",
        "title": "Med-Ball Rotational Throw",
        "desc": "코킹→가속 전환 속도 향상 (어깨 외회전 각속도 출력)",
        "reps": "3 SET × 6 · 최대 강도",
    },
    "TRUNK_TILT": {
        "group": "체간",
        "title": "Trunk Stack Drill",
        "desc": "릴리스 시 측방 기울기 정렬 · 체간 안정성 회복",
        "reps": "3 SET × 10",
    },
    "PELVIS_VEL": {
        "group": "골반회전",
        "title": "Step-Through Hip Fire",
        "desc": "골반 회전 각속도 증대 · 하체 주도 전달 강화",
        "reps": "3 SET × 8",
    },
    "STRIDE_LEN": {
        "group": "스트라이드",
        "title": "Stride Length Walkout",
        "desc": "안정적인 스트라이드 길이 확보 · 접지 일관성",
        "reps": "3 SET × 6",
    },
}

# default maintenance drills when nothing is out of range
_MAINTENANCE: list[dict] = [
    {
        "group": "유지",
        "title": "Long-Toss Progression",
        "desc": "현재 폼을 유지하며 거리 점증 · 운동연쇄 일관성 점검",
        "reps": "3 SET × 10",
    },
    {
        "group": "유지",
        "title": "Plyo-Ball Routine",
        "desc": "전반 출력 유지 · 회복 루틴",
        "reps": "2 SET × 8",
    },
]


def _deviation(metric: dict) -> float:
    """How far the metric sits outside its normal band, in half-band units."""
    lo, hi = metric["norm_min"], metric["norm_max"]
    mid = (lo + hi) / 2
    span = max(1e-3, (hi - lo) / 2)
    return abs(metric["value"] - mid) / span


def select_drills(metrics: dict, limit: int = 3) -> list[dict]:
    """Return 1~3 drills derived deterministically from the metric panel.

    Output shape matches the dashboard drill card:
      {id, title, desc, reps, priority, top}
    """
    scored: list[tuple[float, str, dict]] = []
    for key, template in _DRILL_CATALOG.items():
        m = metrics.get(key)
        if not isinstance(m, dict) or "ok" not in m:
            continue
        if m.get("ok") is False:
            scored.append((_deviation(m), key, template))

    # worst deviation first; key name as a stable tie-break
    scored.sort(key=lambda t: (-t[0], t[1]))
    chosen = [t[2] for t in scored[:limit]]

    if not chosen:
        chosen = _MAINTENANCE[:2]

    drills: list[dict] = []
    for i, tmpl in enumerate(chosen):
        top = i == 0 and bool(scored)  # only flag top when it's an actual alert
        drills.append(
            {
                "id": f"{i + 1:02d} · {tmpl['group']}",
                "title": tmpl["title"],
                "desc": tmpl["desc"],
                "reps": tmpl["reps"],
                "priority": "HIGH PRIORITY" if top else ("HIGH" if i == 0 else "MEDIUM"),
                "top": top,
            }
        )
    return drills
