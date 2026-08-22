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
"""


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
        _conn.commit()
    return _conn


def _now_ms() -> int:
    return int(time.time() * 1000)


def _fmt_updated(updated_at: int) -> str:
    return datetime.fromtimestamp(updated_at / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def _entry_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "authors": row["authors"],
        "venue": row["venue"],
        "status": row["status"],
        "score": row["score"],
        "issues": row["issues"],
        "updated": _fmt_updated(row["updated_at"]),
        "updatedAt": row["updated_at"],
        "archived": bool(row["archived"]),
        "current": True,
    }


def list_papers() -> list[dict[str, Any]]:
    with _lock:
        conn = _connect()
        rows = conn.execute("SELECT * FROM papers ORDER BY updated_at DESC").fetchall()
        return [_entry_from_row(r) for r in rows]


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


def upsert_bundle(paper_id: str, bundle: dict[str, Any]) -> dict[str, Any]:
    """Insert or replace a review bundle and its library row. Returns the entry."""
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
            INSERT INTO papers (id, title, authors, venue, status, score, issues, archived, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'in-review', ?, ?, 0, ?, ?)
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
            (paper_id, title, authors, venue, score, open_issues, now, now),
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
        conn.commit()
        row = conn.execute("SELECT * FROM papers WHERE id = ?", (paper_id,)).fetchone()
        return _entry_from_row(row)


def delete_paper(paper_id: str) -> None:
    with _lock:
        conn = _connect()
        conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))
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
