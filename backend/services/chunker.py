"""
Chunking utility: splits extracted paragraphs into overlapping text chunks
suitable for embedding and retrieval.
"""
from __future__ import annotations

from dataclasses import dataclass

# Target chunk size in characters (~512 tokens ≈ 2000 chars for English)
CHUNK_SIZE = 1800
OVERLAP = 200


@dataclass
class TextChunk:
    text: str
    page_number: int
    paragraph_number: int
    section_type: str | None
    chunk_index: int


def chunk_paragraphs(paragraphs: list, sections: list | None = None) -> list[TextChunk]:
    """
    Convert extracted ParagraphInfo objects into overlapping chunks.
    Uses a sliding-window approach: when a paragraph pushes the buffer
    over CHUNK_SIZE, flush a chunk, keeping the last OVERLAP chars as context.

    paragraphs: list of ParagraphInfo (from pdf_processor)
    sections: list of SectionInfo (optional, used to tag chunks with section_type)
    """
    # Build a quick lookup: page_number → section_type
    page_to_section: dict[int, str] = {}
    if sections:
        for sec in sections:
            for pg in range(sec.start_page, sec.end_page + 1):
                page_to_section[pg] = sec.section_type

    chunks: list[TextChunk] = []
    buffer = ""
    buffer_page = 1
    buffer_para = 1
    chunk_index = 0

    for para in paragraphs:
        text = para.text.strip()
        if not text:
            continue

        if buffer and len(buffer) + len(text) + 1 > CHUNK_SIZE:
            section_type = page_to_section.get(buffer_page)
            chunks.append(
                TextChunk(
                    text=buffer.strip(),
                    page_number=buffer_page,
                    paragraph_number=buffer_para,
                    section_type=section_type,
                    chunk_index=chunk_index,
                )
            )
            chunk_index += 1
            # Keep overlap from end of buffer
            buffer = buffer[-OVERLAP:] + " " + text
        else:
            if not buffer:
                buffer_page = para.page_number
                buffer_para = para.paragraph_number
            buffer = (buffer + " " + text).strip() if buffer else text

    # Flush remaining
    if buffer.strip():
        section_type = page_to_section.get(buffer_page)
        chunks.append(
            TextChunk(
                text=buffer.strip(),
                page_number=buffer_page,
                paragraph_number=buffer_para,
                section_type=section_type,
                chunk_index=chunk_index,
            )
        )

    return chunks
