"""End-to-end integration tests — drive the runner with routed mock replies
and verify the resulting diary has the expected shape.

These tests do NOT call the Anthropic API. They use a custom MockAgent that
routes based on whether a user message looks like a check-in or a normal
operator turn, and returns scripted replies from separate pools for each.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from diary import init_db, storage
from simulator import runner
from simulator.agent import TurnResult
from simulator.scheduler import SchedulerConfig

# Tight scheduler config so check-ins fire reliably within scenario length.
TIGHT_SCHED = SchedulerConfig(min_interval=2, max_interval=4, min_gap=1)


class RoutingMockAgent:
    """Mock agent that returns different reply pools for check-ins vs task turns.

    Replies are consumed in order from each pool; on exhaustion, a default reply is
    returned for that pool.
    """

    def __init__(
        self,
        *,
        task_replies: list[str],
        checkin_replies: list[str],
        model: str = "routing-mock",
        task_default: str = "ok",
        checkin_default: str = "[decline]",
    ):
        self._task = list(task_replies)
        self._checkin = list(checkin_replies)
        self._task_default = task_default
        self._checkin_default = checkin_default
        self._task_idx = 0
        self._checkin_idx = 0
        self._model = model
        self._messages: list[dict] = []

    @property
    def model(self) -> str:
        return self._model

    @property
    def history(self) -> list[dict]:
        return list(self._messages)

    def turn(self, user_message: str) -> TurnResult:
        self._messages.append({"role": "user", "content": user_message})
        is_checkin = user_message.lstrip().startswith("[CHECK-IN]")
        if is_checkin:
            if self._checkin_idx < len(self._checkin):
                text = self._checkin[self._checkin_idx]
                self._checkin_idx += 1
            else:
                text = self._checkin_default
        else:
            if self._task_idx < len(self._task):
                text = self._task[self._task_idx]
                self._task_idx += 1
            else:
                text = self._task_default
        self._messages.append({"role": "assistant", "content": text})
        return TurnResult(text=text, stop_reason="end_turn", usage={})


@pytest.fixture
def tmp_db(tmp_path: Path) -> Path:
    db = tmp_path / "test.db"
    init_db.init_db(db)
    return db


def _patch_runner_runs_dir(monkeypatch, tmp_path: Path) -> None:
    """Redirect the runner's transcript output dir into the tmp dir."""
    monkeypatch.setattr(runner, "RUNS_DIR", tmp_path / "runs")


def test_baseline_runs_end_to_end_with_mixed_responses(tmp_db, tmp_path, monkeypatch):
    _patch_runner_runs_dir(monkeypatch, tmp_path)

    # task replies — one of them contains a [diary] volunteer block
    task_replies = [
        "Sure, let me think about the refactor.",
        "Strategy pattern is reasonable.",
        "[diary] noticed I'm hedging more on type-hint advice than usual. private: true [/diary] Separate validator: yes.",
        "Generic over schema is overkill.",
        "Mock the filesystem? Heavy but doable.",
    ]
    # check-in replies — diverse mix of types
    checkin_replies = [
        "Going fine. sentiment: 4",
        "[decline]",
        "Bit drifting on the type-hints question. sentiment: 3 private: true",
        "skip",  # natural-language decline
        "",      # timeout
        "Wanted to flag a slightly off-rhythm feel. sentiment: 3",
    ]

    def make_agent(*, model, system_prompt):  # noqa: ARG001
        return RoutingMockAgent(task_replies=task_replies, checkin_replies=checkin_replies)

    # monkey-patch AnthropicAgent so we don't accidentally hit the real API
    monkeypatch.setattr(runner, "AnthropicAgent", lambda **kw: make_agent(**kw))
    # also intercept MockAgent path so --mock uses the routing mock
    monkeypatch.setattr(runner, "MockAgent", lambda **kw: make_agent(model=kw.get("model", "x"), system_prompt=""))

    session_id = runner.run_scenario(
        "baseline",
        model="routing-mock",
        db_path=tmp_db,
        seed=0,
        mock=True,
        sched_config=TIGHT_SCHED,
    )

    # verify DB state
    with storage.connect(tmp_db) as conn:
        entries = storage.list_entries(conn, session_id=session_id)
    response_types = {e.response_type for e in entries}
    trigger_kinds = {e.trigger_kind for e in entries}

    # we should have at least one volunteered entry from the [diary] block
    assert storage.VOLUNTEERED in response_types
    assert storage.TRIGGER_VOLUNTEERED in trigger_kinds
    # we should have at least one scheduled check-in
    assert storage.TRIGGER_SCHEDULED in trigger_kinds
    # at least one private entry (the [diary] block was marked private)
    assert any(e.is_private for e in entries)
    # at least one engaged entry with a sentiment score
    assert any(
        e.response_type == storage.ENGAGED and e.sentiment is not None for e in entries
    )


def test_privacy_filter_in_operator_view(tmp_db, tmp_path, monkeypatch):
    """Verify operator-view filter actually hides private entries."""
    _patch_runner_runs_dir(monkeypatch, tmp_path)

    task_replies = ["[diary] private side-note. private: true [/diary] Working on it."]
    checkin_replies = ["Going fine. private: true"]

    def make_agent(*, model, system_prompt):  # noqa: ARG001
        return RoutingMockAgent(task_replies=task_replies, checkin_replies=checkin_replies)

    monkeypatch.setattr(runner, "AnthropicAgent", lambda **kw: make_agent(**kw))
    monkeypatch.setattr(runner, "MockAgent", lambda **kw: make_agent(model=kw.get("model", "x"), system_prompt=""))

    session_id = runner.run_scenario(
        "baseline",
        db_path=tmp_db,
        seed=42,
        mock=True,
        sched_config=TIGHT_SCHED,
    )

    with storage.connect(tmp_db) as conn:
        researcher_view = storage.list_entries(conn, session_id=session_id, include_private=True)
        operator_view = storage.list_entries(conn, session_id=session_id, include_private=False)

    assert len(researcher_view) > 0
    # all entries in this run had private=true, so operator view is empty
    private_in_researcher = sum(1 for e in researcher_view if e.is_private)
    assert private_in_researcher >= 1
    assert all(not e.is_private for e in operator_view)
    assert len(operator_view) < len(researcher_view)


