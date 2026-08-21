"""Tests for the AWS-native, mode-switchable literature review module.

Covers three layers:
- Pure helpers (regex extraction, arXiv-year post-filter).
- LLM-call routing (schema, tool name, system-prompt selection per mode) via
  a MagicMock boto3 client.
- Public ``run`` orchestration and its validation paths.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from novelty_review import Issue, run
from novelty_review.src import novelty_review as nr


# ---------------------------------------------------------------------------
# _extract_references_section — pure regex helper
# ---------------------------------------------------------------------------


def test_extract_returns_empty_when_no_header():
    assert nr._extract_references_section("Just some body text with no header.") == ""


def test_extract_takes_the_last_matching_header():
    text = (
        "Body mentions the references section informally.\n"
        "\nReferences\n"
        "[1] Real reference here."
    )
    assert nr._extract_references_section(text) == "[1] Real reference here."


def test_extract_handles_colon_after_header():
    text = "Body.\nReferences:\n[1] Foo.\n[2] Bar.\n"
    result = nr._extract_references_section(text)
    assert result.startswith("[1] Foo.")
    assert "[2] Bar." in result


def test_extract_accepts_uppercase_and_bibliography_variants():
    for header in ("REFERENCES", "Bibliography", "BIBLIOGRAPHY"):
        text = f"Body.\n{header}\n[1] Entry."
        assert nr._extract_references_section(text) == "[1] Entry."


def test_extract_stops_at_explicit_appendix_header():
    text = (
        "\nReferences\n"
        "[1] Alpha.\n"
        "[2] Beta.\n"
        "\nAppendix\n"
        "Extra appendix content that should be excluded."
    )
    result = nr._extract_references_section(text)
    assert "Alpha" in result and "Beta" in result
    assert "appendix content" not in result.lower()


def test_extract_stops_at_acl_style_single_letter_appendix():
    text = (
        "\nReferences\n"
        "Alice Author. 2020. A Paper. In ACL.\n"
        "Bob Author. 2021. Another. In EMNLP.\n"
        "\nA Gaussian Characterization\n"
        "Appendix body text."
    )
    result = nr._extract_references_section(text)
    assert "Alice Author" in result
    assert "Gaussian" not in result


def test_extract_is_capped_at_max_length():
    long_body = "x" * (nr.MAX_REFERENCE_CHARS + 5_000)
    text = f"\nReferences\n{long_body}"
    assert len(nr._extract_references_section(text)) == nr.MAX_REFERENCE_CHARS


# ---------------------------------------------------------------------------
# _is_arxiv_year_finding — post-filter for the persistent LLM false positive
# ---------------------------------------------------------------------------


def _issue(**overrides) -> Issue:
    base = dict(
        category="reference_quality",
        severity="medium",
        title="",
        description="",
        evidence="",
        suggestion="",
    )
    base.update(overrides)
    return Issue(**base)


def test_arxiv_year_finding_flagged_by_id_and_year_keyword():
    issue = _issue(
        title="MS MARCO reference has implausible arXiv ID",
        description="Cites arXiv:1611.09268 but is dated 2018.",
    )
    assert nr._is_arxiv_year_finding(issue) is True


def test_arxiv_year_finding_flagged_by_preprint_and_year():
    issue = _issue(
        title="Preprint reference",
        description="Listed as Preprint but the year 2024 does not match.",
    )
    assert nr._is_arxiv_year_finding(issue) is True


def test_arxiv_finding_without_year_word_not_flagged():
    issue = _issue(
        title="Off-topic reference",
        description="An arXiv paper on point cloud super-resolution is unrelated to the NLP topic.",
    )
    assert nr._is_arxiv_year_finding(issue) is False


def test_finding_without_arxiv_reference_not_flagged():
    issue = _issue(
        title="Thin reference list",
        description="Only 2 references cited; the list looks too thin for the scope.",
    )
    assert nr._is_arxiv_year_finding(issue) is False


def test_arxiv_year_check_scans_evidence_field():
    issue = _issue(
        title="Nit",
        description="minor",
        evidence="Foo et al. 2024. Preprint, arXiv:2401.08281.",
    )
    assert nr._is_arxiv_year_finding(issue) is True


# ---------------------------------------------------------------------------
# _parse_manuscript — LLM routing + references_raw injection
# ---------------------------------------------------------------------------


def _fake_converse_json_response(payload: dict) -> dict:
    """Shape a MagicMock client.converse() response for a JSON tool-use call."""
    return {
        "output": {
            "message": {
                "content": [{"toolUse": {"name": "any", "input": payload}}]
            }
        }
    }


def test_parse_manuscript_injects_raw_references(monkeypatch):
    llm_payload = {
        "title": "Some Paper",
        "abstract": "Some abstract.",
        "claims": ["Claim 1", "Claim 2"],
    }
    client = MagicMock()
    client.converse.return_value = _fake_converse_json_response(llm_payload)

    text = "Body text.\nReferences\n[1] Foo. 2020.\n[2] Bar. 2021.\n"
    meta = nr._parse_manuscript(text, "model-x", client)

    assert meta["title"] == "Some Paper"
    assert meta["claims"] == ["Claim 1", "Claim 2"]
    assert "[1] Foo. 2020." in meta["references_raw"]

    # The parse call must not ask the LLM for references.
    call = client.converse.call_args
    assert "references" not in str(call.kwargs["toolConfig"]["tools"][0]["toolSpec"]["inputSchema"])


# ---------------------------------------------------------------------------
# _check_novelty — mode routes to the correct prompt and tool name
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "mode,expected_prompt,expected_tool",
    [
        ("paper", nr._NOVELTY_SYSTEM_PROMPT_PAPER, "record_novelty_issues"),
        ("report", nr._NOVELTY_SYSTEM_PROMPT_REPORT, "record_engagement_issues"),
    ],
)
def test_check_novelty_routes_by_mode(mode, expected_prompt, expected_tool):
    client = MagicMock()
    client.converse.return_value = _fake_converse_json_response({"issues": []})
    meta = {"title": "Foo", "claims": ["Claim A"]}

    issues = nr._check_novelty(meta, "model-x", client, mode=mode)

    assert issues == []
    call_kwargs = client.converse.call_args.kwargs
    assert call_kwargs["system"] == [{"text": expected_prompt}]
    assert call_kwargs["toolConfig"]["tools"][0]["toolSpec"]["name"] == expected_tool


def test_check_novelty_returns_empty_when_no_claims():
    client = MagicMock()
    issues = nr._check_novelty({"title": "Foo", "claims": []}, "model-x", client)
    assert issues == []
    client.converse.assert_not_called()


# ---------------------------------------------------------------------------
# _check_missing_citations — mode-aware prompt and payload label
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "mode,expected_prompt,expected_label",
    [
        ("paper", nr._MISSING_CITATION_SYSTEM_PROMPT_PAPER, "Manuscript text"),
        ("report", nr._MISSING_CITATION_SYSTEM_PROMPT_REPORT, "Report text"),
    ],
)
def test_check_missing_citations_routes_by_mode(mode, expected_prompt, expected_label):
    client = MagicMock()
    client.converse.return_value = _fake_converse_json_response({"issues": []})

    nr._check_missing_citations("Some body.", "model-x", client, mode=mode)

    call_kwargs = client.converse.call_args.kwargs
    assert call_kwargs["system"] == [{"text": expected_prompt}]
    user_text = call_kwargs["messages"][0]["content"][0]["text"]
    assert user_text.startswith(f"{expected_label}:")


# ---------------------------------------------------------------------------
# _check_reference_list_quality — empty refs, mode routing, arxiv filter
# ---------------------------------------------------------------------------


def test_reference_quality_returns_missing_issue_when_no_refs():
    client = MagicMock()

    issues = nr._check_reference_list_quality({"title": "T", "references_raw": ""}, "m", client)

    assert len(issues) == 1
    assert issues[0].category == "reference_quality"
    assert "missing" in issues[0].title.lower() or "could not be located" in issues[0].title.lower()
    client.converse.assert_not_called()


def test_reference_quality_missing_issue_wording_differs_by_mode():
    paper_issue = nr._check_reference_list_quality(
        {"title": "T", "references_raw": ""}, "m", MagicMock(), mode="paper"
    )[0]
    report_issue = nr._check_reference_list_quality(
        {"title": "T", "references_raw": ""}, "m", MagicMock(), mode="report"
    )[0]
    assert "manuscript" in paper_issue.description.lower()
    assert "report" in report_issue.description.lower()


@pytest.mark.parametrize(
    "mode,expected_prompt",
    [
        ("paper", nr._REFERENCE_QUALITY_SYSTEM_PROMPT_PAPER),
        ("report", nr._REFERENCE_QUALITY_SYSTEM_PROMPT_REPORT),
    ],
)
def test_reference_quality_routes_by_mode(mode, expected_prompt):
    client = MagicMock()
    client.converse.return_value = _fake_converse_json_response({"issues": []})
    meta = {"title": "T", "abstract": "A", "claims": [], "references_raw": "[1] X"}

    nr._check_reference_list_quality(meta, "m", client, mode=mode)

    call_kwargs = client.converse.call_args.kwargs
    assert call_kwargs["system"] == [{"text": expected_prompt}]


def test_reference_quality_filters_arxiv_year_findings():
    client = MagicMock()
    client.converse.return_value = _fake_converse_json_response(
        {
            "issues": [
                {
                    "category": "reference_quality",
                    "severity": "medium",
                    "title": "arXiv year mismatch",
                    "description": "arXiv:2401.08281 cited as 2025, please verify.",
                },
                {
                    "category": "reference_quality",
                    "severity": "high",
                    "title": "Thin reference list",
                    "description": "Only 2 references given the scope.",
                },
            ]
        }
    )
    meta = {"title": "T", "abstract": "", "claims": [], "references_raw": "[1] X"}

    issues = nr._check_reference_list_quality(meta, "m", client)

    assert len(issues) == 1
    assert issues[0].title == "Thin reference list"


# ---------------------------------------------------------------------------
# run — orchestration and validation
# ---------------------------------------------------------------------------


def test_run_requires_non_empty_text():
    with pytest.raises(ValueError, match="No paper text provided"):
        run("")
    with pytest.raises(ValueError, match="No paper text provided"):
        run("   \n\t  ")


def test_run_rejects_unknown_mode():
    with pytest.raises(ValueError, match="Unknown mode"):
        run("some text", mode="essay")


def test_run_orchestrates_all_three_checks(monkeypatch):
    calls: list[str] = []

    def fake_parse(text, model, client):
        calls.append("parse")
        return {"title": "T", "abstract": "A", "claims": ["c"], "references_raw": "[1] X"}

    def fake_novelty(meta, model, client, mode=nr.DEFAULT_MODE):
        calls.append(f"novelty:{mode}")
        return [_issue(title="nov")]

    def fake_missing(text, model, client, mode=nr.DEFAULT_MODE):
        calls.append(f"missing:{mode}")
        return [_issue(title="miss")]

    def fake_ref(meta, model, client, mode=nr.DEFAULT_MODE):
        calls.append(f"ref:{mode}")
        return [_issue(title="ref")]

    monkeypatch.setattr(nr, "_parse_manuscript", fake_parse)
    monkeypatch.setattr(nr, "_check_novelty", fake_novelty)
    monkeypatch.setattr(nr, "_check_missing_citations", fake_missing)
    monkeypatch.setattr(nr, "_check_reference_list_quality", fake_ref)

    issues = run("some text", mode="report")

    assert calls == ["parse", "novelty:report", "missing:report", "ref:report"]
    assert [i.title for i in issues] == ["nov", "miss", "ref"]
