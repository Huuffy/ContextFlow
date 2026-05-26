import asyncio
from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)

_model: SentenceTransformer | None = None
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {MODEL_NAME}")
        _model = SentenceTransformer(MODEL_NAME)
        logger.info("Embedding model loaded")
    return _model


def embed(text: str) -> list[float]:
    return get_model().encode(text, normalize_embeddings=True, show_progress_bar=False).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    return get_model().encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()


async def embed_async(text: str) -> list[float]:
    """Non-blocking embed — runs CPU work in the default thread executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, embed, text)
