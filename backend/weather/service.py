import os
from datetime import datetime, timedelta
from urllib.parse import unquote
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

from weather.kma_grid import convert_to_grid


load_dotenv()

raw_service_key = os.getenv("KMA_SERVICE_KEY")

if not raw_service_key:
    raise RuntimeError(
        "backend/.env에 KMA_SERVICE_KEY가 설정되지 않았습니다."
    )

KMA_SERVICE_KEY = unquote(
    raw_service_key.strip().strip('"').strip("'")
)

KMA_FORECAST_URL = (
    "https://apis.data.go.kr/1360000/"
    "VilageFcstInfoService_2.0/getVilageFcst"
)

# 단기예보 발표 시각
BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]


def get_latest_base_datetime() -> tuple[str, str]:
    """
    가장 최근 단기예보 발표 일자와 시각을 반환합니다.
    """

    now = (
        datetime.now(ZoneInfo("Asia/Seoul"))
        - timedelta(minutes=10)
    )

    available_hours = [
        hour
        for hour in BASE_HOURS
        if hour <= now.hour
    ]

    if available_hours:
        base_datetime = now.replace(
            hour=max(available_hours),
            minute=0,
            second=0,
            microsecond=0,
        )
    else:
        previous_day = now - timedelta(days=1)

        base_datetime = previous_day.replace(
            hour=23,
            minute=0,
            second=0,
            microsecond=0,
        )

    return (
        base_datetime.strftime("%Y%m%d"),
        base_datetime.strftime("%H00"),
    )


def convert_sky_code(value: str) -> str:
    """
    SKY 코드 → 화면에 표시할 문자열
    """

    sky_map = {
        "1": "맑음",
        "3": "구름많음",
        "4": "흐림",
    }

    return sky_map.get(value, "알 수 없음")


def convert_pty_code(value: str) -> str:
    """
    PTY 코드 → 강수 형태
    """

    pty_map = {
        "0": "없음",
        "1": "비",
        "2": "비/눈",
        "3": "눈",
        "4": "소나기",
    }

    return pty_map.get(value, "알 수 없음")


def get_weather_forecast(
    latitude: float,
    longitude: float,
) -> dict:
    """
    위도/경도를 기준으로 오늘의 단기예보를 조회합니다.
    """

    # 1. 위경도 → 기상청 격자
    nx, ny = convert_to_grid(
        latitude,
        longitude,
    )

    # 2. 최근 발표 시각 계산
    base_date, base_time = get_latest_base_datetime()

    params = {
        "serviceKey": KMA_SERVICE_KEY,
        "pageNo": 1,
        "numOfRows": 1000,
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny,
    }

    # 3. 기상청 API 호출
    response = requests.get(
        KMA_FORECAST_URL,
        params=params,
        timeout=10,
    )

    response.raise_for_status()

    data = response.json()

    header = data["response"]["header"]

    if header["resultCode"] != "00":
        raise RuntimeError(
            f"기상청 API 오류: {header['resultMsg']}"
        )

    items = data["response"]["body"]["items"]["item"]

    # 오늘 날짜
    now = datetime.now(ZoneInfo("Asia/Seoul"))
    today = now.strftime("%Y%m%d")
    current_hour = now.strftime("%H00")

    today_items = [
        item
        for item in items
        if item["fcstDate"] == today
    ]

    # 현재 시각 이후의 가장 가까운 예보 시각
    future_times = sorted({
        item["fcstTime"]
        for item in today_items
        if item["fcstTime"] >= current_hour
    })

    target_time = (
        future_times[0]
        if future_times
        else None
    )

    temperature = None
    precipitation_probability = None
    min_temperature = None
    max_temperature = None
    sky = None
    precipitation_type = None

    for item in today_items:
        category = item["category"]
        value = item["fcstValue"]
        forecast_time = item["fcstTime"]

        # 현재 시각과 가장 가까운 시간대 예보
        if forecast_time == target_time:
            if category == "TMP":
                temperature = float(value)

            elif category == "POP":
                precipitation_probability = int(value)

            elif category == "SKY":
                sky = convert_sky_code(value)

            elif category == "PTY":
                precipitation_type = convert_pty_code(value)

        # 일 최저 / 최고
        if category == "TMN":
            min_temperature = float(value)

        elif category == "TMX":
            max_temperature = float(value)

    return {
        "latitude": latitude,
        "longitude": longitude,
        "nx": nx,
        "ny": ny,
        "temperature": temperature,
        "precipitationProbability": precipitation_probability,
        "minTemperature": min_temperature,
        "maxTemperature": max_temperature,
        "sky": sky,
        "precipitationType": precipitation_type,
        "forecastTime": target_time,
    }

if __name__ == "__main__":
    # 전주시청 근처 좌표
    weather = get_weather_forecast(
        35.8242,
        127.1480,
    )

    print(weather)