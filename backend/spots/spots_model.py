"""관광지 데이터 접근 계층.

- SPOT_MODE=mock(기본): `spots_data.json` 목업 데이터를 읽는다.
- SPOT_MODE=real: 한국관광공사 TourAPI + 관광지 집중률 방문자 추이 예측 API에서 실시간으로 가져온다.

real 모드 설계:
    - 목록(카드) 조회는 `areaBasedList2`(국문 관광정보)를 `_SOURCE_CONTENT_TYPES`에 정의된
      contentTypeId(12 관광지/14 문화시설/28 레포츠/38 쇼핑)마다 병렬로 호출해 합친다
      (박물관·미술관 같은 문화시설은 12가 아니라 14로 등록돼 있어 12만으로는 못 가져왔다).
      14/28/38은 소분류(lclsSystm3) 기준으로 관광지 성격이 뚜렷한 것만 골라 넣는다.
      + 시군구별 `tatsCnctrRatedList`(집중률)를 호출한다. 집중률은 시군구 단위로만 조회
      가능해서, 목록에 등장하는 시군구별로 한 번씩만 호출하고 관광지명으로 매칭한다
      (정확히 안 맞으면 공백/괄호 제거한 정규화 이름으로 한 번 더 시도 — `_lookup_congestion_rate`).
      그래도 못 찾으면(실측 기준 약 63% — 집중률 API 자체에 데이터가 없는 경우가 대부분)
      "보통"으로 임의 추정하지 않고 congestion="정보 없음"/congestionLevel="unknown"으로 표시한다.
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

# 상세조회(detailIntro2/detailInfo2)용 기본/폴백 contentTypeId. 실제로는 detailCommon2
# 응답의 contenttypeid를 우선 쓴다(목록이 12 외에도 14/28/38에서 오므로 스팟마다 다를 수 있음).
_CONTENT_TYPE_ID = 12

# 목록에 포함할 관광타입(contentTypeId)별 소분류(lclsSystm3) 포함/제외 규칙.
# 12(관광지)는 전체, 14/28/38은 "숨은 관광지"에 가까운 소분류만 골라 넣는다.
# 근거: 신분류체계정보 관광타입정보 연계 정의서(대/중/소분류 ↔ contentTypeId 매핑표).
#   - 14(문화시설): 공연장 + 박물관/기념관/전시관/과학관/미술관·화랑만. 컨벤션센터·문화원·
#     도서관·학교·어학당·서점·기타문화시설·연회장·영화관은 일상 시설에 가까워 제외.
#   - 28(레포츠): 캠핑(숙박 성격)·카지노만 제외, 나머지 레저스포츠 전체. 추천 풀엔 항상
#     넣어두되, 사용자가 "레저스포츠" 선호를 고를 때만 노출한다(spots_service._LEISURE_CONTENT_TYPE_ID).
#   - 38(쇼핑): 시장(비상설/상설)만.
#   - 32(숙박)/25(여행코스)/39(음식점)/15(축제·공연·행사)는 아예 호출하지 않는다
#     (숙박·음식점은 장소 성격이 다르고, 코스는 "장소 하나" 컨셉과 안 맞고, 축제는
#     "저밀도" 취지와 반대로 사람이 몰리는 곳이라서).
_SOURCE_CONTENT_TYPES: dict[int, dict] = {
    12: {"mode": "all"},
    14: {
        "mode": "allow",
        "l3_codes": {
            "VE060100",  # 공연장
            "VE070100", "VE070200", "VE070300", "VE070500", "VE070600",  # 박물관/기념관/전시관/과학관/미술관·화랑
        },
    },
    28: {
        "mode": "deny",
        "l3_codes": {
            "AC050100", "AC050200", "AC050300", "AC050400",  # 캠핑 4종
            "VE120200",  # 카지노
        },
    },
    38: {"mode": "allow", "l3_codes": {"SH060100", "SH060200"}},  # 시장(비상설/상설)
}

_CONGESTION_BASE_URL = "https://apis.data.go.kr/B551011/TatsCnctrRateService"
_WELLNESS_BASE_URL = "https://apis.data.go.kr/B551011/WellnessTursmService"
# 제휴 전용(/affiliate/v1/directions)이 아니라 일반 REST 키로 열리는 엔드포인트.
# (/affiliate/ 버전은 403 permission denied — 제휴 계약 필요한 별도 상품이다.)
_KAKAO_DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/v1/directions"

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

# 12 외 출처는 대분류 코드가 위 4종 밖이라(시장=SH, 레포츠=LS 등 → "기타"로 빠짐)
# 출처(contentTypeId) 기준으로 고정 분류한다: 문화시설(14)·시장(38)=문화, 레포츠(28)=체험.
_SOURCE_CATEGORY_MAP = {14: "문화", 28: "체험", 38: "문화"}


def _classify_category(lcls_systm1: str, content_type_id: int) -> str:
    source_category = _SOURCE_CATEGORY_MAP.get(content_type_id)
    if source_category is not None:
        return source_category
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


def fetch_drive_route(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict | None:
    """카카오모빌리티 자동차 길찾기로 실제 도로 거리/시간을 구한다.

    프론트가 매번 사용자 GPS 좌표를 보내오므로(관광지 목록처럼 서버에 미리 캐싱해둘 수 없음)
    요청 시점에 직접 호출한다. 실패(네트워크 오류, 키 미설정 등)하면 None을 반환하고,
    호출부(라우트)에서 이를 그대로 프론트에 알려 프론트가 직선거리 근사치로 폴백하게 한다.
    """
    if not config.KAKAO_REST_API_KEY:
        return None
    try:
        res = requests.get(
            _KAKAO_DIRECTIONS_URL,
            params={
                "origin": f"{origin_lng},{origin_lat}",
                "destination": f"{dest_lng},{dest_lat}",
            },
            headers={"Authorization": f"KakaoAK {config.KAKAO_REST_API_KEY}"},
            timeout=10,
        )
        res.raise_for_status()
        summary = res.json()["routes"][0]["summary"]
        duration_seconds = int(summary["duration"])
        distance_meters = int(summary["distance"])
    except (requests.RequestException, KeyError, IndexError, ValueError):
        return None

    minutes = max(1, round(duration_seconds / 60))
    hours, mins = divmod(minutes, 60)
    label = f"현재 위치로부터 {hours}시간 {mins}분" if hours else f"현재 위치로부터 {mins}분"
    return {"label": label, "minutes": minutes, "distanceMeters": distance_meters}


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


def _filter_by_source_rule(items: list[dict], rule: dict) -> list[dict]:
    mode = rule["mode"]
    if mode == "all":
        return items
    codes = rule["l3_codes"]
    if mode == "allow":
        return [it for it in items if it.get("lclsSystm3") in codes]
    if mode == "deny":
        return [it for it in items if it.get("lclsSystm3") not in codes]
    raise ValueError(f"unknown source rule mode: {mode}")


def _fetch_source_items(content_type_id: int, rule: dict) -> list[dict]:
    """contentTypeId 하나에 대해 areaBasedList2를 호출하고, 소분류 규칙(_SOURCE_CONTENT_TYPES)을
    적용한다. 이후 단계(집중률 매칭, _base_fields)에서 출처를 알 수 있도록 각 항목에 표시해둔다."""
    items = _tour_api_get(
        "areaBasedList2",
        areaCode=config.TOUR_AREA_CODE,
        contentTypeId=content_type_id,
        numOfRows=1000,
    )
    items = _filter_by_source_rule(items, rule)
    for it in items:
        it["_fetchedContentTypeId"] = content_type_id
    return items


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


# 공백/괄호 안 내용/특수문자 차이로 놓치는 이름 매칭을 흡수하기 위한 정규화.
# (예: "감응사(성주)" ↔ "감응사(경북)", "내연산 보경사 시립공원" ↔ "내연산보경사시립공원")
# 실측해보니 이걸로 건지는 건 전체의 2.7%p뿐이고, 나머지 대부분은 집중률 API 자체에
# 데이터가 없는 것(매칭 문제가 아님) — _base_fields의 "정보 없음" 폴백이 그 경우를 담당한다.
_NON_ALNUM_KO = re.compile(r"[^\w가-힣]")
_PAREN_CONTENT = re.compile(r"\(.*?\)")


def _normalize_spot_name(name: str) -> str:
    name = _PAREN_CONTENT.sub("", name)
    return _NON_ALNUM_KO.sub("", name).strip()


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


def _lookup_congestion_rate(congestion_map: dict[str, float], title: str) -> float | None:
    """정확한 이름으로 먼저 찾고, 없으면 정규화한 이름으로 한 번 더 찾는다."""
    if title in congestion_map:
        return congestion_map[title]

    normalized_title = _normalize_spot_name(title)
    if not normalized_title:
        return None
    for name, rate in congestion_map.items():
        if _normalize_spot_name(name) == normalized_title:
            return rate
    return None


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


def _base_fields(
    item: dict,
    congestion_rate: float | None = None,
    wellness_ids: set[str] | None = None,
    content_type_id: int = _CONTENT_TYPE_ID,
) -> dict:
    """areaBasedList2 / detailCommon2 공통으로 들어있는 필드를 우리 스키마로 매핑."""
    lat, lng = float(item["mapy"]), float(item["mapx"])
    distance_label, distance_minutes = _estimate_distance_from_daegu(lat, lng)
    addr1 = item.get("addr1", "")

    if congestion_rate is not None:
        congestion, congestion_level = _congestion_level(congestion_rate)
    else:
        # 집중률 API에 이 관광지 데이터 자체가 없는 경우(매칭 실패) — "보통"으로 임의 추정하지
        # 않고 데이터가 없다는 걸 그대로 보여준다. 실측 기준 경북 스팟의 약 63%가 여기 해당된다.
        congestion, congestion_level = "정보 없음", "unknown"

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
        "category": _classify_category(item.get("lclsSystm1", ""), content_type_id),
        # 12 외 출처(14/28/38)에서 왔는지 표시 — 프론트엔 안 내려가고(카드/상세 필드 목록에 없음)
        # spots_service의 추천 풀 게이팅(레저스포츠는 선택 시에만 노출)에서만 쓴다.
        "_sourceContentTypeId": content_type_id,
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
# v3: _sourceContentTypeId 추가 + 목록 출처가 12 하나에서 12/14/28/38로 확장됨.
# v4: 집중률 매칭 실패 시 폴백이 "보통"/moderate에서 "정보 없음"/unknown으로 바뀜.
# v5: category 분류가 출처 기준 보정됨 — 문화시설(14)·시장(38)=문화, 레포츠(28)=체험
#     (이전엔 시장=기타, 레포츠=기타/문화(VE10)로 찍혔음).
_CACHE_SCHEMA_VERSION = 5


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
    """카드 목록용 — areaBasedList2(관광타입별) + 시군구별 집중률(캐시해서 시군구당 1회만 호출).

    이전엔 numOfRows=50(기본값) + arrange="Q"(인기순)라서 추천 풀 자체가 경북에서 가장
    유명한 상위 50곳으로 좁혀져 있었다 — "숨은 저밀도 관광지" 취지와 반대였다.
    실제로 확인해보니 경북 contentTypeId=12 전체가 817곳뿐이라 한 번에 다 받아올 수 있어서,
    정렬 기준(arrange) 자체가 무의미해지도록(=풀을 안 좁히도록) numOfRows를 넉넉히 키웠다.
    최종적으로 어떤 5곳을 보여줄지는 spots_service.recommend_spots()의 random.sample이 정한다.

    `_SOURCE_CONTENT_TYPES`에 정의된 contentTypeId(12/14/28/38)마다 목록을 병렬로 받아와 합친다
    (박물관·미술관 같은 문화시설은 12가 아니라 14로 등록돼 있어서 12만으로는 못 가져온다).

    `@_ttl_cache`는 같은 프로세스가 살아있는 동안만 유효하다. Flask가 재시작되면(디버그 모드는
    코드 수정만으로도 재시작됨) 이 메모리 캐시는 날아가므로, `_load_disk_cache`로 디스크에도
    같은 TTL로 저장해 재시작 후에도 콜드 스타트(10초대) 없이 바로 서빙한다.
    """
    cached = _load_disk_cache()
    if cached is not None:
        return cached

    with ThreadPoolExecutor(max_workers=len(_SOURCE_CONTENT_TYPES)) as executor:
        list_futures = {
            content_type_id: executor.submit(_fetch_source_items, content_type_id, rule)
            for content_type_id, rule in _SOURCE_CONTENT_TYPES.items()
        }
        raw_items = [it for fut in list_futures.values() for it in fut.result()]

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
        rate = _lookup_congestion_rate(congestion_cache[_signgu_cd(item)], item["title"])
        spots.append(_base_fields(item, rate, wellness_ids, content_type_id=item["_fetchedContentTypeId"]))

    _save_disk_cache(spots)
    return spots


@_ttl_cache(config.SPOT_CACHE_TTL_SECONDS)
def _real_get_spot_by_id(spot_id: str) -> dict | None:
    """상세 조회용 — detailCommon2(개요) + detailIntro2(이용시간/주차) + detailPetTour2(반려동물).

    detailIntro2/detailInfo2는 contentTypeId별로 응답 스키마가 달라서 정확한 값을 넘겨야 한다.
    목록이 이제 12 외에 14/28/38에서도 오므로, detailCommon2 응답 자체에 들어있는
    contenttypeid를 읽어서 쓴다(하드코딩된 12를 그대로 쓰면 14/28/38 스팟은 빈 응답을 받는다).
    """
    common = _tour_api_get("detailCommon2", contentId=spot_id)
    if not common:
        return None
    item = common[0]
    content_type_id = int(item.get("contenttypeid") or _CONTENT_TYPE_ID)

    rate = _lookup_congestion_rate(_fetch_congestion_map(_signgu_cd(item)), item["title"])
    spot = _base_fields(item, rate, _fetch_wellness_ids(), content_type_id=content_type_id)

    overview = item.get("overview", "")
    if overview:
        spot["shortDesc"] = overview[:80] + ("…" if len(overview) > 80 else "")

    intro = _tour_api_get("detailIntro2", contentId=spot_id, contentTypeId=content_type_id)
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

    info = _tour_api_get("detailInfo2", contentId=spot_id, contentTypeId=content_type_id)
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
