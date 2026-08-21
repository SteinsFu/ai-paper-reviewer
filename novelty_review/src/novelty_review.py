"""Literature-side review for academic manuscripts.

Runs three LLM-only checks on top of the base peer-review pass:
- Novelty: does the paper's contribution look novel against what Claude already
  knows about the field?
- Missing citations: are there passages that require a citation but have none?
- Reference list quality: is the bibliography a plausible, well-formed list for
  a manuscript of this scope?

All analysis is done by Claude through Amazon Bedrock; no external literature
API is called. The trade-off is that Claude relies on its training knowledge,
so it may miss papers published after its cutoff and should be prompted to
avoid fabricating specific references.

Public API: ``run(paper_text)`` returns a list of ``Issue`` records.
Errors propagate to the caller (fail-fast).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from bedrock_client import HAIKU_4_5, converse_json

DEFAULT_MODEL = HAIKU_4_5
MAX_PARSE_CHARS = 40_000
MAX_ANALYSIS_CHARS = 40_000
MAX_REFERENCE_CHARS = 20_000


@dataclass
class Issue:
    category: str
    severity: str
    title: str
    description: str
    evidence: str = ""
    suggestion: str = ""
    related_refs: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# JSON schemas for Bedrock tool-use structured output
# ---------------------------------------------------------------------------

_PARSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "abstract": {"type": "string"},
        "claims": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title", "abstract", "claims"],
}

_ISSUES_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "evidence": {"type": "string"},
                    "suggestion": {"type": "string"},
                    "related_refs": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["category", "severity", "title", "description"],
            },
        }
    },
    "required": ["issues"],
}


# ---------------------------------------------------------------------------
# manuscript parsing
# ---------------------------------------------------------------------------

_PARSE_SYSTEM_PROMPT = """You extract structured metadata from a research manuscript.
Return the result via the provided tool with exactly these keys:
- title: string. The paper's title.
- abstract: string. The paper's abstract.
- claims: array of strings. Each entry is one key contribution or main claim.

