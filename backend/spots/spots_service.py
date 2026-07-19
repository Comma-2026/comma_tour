"""관광지 추천/조회 서비스 계층."""
from __future__ import annotations

import random

from spots import spots_model

# 카드 목록에 노출할 필드(상세 정보는 detail 조회에서만 내려준다)
_CARD_FIELDS = ["id", "name", "region", "icon", "tags", "shortDesc", "congestion", "distanceFromDaegu"]

# 카드 하단 "어떤 점이 아쉬웠나요?" 피드백 칩 → 다음 추천 후보 필터.
# 필터를 적용한 결과가 비면(너무 좁으면) 해당 필터는 건너뛴다.
_FEEDBACK_FILTERS = {
    "too_far": lambda s: s["distanceMinutes"] <= 120,
    "want_quieter": lambda s: s["congestionLevel"] == "very_quiet",
    "want_food": lambda s: s["hasFoodNearby"],
    "no_walking": lambda s: not s["requiresWalking"],
    "lacking_sights": lambda s: len(s["tags"]) >= 2,
    "nature_healing": lambda s: any(t in s["tags"] for t in ("자연", "힐링")),
    "history_culture": lambda s: "역사" in s["tags"],
    "free_only": lambda s: s["admissionFee"] == "무료",
    "parking_required": lambda s: s["hasParking"],
    "pet_friendly": lambda s: s["petFriendly"],
    "activity_experience": lambda s: any(t in s["tags"] for t in ("체험", "온천")),
}


class SpotNotFoundError(Exception):
    """존재하지 않는 관광지 id로 조회할 때."""


def _to_card(spot: dict) -> dict:
    return {field: spot[field] for field in _CARD_FIELDS}


def recommend_spots(exclude_ids: list[str], feedback_tags: list[str] | None = None, count: int = 5) -> list[dict]:
    """제외 목록을 뺀 나머지 중 랜덤으로 count개를 추천한다.

    - 제외하고 나면 count개가 안 남을 경우, 전체 풀에서 다시 뽑는다(재추첨 시 소진 방지).
    - feedback_tags가 있으면 순서대로 필터를 적용하되, 필터 적용 결과가 비면 그 필터는 건너뛴다.
    """
    all_spots = spots_model.get_all_spots()
    pool = [s for s in all_spots if s["id"] not in exclude_ids]
    if len(pool) < count:
        pool = all_spots

    for tag in feedback_tags or []:
        filter_fn = _FEEDBACK_FILTERS.get(tag)
        if filter_fn is None:
            continue
        filtered = [s for s in pool if filter_fn(s)]
        if filtered:
            pool = filtered

    picked = random.sample(pool, min(count, len(pool)))
    return [_to_card(s) for s in picked]


def get_spot_detail(spot_id: str) -> dict:
    spot = spots_model.get_spot_by_id(spot_id)
    if spot is None:
        raise SpotNotFoundError(spot_id)
    return spot
