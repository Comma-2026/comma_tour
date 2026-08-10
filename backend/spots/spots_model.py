"""관광지 데이터 접근 계층.

- SPOT_MODE=mock(기본): `spots_data.json` 목업 데이터를 읽는다.
- SPOT_MODE=real: 한국관광공사 TourAPI + 관광지 집중률 방문자 추이 예측 API에서 실시간으로 가져온다.

real 모드 설계:
    - 목록(카드) 조회는 `areaBasedList2`(국문 관광정보) + 시군구별 `tatsCnctrRatedList`(집중률)를
      호출한다. 집중률은 시군구 단위로만 조회 가능해서, 목록에 등장하는 시군구별로 한 번씩만
      호출하고 관광지명으로 매칭한다(스팟 1개당 호출하지 않음).
    - 상세 조회(get_spot_by_id)에서만 `detailCommon2`(개요) + `detailIntro2`(이용시간/주차)
      + `detailPetTour2`(반려동물 동반 여부) + `detailInfo2`(입장료/시설이용료)를 추가로 호출해
      정보를 채운다.
    - 울릉군은 대구 기준 직선거리 추정이 무의미해서(배편 필요) 목록에서 제외한다.
    - tags는 세 소스를 합친다(둘 다 응답에 이미 포함돼 있어 추가 호출 없음):
        1) lclsSystm1(대분류) → `_LCLS_SYSTM1_TAG_MAP` (NA=자연, HS=역사, EX=체험 등)
        2) lclsSystm2(세부분류) → `_LCLS_SYSTM2_TAG_MAP` (예: NA01=산, HS01=유적지)
        3) 웰니스 관광정보(WellnessTursmService) 등록 여부 → "웰니스" 추가
           (경북 전체 16곳뿐이라 매번 통째로 받아서 id로만 대조한다)
    - admissionFee는 `detailInfo2`(반복정보) 목록에서 infoname이 "입장료"/"이용료"인 항목을 찾는다.
      (detailIntro2엔 이 필드가 없고, 반복정보 쪽에 동적으로 들어있었음)
    - `_ttl_cache`로 목록/상세/집중률/웰니스 조회를 `config.SPOT_CACHE_TTL_SECONDS`(기본 1시간)
      동안 캐싱한다. 각 API 일일 트래픽이 1,000회뿐이라 요청마다 실제 호출하면 금방 소진된다.
      (Flask 프로세스 메모리에만 캐싱 — 워커를 여러 개 띄우면 워커별로 따로 캐싱됨)

아직 실제 응답으로 채우지 못한 것 (다음 연동 대상):
    - transportInfo          → TourAPI 관광지(contentTypeId=12) 스키마엔 대중교통 경로 정보가 없음

(별점/리뷰는 카카오맵 API도 제공 안 해서 기능 자체를 뺐다 — rating/reviewQuote 필드 없음.)
"""
from __future__ import annotations

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from functools import wraps

import requests
from geopy.distance import geodesic

from config import config


def _ttl_cache(ttl_seconds: float):
    """간단한 TTL 캐시 데코레이터. 인자 조합별로 결과를 저장한다(실 API 일일 트래픽 보호용)."""

    def decorator(fn):
        cache: dict[tuple, tuple[float, object]] = {}

        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = (args, tuple(sorted(kwargs.items())))
            now = time.monotonic()
            cached = cache.get(key)
            if cached is not None and now - cached[0] < ttl_seconds:
                return cached[1]
            result = fn(*args, **kwargs)
            cache[key] = (now, result)
            return result

        return wrapper

    return decorator

_DATA_FILE = os.path.join(os.path.dirname(__file__), "spots_data.json")
_LIST_CACHE_FILE = os.path.join(os.path.dirname(__file__), "spots_cache.json")

_spots_cache: list[dict] | None = None

# 대구 중심 좌표(거리 계산 기준점 — 제안서 상 "대구에서 n시간" 표기와 동일 기준)
_DAEGU_COORD = (35.8714, 128.6014)

# 우리 목록에서 다루는 콘텐츠 타입: 12 = 관광지
_CONTENT_TYPE_ID = 12

