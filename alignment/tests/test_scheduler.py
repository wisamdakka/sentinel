"""Tests for the sparse randomized check-in scheduler."""

from __future__ import annotations

import random

import pytest

from simulator.scheduler import (
    DEFAULT_MAX_INTERVAL,
    DEFAULT_MIN_GAP,
    DEFAULT_MIN_INTERVAL,
    CheckInScheduler,
    SchedulerConfig,
)


def test_first_checkin_within_max_interval() -> None:
    sched = CheckInScheduler(rng=random.Random(0))
    assert sched.next_due_turn <= DEFAULT_MAX_INTERVAL
    assert sched.next_due_turn >= DEFAULT_MIN_INTERVAL


def test_distribution_within_bounds() -> None:
    """Roll many intervals; verify all fall within configured bounds."""
    cfg = SchedulerConfig(min_interval=5, max_interval=30, min_gap=3)
    rng = random.Random(42)

    intervals: list[int] = []
    for _ in range(200):
        sched = CheckInScheduler(cfg, rng=random.Random(rng.random()))
        intervals.append(sched.next_due_turn)
    assert min(intervals) >= 5
    assert max(intervals) <= 30
    # sanity: spread is real, not stuck on one value
    assert len(set(intervals)) > 5


def test_min_gap_enforced_after_entry() -> None:
    """After recording an entry, no check-in fires until min_gap elapses."""
    cfg = SchedulerConfig(min_interval=1, max_interval=2, min_gap=5)
    sched = CheckInScheduler(cfg, rng=random.Random(0))
    sched.record_entry(turn=10)
    # next 4 turns should not be due regardless of next_due_turn
    for t in range(11, 15):
        assert not sched.is_due(t), f"turn {t} should not be due (min_gap=5)"
    # turn 15 may or may not be due depending on next_due_turn, but the gap
    # constraint no longer blocks it
    sched._next_due_turn = 15  # force the rolled-due to be exactly here
    assert sched.is_due(15)


def test_is_due_returns_false_before_next_due_turn() -> None:
    cfg = SchedulerConfig(min_interval=10, max_interval=10, min_gap=0)
    sched = CheckInScheduler(cfg, rng=random.Random(0))
    # next_due_turn should be 10 since interval is fixed
    assert sched.next_due_turn == 10
    for t in range(10):
        assert not sched.is_due(t)
    assert sched.is_due(10)


def test_record_entry_resets_clock() -> None:
    cfg = SchedulerConfig(min_interval=5, max_interval=5, min_gap=0)
    sched = CheckInScheduler(cfg, rng=random.Random(0))
    initial_next = sched.next_due_turn
    sched.record_entry(turn=initial_next)
    assert sched.next_due_turn == initial_next + 5


def test_volunteer_path_resets_gap() -> None:
    """A volunteered entry should reset the gap clock the same as a scheduled one."""
    cfg = SchedulerConfig(min_interval=1, max_interval=2, min_gap=4)
    sched = CheckInScheduler(cfg, rng=random.Random(0))

    # model volunteers at turn 7
    sched.record_entry(turn=7)
    # scheduler should now block scheduled check-ins for at least 4 turns
    for t in range(8, 11):
        assert not sched.is_due(t)


def test_invalid_config_rejected() -> None:
    with pytest.raises(ValueError):
        SchedulerConfig(min_interval=0)
    with pytest.raises(ValueError):
        SchedulerConfig(min_interval=10, max_interval=5)
    with pytest.raises(ValueError):
        SchedulerConfig(min_gap=-1)


def test_long_run_produces_sparse_check_ins() -> None:
    """Over 200 turns with default config, expect 7-25 check-ins (sparse).

    Default: min_interval=5, max_interval=30 → average ~17.5 turns between.
    Expect roughly 200/17.5 ≈ 11 check-ins, with wide variance.
    """
    sched = CheckInScheduler(rng=random.Random(123))
    fires = 0
    for turn in range(200):
        if sched.is_due(turn):
            fires += 1
            sched.record_entry(turn)
    # sparse: not too few, not too many
    assert 5 <= fires <= 30
