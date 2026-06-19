"""
Chat router: RAG-powered Q&A with citation-backed streaming responses.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.db.models import ChatMessage, Paper
from backend.models.schemas import ChatMessageIn, ChatMessageOut, ChatResponse, Citation
from backend.services import rag

router = APIRouter(prefix="/api/papers", tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/{paper_id}/chat/stream")
async def chat_stream(
    paper_id: str,
    body: ChatMessageIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Streaming RAG chat endpoint.
    Returns Server-Sent Events: first a 'citations' event, then 'token' events,
    finally a 'done' event.
    """
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.status != "ready":
        raise HTTPException(status_code=400, detail="Paper is not ready yet.")

    # Save user message
    user_msg = ChatMessage(
        paper_id=paper_id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    await db.commit()

    token_gen, citations = rag.stream_query(paper_id, body.message, body.model)
    citations_dicts = [c.model_dump() for c in citations]

    async def event_stream():
        # First send citations
        yield f"event: citations\ndata: {json.dumps(citations_dicts)}\n\n"

        # Stream tokens
        full_response = []
        for token in token_gen:
            full_response.append(token)
            yield f"event: token\ndata: {json.dumps(token)}\n\n"

        # Save assistant message to DB
        assistant_content = "".join(full_response)
        from backend.db.database import AsyncSessionLocal
        async with AsyncSessionLocal() as save_db:
            save_db.add(ChatMessage(
                paper_id=paper_id,
                role="assistant",
                content=assistant_content,
                citations=citations_dicts,
            ))
            await save_db.commit()

        yield f"event: done\ndata: {{}}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{paper_id}/chat", response_model=ChatResponse)
async def chat(
    paper_id: str,
    body: ChatMessageIn,
    db: AsyncSession = Depends(get_db),
):
    """Blocking RAG chat (non-streaming fallback)."""
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.status != "ready":
        raise HTTPException(status_code=400, detail="Paper is not ready yet.")

    user_msg = ChatMessage(paper_id=paper_id, role="user", content=body.message)
    db.add(user_msg)
    await db.commit()

    answer, citations = rag.query(paper_id, body.message, body.model)
    citations_dicts = [c.model_dump() for c in citations]

    assistant_msg = ChatMessage(
        paper_id=paper_id,
        role="assistant",
        content=answer,
        citations=citations_dicts,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return ChatResponse(
        message=ChatMessageOut.model_validate(assistant_msg),
        citations=citations,
    )


@router.get("/{paper_id}/chat/history", response_model=list[ChatMessageOut])
async def chat_history(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.paper_id == paper_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return result.scalars().all()


@router.delete("/{paper_id}/chat/history", status_code=204)
async def clear_chat_history(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    result = await db.execute(
        select(ChatMessage).where(ChatMessage.paper_id == paper_id)
    )
    for msg in result.scalars().all():
        await db.delete(msg)
    await db.commit()
