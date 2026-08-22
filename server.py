"""FastAPI backend for Matteo's React UI (`margin/app`).

Runs the AWS Bedrock review pipeline behind a small HTTP surface that mirrors
Matteo's ``MarginApi`` (see ``margin/app/src/services/api.ts``). The heavy
work lives in ``bundle_builder.build_bundle``; this module wires it into
endpoints with an SSE progress stream on ``POST /analyze``. Library and
bundles persist in SQLite (``store.py``, path from ``MARGIN_DB_PATH``).

Run locally:

    uvicorn server:app --port 8000 --reload
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from typing import Any, Iterable

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import bundle_builder as bb
import store
from bedrock_client import HAIKU_4_5
from novelty_review.src.novelty_review import _parse_manuscript
from pdf_utils import extract_text

load_dotenv()

# CORS: Vite dev server + Streamlit (for parity), plus any override via env.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8501"
_ALLOWED_ORIGINS = [o.strip() for o in os.getenv("MARGIN_ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]

app = FastAPI(title="Margin backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _library_snapshot() -> list[dict[str, Any]]:
    return store.list_papers()


def _register_bundle(paper_id: str, bundle: dict[str, Any]) -> dict[str, Any]:
    """Add or replace a bundle and its library-list entry. Returns the entry."""
    return store.upsert_bundle(paper_id, bundle)


# ---------------------------------------------------------------------------
# Pipeline definition (matches AnalyzeProgress in margin's types.ts)
# ---------------------------------------------------------------------------

PIPELINE_STEPS: list[dict[str, str]] = [
    {"label": "Parsing manuscript", "detail": "Extracting title, authors, claims"},
    {"label": "Scoring categories", "detail": "Rating writing, structure, method, logic, novelty, citation, format"},
    {"label": "Assessing novelty", "detail": "Comparing against training-time literature"},
    {"label": "Generating annotations", "detail": "Producing per-section review notes"},
    {"label": "Drafting review report", "detail": "Summarising strengths, weaknesses, recommendation"},
    {"label": "Assembling bundle", "detail": "Splitting references, packing manuscript blocks"},
]


def _progress_payload(step: int, done: bool = False, paper_id: str | None = None) -> dict[str, Any]:
    total = len(PIPELINE_STEPS)
    pct = 100 if done else min(100, int(round(step / max(total, 1) * 100)))
    payload: dict[str, Any] = {
        "step": min(step, total),
        "steps": PIPELINE_STEPS,
        "pct": pct,
        "done": done,
    }
    if paper_id:
        payload["paperId"] = paper_id
    return payload


def _sse(payload: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


# ---------------------------------------------------------------------------
# POST /analyze — multipart upload, SSE progress
# ---------------------------------------------------------------------------


async def _run_pipeline(paper_text: str, pdf_bytes: bytes | None, model: str, venue: str):
    """Async generator that runs the 6-step pipeline and yields SSE frames.

    Each Bedrock helper runs in the FastAPI threadpool so we don't block the
    event loop while boto3 waits on IO.
    """
    try:
        # Step 1: parse metadata (also captures references_raw via helper).
        yield _sse(_progress_payload(0))
        meta = await run_in_threadpool(_parse_manuscript, paper_text, model, None)

        # Step 2: category scores.
        yield _sse(_progress_payload(1))
        scores = await run_in_threadpool(bb.score_categories, paper_text, model, None)

        # Step 3: novelty assessment.
        yield _sse(_progress_payload(2))
        novelty = await run_in_threadpool(bb.assess_novelty, meta, model, None)

        # Step 4: annotations.
        yield _sse(_progress_payload(3))
        raw_annotations = await run_in_threadpool(bb.generate_annotations, paper_text, model, None)

        # Step 5: structured report.
        yield _sse(_progress_payload(4))
        report = await run_in_threadpool(bb.structured_report, paper_text, model, None)

        # Step 6: assembly (pure Python — no LLM).
        yield _sse(_progress_payload(5))
        report = bb.normalize_report(report)
        novelty = bb.normalize_novelty(novelty)
        annotations = bb.enrich_annotations(raw_annotations if isinstance(raw_annotations, list) else [])
        references = bb.split_references(meta.get("references_raw") or "")
        missing_refs = bb.derive_missing_refs(annotations)
        manuscript = bb.build_manuscript_blocks(paper_text)
        paper = {
            "title": meta.get("title") or "Untitled",
            "authors": meta.get("authors") or "",
            "venue": venue,
            "pages": bb.count_pages(pdf_bytes),
            "words": bb.count_words(paper_text),
            "figures": bb.count_figures(paper_text),
            "refs": len(references),
            "overall": bb.overall_score(scores),
            "recommendation": report["recommendation"],
        }
        bundle = bb.normalize_bundle({
            "paper": paper,
            "scores": {c: int(scores.get(c, 0)) for c in bb.CATEGORY_IDS},
            "manuscript": manuscript,
            "annotations": annotations,
            "visuals": [],
            "related": [],
            "missingRefs": missing_refs,
            "novelty": novelty,
            "report": report,
            "references": references,
        })
        paper_id = bb.stable_paper_id(paper_text)
        _register_bundle(paper_id, bundle)

        yield _sse(_progress_payload(len(PIPELINE_STEPS), done=True, paper_id=paper_id))
    except Exception as exc:  # surface errors as an SSE error frame the client can render
        yield _sse({
            "step": 0,
            "steps": PIPELINE_STEPS,
            "pct": 0,
            "done": True,
            "error": f"{type(exc).__name__}: {exc}",
        })


@app.post("/analyze")
async def analyze(file: UploadFile, venue: str = "", model: str = HAIKU_4_5):
    """Accept a PDF/txt/md upload; stream AnalyzeProgress events via SSE."""
    filename = file.filename or "upload"
    data = await file.read()
    try:
        paper_text = extract_text(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not paper_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract any text from the upload.")

    pdf_bytes = data if filename.lower().endswith(".pdf") else None
    return StreamingResponse(
        _run_pipeline(paper_text, pdf_bytes, model, venue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Read / write endpoints
# ---------------------------------------------------------------------------


@app.get("/library")
def library() -> list[dict[str, Any]]:
    return _library_snapshot()


@app.get("/paper/{paper_id}")
def get_paper(paper_id: str) -> dict[str, Any]:
    bundle = store.get_bundle(paper_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    return bb.normalize_bundle(bundle)


@app.get("/paper/{paper_id}/report")
def get_report(paper_id: str) -> dict[str, Any]:
    bundle = store.get_bundle(paper_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    return bb.normalize_report(bundle.get("report") or {})


@app.get("/paper/{paper_id}/venues")
def get_venues(paper_id: str) -> list[dict[str, Any]]:
    if not store.paper_exists(paper_id):
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    return []  # deferred to Phase 2


@app.delete("/paper/{paper_id}")
def delete_paper(paper_id: str) -> list[dict[str, Any]]:
    store.delete_paper(paper_id)
    return _library_snapshot()


class ArchivePatch(BaseModel):
    archived: bool


@app.patch("/paper/{paper_id}")
def patch_paper(paper_id: str, patch: ArchivePatch) -> list[dict[str, Any]]:
    if not store.set_archived(paper_id, patch.archived):
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    return _library_snapshot()


# ---------------------------------------------------------------------------
# Test-support helpers (not part of the public HTTP surface)
# ---------------------------------------------------------------------------


def _reset_store_for_tests(db_path: str | None = None) -> None:
    store.configure(db_path)


def _seed_bundle_for_tests(paper_id: str, bundle: dict[str, Any]) -> None:
    _register_bundle(paper_id, bundle)
