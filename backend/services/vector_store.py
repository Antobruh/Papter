"""
ChromaDB vector store wrapper.
Each paper gets its own collection: paper_<paper_id>.
Embeddings are provided externally (from embeddings.py) so ChromaDB runs in
embedding-free mode (no additional model download by Chroma itself).
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from functools import lru_cache

import chromadb

logger = logging.getLogger(__name__)

CHROMA_PATH = "./chroma_data"


@lru_cache(maxsize=1)
def _get_client() -> chromadb.ClientAPI:
    logger.info("Initialising ChromaDB at %s", CHROMA_PATH)
    return chromadb.PersistentClient(path=CHROMA_PATH)


def _collection_name(paper_id: str) -> str:
    # Chroma collection names must be 3-63 chars, alphanumeric + hyphens/underscores
    return f"paper_{paper_id.replace('-', '_')}"


@dataclass
class RetrievedChunk:
    chroma_id: str
    text: str
    page_number: int
    paragraph_number: int
    section_type: str | None
    distance: float


def upsert_chunks(
    paper_id: str,
    texts: list[str],
    embeddings: list[list[float]],
    metadatas: list[dict],
) -> list[str]:
    """
    Insert or update chunks for a paper. Returns the list of chroma IDs.
    metadatas items must include: page_number, paragraph_number, section_type.
    """
    client = _get_client()
    col = client.get_or_create_collection(
        name=_collection_name(paper_id),
        metadata={"hnsw:space": "cosine"},
    )
    ids = [str(uuid.uuid4()) for _ in texts]
    col.upsert(ids=ids, documents=texts, embeddings=embeddings, metadatas=metadatas)
    logger.info("Upserted %d chunks for paper %s", len(texts), paper_id)
    return ids


def query_chunks(
    paper_id: str,
    query_embedding: list[float],
    n_results: int = 6,
) -> list[RetrievedChunk]:
    """Retrieve top-n chunks most similar to query_embedding."""
    client = _get_client()
    col_name = _collection_name(paper_id)
    try:
        col = client.get_collection(col_name)
    except Exception:
        logger.warning("Collection %s not found", col_name)
        return []

    results = col.query(
        query_embeddings=[query_embedding],
        n_results=min(n_results, col.count()),
        include=["documents", "metadatas", "distances"],
    )

    chunks: list[RetrievedChunk] = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        dist = results["distances"][0][i]
        chunks.append(
            RetrievedChunk(
                chroma_id=results["ids"][0][i],
                text=doc,
                page_number=int(meta.get("page_number", 0)),
                paragraph_number=int(meta.get("paragraph_number", 0)),
                section_type=meta.get("section_type"),
                distance=dist,
            )
        )
    return chunks


def delete_paper_collection(paper_id: str) -> None:
    """Remove all vectors for a deleted paper."""
    client = _get_client()
    col_name = _collection_name(paper_id)
    try:
        client.delete_collection(col_name)
        logger.info("Deleted collection %s", col_name)
    except Exception:
        pass
