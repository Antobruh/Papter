"""
RAG pipeline: retrieve relevant chunks → build prompt → call Ollama → extract citations.
"""
from __future__ import annotations

import logging
from typing import Generator

from backend.services import embeddings, vector_store
from backend.services.llm import generate, stream_generate
from backend.models.schemas import Citation

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a research assistant specialized in academic papers.
Answer questions ONLY using the provided context excerpts from the paper.
Be precise, cite evidence, and do not hallucinate facts not present in the excerpts.
If the context doesn't contain enough information, say so honestly.
Structure your answer clearly with paragraphs. Do not use markdown headers."""

N_CHUNKS = 6


def _build_context(chunks: list[vector_store.RetrievedChunk]) -> str:
    parts = []
    for i, c in enumerate(chunks, 1):
        loc = f"[Excerpt {i} | Page {c.page_number}, Para {c.paragraph_number}"
        if c.section_type:
            loc += f", Section: {c.section_type}"
        loc += "]"
        parts.append(f"{loc}\n{c.text}")
    return "\n\n---\n\n".join(parts)


def _build_prompt(question: str, context: str) -> str:
    return (
        f"Context from the research paper:\n\n{context}\n\n"
        f"---\n\nQuestion: {question}\n\nAnswer:"
    )


def _chunks_to_citations(chunks: list[vector_store.RetrievedChunk]) -> list[Citation]:
    seen = set()
    citations = []
    for c in chunks:
        key = (c.page_number, c.paragraph_number)
        if key in seen:
            continue
        seen.add(key)
        snippet = c.text[:200].strip()
        if len(c.text) > 200:
            snippet += "…"
        citations.append(
            Citation(
                page_number=c.page_number,
                paragraph_number=c.paragraph_number,
                section_type=c.section_type,
                snippet=snippet,
            )
        )
    return citations


def query(
    paper_id: str,
    question: str,
    model: str = "qwen3:8b",
) -> tuple[str, list[Citation]]:
    """
    Full RAG pipeline (blocking).
    Returns (answer_text, citations).
    """
    query_vec = embeddings.embed_query(question)
    chunks = vector_store.query_chunks(paper_id, query_vec, n_results=N_CHUNKS)

    if not chunks:
        return (
            "I couldn't find relevant sections in this paper to answer your question.",
            [],
        )

    context = _build_context(chunks)
    prompt = _build_prompt(question, context)
    answer = generate(prompt=prompt, model=model, system=SYSTEM_PROMPT)
    citations = _chunks_to_citations(chunks)
    return answer, citations


def stream_query(
    paper_id: str,
    question: str,
    model: str = "qwen3:8b",
) -> tuple[Generator[str, None, None], list[Citation]]:
    """
    Streaming RAG pipeline.
    Returns (token_generator, citations) — citations are ready immediately.
    """
    query_vec = embeddings.embed_query(question)
    chunks = vector_store.query_chunks(paper_id, query_vec, n_results=N_CHUNKS)
    citations = _chunks_to_citations(chunks)

    if not chunks:
        def _empty():
            yield "I couldn't find relevant sections in this paper to answer your question."
        return _empty(), []

    context = _build_context(chunks)
    prompt = _build_prompt(question, context)
    generator = stream_generate(prompt=prompt, model=model, system=SYSTEM_PROMPT)
    return generator, citations
