"""Flask 애플리케이션 진입점."""
from flask import Flask, jsonify
from flask_cors import CORS

from config import config
from login.route import login_bp
from spots.spots_routes import spots_bp
from weather.routes import weather_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)  # 개발 단계: 모든 오리진 허용

    app.register_blueprint(login_bp)
    app.register_blueprint(spots_bp)
    app.register_blueprint(weather_bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host=config.FLASK_HOST, port=config.FLASK_PORT, debug=config.FLASK_DEBUG)
