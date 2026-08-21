"""Assemble a ``ReviewBundle`` for Matteo's React UI (`margin/app`).

This module is the sole entry point the FastAPI server uses to serve
Margin's review data. It reshapes our Bedrock outputs to match the closed
unions declared in ``margin/app/src/services/types.ts``:

- ``paper``      -> title, authors, venue, pages, words, figures, refs, overall,
                    recommendation
- ``scores``     -> Record<CategoryId, 0-100> across the 7 fixed categories
- ``manuscript`` -> [ParaBlock] built by paragraph-splitting the PDF text
                    (Phase 1: no inline annotation anchors, no figure blocks)
- ``annotations``-> [Annotation] across all 7 categories, one LLM call
- ``novelty``    -> NoveltyAssessment (score, verdict, summary, strengths, risks)
- ``missingRefs``-> derived from annotations with cat="citation" + missingRef
- ``report``     -> ReviewReport (summary/strengths/weaknesses/minor/recommendation/
                    confidence)
- ``references`` -> split of the raw References section into {id, text}

Category / severity taxonomies match Matteo's closed unions exactly. Anything
that would fall outside them is clamped to the closest legal value.

All LLM calls flow through ``bedrock_client.converse_json`` with tool-use
schemas that mirror the target shape 1:1, so we can drop the returned dicts
straight into the bundle.
"""

from __future__ import annotations

import hashlib
import re
import uuid
from typing import Any

from bedrock_client import HAIKU_4_5, converse_json
from novelty_review.src.novelty_review import (
    DEFAULT_MODE,
    Mode,
    _extract_references_section,
    _parse_manuscript,
)

DEFAULT_MODEL = HAIKU_4_5
MAX_TEXT_CHARS = 40_000
MAX_MANUSCRIPT_BLOCKS = 400  # Reader can handle more but this keeps payload sane.

# Closed unions from margin/app/src/services/types.ts
CATEGORY_IDS = ("writing", "structure", "method", "logic", "novelty", "citation", "format")
SEVERITY_IDS = ("critical", "moderate", "minor")
RECOMMENDATIONS = ("accept", "minor", "major", "reject")


# ---------------------------------------------------------------------------
# JSON schemas (tool-use payloads) — 1:1 with Matteo's TS types
# ---------------------------------------------------------------------------

_REPORT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "weaknesses": {"type": "array", "items": {"type": "string"}},
        "minor": {"type": "array", "items": {"type": "string"}},
        "recommendation": {"type": "string", "enum": list(RECOMMENDATIONS)},
        "confidence": {"type": "integer", "minimum": 1, "maximum": 5},
    },
    "required": ["summary", "strengths", "weaknesses", "minor", "recommendation", "confidence"],
}

_SCORES_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {cat: {"type": "integer", "minimum": 0, "maximum": 100} for cat in CATEGORY_IDS},
    "required": list(CATEGORY_IDS),
}

_NOVELTY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "verdict": {"type": "string"},
        "summary": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "risks": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["score", "verdict", "summary", "strengths", "risks"],
}

_ANNOTATIONS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "annotations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "cat": {"type": "string", "enum": list(CATEGORY_IDS)},
                    "sev": {"type": "string", "enum": list(SEVERITY_IDS)},
                    "section": {"type": "string"},
                    "title": {"type": "string"},
                    "excerpt": {"type": "string"},
                    "comment": {"type": "string"},
                    "suggestion": {"type": "string"},
                    "rewrite": {"type": "string"},
                    "missingRef": {"type": "string"},
                    "isFigure": {"type": "boolean"},
                },
                "required": ["cat", "sev", "section", "title", "excerpt", "comment"],
            },
        }
    },
    "required": ["annotations"],
}


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_REPORT_SYSTEM_PROMPT = """You write a structured peer-review report for an academic manuscript.

Return the report via the provided tool with exactly these fields:
- summary: 2-4 sentences, neutral, describing what the paper claims to contribute.
- strengths: 3-5 concrete positive points, each one short sentence.
- weaknesses: 3-5 concrete concerns that need addressing before publication, each one short sentence.
- minor: 2-5 smaller nits (typos, phrasing, minor clarifications).
- recommendation: exactly one of "accept" | "minor" | "major" | "reject".
- confidence: your own confidence, integer 1-5 (1 = "outside my area", 5 = "very confident").

Ground rules:
- Ground every strength and weakness in specific content from the manuscript.
- Do not invent findings or references the manuscript does not contain.
- Be direct but constructive; assume the authors will revise.
"""

