"""Utilities for extracting plain text from uploaded files."""

from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader


def extract_text_from_pdf(data: bytes) -> str:
    """Extract text from PDF bytes."""
    reader = PdfReader(BytesIO(data))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return "\n\n".join(pages).strip()


def extract_text(filename: str, data: bytes) -> str:
    """Extract text from an uploaded file based on its extension.

    Supports PDF and plain text (.txt, .md). Raises ValueError for others.
    """
    name = filename.lower()
    if name.endswith(".pdf"):
        return extract_text_from_pdf(data)
    if name.endswith((".txt", ".md")):
        return data.decode("utf-8", errors="replace").strip()
    raise ValueError(f"Unsupported file type: {filename}")