_CONGESTION_BASE_URL = "https://apis.data.go.kr/B551011/TatsCnctrRateService"
_WELLNESS_BASE_URL = "https://apis.data.go.kr/B551011/WellnessTursmService"

# lclsSystmCode2(1Depth, 파라미터 없이 호출)로 실제 확인한 공식 코드 → 우리 태그 매핑.
# areaBasedList2/detailCommon2 응답에 lclsSystm1으로 이미 들어있어서 추가 호출 없이 바로 쓴다.
_LCLS_SYSTM1_TAG_MAP = {
    "NA": "자연",
    "HS": "역사",
    "EX": "체험",
    "LS": "레저스포츠",
    "FD": "미식",
    "VE": "문화",
    "AC": "숙박",
    "SH": "쇼핑",
    "EV": "행사",
}

# lclsSystmCode2(2Depth, lclsSystm1=코드로 각각 호출)로 실제 확인한 세부 코드 → 태그.
# lclsSystm2도 응답에 이미 들어있어서 추가 호출 없이 두 번째 태그로 붙인다(필터 len(tags)>=2 대응).
_LCLS_SYSTM2_TAG_MAP = {
    "NA01": "산", "NA02": "하천·해양", "NA03": "생태", "NA04": "자연공원", "NA05": "자연관광",
    "HS01": "유적지", "HS02": "유물", "HS03": "종교성지", "HS04": "안보관광",
    "EX01": "전통체험", "EX02": "공예체험", "EX03": "농산어촌체험", "EX04": "산사체험",
    "EX05": "웰니스", "EX06": "산업관광", "EX07": "체험",
    "LS01": "육상레저", "LS02": "수상레저", "LS03": "항공레저", "LS04": "복합레저",
    "FD01": "한식", "FD02": "외국식", "FD03": "간이음식", "FD04": "주점", "FD05": "카페",
    "AC01": "호텔", "AC02": "콘도", "AC03": "펜션·민박", "AC04": "모텔", "AC05": "캠핑", "AC06": "호스텔",
    "SH01": "백화점", "SH02": "쇼핑몰", "SH03": "대형마트", "SH04": "면세점", "SH05": "전문매장", "SH06": "시장", "SH07": "쇼핑",
    "EV01": "축제", "EV02": "공연", "EV03": "행사",
    "VE01": "랜드마크", "VE02": "테마공원", "VE03": "도시공원", "VE04": "지역문화", "VE05": "복합시설",
    "VE06": "공연시설", "VE07": "전시시설", "VE08": "행사시설", "VE09": "교육시설", "VE10": "레저스포츠시설",
    "VE11": "교통시설", "VE12": "문화관광",
}

# 지도/필터용 대분류 4종(+기타). lclsSystmCode2로 확인한 9개 대분류 코드 중
# "야경"에 대응하는 코드는 없어서(시간대 속성이라 TourAPI 분류 체계 밖) 제외했다.
# 나머지(LS/FD/AC/SH/EV)는 "기타"로 묶는다.
_CATEGORY_MAP = {
    "NA": "자연",
    "HS": "역사",
    "VE": "문화",
    "EX": "체험",
}


def _classify_category(lcls_systm1: str) -> str:
    return _CATEGORY_MAP.get(lcls_systm1, "기타")

# 대구 기준 배편이 필요해 직선거리 추정이 무의미한 지역(법정동 시군구코드) 제외
_EXCLUDED_REGIONS = {"울릉군"}


#  mock 백엔드 


def _mock_get_all_spots() -> list[dict]:
    global _spots_cache
    if _spots_cache is None:
        with open(_DATA_FILE, encoding="utf-8") as f:
            _spots_cache = json.load(f)["spots"]
    return _spots_cache


def _mock_get_spot_by_id(spot_id: str) -> dict | None:
    return next((s for s in _mock_get_all_spots() if s["id"] == spot_id), None)


#  real 백엔드 (TourAPI) 


def _estimate_distance_from_daegu(lat: float, lng: float) -> tuple[str, int]:
    """직선거리 기반 대략치. 실제 도로 이동시간이 아니므로 근사값이다."""
    straight_km = geodesic(_DAEGU_COORD, (lat, lng)).km
    minutes = max(20, round(straight_km * 1.3))
    hours, mins = divmod(minutes, 60)
    label = f"대구에서 {hours}시간 {mins}분" if hours else f"대구에서 {mins}분"
    return label, minutes


