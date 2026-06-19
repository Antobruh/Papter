"""
Analysis router: retrieve AI-generated summaries, gaps, and concepts.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.db.models import Analysis, Paper
from backend.models.schemas import AllAnalysesOut, AnalysisOut

router = APIRouter(prefix="/api/papers", tags=["analysis"])
logger = logging.getLogger(__name__)

SUMMARY_TYPES = {
    "overview", "bullets",
    "methodology", "results", "limitations", "future_work",
    "gaps", "concepts",
}


@router.get("/{paper_id}/analysis", response_model=AllAnalysesOut)
async def get_all_analyses(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.status not in ("ready", "processing"):
        raise HTTPException(
            status_code=202,
            detail=f"Paper is still {paper.status}. Try again soon.",
        )

    result = await db.execute(
        select(Analysis).where(Analysis.paper_id == paper_id)
    )
    analyses = result.scalars().all()

    data: dict = {}
    for a in analyses:
        if a.analysis_type == "concepts":
            try:
                parsed = json.loads(a.content)
                data["concepts"] = parsed if isinstance(parsed, list) else []
            except json.JSONDecodeError:
                data["concepts"] = []
        else:
            data[a.analysis_type] = a.content

    return AllAnalysesOut(**data)


@router.get("/{paper_id}/analysis/{analysis_type}", response_model=AnalysisOut)
async def get_single_analysis(
    paper_id: str, analysis_type: str, db: AsyncSession = Depends(get_db)
):
    if analysis_type not in SUMMARY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown analysis type. Valid: {sorted(SUMMARY_TYPES)}",
        )
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    result = await db.execute(
        select(Analysis).where(
            Analysis.paper_id == paper_id,
            Analysis.analysis_type == analysis_type,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not yet available.")
    return analysis
