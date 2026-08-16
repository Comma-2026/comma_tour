# syntax=docker/dockerfile:1

FROM python:3.13-slim AS backend

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_HOST=0.0.0.0 \
    FLASK_PORT=5000

COPY requirements.txt ./
RUN tr -d '\r' < requirements.txt > requirements-normalized.txt \
    && sed -e '/^pywin32==/d' \
        -e 's/^PyMySQL==1\.4\.6$/PyMySQL==1.1.2/' \
        requirements-normalized.txt > requirements-linux.txt \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements-linux.txt

COPY backend ./backend

WORKDIR /app/backend
EXPOSE 5000

CMD ["python", "app.py"]


FROM node:24-bookworm-slim AS frontend

WORKDIR /app/frontend

ENV CI=1 \
    EXPO_NO_TELEMETRY=1

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./

EXPOSE 8081 19000 19001 19002

CMD ["npx", "expo", "start", "--web", "--host", "lan"]
