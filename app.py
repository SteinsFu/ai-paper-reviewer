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
    "Upload a document (PDF or text) or paste it below to get a structured "
    "review. Switch modes depending on whether you are reviewing an academic "
    "paper or a university report."
)

if not os.getenv("AWS_BEARER_TOKEN_BEDROCK"):
    st.warning(
        "AWS_BEARER_TOKEN_BEDROCK is not set. Copy .env.example to .env and add "
        "your Bedrock API key, then restart the app."
    )

MODE_CHOICES = {
    "Academic paper": "paper",
    "University report": "report",
}
mode_label = st.radio(
    "Document type",
    list(MODE_CHOICES.keys()),
    horizontal=True,
)
mode = MODE_CHOICES[mode_label]

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

_upload_label = "Upload paper" if mode == "paper" else "Upload report"
_paste_label = (
    "...or paste the paper text here"
    if mode == "paper"
    else "...or paste the report text here"
)
uploaded = st.file_uploader(_upload_label, type=["pdf", "txt", "md"])
pasted = st.text_area(_paste_label, height=200)

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

    _doc_label = "manuscript" if mode == "paper" else "report"

    with st.spinner(f"Reviewing the {_doc_label}..."):
        try:
            result = review_paper(paper_text, model=model, mode=mode)
        except Exception as exc:  # noqa: BLE001 - surface any API error to the user
            st.error(f"Review failed: {exc}")
            st.stop()

    if result.truncated:
        st.info(
            f"The {_doc_label} was long and has been truncated for this "
            f"prototype; the review covers the beginning of the {_doc_label}."
        )

    st.markdown("---")
    st.markdown(result.markdown)

    _issue_spinner = (
        "Checking novelty and citations..."
        if mode == "paper"
        else "Checking engagement and citations..."
    )
    with st.spinner(_issue_spinner):
        try:
            issues = run_novelty_review(paper_text, model=model, mode=mode)
        except Exception as exc:  # noqa: BLE001 - surface any error to the user
            st.error(f"Literature review failed: {exc}")
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
