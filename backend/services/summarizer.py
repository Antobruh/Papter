"""
Prompt templates and orchestration for all AI summarization types.
Each function takes full_text (or section content) and returns generated text.
"""
from __future__ import annotations

import logging

from backend.services.llm import generate

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are an expert academic assistant helping students understand research papers. "
    "Be accurate, clear, and base everything strictly on the provided paper text. "
    "Never fabricate facts. Respond only in English."
)


def _run(prompt: str, model: str, temperature: float = 0.3) -> str:
    try:
        return generate(prompt=prompt, model=model, system=_SYSTEM, temperature=temperature)
    except Exception as exc:
        logger.error("LLM error: %s", exc)
        return f"[Error generating summary: {exc}]"


# ---------------------------------------------------------------------------
# Summary types
# ---------------------------------------------------------------------------

def overview_summary(text: str, model: str) -> str:
    prompt = (
        "Write a clear and comprehensive overview (200-300 words) of the following research paper. "
        "Cover the problem being solved, the proposed solution, key results, and significance in plain English.\n\n"
        f"PAPER:\n{text[:6000]}"
    )
    return _run(prompt, model)


def bullet_summary(text: str, model: str) -> str:
    prompt = (
        "List the 7-10 most important findings, contributions, and conclusions from "
        "this research paper as clear bullet points. Each bullet should be one sentence.\n\n"
        f"PAPER:\n{text[:6000]}"
    )
    return _run(prompt, model)


def methodology_explanation(text: str, model: str) -> str:
    prompt = (
        "Explain the methodology and research design of this paper in plain language. "
        "Cover: what data/datasets were used, what methods/algorithms were applied, "
        "and how the experiments were set up. Keep under 300 words.\n\n"
        f"PAPER:\n{text[:6000]}"
    )
    return _run(prompt, model)


def results_interpretation(text: str, model: str) -> str:
    prompt = (
        "Interpret the main results and findings of this research paper. "
        "Explain what the numbers and comparisons mean in plain English. "
        "What do these results prove or disprove? Keep under 300 words.\n\n"
        f"PAPER:\n{text[:6000]}"
    )
    return _run(prompt, model)


def limitations_analysis(text: str, model: str) -> str:
    prompt = (
        "Identify and explain the limitations of this research paper. "
        "What are the weaknesses in the methodology, data, or scope? "
        "Use only information from the paper itself. Keep under 250 words.\n\n"
        f"PAPER:\n{text[:6000]}"
    )
    return _run(prompt, model)


def future_work_analysis(text: str, model: str) -> str:
    prompt = (
        "Identify all future research directions and open problems mentioned or implied "
        "by this paper. What questions remain unanswered? What improvements could be made? "
        "Base your answer only on this paper. Keep under 250 words.\n\n"
        f"PAPER:\n{text[:6000]}"
    )
    return _run(prompt, model)


# ---------------------------------------------------------------------------
# Research gap detector
# ---------------------------------------------------------------------------

def research_gaps(text: str, model: str) -> str:
    prompt = (
        "Analyze this research paper and identify research gaps in JSON format. "
        "Return a JSON array where each item has: "
        '"gap_type" (one of: limitation, missing_area, future_direction, improvement), '
        '"title" (short label), '
        '"description" (2-3 sentences), '
        '"evidence" (a quote or paraphrase from the paper supporting this gap). '
        "Return ONLY the JSON array, no other text.\n\n"
        f"PAPER:\n{text[:6000]}"
    )
    return _run(prompt, model, temperature=0.2)


# ---------------------------------------------------------------------------
# Concept extractor
# ---------------------------------------------------------------------------

def extract_concepts(text: str, model: str) -> str:
    prompt = (
        "Extract the key technical concepts from this research paper as a JSON array. "
        "Each item must have: "
        '"term" (the concept name), '
        '"simple_explanation" (1-2 sentences for a beginner), '
        '"analogy" (a real-world analogy), '
        '"category" (one of: method, dataset, metric, theory, tool, model). '
        "Return 8-15 concepts. Return ONLY the JSON array, no other text.\n\n"
        f"PAPER:\n{text[:5000]}"
    )
    return _run(prompt, model, temperature=0.2)


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------

def compare_papers(papers_data: list[dict], model: str) -> str:
    """
    papers_data: list of {"title": str, "text": str}
    Returns a structured comparison report.
    """
    papers_block = ""
    for i, p in enumerate(papers_data, 1):
        papers_block += f"\n\n=== PAPER {i}: {p['title']} ===\n{p['text'][:3000]}"

    prompt = (
        "Compare the following research papers across these dimensions:\n"
        "1. Problem being solved\n"
        "2. Methodology / approach\n"
        "3. Datasets used\n"
        "4. Key results and metrics\n"
        "5. Strengths\n"
        "6. Weaknesses\n"
        "7. Research focus\n"
        "8. How they relate to each other\n\n"
        "Format the comparison as a clear, structured report with a section for each dimension. "
        "Be specific and factual.\n"
        f"{papers_block}"
    )
    return _run(prompt, model, temperature=0.2)


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------

def run_all_analyses(full_text: str, model: str) -> dict[str, str]:
    """Run all summary types sequentially and return a dict of results."""
    logger.info("Running all analyses with model %s …", model)
    return {
        "overview": overview_summary(full_text, model),
        "bullets": bullet_summary(full_text, model),
        "methodology": methodology_explanation(full_text, model),
        "results": results_interpretation(full_text, model),
        "limitations": limitations_analysis(full_text, model),
        "future_work": future_work_analysis(full_text, model),
        "gaps": research_gaps(full_text, model),
        "concepts": extract_concepts(full_text, model),
    }
