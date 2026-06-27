"""로그인/회원가입 서비스 계층.

라우트 계층은 이 모듈만 호출하고, LDAP 세부 구현은 model 계층에 위임한다.
"""
from __future__ import annotations

import re

from login import model

# 간단한 이메일 형식 검증
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

#비밀번호 형식 검증
_MIN_PASSWORD_LEN = 6
_PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$")

class AuthError(Exception):
    """인증 관련 도메인 에러. status_code로 HTTP 응답을 구분한다."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _validate_credentials(email: str, password: str) -> None:
    if not email or not password:
        raise AuthError("이메일과 비밀번호를 모두 입력해주세요.", 400)
    if not _EMAIL_RE.match(email):
        raise AuthError("올바른 이메일 형식이 아닙니다.", 400)
    if len(password) < _MIN_PASSWORD_LEN or not _PASSWORD_RE.match(password):
        raise AuthError(
            f"비밀번호는 최소 {_MIN_PASSWORD_LEN}자 이상이며, 영문·숫자·특수기호를 포함해야 합니다.",
            400,
        )


def signup(email: str, password: str) -> dict:
    """LDAP 디렉터리에 사용자 엔트리를 추가한다."""
    email = (email or "").strip().lower()
    _validate_credentials(email, password)

    try:
        model.create_user(email, password)
    except model.UserExistsError:
        raise AuthError("이미 가입된 이메일입니다.", 409)
    except Exception as exc:  # noqa: BLE001 - LDAP 오류는 500으로 변환
        raise AuthError(f"회원가입에 실패했습니다: {exc}", 500) from exc

    return {"email": email}


def login(email: str, password: str) -> dict:
    """이메일/비밀번호로 로그인 검증한다."""
    email = (email or "").strip().lower()
    if not email or not password:
        raise AuthError("이메일과 비밀번호를 모두 입력해주세요.", 400)

    try:
        ok = model.verify_credentials(email, password)
    except Exception as exc:  # noqa: BLE001
        raise AuthError(f"로그인 처리 중 오류가 발생했습니다: {exc}", 500) from exc

    if not ok:
        raise AuthError("이메일 또는 비밀번호가 올바르지 않습니다.", 401)

    return {"email": email}