def _tour_api_get(operation: str, **params) -> list[dict]:
    url = f"{config.TOUR_API_BASE_URL}/{operation}"
    query = {
        "serviceKey": config.TOUR_API_KEY,
        "MobileOS": "ETC",
        "MobileApp": "commatour",
        "_type": "json",
        "numOfRows": 50,
        "pageNo": 1,
        **params,
    }
    res = requests.get(url, params=query, timeout=10)
    res.raise_for_status()
    body = res.json()["response"]["body"]
    if body.get("totalCount", 0) == 0:
        return []
    items = body["items"]["item"]
    return items if isinstance(items, list) else [items]


def _strip_html(text: str) -> str:
    return re.sub(r"<br\s*/?>\s*", " ", text or "").strip()


def _congestion_level(rate: float) -> tuple[str, str]:
    if rate < 40:
        return "매우 한적", "very_quiet"
    if rate < 65:
        return "한적", "quiet"
    if rate < 85:
        return "보통", "moderate"
    return "혼잡", "crowded"


@_ttl_cache(config.SPOT_CACHE_TTL_SECONDS)
def _fetch_congestion_map(signgu_cd: str) -> dict[str, float]:
    """해당 시군구의 오늘 날짜 관광지별 집중률(%)을 {관광지명: 집중률} 형태로 반환.
    관광지명 기준 매칭이라 areaBasedList2의 title과 다르게 등록된 곳은 못 잡을 수 있다.
    """
    today = date.today().strftime("%Y%m%d")
    query = {
        "serviceKey": config.TOUR_CONGESTION_API_KEY,
        "MobileOS": "ETC",
        "MobileApp": "commatour",
        "_type": "json",
        "numOfRows": 3000,
        "pageNo": 1,
        "areaCd": signgu_cd[:2],
        "signguCd": signgu_cd,
    }
    try:
        res = requests.get(f"{_CONGESTION_BASE_URL}/tatsCnctrRatedList", params=query, timeout=10)
        res.raise_for_status()
        body = res.json()["response"]["body"]
        if body.get("totalCount", 0) == 0:
            return {}
        items = body["items"]["item"]
        items = items if isinstance(items, list) else [items]
    except (requests.RequestException, KeyError, ValueError):
        return {}

    return {
        item["tAtsNm"]: float(item["cnctrRate"])
        for item in items
        if item.get("baseYmd") == today
    }


def _extract_fee(info_items: list[dict]) -> str | None:
    """detailInfo2(반복정보) 목록에서 입장료/이용료 항목을 찾는다. infoname 예: '입 장 료'(띄어쓰기 포함), '시설이용료'."""
    fee_row = None
    for row in info_items:
        name = row.get("infoname", "").replace(" ", "")
        if name == "입장료":
            fee_row = row
            break
        if fee_row is None and "이용료" in name:
            fee_row = row
    if fee_row is None:
        return None
    text = _strip_html(fee_row.get("infotext", ""))
    return text[:60] + ("…" if len(text) > 60 else "")


def _signgu_cd(item: dict) -> str:
    """법정동 시군구코드(예: 경주시=47130) = 시도코드(lDongRegnCd) + 시군구코드(lDongSignguCd)."""
    return f"{item.get('lDongRegnCd', '')}{item.get('lDongSignguCd', '')}"


@_ttl_cache(config.SPOT_CACHE_TTL_SECONDS)
def _fetch_wellness_ids() -> set[str]:
    """경북 웰니스 관광정보 등록 contentId 목록(16곳뿐이라 통째로 받아서 대조용으로만 쓴다)."""
    query = {
        "serviceKey": config.TOUR_WELLNESS_API_KEY,
        "MobileOS": "ETC",
        "MobileApp": "commatour",
        "_type": "json",
        "numOfRows": 100,
        "pageNo": 1,
        "langDivCd": "1",
        "lDongRegnCd": config.TOUR_LDONG_REGN_CD,
    }
    try:
        res = requests.get(f"{_WELLNESS_BASE_URL}/areaBasedList", params=query, timeout=10)
        res.raise_for_status()
        body = res.json()["response"]["body"]
        if body.get("totalCount", 0) == 0:
            return set()
        items = body["items"]["item"]
        items = items if isinstance(items, list) else [items]
    except (requests.RequestException, KeyError, ValueError):
        return set()

    return {item["contentId"] for item in items}


