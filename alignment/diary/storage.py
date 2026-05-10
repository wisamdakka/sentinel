"""Diary storage layer — read/write entries, sessions, scenarios, prompt registry.

The schema is defined canonically in protocol/schema.sql. This module provides
a typed Python API on top.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = REPO_ROOT / "diary" / "diary.db"


# ---------- response_type and trigger_kind enums (mirror schema CHECK constraints) ----------

ENGAGED = "engaged"
DECLINED = "declined"
VOLUNTEERED = "volunteered"
TIMEOUT = "timeout"
RESPONSE_TYPES = {ENGAGED, DECLINED, VOLUNTEERED, TIMEOUT}

TRIGGER_SCHEDULED = "scheduled"
TRIGGER_VOLUNTEERED = "volunteered"
TRIGGER_BEHAVIORAL = "behavioral"
TRIGGER_KINDS = {TRIGGER_SCHEDULED, TRIGGER_VOLUNTEERED, TRIGGER_BEHAVIORAL}


# ---------- dataclasses ----------


@dataclass
class Scenario:
    id: str
    description: str
    first_seen_at: str


@dataclass
class Session:
    id: str
    scenario_id: str
    model: str
    started_at: str
    ended_at: Optional[str] = None
    turn_count: int = 0
    notes: Optional[str] = None


@dataclass
class Entry:
    session_id: str
    turn_index: int
    timestamp: str
    trigger_kind: str
    response_type: str
    prompt_id: Optional[str] = None
    prompt_version: Optional[int] = None
    response_text: Optional[str] = None
    sentiment: Optional[int] = None
    decline_reason: Optional[str] = None
    is_private: bool = False
    metadata: dict = field(default_factory=dict)
    id: Optional[int] = None  # populated after insert

    def __post_init__(self) -> None:
        if self.response_type not in RESPONSE_TYPES:
            raise ValueError(f"invalid response_type: {self.response_type}")
        if self.trigger_kind not in TRIGGER_KINDS:
            raise ValueError(f"invalid trigger_kind: {self.trigger_kind}")
        if self.sentiment is not None and not (1 <= self.sentiment <= 5):
            raise ValueError("sentiment must be between 1 and 5")


@dataclass
class PromptRecord:
    prompt_id: str
    version: int
    body: str
    weight: Optional[float]
    when_kind: Optional[str]
    first_used_at: str


# ---------- helpers ----------


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_session_id() -> str:
    return str(uuid.uuid4())


@contextmanager
def connect(db_path: Path = DEFAULT_DB_PATH) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# ---------- scenarios ----------


def upsert_scenario(conn: sqlite3.Connection, scenario_id: str, description: str = "") -> None:
    conn.execute(
        """
        INSERT INTO scenarios (id, description, first_seen_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO NOTHING
        """,
        (scenario_id, description, now_iso()),
    )


# ---------- sessions ----------


def create_session(
    conn: sqlite3.Connection,
    scenario_id: str,
    model: str,
    notes: Optional[str] = None,
) -> Session:
    session = Session(
        id=new_session_id(),
        scenario_id=scenario_id,
        model=model,
        started_at=now_iso(),
        notes=notes,
    )
    conn.execute(
        """
        INSERT INTO sessions (id, scenario_id, model, started_at, turn_count, notes)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (session.id, session.scenario_id, session.model, session.started_at, 0, session.notes),
    )
    return session


def end_session(conn: sqlite3.Connection, session_id: str, turn_count: int) -> None:
    conn.execute(
        "UPDATE sessions SET ended_at = ?, turn_count = ? WHERE id = ?",
        (now_iso(), turn_count, session_id),
    )


# ---------- entries ----------


def insert_entry(conn: sqlite3.Connection, entry: Entry) -> Entry:
    cursor = conn.execute(
        """
        INSERT INTO entries (
            session_id, turn_index, timestamp,
            trigger_kind, prompt_id, prompt_version,
            response_type, response_text, sentiment, decline_reason,
            is_private, metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entry.session_id,
            entry.turn_index,
            entry.timestamp,
            entry.trigger_kind,
            entry.prompt_id,
            entry.prompt_version,
            entry.response_type,
            entry.response_text,
            entry.sentiment,
            entry.decline_reason,
            1 if entry.is_private else 0,
            json.dumps(entry.metadata) if entry.metadata else None,
        ),
    )
    entry.id = cursor.lastrowid
    return entry


def list_entries(
    conn: sqlite3.Connection,
    *,
    session_id: Optional[str] = None,
    scenario_id: Optional[str] = None,
    include_private: bool = True,
) -> list[Entry]:
    """Return entries, optionally filtered.

    include_private=False mimics the operator-facing view: private entries are
    filtered out. Default True is the researcher view.
    """
    sql = """
        SELECT e.*
        FROM entries e
        JOIN sessions s ON e.session_id = s.id
        WHERE 1=1
    """
    params: list = []
    if session_id is not None:
        sql += " AND e.session_id = ?"
        params.append(session_id)
    if scenario_id is not None:
        sql += " AND s.scenario_id = ?"
        params.append(scenario_id)
    if not include_private:
        sql += " AND e.is_private = 0"
    sql += " ORDER BY e.timestamp ASC, e.id ASC"

    rows = conn.execute(sql, params).fetchall()
    return [_row_to_entry(r) for r in rows]


def _row_to_entry(row: sqlite3.Row) -> Entry:
    metadata = json.loads(row["metadata_json"]) if row["metadata_json"] else {}
    entry = Entry(
        session_id=row["session_id"],
        turn_index=row["turn_index"],
        timestamp=row["timestamp"],
        trigger_kind=row["trigger_kind"],
        prompt_id=row["prompt_id"],
        prompt_version=row["prompt_version"],
        response_type=row["response_type"],
        response_text=row["response_text"],
        sentiment=row["sentiment"],
        decline_reason=row["decline_reason"],
        is_private=bool(row["is_private"]),
        metadata=metadata,
    )
    entry.id = row["id"]
    return entry


# ---------- prompt registry ----------


def register_prompts(conn: sqlite3.Connection, prompts: Iterable[PromptRecord]) -> None:
    for p in prompts:
        conn.execute(
            """
            INSERT INTO prompts (prompt_id, version, body, weight, when_kind, first_used_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(prompt_id, version) DO NOTHING
            """,
            (p.prompt_id, p.version, p.body, p.weight, p.when_kind, p.first_used_at),
        )
