#!/bin/bash
set -e

cd /app/backend

echo "[start.sh] Seeding demo data..."
python -m app.scripts.seed_db

echo "[start.sh] Starting ContextFlow on port ${PORT:-8080}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}"
