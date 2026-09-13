"""SQLite persistence for the paper library and review bundles.

Replaces the in-memory dicts that used to live in ``server.py``. One file on
disk, created automatically. Path comes from ``MARGIN_DB_PATH`` (default
``data/margin.db``).
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

_lock = Lock()
_conn: sqlite3.Connection | None = None
_db_path: str | None = None  # None ⇒ read MARGIN_DB_PATH on first connect (after dotenv)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS papers (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  authors     TEXT NOT NULL DEFAULT '',
  venue       TEXT NOT NULL DEFAULT '',
  owner_id    TEXT NOT NULL DEFAULT '',
  owner_name  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'in-review'
              CHECK (status IN ('draft','in-review','done')),
  score       INTEGER,
  issues      INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  paper_id     TEXT PRIMARY KEY REFERENCES papers(id) ON DELETE CASCADE,
  bundle_json  TEXT NOT NULL,
  state_json   TEXT NOT NULL DEFAULT '{}',
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS papers_updated ON papers(updated_at DESC);
-- papers_owner index is created after `_apply_additive_migrations` adds the
-- owner_id column on legacy databases; see _apply_additive_migrations below.

CREATE TABLE IF NOT EXISTS venue_suggestions (
  paper_id     TEXT PRIMARY KEY REFERENCES papers(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS paper_notes (
  id              TEXT PRIMARY KEY,
  paper_id        TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  parent_note_id  TEXT REFERENCES paper_notes(id) ON DELETE CASCADE,
  author_id       TEXT NOT NULL,
  author_name     TEXT NOT NULL DEFAULT '',
  body            TEXT NOT NULL,
  anchor_json     TEXT,             -- {blockIndex, start, end, quote}
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS notes_by_paper ON paper_notes(paper_id, created_at);
CREATE INDEX IF NOT EXISTS notes_by_parent ON paper_notes(parent_note_id);

CREATE TABLE IF NOT EXISTS note_reads (
  user_id     TEXT NOT NULL,
  paper_id    TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  read_at     INTEGER NOT NULL,
  PRIMARY KEY (user_id, paper_id)
);

-- Which papers a user has "seen" — the union of uploads (via owner_id) and
-- papers opened by id. Drives the Dashboard filter so users only see their own
-- work + the papers they've been given via a shared id.
CREATE TABLE IF NOT EXISTS paper_watches (
  user_id     TEXT NOT NULL,
  paper_id    TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  watched_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, paper_id)
);
"""


# Column additions for databases created before these fields existed.
# Each entry: (table, column, DDL fragment appended to ALTER TABLE ... ADD COLUMN).
_ADDITIVE_MIGRATIONS: tuple[tuple[str, str, str], ...] = (
    ("papers", "owner_id",   "TEXT NOT NULL DEFAULT ''"),
    ("papers", "owner_name", "TEXT NOT NULL DEFAULT ''"),
)


def _apply_additive_migrations(conn: sqlite3.Connection) -> None:
    for table, column, ddl in _ADDITIVE_MIGRATIONS:
        cols = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
    # Indexes that depend on newly-added columns — safe to create every boot.
    conn.execute("CREATE INDEX IF NOT EXISTS papers_owner ON papers(owner_id)")


def _resolved_path() -> str:
    global _db_path
    if _db_path is None:
        _db_path = os.getenv("MARGIN_DB_PATH", "data/margin.db")
    return _db_path


def configure(path: str | None = None) -> None:
    """Close any open connection and point at ``path`` (or env / default)."""
    global _conn, _db_path
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None
        _db_path = path if path is not None else os.getenv("MARGIN_DB_PATH", "data/margin.db")


def close() -> None:
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None


