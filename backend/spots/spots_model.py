"""관광지 데이터 접근 계층.

지금은 `spots_data.json`(경북 저밀도 관광지 목록)에서 읽어온다. 추후 한국관광공사
혼잡도 예측 API 연동 시, 이 파일의 `get_random_spots`만 실제 API 호출로 교체하면 된다.
"""
from __future__ import annotations

import json
import os

_DATA_FILE = os.path.join(os.path.dirname(__file__), "spots_data.json")

_spots_cache: list[dict] | None = None


def _load_spots() -> list[dict]:
    global _spots_cache
    if _spots_cache is None:
        with open(_DATA_FILE, encoding="utf-8") as f:
            _spots_cache = json.load(f)["spots"]
    return _spots_cache


def get_all_spots() -> list[dict]:
    return _load_spots()


def get_spot_by_id(spot_id: str) -> dict | None:
    return next((s for s in _load_spots() if s["id"] == spot_id), None)
