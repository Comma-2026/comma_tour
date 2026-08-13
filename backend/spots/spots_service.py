"""관광지 추천/조회 서비스 계층."""
from __future__ import annotations

import random

from spots import spots_model

# 카드 목록에 노출할 필드(상세 정보는 detail 조회에서만 내려준다)
# lat/lng: 프론트에서 내 위치 기준 거리(utils/distance)를 계산하는 데 쓴다.
_CARD_FIELDS = [
    "id", "name", "region", "icon", "imageUrl", "category", "tags", "shortDesc", "congestion",
    "distanceFromDaegu", "lat", "lng",
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
    "free_only": lambda s: s["admissionFee"] == "무료",
    "parking_required": lambda s: s["hasParking"],
    "pet_friendly": lambda s: s["petFriendly"],
    "leisure_sports": lambda s: s.get("_sourceContentTypeId") == _LEISURE_CONTENT_TYPE_ID,
}

# 설문 "테마별" 다중 선택(전체 + 6종, 중복 선택 가능) → 추천 풀을 좁히는 하드 필터.
# 여러 개 고르면 그 중 하나라도 해당하면 포함(OR) — 스팟 하나는 카테고리 하나뿐이라 AND로
# 하면 거의 항상 결과가 0개가 된다. region과 같은 방식으로 동작한다(결과가 비어도
# 다른 테마로 새지 않음 — 사용자가 명시적으로 고른 것이므로).
# 체험/자연/역사관광은 category가 오직 contentTypeId=12에서만 나와서 그대로 써도 되지만,
# 문화관광(VE)은 14(문화시설)·28(VE10 스포츠시설)에서도 나오므로 출처를 12로 한정해야
# "문화시설" 선택지와 안 겹친다.
_THEME_FILTERS = {
    "exp_tourism": lambda s: s["category"] == "체험",
    "culture_tourism": lambda s: s["category"] == "문화" and s.get("_sourceContentTypeId") == 12,
    "nature_tourism": lambda s: s["category"] == "자연",
    "history_tourism": lambda s: s["category"] == "역사",
    "culture_facility": lambda s: s.get("_sourceContentTypeId") == 14,
    "market": lambda s: s.get("_sourceContentTypeId") == 38,
}


class SpotNotFoundError(Exception):
    """존재하지 않는 관광지 id로 조회할 때."""


def _to_card(spot: dict) -> dict:
    return {field: spot[field] for field in _CARD_FIELDS}


def recommend_spots(
    exclude_ids: list[str],
    feedback_tags: list[str] | None = None,
    regions: list[str] | None = None,
    count: int = 5,
    source_content_type: int | None = None,
    themes: list[str] | None = None,
) -> list[dict]:
    """제외 목록을 뺀 나머지 중 랜덤으로 count개를 추천한다.

    - regions(다중 선택)가 있으면 그 지역(시군구)들 안에서만 뽑는다 — 다른 필터와 달리,
      결과가 비어도 다른 지역으로 새지 않는다(사용자가 명시적으로 골랐으므로).
      여러 개면 그 중 하나라도 해당하면 포함(OR, themes와 동일한 방식).
    - themes(설문 "테마별" 다중 선택, _THEME_FILTERS 키들)도 regions와 동일하게 하드 필터다 —
      결과가 비어도 다른 테마로 안 샌다. 여러 개면 그 중 하나라도 맞으면 포함(OR).
    - 제외하고 나면 count개가 안 남을 경우, (regions/themes 필터가 있다면 그 안에서만) 다시 뽑는다.
    - feedback_tags가 있으면 순서대로 필터를 적용하되, 필터 적용 결과가 비면 그 필터는 건너뛴다.
    - 레포츠(28번 출처) 스팟은 다른 테마 태그와 달리 기본 풀에 아예 없다가, "leisure_sports"를
      선택했을 때만 풀에 들어온다(선택 안 하면 추천에 절대 안 나옴 — 좁히는 게 아니라 켜고 끄는 것).
    - source_content_type(디버그용, 예: 14=문화시설)이 있으면 그 출처(contentTypeId)에서 온
      스팟만 대상으로 한다 — 12/14/28/38 각각이 실제로 잘 불러와졌는지 확인하는 용도.
    """
    wants_leisure = "leisure_sports" in (feedback_tags or []) or source_content_type == _LEISURE_CONTENT_TYPE_ID
    theme_filter_fns = [_THEME_FILTERS[t] for t in (themes or []) if t in _THEME_FILTERS]
    region_set = set(regions or [])

    all_spots = spots_model.get_all_spots()
    base_pool = [
        s
        for s in all_spots
        if (not region_set or s["region"] in region_set)
        and (wants_leisure or s.get("_sourceContentTypeId") != _LEISURE_CONTENT_TYPE_ID)
        and (source_content_type is None or s.get("_sourceContentTypeId") == source_content_type)
        and (not theme_filter_fns or any(fn(s) for fn in theme_filter_fns))
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
