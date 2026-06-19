"""
Embedding service using BAAI/bge-small-en-v1.5 (local, no API key required).
The model is loaded once at application startup and reused for every request.
"""
from __future__ import annotations

import logging
from functools import lru_cache

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

MODEL_NAME = "BAAI/bge-small-en-v1.5"
# BGE models perform better when queries are prefixed (see model card).
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    logger.info("Loading embedding model %s …", MODEL_NAME)
    model = SentenceTransformer(MODEL_NAME)
    logger.info("Embedding model loaded.")
    return model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of document passages (no prefix needed for passages)."""
    if not texts:
        return []
    model = _get_model()
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return [v.tolist() for v in vectors]


def embed_query(query: str) -> list[float]:
    """Embed a search query with the BGE query prefix."""
    model = _get_model()
    vector = model.encode(
        QUERY_PREFIX + query, normalize_embeddings=True, show_progress_bar=False
    )
    return vector.tolist()


def preload() -> None:
    """Call at startup so the first request isn't slow."""
    _get_model()
