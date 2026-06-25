"""로그인/회원가입 모델 계층.

LDAP 데이터 접근을 담당한다. `config.LDAP_MODE` 값으로 두 가지 백엔드를 고른다.

- "mock" (기본): ldap3 내장 in-memory LDAP 서버. Docker 불필요, 계정은
  JSON 파일(mock_ldap.json)로 영속화.
- "real": 실제 LDAP 서버(docker-compose의 OpenLDAP 등)에 TCP로 연결.
  .env의 LDAP_HOST/PORT/ADMIN_DN/ADMIN_PASSWORD를 사용.

서비스 계층은 아래 고수준 함수만 호출한다(모드와 무관):
- create_user(email, password)   : 계정 생성 (중복이면 UserExistsError)
- user_exists(email) -> bool     : 계정 존재 여부
- verify_credentials(email, pw)   : 비밀번호 검증(bool)
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import threading

from ldap3 import ALL, HASHED_SALTED_SHA, MOCK_SYNC, SUBTREE, Connection, Server
from ldap3.utils.conv import escape_filter_chars
from ldap3.utils.dn import escape_rdn
from ldap3.utils.hashed import hashed

from config import config

# 사용자 엔트리에 부여할 objectClass
USER_OBJECT_CLASSES = ["inetOrgPerson", "organizationalPerson", "person", "top"]

_LOCK = threading.RLock()


class UserExistsError(Exception):
    """이미 존재하는 이메일로 가입을 시도할 때."""


# ─────────────────────────── 공통 헬퍼 ───────────────────────────


def _user_dn(email: str) -> str:
    return f"uid={escape_rdn(email)},{config.LDAP_USER_OU}"


def _ou_value() -> str:
    # "ou=users,dc=comma,dc=tour" → "users"
    return config.LDAP_USER_OU.split(",")[0].split("=")[1]


def _user_filter(email: str) -> str:
    return f"(mail={escape_filter_chars(email)})"


def _find_entry(conn: Connection, email: str, attributes: list[str]):
    """이메일(mail)로 사용자 엔트리를 검색해 첫 결과를 반환(없으면 None)."""
    conn.search(
        search_base=config.LDAP_USER_OU,
        search_filter=_user_filter(email),
        search_scope=SUBTREE,
        attributes=attributes,
    )
    return conn.entries[0] if conn.entries else None


def _user_attributes(email: str, password: str) -> dict:
    """비밀번호를 SSHA 해시한 사용자 엔트리 속성."""
    return {
        "uid": email,
        "cn": email,
        "sn": email,
        "mail": email,
        "userPassword": hashed(HASHED_SALTED_SHA, password),
    }


# ══════════════════════════ mock 백엔드 ══════════════════════════
#  Docker 없이 동작. in-memory 디렉터리 + JSON 파일 영속화.

_ENTRIES_FILE = os.path.join(os.path.dirname(__file__), "mock_ldap.json")
_mock_conn: Connection | None = None


def _mock_base_entries() -> list[dict]:
    """최초 부트스트랩 엔트리(admin + 사용자 OU). entries_from_json 포맷."""
    return [
        {
            "dn": config.LDAP_ADMIN_DN,
            "raw": {
                "objectClass": ["simpleSecurityObject", "organizationalRole"],
                "cn": ["admin"],
                "userPassword": [config.LDAP_ADMIN_PASSWORD],
            },
        },
        {
            "dn": config.LDAP_USER_OU,
            "raw": {
                "objectClass": ["organizationalUnit", "top"],
                "ou": [_ou_value()],
            },
        },
    ]


def _mock_read() -> list[dict]:
    with open(_ENTRIES_FILE, encoding="utf-8") as f:
        return json.load(f).get("entries", [])


def _mock_write(entries: list[dict]) -> None:
    with open(_ENTRIES_FILE, "w", encoding="utf-8") as f:
        json.dump({"entries": entries}, f, ensure_ascii=False, indent=2)


def _mock_get_conn() -> Connection:
    """공유 mock 커넥션(최초 호출 시 파일 부트스트랩/로드)."""
    global _mock_conn
    if _mock_conn is not None:
        return _mock_conn

    if not os.path.exists(_ENTRIES_FILE):
        _mock_write(_mock_base_entries())

    conn = Connection(
        Server("mock_comma_ldap"),
        user=config.LDAP_ADMIN_DN,
        password=config.LDAP_ADMIN_PASSWORD,
        client_strategy=MOCK_SYNC,
    )
    conn.strategy.entries_from_json(_ENTRIES_FILE)  # admin/OU/사용자 복원
    conn.bind()  # admin 바인드
    _mock_conn = conn
    return _mock_conn


def _verify_ssha(password: str, stored) -> bool:
    """{ssha} 해시(또는 평문)와 비밀번호를 비교한다."""
    if stored is None:
        return False
    if isinstance(stored, bytes):
        stored = stored.decode("utf-8", "ignore")

    if stored[:6].lower() == "{ssha}":
        digest = base64.b64decode(stored[6:])
        sha_len = 20  # SHA-1
        hash_part, salt = digest[:sha_len], digest[sha_len:]
        return hashlib.sha1(password.encode("utf-8") + salt).digest() == hash_part
    return password == stored  # 평문 폴백


def _mock_user_exists(email: str) -> bool:
    conn = _mock_get_conn()
    return _find_entry(conn, email, ["mail"]) is not None


def _mock_create_user(email: str, password: str) -> None:
    conn = _mock_get_conn()
    if _find_entry(conn, email, ["mail"]) is not None:
        raise UserExistsError(email)

    dn = _user_dn(email)
    attrs = _user_attributes(email, password)

    ok = conn.add(dn, USER_OBJECT_CLASSES, attrs)  # in-memory 추가
    if not ok:
        if conn.result.get("result") == 68:  # entryAlreadyExists
            raise UserExistsError(email)
        raise RuntimeError(f"엔트리 추가 실패: {conn.result}")

    # 파일 영속화(raw 포맷: 값은 리스트)
    raw = {"objectClass": USER_OBJECT_CLASSES}
    raw.update({k: [v] for k, v in attrs.items()})
    entries = _mock_read()
    entries.append({"dn": dn, "raw": raw})
    _mock_write(entries)


def _mock_verify(email: str, password: str) -> bool:
    conn = _mock_get_conn()
    entry = _find_entry(conn, email, ["userPassword"])
    if entry is None:
        return False
    return _verify_ssha(password, entry.userPassword.value)


# ══════════════════════════ real 백엔드 ══════════════════════════
#  실제 LDAP 서버(OpenLDAP 등)에 연결. 회원가입=admin이 엔트리 추가,
#  로그인=사용자 본인 DN으로 bind 시도.


def _real_server() -> Server:
    return Server(
        host=config.LDAP_HOST,
        port=config.LDAP_PORT,
        use_ssl=config.LDAP_USE_SSL,
        get_info=ALL,
        connect_timeout=5,  # 서버 미동작 시 빨리 실패
    )


def _real_admin_conn() -> Connection:
    return Connection(
        _real_server(),
        user=config.LDAP_ADMIN_DN,
        password=config.LDAP_ADMIN_PASSWORD,
        auto_bind=True,
        receive_timeout=5,
    )


def _real_ensure_ou(conn: Connection) -> None:
    """사용자 OU가 없으면 생성(이미 있으면 무시)."""
    conn.add(config.LDAP_USER_OU, ["organizationalUnit", "top"], {"ou": _ou_value()})
    if conn.result.get("result") not in (0, 68):  # 0=성공, 68=이미 존재
        raise RuntimeError(f"사용자 OU 생성 실패: {conn.result}")


def _real_user_exists(email: str) -> bool:
    conn = _real_admin_conn()
    try:
        return _find_entry(conn, email, ["mail"]) is not None
    finally:
        conn.unbind()


def _real_create_user(email: str, password: str) -> None:
    conn = _real_admin_conn()
    try:
        _real_ensure_ou(conn)
        if _find_entry(conn, email, ["mail"]) is not None:
            raise UserExistsError(email)
        ok = conn.add(
            _user_dn(email), USER_OBJECT_CLASSES, _user_attributes(email, password)
        )
        if not ok:
            if conn.result.get("result") == 68:
                raise UserExistsError(email)
            raise RuntimeError(f"엔트리 추가 실패: {conn.result}")
    finally:
        conn.unbind()


def _real_verify(email: str, password: str) -> bool:
    # 1) admin으로 사용자 DN 조회
    conn = _real_admin_conn()
    try:
        entry = _find_entry(conn, email, ["mail"])
    finally:
        conn.unbind()
    if entry is None:
        return False

    # 2) 사용자 본인 자격증명으로 bind 시도
    user_conn = Connection(_real_server(), user=entry.entry_dn, password=password)
    try:
        return bool(user_conn.bind())
    finally:
        user_conn.unbind()


# ─────────────────────────── 공개 API(모드 분기) ───────────────────────────


def _is_real() -> bool:
    return config.LDAP_MODE == "real"


def user_exists(email: str) -> bool:
    with _LOCK:
        return _real_user_exists(email) if _is_real() else _mock_user_exists(email)


def create_user(email: str, password: str) -> None:
    """LDAP 디렉터리에 사용자 엔트리를 추가한다(비밀번호는 SSHA 해시)."""
    with _LOCK:
        if _is_real():
            _real_create_user(email, password)
        else:
            _mock_create_user(email, password)


def verify_credentials(email: str, password: str) -> bool:
    """이메일/비밀번호가 일치하면 True."""
    with _LOCK:
        return _real_verify(email, password) if _is_real() else _mock_verify(email, password)
