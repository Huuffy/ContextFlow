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


# ─── Stage 2: Python backend (uses pre-built base with all heavy deps) ─────────
FROM gcr.io/contextflow-497616/contextflow-base:latest
WORKDIR /app/backend

# Copy backend source code
COPY backend/ .

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