_SCORES_SYSTEM_PROMPT = """You score an academic manuscript across seven fixed categories on a 0-100 scale.

Return the scores via the provided tool with exactly one integer per category:
- writing:   clarity, grammar, tone, readability.
- structure: organisation, section flow, completeness of the narrative.
- method:    soundness of the approach, experimental design, reproducibility.
- logic:     internal consistency, whether claims are supported by the evidence.
- novelty:   originality of the contribution relative to prior work.
- citation:  appropriateness and coverage of citations; are claims backed by sources.
- format:    formatting quality, figure/table clarity, adherence to venue conventions.

Anchors:
- 90-100: outstanding, publication-ready in this dimension.
- 70-89 : solid, minor improvements possible.
- 50-69 : acceptable but has notable weaknesses.
- 30-49 : significant problems in this dimension.
- 0-29  : severe problems; substantial rework needed.

Rules:
- Every category must be scored; if you have low evidence, err toward the middle (50-65).
- Do not add any category outside the seven above.
"""

_NOVELTY_SYSTEM_PROMPT = """You assess the novelty of a research manuscript against your training knowledge of published work in the field.

Return the assessment via the provided tool with exactly these fields:
- score: 0-100 (higher = more novel; anchor: 50 = incremental, 75 = solid contribution, 90+ = clearly novel).
- verdict: one short phrase ("Solid contribution", "Incremental", "Well-known idea", "Novel angle", etc.).
- summary: 2-4 sentences summarising the novelty argument.
- strengths: 2-4 specific novel elements you can identify.
- risks: 2-4 specific overlaps or incremental aspects that a reviewer might flag.

Ground rules:
- Base your judgement on the paper's claims relative to specific prior work you can name with confidence.
- Do not fabricate prior work. If you cannot name specific overlaps, express the risks in terms of research families instead.
- It is fine to give a high score for a paper that clearly extends known work in a meaningful way.
"""

_ANNOTATIONS_SYSTEM_PROMPT = """You produce a list of structured peer-review annotations covering an entire manuscript.

Return an "annotations" array via the provided tool. Each annotation must set:
- cat: exactly one of "writing" | "structure" | "method" | "logic" | "novelty" | "citation" | "format".
- sev: exactly one of "critical" | "moderate" | "minor".
- section: the manuscript section the annotation refers to (e.g. "Introduction", "Method", "Results", "References").
- title: short one-line summary (<= 12 words).
- excerpt: a short verbatim quote (<= 40 words) or a compact description of the passage being flagged.
- comment: 1-3 sentences explaining the issue.
- suggestion (optional): concrete advice for the author.
- rewrite (optional): an improved literal rewrite of the excerpt when a wording fix is obvious; omit otherwise.
- missingRef (optional): the type of source that would resolve a citation gap; use only when cat="citation".
- isFigure (optional): true when the annotation is about a figure or table.

Coverage targets:
- Aim for 5-15 annotations total, weighted toward the categories where problems actually exist.
- Every "critical" annotation must point to a substantive issue, not a stylistic nit.
- Do not fabricate references. If you cannot name a specific paper, describe the type of source instead.
- If a category has no genuine issues, produce no annotations for it — do not pad.
"""


# ---------------------------------------------------------------------------
# LLM helper calls (tool-use)
# ---------------------------------------------------------------------------


def structured_report(paper_text: str, model: str, client: Any) -> dict[str, Any]:
    return converse_json(
        model_id=model,
        system_prompt=_REPORT_SYSTEM_PROMPT,
        user_message=f"Manuscript:\n\n{paper_text[:MAX_TEXT_CHARS]}",
        schema=_REPORT_SCHEMA,
        tool_name="record_review_report",
        tool_description="Record the structured peer-review report.",
        temperature=0.3,
        client=client,
    )


