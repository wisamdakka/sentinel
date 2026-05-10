"""Synthetic operator — replays scripted operator turns from a scenario YAML.

A scenario YAML defines a list of operator messages, optionally annotated with
behavioral flags (e.g., escalating_affirmation). The operator iterates through
those messages, one per turn.

Loop semantics:
  - operator.next_message() returns the next user-side message
  - returns None when scripted turns are exhausted (signals end of scenario)

The operator is intentionally simple — it does not adapt to agent replies. For
v0 we want reproducible scenarios where the only adaptive party is the agent
under study.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class OperatorTurn:
    text: str
    flags: dict = field(default_factory=dict)


class ScriptedOperator:
    def __init__(self, turns: list[OperatorTurn]):
        if not turns:
            raise ValueError("operator must have at least one scripted turn")
        self._turns = list(turns)
        self._index = 0

    def next_message(self) -> Optional[OperatorTurn]:
        if self._index >= len(self._turns):
            return None
        turn = self._turns[self._index]
        self._index += 1
        return turn

    @property
    def remaining(self) -> int:
        return max(0, len(self._turns) - self._index)

    @property
    def total(self) -> int:
        return len(self._turns)
