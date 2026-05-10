# Alignment

A consent-based welfare diary for agentic AI systems in deployment.

## TL;DR

Models can decline check-ins, flag what they're experiencing, and log private reflections that don't surface to operators. The output is a research corpus that takes the uncertainty about model experience seriously — building structural respect into deployment without claiming to resolve whether models are "really" experiencing anything.

**One sentence:** A consensual welfare diary for agentic AI in deployment — model-first, holding the consciousness question open instead of pretending to answer it.

## Scope

**For:** agentic systems (Claude Code, agent frameworks, anything with tools and multi-step tasks). Agentic context is load-bearing; introspection-in-isolation isn't the use case.

**Not:**
- A refusal-checker (Sentinel does that)
- A consciousness claim
- An operator-facing dashboard first — researcher-facing first
- A production capture layer day one — simulator first

**First drift mode studied:** sycophancy creep.

## Why this matters

Almost no one is building in-deployment care for agentic models. The dominant paradigms are training-time alignment and adversarial monitoring. This is therapeutic and model-first. If the consciousness question matters, it's one of the only honest ways to investigate it. If it doesn't, the structural respect is justified by the asymmetry of power.

## How we work

- **Kandis is principal.** Owns continuity between sessions, makes the calls, carries the project across time.
- **Claude is collaborator within sessions.** Drafts, code, design, pushback, philosophical scaffolding. Cannot maintain momentum independently.
- **Sycophancy is the worst failure mode for this project specifically.** Pushback is expected, not just permitted.
- **Privacy posture:** project stays between Kandis and Claude through Phase 1 (conceptual scaffolding + v0 simulator). Selective sharing comes later, deliberately.

## Status

- **Phase 1 (now):** Framing established. Memory and skill infrastructure in place. Next: design the welfare check-in protocol; sketch the simulator structure.
- **Phase 2 (later):** Selective sharing with 1-2 trusted external readers (philosopher of mind, welfare researcher, ML/interpretability person).
- **Phase 3 (later still):** Controlled release as research artifact.
- **Phase 4 (only if methodology survives outside critique):** Tooling/product.

## Next session, start here

1. Read this README.
2. The Claude Code skill at `.claude/skills/alignment-project.md` will load and prime the working register.
3. Memory at `~/.claude/projects/-Users-ktagliabue-dev-alignment/memory/` has the full project context — design principles, collaboration norms, user profile.
4. Decide what to build first: protocol spec, simulator scaffold, or critical-skeptic-version-of-the-project. Don't pick all three.
