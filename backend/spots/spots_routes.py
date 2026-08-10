"""관광지 라우트(블루프린트): /api/spots/recommend, /api/spots/regions, /api/spots/catalog, /api/spots/<id>."""
from __future__ import annotations

from flask import Blueprint, jsonify, request

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
    spots = recommend_spots(exclude_ids, feedback_tags, region)
    return jsonify({"spots": spots})


@spots_bp.get("/regions")
def regions_route():
    return jsonify({"regions": get_available_regions()})


@spots_bp.get("/catalog")
def catalog_route():
    region = request.args.get("region") or None
    return jsonify({"spots": get_catalog(region)})


@spots_bp.get("/<spot_id>")
def detail_route(spot_id: str):
    try:
        spot = get_spot_detail(spot_id)
    except SpotNotFoundError:
        return jsonify({"success": False, "message": "존재하지 않는 관광지입니다."}), 404
    return jsonify({"success": True, "spot": spot})
