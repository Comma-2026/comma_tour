"""다이어리 데이터 접근 계층.

핀(프론트 로컬 저장)과 1:1로 연결되는 일기를 저장한다. `config.DIARY_MODE`로 백엔드 선택:

- "json" (기본): diaries_data.json 파일. 별도 DB 불필요(로그인/관광지 mock과 동일 방식).
  사진은 base64 문자열로 파일에 담는다.
- "mysql": MySQL 데이터베이스. 일기 내용과 사진(LONGBLOB)을 한 행에 함께 저장한다.
  DB·테이블은 첫 요청 시 자동 생성한다(CREATE DATABASE/TABLE IF NOT EXISTS).

서비스 계층은 아래 고수준 함수만 호출한다(모드와 무관):
- get_all_diaries() -> list[dict]         : 사진 바이트를 뺀 공개 dict 목록
- get_diary_by_pin(pin_id) -> dict | None : 공개 dict 1개
- get_photo(pin_id) -> (bytes, mime) | None : 사진 원본 바이트
- create_diary(diary) -> dict             : 생성 후 공개 dict
- update_diary(pin_id, fields) -> dict|None: 수정 후 공개 dict

저장용 dict(create_diary 인자)는 photo_bytes(bytes|None) + photo_mime(str|None)를 포함하고,
공개 dict은 사진 바이트 대신 has_photo(bool)만 담는다(목록 응답이 무거워지지 않도록).
"""
from __future__ import annotations

import base64
import json
import os
import threading

from config import config

# 공개 dict(프론트로 내려가는 응답)에 담는 필드 — 사진 바이트는 제외한다.
_PUBLIC_KEYS = [
    "id",
    "pin_id",
    "content_id",
    "place_name",
    "region",
    "title",
    "content",
    "visited_at",
    "created_at",
    "updated_at",
]

_LOCK = threading.RLock()


def _is_mysql() -> bool:
    return config.DIARY_MODE == "mysql"


# ══════════════════════════ json 백엔드 ══════════════════════════

_DATA_FILE = os.path.join(os.path.dirname(__file__), "diaries_data.json")


def _json_read() -> list[dict]:
    if not os.path.exists(_DATA_FILE):
        return []
    with open(_DATA_FILE, encoding="utf-8") as f:
        try:
            return json.load(f).get("diaries", [])
        except (json.JSONDecodeError, ValueError):
            return []