Rules:
- Do not invent content. Use an empty string or empty array when missing.
- Aim for 3-8 short, self-contained statements in "claims".
- Do NOT try to recover the reference list; that is handled separately.
"""


_REFERENCE_HEADER_RE = re.compile(
    r"(?:^|\n)\s*(?:References|REFERENCES|Bibliography|BIBLIOGRAPHY)\s*:?\s*\n"
)

# Trailing sections that sometimes follow the references and should be dropped.
# Handles two common shapes:
#   1. Explicit "Appendix" / "Acknowledgments" / "Supplementary" style headers.
#   2. ACL-style single-letter appendix headers like "\nA Gaussian Characterization\n"
#      where the header line is a lone capital letter + title-cased words + newline.
_POST_REFERENCE_HEADERS = re.compile(
    r"\n(?:"
    r"Appendix(?:es|ices)?|APPENDIX|"
    r"Supplement(?:ary|s)?|SUPPLEMENTARY|"
    r"Acknowledg(?:e)?ments?|ACKNOWLEDG(?:E)?MENTS?|"
    r"A\.\d|"
    r"[A-Z]\s+[A-Z][a-z]+(?:\s+[A-Z][a-zA-Z]+){1,10}\s*\n"
    r")"
)


def _extract_references_section(text: str) -> str:
    """Extract the raw References/Bibliography section, without LLM reformatting.

    Papers often mention "references" earlier in the body (e.g. "cited in the
    references"), so we take the LAST header match, which is nearly always the
    actual section start.
    """
    matches = list(_REFERENCE_HEADER_RE.finditer(text))
    if not matches:
        return ""
    last = matches[-1]
    section = text[last.end():]
    trailing = _POST_REFERENCE_HEADERS.search(section)
    if trailing:
        section = section[: trailing.start()]
    return section.strip()[:MAX_REFERENCE_CHARS]


def _parse_manuscript(text: str, model: str, client: Any) -> dict[str, Any]:
    truncated = text[:MAX_PARSE_CHARS]
    meta = converse_json(
        model_id=model,
        system_prompt=_PARSE_SYSTEM_PROMPT,
        user_message=truncated,
        schema=_PARSE_SCHEMA,
        tool_name="record_manuscript_metadata",
        tool_description="Record the extracted manuscript metadata.",
        temperature=0.1,
        client=client,
    )
    meta["references_raw"] = _extract_references_section(text)
    return meta


# ---------------------------------------------------------------------------
# novelty assessment (LLM-only, based on Claude's training knowledge)
# ---------------------------------------------------------------------------

_NOVELTY_SYSTEM_PROMPT = """You assess the novelty of a research manuscript's main claims against your own training knowledge of published work in the field.

Only flag a claim when you can, with high confidence, point to specific prior work whose contribution substantively subsumes the flagged claim as a whole. General thematic overlap with a research area is NOT sufficient to flag.

For each claim you flag, return an issue via the provided tool:
- category: "novelty_overlap" if the claim is substantively covered by specific prior work you can name with confidence; "novelty_weak" if the delta over an existing method you can name is clearly small.
- severity: "high" | "medium" | "low".
- title: short one-line summary.
- description: 2-3 sentence explanation naming the specific overlap and why it makes the claim redundant.
- evidence: the exact manuscript claim being flagged.
- suggestion: concrete advice for the authors (e.g. "clarify the delta over method X", "position against method Y").
- related_refs: array of specific landmark titles you are confident exist. Prefer real titles you can name with certainty; leave empty if unsure.

Do NOT flag (return empty for these):
- Claims describing a *new metric*, *new empirical measurement*, *specific quantitative finding*, or *analysis of a specific model family* unless a prior paper reports exactly that same metric / measurement / finding.
- Claims of the form "we propose X to quantify / measure Y" when you cannot name a prior work proposing exactly X.
- Empirical results specific to particular models or datasets that you do not know a prior paper has already reported.
- General background statements or descriptions of experimental setup.

Ground rules:
- Do not fabricate references. If you cannot name a specific prior work with high confidence, do not flag the claim at all.
- It is better to return zero issues than to flag a legitimately novel contribution.
- If no issues, call the tool with an empty issues array.
"""


def _check_novelty(
    meta: dict[str, Any],
    model: str,
    client: Any,
) -> list[Issue]:
    claims = meta.get("claims") or []
    if not claims:
        return []

    payload_lines = [
        f"Manuscript title: {meta.get('title', '')}",
        "",
        "Main claims:",
    ]
    for i, claim in enumerate(claims, 1):
        payload_lines.append(f"{i}. {claim}")

    data = converse_json(
        model_id=model,
        system_prompt=_NOVELTY_SYSTEM_PROMPT,
        user_message="\n".join(payload_lines),
        schema=_ISSUES_SCHEMA,
        tool_name="record_novelty_issues",
        tool_description="Record novelty concerns for the manuscript.",
        temperature=0.2,
        client=client,
    )
    return [Issue(**item) for item in data.get("issues", [])]


# ---------------------------------------------------------------------------
# missing citation detection (Type B: passages that require a citation)
# ---------------------------------------------------------------------------

_MISSING_CITATION_SYSTEM_PROMPT = """You review academic manuscripts to find passages where a citation is expected but missing.

Look for:
- Empirical claims, statistics, or historical facts stated without a citation.
- References to prior work ("has been shown", "it is known that", "prior studies") without a citation.
- Discussion of a well-established concept or landmark method without citing its seminal source.
- Quotations or paraphrased ideas presented without attribution.

For each issue, return via the provided tool:
- category: "citation_missing".
- severity: "high" | "medium" | "low".
- title: short one-line summary of the missing citation.
- description: 1-2 sentence explanation of why a citation is expected here.
- evidence: the exact passage from the manuscript (quote verbatim, trimmed to at most ~40 words).
- suggestion: what to cite. Be specific if you can recall a landmark paper with confidence; otherwise write "cite the seminal work on X" or "cite a representative empirical study".
- related_refs: optional array of specific titles you are confident exist. Prefer to leave empty than fabricate.

Verification rule (critical to avoid false positives):
- Before emitting an issue, re-read the sentence AND its immediate neighbours (the previous and following sentences and any nearby parenthetical) to check whether an in-text citation is already present. In-text citations may take many forms: "(Author, YEAR)", "Author (YEAR)", "Author et al., YEAR", numeric like "[12]", or superscripts. If a citation is present in the sentence, its neighbours, or the same clause it belongs to, DO NOT emit an issue for that passage.
- If your own explanation would say "this is actually already cited" or similar, DROP the issue entirely instead of emitting it.

Other ground rules:
- Do not fabricate references. When unsure, describe the type of source needed instead of naming one.
- Do not flag every sentence; only ones where a citation is genuinely expected.
- Ignore the paper's own introduction of its methods and results (those do not need citations).
- If nothing is missing, call the tool with an empty issues array.
"""


def _check_missing_citations(
    text: str,
    model: str,
    client: Any,
) -> list[Issue]:
    body = text[:MAX_ANALYSIS_CHARS]
    data = converse_json(
        model_id=model,
        system_prompt=_MISSING_CITATION_SYSTEM_PROMPT,
        user_message=f"Manuscript text:\n\n{body}",
        schema=_ISSUES_SCHEMA,
        tool_name="record_missing_citations",
        tool_description="Record passages that need a citation.",
        temperature=0.2,
        client=client,
    )
    return [Issue(**item) for item in data.get("issues", [])]


# ---------------------------------------------------------------------------
# reference list quality (formal quality of the bibliography)
# ---------------------------------------------------------------------------

_REFERENCE_QUALITY_SYSTEM_PROMPT = """You evaluate the reference list of a research manuscript for formal quality and coverage.

The reference list you receive is the raw text extracted from the manuscript's References section. It may contain line-break artifacts, hyphenated word breaks, and page numbers merged into entries. Treat these as PDF-extraction noise, NOT as errors in the bibliography itself.

First, estimate the manuscript's publication year from the title, abstract, claims, and the most recent citation years present. Use this year as the baseline for all recency judgments below.

Consider:
- Whether the list is unusually thin, unbalanced (e.g. heavy self-citation, coverage only in a narrow sub-area), or clearly missing foundational works given the manuscript topic and claims.
- Whether specific entries look implausible or wrong on their face — but only flag when you can name the actual problem in the entry, and only when you are confident the problem is in the bibliography rather than in the extraction.

Do NOT flag as issues:
- Formatting issues such as broken words, missing spaces, or line-break artifacts (these are extraction noise).
- "Many citations are recent" when the recent citations date from within ~3 years of the estimated publication year — that is normal.
- "Author names appear twice" (e.g. two 'Lee et al.' entries with different years) — different years usually indicate different papers.
- Individual entries whose author names or titles look slightly off — you may be seeing extraction noise, not the paper's actual bibliography.
- Off-topic-looking entries that could be legitimately cited for a specific technique (e.g. an optimal-transport paper in an NLP work). Flag only when the entry is obviously unrelated AND you cannot see a plausible reason to cite it based on the manuscript's claims.
- ANY concern about the year associated with an arXiv preprint reference, under any framing whatsoever. This includes phrases like "year mismatch", "publication year inconsistency", "arXiv id predates the year", "the year should be updated", or asking the authors to "verify the year". Papers on arXiv routinely have a first-posted year different from the cited publication year, and authors legitimately cite whichever year they prefer. You have zero reliable knowledge about which year is "correct". If your intended finding is any variant of "the arXiv id and the year don't match", DROP the finding entirely.
- Any claim that a specific arXiv identifier is wrong or does not correspond to a paper. Your training knowledge of arXiv ids is unreliable and you will hallucinate. Treat every arXiv id in the bibliography as trustworthy.

- Entries listed as "Preprint" (with or without an arXiv id) that could also be cited as venue papers. Citing the arXiv/preprint version is a legitimate author choice and is not an error.

For examples of things to NOT emit (do not produce anything matching any of these shapes):
  BAD: "The reference cites arXiv:2212.xxxxx but is dated 2024 — please verify."
  BAD: "The MS MARCO reference lists arXiv:1611.09268 but the year is 2018."
  BAD: "The Faiss library citation year 2025 is inconsistent with arXiv:2401.xxxxx."
  BAD: "This paper is listed as a Preprint but has a peer-reviewed version — consider updating."

For each real issue, return via the provided tool:
- category: "reference_quality".
- severity: "high" | "medium" | "low".
- title: short one-line summary.
- description: 1-2 sentence explanation grounded in the manuscript topic and estimated publication year.
- evidence: the specific reference entry or a short description of the pattern.
- suggestion: concrete advice.
- related_refs: optional array of specific titles you are confident exist. Prefer empty than fabricate.

Ground rules:
- Do not fabricate references.
- If the list looks appropriate for the paper's scope, call the tool with an empty issues array.
"""


# Findings that mention an arXiv id and any year mismatch are almost always
# spurious — the LLM keeps flagging normal preprint-year discrepancies despite
# repeated prompt instructions. Filter them out post hoc as a safety net.
_ARXIV_ID_RE = re.compile(r"arxiv[:\s]?\s?\d{4}\.\d{4,5}", re.IGNORECASE)
_YEAR_CONCERN_RE = re.compile(
    r"\b(year|date|20\d{2}|preprint)\b", re.IGNORECASE
)


def _is_arxiv_year_finding(issue: Issue) -> bool:
    blob = " ".join([issue.title, issue.description, issue.evidence, issue.suggestion])
    lower = blob.lower()
    if not (_ARXIV_ID_RE.search(blob) or "arxiv" in lower or "preprint" in lower):
        return False
    return bool(_YEAR_CONCERN_RE.search(blob))


def _check_reference_list_quality(
    meta: dict[str, Any],
    model: str,
    client: Any,
) -> list[Issue]:
    references_raw = (meta.get("references_raw") or "").strip()
    if not references_raw:
        return [
            Issue(
                category="reference_quality",
                severity="high",
                title="Reference list is missing or could not be located",
                description=(
                    "No References or Bibliography section was found in the "
                    "manuscript text. A paper of this scope is expected to "
                    "provide a proper reference list."
                ),
                suggestion="Add a References section with proper bibliographic entries.",
            )
        ]

    payload_lines = [
        f"Manuscript title: {meta.get('title', '')}",
        f"Abstract: {meta.get('abstract', '')}",
        "",
        "Main claims:",
    ]
    for i, claim in enumerate(meta.get("claims") or [], 1):
        payload_lines.append(f"{i}. {claim}")
    payload_lines.append("")
    payload_lines.append(
        "Raw References section as extracted from the manuscript (verbatim, "
        "may include line-break artifacts from PDF extraction — treat those as "
        "extraction noise, not as errors in the bibliography):"
    )
    payload_lines.append(references_raw)

    data = converse_json(
        model_id=model,
        system_prompt=_REFERENCE_QUALITY_SYSTEM_PROMPT,
        user_message="\n".join(payload_lines),
        schema=_ISSUES_SCHEMA,
        tool_name="record_reference_quality_issues",
        tool_description="Record reference-list quality issues.",
        temperature=0.2,
        client=client,
    )
    issues = [Issue(**item) for item in data.get("issues", [])]
    return [i for i in issues if not _is_arxiv_year_finding(i)]


# ---------------------------------------------------------------------------
# public API
# ---------------------------------------------------------------------------


def run(
    paper_text: str,
    model: str = DEFAULT_MODEL,
    client: Any = None,
) -> list[Issue]:
    """Run the LLM-only literature-side review over a manuscript.

    Bedrock and JSON-parse errors propagate to the caller (fail-fast).
    """
    if not paper_text or not paper_text.strip():
        raise ValueError("No paper text provided.")

    meta = _parse_manuscript(paper_text, model, client)
    return [
        *_check_novelty(meta, model, client),
        *_check_missing_citations(paper_text, model, client),
        *_check_reference_list_quality(meta, model, client),
    ]
