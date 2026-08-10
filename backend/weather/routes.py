from flask import Blueprint, jsonify, request

from weather.service import get_weather_forecast


weather_bp = Blueprint(
    "weather",
    __name__,
    url_prefix="/api/weather",
)


@weather_bp.get("")
def get_weather():
    latitude = request.args.get(
        "lat",
        type=float,
    )

    longitude = request.args.get(
        "lon",
        type=float,
    )

    if latitude is None or longitude is None:
        return jsonify({
            "message": "lat과 lon이 필요합니다."
        }), 400

    try:
        weather = get_weather_forecast(
            latitude,
            longitude,
        )

        return jsonify(weather), 200

    except Exception as error:
        print("[Weather API Error]", error)

        return jsonify({
            "message": "날씨 정보를 가져오지 못했습니다."
        }), 500