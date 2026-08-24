"""Flask 애플리케이션 진입점."""
import os
import subprocess
import sys

from flask import Flask, jsonify
from flask_cors import CORS

from config import config
from diary.diary_routes import diary_bp
from login.route import login_bp
from spots.spots_routes import spots_bp
from weather.routes import weather_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)  # 개발 단계: 모든 오리진 허용

    app.register_blueprint(login_bp)
    app.register_blueprint(spots_bp)
    app.register_blueprint(diary_bp)
    app.register_blueprint(weather_bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app


def start_pet_info_auto_refresh() -> None:
    """캐시가 없으면 전체 구축하고, 이후에는 별도 프로세스에서 하루치만 갱신한다."""
    if config.SPOT_MODE != "real":
        return
    script_path = os.path.join(os.path.dirname(__file__), "build_pet_info_index.py")
    creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    subprocess.Popen(
        [sys.executable, script_path, "--auto"],
        cwd=os.path.dirname(__file__),
        creationflags=creation_flags,
    )


app = create_app()
start_pet_info_auto_refresh()


if __name__ == "__main__":
    app.run(host=config.FLASK_HOST, port=config.FLASK_PORT, debug=config.FLASK_DEBUG)
