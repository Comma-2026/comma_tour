"""TourAPI 반려동물 정보를 갱신 가능한 로컬 인덱스로 수집한다."""
from __future__ import annotations

import argparse
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date

import requests

from spots import spots_model

BATCH_SIZE = 18
MAX_WORKERS = 3
AUTO_DAILY_LIMIT = 80
REFRESH_SECONDS = 7 * 24 * 60 * 60
INDEX_PATH = os.path.join(os.path.dirname(__file__), "spots", "pet_info_cache.json")
LOCK_PATH = INDEX_PATH + ".lock"


def load_index() -> dict:
    try:
        with open(INDEX_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError, json.JSONDecodeError):
        return {"checkedAt": {}, "spots": {}}


def save_index(payload: dict) -> None:
    temp_path = INDEX_PATH + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.replace(temp_path, INDEX_PATH)


def fetch_one(spot: dict) -> tuple[str, str | None]:
    rows = spots_model._tour_api_get("detailPetTour2", contentId=spot["id"])
    return spot["id"], spots_model._extract_pet_info(rows)


def migrate_checked_times(payload: dict) -> dict[str, int]:
    checked_at = {key: int(value) for key, value in payload.get("checkedAt", {}).items()}
    legacy_time = int(payload.get("updatedAt", 0))
    for spot_id in payload.get("checkedIds", []):
        checked_at.setdefault(spot_id, legacy_time)
    return checked_at


def main(*, automatic: bool = False, force: bool = False) -> None:
    try:
        lock_fd = os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        print("다른 반려동물 인덱스 갱신 작업이 이미 실행 중입니다.")
        return

    try:
        payload = load_index()
        checked_at = migrate_checked_times(payload)
        initial_build = not checked_at
        today = date.today().isoformat()
        if automatic and not initial_build and payload.get("lastAutoAttemptDate") == today:
            print("오늘 자동 갱신을 이미 실행했습니다.")
            return
        if automatic:
            payload["lastAutoAttemptDate"] = today
            save_index(payload)

        pet_spots: dict[str, str] = payload.get("spots", {})
        all_spots = spots_model.get_all_spots()
        cutoff = int(time.time()) - REFRESH_SECONDS
        due = [
            spot for spot in all_spots
            if force or checked_at.get(spot["id"], 0) < cutoff
        ]
        due.sort(key=lambda spot: checked_at.get(spot["id"], 0))
        if automatic and not initial_build:
            due = due[:AUTO_DAILY_LIMIT]

        print(f"전체 {len(all_spots)}곳 / 이번 갱신 {len(due)}곳")
        for offset in range(0, len(due), BATCH_SIZE):
            batch = due[offset : offset + BATCH_SIZE]
            limit_reached = False
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                futures = {executor.submit(fetch_one, spot): spot for spot in batch}
                for future in as_completed(futures):
                    spot = futures[future]
                    try:
                        spot_id, pet_info = future.result()
                    except requests.HTTPError as exc:
                        if exc.response is not None and exc.response.status_code == 429:
                            limit_reached = True
                        print(f"조회 실패: {spot['name']} ({type(exc).__name__})")
                        continue
                    except requests.RequestException as exc:
                        print(f"조회 실패: {spot['name']} ({type(exc).__name__})")
                        continue

                    checked_at[spot_id] = int(time.time())
                    if pet_info:
                        pet_spots[spot_id] = pet_info
                    else:
                        pet_spots.pop(spot_id, None)

            payload = {
                "updatedAt": int(time.time()),
                "lastAutoAttemptDate": payload.get("lastAutoAttemptDate"),
                "checkedAt": checked_at,
                "spots": pet_spots,
            }
            save_index(payload)
            print(f"갱신 {min(offset + len(batch), len(due))}/{len(due)} / 동반 가능 {len(pet_spots)}곳")
            if limit_reached:
                print("API 호출 제한에 도달했습니다. 다음 자동 갱신에서 이어집니다.")
                break
            time.sleep(0.25)
    finally:
        os.close(lock_fd)
        try:
            os.remove(LOCK_PATH)
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--auto", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    main(automatic=args.auto, force=args.force)
