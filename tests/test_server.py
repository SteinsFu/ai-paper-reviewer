"""Tests for the FastAPI server (`server.py`).

Uses FastAPI's TestClient. All boto3 calls are stubbed via monkeypatching
the ``bundle_builder`` helpers so no live Bedrock traffic is generated.
"""

from __future__ import annotations

import json
import os
from io import BytesIO

import pytest
from fastapi.testclient import TestClient

import bundle_builder as bb
import server
import store
import venues


@pytest.fixture(autouse=True)
def _reset_store(tmp_path, monkeypatch):
    db = str(tmp_path / "margin.db")
    monkeypatch.setenv("MARGIN_DB_PATH", db)
    server._reset_store_for_tests(db)
    yield
    store.close()


@pytest.fixture
def client():
    return TestClient(server.app)


@pytest.fixture
def stub_pipeline(monkeypatch):
    """Replace every LLM call in the pipeline with a deterministic stub."""
    monkeypatch.setattr(
        server, "_parse_manuscript",
        lambda text, model, client: {
            "title": "Test Paper", "authors": "Alice, Bob",
            "abstract": "An abstract.", "claims": ["c1"],
            "references_raw": "Alice. 2020. First. In ACL.\n\nBob. 2021. Second. In EMNLP.",
        },
    )
    monkeypatch.setattr(bb, "score_categories", lambda text, model, client: {c: 70 for c in bb.CATEGORY_IDS})
    monkeypatch.setattr(bb, "assess_novelty", lambda meta, model, client: {
        "score": 72, "verdict": "Solid", "summary": "sum", "strengths": ["a"], "risks": ["b"],
    })
    monkeypatch.setattr(bb, "generate_annotations", lambda text, model, client: [
        {"cat": "writing", "sev": "minor", "section": "Abstract", "title": "T", "excerpt": "E", "comment": "C"},
        {"cat": "citation", "sev": "moderate", "section": "Intro",
         "title": "Missing", "excerpt": "E", "comment": "C", "missingRef": "seminal X"},
    ])
    monkeypatch.setattr(bb, "structured_report", lambda text, model, client: {
        "summary": "S", "strengths": ["s"], "weaknesses": ["w"], "minor": ["m"],
        "recommendation": "minor", "confidence": 4,
    })


def _parse_sse_frames(body: bytes) -> list[dict]:
    frames = []
    for chunk in body.decode("utf-8").split("\n\n"):
        chunk = chunk.strip()
        if chunk.startswith("data:"):
            frames.append(json.loads(chunk[len("data:"):].strip()))
    return frames


# ---------------------------------------------------------------------------
# POST /analyze — SSE contract
# ---------------------------------------------------------------------------


