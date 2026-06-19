"""
Papers router: upload, list, get, delete.
The upload endpoint runs the full ingestion pipeline:
  PDF → extract → chunk → embed → ChromaDB → SQLite → analyze (async background).
"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.database import get_db
from backend.db.models import Analysis, Chunk, Paper, PaperSection
from backend.models.schemas import PaperListItem, PaperOut
from backend.services import embeddings, vector_store
from backend.services.chunker import chunk_paragraphs

# Import the existing pdf_processor from the repo root (also copied to backend/)
try:
    from backend.pdf_processor import extract_paper
except ImportError:
    from pdf_processor import extract_paper  # fallback for direct run

router = APIRouter(prefix="/api/papers", tags=["papers"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_MODEL = os.getenv("DEFAULT_LLM_MODEL", "qwen3:8b")

# In-memory set of paper IDs that have been deleted while processing.
# The background task checks this to abort early.
_deleting_paper_ids: set[str] = set()


# ---------------------------------------------------------------------------
# Background ingestion
# ---------------------------------------------------------------------------

async def _ingest_paper(paper_id: str, pdf_path: str) -> None:
    """Run in background: extract, chunk, embed, store analyses."""
    from backend.db.database import AsyncSessionLocal
    from backend.services.summarizer import run_all_analyses
    import json

    def _is_cancelled() -> bool:
        return paper_id in _deleting_paper_ids

    async with AsyncSessionLocal() as db:
        try:
            # 1. Extract PDF (long-running — check cancellation after)
            result = await asyncio.get_event_loop().run_in_executor(
                None, extract_paper, pdf_path
            )

            # Abort if paper was deleted while we were extracting
            if _is_cancelled():
                logger.info("Ingestion aborted (paper %s was deleted).", paper_id)
                return

            # 2. Update paper metadata
            paper = await db.get(Paper, paper_id)
            if not paper:
                return
            paper.title = result.title
            paper.authors = result.authors
            paper.page_count = result.page_count
            paper.status = "processing"
            await db.commit()

            # 3. Store sections
            for sec in result.sections:
                db.add(PaperSection(
                    paper_id=paper_id,
                    section_type=sec.section_type,
                    heading_text=sec.heading_text,
                    start_page=sec.start_page,
                    end_page=sec.end_page,
                    order_index=sec.order_index,
                    content=sec.content,
                ))
            await db.commit()

            if _is_cancelled():
                logger.info("Ingestion aborted (paper %s was deleted).", paper_id)
                return

            # 4. Chunk text
            chunks = chunk_paragraphs(result.paragraphs, result.sections)

            # 5. Embed chunks
            texts = [c.text for c in chunks]
            vectors = await asyncio.get_event_loop().run_in_executor(
                None, embeddings.embed_texts, texts
            )

            if _is_cancelled():
                logger.info("Ingestion aborted (paper %s was deleted).", paper_id)
                return

            # 6. Upsert into ChromaDB
            metadatas = [
                {
                    "page_number": c.page_number,
                    "paragraph_number": c.paragraph_number,
                    "section_type": c.section_type or "unknown",
                }
                for c in chunks
            ]
            chroma_ids = vector_store.upsert_chunks(paper_id, texts, vectors, metadatas)

            # 7. Store chunk records
            for i, (chunk, chroma_id) in enumerate(zip(chunks, chroma_ids)):
                db.add(Chunk(
                    paper_id=paper_id,
                    chroma_id=chroma_id,
                    page_number=chunk.page_number,
                    paragraph_number=chunk.paragraph_number,
                    section_type=chunk.section_type,
                    text=chunk.text,
                    chunk_index=chunk.chunk_index,
                ))
            await db.commit()

            if _is_cancelled():
                logger.info("Ingestion aborted (paper %s was deleted).", paper_id)
                return

            # 8. Run AI analyses (another long-running step)
            analyses = await asyncio.get_event_loop().run_in_executor(
                None, run_all_analyses, result.full_text, DEFAULT_MODEL
            )

            if _is_cancelled():
                logger.info("Ingestion aborted (paper %s was deleted).", paper_id)
                return

            for atype, content in analyses.items():
                db.add(Analysis(
                    paper_id=paper_id,
                    analysis_type=atype,
                    content=content,
                ))
            await db.commit()

            # 9. Mark ready
            paper = await db.get(Paper, paper_id)
            if paper and not _is_cancelled():
                paper.status = "ready"
                await db.commit()
                logger.info("Paper %s ingestion complete.", paper_id)

        except Exception as exc:
            if _is_cancelled():
                logger.info("Ingestion for %s aborted due to deletion.", paper_id)
                return
            logger.exception("Ingestion failed for paper %s: %s", paper_id, exc)
            paper = await db.get(Paper, paper_id)
            if paper:
                paper.status = "error"
                paper.error_message = str(exc)
                await db.commit()
        finally:
            # Always clean up the cancellation signal
            _deleting_paper_ids.discard(paper_id)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=PaperOut, status_code=202)
async def upload_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    paper_id = str(uuid.uuid4())
    safe_name = f"{paper_id}_{file.filename}"
    pdf_path = UPLOAD_DIR / safe_name

    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    paper = Paper(
        id=paper_id,
        filename=file.filename,
        status="pending",
    )
    db.add(paper)
    await db.commit()
    await db.refresh(paper, ["sections"])

    background_tasks.add_task(_ingest_paper, paper_id, str(pdf_path))

    return paper


@router.get("", response_model=list[PaperListItem])
async def list_papers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Paper).order_by(Paper.created_at.desc()))
    return result.scalars().all()


@router.get("/{paper_id}", response_model=PaperOut)
async def get_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    # Eager-load sections
    await db.refresh(paper, ["sections"])
    return paper


@router.delete("/{paper_id}", status_code=204)
async def delete_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    # Signal any running background task to abort
    _deleting_paper_ids.add(paper_id)

    # Brief yield so the event loop can notify any running coroutine
    await asyncio.sleep(0)

    # Remove uploaded PDF file from disk
    matches = list(UPLOAD_DIR.glob(f"{paper_id}_*"))
    for f in matches:
        try:
            f.unlink()
            logger.info("Deleted PDF file: %s", f)
        except OSError as exc:
            logger.warning("Could not delete PDF file %s: %s", f, exc)

    # Remove ChromaDB collection (ignore if it doesn't exist yet)
    try:
        vector_store.delete_paper_collection(paper_id)
    except Exception as exc:
        logger.warning("Could not delete ChromaDB collection for %s: %s", paper_id, exc)

    await db.delete(paper)
    await db.commit()
    logger.info("Paper %s deleted.", paper_id)
