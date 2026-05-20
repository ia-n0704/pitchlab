"""
Claude API integration. LLM is used as an *explainer* (not a prescriber):
it converts the metric numbers into a natural-language coaching paragraph,
referencing the user's specific values. Drill selection is deterministic
in `select_drills` — never decided by the LLM.

Falls back to a templated comment if ANTHROPIC_API_KEY is not configured,
so the rest of the pipeline keeps working in local-dev / CI without a key.
"""
from __future__ import annotations

import json
import logging
import re

from anthropic import Anthropic, APIError

from app.config import settings

log = logging.getLogger(__name__)

# Medical/diagnostic terms we strip from LLM output as a safety net.
MEDICAL_BLOCKLIST = [
    "진단", "치료", "완치", "처방", "수술", "의학적 소견",
    "골절", "인대 파열", "회전근개 손상",
]

SYSTEM = """\
당신은 야구 투수 메커니즘 코치입니다.
규칙:
- 의료적 진단/치료 용어 금지. ‘…때문에 어깨가 아플 거예요’ 같은 추정도 금지.
- 항상 사용자의 실제 수치를 인용해 설명.
- 3~5문장 한국어 존댓말.
- 운동연쇄(kinetic chain) 흐름(STRIDE → PELVIS → TRUNK → SHOULDER → ELBOW → RELEASE) 관점에서 가장 큰 손실 지점을 1~2개 짚을 것.
- 마지막에 '본 분석은 참고용이며 통증이 있다면 전문 의료기관을 찾으세요.' 류의 면책 문장은 추가하지 말 것. (앱이 별도로 노출함.)
"""


def _sanitize(text: str) -> str:
    for term in MEDICAL_BLOCKLIST:
        text = re.sub(re.escape(term), "[필터됨]", text)
    return text.strip()


def _fallback_comment(metrics: dict) -> str:
    """Used when no Anthropic API key is configured."""
    parts: list[str] = []
    bad = [(k, v) for k, v in metrics.items() if isinstance(v, dict) and v.get("ok") is False]
    if not bad:
        return (
            f"전반적으로 운동연쇄가 안정적입니다 (KineticScore "
            f"{metrics.get('kinetic_score', 0)}). 현재 폼을 유지하면서 반복 측정으로 일관성을 확인해보세요."
        )
    parts.append(f"전반 KineticScore는 {metrics.get('kinetic_score', 0)}점입니다.")
    for k, v in bad[:2]:
        parts.append(
            f"{v.get('ko', k)}({v['value']}{v['unit']})가 정상범위 {v['norm_min']}~{v['norm_max']}{v['unit']}을 벗어났습니다."
        )
    parts.append("운동연쇄 상류부터(STRIDE → PELVIS → TRUNK) 점검해보시는 걸 권장합니다.")
    return " ".join(parts)


def generate_coaching_comment(metrics: dict) -> str:
    """Generate a Korean coaching paragraph from the metric dict."""
    if not settings.anthropic_api_key:
        log.info("ANTHROPIC_API_KEY missing — returning templated fallback comment.")
        return _fallback_comment(metrics)

    client = Anthropic(api_key=settings.anthropic_api_key)
    payload = json.dumps(metrics, ensure_ascii=False, indent=2)

    try:
        msg = client.messages.create(
            model=settings.claude_model,
            max_tokens=600,
            system=SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "다음 투구 분석 결과 JSON을 보고 코칭 코멘트를 작성해주세요.\n\n"
                        f"```json\n{payload}\n```\n"
                    ),
                }
            ],
        )
        # content is a list of blocks; join the text ones
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
        return _sanitize(text) if text else _fallback_comment(metrics)
    except APIError as e:
        log.exception("Anthropic API error: %s", e)
        return _fallback_comment(metrics)