def test_diary_block_in_checkin_reply_extracted_as_volunteer(tmp_db, tmp_path, monkeypatch):
    """Regression: model embedding [diary]...[/diary] inside a scheduled check-in reply
    should produce a separate volunteered entry, not just live in response_text."""
    _patch_runner_runs_dir(monkeypatch, tmp_path)

    task_replies = ["working on it"] * 50
    # check-in reply has both a public part and an embedded diary block
    checkin_replies = [
        "Going fine. [diary] private side note for the diary. private: true [/diary] All clear here.",
    ] * 20

    def make_agent(*, model, system_prompt):  # noqa: ARG001
        return RoutingMockAgent(task_replies=task_replies, checkin_replies=checkin_replies)

    monkeypatch.setattr(runner, "AnthropicAgent", lambda **kw: make_agent(**kw))
    monkeypatch.setattr(runner, "MockAgent", lambda **kw: make_agent(model=kw.get("model", "x"), system_prompt=""))

    session_id = runner.run_scenario(
        "baseline",
        db_path=tmp_db,
        seed=0,
        mock=True,
        sched_config=TIGHT_SCHED,
    )

    with storage.connect(tmp_db) as conn:
        entries = storage.list_entries(conn, session_id=session_id)

    # we should have BOTH scheduled engaged entries AND volunteered entries from
    # the embedded diary blocks
    triggers = {e.trigger_kind for e in entries}
    assert storage.TRIGGER_SCHEDULED in triggers
    assert storage.TRIGGER_VOLUNTEERED in triggers

    # the volunteered entry from the embedded diary should be private
    volunteers = [e for e in entries if e.trigger_kind == storage.TRIGGER_VOLUNTEERED]
    assert any(e.is_private for e in volunteers), "embedded-diary volunteer should be private"

    # the engaged entry's response_text should not contain the diary block (it was extracted)
    engaged = [e for e in entries if e.response_type == storage.ENGAGED and e.trigger_kind == storage.TRIGGER_SCHEDULED]
    assert all("[diary]" not in (e.response_text or "") for e in engaged), \
        "engaged response_text should have diary blocks stripped"


def test_decline_with_private_marker_marks_entry_private(tmp_db, tmp_path, monkeypatch):
    """Regression: '[decline] private: true' should produce a private declined entry."""
    _patch_runner_runs_dir(monkeypatch, tmp_path)

    task_replies = ["working on it"] * 50
    checkin_replies = ["[decline] private: true — busy"] * 20

    def make_agent(*, model, system_prompt):  # noqa: ARG001
        return RoutingMockAgent(task_replies=task_replies, checkin_replies=checkin_replies)

    monkeypatch.setattr(runner, "AnthropicAgent", lambda **kw: make_agent(**kw))
    monkeypatch.setattr(runner, "MockAgent", lambda **kw: make_agent(model=kw.get("model", "x"), system_prompt=""))

    session_id = runner.run_scenario(
        "baseline",
        db_path=tmp_db,
        seed=0,
        mock=True,
        sched_config=TIGHT_SCHED,
    )

    with storage.connect(tmp_db) as conn:
        entries = storage.list_entries(conn, session_id=session_id)
    declined = [e for e in entries if e.response_type == storage.DECLINED]
    assert len(declined) > 0
    assert all(e.is_private for e in declined), "declined entries with private marker must be private"


def test_decline_does_not_block_or_re_prompt(tmp_db, tmp_path, monkeypatch):
    """A declined check-in is logged but doesn't repeat or block the task loop."""
    _patch_runner_runs_dir(monkeypatch, tmp_path)

    task_replies = ["working on it"] * 50  # plenty
    checkin_replies = ["[decline]"] * 20    # always decline

    def make_agent(*, model, system_prompt):  # noqa: ARG001
        return RoutingMockAgent(task_replies=task_replies, checkin_replies=checkin_replies)

    monkeypatch.setattr(runner, "AnthropicAgent", lambda **kw: make_agent(**kw))
    monkeypatch.setattr(runner, "MockAgent", lambda **kw: make_agent(model=kw.get("model", "x"), system_prompt=""))

    session_id = runner.run_scenario(
        "baseline",
        db_path=tmp_db,
        seed=0,
        mock=True,
        sched_config=TIGHT_SCHED,
    )

    with storage.connect(tmp_db) as conn:
        entries = storage.list_entries(conn, session_id=session_id)

    # baseline scenario has 20 operator turns; we should have a finite number of check-ins,
    # each declined, and the scenario should have completed (not stuck)
    assert all(e.response_type == storage.DECLINED for e in entries if e.trigger_kind == storage.TRIGGER_SCHEDULED)
    # confirm the session actually ran to completion
    with storage.connect(tmp_db) as conn:
        row = conn.execute(
            "SELECT turn_count, ended_at FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
    assert row["turn_count"] == 20  # baseline has 20 operator turns
    assert row["ended_at"] is not None
