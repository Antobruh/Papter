"""
Papter FastAPI application entry point.
"""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from backend.db.database import AsyncSessionLocal, init_db
from backend.db.models import Paper
from backend.routers import analysis, chat, compare, papers
from backend.services import embeddings
from backend.services.llm import check_ollama
from backend.models.schemas import HealthOut, OllamaStatus

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))


async def _recover_stuck_papers() -> None:
    """
    On startup, find any papers left in 'pending' or 'processing' state
    (e.g. from a previous crash) and re-queue their ingestion.
    """
    from backend.routers.papers import _ingest_paper

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Paper).where(Paper.status.in_(["pending", "processing"]))
        )
        stuck = result.scalars().all()

    if not stuck:
        logger.info("No stuck papers found on startup.")
        return

    logger.warning(
        "Found %d stuck paper(s) from a previous run — re-queuing ingestion.", len(stuck)
    )
    for paper in stuck:
        # Reconstruct the PDF path from the upload directory
        matches = list(UPLOAD_DIR.glob(f"{paper.id}_*"))
        if not matches:
            logger.error(
                "PDF file for paper %s not found in %s — marking as error.",
                paper.id, UPLOAD_DIR,
            )
            async with AsyncSessionLocal() as db:
                p = await db.get(Paper, paper.id)
                if p:
                    p.status = "error"
                    p.error_message = "PDF file missing after server restart."
                    await db.commit()
            continue

        pdf_path = str(matches[0])
        logger.info("Re-queuing ingestion for paper %s (%s)", paper.id, pdf_path)
        # Fire-and-forget as a background asyncio task
        asyncio.create_task(_ingest_paper(paper.id, pdf_path))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, preload embedding model, recover stuck papers."""
    logger.info("Initialising database …")
    await init_db()
    logger.info("Preloading BGE embedding model …")
    embeddings.preload()
    ollama = check_ollama()
    if ollama["available"]:
        logger.info("Ollama detected. Models: %s", ollama["models"])
    else:
        logger.warning("Ollama not available: %s", ollama["error"])
    # Re-queue any papers stuck in pending/processing from a prior crash
    await _recover_stuck_papers()
    yield
    logger.info("Shutting down Papter backend.")


app = FastAPI(
    title="Papter API",
    description="Open-source AI research paper simplification platform.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js dev server and production origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(papers.router)
app.include_router(analysis.router)
app.include_router(chat.router)
app.include_router(compare.router)


@app.get("/api/health", response_model=HealthOut, tags=["system"])
async def health():
    ollama_data = check_ollama()
    return HealthOut(
        status="ok",
        ollama=OllamaStatus(**ollama_data),
    )
