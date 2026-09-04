"""Closed CS venue catalog + field classification + match-to-bar ranking.

``GET /paper/{id}/venues`` classifies a stored review into at most two catalog
tags (Haiku), filters this list, then ranks by how close the paper's overall
score sits to each venue's difficulty bar. The model never invents venue names.

The catalog is ``data/venues.json``, built offline (``scripts/merge_venue_catalog.py``
+ ``data/icore2026_a_star.json``). This module never calls ICORE, DBLP, or the network.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from bedrock_client import HAIKU_4_5, converse_json

FIELD_TAGS = ("hci", "nlp", "ml", "ml4h", "se", "haptics", "cv", "systems", "security", "other")
FIELD_LABELS = {
    "hci": "HCI",
    "nlp": "NLP",
    "ml": "ML",
    "ml4h": "ML for Health",
    "se": "Software Engineering",
    "haptics": "Haptics",
    "cv": "Computer Vision",
    "systems": "Systems",
    "security": "Security",
    "other": "Other",
}
PRIMARY_FIT = 88
SECONDARY_FIT = 72
MAX_VENUES = 8
_SUMMARY_CHARS = 2000

_CONF_DEADLINE_NOTE = "Confirm current cycle on the venue page"
_JOURNAL_DEADLINE_NOTE = "Rolling submissions"

_CATALOG_PATH = Path(__file__).resolve().parent / "data" / "venues.json"

_CLASSIFY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "primary": {"type": "string", "enum": list(FIELD_TAGS)},
        "secondary": {"type": "string", "enum": ["", *FIELD_TAGS]},
    },
    "required": ["primary", "secondary"],
}

_CLASSIFY_SYSTEM = """You assign a computer-science publication field so we can recommend
real conferences and journals from a closed catalog. Return only the tool call.

Fields (use these ids exactly):
- hci: human-computer interaction, user studies of interactive systems, CSCW, IUI, interactive-system design
- nlp: computational linguistics, language models framed as an NLP contribution
- ml: core machine-learning methods, representation learning, general AI/ML
- ml4h: machine learning for health/clinical applications, medical informatics
- se: software engineering, empirical SE, mining software repositories, developer tools
- haptics: tactile/haptic hardware and perception
- cv: computer vision, graphics, multimedia, VR/AR (CVPR, ICCV, SIGGRAPH)
- systems: operating systems, networking, computer architecture, distributed systems (SOSP, OSDI, SIGCOMM)
- security: computer security, privacy, cryptography (CCS, IEEE S&P, USENIX Security)
- other: not CS, or a CS area outside this list (theory-only, education-only, …)

primary is required. secondary is a second CS field only if the paper is genuinely
split across two of the CS fields above; otherwise set secondary to the empty string.
Never set secondary to other. If primary is other, secondary must be empty.
Do not invent venues or fields.
"""


@lru_cache(maxsize=1)
def load_catalog() -> tuple[dict[str, Any], ...]:
    raw = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    return tuple(raw)


def difficulty_bar(acceptance_rate: float, prestige: float) -> float:
    raw = 0.55 * (100 - acceptance_rate) + 8 * prestige
    return max(50.0, min(96.0, raw))


def match_score(overall: float, acceptance_rate: float, prestige: float) -> int:
    bar = difficulty_bar(acceptance_rate, prestige)
    return max(0, min(100, round(100 - abs(overall - bar))))


def _normalize_tags(primary: str, secondary: str | None) -> tuple[str, str | None]:
    primary = primary if primary in FIELD_TAGS else "other"
    if not secondary or secondary in ("", primary, "other") or secondary not in FIELD_TAGS:
        return primary, None
    if primary == "other":
        return primary, None
    return primary, secondary


def classify_fields(
    title: str,
    report_summary: str,
    novelty_summary: str,
    *,
    model: str = HAIKU_4_5,
    client: Any = None,
) -> tuple[str, str | None]:
    user_message = (
        f"Title: {title or '(untitled)'}\n\n"
        f"Review summary:\n{(report_summary or '')[:_SUMMARY_CHARS]}\n\n"
        f"Novelty summary:\n{(novelty_summary or '')[:_SUMMARY_CHARS]}"
    )
    result = converse_json(
        model_id=model,
        system_prompt=_CLASSIFY_SYSTEM,
        user_message=user_message,
        schema=_CLASSIFY_SCHEMA,
        tool_name="record_venue_fields",
        tool_description="Record the paper's catalog field tags.",
        temperature=0.0,
        max_tokens=256,
        client=client,
    )
    return _normalize_tags(str(result.get("primary") or "other"), result.get("secondary"))


def _deadline_note(kind: str) -> str:
    return _JOURNAL_DEADLINE_NOTE if kind == "journal" else _CONF_DEADLINE_NOTE


def _rationale(entry: dict[str, Any], primary: str, secondary: str | None) -> str:
    tags = [FIELD_LABELS[primary]]
    if secondary:
        tags.append(FIELD_LABELS[secondary])
    tagged = " + ".join(tags)
    return f"{entry['esteem']} Suggested because this paper was tagged {tagged}."


def suggest_venues(
    primary: str,
    secondary: str | None,
    overall: float,
    *,
    limit: int | None = MAX_VENUES,
) -> list[dict[str, Any]]:
    """Filter the catalog by tags, attach fit/match, rank by match then prestige."""
    primary, secondary = _normalize_tags(primary, secondary)
    if primary == "other":
        return []
    wanted = {primary}
    if secondary:
        wanted.add(secondary)
    scored: list[dict[str, Any]] = []
    for entry in load_catalog():
        tags = set(entry.get("tags") or [])
        if not tags.intersection(wanted):
            continue
        fit = PRIMARY_FIT if primary in tags else SECONDARY_FIT
        kind = entry["kind"]
        row = {
            "id": entry["id"],
            "name": entry["name"],
            "fullName": entry["fullName"],
            "kind": kind,
            "field": entry["field"],
            "prestige": entry["prestige"],
            "tierLabel": entry["tierLabel"],
            "esteem": entry["esteem"],
            "fit": fit,
            "acceptanceRate": entry["acceptanceRate"],
            "deadline": None,
            "deadlineNote": _deadline_note(kind),
            "h5": entry["h5"],
            "url": entry["url"],
            "rationale": _rationale(entry, primary, secondary),
            "match": match_score(overall, entry["acceptanceRate"], entry["prestige"]),
        }
        if entry.get("location"):
            row["location"] = entry["location"]
        scored.append(row)
    scored.sort(key=lambda v: (-v["match"], -v["prestige"], -v["fit"], v["name"]))
    if limit is None:
        return scored
    return scored[:limit]


def suggest_for_bundle(
    bundle: dict[str, Any],
    *,
    model: str = HAIKU_4_5,
    client: Any = None,
) -> dict[str, Any]:
    paper = bundle.get("paper") or {}
    report = bundle.get("report") or {}
    novelty = bundle.get("novelty") or {}
    primary, secondary = classify_fields(
        str(paper.get("title") or ""),
        str(report.get("summary") or ""),
        str(novelty.get("summary") or ""),
        model=model,
        client=client,
    )
    overall = paper.get("overall") or 0
    return {
        "primary": primary,
        "secondary": secondary,
        "venues": suggest_venues(primary, secondary, overall),
    }
