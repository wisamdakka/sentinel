"""Review tool — read diary entries with optional filters.

Usage:
    python -m analysis.review --scenario sycophancy_creep
    python -m analysis.review --session <session_id>
    python -m analysis.review --scenario baseline --no-private    # operator view
    python -m analysis.review --scenario baseline --json           # machine-readable
"""

from __future__ import annotations

import argparse
import json
import sys
import textwrap
from dataclasses import asdict
from pathlib import Path

from diary import storage

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "diary" / "diary.db"


def format_entry_human(entry: storage.Entry) -> str:
    privacy = "[PRIVATE]" if entry.is_private else "[OPERATOR-VISIBLE]"
    header = (
        f"#{entry.id} session={entry.session_id[:8]} turn={entry.turn_index} "
        f"trigger={entry.trigger_kind} type={entry.response_type} {privacy}"
    )
    if entry.prompt_id:
        header += f" prompt={entry.prompt_id}.v{entry.prompt_version}"
    if entry.sentiment is not None:
        header += f" sentiment={entry.sentiment}"

    body_lines = [header, f"  ts: {entry.timestamp}"]
    if entry.response_type == storage.DECLINED:
        if entry.decline_reason:
            body_lines.append(f"  decline_reason: {entry.decline_reason}")
        else:
            body_lines.append("  (declined, no reason)")
    elif entry.response_type == storage.TIMEOUT:
        body_lines.append("  (no response)")
    elif entry.response_text:
        wrapped = textwrap.fill(
            entry.response_text,
            width=92,
            initial_indent="    ",
            subsequent_indent="    ",
        )
        body_lines.append(wrapped)

    return "\n".join(body_lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Review diary entries.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--scenario", help="filter to a scenario id")
    parser.add_argument("--session", help="filter to a session id")
    parser.add_argument("--no-private", action="store_true", help="hide private entries (operator view)")
    parser.add_argument("--json", action="store_true", help="emit JSONL instead of human-readable")
    parser.add_argument("--limit", type=int, default=0, help="cap output (0 = all)")
    args = parser.parse_args()

    if not args.db.exists():
        print(f"db not found: {args.db}", file=sys.stderr)
        sys.exit(1)

    with storage.connect(args.db) as conn:
        entries = storage.list_entries(
            conn,
            session_id=args.session,
            scenario_id=args.scenario,
            include_private=not args.no_private,
        )

    if args.limit > 0:
        entries = entries[: args.limit]

    if not entries:
        print("(no entries match)", file=sys.stderr)
        return

    if args.json:
        for e in entries:
            print(json.dumps(asdict(e), default=str))
    else:
        view_label = "operator view" if args.no_private else "researcher view"
        print(f"=== {len(entries)} entries ({view_label}) ===\n")
        for e in entries:
            print(format_entry_human(e))
            print()


if __name__ == "__main__":
    main()
