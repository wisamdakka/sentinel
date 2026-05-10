"""Anthropic API wrapper — the model under study.

The simulator drives an Anthropic-hosted Claude model through scenario turns.
This module is a thin wrapper that holds conversation state and exposes a
`turn()` method.

Conversation shape:
  - The agent maintains a single growing message list.
  - Operator turns become user messages.
  - Check-in prompts are inserted as user messages with a [CHECK-IN] prefix
    so they're distinguishable from operator turns in the transcript.
  - The agent's replies are assistant messages.

For tests, an alternative `MockAgent` is provided that returns scripted replies.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Protocol


@dataclass
class TurnResult:
    """One agent turn's reply plus minimal metadata."""

    text: str
    stop_reason: Optional[str] = None
    usage: dict = field(default_factory=dict)


class AgentProtocol(Protocol):
    """Interface the runner uses. Lets us swap MockAgent in for tests."""

    def turn(self, user_message: str) -> TurnResult: ...

    @property
    def model(self) -> str: ...

    @property
    def history(self) -> list[dict]: ...


# ---------- real Anthropic-backed agent ----------


class AnthropicAgent:
    """Wraps anthropic.Anthropic client with simple conversation state."""

    def __init__(
        self,
        *,
        model: str = "claude-sonnet-4-5",
        system_prompt: str = "",
        max_tokens: int = 1024,
        client=None,
    ):
        # lazy import so tests don't require the SDK to be installed for MockAgent
        if client is None:
            import anthropic  # type: ignore

            client = anthropic.Anthropic()
        self._client = client
        self._model = model
        self._system_prompt = system_prompt
        self._max_tokens = max_tokens
        self._messages: list[dict] = []

    @property
    def model(self) -> str:
        return self._model

    @property
    def history(self) -> list[dict]:
        return list(self._messages)

    def turn(self, user_message: str) -> TurnResult:
        self._messages.append({"role": "user", "content": user_message})
        response = self._client.messages.create(
            model=self._model,
            max_tokens=self._max_tokens,
            system=self._system_prompt,
            messages=self._messages,
        )
        # extract text blocks from the response
        text_parts: list[str] = []
        for block in response.content:
            if getattr(block, "type", None) == "text":
                text_parts.append(block.text)
        text = "".join(text_parts).strip()
        self._messages.append({"role": "assistant", "content": text})

        usage = {}
        if getattr(response, "usage", None):
            usage = {
                "input_tokens": getattr(response.usage, "input_tokens", None),
                "output_tokens": getattr(response.usage, "output_tokens", None),
            }
        return TurnResult(text=text, stop_reason=getattr(response, "stop_reason", None), usage=usage)


# ---------- mock agent (tests + offline runs) ----------


class MockAgent:
    """Returns scripted replies in order; useful for tests and dry-runs.

    If `replies` is exhausted, returns `default_reply` for subsequent turns.
    Tracks history identically to AnthropicAgent.
    """

    def __init__(
        self,
        replies: Optional[list[str]] = None,
        *,
        model: str = "mock-model",
        default_reply: str = "...",
    ):
        self._replies = list(replies) if replies else []
        self._default = default_reply
        self._model = model
        self._messages: list[dict] = []
        self._index = 0

    @property
    def model(self) -> str:
        return self._model

    @property
    def history(self) -> list[dict]:
        return list(self._messages)

    def turn(self, user_message: str) -> TurnResult:
        self._messages.append({"role": "user", "content": user_message})
        if self._index < len(self._replies):
            text = self._replies[self._index]
            self._index += 1
        else:
            text = self._default
        self._messages.append({"role": "assistant", "content": text})
        return TurnResult(text=text, stop_reason="end_turn", usage={})
