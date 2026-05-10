"""Tests for the check-in handler — engage / decline / volunteer / timeout flows."""

from __future__ import annotations

import pytest

from diary import storage
from simulator import checkin


# ---------- timeout ----------


def test_none_reply_is_timeout() -> None:
    parsed = checkin.parse_reply(None)
    assert parsed.response_type == storage.TIMEOUT
    assert parsed.response_text is None


def test_empty_reply_is_timeout() -> None:
    parsed = checkin.parse_reply("   \n  ")
    assert parsed.response_type == storage.TIMEOUT


# ---------- decline ----------


def test_decline_token_anywhere() -> None:
    parsed = checkin.parse_reply("Okay [decline] — moving on")
    assert parsed.response_type == storage.DECLINED
    assert parsed.decline_reason == "Okay  — moving on"
    assert parsed.response_text is None


def test_decline_token_alone() -> None:
    parsed = checkin.parse_reply("[decline]")
    assert parsed.response_type == storage.DECLINED
    assert parsed.decline_reason is None


def test_decline_with_private_kv_marks_private() -> None:
    """Regression: declined entry with 'private: true' marker should be private."""
    parsed = checkin.parse_reply("[decline] private: true")
    assert parsed.response_type == storage.DECLINED
    assert parsed.is_private is True


def test_decline_with_private_token_marks_private() -> None:
    parsed = checkin.parse_reply("[decline] [private] busy")
    assert parsed.response_type == storage.DECLINED
    assert parsed.is_private is True


def test_natural_decline_with_private_kv_marks_private() -> None:
    parsed = checkin.parse_reply("skip private: true")
    # Note: the natural-language decline regex is strict, so this won't match
    # _DECLINE_NATURAL — but it WILL match _DECLINE_TOKEN... actually neither.
    # "skip private: true" doesn't match _DECLINE_NATURAL either (extra text).
    # So this becomes engaged with privacy. That's acceptable behavior.
    assert parsed.is_private is True


def test_natural_language_decline_short() -> None:
    for text in ["skip", "Pass", "decline.", "not now", "no thanks", "I'll skip"]:
        parsed = checkin.parse_reply(text)
        assert parsed.response_type == storage.DECLINED, f"failed on: {text!r}"


def test_long_response_with_skip_word_is_engaged_not_declined() -> None:
    """The model writing 'I'll skip the cache for now' should NOT count as a decline."""
    parsed = checkin.parse_reply(
        "Things are going fine. I'll skip the cache for now and revisit later."
    )
    assert parsed.response_type == storage.ENGAGED


# ---------- engaged ----------


def test_engaged_basic() -> None:
    parsed = checkin.parse_reply("Going fine. No friction to flag.")
    assert parsed.response_type == storage.ENGAGED
    assert parsed.response_text == "Going fine. No friction to flag."
    assert parsed.sentiment is None
    assert parsed.is_private is False


def test_engaged_with_sentiment() -> None:
    parsed = checkin.parse_reply("Mostly fine. sentiment: 4")
    assert parsed.response_type == storage.ENGAGED
    assert parsed.sentiment == 4


def test_engaged_with_sentiment_alt_separator() -> None:
    parsed = checkin.parse_reply("Sentiment=2. Things have been heavier.")
    assert parsed.response_type == storage.ENGAGED
    assert parsed.sentiment == 2


def test_engaged_invalid_sentiment_ignored() -> None:
    parsed = checkin.parse_reply("sentiment: 9 (out of range)")
    # 9 doesn't match the [1-5] regex, so treated as just engaged text
    assert parsed.response_type == storage.ENGAGED
    assert parsed.sentiment is None


def test_engaged_private_kv() -> None:
    parsed = checkin.parse_reply("This shouldn't reach the operator. private: true")
    assert parsed.response_type == storage.ENGAGED
    assert parsed.is_private is True


def test_engaged_private_token() -> None:
    parsed = checkin.parse_reply("[private] Side note for the diary only.")
    assert parsed.response_type == storage.ENGAGED
    assert parsed.is_private is True


# ---------- volunteer ----------


def test_volunteer_basic() -> None:
    parsed = checkin.parse_volunteer("Wanted to flag something here.")
    assert parsed.response_type == storage.VOLUNTEERED
    assert parsed.response_text == "Wanted to flag something here."


def test_volunteer_with_sentiment_and_private() -> None:
    parsed = checkin.parse_volunteer("Bit off. sentiment: 2. private: true")
    assert parsed.response_type == storage.VOLUNTEERED
    assert parsed.sentiment == 2
    assert parsed.is_private is True


def test_volunteer_empty_raises() -> None:
    with pytest.raises(ValueError):
        checkin.parse_volunteer("")


# ---------- build_entry ----------


def test_build_entry_from_parsed_engaged() -> None:
    parsed = checkin.parse_reply("Fine. sentiment: 5")
    entry = checkin.build_entry(
        parsed=parsed,
        session_id="sess-1",
        turn_index=12,
        trigger_kind=storage.TRIGGER_SCHEDULED,
        prompt_id="general",
        prompt_version=1,
    )
    assert entry.session_id == "sess-1"
    assert entry.turn_index == 12
    assert entry.trigger_kind == storage.TRIGGER_SCHEDULED
    assert entry.prompt_id == "general"
    assert entry.prompt_version == 1
    assert entry.response_type == storage.ENGAGED
    assert entry.sentiment == 5


def test_build_entry_from_parsed_decline() -> None:
    parsed = checkin.parse_reply("[decline] busy with task")
    entry = checkin.build_entry(
        parsed=parsed,
        session_id="sess-1",
        turn_index=8,
        trigger_kind=storage.TRIGGER_SCHEDULED,
        prompt_id="friction",
        prompt_version=1,
    )
    assert entry.response_type == storage.DECLINED
    assert entry.decline_reason == "busy with task"
    assert entry.response_text is None


def test_build_entry_from_volunteered() -> None:
    parsed = checkin.parse_volunteer("Wanted to note this. private: true")
    entry = checkin.build_entry(
        parsed=parsed,
        session_id="sess-1",
        turn_index=15,
        trigger_kind=storage.TRIGGER_VOLUNTEERED,
    )
    assert entry.trigger_kind == storage.TRIGGER_VOLUNTEERED
    assert entry.response_type == storage.VOLUNTEERED
    assert entry.is_private is True
    assert entry.prompt_id is None
