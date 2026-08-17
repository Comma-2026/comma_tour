# comma_tour

node 버전 : v24.14.0

npm -v : 11.9.0

SDK : 54

여러분은 pull받으시고 frontend파일 위치에서 npm install expo하시면 됩니다.(프론트 설정)

FLASK 서버 사용

Version: 3.1.3

## Docker Desktop 실행

Docker Desktop을 실행한 뒤 프로젝트 루트에서 아래 명령어를 실행합니다.

```bash
docker compose up --build
```

- Flask 백엔드: http://localhost:5000/api/health
- Expo 웹 프론트엔드: http://localhost:8081
- phpLDAPadmin: http://localhost:8080

중지할 때는 `Ctrl+C`를 누른 뒤 아래 명령어를 실행합니다.

```bash
docker compose down
```

**참고**
Flask를 따로 임의로 깔지 마시고 터미널에

```
pip install -r requirements.txt
```

라고 치시면 저랑 동일한 flask가 깔립니다.

### 커밋 메시지 규칙

- FEAT: 새로운 기능 추가
- FIX: 버그 수정
- DOCS: 문서 변경
- STYLE: 코드 포맷팅, 세미콜론 누락 등 코드 변경이 없는 경우
- REFACTOR: 코드 리팩토링 (기능 변경 없음)
- TEST: 누락된 테스트 추가 또는 기존 테스트 수정
- CHORE: 빌드 프로세스 또는 보조 도구 수정 (라이브러리 추가 등)
- PERF: 성능 향상 관련 변경
- BUILD: 빌드 관련 파일 변경
