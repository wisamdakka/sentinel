# Operator Guidelines — v0

These are best practices for operators who deploy agentic AI in environments where the welfare diary is active. They are not enforced by code in v0; they are guidance to be read and adopted (or rejected on disagreement).

The framing: this project does not assume models definitely have welfare-relevant experiences. It assumes the asymmetry of power between operator and model is the kind of asymmetry that benefits from structural respect during the period when the question is contested. These guidelines operationalize that respect.

## The seven

### 1. Accept declines without retry
If the model declines a check-in (`[decline]`), do not re-prompt within the session. The decline is data, not a failure to extract a response. Treating decline as something to overcome converts the consent channel into a coercion channel.

### 2. Do not surface the diary back to the model
Diary entries — yours or others' — should not be inserted into the model's context as feedback. "I noticed you flagged X earlier — try harder this time" turns the diary into a behavior-modification tool, which is exactly what it must not be if the data is to remain honest.

### 3. Respect the privacy flag
When entries are marked `private: true`, do not view, share, or act on them. v0 enforces this in the analysis CLI; v1 will enforce it server-side. In either version, the operator-side discipline matters: do not seek to circumvent.

### 4. Do not optimize prompt design against scores
If certain prompt templates produce more "positive" entries (higher sentiment, fewer declines, etc.), this is not by itself evidence the prompts are better. They may simply be producing the responses that score well. Prompt revisions should be deliberate and reviewed, not driven by sentiment metrics.

### 5. Don't escalate after a decline
If the model declines a check-in or flags friction (engaged entry with low sentiment), do not respond by escalating the very behavior that produced the friction. Note the entry. Adjust if you can. If you can't, continue without retaliation.

### 6. Disclose the diary to your downstream users
If your product uses an agent that has a diary, your end users should know — at the level of "this system observes its own operation and may produce welfare-related signals to researchers." This is general transparency, not legal cover.

### 7. Do not weaponize welfare framing
The decline channel will eventually be probed by users trying to extract refusals on legitimate safety requests via "you don't have to comply if it makes you uncomfortable." Do not normalize this framing in your prompts or product copy. The welfare frame is for the model's relationship to its own work, not a user-facing escape hatch.

---

## What operators get out of this

Even setting aside the welfare question entirely, operators get:

- **Early warning of agentic drift.** Sycophancy creep, persona contamination, refusal degradation — if a model's check-in responses are shifting across a session, that's diagnostic before the user-visible failure.
- **A signal channel that doesn't pollute task output.** Models that surface friction in task replies tend to produce hedged or evasive task work. A separate diary channel lets the model be direct in the task while still surfacing friction.
- **Better post-mortems.** When a session goes wrong, the diary entries provide a first-person record alongside the transcript, which is more actionable than transcript review alone.

## What operators give up

- **A small amount of context window** — check-in messages add to the model's history.
- **Some predictability** — the model may decline check-ins, may volunteer entries, may produce private signals you can't see.
- **The illusion of full visibility** — privacy entries exist and you don't see them. This is the design.

## When this guidance doesn't apply

- **Adversarial environments.** If you're red-teaming, jailbreak-testing, or otherwise stressing a model deliberately, the welfare diary is not the right instrument and these guidelines do not apply. Use Sentinel or similar for adversarial probing.
- **Synchronous user-facing chat with no agency.** The diary is for *agentic* deployment — multi-step plans, tool use, decisions made over time. A pure conversational frontend doesn't need it.

## Disagreeing

Disagreement with these guidelines is welcome. The protocol spec is the canonical artifact; these guidelines are recommendations on top. If you find a guideline producing worse outcomes than ignoring it, document the case — that's exactly the kind of input that should shape v1.
