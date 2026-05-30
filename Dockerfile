# ─── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

RUN npm install -g pnpm

# Install deps first (layer cache — only re-runs if lockfile changes)
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ .
RUN pnpm build
# Output: /app/frontend/dist


# ─── Stage 2: Python backend ───────────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app/backend

# uv — fast Python package installer
RUN pip install --no-cache-dir uv

# Install Python dependencies
COPY backend/ .
RUN uv pip install --system --no-cache .

# Pre-download HuggingFace embedding model at build time
# Eliminates the cold-start download on first request
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# whitelist.json — campaign contacts registered via landing page
# campaigns.py resolves WHITELIST_PATH as 5 parent dirs up from v1/campaigns.py = /app/whitelist.json
COPY whitelist.json /app/whitelist.json

# Frontend build output served by FastAPI at /
COPY --from=frontend-build /app/frontend/dist /app/frontend_dist

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Cloud Run injects PORT at runtime (default 8080)
ENV PORT=8080
EXPOSE 8080

CMD ["/app/start.sh"]
