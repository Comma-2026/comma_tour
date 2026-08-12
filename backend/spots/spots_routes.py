"""관광지 라우트(블루프린트): /api/spots/recommend, /api/spots/regions, /api/spots/catalog,
/api/spots/route-distance, /api/spots/<id>."""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from spots.spots_model import fetch_drive_route
from spots.spots_service import (
    SpotNotFoundError,
    get_available_regions,
    get_catalog,
    get_spot_detail,
    recommend_spots,
)

spots_bp = Blueprint("spots", __name__, url_prefix="/api/spots")


@spots_bp.get("/recommend")
def recommend_route():
    exclude_ids = [x for x in request.args.get("exclude", "").split(",") if x]
    feedback_tags = [x for x in request.args.get("feedback", "").split(",") if x]
    region = request.args.get("region") or None
    # 디버그용 — 12/14/28/38 각 출처가 실제로 잘 불러와졌는지 확인할 때만 쓴다.
    source_type_raw = request.args.get("sourceType")
    source_content_type = int(source_type_raw) if source_type_raw else None
    spots = recommend_spots(exclude_ids, feedback_tags, region, source_content_type=source_content_type)
    return jsonify({"spots": spots})


@spots_bp.get("/regions")
def regions_route():
    return jsonify({"regions": get_available_regions()})


@spots_bp.get("/catalog")
def catalog_route():
    region = request.args.get("region") or None
    return jsonify({"spots": get_catalog(region)})


@spots_bp.get("/route-distance")
def route_distance_route():
    """내 위치 → 관광지 실제 도로 거리/시간(카카오모빌리티). 좌표는 프론트가 매 요청 보내온다
    (사용자마다 달라서 관광지 목록처럼 서버에 미리 캐싱해둘 수 없음)."""
    try:
        origin_lat = float(request.args["originLat"])
        origin_lng = float(request.args["originLng"])
        dest_lat = float(request.args["destLat"])
        dest_lng = float(request.args["destLng"])
    except (KeyError, ValueError):
        return jsonify({"success": False, "message": "좌표 파라미터가 필요합니다."}), 400

    result = fetch_drive_route(origin_lat, origin_lng, dest_lat, dest_lng)
    if result is None:
        return jsonify({"success": False}), 502
    return jsonify({"success": True, **result})


@spots_bp.get("/<spot_id>")
def detail_route(spot_id: str):
    try:
        spot = get_spot_detail(spot_id)
    except SpotNotFoundError:
        return jsonify({"success": False, "message": "존재하지 않는 관광지입니다."}), 404
    return jsonify({"success": True, "spot": spot})
