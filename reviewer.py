"""Core review logic backed by Amazon Bedrock (Claude via Converse API)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from bedrock_client import HAIKU_4_5, converse_text

MAX_CHARS = 40_000

DEFAULT_MODEL = HAIKU_4_5

SYSTEM_PROMPT = """You are an experienced academic peer reviewer for a top-tier \
venue. Review the manuscript provided by the user and return a structured report \
in Markdown with exactly these sections, using level-2 headings (##):

## Summary
A short, neutral summary of what the paper claims to contribute.

## Writing Quality
Clarity, grammar, tone, and readability. Point to concrete weak passages and \
suggest improved phrasings.

## Paper Structure
Organization, flow, section completeness, and whether the narrative is easy to follow.

## Methodology
Soundness of the approach, experimental design, and reproducibility concerns.

## Logical Consistency
Whether claims are supported by evidence and arguments follow logically.

## Novelty
What appears novel versus incremental. Flag possible overlaps with known work.

## Citation Usage
Whether claims are appropriately cited and where references seem missing or weak.

## Overall Recommendation
One of: Accept, Minor Revision, Major Revision, Reject. Justify briefly, then list \
the top 3 actionable priorities for the authors.

Be specific and constructive. When you flag an issue, suggest a concrete fix. Do \
not invent content that is not in the manuscript."""


@dataclass
class ReviewResult:
    markdown: str
    truncated: bool
    model: str


def _build_user_message(paper_text: str) -> tuple[str, bool]:
    text = paper_text.strip()
    truncated = len(text) > MAX_CHARS
    if truncated:
        text = text[:MAX_CHARS]
    message = f"Here is the manuscript to review:\n\n{text}"
    return message, truncated


def review_paper(
    paper_text: str,
    model: str = DEFAULT_MODEL,
    client: Any = None,
) -> ReviewResult:
    """Generate a structured peer review for the given manuscript text."""
    if not paper_text or not paper_text.strip():
        raise ValueError("No paper text provided.")

    user_message, truncated = _build_user_message(paper_text)

    markdown = converse_text(
        model_id=model,
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message,
        temperature=0.3,
        max_tokens=4096,
        client=client,
    )
    return ReviewResult(markdown=markdown.strip(), truncated=truncated, model=model)
