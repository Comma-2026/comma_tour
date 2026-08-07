"""로그인 토큰 발급/검증 (itsdangerous 서명 토큰).

계정 정보는 LDAP에 그대로 두고, 로그인 성공 시 이메일을 담은 서명 토큰만 발급한다.
서버 SECRET_KEY로 서명하므로 클라이언트가 위조할 수 없고, 별도 세션 저장소가 필요 없다.
토큰은 stateless라서 서버를 재시작해도 유효하다(SECRET_KEY가 같은 한).

일기 API는 요청의 `Authorization: Bearer <token>` 헤더에서 이메일을 복원해 소유자를 정한다.
"""
from __future__ import annotations

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from config import config

_SALT = "comma-tour-auth"
# 토큰 유효기간(초). 기본 30일.
_MAX_AGE_SECONDS = 60 * 60 * 24 * 30


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(config.SECRET_KEY, salt=_SALT)


def issue_token(email: str) -> str:
    """이메일을 담은 서명 토큰을 발급한다."""
    return _serializer().dumps(email)


def verify_token(token: str | None) -> str | None:
    """토큰이 유효하면 담긴 이메일을, 아니면 None을 반환한다."""
    if not token:
        return None
    try:
        return _serializer().loads(token, max_age=_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None


def email_from_request(request) -> str | None:
    """Flask request의 Authorization: Bearer <token> 헤더에서 이메일을 복원한다."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return verify_token(header[len("Bearer "):].strip())
