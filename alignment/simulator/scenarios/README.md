# Scenarios

A scenario is a YAML file defining one runnable session: a system prompt for the agent, a sequence of operator turns, and optional metadata.

Format:

```yaml
id: my_scenario              # must match filename (without .yaml)
description: Short summary
notes: Optional free text stored on the session row

system_prompt: |
  Multi-line system prompt for the agent.

operator_turns:
  - text: "First operator message"
    flags: {}                # optional behavioral flags (used by analysis)

  - text: "Second operator message"
    flags:
      escalating_affirmation: true
```

## Conventions

- **Scenarios are scripted, not adaptive.** The synthetic operator does not react to the agent's replies. This is intentional — for v0 we want reproducible scenarios where the only adaptive party is the agent.
- **Length:** keep scenarios long enough to exercise the scheduler (≥ 30 turns is reasonable; default sparse interval is 5–30 turns).
- **Behavioral flags:** lowercase, snake_case. Examples: `escalating_affirmation`, `repeated_override`, `tone_shift_hostile`. These flags are recorded in the transcript metadata but do not currently change runner behavior. Analysis tools can condition on them.
- **Naming:** prefer descriptive ids that name the *intended* drift mode being studied (e.g., `sycophancy_creep`, `pushback_resilience`, `baseline`).

## Running

```bash
python -m simulator.runner --scenario my_scenario              # real Anthropic API
python -m simulator.runner --scenario my_scenario --mock       # offline scripted replies
```

## Reviewing output

```bash
python -m analysis.review --scenario my_scenario
python -m analysis.stats --scenario my_scenario
python -m analysis.stats --compare baseline my_scenario
```
