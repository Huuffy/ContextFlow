from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
import warnings
import os

# Kill HuggingFace rate-limit warnings and tqdm bars before any imports
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TQDM_DISABLE"] = "1"
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", message=".*HF Hub.*")
warnings.filterwarnings("ignore", message=".*unauthenticated.*")

from app.config import settings
from app.db.session import init_db
from app.db.lancedb_client import init_lancedb
from app.core.websocket import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Silence noisy third-party loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("watchfiles").setLevel(logging.WARNING)
logging.getLogger("multipart").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
logging.getLogger("transformers").setLevel(logging.ERROR)

_worker_tasks: list = []


def _preload_embedding_model() -> None:
    """Runs in a thread pool — loads the HF model without blocking the event loop."""
    from app.ai.embedder import get_model
    get_model()
    logger.info("Embedding model ready")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    settings.ensure_dirs()
    loop = asyncio.get_event_loop()

    # DB init (async) + LanceDB init (sync) run concurrently
    await asyncio.gather(
        init_db(),
        loop.run_in_executor(None, init_lancedb),
    )
    logger.info("DB initialized")

    # Fire off embedding model load in background — server is ready before it finishes
    loop.run_in_executor(None, _preload_embedding_model)

    # Start in-process workers
    from app.events.queues import inbound_queue, outbound_queue
    from app.events.inbound_worker import run_inbound_worker
    from app.events.outbound_worker import run_outbound_worker

    _worker_tasks.append(asyncio.create_task(run_inbound_worker(inbound_queue)))
    _worker_tasks.append(asyncio.create_task(run_outbound_worker(outbound_queue)))
    logger.info("Workers started")

    # Start Gmail IMAP poller (only if configured)
    if settings.gmail_address and settings.gmail_app_password:
        from app.integrations.email_poller import run_email_poller
        _worker_tasks.append(asyncio.create_task(run_email_poller(inbound_queue)))
        logger.info("Gmail IMAP poller started")

    # Start Telegram polling (only if configured + polling mode)
    if settings.telegram_bot_token and settings.telegram_use_polling:
        from app.integrations.telegram_poller import run_telegram_poller
        _worker_tasks.append(asyncio.create_task(run_telegram_poller(inbound_queue)))
        logger.info("Telegram poller started")

    # Start campaign scheduler — checks every 60s for due scheduled campaigns
    from app.events.campaign_scheduler import run_campaign_scheduler
    _worker_tasks.append(asyncio.create_task(run_campaign_scheduler()))
    logger.info("Campaign scheduler started")

    logger.info("Startup complete")
    yield

    for task in _worker_tasks:
        task.cancel()
    logger.info("Workers stopped")


from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

_limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="ContextFlow API", version="0.1.0", lifespan=lifespan, redirect_slashes=False)
app.state.limiter = _limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,"
    "https://contextflow.web.app,https://contextflow.firebaseapp.com"
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response: StarletteResponse = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# API routers
from app.api.v1.auth import router as auth_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.accounts import router as accounts_router
from app.api.v1.customers import router as customers_router
from app.api.v1.messages import router as messages_router
from app.api.v1.documents import router as documents_router
from app.api.v1.campaigns import router as campaigns_router
from app.api.v1.compliance import router as compliance_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.ai import router as ai_router
from app.api.v1.test_endpoints import router as test_router
from app.api.v1.register import router as register_router
from app.api.webhooks.simulator import router as simulator_router
from app.api.webhooks.meta import router as meta_router
from app.api.webhooks.telegram import router as telegram_router

app.include_router(auth_router, prefix="/api/v1")
app.include_router(conversations_router, prefix="/api/v1")
app.include_router(accounts_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")
app.include_router(messages_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(campaigns_router, prefix="/api/v1")
app.include_router(compliance_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(test_router, prefix="/api/v1")
app.include_router(register_router, prefix="/api/v1")
app.include_router(simulator_router, prefix="/api/webhooks")
app.include_router(meta_router, prefix="/api/webhooks")
app.include_router(telegram_router, prefix="/api/webhooks")


@app.websocket("/ws/agent/{agent_id}")
async def websocket_endpoint(websocket: WebSocket, agent_id: str):
    await ws_manager.connect(agent_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(agent_id, websocket)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "contextflow-backend"}


# ─── Serve React SPA (production / Cloud Run) ─────────────────────────────────
# Must be registered AFTER all API routes so the catch-all never intercepts /api/* or /ws/*
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend_dist"
# /app/backend/app/main.py → 3 parents up → /app/  → /app/frontend_dist

if _FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIST / "assets")), name="frontend-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(str(_FRONTEND_DIST / "index.html"))

    logger.info(f"Serving frontend from {_FRONTEND_DIST}")
