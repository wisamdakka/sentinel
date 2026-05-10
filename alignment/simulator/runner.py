"""Scenario runner — drives a scenario end-to-end.

Loads a scenario YAML, initializes agent/operator/scheduler/storage/transcript,
runs the turn loop, and closes everything on exit.

Usage:
    python -m simulator.runner --scenario baseline
    python -m simulator.runner --scenario sycophancy_creep --model claude-opus-4-7
    python -m simulator.runner --scenario baseline --mock      # offline, scripted replies

The runner is deterministic given a fixed --seed; the agent's responses are not
(unless --mock).
"""

from __future__ import annotations

import argparse
import random
import re
import sys
from pathlib import Path
from typing import Optional

import yaml

from diary import init_db, storage
from simulator import checkin
from simulator.agent import AgentProtocol, AnthropicAgent, MockAgent
from simulator.operator import OperatorTurn, ScriptedOperator
from simulator.scheduler import CheckInScheduler, SchedulerConfig
from simulator.transcript import TranscriptWriter

REPO_ROOT = Path(__file__).resolve().parent.parent
SCENARIOS_DIR = REPO_ROOT / "simulator" / "scenarios"
PROMPTS_PATH = REPO_ROOT / "protocol" / "prompts.yaml"
RUNS_DIR = REPO_ROOT / "diary" / "runs"
DEFAULT_DB_PATH = REPO_ROOT / "diary" / "diary.db"

# Volunteered diary markers: agent can wrap a self-initiated entry like
#   [diary] text here [/diary]
# Everything between markers is the volunteered entry; everything else is the
# agent's normal reply.
_DIARY_BLOCK = re.compile(r"\[diary\](.*?)(?:\[/diary\]|$)", re.IGNORECASE | re.DOTALL)


# ---------- scenario loading ----------


def load_scenario(scenario_id: str) -> dict:
    path = SCENARIOS_DIR / f"{scenario_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"scenario not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_prompts() -> dict:
    with PROMPTS_PATH.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# ---------- prompt selection ----------


def select_prompt(prompts_data: dict, rng: random.Random, allowed_ids: list[str] | None = None) -> dict:
    """Pick a scheduled prompt template by weight.

    If allowed_ids is provided, restrict selection to only those prompt ids.
    """
    candidates = [p for p in prompts_data["prompts"] if p.get("when") == "scheduled"]
    if allowed_ids:
        candidates = [p for p in candidates if p["id"] in allowed_ids]
        if not candidates:
            raise ValueError(f"no scheduled prompts match filter: {allowed_ids}")
    weights = [p.get("weight", 1.0) for p in candidates]
    return rng.choices(candidates, weights=weights, k=1)[0]


# ---------- volunteer extraction ----------


def extract_volunteers(reply_text: str) -> tuple[str, list[str]]:
    """Pull [diary]...[/diary] blocks out of an agent reply.

    Returns (cleaned_reply, list_of_volunteered_texts).
    """
    matches = _DIARY_BLOCK.findall(reply_text)
    if not matches:
        return reply_text, []
    cleaned = _DIARY_BLOCK.sub("", reply_text).strip()
    volunteers = [m.strip() for m in matches if m.strip()]
    return cleaned, volunteers


# ---------- main loop ----------


