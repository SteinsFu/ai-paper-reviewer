"""Minimal Streamlit UI for the AI Paper Reviewer prototype."""

from __future__ import annotations

import os

import streamlit as st
from dotenv import load_dotenv

from bedrock_client import HAIKU_4_5, SONNET_4_5
from novelty_review import run as run_novelty_review
from pdf_utils import extract_text
from reviewer import DEFAULT_MODEL, review_paper

load_dotenv()

MODEL_CHOICES = {
    "Claude Haiku 4.5": HAIKU_4_5,
    "Claude Sonnet 4.5": SONNET_4_5,
}

st.set_page_config(page_title="AI Paper Reviewer", page_icon="📝")

st.title("AI Paper Reviewer")
st.write(
    "Upload a manuscript (PDF or text) or paste it below to get a structured, "
    "peer-review-style report. This is a prototype for pre-submission feedback."
)

if not os.getenv("AWS_BEARER_TOKEN_BEDROCK"):
    st.warning(
        "AWS_BEARER_TOKEN_BEDROCK is not set. Copy .env.example to .env and add "
        "your Bedrock API key, then restart the app."
    )

_default_label = next(
    (label for label, mid in MODEL_CHOICES.items() if mid == DEFAULT_MODEL),
    next(iter(MODEL_CHOICES)),
)
model_label = st.selectbox(
    "Model",
    list(MODEL_CHOICES.keys()),
    index=list(MODEL_CHOICES.keys()).index(_default_label),
)
model = MODEL_CHOICES[model_label]

uploaded = st.file_uploader("Upload paper", type=["pdf", "txt", "md"])
pasted = st.text_area("...or paste the paper text here", height=200)

if st.button("Generate Review", type="primary"):
    paper_text = ""
    try:
        if uploaded is not None:
            paper_text = extract_text(uploaded.name, uploaded.getvalue())
        elif pasted.strip():
            paper_text = pasted.strip()
        else:
            st.error("Please upload a file or paste some text.")
            st.stop()
    except ValueError as exc:
        st.error(str(exc))
        st.stop()

    if not paper_text.strip():
        st.error("Could not extract any text from the input.")
        st.stop()

    with st.spinner("Reviewing the manuscript..."):
        try:
            result = review_paper(paper_text, model=model)
        except Exception as exc:  # noqa: BLE001 - surface any API error to the user
            st.error(f"Review failed: {exc}")
            st.stop()

    if result.truncated:
        st.info(
            "The manuscript was long and has been truncated for this prototype; "
            "the review covers the beginning of the paper."
        )

    st.markdown("---")
    st.markdown(result.markdown)

    with st.spinner("Checking novelty and citations..."):
        try:
            issues = run_novelty_review(paper_text, model=model)
        except Exception as exc:  # noqa: BLE001 - surface any error to the user
            st.error(f"Novelty/citation review failed: {exc}")
            st.stop()

    st.markdown("---")
    st.subheader("Issues")
    if not issues:
        st.write("No novelty or citation issues detected.")
    else:
        for issue in issues:
            st.markdown(f"**[{issue.severity}] {issue.title}** — `{issue.category}`")
            st.markdown(issue.description)
            if issue.evidence:
                st.caption(f"Evidence: {issue.evidence}")
            if issue.suggestion:
                st.markdown(f"_Suggestion:_ {issue.suggestion}")
            if issue.related_refs:
                st.caption("Related: " + " / ".join(issue.related_refs))
