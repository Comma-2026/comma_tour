"""다이어리 서비스 계층.

라우트 계층은 이 모듈만 호출하고, 저장(json/mysql) 세부 구현은 model 계층에 위임한다.
로그인 service의 AuthError와 동일하게, 도메인 에러는 DiaryError(status_code 포함)로 던진다.

일기는 계정별 소유다 — 모든 함수는 user_email(토큰에서 복원한 로그인 사용자)을 받아
그 사용자의 일기에만 접근한다. 사용자는 일기를 쓸 때 이메일을 입력하지 않는다(토큰에서 자동).

사진은 프론트에서 base64 문자열로 올라온다(photo_base64). 여기서 바이트로 디코드해
model에 photo_bytes로 넘기고, model이 저장 백엔드에 맞게(파일=base64 / MySQL=LONGBLOB) 담는다.
"""
from __future__ import annotations

import base64
import binascii
import uuid
from datetime import datetime, timezone
from functools import wraps

from diary import diary_model


class DiaryError(Exception):
    """다이어리 관련 도메인 에러. status_code로 HTTP 응답을 구분한다."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _storage_guard(fn):
    """저장소(json/mysql) 접근 중 예기치 못한 예외를 DiaryError(500)로 변환한다.

    이렇게 해야 MySQL 연결 실패 같은 오류가 raw 500(HTML)이 아니라 JSON 메시지로 내려가,
    프론트가 "서버에 연결할 수 없습니다" 대신 실제 원인을 보여줄 수 있다.
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except DiaryError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise DiaryError(
                f"일기 저장소 처리 중 오류입니다. MySQL 연결/비밀번호(.env) 설정을 확인하세요: {exc}",
                500,
            ) from exc

    return wrapper


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().replace(microsecond=0).isoformat()


def _clean(value, default: str = "") -> str:
    return (value or default).strip() if isinstance(value, str) else default


def _decode_photo(payload: dict) -> tuple[bytes | None, str | None]:
    """payload의 photo_base64를 바이트로 디코드한다. 없으면 (None, None).

    프론트가 'data:image/jpeg;base64,....' 형태(data URL)로 보내도 처리한다.
    """
    raw = payload.get("photo_base64")
    if not raw or not isinstance(raw, str):
        return None, None

    mime = _clean(payload.get("photo_mime")) or None
    if raw.startswith("data:"):
        header, _, data = raw.partition(",")
        raw = data
        if mime is None and ";" in header:
            mime = header[len("data:") : header.index(";")] or None

    try:
        photo_bytes = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        raise DiaryError("사진 데이터가 올바르지 않습니다.", 400)

    return photo_bytes, mime or "image/jpeg"


@_storage_guard
def list_diaries(user_email: str) -> list[dict]:
    """해당 사용자의 작성된 일기 전체를 최근 작성 순으로 반환."""
    return sorted(
        diary_model.get_all_diaries(user_email),
        key=lambda d: d.get("created_at", ""),
        reverse=True,
    )


@_storage_guard
def get_diary(user_email: str, pin_id: str) -> dict | None:
    return diary_model.get_diary_by_pin(user_email, pin_id)


@_storage_guard
def get_photo(user_email: str, pin_id: str) -> tuple[bytes, str] | None:
    return diary_model.get_photo(user_email, pin_id)


@_storage_guard
def create_diary(user_email: str, payload: dict) -> dict:
    """핀과 연결된 일기를 생성한다. 같은 사용자·핀에 이미 일기가 있으면 수정으로 처리한다."""
    pin_id = _clean(payload.get("pin_id"))
    place_name = _clean(payload.get("place_name"))
    content = _clean(payload.get("content"))

    if not pin_id:
        raise DiaryError("핀 정보(pin_id)가 없습니다.", 400)
    if not place_name:
        raise DiaryError("장소명이 없습니다.", 400)
    if not content:
        raise DiaryError("일기 내용을 입력해주세요.", 400)

    if diary_model.get_diary_by_pin(user_email, pin_id) is not None:
        return update_diary(user_email, pin_id, payload)

    photo_bytes, photo_mime = _decode_photo(payload)
    now = _now_iso()
    diary = {
        "id": uuid.uuid4().hex,
        "user_email": user_email,
        "pin_id": pin_id,
        "content_id": _clean(payload.get("content_id")) or None,
        "place_name": place_name,
        "region": _clean(payload.get("region")),
        "title": _clean(payload.get("title")),
        "content": content,
        "visited_at": _clean(payload.get("visited_at")) or None,
        "photo_bytes": photo_bytes,
        "photo_mime": photo_mime,
        "created_at": now,
        "updated_at": now,
    }
    return diary_model.create_diary(diary)


@_storage_guard
def update_diary(user_email: str, pin_id: str, payload: dict) -> dict:
    """기존 일기의 제목/내용(+ 새 사진이 올라왔으면 사진)을 수정한다."""
    content = _clean(payload.get("content"))
    if not content:
        raise DiaryError("일기 내용을 입력해주세요.", 400)

    fields = {
        "title": _clean(payload.get("title")),
        "content": content,
        "updated_at": _now_iso(),
    }
    # 새 사진이 올라온 경우에만 사진 필드를 넘긴다(없으면 기존 사진 유지).
    if payload.get("photo_base64"):
        photo_bytes, photo_mime = _decode_photo(payload)
        fields["photo_bytes"] = photo_bytes
        fields["photo_mime"] = photo_mime

    updated = diary_model.update_diary(user_email, pin_id, fields)
    if updated is None:
        raise DiaryError("수정할 일기를 찾지 못했습니다.", 404)
    return updated
