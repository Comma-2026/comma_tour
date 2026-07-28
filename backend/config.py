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

    # --- 관광지 데이터 동작 모드 ---
    #   mock : spots_data.json 목업 데이터 (기본값)
    #   real : 한국관광공사 TourAPI 등 실제 API 연동
    SPOT_MODE = os.getenv("SPOT_MODE", "mock").lower()

    # --- 한국관광공사 TourAPI (SPOT_MODE=real 일 때 사용) ---
    # data.go.kr에서 발급받은 "Decoding" 키를 넣는다 (requests가 자동 인코딩하므로).
    TOUR_API_KEY = os.getenv("TOUR_API_KEY")
    TOUR_API_BASE_URL = os.getenv("TOUR_API_BASE_URL", "https://apis.data.go.kr/B551011/KorService2")
    # TourAPI areaCode(구 코드 체계, areaBasedList2 등에서 사용): 경상북도 = 35
    TOUR_AREA_CODE = os.getenv("TOUR_AREA_CODE", "35")
    # 법정동 코드(신 코드 체계, 집중률·웰니스 API에서 사용): 경상북도 = 47
    TOUR_LDONG_REGN_CD = os.getenv("TOUR_LDONG_REGN_CD", "47")

    # 집중률·웰니스 API는 별도 키가 발급되면 그걸 쓰고, 없으면 국문 관광정보 키를 그대로 쓴다
    TOUR_CONGESTION_API_KEY = os.getenv("TOUR_CONGESTION_API_KEY") or TOUR_API_KEY
    TOUR_WELLNESS_API_KEY = os.getenv("TOUR_WELLNESS_API_KEY") or TOUR_API_KEY

    # SPOT_MODE=real일 때 목록/집중률/웰니스/상세 조회 결과를 이 초 동안 메모리에 캐싱한다.
    # (일일 트래픽 1000회 제한 보호용 — 요청마다 실제 API를 다시 부르지 않도록)
    SPOT_CACHE_TTL_SECONDS = int(os.getenv("SPOT_CACHE_TTL_SECONDS", "3600"))


config = Config()