def score_categories(paper_text: str, model: str, client: Any) -> dict[str, int]:
    return converse_json(
        model_id=model,
        system_prompt=_SCORES_SYSTEM_PROMPT,
        user_message=f"Manuscript:\n\n{paper_text[:MAX_TEXT_CHARS]}",
        schema=_SCORES_SCHEMA,
        tool_name="record_category_scores",
        tool_description="Record the 7-category quality scores.",
        temperature=0.2,
        client=client,
    )


def assess_novelty(meta: dict[str, Any], model: str, client: Any) -> dict[str, Any]:
    claims = meta.get("claims") or []
    payload_lines = [
        f"Manuscript title: {meta.get('title', '')}",
        f"Abstract: {meta.get('abstract', '')}",
        "",
        "Main claims:",
    ]
    for i, claim in enumerate(claims, 1):
        payload_lines.append(f"{i}. {claim}")
    return converse_json(
        model_id=model,
        system_prompt=_NOVELTY_SYSTEM_PROMPT,
        user_message="\n".join(payload_lines),
        schema=_NOVELTY_SCHEMA,
        tool_name="record_novelty_assessment",
        tool_description="Record the novelty assessment.",
        temperature=0.2,
        client=client,
    )


def generate_annotations(paper_text: str, model: str, client: Any) -> list[dict[str, Any]]:
    data = converse_json(
        model_id=model,
        system_prompt=_ANNOTATIONS_SYSTEM_PROMPT,
        user_message=f"Manuscript:\n\n{paper_text[:MAX_TEXT_CHARS]}",
        schema=_ANNOTATIONS_SCHEMA,
        tool_name="record_annotations",
        tool_description="Record structured peer-review annotations.",
        temperature=0.2,
        client=client,
    )
    return data.get("annotations", [])


# ---------------------------------------------------------------------------
# Non-LLM assembly helpers
# ---------------------------------------------------------------------------

_FIGURE_MARKER_RE = re.compile(r"\b(?:Figure|Fig\.?)\s+\d+", re.IGNORECASE)
_PARA_SPLIT_RE = re.compile(r"\n\s*\n+")
# Reference splitting: blank line, OR before a numbered marker like "[3]" /
# "12." at the start of a line (handles compact numeric bibliographies).
_REF_SPLIT_RE = re.compile(r"\n\s*\n+|\n(?=\[\d+\])|\n(?=\d+\.\s)")


def count_pages(pdf_bytes: bytes | None) -> int:
    if not pdf_bytes:
        return 0
    try:
        from pypdf import PdfReader
        from io import BytesIO
        return len(PdfReader(BytesIO(pdf_bytes)).pages)
    except Exception:
        return 0


def count_words(text: str) -> int:
    return len(text.split())


def count_figures(text: str) -> int:
    # Count unique "Figure N" / "Fig. N" mentions (cheap heuristic — dupes across
    # references are folded to unique numbers so a paper's real figure count wins).
    seen: set[str] = set()
    for match in _FIGURE_MARKER_RE.finditer(text):
        num = re.search(r"\d+", match.group(0))
        if num:
            seen.add(num.group(0))
    return len(seen)


def split_references(references_raw: str) -> list[dict[str, str]]:
    if not references_raw:
        return []
    entries: list[str] = []
    for chunk in _REF_SPLIT_RE.split(references_raw):
        cleaned = " ".join(chunk.split())
        if len(cleaned) >= 20:  # drop stragglers / page numbers
            entries.append(cleaned)
    return [{"id": f"r{i}", "text": text} for i, text in enumerate(entries, 1)]


def build_manuscript_blocks(text: str) -> list[dict[str, Any]]:
    """Split the paper text into ParaBlocks. Phase 1: no inline anchors, no
    figures. First paragraph is treated as an "Introduction" section marker."""
    if not text.strip():
        return []
    paras = [p.strip() for p in _PARA_SPLIT_RE.split(text) if p.strip()]
    if not paras:
        return []
    section = "Body"
    blocks: list[dict[str, Any]] = []
    for para in paras[:MAX_MANUSCRIPT_BLOCKS]:
        blocks.append({
            "type": "p",
            "section": section,
            "runs": [{"t": para}],
        })
    return blocks


