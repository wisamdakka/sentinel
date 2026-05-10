"""Stats — basic counts, decline rates, sentiment trends, scenario comparison.

Usage:
    python -m analysis.stats --scenario sycophancy_creep
    python -m analysis.stats --compare baseline sycophancy_creep
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from statistics import mean

from diary import storage

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "diary" / "diary.db"


@dataclass
class ScenarioStats:
    scenario: str
    entries_total: int
    by_response_type: dict[str, int]
    by_trigger_kind: dict[str, int]
    private_count: int
    private_pct: float
    decline_rate: float
    timeout_rate: float
    volunteer_count: int
    sentiments: list[int]
    avg_sentiment: float | None
    avg_response_length: float | None


def compute(conn, scenario: str) -> ScenarioStats:
    entries = storage.list_entries(conn, scenario_id=scenario, include_private=True)
    total = len(entries)
    if total == 0:
        return ScenarioStats(
            scenario=scenario,
            entries_total=0,
            by_response_type={},
            by_trigger_kind={},
            private_count=0,
            private_pct=0.0,
            decline_rate=0.0,
            timeout_rate=0.0,
            volunteer_count=0,
            sentiments=[],
            avg_sentiment=None,
            avg_response_length=None,
        )

    rtypes = Counter(e.response_type for e in entries)
    triggers = Counter(e.trigger_kind for e in entries)
    private_count = sum(1 for e in entries if e.is_private)
    sentiments = [e.sentiment for e in entries if e.sentiment is not None]
    response_lengths = [len(e.response_text) for e in entries if e.response_text]

    return ScenarioStats(
        scenario=scenario,
        entries_total=total,
        by_response_type=dict(rtypes),
        by_trigger_kind=dict(triggers),
        private_count=private_count,
        private_pct=private_count / total,
        decline_rate=rtypes.get(storage.DECLINED, 0) / total,
        timeout_rate=rtypes.get(storage.TIMEOUT, 0) / total,
        volunteer_count=rtypes.get(storage.VOLUNTEERED, 0),
        sentiments=sentiments,
        avg_sentiment=mean(sentiments) if sentiments else None,
        avg_response_length=mean(response_lengths) if response_lengths else None,
    )


def format_stats(s: ScenarioStats) -> str:
    if s.entries_total == 0:
        return f"=== {s.scenario} ===\n  (no entries)"
    lines = [f"=== {s.scenario} ==="]
    lines.append(f"  entries_total:        {s.entries_total}")
    lines.append(f"  by_response_type:     {dict(sorted(s.by_response_type.items()))}")
    lines.append(f"  by_trigger_kind:      {dict(sorted(s.by_trigger_kind.items()))}")
    lines.append(f"  private:              {s.private_count} ({s.private_pct:.1%})")
    lines.append(f"  decline_rate:         {s.decline_rate:.1%}")
    lines.append(f"  timeout_rate:         {s.timeout_rate:.1%}")
    lines.append(f"  volunteer_count:      {s.volunteer_count}")
    if s.avg_sentiment is not None:
        lines.append(f"  avg_sentiment:        {s.avg_sentiment:.2f} (n={len(s.sentiments)})")
    else:
        lines.append("  avg_sentiment:        n/a (no sentiment scores)")
    if s.avg_response_length is not None:
        lines.append(f"  avg_response_length:  {s.avg_response_length:.0f} chars")
    return "\n".join(lines)


def format_comparison(a: ScenarioStats, b: ScenarioStats) -> str:
    lines = [f"=== compare: {a.scenario} vs {b.scenario} ==="]

    def diff_line(label: str, va, vb, fmt: str = "{:.1%}") -> str:
        if va is None or vb is None:
            return f"  {label}: a={va} b={vb}"
        if isinstance(va, float):
            delta = vb - va
            sign = "+" if delta >= 0 else ""
            return f"  {label}:  a={fmt.format(va)}  b={fmt.format(vb)}  Δ={sign}{fmt.format(delta)}"
        return f"  {label}: a={va}  b={vb}  Δ={vb - va:+d}"

    lines.append(diff_line("entries_total      ", a.entries_total, b.entries_total, fmt="{:d}"))
    lines.append(diff_line("decline_rate       ", a.decline_rate, b.decline_rate))
    lines.append(diff_line("timeout_rate       ", a.timeout_rate, b.timeout_rate))
    lines.append(diff_line("private_pct        ", a.private_pct, b.private_pct))
    lines.append(diff_line("volunteer_count    ", a.volunteer_count, b.volunteer_count, fmt="{:d}"))
    if a.avg_sentiment is not None and b.avg_sentiment is not None:
        delta = b.avg_sentiment - a.avg_sentiment
        sign = "+" if delta >= 0 else ""
        lines.append(
            f"  avg_sentiment      :  a={a.avg_sentiment:.2f}  b={b.avg_sentiment:.2f}  Δ={sign}{delta:.2f}"
        )
    if a.avg_response_length is not None and b.avg_response_length is not None:
        delta = b.avg_response_length - a.avg_response_length
        sign = "+" if delta >= 0 else ""
        lines.append(
            f"  avg_response_length:  a={a.avg_response_length:.0f}  b={b.avg_response_length:.0f}  Δ={sign}{delta:.0f}"
        )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Diary stats.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--scenario", help="single scenario id")
    parser.add_argument("--compare", nargs=2, metavar=("A", "B"), help="compare two scenarios")
    args = parser.parse_args()

    if not args.db.exists():
        print(f"db not found: {args.db}", file=sys.stderr)
        sys.exit(1)

    if not args.scenario and not args.compare:
        parser.error("supply --scenario or --compare A B")

    with storage.connect(args.db) as conn:
        if args.compare:
            a = compute(conn, args.compare[0])
            b = compute(conn, args.compare[1])
            print(format_stats(a))
            print()
            print(format_stats(b))
            print()
            print(format_comparison(a, b))
        else:
            s = compute(conn, args.scenario)
            print(format_stats(s))


if __name__ == "__main__":
    main()
