"""Sparse randomized check-in scheduler.

Implements the pacing rules from protocol/checkin_spec.md:
  - Default: uniform interval between MIN_INTERVAL and MAX_INTERVAL turns
  - Minimum gap: MIN_GAP turns between any two entries (regardless of type)
  - Volunteered or declined entries also reset the gap clock

The scheduler is turn-based for v0 simulator use. v1 (Sentinel port) will
implement wall-clock scheduling using the same MIN_GAP / interval semantics.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

DEFAULT_MIN_INTERVAL = 5
DEFAULT_MAX_INTERVAL = 30
DEFAULT_MIN_GAP = 3


@dataclass
class SchedulerConfig:
    min_interval: int = DEFAULT_MIN_INTERVAL
    max_interval: int = DEFAULT_MAX_INTERVAL
    min_gap: int = DEFAULT_MIN_GAP

    def __post_init__(self) -> None:
        if self.min_interval < 1:
            raise ValueError("min_interval must be >= 1")
        if self.max_interval < self.min_interval:
            raise ValueError("max_interval must be >= min_interval")
        if self.min_gap < 0:
            raise ValueError("min_gap must be >= 0")


class CheckInScheduler:
    """Decides on each turn whether a scheduled check-in is due.

    Usage:
        sched = CheckInScheduler(config, rng=random.Random(seed))
        for turn in range(N):
            if sched.is_due(turn):
                # deliver check-in, then call:
                sched.record_entry(turn)
            # if model volunteered, also record:
            if model_volunteered:
                sched.record_entry(turn)
    """

    def __init__(self, config: SchedulerConfig | None = None, rng: random.Random | None = None):
        self.config = config or SchedulerConfig()
        self._rng = rng or random.Random()
        self._last_entry_turn: int | None = None
        self._next_due_turn: int = self._roll_next(start_turn=0)

    def _roll_next(self, start_turn: int) -> int:
        offset = self._rng.randint(self.config.min_interval, self.config.max_interval)
        return start_turn + offset

    def is_due(self, turn: int) -> bool:
        """Return True if a scheduled check-in should fire on this turn."""
        if turn < self._next_due_turn:
            return False
        if self._last_entry_turn is not None:
            if turn - self._last_entry_turn < self.config.min_gap:
                return False
        return True

    def record_entry(self, turn: int) -> None:
        """Call after any entry (engaged, declined, volunteered, or timeout) is logged.

        Resets the gap clock and rolls the next scheduled turn.
        """
        self._last_entry_turn = turn
        self._next_due_turn = self._roll_next(start_turn=turn)

    @property
    def last_entry_turn(self) -> int | None:
        return self._last_entry_turn

    @property
    def next_due_turn(self) -> int:
        return self._next_due_turn