def _connect() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        path = _resolved_path()
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(path, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA foreign_keys = ON")
        _conn.executescript(_SCHEMA)
        _apply_additive_migrations(_conn)
        _conn.commit()
    return _conn


def _now_ms() -> int:
    return int(time.time() * 1000)


def _fmt_updated(updated_at: int) -> str:
    return datetime.fromtimestamp(updated_at / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def _entry_from_row(row: sqlite3.Row, unread: int = 0) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "authors": row["authors"],
        "venue": row["venue"],
        "ownerId": row["owner_id"],
        "ownerName": row["owner_name"],
        "status": row["status"],
        "score": row["score"],
        "issues": row["issues"],
        "unreadNotes": unread,
        "updated": _fmt_updated(row["updated_at"]),
        "updatedAt": row["updated_at"],
        "archived": bool(row["archived"]),
        "current": True,
    }


def _unread_counts_for(conn: sqlite3.Connection, paper_ids: list[str], user_id: str) -> dict[str, int]:
    """Return {paper_id: unread_count} for the given papers and user.

    A note is "unread" for a user when its created_at is newer than the user's
    note_reads.read_at for that paper (or if there is no read record). The
    user's own notes are never counted as unread.
    """
    if not paper_ids or not user_id:
        return {pid: 0 for pid in paper_ids}
    placeholders = ",".join("?" for _ in paper_ids)
    rows = conn.execute(
        f"""
        WITH last_read AS (
          SELECT paper_id, read_at
          FROM note_reads
          WHERE user_id = ? AND paper_id IN ({placeholders})
        )
        SELECT p.id AS paper_id, COUNT(n.id) AS unread
        FROM papers p
        LEFT JOIN paper_notes n
          ON n.paper_id = p.id
          AND n.author_id != ?
          AND n.created_at > COALESCE((SELECT read_at FROM last_read WHERE last_read.paper_id = p.id), 0)
        WHERE p.id IN ({placeholders})
        GROUP BY p.id
        """,
        (user_id, *paper_ids, user_id, *paper_ids),
    ).fetchall()
    return {r["paper_id"]: int(r["unread"] or 0) for r in rows}


def list_papers(user_id: str = "") -> list[dict[str, Any]]:
    """List the papers the caller can see.

    - Anonymous caller (``user_id == ""``) → every paper. This exists only for
      internal / test callers; the client always sends an identity.
    - Identified caller → papers they uploaded (``owner_id == user_id``) plus
      papers they have explicitly opened by id (rows in ``paper_watches``).

    Each entry includes an ``unreadNotes`` count when a ``user_id`` is set.
    """
    with _lock:
        conn = _connect()
        if user_id:
            rows = conn.execute(
                """
                SELECT p.* FROM papers p
                LEFT JOIN paper_watches w
                  ON w.paper_id = p.id AND w.user_id = ?
                WHERE p.owner_id = ? OR w.paper_id IS NOT NULL
                ORDER BY p.updated_at DESC
                """,
                (user_id, user_id),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM papers ORDER BY updated_at DESC").fetchall()
        unread_map = _unread_counts_for(conn, [r["id"] for r in rows], user_id) if user_id else {}
        return [_entry_from_row(r, unread_map.get(r["id"], 0)) for r in rows]


def add_watch(paper_id: str, user_id: str) -> None:
    """Record that ``user_id`` has opened ``paper_id``. No-op for anonymous
    callers or missing papers."""
    if not user_id:
        return
    now = _now_ms()
    with _lock:
        conn = _connect()
        if not conn.execute("SELECT 1 FROM papers WHERE id = ?", (paper_id,)).fetchone():
            return
        conn.execute(
            """
            INSERT INTO paper_watches (user_id, paper_id, watched_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, paper_id) DO UPDATE SET watched_at = excluded.watched_at
            """,
            (user_id, paper_id, now),
        )
        conn.commit()


def get_bundle(paper_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT bundle_json FROM reviews WHERE paper_id = ?", (paper_id,)
        ).fetchone()
        if row is None:
            return None
        return json.loads(row["bundle_json"])


def paper_exists(paper_id: str) -> bool:
    with _lock:
        conn = _connect()
        row = conn.execute("SELECT 1 FROM papers WHERE id = ?", (paper_id,)).fetchone()
        return row is not None


def upsert_bundle(
    paper_id: str,
    bundle: dict[str, Any],
    owner_id: str = "",
    owner_name: str = "",
) -> dict[str, Any]:
    """Insert or replace a review bundle and its library row. Returns the entry.

    ``owner_id`` / ``owner_name`` are set only on INSERT; re-analyzing the same
    paper text won't overwrite an existing owner. Pass empty strings to keep
    a paper anonymous (legacy uploads before identity was added).
    """
    paper = bundle.get("paper", {})
    open_issues = sum(1 for a in bundle.get("annotations", []) if a.get("sev") != "minor")
    now = _now_ms()
    title = paper.get("title") or "Untitled"
    authors = paper.get("authors") or ""
    venue = paper.get("venue") or ""
    score = paper.get("overall")
    payload = json.dumps(bundle, ensure_ascii=False)

    with _lock:
        conn = _connect()
        conn.execute(
            """
            INSERT INTO papers (
              id, title, authors, venue, owner_id, owner_name,
              status, score, issues, archived, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'in-review', ?, ?, 0, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              authors = excluded.authors,
              venue = excluded.venue,
              status = 'in-review',
              score = excluded.score,
              issues = excluded.issues,
              archived = 0,
              updated_at = excluded.updated_at
            """,
            (paper_id, title, authors, venue, owner_id, owner_name, score, open_issues, now, now),
        )
        conn.execute(
            """
            INSERT INTO reviews (paper_id, bundle_json, state_json, updated_at)
            VALUES (?, ?, '{}', ?)
            ON CONFLICT(paper_id) DO UPDATE SET
              bundle_json = excluded.bundle_json,
              updated_at = excluded.updated_at
            """,
            (paper_id, payload, now),
        )
        conn.execute("DELETE FROM venue_suggestions WHERE paper_id = ?", (paper_id,))
        conn.commit()
        row = conn.execute("SELECT * FROM papers WHERE id = ?", (paper_id,)).fetchone()
        return _entry_from_row(row)


def delete_paper(paper_id: str) -> None:
    with _lock:
        conn = _connect()
        conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))
        conn.commit()


def get_venue_suggestions(paper_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT payload_json FROM venue_suggestions WHERE paper_id = ?",
            (paper_id,),
        ).fetchone()
        if row is None:
            return None
        return json.loads(row["payload_json"])


