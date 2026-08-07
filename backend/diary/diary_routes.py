"""다이어리 라우트(블루프린트): /api/diary.

모든 엔드포인트는 로그인 토큰(Authorization: Bearer <token>)이 필요하며,
토큰에서 복원한 이메일의 일기에만 접근한다(계정별 소유).

- GET  /api/diary                    : 내 일기 전체 목록(최근순, 사진 바이트 제외)
- GET  /api/diary/pin/<pin_id>       : 내 특정 핀 일기 1개
- GET  /api/diary/pin/<pin_id>/photo : 그 일기에 첨부된 사진 원본(이미지)
- POST /api/diary                    : 일기 작성(핀과 연결, 사진 첨부 가능)
- PUT  /api/diary/pin/<pin_id>       : 일기 수정
"""
from __future__ import annotations

from flask import Blueprint, Response, jsonify, request

from auth_token import email_from_request
from diary.diary_service import (
    DiaryError,
    create_diary,
    get_diary,
    get_photo,
    list_diaries,
    update_diary,
)

diary_bp = Blueprint("diary", __name__, url_prefix="/api/diary")


def _require_user():
    """요청 토큰에서 로그인 사용자 이메일을 복원한다. 없으면 (None, 401응답)."""
    email = email_from_request(request)
    if email is None:
        return None, (jsonify({"success": False, "message": "로그인이 필요합니다."}), 401)
    return email, None


@diary_bp.get("")
def list_route():
    email, err = _require_user()
    if err:
        return err
    return jsonify({"diaries": list_diaries(email)})


@diary_bp.get("/pin/<pin_id>")
def detail_route(pin_id: str):
    email, err = _require_user()
    if err:
        return err
    diary = get_diary(email, pin_id)
    if diary is None:
        return jsonify({"success": False, "message": "작성된 일기가 없습니다."}), 404
    return jsonify({"success": True, "diary": diary})


@diary_bp.get("/pin/<pin_id>/photo")
def photo_route(pin_id: str):
    email, err = _require_user()
    if err:
        return err
    result = get_photo(email, pin_id)
    if result is None:
        return jsonify({"success": False, "message": "사진이 없습니다."}), 404
    photo_bytes, mime = result
    return Response(photo_bytes, mimetype=mime)


@diary_bp.post("")
def create_route():
    email, err = _require_user()
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    try:
        diary = create_diary(email, payload)
    except DiaryError as exc:
        return jsonify({"success": False, "message": exc.message}), exc.status_code
    return jsonify({"success": True, "diary": diary}), 201


@diary_bp.put("/pin/<pin_id>")
def update_route(pin_id: str):
    email, err = _require_user()
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    try:
        diary = update_diary(email, pin_id, payload)
    except DiaryError as exc:
        return jsonify({"success": False, "message": exc.message}), exc.status_code
    return jsonify({"success": True, "diary": diary}), 200
