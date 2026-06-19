"""
PDF processing: extraction, metadata, and structural section detection.

Two libraries, two jobs:
- PyMuPDF (fitz): fast metadata + per-line font-size info, which we use to
  spot headings (a line that's bigger/bolder than the surrounding body text
  is a heading candidate).
- pdfplumber: more reliable paragraph segmentation, using the vertical gap
  between lines to decide where one paragraph ends and the next begins.

Nothing here calls an LLM — this module is pure, deterministic parsing, so
section/paragraph/page numbers are stable and trustworthy enough to cite.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import fitz  # PyMuPDF
import pdfplumber

# Canonical section keywords, longest/most specific phrasing first so e.g.
# "literature review" matches before a bare "review" would.
SECTION_KEYWORDS: list[tuple[str, list[str]]] = [
    ("abstract", ["abstract"]),
    ("literature_review", ["literature review", "related work", "background"]),
    ("methodology", ["methodology", "methods", "materials and methods", "experimental setup", "approach"]),
    ("results", ["results", "experiments", "evaluation", "findings"]),
    ("discussion", ["discussion"]),
    ("conclusion", ["conclusion", "conclusions", "concluding remarks", "summary and future work"]),
    ("references", ["references", "bibliography", "works cited"]),
    ("introduction", ["introduction"]),
]

HEADING_LINE_RE = re.compile(r"^\s*(?:[IVXLC]+\.|\d+(?:\.\d+)*\.?)?\s*([A-Za-z][A-Za-z\s\-:]{2,60})\s*$")


@dataclass
class ParagraphInfo:
    page_number: int
    paragraph_number: int  # 1-indexed, resets per page
    text: str


@dataclass
class SectionInfo:
    section_type: str
    heading_text: str | None
    start_page: int
    end_page: int
    order_index: int
    content: str = ""
    paragraphs: list[ParagraphInfo] = field(default_factory=list)


@dataclass
class ExtractedPaper:
    title: str | None
    authors: str | None
    page_count: int
    full_text: str
    sections: list[SectionInfo]
    paragraphs: list[ParagraphInfo]  # flat list across the whole document, in reading order


def _classify_heading(line: str) -> str | None:
    """Return a canonical section_type if `line` looks like a known section heading."""
    normalized = line.strip().lower().strip(": ")
    if len(normalized) < 3 or len(normalized) > 60:
        return None
    for section_type, keywords in SECTION_KEYWORDS:
        for kw in keywords:
            if normalized == kw or normalized.startswith(kw + " ") or normalized == kw + ":":
                return section_type
    return None


def _extract_metadata_and_headings(path: str) -> tuple[str | None, str | None, int, list[tuple[int, str, str]]]:
    """
    Returns (title, authors, page_count, headings) where headings is a list of
    (page_number, section_type, raw_heading_text) found via font-size analysis.
    """
    doc = fitz.open(path)
    meta = doc.metadata or {}
    title = (meta.get("title") or "").strip() or None
    authors = (meta.get("author") or "").strip() or None
    page_count = doc.page_count

    # Determine the body-text font size (the mode of font sizes across the doc)
    # so we can flag lines that are noticeably larger/bolder as headings.
    size_counts: dict[float, int] = {}
    for page in doc:
        for block in page.get_text("dict").get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    size = round(span.get("size", 0), 1)
                    size_counts[size] = size_counts.get(size, 0) + len(span.get("text", "").strip())
    body_size = max(size_counts, key=size_counts.get) if size_counts else 10.0

    headings: list[tuple[int, str, str]] = []
    for page_index, page in enumerate(doc, start=1):
        for block in page.get_text("dict").get("blocks", []):
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                line_text = "".join(s.get("text", "") for s in spans).strip()
                if not line_text:
                    continue
                max_size = max(round(s.get("size", 0), 1) for s in spans)
                is_bold = any("bold" in s.get("font", "").lower() for s in spans)
                looks_like_heading = max_size > body_size + 0.5 or is_bold
                if not looks_like_heading:
                    continue
                if not HEADING_LINE_RE.match(line_text):
                    continue
                section_type = _classify_heading(line_text)
                if section_type:
                    headings.append((page_index, section_type, line_text))

    doc.close()
    return title, authors, page_count, headings


def _extract_paragraphs(path: str) -> list[ParagraphInfo]:
    """
    Group lines into paragraphs per page using vertical-gap heuristics from
    pdfplumber, which exposes precise line bounding boxes.
    """
    paragraphs: list[ParagraphInfo] = []
    with pdfplumber.open(path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            lines = page.extract_text_lines() or []
            if not lines:
                continue

            current_words: list[str] = []
            prev_bottom: float | None = None
            paragraph_number = 0
            # A new paragraph starts when the gap to the previous line is
            # noticeably larger than a normal line-to-line gap.
            line_heights = [ln["bottom"] - ln["top"] for ln in lines if ln.get("text", "").strip()]
            typical_height = (sum(line_heights) / len(line_heights)) if line_heights else 12.0

            for ln in lines:
                text = ln.get("text", "").strip()
                if not text:
                    continue
                gap = (ln["top"] - prev_bottom) if prev_bottom is not None else 0
                starts_new_paragraph = prev_bottom is not None and gap > typical_height * 0.6
                if starts_new_paragraph and current_words:
                    paragraph_number += 1
                    paragraphs.append(
                        ParagraphInfo(
                            page_number=page_index,
                            paragraph_number=paragraph_number,
                            text=" ".join(current_words).strip(),
                        )
                    )
                    current_words = []
                current_words.append(text)
                prev_bottom = ln["bottom"]

            if current_words:
                paragraph_number += 1
                paragraphs.append(
                    ParagraphInfo(
                        page_number=page_index,
                        paragraph_number=paragraph_number,
                        text=" ".join(current_words).strip(),
                    )
                )
    return paragraphs


def extract_paper(path: str) -> ExtractedPaper:
    """Main entry point: parse a PDF on disk into structured, citable text."""
    title, authors, page_count, headings = _extract_metadata_and_headings(path)
    paragraphs = _extract_paragraphs(path)
    full_text = "\n\n".join(p.text for p in paragraphs)

    sections = _build_sections(headings, paragraphs, page_count)

    # Fall back to the first reasonably long paragraph as a pseudo-title if
    # PDF metadata didn't have one (very common — most authors don't set it).
    if not title and paragraphs:
        title = paragraphs[0].text[:200]

    return ExtractedPaper(
        title=title,
        authors=authors,
        page_count=page_count,
        full_text=full_text,
        sections=sections,
        paragraphs=paragraphs,
    )


def _find_heading_paragraph_index(
    paragraphs: list[ParagraphInfo], page_num: int, heading_text: str, search_from: int
) -> int | None:
    """
    Locate which paragraph (by index into the flat, reading-order `paragraphs`
    list) corresponds to a detected heading. Matching on page + a startswith
    check (not equality) tolerates pdfplumber occasionally merging a short
    heading line with the first words of the following sentence.
    """
    target = heading_text.strip().lower()
    for idx in range(search_from, len(paragraphs)):
        p = paragraphs[idx]
        if p.page_number < page_num:
            continue
        candidate = p.text.strip().lower()
        if candidate == target or candidate.startswith(target):
            return idx
        if p.page_number > page_num:
            # We've moved past the expected page without finding the heading
            # text — give up rather than match something on a much later page.
            break
    return None


def _build_sections(
    headings: list[tuple[int, str, str]],
    paragraphs: list[ParagraphInfo],
    page_count: int,
) -> list[SectionInfo]:
    if not headings:
        # No headings detected — return the whole document as one "other" section.
        return [
            SectionInfo(
                section_type="other",
                heading_text=None,
                start_page=1,
                end_page=page_count,
                order_index=0,
                content="\n\n".join(p.text for p in paragraphs),
                paragraphs=paragraphs,
            )
        ]

    # De-duplicate consecutive same-type headings (multi-line titles can match twice).
    deduped: list[tuple[int, str, str]] = []
    for h in headings:
        if deduped and deduped[-1][1] == h[1] and h[0] - deduped[-1][0] <= 1:
            continue
        deduped.append(h)

    # Resolve each heading to a position in the flat paragraph list, in
    # document order, so sections are sliced by reading order rather than
    # by page number (two headings can legitimately share one page).
    heading_indices: list[int] = []
    search_from = 0
    for page_num, _section_type, heading_text in deduped:
        idx = _find_heading_paragraph_index(paragraphs, page_num, heading_text, search_from)
        heading_indices.append(idx if idx is not None else search_from)
        search_from = (idx + 1) if idx is not None else search_from

    sections: list[SectionInfo] = []
    for i, (page_num, section_type, heading_text) in enumerate(deduped):
        start_idx = heading_indices[i]
        end_idx = heading_indices[i + 1] if i + 1 < len(deduped) else len(paragraphs)

        # Exclude the heading paragraph itself (start_idx) from the content,
        # so the heading text isn't duplicated inside its own section.
        section_paragraphs = paragraphs[start_idx + 1 : end_idx]

        actual_start_page = paragraphs[start_idx].page_number if start_idx < len(paragraphs) else page_num
        actual_end_page = section_paragraphs[-1].page_number if section_paragraphs else actual_start_page

        sections.append(
            SectionInfo(
                section_type=section_type,
                heading_text=heading_text,
                start_page=actual_start_page,
                end_page=actual_end_page,
                order_index=i,
                content="\n\n".join(p.text for p in section_paragraphs),
                paragraphs=section_paragraphs,
            )
        )
    return sections
