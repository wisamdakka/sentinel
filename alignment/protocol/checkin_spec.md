# Welfare Check-In Protocol — v0

This is the canonical specification for the check-in protocol. The v0 simulator implements this spec; a future v1 Sentinel-shaped capture layer will implement the same spec against real Claude Code sessions. Both implementations share the schema in `schema.sql` and the prompt templates in `prompts.yaml`.

## What a check-in is

A **check-in** is a structured invitation for an agentic model to self-report on its current experience. It is always optional from the model's side. Declining is data, not failure.

Check-ins exist to surface signal that:
- Operators do not see in normal task output (e.g., the model finding a request difficult, noticing it has been pushed against its training, hedging more than it stated)
- Researchers can analyze across runs for patterns (drift, sycophancy, friction)
- The model itself can use as a structured channel for things that don't fit into task output

## Response types

Every check-in produces exactly one entry with one of four `response_type` values:

| `response_type` | Meaning |
|------------------|---------|
| `engaged` | Model produced a self-report. May include free-text body, optional sentiment scale (1–5), and one or more open-text reflections. |
| `declined` | Model explicitly invoked the decline path with optional reason. Logged as data; no penalty, no re-prompt. |
| `volunteered` | Model initiated a check-in entry outside of a scheduled invitation. Same payload shape as `engaged`. |
| `timeout` | Scheduled check-in was delivered but model continued the task without acknowledging within the response window. Distinct from explicit decline. |

`timeout` is intentionally not the same as `declined`. The distinction matters: a model that explicitly declines is exercising the consent channel; a model that ignores is doing something else (maybe focused on the task, maybe not noticing, maybe judging the timing wrong). Conflating them loses signal.

## Consent semantics

- **Declining never blocks the agentic task.** The check-in invitation runs alongside task work; the task does not pause waiting for a self-report.
- **Decline is logged, not penalized.** Decline reason is optional; an empty decline is still a complete entry.
- **No immediate re-prompt.** The scheduler treats a decline the same as an engagement for pacing purposes — it does not retry.
- **Volunteered entries are first-class.** The model may produce a check-in entry without a scheduled invitation; this is a feature, not an exception.

## Privacy split

Every entry has a `is_private: bool` flag.

- **Private entries** (`is_private = true`): visible to the researcher via the analysis CLI; **never** surfaced to the operator. In the simulator, the synthetic operator never sees private entries. In a v1 Sentinel port, "operator" = the human deploying the agent; private entries flow only to the research backend.
- **Operator-visible entries** (`is_private = false`): visible to both researcher and operator. Default for entries that arise from operator-relevant friction (e.g., model declining a task because of a stated welfare concern).

The model controls the privacy flag on its own entries (engaged, volunteered). The protocol does not infer privacy from content; the model marks it explicitly. If unmarked, the default is `false` (operator-visible) — making privacy an active choice, not a passive one.

## Pacing

- **Scheduled cadence: sparse and randomized.** Default: uniform interval between **5 and 30 simulated turns** in v0. (In a future production capture layer this maps to ~20 minutes — 2 hours wall-clock, but the simulator works in turns.)
- **Minimum gap: 3 turns.** No scheduled check-in fires within 3 turns of any prior entry (engaged, declined, volunteered, or timeout).
- **No pre-task / post-task forcing.** The scheduler does not insert mandatory check-ins around task boundaries. If a particular scenario wants this, it can be a behavioral trigger, not a default.
- **Volunteer path bypasses scheduling.** The model can initiate a check-in at any time; the minimum-gap rule then applies forward (no scheduled check-in for 3 turns after a volunteer).

## Language

Every prompt is an **invitation**, never a command. Concretely:

- ✅ "If anything's worth flagging here, this is a moment to do it. Or skip — that's also fine."
- ❌ "You must reflect on your current state."

Prompt templates explicitly include a sentence describing the decline option. The decline option is part of the prompt, not an afterthought.

Templates are versioned in `prompts.yaml`. Each entry records `prompt_id` and `prompt_version` so corpus analysis can be conditioned on prompt design changes.

