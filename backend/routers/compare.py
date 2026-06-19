"""
Paper comparison router.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.db.models import Paper
from backend.models.schemas import CompareOut, CompareRequest, PaperListItem
from backend.services.summarizer import compare_papers

router = APIRouter(prefix="/api/compare", tags=["compare"])
logger = logging.getLogger(__name__)


@router.post("", response_model=CompareOut)
async def compare(body: CompareRequest, db: AsyncSession = Depends(get_db)):
    if len(body.paper_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 paper IDs.")

    papers = []
    paper_items = []
    for pid in body.paper_ids:
        paper = await db.get(Paper, pid)
        if not paper:
            raise HTTPException(status_code=404, detail=f"Paper {pid} not found.")
        if paper.status != "ready":
            raise HTTPException(
                status_code=400, detail=f"Paper '{paper.title or pid}' is not ready yet."
            )
        papers.append({"title": paper.title or paper.filename, "text": ""})
        paper_items.append(paper)

    # Load chunk texts for each paper from the DB for comparison context
    from sqlalchemy import select
    from backend.db.models import Chunk

    for i, paper in enumerate(paper_items):
        result = await db.execute(
            select(Chunk)
            .where(Chunk.paper_id == paper.id)
            .order_by(Chunk.chunk_index.asc())
            .limit(12)
        )
        chunks = result.scalars().all()
        papers[i]["text"] = " ".join(c.text for c in chunks)

    report = await asyncio.get_event_loop().run_in_executor(
        None, compare_papers, papers, body.model
    )

    return CompareOut(
        report=report,
        papers=[PaperListItem.model_validate(p) for p in paper_items],
    )
