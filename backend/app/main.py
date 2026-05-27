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

    logger.info("Startup complete")
    yield

    for task in _worker_tasks:
        task.cancel()
    logger.info("Workers stopped")


app = FastAPI(title="ContextFlow API", version="0.1.0", lifespan=lifespan, redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            # Keep connection alive; client can send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(agent_id, websocket)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "contextflow-backend"}
