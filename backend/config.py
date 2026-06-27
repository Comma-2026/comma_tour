"""환경 변수 로딩 및 설정값 정의."""
import os

from dotenv import load_dotenv

# 프로젝트 루트(.env)를 읽어온다.
load_dotenv()


class Config:
    """LDAP / Flask 설정값."""

    # --- Flask ---
    FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
    FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"

    # --- LDAP 동작 모드 ---
    #   mock : ldap3 내장 in-memory 서버 (Docker 불필요, 기본값)
    #   real : 실제 LDAP 서버(docker-compose의 OpenLDAP 등)에 연결
    LDAP_MODE = os.getenv("LDAP_MODE", "mock").lower()

    # --- LDAP 서버 접속 (LDAP_MODE=real 일 때 사용) ---
    LDAP_HOST = os.getenv("LDAP_HOST", "localhost")
    LDAP_PORT = int(os.getenv("LDAP_PORT", "389"))
    LDAP_USE_SSL = os.getenv("LDAP_USE_SSL", "false").lower() == "true"

    # 관리자(admin) 바인드 계정 — 회원가입 시 엔트리 추가에 사용
    LDAP_ADMIN_DN = os.getenv("LDAP_ADMIN_DN", "cn=admin,dc=comma,dc=tour")
    LDAP_ADMIN_PASSWORD = os.getenv("LDAP_ADMIN_PASSWORD", "admin")

    # 디렉터리 기준 DN과 사용자 OU
    LDAP_BASE_DN = os.getenv("LDAP_BASE_DN", "dc=comma,dc=tour")
    LDAP_USER_OU = os.getenv("LDAP_USER_OU", "ou=users,dc=comma,dc=tour")


config = Config()
