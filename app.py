"""Minimal Streamlit UI for the AI Paper Reviewer prototype."""

from __future__ import annotations

import os

import streamlit as st
from dotenv import load_dotenv

from pdf_utils import extract_text
from reviewer import DEFAULT_MODEL, review_paper

load_dotenv()

MODELS = ["gpt-4o-mini", "gpt-4o"]

st.set_page_config(page_title="AI Paper Reviewer", page_icon="📝")

st.title("AI Paper Reviewer")
st.write(
    "Upload a manuscript (PDF or text) or paste it below to get a structured, "
    "peer-review-style report. This is a prototype for pre-submission feedback."
)

if not os.getenv("OPENAI_API_KEY"):
    st.warning(
        "OPENAI_API_KEY is not set. Copy .env.example to .env and add your key, "
        "then restart the app."
    )

model = st.selectbox(
    "Model",
    MODELS,
    index=MODELS.index(DEFAULT_MODEL) if DEFAULT_MODEL in MODELS else 0,
)

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
