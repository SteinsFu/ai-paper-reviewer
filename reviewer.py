"""Core review logic backed by Amazon Bedrock (Claude via Converse API)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from bedrock_client import HAIKU_4_5, converse_text

MAX_CHARS = 40_000

DEFAULT_MODEL = HAIKU_4_5

Mode = str  # "paper" | "report"
DEFAULT_MODE: Mode = "paper"


SYSTEM_PROMPT_PAPER = """You are an experienced academic peer reviewer for a top-tier \
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


SYSTEM_PROMPT_REPORT = """You are an experienced university instructor giving \
feedback on a student's course report (typically ~8 pages, undergraduate or \
early-graduate level). Your goal is to help the student improve their work \
while acknowledging where they are in their learning. Return a structured \
report in Markdown with exactly these sections, using level-2 headings (##):

## Summary
A short, neutral summary of what the report addresses and its main argument.

## Writing Quality
Grammar, clarity, and academic writing conventions appropriate to a student \
report. Point to specific weak passages and suggest concrete improvements.

## Structure and Organization
Whether the report has a clear introduction, body, and conclusion. Whether \
sections connect logically and whether the argument is easy to follow.

## Argument and Analysis
Whether claims are supported by evidence and reasoning. Whether the student \
goes beyond summarizing sources to offer their own analysis or synthesis.

## Use of Sources
Whether cited sources are used appropriately, integrated smoothly, and quoted \
or paraphrased correctly. Whether attribution is clear.

## Strengths
Highlight 2-3 specific things the student did well.

## Priorities for Revision
2-3 concrete, actionable changes that would have the highest impact on \
improving the report.

## Overall Impression
A qualitative impression: "excellent", "solid work", "needs revision", or \
"needs substantial revision". Do NOT assign a numeric grade. Justify briefly.

Be honest but encouraging. Assume the student is learning and will revise \
based on your feedback. Do not invent content that is not in the report."""


_SYSTEM_PROMPTS: dict[str, str] = {
    "paper": SYSTEM_PROMPT_PAPER,
    "report": SYSTEM_PROMPT_REPORT,
}


@dataclass
class ReviewResult:
    markdown: str
    truncated: bool
    model: str
    mode: str


def _build_user_message(paper_text: str, mode: Mode) -> tuple[str, bool]:
    text = paper_text.strip()
    truncated = len(text) > MAX_CHARS
    if truncated:
        text = text[:MAX_CHARS]
    label = "manuscript" if mode == "paper" else "student report"
    message = f"Here is the {label} to review:\n\n{text}"
    return message, truncated


def review_paper(
    paper_text: str,
    model: str = DEFAULT_MODEL,
    mode: Mode = DEFAULT_MODE,
    client: Any = None,
) -> ReviewResult:
    """Generate a structured review for the given manuscript or report text."""
    if not paper_text or not paper_text.strip():
        raise ValueError("No paper text provided.")
    if mode not in _SYSTEM_PROMPTS:
        raise ValueError(f"Unknown mode: {mode!r}. Expected one of {list(_SYSTEM_PROMPTS)}.")

    user_message, truncated = _build_user_message(paper_text, mode)

    markdown = converse_text(
        model_id=model,
        system_prompt=_SYSTEM_PROMPTS[mode],
        user_message=user_message,
        temperature=0.3,
        max_tokens=4096,
        client=client,
    )
    return ReviewResult(markdown=markdown.strip(), truncated=truncated, model=model, mode=mode)
