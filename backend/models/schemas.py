"""
Pydantic schemas (request/response models) for the Papter API.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Papers
# ---------------------------------------------------------------------------

class PaperBase(BaseModel):
    filename: str
    title: str | None = None
    authors: str | None = None
    page_count: int = 0


class PaperCreate(PaperBase):
    pass


class SectionOut(BaseModel):
    id: str
    section_type: str
    heading_text: str | None
    start_page: int
    end_page: int
    order_index: int
    content: str

    model_config = {"from_attributes": True}


class PaperOut(PaperBase):
    id: str
    status: str
    error_message: str | None = None
    created_at: datetime
    sections: list[SectionOut] = []

    model_config = {"from_attributes": True}


class PaperListItem(BaseModel):
    id: str
    filename: str
    title: str | None = None
    authors: str | None = None
    page_count: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

class AnalysisOut(BaseModel):
    id: str
    paper_id: str
    analysis_type: str
    content: str
    metadata_json: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AllAnalysesOut(BaseModel):
    overview: str | None = None
    bullets: str | None = None
    methodology: str | None = None
    results: str | None = None
    limitations: str | None = None
    future_work: str | None = None
    gaps: str | None = None
    concepts: list[dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class Citation(BaseModel):
    page_number: int
    paragraph_number: int
    section_type: str | None = None
    snippet: str


class ChatMessageIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    model: str = "qwen3:8b"


class ChatMessageOut(BaseModel):
    id: str
    paper_id: str
    role: str
    content: str
    citations: list[Citation] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    message: ChatMessageOut
    citations: list[Citation] = []


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------

class CompareRequest(BaseModel):
    paper_ids: list[str] = Field(..., min_length=2, max_length=5)
    model: str = "qwen3:8b"


class CompareOut(BaseModel):
    report: str
    papers: list[PaperListItem]


# ---------------------------------------------------------------------------
# System
# ---------------------------------------------------------------------------

class OllamaStatus(BaseModel):
    available: bool
    models: list[str] = []
    error: str | None = None


class HealthOut(BaseModel):
    status: str
    ollama: OllamaStatus