def _json_write(diaries: list[dict]) -> None:
    with open(_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump({"diaries": diaries}, f, ensure_ascii=False, indent=2)


def _json_public(entry: dict) -> dict:
    pub = {k: entry.get(k) for k in _PUBLIC_KEYS}
    pub["has_photo"] = bool(entry.get("photo_base64"))
    return pub


def _json_get_all() -> list[dict]:
    return [_json_public(e) for e in _json_read()]


def _json_get_by_pin(pin_id: str) -> dict | None:
    entry = next((e for e in _json_read() if e.get("pin_id") == pin_id), None)
    return _json_public(entry) if entry else None


def _json_get_photo(pin_id: str) -> tuple[bytes, str] | None:
    entry = next((e for e in _json_read() if e.get("pin_id") == pin_id), None)
    if not entry or not entry.get("photo_base64"):
        return None
    return base64.b64decode(entry["photo_base64"]), entry.get("photo_mime") or "image/jpeg"


def _json_create(diary: dict) -> dict:
    entry = {k: diary.get(k) for k in _PUBLIC_KEYS}
    photo_bytes = diary.get("photo_bytes")
    entry["photo_base64"] = base64.b64encode(photo_bytes).decode() if photo_bytes else None
    entry["photo_mime"] = diary.get("photo_mime")

    diaries = _json_read()
    diaries.append(entry)
    _json_write(diaries)
    return _json_public(entry)


def _json_update(pin_id: str, fields: dict) -> dict | None:
    diaries = _json_read()
    for entry in diaries:
        if entry.get("pin_id") != pin_id:
            continue
        entry["title"] = fields.get("title", entry.get("title"))
        entry["content"] = fields.get("content", entry.get("content"))
        entry["updated_at"] = fields.get("updated_at", entry.get("updated_at"))
        # 사진은 새로 올라온 경우에만 교체한다(없으면 기존 사진 유지).
        if "photo_bytes" in fields:
            pb = fields["photo_bytes"]
            entry["photo_base64"] = base64.b64encode(pb).decode() if pb else None
            entry["photo_mime"] = fields.get("photo_mime")
        _json_write(diaries)
        return _json_public(entry)
    return None


# ══════════════════════════ mysql 백엔드 ══════════════════════════

_schema_ready = False


def _mysql_connect(with_db: bool = True):
    import pymysql
    from pymysql.constants import CLIENT

    kwargs = dict(
        host=config.MYSQL_HOST,
        port=config.MYSQL_PORT,
        user=config.MYSQL_USER,
        password=config.MYSQL_PASSWORD,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=5,
        # UPDATE affected_rows가 "값이 바뀐 행"이 아니라 "매칭된 행" 기준이 되게 한다
        # (내용이 동일해도 수정 요청이 성공으로 처리되도록).
        client_flag=CLIENT.FOUND_ROWS,
    )
    if with_db:
        kwargs["database"] = config.MYSQL_DB
    return pymysql.connect(**kwargs)


_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS diaries (
    id          VARCHAR(64)  PRIMARY KEY,
    pin_id      VARCHAR(64)  NOT NULL UNIQUE,
    content_id  VARCHAR(64)  NULL,
    place_name  VARCHAR(255) NOT NULL,
    region      VARCHAR(100) NULL,
    title       VARCHAR(120) NULL,
    content     TEXT         NOT NULL,
    visited_at  VARCHAR(20)  NULL,
    photo       LONGBLOB     NULL,
    photo_mime  VARCHAR(60)  NULL,
    created_at  VARCHAR(40)  NOT NULL,
    updated_at  VARCHAR(40)  NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
"""


def _mysql_ensure_schema() -> None:
    """DB와 테이블을 한 번만 생성한다(이미 있으면 무시)."""
    global _schema_ready
    if _schema_ready:
        return
    with _LOCK:
        if _schema_ready:
            return
        # 1) DB 생성 — 데이터베이스 지정 없이 접속해서 만든다.
        conn = _mysql_connect(with_db=False)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"CREATE DATABASE IF NOT EXISTS `{config.MYSQL_DB}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            conn.commit()
        finally:
            conn.close()
        # 2) 테이블 생성
        conn = _mysql_connect()
        try:
            with conn.cursor() as cur:
                cur.execute(_CREATE_TABLE_SQL)
            conn.commit()
        finally:
            conn.close()
        _schema_ready = True


def _mysql_get_all() -> list[dict]:
    _mysql_ensure_schema()
    conn = _mysql_connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, pin_id, content_id, place_name, region, title, content, "
                "visited_at, created_at, updated_at, (photo IS NOT NULL) AS has_photo "
                "FROM diaries ORDER BY created_at DESC"
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    for row in rows:
        row["has_photo"] = bool(row["has_photo"])
    return rows


def _mysql_get_by_pin(pin_id: str) -> dict | None:
    _mysql_ensure_schema()
    conn = _mysql_connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, pin_id, content_id, place_name, region, title, content, "
                "visited_at, created_at, updated_at, (photo IS NOT NULL) AS has_photo "
                "FROM diaries WHERE pin_id = %s",
                (pin_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if row:
        row["has_photo"] = bool(row["has_photo"])
    return row


def _mysql_get_photo(pin_id: str) -> tuple[bytes, str] | None:
    _mysql_ensure_schema()
    conn = _mysql_connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT photo, photo_mime FROM diaries WHERE pin_id = %s", (pin_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row or row["photo"] is None:
        return None
    return row["photo"], row["photo_mime"] or "image/jpeg"


def _mysql_create(diary: dict) -> dict:
    _mysql_ensure_schema()
    conn = _mysql_connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO diaries "
                "(id, pin_id, content_id, place_name, region, title, content, "
                "visited_at, photo, photo_mime, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    diary["id"],
                    diary["pin_id"],
                    diary.get("content_id"),
                    diary["place_name"],
                    diary.get("region"),
                    diary.get("title"),
                    diary["content"],
                    diary.get("visited_at"),
                    diary.get("photo_bytes"),
                    diary.get("photo_mime"),
                    diary["created_at"],
                    diary["updated_at"],
                ),
            )
        conn.commit()
    finally:
        conn.close()
    return _mysql_get_by_pin(diary["pin_id"])


def _mysql_update(pin_id: str, fields: dict) -> dict | None:
    _mysql_ensure_schema()
    set_cols = ["title = %s", "content = %s", "updated_at = %s"]
    values: list = [fields.get("title"), fields.get("content"), fields.get("updated_at")]
    if "photo_bytes" in fields:
        set_cols += ["photo = %s", "photo_mime = %s"]
        values += [fields["photo_bytes"], fields.get("photo_mime")]
    values.append(pin_id)

    conn = _mysql_connect()
    try:
        with conn.cursor() as cur:
            affected = cur.execute(
                f"UPDATE diaries SET {', '.join(set_cols)} WHERE pin_id = %s", values
            )
        conn.commit()
    finally:
        conn.close()
    if not affected:
        return None
    return _mysql_get_by_pin(pin_id)


# ─────────────────────────── 공개 API(모드 분기) ───────────────────────────


def get_all_diaries() -> list[dict]:
    with _LOCK:
        return _mysql_get_all() if _is_mysql() else _json_get_all()


def get_diary_by_pin(pin_id: str) -> dict | None:
    with _LOCK:
        return _mysql_get_by_pin(pin_id) if _is_mysql() else _json_get_by_pin(pin_id)


def get_photo(pin_id: str) -> tuple[bytes, str] | None:
    with _LOCK:
        return _mysql_get_photo(pin_id) if _is_mysql() else _json_get_photo(pin_id)


def create_diary(diary: dict) -> dict:
    with _LOCK:
        return _mysql_create(diary) if _is_mysql() else _json_create(diary)


def update_diary(pin_id: str, fields: dict) -> dict | None:
    with _LOCK:
        return _mysql_update(pin_id, fields) if _is_mysql() else _json_update(pin_id, fields)