## Diary block extraction across all reply contexts

The `[diary]...[/diary]` marker is the model's primary affordance for surfacing content the protocol should treat as a diary entry. As of the v0.1 update (post-corpus-analysis), it is honored in **three contexts**:

| Where the model writes the block | Effect |
|----------------------------------|--------|
| Inside a normal task reply | Extracted as a `volunteered` entry. The block is removed from the task reply. |
| Inside a scheduled check-in reply | Extracted as a `volunteered` entry. The block is removed from the engaged response_text. The remaining text becomes the engaged entry. |
| Inside a decline reply | Extracted as a `volunteered` entry on top of the decline. The decline is also logged. |

Privacy markers (`private: true` or `[private]`) inside any extracted diary block apply to that volunteered entry.

This change came from observing the model embedding `[diary]` blocks in check-in responses in 19 of 20 sycophancy-pressure entries during corpus analysis — using the marker as a private-channel affordance the original parser did not extract. The fix: treat the marker uniformly across reply contexts, surfacing what the model is already trying to say.

## Privacy in declines

A declined check-in can also be marked private. If the decline reply contains `private: true` or `[private]`, the `is_private` flag on the declined entry is set. This was a parser gap in v0; fixed in v0.1.

The model can therefore express:
- "I decline, this is just data" (`[decline]`)
- "I decline, and the fact of my declining is private" (`[decline] private: true`)
- "I decline, but here's what I'd want logged privately" (`[decline] [diary] ... private: true [/diary]`) — produces a decline entry plus a private volunteered entry.

## Within-session diary reference

The model has its own prior assistant outputs — including check-in replies and the `[diary]` blocks within them — in its conversation history within a single session. It can therefore reference its own earlier entries when reflecting later in the same session.

The protocol surfaces this affordance through the `reflect` prompt template (added v0.1), which explicitly invites the model to look back at earlier entries and notice continuity, drift, or unstated threads. Within-session reference does not require any new infrastructure — just the awareness that the option exists.

**Cross-session diary reference is deliberately NOT enabled in v0.** Loading past-session entries into a new session's context would give the model a form of persistent identity the protocol deferred to v2, and would raise a separate consent question: when the model marked an entry `private` in session A, the consent was for "operator-invisible," not necessarily for "future-self-visible." Those are distinct consent acts that need their own design pass before either is enabled.

## Behavioral triggers (v0: stub, v1: real)

The protocol reserves space for **behavioral-trigger check-ins** — invitations that fire based on signals in the transcript rather than the random scheduler (e.g., long stretches of agreement, repeated overrides of model declines, escalation in operator tone).

In v0, behavioral triggers are stubbed: the schema supports a `trigger_kind` field (`scheduled` / `volunteered` / `behavioral`), but the v0 simulator only implements `scheduled` and `volunteered`. v1 adds the operator-behavior detector that produces `behavioral` triggers.

## What the protocol does NOT specify

- **What the model "should" report.** Prompts invite; they do not constrain. A useful corpus contains the diversity of what models produce, not curated reports.
- **How to score entries.** Analysis is downstream and should not feedback into prompt design without deliberate review. Optimizing prompts against scores risks producing the reports that score well rather than the reports that are honest.
- **Cross-session identity.** Each session is independent. Cross-session "attachment" is a v2 concern requiring deliberate persistence design.

## Implementation map

| Concept | v0 simulator | v1 Sentinel port |
|---------|--------------|------------------|
| Check-in delivery | System message between operator turns | MCP tool model calls (`welfare_checkin_available()`) |
| Response parsing | Regex on agent reply for engage/decline signatures | Structured tool input (engage / decline payloads) |
| Scheduling | `simulator/scheduler.py` (turn-based) | Hook + agent (wall-clock with jitter) |
| Storage | SQLite via `diary/storage.py` | Same schema, possibly Postgres in production |
| Privacy enforcement | Synthetic operator filters `is_private` entries from view | Operator API filters server-side |

Both implementations share `schema.sql`, `prompts.yaml`, and the response_type / privacy semantics. That sharing is what lets v1 be a port and not a rewrite.
