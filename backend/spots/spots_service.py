"""관광지 추천/조회 서비스 계층."""
from __future__ import annotations

import random

from spots import spots_model

# 카드 목록에 노출할 필드(상세 정보는 detail 조회에서만 내려준다)
_CARD_FIELDS = [
    "id", "name", "region", "icon", "imageUrl", "category", "tags", "shortDesc", "congestion", "distanceFromDaegu",
]

# 지도 탭 전체 목록(카탈로그)용 필드 — 좌표 포함, 랜덤 샘플링 없이 전체를 그대로 내려준다
_CATALOG_FIELDS = ["id", "name", "region", "icon", "category", "shortDesc", "lat", "lng"]

# 레포츠(contentTypeId=28) 스팟의 출처 표시값(spots_model._base_fields의 _sourceContentTypeId).
# 레포츠는 태그 매핑이 lclsSystm1 기준(LS)과 lclsSystm1=VE인 것(VE10 스포츠경기장 등)이 섞여 있어
# 태그로는 구분이 안 된다 — 출처 contentTypeId로 직접 구분한다.
_LEISURE_CONTENT_TYPE_ID = 28

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
    "leisure_sports": lambda s: s.get("_sourceContentTypeId") == _LEISURE_CONTENT_TYPE_ID,
}


class SpotNotFoundError(Exception):
    """존재하지 않는 관광지 id로 조회할 때."""


def _to_card(spot: dict) -> dict:
    return {field: spot[field] for field in _CARD_FIELDS}


def recommend_spots(
    exclude_ids: list[str],
    feedback_tags: list[str] | None = None,
    region: str | None = None,
    count: int = 5,
    source_content_type: int | None = None,
) -> list[dict]:
    """제외 목록을 뺀 나머지 중 랜덤으로 count개를 추천한다.

    - region이 있으면 그 지역(시군구) 안에서만 뽑는다 — 다른 필터와 달리, 결과가 비어도
      다른 지역으로 새지 않는다(사용자가 지역을 직접 골랐으므로).
    - 제외하고 나면 count개가 안 남을 경우, (region 필터가 있다면 그 안에서만) 다시 뽑는다.
    - feedback_tags가 있으면 순서대로 필터를 적용하되, 필터 적용 결과가 비면 그 필터는 건너뛴다.
    - 레포츠(28번 출처) 스팟은 다른 테마 태그와 달리 기본 풀에 아예 없다가, "leisure_sports"를
      선택했을 때만 풀에 들어온다(선택 안 하면 추천에 절대 안 나옴 — 좁히는 게 아니라 켜고 끄는 것).
    - source_content_type(디버그용, 예: 14=문화시설)이 있으면 그 출처(contentTypeId)에서 온
      스팟만 대상으로 한다 — 12/14/28/38 각각이 실제로 잘 불러와졌는지 확인하는 용도.
    """
    wants_leisure = "leisure_sports" in (feedback_tags or []) or source_content_type == _LEISURE_CONTENT_TYPE_ID

    all_spots = spots_model.get_all_spots()
    base_pool = [
        s
        for s in all_spots
        if (region is None or s["region"] == region)
        and (wants_leisure or s.get("_sourceContentTypeId") != _LEISURE_CONTENT_TYPE_ID)
        and (source_content_type is None or s.get("_sourceContentTypeId") == source_content_type)
    ]

    pool = [s for s in base_pool if s["id"] not in exclude_ids]
    if len(pool) < count:
        pool = base_pool

    for tag in feedback_tags or []:
        filter_fn = _FEEDBACK_FILTERS.get(tag)
        if filter_fn is None:
            continue
        filtered = [s for s in pool if filter_fn(s)]
        if filtered:
            pool = filtered

    picked = random.sample(pool, min(count, len(pool)))
    return [_to_card(s) for s in picked]


def get_catalog(region: str | None = None) -> list[dict]:
    """지도 탭 전체 목록용 — 추천처럼 랜덤 샘플링하지 않고 (지역 필터 있으면 그 안에서) 전체 반환."""
    all_spots = spots_model.get_all_spots()
    if region:
        all_spots = [s for s in all_spots if s["region"] == region]
    return [{field: s[field] for field in _CATALOG_FIELDS} for s in all_spots]


def get_available_regions() -> list[str]:
    """현재 모드(mock/real)에 있는 스팟들의 지역(시군구) 목록을 중복 없이 정렬해서 반환."""
    return sorted({s["region"] for s in spots_model.get_all_spots()})


def get_spot_detail(spot_id: str) -> dict:
    spot = spots_model.get_spot_by_id(spot_id)
    if spot is None:
        raise SpotNotFoundError(spot_id)
    return spot
