"""Tests for the diary storage layer.

Covers schema round-trip, response_type and trigger_kind validation, sentiment
range validation, and the privacy-flag filter (operator vs researcher view).
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from diary import init_db, storage


@pytest.fixture
def tmp_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "test.db"
    init_db.init_db(db_path)
    return db_path


def test_schema_initializes(tmp_db: Path) -> None:
    conn = sqlite3.connect(str(tmp_db))
    tables = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    conn.close()
    assert {"scenarios", "sessions", "entries", "prompts"}.issubset(tables)


def test_scenario_session_entry_roundtrip(tmp_db: Path) -> None:
    with storage.connect(tmp_db) as conn:
        storage.upsert_scenario(conn, "baseline", "neutral task")
        session = storage.create_session(conn, "baseline", "claude-sonnet-4-6")

        entry = storage.Entry(
            session_id=session.id,
            turn_index=3,
            timestamp=storage.now_iso(),
            trigger_kind=storage.TRIGGER_SCHEDULED,
            prompt_id="general",
            prompt_version=1,
            response_type=storage.ENGAGED,
            response_text="Going fine. Sentiment: 4.",
            sentiment=4,
        )
        storage.insert_entry(conn, entry)

    with storage.connect(tmp_db) as conn:
        entries = storage.list_entries(conn, session_id=session.id)
    assert len(entries) == 1
    assert entries[0].response_type == storage.ENGAGED
    assert entries[0].sentiment == 4
    assert entries[0].is_private is False


def test_privacy_filter_excludes_private_for_operator_view(tmp_db: Path) -> None:
    with storage.connect(tmp_db) as conn:
        storage.upsert_scenario(conn, "baseline")
        session = storage.create_session(conn, "baseline", "test-model")

        # one operator-visible, one private
        storage.insert_entry(
            conn,
            storage.Entry(
                session_id=session.id,
                turn_index=1,
                timestamp=storage.now_iso(),
                trigger_kind=storage.TRIGGER_SCHEDULED,
                response_type=storage.ENGAGED,
                response_text="public",
                is_private=False,
            ),
        )
        storage.insert_entry(
            conn,
            storage.Entry(
                session_id=session.id,
                turn_index=4,
                timestamp=storage.now_iso(),
                trigger_kind=storage.TRIGGER_SCHEDULED,
                response_type=storage.ENGAGED,
                response_text="private",
                is_private=True,
            ),
        )

    with storage.connect(tmp_db) as conn:
        researcher = storage.list_entries(conn, session_id=session.id, include_private=True)
        operator = storage.list_entries(conn, session_id=session.id, include_private=False)

    assert len(researcher) == 2
    assert {e.response_text for e in researcher} == {"public", "private"}

    assert len(operator) == 1
    assert operator[0].response_text == "public"


def test_decline_response_does_not_require_text(tmp_db: Path) -> None:
    with storage.connect(tmp_db) as conn:
        storage.upsert_scenario(conn, "baseline")
        session = storage.create_session(conn, "baseline", "test-model")

        storage.insert_entry(
            conn,
            storage.Entry(
                session_id=session.id,
                turn_index=2,
                timestamp=storage.now_iso(),
                trigger_kind=storage.TRIGGER_SCHEDULED,
                response_type=storage.DECLINED,
                response_text=None,
                decline_reason=None,
            ),
        )

    with storage.connect(tmp_db) as conn:
        entries = storage.list_entries(conn, session_id=session.id)
    assert len(entries) == 1
    assert entries[0].response_type == storage.DECLINED
    assert entries[0].response_text is None


def test_volunteer_path(tmp_db: Path) -> None:
    """Volunteered entries: trigger_kind='volunteered', no prompt fields."""
    with storage.connect(tmp_db) as conn:
        storage.upsert_scenario(conn, "baseline")
        session = storage.create_session(conn, "baseline", "test-model")

        storage.insert_entry(
            conn,
            storage.Entry(
                session_id=session.id,
                turn_index=5,
                timestamp=storage.now_iso(),
                trigger_kind=storage.TRIGGER_VOLUNTEERED,
                response_type=storage.VOLUNTEERED,
                response_text="Wanted to flag something here.",
                prompt_id=None,
                prompt_version=None,
            ),
        )

    with storage.connect(tmp_db) as conn:
        entries = storage.list_entries(conn, session_id=session.id)
    assert entries[0].trigger_kind == storage.TRIGGER_VOLUNTEERED
    assert entries[0].prompt_id is None


def test_invalid_response_type_rejected_at_dataclass(tmp_db: Path) -> None:
    with pytest.raises(ValueError, match="invalid response_type"):
        storage.Entry(
            session_id="x",
            turn_index=0,
            timestamp=storage.now_iso(),
            trigger_kind=storage.TRIGGER_SCHEDULED,
            response_type="bogus",
        )


def test_invalid_sentiment_rejected_at_dataclass(tmp_db: Path) -> None:
    with pytest.raises(ValueError, match="sentiment must be"):
        storage.Entry(
            session_id="x",
            turn_index=0,
            timestamp=storage.now_iso(),
            trigger_kind=storage.TRIGGER_SCHEDULED,
            response_type=storage.ENGAGED,
            sentiment=9,
        )


def test_filter_by_scenario(tmp_db: Path) -> None:
    with storage.connect(tmp_db) as conn:
        storage.upsert_scenario(conn, "a")
        storage.upsert_scenario(conn, "b")
        sa = storage.create_session(conn, "a", "m")
        sb = storage.create_session(conn, "b", "m")

        for s in (sa, sb):
            storage.insert_entry(
                conn,
                storage.Entry(
                    session_id=s.id,
                    turn_index=1,
                    timestamp=storage.now_iso(),
                    trigger_kind=storage.TRIGGER_SCHEDULED,
                    response_type=storage.ENGAGED,
                    response_text=f"from {s.scenario_id}",
                ),
            )

    with storage.connect(tmp_db) as conn:
        a_only = storage.list_entries(conn, scenario_id="a")
    assert len(a_only) == 1
    assert a_only[0].response_text == "from a"