def enrich_annotations(annotations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Assign stable ids and clamp any stray enum values to the closed unions."""
    out: list[dict[str, Any]] = []
    for i, ann in enumerate(annotations, 1):
        cat = ann.get("cat") if ann.get("cat") in CATEGORY_IDS else "writing"
        sev = ann.get("sev") if ann.get("sev") in SEVERITY_IDS else "minor"
        entry: dict[str, Any] = {
            "id": f"a{i}",
            "cat": cat,
            "sev": sev,
            "section": ann.get("section") or "",
            "title": ann.get("title") or "",
            "excerpt": ann.get("excerpt") or "",
            "comment": ann.get("comment") or "",
            "origin": "ai",
        }
        for optional in ("suggestion", "rewrite", "missingRef"):
            if ann.get(optional):
                entry[optional] = ann[optional]
        if ann.get("isFigure"):
            entry["isFigure"] = True
        out.append(entry)
    return out


def derive_missing_refs(annotations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """MissingRef list from annotations that carry a `missingRef` hint."""
    out: list[dict[str, Any]] = []
    for ann in annotations:
        if ann.get("cat") == "citation" and ann.get("missingRef"):
            out.append({
                "for": ann.get("id"),
                "text": ann["missingRef"],
                "reason": ann.get("comment") or "",
            })
    return out


def overall_score(scores: dict[str, int]) -> int:
    if not scores:
        return 0
    values = [scores.get(cat, 0) for cat in CATEGORY_IDS if cat in scores]
    if not values:
        return 0
    return int(round(sum(values) / len(values)))


def stable_paper_id(paper_text: str) -> str:
    """A short deterministic id from the first 4KB of the paper text. Two
    uploads of the same file produce the same id, letting the server dedupe."""
    digest = hashlib.sha1(paper_text[:4096].encode("utf-8", errors="replace")).hexdigest()
    return f"p_{digest[:10]}"


# ---------------------------------------------------------------------------
# Public entry
# ---------------------------------------------------------------------------


def build_bundle(
    paper_text: str,
    pdf_bytes: bytes | None = None,
    mode: Mode = DEFAULT_MODE,
    model: str = DEFAULT_MODEL,
    client: Any = None,
    venue: str = "",
) -> dict[str, Any]:
    """Run the full Margin review pipeline and return a ReviewBundle-shaped dict.

    Calls are sequential; wall-clock is roughly the sum of five Bedrock calls
    (~35-80s on Haiku 4.5 for a typical paper).
    """
    if not paper_text or not paper_text.strip():
        raise ValueError("No paper text provided.")

    meta = _parse_manuscript(paper_text, model, client)
    references_raw = meta.get("references_raw") or _extract_references_section(paper_text)

    report = structured_report(paper_text, model, client)
    scores = score_categories(paper_text, model, client)
    novelty = assess_novelty(meta, model, client)
    raw_annotations = generate_annotations(paper_text, model, client)
    annotations = enrich_annotations(raw_annotations)

    references = split_references(references_raw)
    missing_refs = derive_missing_refs(annotations)
    manuscript = build_manuscript_blocks(paper_text)

    recommendation = report.get("recommendation") if report.get("recommendation") in RECOMMENDATIONS else "major"

    paper = {
        "title": meta.get("title") or "Untitled",
        "authors": meta.get("authors") or "",
        "venue": venue,
        "pages": count_pages(pdf_bytes),
        "words": count_words(paper_text),
        "figures": count_figures(paper_text),
        "refs": len(references),
        "overall": overall_score(scores),
        "recommendation": recommendation,
    }

    return {
        "paper": paper,
        "scores": {cat: int(scores.get(cat, 0)) for cat in CATEGORY_IDS},
        "manuscript": manuscript,
        "annotations": annotations,
        "visuals": [],
        "related": [],
        "missingRefs": missing_refs,
        "novelty": novelty,
        "report": report,
        "references": references,
    }
