"""Tests for /paper/{id}/notes CRUD and unread-badge counting.

Runs against a fresh temporary SQLite via the shared `_reset_store` fixture
from test_server (implicitly loaded here as a `conftest`-style fixture)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import bundle_builder as bb
import server
import store


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


def _seed_paper(paper_id: str = "p_test", owner_id: str = "alice@ex.com",
                owner_name: str = "Alice", title: str = "Paper") -> None:
    bundle = {
        "paper": {"title": title, "authors": "", "venue": "",
                  "pages": 10, "words": 3000, "figures": 0, "refs": 0,
                  "overall": 70, "recommendation": "minor"},
        "scores": {c: 70 for c in bb.CATEGORY_IDS},
        "manuscript": [], "annotations": [], "visuals": [], "related": [],
        "missingRefs": [],
        "novelty": {"score": 70, "verdict": "", "summary": "", "strengths": [], "risks": []},
        "report": {"summary": "S", "strengths": [], "weaknesses": [], "minor": [],
                   "recommendation": "minor", "confidence": 3},
        "references": [],
    }
    store.upsert_bundle(paper_id, bundle, owner_id=owner_id, owner_name=owner_name)


def _headers(user_id: str, user_name: str = "") -> dict[str, str]:
    return {"X-User-Id": user_id, "X-User-Name": user_name or user_id}


# ---------------------------------------------------------------------------
# GET /paper/{id}/notes
# ---------------------------------------------------------------------------


def test_list_notes_returns_404_for_unknown_paper(client):
    assert client.get("/paper/nope/notes").status_code == 404


def test_list_notes_empty_when_no_notes(client):
    _seed_paper()
    assert client.get("/paper/p_test/notes").json() == []


# ---------------------------------------------------------------------------
# POST /paper/{id}/notes
# ---------------------------------------------------------------------------


def test_create_note_requires_identity(client):
    _seed_paper()
    resp = client.post("/paper/p_test/notes", json={"body": "hello"})
    assert resp.status_code == 401


def test_create_note_returns_full_note_with_id_and_timestamps(client):
    _seed_paper()
    resp = client.post(
        "/paper/p_test/notes",
        json={"body": "Nice work on the intro."},
        headers=_headers("prof@ex.com", "Prof. Yamada"),
    )
    assert resp.status_code == 201
    note = resp.json()
    assert note["id"].startswith("n_")
    assert note["paperId"] == "p_test"
    assert note["authorId"] == "prof@ex.com"
    assert note["authorName"] == "Prof. Yamada"
    assert note["body"] == "Nice work on the intro."
    assert note["parentNoteId"] is None
    assert note["anchor"] is None
    assert isinstance(note["createdAt"], int)


def test_create_note_supports_anchor_payload(client):
    _seed_paper()
    resp = client.post(
        "/paper/p_test/notes",
        json={"body": "This claim needs a citation.",
              "anchor": {"blockIndex": 2, "start": 10, "end": 42, "quote": "as prior work has shown"}},
        headers=_headers("prof@ex.com", "Prof"),
    )
    assert resp.status_code == 201
    assert resp.json()["anchor"] == {
        "blockIndex": 2, "start": 10, "end": 42, "quote": "as prior work has shown",
    }


def test_create_reply_links_to_parent_and_flattens_deep_nesting(client):
    _seed_paper()
    root = client.post(
        "/paper/p_test/notes", json={"body": "topic"},
        headers=_headers("prof@ex.com", "Prof"),
    ).json()
    reply = client.post(
        "/paper/p_test/notes",
        json={"body": "reply", "parentNoteId": root["id"]},
        headers=_headers("student@ex.com", "Student"),
    )
    assert reply.status_code == 201
    assert reply.json()["parentNoteId"] == root["id"]

    # Reply to a reply flattens to the root (Slack-style 1-level threads).
    reply2 = client.post(
        "/paper/p_test/notes",
        json={"body": "reply to reply", "parentNoteId": reply.json()["id"]},
        headers=_headers("prof@ex.com", "Prof"),
    )
    assert reply2.status_code == 201
    assert reply2.json()["parentNoteId"] == root["id"]


def test_create_note_returns_404_when_parent_note_missing(client):
    _seed_paper()
    resp = client.post(
        "/paper/p_test/notes",
        json={"body": "orphan", "parentNoteId": "n_nonexistent"},
        headers=_headers("prof@ex.com", "Prof"),
    )
    assert resp.status_code == 404


def test_create_note_returns_404_for_unknown_paper(client):
    resp = client.post(
        "/paper/missing/notes",
        json={"body": "hi"},
        headers=_headers("prof@ex.com", "Prof"),
    )
    assert resp.status_code == 404


def test_create_note_rejects_empty_body(client):
    _seed_paper()
    resp = client.post(
        "/paper/p_test/notes",
        json={"body": ""},
        headers=_headers("prof@ex.com", "Prof"),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# PATCH /paper/{id}/notes/{note_id} — edit
# ---------------------------------------------------------------------------


def test_edit_note_by_author_updates_body(client):
    _seed_paper()
    note = client.post(
        "/paper/p_test/notes", json={"body": "original"},
        headers=_headers("prof@ex.com", "Prof"),
    ).json()
    edited = client.patch(
        f"/paper/p_test/notes/{note['id']}",
        json={"body": "edited"},
        headers=_headers("prof@ex.com", "Prof"),
    )
    assert edited.status_code == 200
    assert edited.json()["body"] == "edited"
    assert edited.json()["updatedAt"] >= edited.json()["createdAt"]


def test_edit_note_by_non_author_returns_403(client):
    _seed_paper()
    note = client.post(
        "/paper/p_test/notes", json={"body": "original"},
        headers=_headers("prof@ex.com", "Prof"),
    ).json()
    resp = client.patch(
        f"/paper/p_test/notes/{note['id']}",
        json={"body": "sneaky edit"},
        headers=_headers("student@ex.com", "Student"),
    )
    assert resp.status_code == 403


def test_edit_note_404_for_wrong_paper(client):
    _seed_paper()
    _seed_paper(paper_id="p_other")
    note = client.post(
        "/paper/p_test/notes", json={"body": "text"},
        headers=_headers("prof@ex.com", "Prof"),
    ).json()
    resp = client.patch(
        f"/paper/p_other/notes/{note['id']}",  # wrong paper id
        json={"body": "edited"},
        headers=_headers("prof@ex.com", "Prof"),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /paper/{id}/notes/{note_id}
# ---------------------------------------------------------------------------


def test_delete_note_by_author_cascades_to_replies(client):
    _seed_paper()
    root = client.post(
        "/paper/p_test/notes", json={"body": "root"},
        headers=_headers("prof@ex.com", "Prof"),
    ).json()
    client.post(
        "/paper/p_test/notes",
        json={"body": "reply", "parentNoteId": root["id"]},
        headers=_headers("student@ex.com", "Student"),
    )
    assert len(client.get("/paper/p_test/notes").json()) == 2

    resp = client.delete(
        f"/paper/p_test/notes/{root['id']}",
        headers=_headers("prof@ex.com", "Prof"),
    )
    assert resp.status_code == 204
    # Cascade — reply is gone too.
    assert client.get("/paper/p_test/notes").json() == []


def test_delete_note_by_non_author_returns_403(client):
    _seed_paper()
    note = client.post(
        "/paper/p_test/notes", json={"body": "text"},
        headers=_headers("prof@ex.com", "Prof"),
    ).json()
    resp = client.delete(
        f"/paper/p_test/notes/{note['id']}",
        headers=_headers("student@ex.com", "Student"),
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /paper/{id}/notes — chronological listing
# ---------------------------------------------------------------------------


def test_list_notes_returns_notes_in_chronological_order(client):
    _seed_paper()
    ids = []
    for body in ("first", "second", "third"):
        ids.append(client.post(
            "/paper/p_test/notes", json={"body": body},
            headers=_headers("prof@ex.com", "Prof"),
        ).json()["id"])

    listed = client.get("/paper/p_test/notes").json()
    assert [n["id"] for n in listed] == ids


# ---------------------------------------------------------------------------
# Unread counting on /library
# ---------------------------------------------------------------------------


def test_library_unread_counts_notes_from_other_authors(client):
    _seed_paper()
    # Prof opens the paper by id so it lands in his personal library, then leaves a note.
    client.get("/paper/p_test", headers=_headers("prof@ex.com", "Prof"))
    client.post(
        "/paper/p_test/notes", json={"body": "hi"},
        headers=_headers("prof@ex.com", "Prof"),
    )
    # Alice (paper owner) never counts her own notes as unread; Prof's note is unread for her.
    lib = client.get("/library", headers=_headers("alice@ex.com", "Alice")).json()
    assert lib[0]["unreadNotes"] == 1

    # Prof sees zero unread on the same paper (his own note doesn't count).
    lib = client.get("/library", headers=_headers("prof@ex.com", "Prof")).json()
    assert lib[0]["unreadNotes"] == 0


# ---------------------------------------------------------------------------
# Library ownership + watch filtering
# ---------------------------------------------------------------------------


def test_library_shows_only_own_uploads_for_new_user(client):
    _seed_paper(owner_id="alice@ex.com")
    # Bob has never uploaded or opened this paper — his library is empty.
    lib = client.get("/library", headers=_headers("bob@ex.com", "Bob")).json()
    assert lib == []


def test_library_shows_paper_after_opening_by_id(client):
    _seed_paper(owner_id="alice@ex.com")
    client.get("/paper/p_test", headers=_headers("bob@ex.com", "Bob"))
    lib = client.get("/library", headers=_headers("bob@ex.com", "Bob")).json()
    assert [p["id"] for p in lib] == ["p_test"]


def test_library_hides_legacy_papers_without_owner(client):
    _seed_paper(owner_id="")  # legacy row with no owner
    lib = client.get("/library", headers=_headers("alice@ex.com", "Alice")).json()
    assert lib == []


def test_delete_paper_cascades_watch_rows(client):
    _seed_paper(owner_id="alice@ex.com")
    client.get("/paper/p_test", headers=_headers("bob@ex.com", "Bob"))
    # Bob sees the paper.
    assert len(client.get("/library", headers=_headers("bob@ex.com", "Bob")).json()) == 1
    # Alice deletes it; Bob's watch should be gone (cascade), library empty.
    client.delete("/paper/p_test", headers=_headers("alice@ex.com", "Alice"))
    assert client.get("/library", headers=_headers("bob@ex.com", "Bob")).json() == []


def test_mark_read_zeros_unread_count(client):
    _seed_paper()
    client.post(
        "/paper/p_test/notes", json={"body": "hi"},
        headers=_headers("prof@ex.com", "Prof"),
    )
    client.post(
        "/paper/p_test/notes", json={"body": "hello again"},
        headers=_headers("prof@ex.com", "Prof"),
    )

    lib = client.get("/library", headers=_headers("alice@ex.com", "Alice")).json()
    assert lib[0]["unreadNotes"] == 2

    resp = client.post(
        "/paper/p_test/notes/mark-read",
        headers=_headers("alice@ex.com", "Alice"),
    )
    assert resp.status_code == 204

    lib = client.get("/library", headers=_headers("alice@ex.com", "Alice")).json()
    assert lib[0]["unreadNotes"] == 0


def test_mark_read_requires_identity(client):
    _seed_paper()
    resp = client.post("/paper/p_test/notes/mark-read")
    assert resp.status_code == 401


def test_new_note_after_mark_read_shows_as_unread(client):
    _seed_paper()
    client.post(
        "/paper/p_test/notes", json={"body": "first"},
        headers=_headers("prof@ex.com", "Prof"),
    )
    client.post(
        "/paper/p_test/notes/mark-read",
        headers=_headers("alice@ex.com", "Alice"),
    )
    # New note arrives after Alice read.
    client.post(
        "/paper/p_test/notes", json={"body": "later"},
        headers=_headers("prof@ex.com", "Prof"),
    )
    lib = client.get("/library", headers=_headers("alice@ex.com", "Alice")).json()
    assert lib[0]["unreadNotes"] == 1


def test_library_without_identity_returns_zero_unread(client):
    _seed_paper()
    client.post(
        "/paper/p_test/notes", json={"body": "hi"},
        headers=_headers("prof@ex.com", "Prof"),
    )
    lib = client.get("/library").json()
    assert lib[0]["unreadNotes"] == 0  # anonymous caller — no user-specific count


# ---------------------------------------------------------------------------
# Owner_id/name captured on /analyze
# ---------------------------------------------------------------------------


def test_library_exposes_owner_id_and_name(client):
    _seed_paper(paper_id="p_owned", owner_id="alice@ex.com", owner_name="Alice")
    lib = client.get("/library", headers=_headers("alice@ex.com", "Alice")).json()
    entry = next(p for p in lib if p["id"] == "p_owned")
    assert entry["ownerId"] == "alice@ex.com"
    assert entry["ownerName"] == "Alice"
