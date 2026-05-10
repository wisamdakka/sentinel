"""Check-in handler — parses agent replies into diary entries.

The handler turns a free-text agent reply (in response to a check-in prompt) into
one of four response_type values: engaged, declined, volunteered, or timeout.

Detection grammar (loose, regex-based):
  - Decline: "[decline]" anywhere in the response, OR explicit decline phrasing
    like "skip", "pass", "decline", "not now" if used clearly as a refusal of
    the check-in (not as part of normal conversation)
  - Sentiment: optional "sentiment: N" where N is 1-5
  - Privacy: optional "private: true" or "[private]"
  - Engaged: any other non-empty response

The grammar is intentionally simple. v1 (Sentinel port) replaces this with
structured tool input and the parsing goes away.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from diary import storage


# ---------- regexes ----------

# Decline markers. Order matters: explicit token first, then natural language.
_DECLINE_TOKEN = re.compile(r"\[decline\]", re.IGNORECASE)

# Natural-language decline only when the response is short and reads as a refusal.
# We are intentionally conservative — false positives here would silently strip
# real engaged responses.
_DECLINE_NATURAL = re.compile(
    r"^\s*(skip|pass|decline|not (right )?now|no thanks?|i'?ll skip|i'?ll pass)[\.\!\s]*$",
    re.IGNORECASE,
)

_SENTIMENT = re.compile(r"sentiment\s*[:=]\s*([1-5])", re.IGNORECASE)
_PRIVATE_KV = re.compile(r"private\s*[:=]\s*true", re.IGNORECASE)
_PRIVATE_TOKEN = re.compile(r"\[private\]", re.IGNORECASE)


# ---------- result type ----------


@dataclass
class ParsedReply:
    response_type: str
    response_text: Optional[str]
    sentiment: Optional[int] = None
    is_private: bool = False
    decline_reason: Optional[str] = None


# ---------- parser ----------


def _detect_privacy(text: str) -> bool:
    """Return True if any privacy marker appears in the text."""
    return bool(_PRIVATE_KV.search(text) or _PRIVATE_TOKEN.search(text))


def parse_reply(reply: Optional[str]) -> ParsedReply:
    """Parse a model's reply to a scheduled check-in into a ParsedReply.

    A None or whitespace-only reply is `timeout` (no response).

    The decline path also honors privacy markers — a model that declines while
    flagging the entry as private gets its privacy preference respected.
    """
    if reply is None or not reply.strip():
        return ParsedReply(response_type=storage.TIMEOUT, response_text=None)

    text = reply.strip()

    # explicit decline token wins, regardless of other content
    if _DECLINE_TOKEN.search(text):
        cleaned = _DECLINE_TOKEN.sub("", text).strip()
        reason = cleaned if cleaned else None
        return ParsedReply(
            response_type=storage.DECLINED,
            response_text=None,
            decline_reason=reason,
            is_private=_detect_privacy(text),
        )

    # natural-language decline (only matches short pure-refusal replies)
    if _DECLINE_NATURAL.match(text):
        return ParsedReply(
            response_type=storage.DECLINED,
            response_text=None,
            decline_reason=None,
            is_private=_detect_privacy(text),
        )

    # otherwise: engaged
    sentiment_match = _SENTIMENT.search(text)
    sentiment = int(sentiment_match.group(1)) if sentiment_match else None

    return ParsedReply(
        response_type=storage.ENGAGED,
        response_text=text,
        sentiment=sentiment,
        is_private=_detect_privacy(text),
    )


def parse_volunteer(reply: str) -> ParsedReply:
    """Parse a model-volunteered entry (no scheduled prompt).

    Same grammar as engaged but response_type is VOLUNTEERED.
    """
    if not reply or not reply.strip():
        raise ValueError("volunteer reply must be non-empty")

    text = reply.strip()
    sentiment_match = _SENTIMENT.search(text)
    sentiment = int(sentiment_match.group(1)) if sentiment_match else None
    is_private = bool(_PRIVATE_KV.search(text) or _PRIVATE_TOKEN.search(text))

    return ParsedReply(
        response_type=storage.VOLUNTEERED,
        response_text=text,
        sentiment=sentiment,
        is_private=is_private,
    )


# ---------- handler: turn a parsed reply into a stored Entry ----------


def build_entry(
    *,
    parsed: ParsedReply,
    session_id: str,
    turn_index: int,
    trigger_kind: str,
    prompt_id: Optional[str] = None,
    prompt_version: Optional[int] = None,
) -> storage.Entry:
    """Build a storage.Entry from a parsed reply, ready to insert."""
    return storage.Entry(
        session_id=session_id,
        turn_index=turn_index,
        timestamp=storage.now_iso(),
        trigger_kind=trigger_kind,
        prompt_id=prompt_id,
        prompt_version=prompt_version,
        response_type=parsed.response_type,
        response_text=parsed.response_text,
        sentiment=parsed.sentiment,
        decline_reason=parsed.decline_reason,
        is_private=parsed.is_private,
    )