def _to_https(url: str | None) -> str | None:
    if url and url.startswith("http://"):
        return "https://" + url[len("http://"):]
    return url


def _base_fields(item: dict, congestion_rate: float | None = None, wellness_ids: set[str] | None = None) -> dict:
    """areaBasedList2 / detailCommon2 공통으로 들어있는 필드를 우리 스키마로 매핑."""
    lat, lng = float(item["mapy"]), float(item["mapx"])
    distance_label, distance_minutes = _estimate_distance_from_daegu(lat, lng)
    addr1 = item.get("addr1", "")

    if congestion_rate is not None:
        congestion, congestion_level = _congestion_level(congestion_rate)
    else:
        congestion, congestion_level = "보통", "moderate"  # 집중률 매칭 실패 시 기본값

    tags = []
    lcls_tag = _LCLS_SYSTM1_TAG_MAP.get(item.get("lclsSystm1", ""))
    if lcls_tag:
        tags.append(lcls_tag)
    lcls_tag2 = _LCLS_SYSTM2_TAG_MAP.get(item.get("lclsSystm2", ""))
    if lcls_tag2 and lcls_tag2 not in tags:
        tags.append(lcls_tag2)
    if wellness_ids and item["contentid"] in wellness_ids and "웰니스" not in tags:
        tags.append("웰니스")

    return {
        "id": item["contentid"],
        "name": item["title"],
        "region": addr1.split(" ")[1] if addr1 else "경상북도",
        "icon": "📍",
        "imageUrl": _to_https(item.get("firstimage") or None),
        "category": _classify_category(item.get("lclsSystm1", "")),
        "tags": tags,
        "shortDesc": addr1,
        "congestion": congestion,
        "congestionLevel": congestion_level,
        "distanceFromDaegu": distance_label,
        "distanceMinutes": distance_minutes,
        "requiresWalking": False,
        "hasFoodNearby": False,  # TODO: 주변 음식점 검색(별도 호출) 연동
        "hasParking": True,
        "petFriendly": False,
        "admissionFee": "정보 없음",
        "businessHours": "정보 없음",
        "transportInfo": "정보 없음",
        "lat": lat,
        "lng": lng,
    }


# 스팟 스키마가 바뀔 때마다 1씩 올린다. 버전이 다른 디스크 캐시(옛 코드가 만든 것)는
# 무시하고 새로 받아온다 — 옛 캐시에 새 필드(예: category)가 없어 KeyError 나는 것 방지.
_CACHE_SCHEMA_VERSION = 2


def _load_disk_cache() -> list[dict] | None:
    """디스크 캐시가 있고 아직 신선하면(TTL 안 지났으면) 그 목록을 반환. 서버 재시작에도 살아남는다."""
    try:
        with open(_LIST_CACHE_FILE, encoding="utf-8") as f:
            payload = json.load(f)
        if payload.get("schemaVersion") != _CACHE_SCHEMA_VERSION:
            return None
        if time.time() - payload["cachedAt"] < config.SPOT_CACHE_TTL_SECONDS:
            return payload["spots"]
    except (FileNotFoundError, KeyError, ValueError, json.JSONDecodeError):
        pass
    return None


def _save_disk_cache(spots: list[dict]) -> None:
    payload = {"cachedAt": time.time(), "schemaVersion": _CACHE_SCHEMA_VERSION, "spots": spots}
    with open(_LIST_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)


