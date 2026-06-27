"""로그인/회원가입 라우트(블루프린트): /api/login, /api/signup."""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from login.service import AuthError, login, signup

login_bp = Blueprint("login", __name__, url_prefix="/api")


def _read_credentials():
    data = request.get_json(silent=True) or {}
    return data.get("email"), data.get("password")


@login_bp.post("/signup")
def signup_route():
    email, password = _read_credentials()
    try:
        result = signup(email, password)
    except AuthError as exc:
        return jsonify({"success": False, "message": exc.message}), exc.status_code
    return (
        jsonify({"success": True, "message": "회원가입이 완료되었습니다.", "user": result}),
        201,
    )


@login_bp.post("/login")
def login_route():
    email, password = _read_credentials()
    try:
        result = login(email, password)
    except AuthError as exc:
        return jsonify({"success": False, "message": exc.message}), exc.status_code
    return jsonify({"success": True, "message": "로그인 성공", "user": result}), 200
