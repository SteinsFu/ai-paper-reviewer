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
from typing import Any, Iterable, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import bundle_builder as bb
import store
import venues
from bedrock_client import HAIKU_4_5, converse_stream_text
from novelty_review.src.novelty_review import _parse_manuscript
from pdf_utils import extract_text

load_dotenv()

# Upload cap. nginx `client_max_body_size` must match (see docs/deploy-ec2.md).
# Starlette's 1 MiB default applies to non-file form fields, not UploadFile;
# nginx's 1 MiB default is what actually rejected typical PDFs.
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MiB — enough for a 60-page paper with figures

# CORS: Vite dev server + Streamlit (for parity), plus any override via env.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8501"
_ALLOWED_ORIGINS = [o.strip() for o in os.getenv("MARGIN_ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]

app = FastAPI(title="Margin backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ---------------------------------------------------------------------------
# Identity — mock auth: client sends X-User-Id and X-User-Name headers.
# ---------------------------------------------------------------------------


def _identity(
    x_user_id: str | None,
    x_user_name: str | None,
) -> tuple[str, str]:
    """Read the requesting user's identity from headers. Empty string if
    missing — the routes decide whether to accept anonymous callers."""
    return (x_user_id or "").strip(), (x_user_name or "").strip()


def _library_snapshot(user_id: str = "") -> list[dict[str, Any]]:
    return store.list_papers(user_id=user_id)


def _register_bundle(
    paper_id: str,
    bundle: dict[str, Any],
    owner_id: str = "",
    owner_name: str = "",
) -> dict[str, Any]:
    """Add or replace a bundle and its library-list entry. Returns the entry."""
    return store.upsert_bundle(paper_id, bundle, owner_id=owner_id, owner_name=owner_name)


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


async def _run_pipeline(
    paper_text: str,
    pdf_bytes: bytes | None,
    model: str,
    venue: str,
    owner_id: str = "",
    owner_name: str = "",
):
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
        store.upsert_bundle(paper_id, bundle, owner_id=owner_id, owner_name=owner_name)

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
async def analyze(
    file: UploadFile,
    venue: str = "",
    model: str = HAIKU_4_5,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_user_name: str | None = Header(default=None, alias="X-User-Name"),
):
    """Accept a PDF/txt/md upload; stream AnalyzeProgress events via SSE.

    The requesting user's identity (X-User-Id, X-User-Name headers) is
    recorded as the paper's owner. Anonymous uploads (no headers) still work.
    """
    filename = file.filename or "upload"
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        max_mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File too large (max {max_mb} MB).",
        )
    try:
        paper_text = extract_text(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not paper_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract any text from the upload.")

    owner_id, owner_name = _identity(x_user_id, x_user_name)
    pdf_bytes = data if filename.lower().endswith(".pdf") else None
    return StreamingResponse(
        _run_pipeline(paper_text, pdf_bytes, model, venue, owner_id, owner_name),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Read / write endpoints
# ---------------------------------------------------------------------------


@app.get("/library")
def library(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> list[dict[str, Any]]:
    user_id, _ = _identity(x_user_id, None)
    return store.list_papers(user_id=user_id)


@app.get("/paper/{paper_id}")
def get_paper(
    paper_id: str,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict[str, Any]:
    bundle = store.get_bundle(paper_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    # Anyone who opens a paper by id is added to their personal watch list, so
    # it shows up on their Dashboard alongside their own uploads. Anonymous
    # callers are ignored.
    user_id, _ = _identity(x_user_id, None)
    if user_id:
        store.add_watch(paper_id, user_id)
    return bb.normalize_bundle(bundle)


@app.get("/paper/{paper_id}/report")
def get_report(paper_id: str) -> dict[str, Any]:
    bundle = store.get_bundle(paper_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    return bb.normalize_report(bundle.get("report") or {})


async def _fresh_venues(paper_id: str) -> dict[str, Any]:
    bundle = store.get_bundle(paper_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    try:
        payload = await run_in_threadpool(venues.suggest_for_bundle, bundle)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"{type(exc).__name__}: {exc}",
        ) from exc
    stamped = venues.stamp_payload(payload)
    store.set_venue_suggestions(paper_id, stamped)
    return venues.public_payload(stamped)


@app.get("/paper/{paper_id}/venues")
async def get_venues(paper_id: str) -> dict[str, Any]:
    cached = store.get_venue_suggestions(paper_id)
    if venues.cache_is_current(cached):
        return venues.public_payload(cached)
    return await _fresh_venues(paper_id)


@app.post("/paper/{paper_id}/venues/refresh")
async def refresh_venues(paper_id: str) -> dict[str, Any]:
    """Bypass cache and re-classify this paper. Does not re-run the full review."""
    return await _fresh_venues(paper_id)


@app.delete("/paper/{paper_id}")
def delete_paper(
    paper_id: str,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> list[dict[str, Any]]:
    store.delete_paper(paper_id)
    user_id, _ = _identity(x_user_id, None)
    return _library_snapshot(user_id)


class ArchivePatch(BaseModel):
    archived: bool


@app.patch("/paper/{paper_id}")
def patch_paper(
    paper_id: str,
    patch: ArchivePatch,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> list[dict[str, Any]]:
    if not store.set_archived(paper_id, patch.archived):
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    user_id, _ = _identity(x_user_id, None)
    return _library_snapshot(user_id)


# ---------------------------------------------------------------------------
# /paper/{id}/notes — user-authored comments and threaded replies
# ---------------------------------------------------------------------------


class NoteAnchorIn(BaseModel):
    blockIndex: int
    start: int
    end: int
    quote: str = ""


class NoteCreate(BaseModel):
    body: str = Field(..., min_length=1)
    parentNoteId: str | None = None
    anchor: NoteAnchorIn | None = None


class NoteUpdate(BaseModel):
    body: str = Field(..., min_length=1)


def _require_identity(x_user_id: str | None, x_user_name: str | None) -> tuple[str, str]:
    user_id, user_name = _identity(x_user_id, x_user_name)
    if not user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header is required")
    return user_id, user_name


@app.get("/paper/{paper_id}/notes")
def list_notes(paper_id: str) -> list[dict[str, Any]]:
    if not store.paper_exists(paper_id):
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    return store.list_notes(paper_id)


@app.post("/paper/{paper_id}/notes", status_code=201)
def create_note(
    paper_id: str,
    body: NoteCreate,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_user_name: str | None = Header(default=None, alias="X-User-Name"),
) -> dict[str, Any]:
    user_id, user_name = _require_identity(x_user_id, x_user_name)
    note_id = f"n_{uuid.uuid4().hex[:10]}"
    anchor = body.anchor.model_dump() if body.anchor else None
    note = store.create_note(
        note_id=note_id,
        paper_id=paper_id,
        author_id=user_id,
        author_name=user_name or user_id,
        body=body.body.strip(),
        parent_note_id=body.parentNoteId,
        anchor=anchor,
    )
    if note is None:
        raise HTTPException(status_code=404, detail="paper or parent note not found")
    return note


@app.patch("/paper/{paper_id}/notes/{note_id}")
def edit_note(
    paper_id: str,
    note_id: str,
    body: NoteUpdate,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_user_name: str | None = Header(default=None, alias="X-User-Name"),
) -> dict[str, Any]:
    user_id, _ = _require_identity(x_user_id, x_user_name)
    existing = store.get_note(note_id)
    if existing is None or existing["paperId"] != paper_id:
        raise HTTPException(status_code=404, detail=f"note {note_id!r} not found")
    updated = store.update_note(note_id, user_id, body.body.strip())
    if updated is None:
        raise HTTPException(status_code=403, detail="only the note's author can edit it")
    return updated


@app.delete("/paper/{paper_id}/notes/{note_id}", status_code=204)
def remove_note(
    paper_id: str,
    note_id: str,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_user_name: str | None = Header(default=None, alias="X-User-Name"),
) -> None:
    user_id, _ = _require_identity(x_user_id, x_user_name)
    existing = store.get_note(note_id)
    if existing is None or existing["paperId"] != paper_id:
        raise HTTPException(status_code=404, detail=f"note {note_id!r} not found")
    if not store.delete_note(note_id, user_id):
        raise HTTPException(status_code=403, detail="only the note's author can delete it")


@app.post("/paper/{paper_id}/notes/mark-read", status_code=204)
def mark_read(
    paper_id: str,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_user_name: str | None = Header(default=None, alias="X-User-Name"),
) -> None:
    user_id, _ = _require_identity(x_user_id, x_user_name)
    if not store.paper_exists(paper_id):
        raise HTTPException(status_code=404, detail=f"paper {paper_id!r} not found")
    store.mark_notes_read(paper_id, user_id)


# ---------------------------------------------------------------------------
# POST /chat — multi-turn conversation grounded in a paper's ReviewBundle
# ---------------------------------------------------------------------------


CHAT_SYSTEM_PROMPT = """You are Margin, an academic peer-review copilot embedded next to a specific paper's structured review.

The user has already received a full review of the paper (summary, category scores, novelty assessment, annotations, and recommendation) — that review is provided below as JSON. Your job is to help them understand, explore, or act on that review through conversation.

Ground rules:
- Ground every answer in the provided review data. Reference specific annotations, scores, or sections when relevant.
- If the user asks about something the review does not cover, say so directly rather than inventing content.
- Be concise. One or two short paragraphs per reply is usually enough; extend only when the user asks for depth.
- When suggesting rewrites, prefer 2-3 short alternatives over one long one.
- Do not fabricate citations, prior work, or author intent.
- If the user asks a purely off-topic question, redirect politely to the review.

Tone: helpful, direct, collegial. Assume the reader is an experienced researcher or a graduate student."""


def _build_chat_context(bundle: dict[str, Any]) -> str:
    """Serialize a ReviewBundle into a compact system-prompt appendix.

    We intentionally omit the full manuscript text (would blow the token budget
    for a chat exchange) and the reference list (also large; rarely needed for
    conversational follow-ups).
    """
    paper = bundle.get("paper") or {}
    scores = bundle.get("scores") or {}
    report = bundle.get("report") or {}
    novelty = bundle.get("novelty") or {}
    annotations = bundle.get("annotations") or []
    missing_refs = bundle.get("missingRefs") or []

    lines: list[str] = []
    lines.append("=== PAPER ===")
    lines.append(f"Title: {paper.get('title', 'Untitled')}")
    if paper.get("authors"):
        lines.append(f"Authors: {paper['authors']}")
    lines.append(
        f"Pages: {paper.get('pages', '?')}  "
        f"Words: {paper.get('words', '?')}  "
        f"Refs: {paper.get('refs', '?')}  "
        f"Overall: {paper.get('overall', '?')}/100  "
        f"Recommendation: {paper.get('recommendation', '?')}"
    )

    if scores:
        lines.append("")
        lines.append("=== CATEGORY SCORES (0-100) ===")
        for cat in ("writing", "structure", "method", "logic", "novelty", "citation", "format"):
            if cat in scores:
                lines.append(f"  {cat:<10} {scores[cat]}")

    if report:
        lines.append("")
        lines.append("=== REPORT ===")
        if report.get("summary"):
            lines.append(f"Summary: {report['summary']}")
        for key in ("strengths", "weaknesses", "minor"):
            items = report.get(key) or []
            if items:
                lines.append(f"{key.title()}:")
                for it in items:
                    lines.append(f"  - {it}")
        if report.get("confidence") is not None:
            lines.append(f"Reviewer confidence: {report['confidence']}/5")

    if novelty:
        lines.append("")
        lines.append("=== NOVELTY ===")
        if novelty.get("verdict"):
            lines.append(f"Verdict: {novelty['verdict']} (score {novelty.get('score', '?')}/100)")
        if novelty.get("summary"):
            lines.append(f"Summary: {novelty['summary']}")
        for key in ("strengths", "risks"):
            items = novelty.get(key) or []
            if items:
                lines.append(f"{key.title()}:")
                for it in items:
                    lines.append(f"  - {it}")

    if annotations:
        lines.append("")
        lines.append(f"=== ANNOTATIONS ({len(annotations)} total) ===")
        # Keep annotations compact — the LLM will ask for detail if it needs it.
        for a in annotations[:40]:  # cap to keep the prompt bounded
            lines.append(
                f"  [{a.get('id', '?')}] {a.get('sev', '?')}/{a.get('cat', '?')} "
                f"({a.get('section', '?')}): {a.get('title', '')}"
            )
            if a.get("comment"):
                lines.append(f"      {a['comment']}")

    if missing_refs:
        lines.append("")
        lines.append(f"=== MISSING CITATIONS ({len(missing_refs)}) ===")
        for m in missing_refs[:20]:
            lines.append(f"  - {m.get('text', '')} ({m.get('reason', '')[:80]})")

    return "\n".join(lines)


def _to_bedrock_messages(messages: list[dict[str, str]]) -> list[dict[str, Any]]:
    """Convert our simple chat schema to Bedrock's content-block shape."""
    out: list[dict[str, Any]] = []
    for m in messages:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        out.append({"role": role, "content": [{"text": content}]})
    return out


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    paperId: str
    messages: list[ChatMessageIn]
    model: str | None = None


async def _stream_chat(bundle: dict[str, Any], messages: list[dict[str, Any]], model_id: str):
    """Yield SSE frames of {"delta": "..."} for the streaming reply."""
    context = _build_chat_context(bundle)
    system_prompt = f"{CHAT_SYSTEM_PROMPT}\n\n{context}"

    def iterate_stream() -> list[str]:
        return list(converse_stream_text(
            model_id=model_id,
            system_prompt=system_prompt,
            messages=messages,
            temperature=0.4,
            max_tokens=1024,
        ))

    try:
        # boto3's iterator blocks on each event; run the whole collection in a
        # threadpool. This gives up token-by-token client streaming, so we
        # flush partial chunks in a second pass to keep the UI responsive.
        chunks = await run_in_threadpool(iterate_stream)
        for chunk in chunks:
            yield _sse({"delta": chunk})
        yield _sse({"done": True})
    except Exception as exc:
        yield _sse({"error": f"{type(exc).__name__}: {exc}", "done": True})


@app.post("/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    """Multi-turn chat grounded in a paper's ReviewBundle. Streams SSE deltas."""
    bundle = store.get_bundle(req.paperId)
    if bundle is None:
        raise HTTPException(status_code=404, detail=f"paper {req.paperId!r} not found")

    bedrock_messages = _to_bedrock_messages([m.model_dump() for m in req.messages])
    if not bedrock_messages or bedrock_messages[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="messages must end with a user turn")

    model_id = req.model or HAIKU_4_5
    return StreamingResponse(
        _stream_chat(bundle, bedrock_messages, model_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Test-support helpers (not part of the public HTTP surface)
# ---------------------------------------------------------------------------


def _reset_store_for_tests(db_path: str | None = None) -> None:
    store.configure(db_path)


def _seed_bundle_for_tests(paper_id: str, bundle: dict[str, Any]) -> None:
    _register_bundle(paper_id, bundle)