def test_analyze_streams_all_pipeline_steps_and_ends_with_paper_id(client, stub_pipeline):
    response = client.post(
        "/analyze",
        files={"file": ("sample.txt", b"Body paragraph one.\n\nBody paragraph two.", "text/plain")},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    frames = _parse_sse_frames(response.content)
    assert len(frames) == len(server.PIPELINE_STEPS) + 1  # one per step + final done

    # Every non-final frame has done=false, monotonically increasing step.
    intermediate = frames[:-1]
    assert [f["step"] for f in intermediate] == list(range(len(server.PIPELINE_STEPS)))
    assert all(f["done"] is False for f in intermediate)

    # Final frame has done=true, pct=100, and paperId.
    final = frames[-1]
    assert final["done"] is True
    assert final["pct"] == 100
    assert final["paperId"].startswith("p_")
    # steps list is echoed each frame (Matteo's UI reads steps from every event).
    assert all(f["steps"] == server.PIPELINE_STEPS for f in frames)


def test_analyze_rejects_file_over_max_upload(client, monkeypatch):
    monkeypatch.setattr(server, "MAX_UPLOAD_BYTES", 100)
    response = client.post(
        "/analyze",
        files={"file": ("sample.txt", b"x" * 200, "text/plain")},
    )
    assert response.status_code == 413
    assert "too large" in response.json()["detail"].lower()


def test_analyze_accepts_file_over_one_megabyte(client, stub_pipeline):
    # nginx's historic 1 MiB cap is what blocked real papers; FastAPI must not.
    payload = ("Body paragraph.\n\n" * 80_000).encode()  # ~1.4 MiB
    assert len(payload) > 1024 * 1024
    response = client.post(
        "/analyze",
        files={"file": ("sample.txt", payload, "text/plain")},
    )
    assert response.status_code == 200
    frames = _parse_sse_frames(response.content)
    assert frames[-1]["done"] is True
    assert "paperId" in frames[-1]


def test_analyze_rejects_unsupported_file_type(client):
    response = client.post(
        "/analyze",
        files={"file": ("weird.docx", b"stuff", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "Unsupported" in response.json()["detail"]


def test_analyze_rejects_empty_extraction(client):
    response = client.post(
        "/analyze",
        files={"file": ("empty.txt", b"   \n\t   ", "text/plain")},
    )
    assert response.status_code == 400


def test_analyze_registers_bundle_in_store(client, stub_pipeline):
    response = client.post(
        "/analyze",
        files={"file": ("sample.txt", b"Some text here.\n\nMore text.", "text/plain")},
    )
    frames = _parse_sse_frames(response.content)
    paper_id = frames[-1]["paperId"]

    lib = client.get("/library").json()
    assert len(lib) == 1
    assert lib[0]["id"] == paper_id
    assert lib[0]["title"] == "Test Paper"


def test_analyze_emits_error_frame_on_pipeline_failure(client, monkeypatch):
    def boom(*a, **kw):
        raise RuntimeError("bedrock down")
    monkeypatch.setattr(server, "_parse_manuscript", boom)

    response = client.post(
        "/analyze",
        files={"file": ("sample.txt", b"body text", "text/plain")},
    )
    frames = _parse_sse_frames(response.content)
    final = frames[-1]
    assert final["done"] is True
    assert "error" in final
    assert "bedrock down" in final["error"]


# ---------------------------------------------------------------------------
# GET /library, /paper/{id}, /paper/{id}/report, /paper/{id}/venues
# ---------------------------------------------------------------------------


def _fake_bundle(paper_id: str, title: str = "T") -> dict:
    return {
        "paper": {
            "title": title, "authors": "A", "venue": "", "pages": 10, "words": 3000,
            "figures": 2, "refs": 5, "overall": 72, "recommendation": "minor",
        },
        "scores": {c: 70 for c in bb.CATEGORY_IDS},
        "manuscript": [{"type": "p", "section": "Body", "runs": [{"t": "hello"}]}],
        "annotations": [
            {"id": "a1", "cat": "writing", "sev": "moderate", "section": "S", "title": "T",
             "excerpt": "E", "comment": "C", "origin": "ai"},
        ],
        "visuals": [],
        "related": [],
        "missingRefs": [],
        "novelty": {"score": 70, "verdict": "OK", "summary": "s", "strengths": [], "risks": []},
        "report": {
            "summary": "S", "strengths": ["s"], "weaknesses": ["w"], "minor": ["m"],
            "recommendation": "minor", "confidence": 4,
        },
        "references": [{"id": "r1", "text": "ref"}],
    }


def test_library_returns_empty_initially(client):
    assert client.get("/library").json() == []


def test_get_paper_returns_full_bundle(client):
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test", "My Paper"))
    body = client.get("/paper/p_test").json()
    assert body["paper"]["title"] == "My Paper"
    assert set(body["scores"]) == set(bb.CATEGORY_IDS)


def test_get_paper_404_for_unknown_id(client):
    response = client.get("/paper/nope")
    assert response.status_code == 404


def test_get_report_returns_review_report(client):
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    report = client.get("/paper/p_test/report").json()
    assert report["recommendation"] == "minor"
    assert report["confidence"] == 4


def test_get_paper_coerces_item_tagged_strengths_string(client):
    """Stored reviews from Bedrock may have report.strengths as an <item> string."""
    bundle = _fake_bundle("p_live")
    bundle["report"] = {
        "summary": "Conceptual essay.",
        "strengths": (
            "<item>Clear exposition of fundamentals.</item>"
            "<item>Well-motivated analogy.</item>"
        ),
    }
    server._seed_bundle_for_tests("p_live", bundle)

    body = client.get("/paper/p_live").json()
    assert body["report"]["strengths"] == [
        "Clear exposition of fundamentals.",
        "Well-motivated analogy.",
    ]
    assert body["report"]["weaknesses"] == []
    assert body["report"]["recommendation"] == "major"
    assert isinstance(body["report"]["minor"], list)

    report = client.get("/paper/p_live/report").json()
    assert report["strengths"] == body["report"]["strengths"]


def test_get_venues_classifies_and_ranks(client, monkeypatch):
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    monkeypatch.setattr(venues, "classify_fields", lambda *a, **k: ("se", None))
    body = client.get("/paper/p_test/venues").json()
    assert body["primary"] == "se"
    assert body["secondary"] is None
    ids = [row["id"] for row in body["venues"]]
    assert ids[0] == "emse"
    assert "chi" not in ids
    assert all(row["deadline"] is None for row in body["venues"])
    assert "match" in body["venues"][0]
    assert body["venues"][0]["tag"] == "se"
    assert "tags" not in body["venues"][0]
    assert "catalogVersion" not in body


def test_get_venues_other_returns_empty_list(client, monkeypatch):
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    monkeypatch.setattr(venues, "classify_fields", lambda *a, **k: ("other", None))
    body = client.get("/paper/p_test/venues").json()
    assert body == {"primary": "other", "secondary": None, "venues": []}


def test_get_venues_caches_classifier(client, monkeypatch):
    calls: list[int] = []

    def fake(*a, **k):
        calls.append(1)
        return ("hci", None)

    monkeypatch.setattr(venues, "classify_fields", fake)
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    assert client.get("/paper/p_test/venues").status_code == 200
    assert client.get("/paper/p_test/venues").status_code == 200
    assert calls == [1]


def test_get_venues_recaches_when_catalog_version_changes(client, monkeypatch):
    calls: list[int] = []

    def fake(*a, **k):
        calls.append(1)
        return ("hci", None)

    monkeypatch.setattr(venues, "classify_fields", fake)
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    assert client.get("/paper/p_test/venues").status_code == 200
    monkeypatch.setattr(venues, "catalog_version", lambda: "catalog-v2")
    assert client.get("/paper/p_test/venues").status_code == 200
    assert calls == [1, 1]


def test_get_venues_ignores_legacy_cache_without_version(client, monkeypatch):
    calls: list[int] = []

    def fake(*a, **k):
        calls.append(1)
        return ("se", None)

    monkeypatch.setattr(venues, "classify_fields", fake)
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    store.set_venue_suggestions("p_test", {"primary": "other", "secondary": None, "venues": []})
    body = client.get("/paper/p_test/venues").json()
    assert calls == [1]
    assert body["primary"] == "se"
    assert body["venues"]


def test_reanalyze_busts_venue_cache(client, monkeypatch):
    calls: list[int] = []

    def fake(*a, **k):
        calls.append(1)
        return ("se", None)

    monkeypatch.setattr(venues, "classify_fields", fake)
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    client.get("/paper/p_test/venues")
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    client.get("/paper/p_test/venues")
    assert calls == [1, 1]


def test_post_venues_refresh_bypasses_cache(client, monkeypatch):
    labels = iter([("hci", None), ("se", None)])

    def fake(*a, **k):
        return next(labels)

    monkeypatch.setattr(venues, "classify_fields", fake)
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    first = client.get("/paper/p_test/venues").json()
    cached = client.get("/paper/p_test/venues").json()
    refreshed = client.post("/paper/p_test/venues/refresh").json()
    assert first["primary"] == "hci"
    assert cached["primary"] == "hci"
    assert refreshed["primary"] == "se"
    assert refreshed["venues"][0]["tag"] == "se"


def test_get_venues_503_when_classifier_fails(client, monkeypatch):
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test"))
    monkeypatch.setattr(
        venues, "classify_fields",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("bedrock down")),
    )
    response = client.get("/paper/p_test/venues")
    assert response.status_code == 503


def test_get_venues_404_for_unknown_paper(client):
    assert client.get("/paper/missing/venues").status_code == 404


def test_delete_paper_removes_and_returns_new_library(client):
    server._seed_bundle_for_tests("p_a", _fake_bundle("p_a", "A"))
    server._seed_bundle_for_tests("p_b", _fake_bundle("p_b", "B"))

    remaining = client.delete("/paper/p_a").json()

    assert [p["id"] for p in remaining] == ["p_b"]
    assert client.get("/paper/p_a").status_code == 404


def test_patch_paper_toggles_archived(client):
    server._seed_bundle_for_tests("p_a", _fake_bundle("p_a"))
    lib = client.patch("/paper/p_a", json={"archived": True}).json()
    entry = next(p for p in lib if p["id"] == "p_a")
    assert entry["archived"] is True
    assert entry["status"] == "done"

    lib = client.patch("/paper/p_a", json={"archived": False}).json()
    entry = next(p for p in lib if p["id"] == "p_a")
    assert entry["archived"] is False
    assert entry["status"] == "in-review"


def test_patch_paper_404_for_unknown(client):
    assert client.patch("/paper/nope", json={"archived": True}).status_code == 404


def test_library_survives_db_reconnect(client):
    server._seed_bundle_for_tests("p_test", _fake_bundle("p_test", "Persisted"))
    path = os.environ["MARGIN_DB_PATH"]
    store.configure(path)
    lib = client.get("/library").json()
    assert len(lib) == 1
    assert lib[0]["title"] == "Persisted"
    assert client.get("/paper/p_test").json()["paper"]["title"] == "Persisted"


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------


def test_cors_allows_vite_dev_origin(client):
    response = client.options(
        "/library",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_get_carries_origin_header(client):
    response = client.get("/library", headers={"Origin": "http://localhost:5173"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


# ---------------------------------------------------------------------------
# Store helpers used by other tests / dev
# ---------------------------------------------------------------------------


def test_progress_payload_shapes_final_correctly():
    p = server._progress_payload(len(server.PIPELINE_STEPS), done=True, paper_id="p_x")
    assert p["done"] is True
    assert p["pct"] == 100
    assert p["paperId"] == "p_x"
    assert p["steps"] == server.PIPELINE_STEPS


def test_progress_payload_no_paper_id_when_absent():
    p = server._progress_payload(2)
    assert "paperId" not in p
    assert p["done"] is False


# ---------------------------------------------------------------------------
# POST /chat — multi-turn chat grounded in a ReviewBundle
# ---------------------------------------------------------------------------


def _fake_chat_bundle(paper_id: str = "p_chat") -> dict:
    return {
        "paper": {
            "title": "Chat Test Paper", "authors": "Alice, Bob", "venue": "",
            "pages": 12, "words": 4000, "figures": 1, "refs": 8,
            "overall": 68, "recommendation": "minor",
        },
        "scores": {c: 68 for c in bb.CATEGORY_IDS},
        "manuscript": [{"type": "p", "section": "Body", "runs": [{"t": "..."}]}],
        "annotations": [
            {"id": "a1", "cat": "writing", "sev": "moderate", "section": "Intro",
             "title": "Vague opening", "excerpt": "It has been shown...",
             "comment": "This lacks a citation and reads as hearsay.", "origin": "ai"},
        ],
        "visuals": [], "related": [],
        "missingRefs": [{"for": "a1", "text": "seminal foo work", "reason": "Backs the empirical claim"}],
        "novelty": {"score": 62, "verdict": "Solid", "summary": "s",
                    "strengths": ["good angle"], "risks": ["overlaps with X"]},
        "report": {"summary": "S", "strengths": ["a"], "weaknesses": ["b"], "minor": ["c"],
                   "recommendation": "minor", "confidence": 3},
        "references": [{"id": "r1", "text": "Foo et al. 2020. In ACL."}],
    }


def _stub_stream(text_chunks):
    """Return a converse_stream_text stand-in that yields the given chunks."""
    def _fake(**kwargs):
        # Return an iterator so the code under test can consume it lazily.
        return iter(text_chunks)
    return _fake


def test_chat_streams_deltas_and_final_done_event(client, monkeypatch):
    server._seed_bundle_for_tests("p_chat", _fake_chat_bundle())
    monkeypatch.setattr(server, "converse_stream_text", _stub_stream(["Hello", " there", "!"]))

    resp = client.post("/chat", json={
        "paperId": "p_chat",
        "messages": [{"role": "user", "content": "What are the weaknesses?"}],
    })
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")

    frames = _parse_sse_frames(resp.content)
    deltas = [f["delta"] for f in frames if "delta" in f]
    assert deltas == ["Hello", " there", "!"]
    assert frames[-1] == {"done": True}


def test_chat_returns_404_for_unknown_paper(client):
    resp = client.post("/chat", json={
        "paperId": "missing",
        "messages": [{"role": "user", "content": "hi"}],
    })
    assert resp.status_code == 404


def test_chat_rejects_empty_messages(client):
    server._seed_bundle_for_tests("p_chat", _fake_chat_bundle())
    resp = client.post("/chat", json={"paperId": "p_chat", "messages": []})
    assert resp.status_code == 400


def test_chat_rejects_when_last_turn_is_assistant(client):
    server._seed_bundle_for_tests("p_chat", _fake_chat_bundle())
    resp = client.post("/chat", json={
        "paperId": "p_chat",
        "messages": [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
        ],
    })
    assert resp.status_code == 400


def test_chat_forwards_multi_turn_history_to_bedrock(client, monkeypatch):
    server._seed_bundle_for_tests("p_chat", _fake_chat_bundle())
    captured: dict = {}

    def _capturing_stream(**kwargs):
        captured.update(kwargs)
        return iter(["ok"])
    monkeypatch.setattr(server, "converse_stream_text", _capturing_stream)

    client.post("/chat", json={
        "paperId": "p_chat",
        "messages": [
            {"role": "user", "content": "Why did you flag a1?"},
            {"role": "assistant", "content": "Because the opening ..."},
            {"role": "user", "content": "How should I rewrite it?"},
        ],
    })

    sent = captured["messages"]
    assert [m["role"] for m in sent] == ["user", "assistant", "user"]
    assert sent[0]["content"] == [{"text": "Why did you flag a1?"}]
    assert sent[2]["content"] == [{"text": "How should I rewrite it?"}]

    # System prompt must reference the paper title and annotation id so the LLM
    # has bundle context to ground its reply in.
    system_text = captured["system_prompt"]
    assert "Chat Test Paper" in system_text
    assert "a1" in system_text
    assert "Vague opening" in system_text


def test_chat_surfaces_bedrock_error_as_sse_frame(client, monkeypatch):
    server._seed_bundle_for_tests("p_chat", _fake_chat_bundle())

    def _boom(**kwargs):
        raise RuntimeError("bedrock exploded")
    monkeypatch.setattr(server, "converse_stream_text", _boom)

    resp = client.post("/chat", json={
        "paperId": "p_chat",
        "messages": [{"role": "user", "content": "hi"}],
    })
    frames = _parse_sse_frames(resp.content)
    assert frames[-1]["done"] is True
    assert "bedrock exploded" in frames[-1]["error"]


def test_build_chat_context_omits_manuscript_and_references():
    bundle = _fake_chat_bundle()
    ctx = server._build_chat_context(bundle)

    assert "Chat Test Paper" in ctx
    assert "Vague opening" in ctx
    assert "CATEGORY SCORES" in ctx
    # These sections are intentionally left out to keep the chat prompt small:
    assert "manuscript" not in ctx.lower() or "MANUSCRIPT" not in ctx
    assert "Foo et al. 2020" not in ctx  # references section excluded


def test_to_bedrock_messages_skips_empty_and_unknown_roles():
    out = server._to_bedrock_messages([
        {"role": "user", "content": "hello"},
        {"role": "system", "content": "ignore me"},   # not a valid Bedrock chat role
        {"role": "assistant", "content": "   "},       # blank -> skip
        {"role": "user", "content": "still here"},
    ])
    assert out == [
        {"role": "user", "content": [{"text": "hello"}]},
        {"role": "user", "content": [{"text": "still here"}]},
    ]