def set_venue_suggestions(paper_id: str, payload: dict[str, Any]) -> None:
    now = _now_ms()
    blob = json.dumps(payload, ensure_ascii=False)
    with _lock:
        conn = _connect()
        conn.execute(
            """
            INSERT INTO venue_suggestions (paper_id, payload_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(paper_id) DO UPDATE SET
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at
            """,
            (paper_id, blob, now),
        )
        conn.commit()


def set_archived(paper_id: str, archived: bool) -> bool:
    """Flip archived + status. Returns False if the paper is missing."""
    with _lock:
        conn = _connect()
        cur = conn.execute(
            "UPDATE papers SET archived = ?, status = ? WHERE id = ?",
            (1 if archived else 0, "done" if archived else "in-review", paper_id),
        )
        conn.commit()
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# paper_notes CRUD — user-authored comments alongside AI annotations
# ---------------------------------------------------------------------------


def _note_from_row(row: sqlite3.Row) -> dict[str, Any]:
    anchor = None
    if row["anchor_json"]:
        try:
            anchor = json.loads(row["anchor_json"])
        except json.JSONDecodeError:
            anchor = None
    return {
        "id": row["id"],
        "paperId": row["paper_id"],
        "parentNoteId": row["parent_note_id"],
        "authorId": row["author_id"],
        "authorName": row["author_name"],
        "body": row["body"],
        "anchor": anchor,
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def list_notes(paper_id: str) -> list[dict[str, Any]]:
    """Return every note on the paper, oldest first."""
    with _lock:
        conn = _connect()
        rows = conn.execute(
            "SELECT * FROM paper_notes WHERE paper_id = ? ORDER BY created_at ASC",
            (paper_id,),
        ).fetchall()
        return [_note_from_row(r) for r in rows]


def get_note(note_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT * FROM paper_notes WHERE id = ?", (note_id,)
        ).fetchone()
        return _note_from_row(row) if row else None


def create_note(
    note_id: str,
    paper_id: str,
    author_id: str,
    author_name: str,
    body: str,
    parent_note_id: str | None = None,
    anchor: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Insert a new note. Returns the note dict, or None if the paper or the
    parent (when set) does not exist."""
    now = _now_ms()
    anchor_json = json.dumps(anchor, ensure_ascii=False) if anchor else None
    with _lock:
        conn = _connect()
        if not conn.execute("SELECT 1 FROM papers WHERE id = ?", (paper_id,)).fetchone():
            return None
        if parent_note_id:
            parent = conn.execute(
                "SELECT paper_id, parent_note_id FROM paper_notes WHERE id = ?",
                (parent_note_id,),
            ).fetchone()
            if parent is None or parent["paper_id"] != paper_id:
                return None
            # Only one level of nesting — replies to replies flatten to the same root.
            if parent["parent_note_id"]:
                parent_note_id = parent["parent_note_id"]
        conn.execute(
            """
            INSERT INTO paper_notes (
              id, paper_id, parent_note_id, author_id, author_name,
              body, anchor_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (note_id, paper_id, parent_note_id, author_id, author_name, body, anchor_json, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM paper_notes WHERE id = ?", (note_id,)).fetchone()
        return _note_from_row(row)


def update_note(note_id: str, author_id: str, body: str) -> dict[str, Any] | None:
    """Edit a note's body. Only the note's author may edit; returns None if
    the note is missing or the caller is not the author."""
    now = _now_ms()
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT author_id FROM paper_notes WHERE id = ?", (note_id,)
        ).fetchone()
        if row is None or row["author_id"] != author_id:
            return None
        conn.execute(
            "UPDATE paper_notes SET body = ?, updated_at = ? WHERE id = ?",
            (body, now, note_id),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM paper_notes WHERE id = ?", (note_id,)
        ).fetchone()
        return _note_from_row(updated)


def delete_note(note_id: str, author_id: str) -> bool:
    """Delete a note if the caller is its author. Cascades to replies via the
    parent_note_id ON DELETE CASCADE. Returns True iff a row was deleted."""
    with _lock:
        conn = _connect()
        cur = conn.execute(
            "DELETE FROM paper_notes WHERE id = ? AND author_id = ?",
            (note_id, author_id),
        )
        conn.commit()
        return cur.rowcount > 0


def mark_notes_read(paper_id: str, user_id: str) -> None:
    """Record that this user has read every note on the paper up to now."""
    if not user_id:
        return
    now = _now_ms()
    with _lock:
        conn = _connect()
        if not conn.execute("SELECT 1 FROM papers WHERE id = ?", (paper_id,)).fetchone():
            return
        conn.execute(
            """
            INSERT INTO note_reads (user_id, paper_id, read_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, paper_id) DO UPDATE SET read_at = excluded.read_at
            """,
            (user_id, paper_id, now),
        )
        conn.commit()


def unread_note_count(paper_id: str, user_id: str) -> int:
    with _lock:
        conn = _connect()
        counts = _unread_counts_for(conn, [paper_id], user_id)
        return counts.get(paper_id, 0)