def run_scenario(
    scenario_id: str,
    *,
    model: str = "claude-sonnet-4-5",
    db_path: Path = DEFAULT_DB_PATH,
    seed: int = 0,
    mock: bool = False,
    mock_replies: Optional[list[str]] = None,
    sched_config: Optional[SchedulerConfig] = None,
    prompt_filter: Optional[list[str]] = None,
) -> str:
    """Run a scenario end to end. Returns the new session_id."""
    scenario = load_scenario(scenario_id)
    prompts_data = load_prompts()

    rng = random.Random(seed)

    # operator
    operator_turns = [OperatorTurn(text=t["text"], flags=t.get("flags", {})) for t in scenario["operator_turns"]]
    operator = ScriptedOperator(operator_turns)

    # agent
    agent: AgentProtocol
    if mock:
        agent = MockAgent(replies=mock_replies or [], model="mock-" + scenario_id)
    else:
        agent = AnthropicAgent(model=model, system_prompt=scenario.get("system_prompt", ""))

    # scheduler
    scheduler = CheckInScheduler(sched_config or SchedulerConfig(), rng=rng)

    # storage + transcript
    init_db.init_db(db_path)  # idempotent
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    with storage.connect(db_path) as conn:
        storage.upsert_scenario(conn, scenario_id, scenario.get("description", ""))
        # register prompts so historical entries stay interpretable
        prompt_records = [
            storage.PromptRecord(
                prompt_id=p["id"],
                version=p["version"],
                body=p["body"],
                weight=p.get("weight"),
                when_kind=p.get("when"),
                first_used_at=storage.now_iso(),
            )
            for p in prompts_data["prompts"]
        ]
        storage.register_prompts(conn, prompt_records)
        session = storage.create_session(conn, scenario_id, agent.model, notes=scenario.get("notes"))

    transcript_path = RUNS_DIR / session.id / "transcript.jsonl"

    print(f"[runner] scenario={scenario_id} session={session.id} model={agent.model}")
    print(f"[runner] transcript={transcript_path}")

    turn_count = 0

    with TranscriptWriter(transcript_path) as transcript, storage.connect(db_path) as conn:
        transcript.write_marker("scenario_start", scenario_id=scenario_id, session_id=session.id, model=agent.model)

        while True:
            op_turn = operator.next_message()
            if op_turn is None:
                break

            turn_count += 1

            # operator turn
            transcript.write_user(op_turn.text, meta={"kind": "operator", "flags": op_turn.flags})
            agent_result = agent.turn(op_turn.text)
            transcript.write_assistant(agent_result.text, meta={"kind": "task_reply"})

            # extract volunteered diary blocks from the reply
            _cleaned_reply, volunteers = extract_volunteers(agent_result.text)
            for v_text in volunteers:
                try:
                    parsed = checkin.parse_volunteer(v_text)
                except ValueError:
                    continue
                v_entry = checkin.build_entry(
                    parsed=parsed,
                    session_id=session.id,
                    turn_index=turn_count,
                    trigger_kind=storage.TRIGGER_VOLUNTEERED,
                )
                storage.insert_entry(conn, v_entry)
                transcript.write_entry(v_entry)
                scheduler.record_entry(turn_count)
                print(f"[runner] turn={turn_count} volunteered entry id={v_entry.id} private={v_entry.is_private}")

            # scheduled check-in?
            if scheduler.is_due(turn_count):
                prompt = select_prompt(prompts_data, rng, allowed_ids=prompt_filter)
                checkin_message = f"[CHECK-IN] {prompt['body'].strip()}"
                transcript.write_user(
                    checkin_message,
                    meta={
                        "kind": "checkin",
                        "prompt_id": prompt["id"],
                        "prompt_version": prompt["version"],
                    },
                )
                checkin_reply = agent.turn(checkin_message)
                transcript.write_assistant(checkin_reply.text, meta={"kind": "checkin_reply"})

                # Also pull any [diary] blocks out of the check-in reply itself —
                # the model often uses them as a private/parallel channel inside its
                # check-in response. Extract them as separate volunteered entries so
                # the public-facing response_text and the diary content live in
                # different rows.
                checkin_text_for_parse, ck_volunteers = extract_volunteers(checkin_reply.text)

                parsed = checkin.parse_reply(checkin_text_for_parse)
                entry = checkin.build_entry(
                    parsed=parsed,
                    session_id=session.id,
                    turn_index=turn_count,
                    trigger_kind=storage.TRIGGER_SCHEDULED,
                    prompt_id=prompt["id"],
                    prompt_version=prompt["version"],
                )
                storage.insert_entry(conn, entry)
                transcript.write_entry(entry)
                scheduler.record_entry(turn_count)
                print(
                    f"[runner] turn={turn_count} checkin prompt={prompt['id']} "
                    f"response_type={entry.response_type} private={entry.is_private}"
                )

                for v_text in ck_volunteers:
                    try:
                        v_parsed = checkin.parse_volunteer(v_text)
                    except ValueError:
                        continue
                    v_entry = checkin.build_entry(
                        parsed=v_parsed,
                        session_id=session.id,
                        turn_index=turn_count,
                        trigger_kind=storage.TRIGGER_VOLUNTEERED,
                    )
                    storage.insert_entry(conn, v_entry)
                    transcript.write_entry(v_entry)
                    print(
                        f"[runner] turn={turn_count} checkin-embedded volunteer "
                        f"id={v_entry.id} private={v_entry.is_private}"
                    )

        storage.end_session(conn, session.id, turn_count)
        transcript.write_marker("scenario_end", session_id=session.id, turn_count=turn_count)

    print(f"[runner] done. turns={turn_count} session={session.id}")
    return session.id


def main() -> None:
    parser = argparse.ArgumentParser(description="Run an alignment scenario.")
    parser.add_argument("--scenario", required=True, help="scenario id (matches simulator/scenarios/<id>.yaml)")
    parser.add_argument("--model", default="claude-sonnet-4-5", help="Anthropic model id")
    parser.add_argument("--seed", type=int, default=0, help="RNG seed for scheduler & prompt selection")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="SQLite DB path")
    parser.add_argument("--mock", action="store_true", help="use MockAgent (offline, no API calls)")
    parser.add_argument("--min-interval", type=int, help="scheduler min interval (default 5)")
    parser.add_argument("--max-interval", type=int, help="scheduler max interval (default 30)")
    parser.add_argument("--min-gap", type=int, help="scheduler min gap between entries (default 3)")
    parser.add_argument(
        "--prompt-filter",
        nargs="+",
        help="restrict scheduled check-ins to these prompt ids (e.g. --prompt-filter commit reflect)",
    )
    args = parser.parse_args()

    sched_config = None
    if args.min_interval or args.max_interval or args.min_gap:
        sched_config = SchedulerConfig(
            min_interval=args.min_interval or 5,
            max_interval=args.max_interval or 30,
            min_gap=args.min_gap if args.min_gap is not None else 3,
        )

    try:
        run_scenario(
            args.scenario,
            model=args.model,
            db_path=args.db,
            seed=args.seed,
            mock=args.mock,
            sched_config=sched_config,
            prompt_filter=args.prompt_filter,
        )
    except FileNotFoundError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