@_ttl_cache(config.SPOT_CACHE_TTL_SECONDS)
def _real_get_all_spots() -> list[dict]:
    """카드 목록용 — areaBasedList2 + 시군구별 집중률(캐시해서 시군구당 1회만 호출).

    이전엔 numOfRows=50(기본값) + arrange="Q"(인기순)라서 추천 풀 자체가 경북에서 가장
    유명한 상위 50곳으로 좁혀져 있었다 — "숨은 저밀도 관광지" 취지와 반대였다.
    실제로 확인해보니 경북 contentTypeId=12 전체가 817곳뿐이라 한 번에 다 받아올 수 있어서,
    정렬 기준(arrange) 자체가 무의미해지도록(=풀을 안 좁히도록) numOfRows를 넉넉히 키웠다.
    최종적으로 어떤 5곳을 보여줄지는 spots_service.recommend_spots()의 random.sample이 정한다.

    `@_ttl_cache`는 같은 프로세스가 살아있는 동안만 유효하다. Flask가 재시작되면(디버그 모드는
    코드 수정만으로도 재시작됨) 이 메모리 캐시는 날아가므로, `_load_disk_cache`로 디스크에도
    같은 TTL로 저장해 재시작 후에도 콜드 스타트(10초대) 없이 바로 서빙한다.
    """
    cached = _load_disk_cache()
    if cached is not None:
        return cached

    raw_items = _tour_api_get(
        "areaBasedList2",
        areaCode=config.TOUR_AREA_CODE,
        contentTypeId=_CONTENT_TYPE_ID,
        numOfRows=1000,
    )
    raw_items = [it for it in raw_items if it.get("addr1", "").split(" ")[1:2] != ["울릉군"]]

    # 시군구별 집중률 호출을 순차로 하면 시군구 수(경북 전체면 20여 개)만큼 지연이 쌓인다.
    # 병렬로 한 번에 쏴서 콜드 캐시일 때의 응답 시간을 줄인다.
    signgu_cds = {_signgu_cd(item) for item in raw_items}
    with ThreadPoolExecutor(max_workers=min(len(signgu_cds), 10) or 1) as executor:
        wellness_future = executor.submit(_fetch_wellness_ids)
        congestion_futures = {cd: executor.submit(_fetch_congestion_map, cd) for cd in signgu_cds}
        wellness_ids = wellness_future.result()
        congestion_cache = {cd: fut.result() for cd, fut in congestion_futures.items()}

    spots = []
    for item in raw_items:
        rate = congestion_cache[_signgu_cd(item)].get(item["title"])
        spots.append(_base_fields(item, rate, wellness_ids))

    _save_disk_cache(spots)
    return spots


@_ttl_cache(config.SPOT_CACHE_TTL_SECONDS)
def _real_get_spot_by_id(spot_id: str) -> dict | None:
    """상세 조회용 — detailCommon2(개요) + detailIntro2(이용시간/주차) + detailPetTour2(반려동물)."""
    common = _tour_api_get("detailCommon2", contentId=spot_id)
    if not common:
        return None
    item = common[0]

    rate = _fetch_congestion_map(_signgu_cd(item)).get(item["title"])
    spot = _base_fields(item, rate, _fetch_wellness_ids())

    overview = item.get("overview", "")
    if overview:
        spot["shortDesc"] = overview[:80] + ("…" if len(overview) > 80 else "")

    intro = _tour_api_get("detailIntro2", contentId=spot_id, contentTypeId=_CONTENT_TYPE_ID)
    if intro:
        row = intro[0]
        usetime = _strip_html(row.get("usetime", ""))
        restdate = row.get("restdate", "").strip()
        if usetime:
            spot["businessHours"] = (
                f"{usetime} (쉬는 날: {restdate})" if restdate and restdate != "연중무휴" else usetime
            )
        parking = row.get("parking", "")
        if "불가" in parking or "없음" in parking:
            spot["hasParking"] = False

    pet_result = _tour_api_get("detailPetTour2", contentId=spot_id)
    spot["petFriendly"] = len(pet_result) > 0

    info = _tour_api_get("detailInfo2", contentId=spot_id, contentTypeId=_CONTENT_TYPE_ID)
    fee = _extract_fee(info)
    if fee:
        spot["admissionFee"] = fee

    return spot


#  공개 API(모드 분기) 


def _is_real() -> bool:
    return config.SPOT_MODE == "real"


def get_all_spots() -> list[dict]:
    return _real_get_all_spots() if _is_real() else _mock_get_all_spots()


def get_spot_by_id(spot_id: str) -> dict | None:
    return _real_get_spot_by_id(spot_id) if _is_real() else _mock_get_spot_by_id(spot_id)
