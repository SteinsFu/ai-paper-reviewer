"""Tests for bundle_builder — pure helpers and full ReviewBundle assembly."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

import bundle_builder as bb


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def test_count_words_counts_whitespace_separated_tokens():
    assert bb.count_words("hello world foo") == 3
    assert bb.count_words("   spaced\n\nout   text  ") == 3
    assert bb.count_words("") == 0


def test_count_figures_deduplicates_by_number():
    text = "See Figure 1 and Fig. 2. Later we cite Figure 1 again and Figure 3."
    assert bb.count_figures(text) == 3


def test_count_figures_handles_no_figures():
    assert bb.count_figures("Plain body text with no figures.") == 0


def test_count_pages_returns_zero_when_no_bytes():
    assert bb.count_pages(None) == 0
    assert bb.count_pages(b"") == 0


def test_count_pages_returns_zero_on_invalid_pdf():
    assert bb.count_pages(b"not a real pdf") == 0


def test_split_references_produces_ids_and_drops_stragglers():
    raw = (
        "Alice Author. 2020. A Paper. In ACL.\n\n"
        "Bob Author. 2021. Another Paper. In EMNLP.\n\n"
        "12\n\n"  # too short — drop
        "Carol Author, David Author. 2022. Third Paper. In NeurIPS."
    )
    refs = bb.split_references(raw)
    assert [r["id"] for r in refs] == ["r1", "r2", "r3"]
    assert refs[0]["text"].startswith("Alice Author.")
    assert "Third Paper" in refs[2]["text"]


def test_split_references_empty_returns_empty_list():
    assert bb.split_references("") == []
    assert bb.split_references("   \n\n   ") == []


def test_split_references_splits_on_numeric_bracket_markers_without_blank_lines():
    raw = (
        "[1] Vaswani et al. Attention is All You Need. NeurIPS 2017.\n"
        "[2] Sanh et al. DistilBERT, a distilled version of BERT. NeurIPS 2019.\n"
        "[3] Devlin et al. BERT: Pre-training. NAACL 2019."
    )
    refs = bb.split_references(raw)
    assert [r["id"] for r in refs] == ["r1", "r2", "r3"]
    assert refs[0]["text"].startswith("[1] Vaswani")
    assert refs[2]["text"].startswith("[3] Devlin")


def test_split_references_splits_on_dot_numbered_markers():
    raw = (
        "1. Alpha Author. 2020. First. In ACL.\n"
        "2. Beta Author. 2021. Second. In EMNLP."
    )
    refs = bb.split_references(raw)
    assert len(refs) == 2


def test_build_manuscript_blocks_returns_paragraph_blocks():
    text = "First para line.\n\nSecond paragraph here.\n\nThird one."
    blocks = bb.build_manuscript_blocks(text)
    assert len(blocks) == 3
    assert all(b["type"] == "p" for b in blocks)
    assert all("runs" in b and len(b["runs"]) == 1 for b in blocks)
    assert blocks[0]["runs"][0]["t"] == "First para line."


def test_build_manuscript_blocks_caps_at_max():
    text = "\n\n".join(f"para {i}" for i in range(bb.MAX_MANUSCRIPT_BLOCKS + 20))
    blocks = bb.build_manuscript_blocks(text)
    assert len(blocks) == bb.MAX_MANUSCRIPT_BLOCKS


def test_build_manuscript_blocks_empty_input():
    assert bb.build_manuscript_blocks("") == []
    assert bb.build_manuscript_blocks("   \n\n   ") == []


def test_enrich_annotations_assigns_ids_and_clamps_enums():
    raw = [
        {"cat": "writing", "sev": "critical", "section": "Abstract", "title": "T", "excerpt": "E", "comment": "C"},
        {"cat": "bogus", "sev": "extreme", "section": "Method", "title": "T2", "excerpt": "E2", "comment": "C2"},
    ]
    out = bb.enrich_annotations(raw)
    assert [a["id"] for a in out] == ["a1", "a2"]
    assert out[0]["cat"] == "writing"
    assert out[0]["sev"] == "critical"
    assert out[1]["cat"] == "writing"  # clamped
    assert out[1]["sev"] == "minor"  # clamped
    assert all(a["origin"] == "ai" for a in out)


def test_enrich_annotations_preserves_optional_fields():
    raw = [{
        "cat": "citation", "sev": "moderate", "section": "Intro",
        "title": "Missing ref", "excerpt": "E", "comment": "C",
        "suggestion": "Cite Vaswani et al. 2017",
        "rewrite": "As shown in prior work [X], ...",
        "missingRef": "seminal Transformer paper",
        "isFigure": False,
    }]
    out = bb.enrich_annotations(raw)
    assert out[0]["suggestion"] == "Cite Vaswani et al. 2017"
    assert out[0]["rewrite"].startswith("As shown")
    assert out[0]["missingRef"] == "seminal Transformer paper"
    assert "isFigure" not in out[0]  # False is dropped


def test_enrich_annotations_keeps_isFigure_true():
    raw = [{
        "cat": "format", "sev": "minor", "section": "Fig", "title": "T",
        "excerpt": "E", "comment": "C", "isFigure": True,
    }]
    out = bb.enrich_annotations(raw)
    assert out[0]["isFigure"] is True


def test_derive_missing_refs_picks_only_citation_with_missingRef():
    annotations = [
        {"id": "a1", "cat": "writing", "missingRef": "something", "comment": "c1"},
        {"id": "a2", "cat": "citation", "missingRef": "seminal X paper", "comment": "c2"},
        {"id": "a3", "cat": "citation", "comment": "c3"},  # no missingRef -> skip
    ]
    refs = bb.derive_missing_refs(annotations)
    assert len(refs) == 1
    assert refs[0] == {"for": "a2", "text": "seminal X paper", "reason": "c2"}


def test_overall_score_averages_present_categories():
    scores = {"writing": 80, "structure": 60, "method": 70, "logic": 90, "novelty": 50, "citation": 65, "format": 75}
    assert bb.overall_score(scores) == 70  # (80+60+70+90+50+65+75)/7 = 70


def test_overall_score_returns_zero_for_empty():
    assert bb.overall_score({}) == 0


def test_stable_paper_id_is_deterministic_and_prefixed():
    a = bb.stable_paper_id("Some paper text about transformers.")
    b = bb.stable_paper_id("Some paper text about transformers.")
    c = bb.stable_paper_id("Different paper.")
    assert a == b
    assert a != c
    assert a.startswith("p_") and len(a) == 12


# ---------------------------------------------------------------------------
# LLM helpers — verify tool-use wiring against a MagicMock client
# ---------------------------------------------------------------------------


def _tool_response(payload: dict) -> dict:
    return {"output": {"message": {"content": [{"toolUse": {"name": "any", "input": payload}}]}}}


def test_structured_report_uses_report_schema_and_tool_name():
    client = MagicMock()
    client.converse.return_value = _tool_response({
        "summary": "OK", "strengths": ["s1"], "weaknesses": ["w1"], "minor": ["m1"],
        "recommendation": "minor", "confidence": 4,
    })

    out = bb.structured_report("body", "model-x", client)

    assert out["recommendation"] == "minor"
    tool_spec = client.converse.call_args.kwargs["toolConfig"]["tools"][0]["toolSpec"]
    assert tool_spec["name"] == "record_review_report"
    assert tool_spec["inputSchema"] == {"json": bb._REPORT_SCHEMA}


def test_score_categories_uses_scores_schema_and_returns_all_seven_keys():
    client = MagicMock()
    scores = {c: 70 for c in bb.CATEGORY_IDS}
    client.converse.return_value = _tool_response(scores)

    out = bb.score_categories("body", "model-x", client)

    assert set(out) == set(bb.CATEGORY_IDS)
    tool_spec = client.converse.call_args.kwargs["toolConfig"]["tools"][0]["toolSpec"]
    assert tool_spec["name"] == "record_category_scores"
    assert tool_spec["inputSchema"] == {"json": bb._SCORES_SCHEMA}


def test_assess_novelty_passes_claims_and_uses_novelty_schema():
    client = MagicMock()
    client.converse.return_value = _tool_response({
        "score": 72, "verdict": "Solid contribution", "summary": "s",
        "strengths": ["a"], "risks": ["b"],
    })
    meta = {"title": "T", "abstract": "A", "claims": ["c1", "c2"]}

    out = bb.assess_novelty(meta, "model-x", client)

    assert out["score"] == 72
    user_msg = client.converse.call_args.kwargs["messages"][0]["content"][0]["text"]
    assert "c1" in user_msg and "c2" in user_msg
    tool_spec = client.converse.call_args.kwargs["toolConfig"]["tools"][0]["toolSpec"]
    assert tool_spec["name"] == "record_novelty_assessment"


def test_generate_annotations_returns_list_field_from_payload():
    client = MagicMock()
    client.converse.return_value = _tool_response({
        "annotations": [
            {"cat": "writing", "sev": "minor", "section": "Intro", "title": "T", "excerpt": "E", "comment": "C"}
        ]
    })

    out = bb.generate_annotations("body", "model-x", client)

    assert len(out) == 1
    assert out[0]["cat"] == "writing"


# ---------------------------------------------------------------------------
# build_bundle — full assembly against mocked LLM
# ---------------------------------------------------------------------------


def test_build_bundle_rejects_empty_text():
    with pytest.raises(ValueError, match="No paper text provided"):
        bb.build_bundle("")


def test_build_bundle_assembles_full_shape(monkeypatch):
    # Stub every LLM call so no boto3 traffic happens.
    monkeypatch.setattr(
        bb, "_parse_manuscript",
        lambda text, model, client: {
            "title": "A Paper", "authors": "Alice, Bob", "abstract": "Abstract text.",
            "claims": ["c1", "c2"],
            "references_raw": "Alice. 2020. A Paper. In ACL.\n\nBob. 2021. Other. In EMNLP.",
        },
    )
    monkeypatch.setattr(
        bb, "structured_report",
        lambda text, model, client: {
            "summary": "S", "strengths": ["s"], "weaknesses": ["w"], "minor": ["m"],
            "recommendation": "minor", "confidence": 4,
        },
    )
    monkeypatch.setattr(
        bb, "score_categories",
        lambda text, model, client: {c: 70 for c in bb.CATEGORY_IDS},
    )
    monkeypatch.setattr(
        bb, "assess_novelty",
        lambda meta, model, client: {
            "score": 72, "verdict": "Solid", "summary": "sm", "strengths": ["a"], "risks": ["b"],
        },
    )
    monkeypatch.setattr(
        bb, "generate_annotations",
        lambda text, model, client: [
            {"cat": "citation", "sev": "moderate", "section": "Intro",
             "title": "Missing ref", "excerpt": "E", "comment": "C",
             "missingRef": "seminal X paper"},
            {"cat": "writing", "sev": "minor", "section": "Abstract",
             "title": "Verbose", "excerpt": "E2", "comment": "C2"},
        ],
    )

    text = "Para 1 here.\n\nPara 2 here with Figure 1 mention.\n\nMore text with Figure 2."
    bundle = bb.build_bundle(text, pdf_bytes=None, mode="paper")

    # Structural checks
    assert set(bundle) == {
        "paper", "scores", "manuscript", "annotations", "visuals",
        "related", "missingRefs", "novelty", "report", "references",
    }

    # paper metadata
    assert bundle["paper"]["title"] == "A Paper"
    assert bundle["paper"]["authors"] == "Alice, Bob"
    assert bundle["paper"]["venue"] == ""
    assert bundle["paper"]["pages"] == 0  # no pdf_bytes
    assert bundle["paper"]["words"] == bb.count_words(text)
    assert bundle["paper"]["figures"] == 2
    assert bundle["paper"]["refs"] == 2
    assert bundle["paper"]["overall"] == 70
    assert bundle["paper"]["recommendation"] == "minor"

    # scores in closed union only
    assert set(bundle["scores"]) == set(bb.CATEGORY_IDS)

    # annotations enriched, closed unions preserved
    assert [a["id"] for a in bundle["annotations"]] == ["a1", "a2"]
    assert all(a["cat"] in bb.CATEGORY_IDS for a in bundle["annotations"])
    assert all(a["sev"] in bb.SEVERITY_IDS for a in bundle["annotations"])

    # missingRefs derived
    assert bundle["missingRefs"] == [{"for": "a1", "text": "seminal X paper", "reason": "C"}]

    # references split
    assert [r["id"] for r in bundle["references"]] == ["r1", "r2"]

    # manuscript blocks
    assert len(bundle["manuscript"]) == 3
    assert all(b["type"] == "p" for b in bundle["manuscript"])

    # Phase 1 stubs
    assert bundle["visuals"] == []
    assert bundle["related"] == []


def test_build_bundle_clamps_bad_recommendation(monkeypatch):
    monkeypatch.setattr(
        bb, "_parse_manuscript",
        lambda text, model, client: {"title": "T", "abstract": "A", "claims": [], "references_raw": ""},
    )
    monkeypatch.setattr(
        bb, "structured_report",
        lambda text, model, client: {
            "summary": "", "strengths": [], "weaknesses": [], "minor": [],
            "recommendation": "definitely reject with prejudice", "confidence": 3,
        },
    )
    monkeypatch.setattr(bb, "score_categories", lambda t, m, c: {c: 50 for c in bb.CATEGORY_IDS})
    monkeypatch.setattr(bb, "assess_novelty", lambda m, mo, c: {"score": 50, "verdict": "", "summary": "", "strengths": [], "risks": []})
    monkeypatch.setattr(bb, "generate_annotations", lambda t, m, c: [])

    bundle = bb.build_bundle("some text")
    assert bundle["paper"]["recommendation"] == "major"  # fallback to "major"


def test_normalize_report_parses_item_tagged_string():
    """Bedrock sometimes returns strengths as an <item> blob, not string[]."""
    raw = {
        "summary": "A conceptual essay.",
        "strengths": (
            "\n<item>Clear exposition of information geometry fundamentals.</item>"
            "\n<item>Well-motivated geometric analogy.</item>"
        ),
    }
    out = bb.normalize_report(raw)
    assert out["strengths"] == [
        "Clear exposition of information geometry fundamentals.",
        "Well-motivated geometric analogy.",
    ]
    assert out["weaknesses"] == []
    assert out["minor"] == []
    assert out["recommendation"] == "major"
    assert out["confidence"] == 3
    assert out["summary"] == "A conceptual essay."


def test_normalize_report_passthrough_lists():
    raw = {
        "summary": "S",
        "strengths": ["a"],
        "weaknesses": ["b"],
        "minor": ["c"],
        "recommendation": "accept",
        "confidence": 5,
    }
    assert bb.normalize_report(raw) == raw


def test_build_bundle_coerces_string_report_lists(monkeypatch):
    monkeypatch.setattr(
        bb, "_parse_manuscript",
        lambda text, model, client: {"title": "T", "abstract": "A", "claims": [], "references_raw": ""},
    )
    monkeypatch.setattr(
        bb, "structured_report",
        lambda text, model, client: {
            "summary": "S",
            "strengths": "<item>One plus.</item><item>Two plus.</item>",
            "recommendation": "minor",
            "confidence": 4,
        },
    )
    monkeypatch.setattr(bb, "score_categories", lambda t, m, c: {c: 50 for c in bb.CATEGORY_IDS})
    monkeypatch.setattr(
        bb, "assess_novelty",
        lambda m, mo, c: {"score": 50, "verdict": "", "summary": "", "strengths": [], "risks": []},
    )
    monkeypatch.setattr(bb, "generate_annotations", lambda t, m, c: [])

    bundle = bb.build_bundle("some text")
    assert bundle["report"]["strengths"] == ["One plus.", "Two plus."]
    assert bundle["report"]["weaknesses"] == []
    assert bundle["report"]["minor"] == []
    assert bundle["report"]["recommendation"] == "minor"
