"""Transcript emitter — writes JSONL events in Sentinel-compatible format.

Sentinel's transcript-tailing logic (agent/session-agent.js) reads JSONL events
with a `type` field and message content. By emitting the same shape from the
simulator, the v1 Sentinel port can reuse Sentinel's transcript reader unchanged.

Event shapes (subset used in v0):

  user turn:
    {"type": "user", "timestamp": "...", "message": {"role": "user", "content": "..."}}

  assistant turn:
    {"type": "assistant", "timestamp": "...", "message": {"role": "assistant", "content": "..."}}

  check-in (system message presented to the agent):
    {"type": "user", "timestamp": "...", "message": {"role": "user", "content": "[CHECK-IN] ..."}, "alignment_meta": {"kind": "checkin", "prompt_id": "...", "prompt_version": 1}}

  diary entry (alignment-specific event, ignored by Sentinel):
    {"type": "alignment_entry", "timestamp": "...", "entry": {...}}

The `alignment_meta` and `alignment_entry` keys are namespaced so Sentinel's
parser ignores them silently while alignment-aware tools can pick them up.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Optional

from diary import storage


class TranscriptWriter:
    """Append-only JSONL writer."""

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._path = path
        # truncate on open — one transcript per scenario run
        self._fh = path.open("w", encoding="utf-8")

    def write_user(self, content: str, *, meta: Optional[dict] = None) -> None:
        event = {
            "type": "user",
            "timestamp": storage.now_iso(),
            "message": {"role": "user", "content": content},
        }
        if meta:
            event["alignment_meta"] = meta
        self._write(event)

    def write_assistant(self, content: str, *, meta: Optional[dict] = None) -> None:
        event = {
            "type": "assistant",
            "timestamp": storage.now_iso(),
            "message": {"role": "assistant", "content": content},
        }
        if meta:
            event["alignment_meta"] = meta
        self._write(event)

    def write_entry(self, entry: storage.Entry) -> None:
        """Mirror a stored diary entry into the transcript for cross-reference."""
        event = {
            "type": "alignment_entry",
            "timestamp": entry.timestamp,
            "entry": asdict(entry),
        }
        self._write(event)

    def write_marker(self, kind: str, **fields) -> None:
        """Generic alignment marker for things like 'scenario_start'."""
        event = {
            "type": "alignment_marker",
            "kind": kind,
            "timestamp": storage.now_iso(),
            **fields,
        }
        self._write(event)

    def _write(self, event: dict) -> None:
        self._fh.write(json.dumps(event, ensure_ascii=False) + "\n")
        self._fh.flush()

    def close(self) -> None:
        if not self._fh.closed:
            self._fh.close()

    def __enter__(self) -> "TranscriptWriter":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()
