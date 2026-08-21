"""Tests for reviewer.review_paper — mode routing and input validation."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

import reviewer


def _text_response(text: str) -> dict:
    return {"output": {"message": {"content": [{"text": text}]}}}


def test_review_paper_rejects_empty_input():
    with pytest.raises(ValueError, match="No paper text provided"):
        reviewer.review_paper("")
    with pytest.raises(ValueError, match="No paper text provided"):
        reviewer.review_paper("   \n\t")


def test_review_paper_rejects_unknown_mode():
    with pytest.raises(ValueError, match="Unknown mode"):
        reviewer.review_paper("some text", mode="essay", client=MagicMock())


@pytest.mark.parametrize(
    "mode,expected_prompt,expected_label",
    [
        ("paper", reviewer.SYSTEM_PROMPT_PAPER, "manuscript"),
        ("report", reviewer.SYSTEM_PROMPT_REPORT, "student report"),
    ],
)
def test_review_paper_routes_prompt_and_message_by_mode(mode, expected_prompt, expected_label):
    client = MagicMock()
    client.converse.return_value = _text_response("## Summary\nOK.")

    result = reviewer.review_paper("body text", mode=mode, client=client)

    assert result.mode == mode
    assert result.markdown == "## Summary\nOK."
    kwargs = client.converse.call_args.kwargs
    assert kwargs["system"] == [{"text": expected_prompt}]
    assert expected_label in kwargs["messages"][0]["content"][0]["text"]


def test_review_paper_marks_truncated_when_text_exceeds_max():
    client = MagicMock()
    client.converse.return_value = _text_response("done")
    long_text = "x" * (reviewer.MAX_CHARS + 500)

    result = reviewer.review_paper(long_text, client=client)

    assert result.truncated is True
    user_text = client.converse.call_args.kwargs["messages"][0]["content"][0]["text"]
    # The manuscript body in the message should be capped at MAX_CHARS.
    body = user_text.split("\n\n", 1)[1]
    assert len(body) == reviewer.MAX_CHARS
