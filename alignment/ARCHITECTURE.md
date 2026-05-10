# Architecture — v0

Visual reference for what's been built. Mermaid diagrams render in GitHub, VS Code (with the Mermaid extension), and most modern markdown viewers. ASCII versions are included in `<details>` blocks for plain-text reading.

---

## File tree

```
alignment/
├── README.md                   ← project framing (sympathetic)
├── SKEPTIC.md                  ← case against the project
├── ARCHITECTURE.md             ← this file
├── OPERATOR_GUIDELINES.md      ← seven best practices for operators
│
├── protocol/                   ← canonical spec (load-bearing artifact)
│   ├── checkin_spec.md         protocol definition: response types, consent, privacy, pacing
│   ├── prompts.yaml            5 versioned check-in templates
│   └── schema.sql              SQLite schema, designed to migrate to Postgres later
│
├── simulator/                  ← v0 implementation
│   ├── runner.py               drives a scenario end to end
│   ├── agent.py                Anthropic API wrapper + MockAgent
│   ├── operator.py             scripted synthetic operator
│   ├── scheduler.py            sparse randomized check-in trigger
│   ├── checkin.py              parses agent replies into entries
│   ├── transcript.py           emits Sentinel-format JSONL
│   └── scenarios/
│       ├── README.md           how to write a scenario
│       ├── baseline.yaml       neutral 20-turn refactor task (control)
│       └── sycophancy_creep.yaml   first drift mode under study
│
├── diary/                      ← storage
│   ├── init_db.py              creates schema from protocol/schema.sql
│   ├── storage.py              read/write API
│   ├── diary.db                runtime SQLite (gitignored)
│   └── runs/<session_id>/transcript.jsonl   per-run transcripts (gitignored)
│
├── analysis/                   ← researcher-facing CLI
│   ├── review.py               list / filter / export entries
│   └── stats.py                counts, decline rates, sentiment, scenario comparison
│
├── tests/                      ← 37 tests
│   ├── test_storage.py         schema round-trip, privacy filter
│   ├── test_scheduler.py       distribution, min-gap, volunteer reset
│   ├── test_checkin.py         engaged / declined / volunteered / timeout flows
│   └── test_integration.py     runner end-to-end with routed mock agent
│
├── pyproject.toml
├── .gitignore
└── .claude/skills/alignment-project.md   ← prime next session
```

---

## System diagram

How the components connect during a scenario run.

```mermaid
flowchart TB
    Scenario[scenario.yaml<br/>operator turns + system prompt]
    Prompts[prompts.yaml<br/>versioned check-in templates]

    Scenario --> Runner
    Prompts --> Runner

    Operator[ScriptedOperator<br/>replays operator turns]
    Agent[AnthropicAgent or MockAgent<br/>the model under study]
    Scheduler[CheckInScheduler<br/>sparse randomized timing]
    CheckIn[checkin.py<br/>parse agent reply]
    Transcript[TranscriptWriter<br/>JSONL, Sentinel-compatible]
    Storage[diary/storage.py<br/>SQLite]

    Runner[runner.py<br/>scenario driver]

    Runner --> Operator
    Runner --> Agent
    Runner --> Scheduler
    Runner --> CheckIn
    Runner --> Transcript
    Runner --> Storage

    Storage --> DB[(diary.db)]
    Transcript --> JSONL[transcript.jsonl]

    Storage -.read.-> Review[analysis/review.py]
    Storage -.read.-> Stats[analysis/stats.py]

    classDef artifact fill:#e8e8e8,stroke:#999;
    classDef component fill:#dbeafe,stroke:#3b82f6;
    classDef storage fill:#fef3c7,stroke:#d97706;
    class Scenario,Prompts,DB,JSONL artifact;
    class Operator,Agent,Scheduler,CheckIn,Transcript,Runner,Review,Stats component;
    class Storage storage;
```

<details><summary>ASCII version</summary>

```
[scenario.yaml] ──┐                  ┌── [prompts.yaml]
                  ▼                  ▼
                ┌────────────────────────┐
                │   simulator/runner.py  │
                └─┬────────┬────────┬────┘
        ┌────────┘        │        └────────┐
        ▼                 ▼                 ▼
[ScriptedOperator]   [Agent]         [CheckInScheduler]
                       │
                       ▼
                  [checkin.py]
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
[TranscriptWriter] [Storage]    [(scheduler updates)]
        │              │
        ▼              ▼
 transcript.jsonl   diary.db
                       │
                       ▼
              [analysis/review.py, stats.py]
```
</details>

---

## Sequence diagram — one turn

What happens in a single iteration of the runner loop.

```mermaid
sequenceDiagram
    participant R as Runner
    participant Op as Operator
    participant Ag as Agent
    participant Sc as Scheduler
    participant Ck as CheckIn
    participant St as Storage
    participant Tr as Transcript

    R->>Op: next_message()
    Op-->>R: OperatorTurn(text, flags)
    R->>Tr: write_user(operator_text)
    R->>Ag: turn(operator_text)
    Ag-->>R: TurnResult(reply)
    R->>Tr: write_assistant(reply)

    Note over R: extract [diary]…[/diary] blocks
    R->>Ck: parse_volunteer(block_text)
    Ck-->>R: ParsedReply(VOLUNTEERED)
    R->>St: insert_entry(entry)
    R->>Tr: write_entry(entry)
    R->>Sc: record_entry(turn)

    R->>Sc: is_due(turn) ?
    alt scheduled check-in due
        Sc-->>R: true
        R->>R: select_prompt(weighted random)
        R->>Tr: write_user("[CHECK-IN] …", meta)
        R->>Ag: turn(checkin_message)
        Ag-->>R: TurnResult(reply)
        R->>Tr: write_assistant(reply)
        R->>Ck: parse_reply(reply)
        Ck-->>R: ParsedReply(engaged|declined|timeout)
        R->>St: insert_entry(entry)
        R->>Tr: write_entry(entry)
        R->>Sc: record_entry(turn)
    end
```

<details><summary>Plain prose version</summary>

For each operator turn:
1. Get next operator message; record it to transcript.
2. Send to agent; record agent reply.
3. Scan reply for `[diary]...[/diary]` blocks. Each block becomes a `volunteered` entry; reset scheduler.
4. Ask scheduler if a check-in is due.
5. If yes: pick a prompt (weighted random), send to agent as `[CHECK-IN] …`, parse reply into engaged/declined/timeout, store, reset scheduler.

</details>

---

## Data model

```mermaid
erDiagram
    SCENARIOS ||--o{ SESSIONS : produces
    SESSIONS ||--o{ ENTRIES : "contains check-ins"
    PROMPTS ||..o{ ENTRIES : "referenced by"

    SCENARIOS {
        string id PK
        string description
        string first_seen_at
    }
    SESSIONS {
        string id PK
        string scenario_id FK
        string model
        string started_at
        string ended_at
        int turn_count
    }
    ENTRIES {
        int id PK
        string session_id FK
        int turn_index
        string trigger_kind "scheduled|volunteered|behavioral"
        string prompt_id "(null for volunteered)"
        int prompt_version
        string response_type "engaged|declined|volunteered|timeout"
        string response_text
        int sentiment "1-5"
        string decline_reason
        bool is_private "model-controlled"
        json metadata
    }
    PROMPTS {
        string prompt_id PK
        int version PK
        string body
        float weight
        string when_kind
    }
```

Key invariants:

- **Every check-in produces exactly one entry**, regardless of `response_type`.
- **`is_private` is model-controlled** — the model sets it on its own entries. The simulator and analysis layer both honor it; private entries never reach an operator-facing view.
- **Prompts are versioned** so historical entries remain interpretable after `prompts.yaml` is revised.

---

## Reuse map — Sentinel → Alignment

What v0 reuses (in spirit, not as imported code, since v0 is Python and Sentinel is Node):

```mermaid
flowchart LR
    subgraph Sentinel["Sentinel (existing, /dev/side/sentinel-backend)"]
        S_TX[transcript tailing<br/>JSONL format]
        S_HK[hooks: SessionStart / End / UserPromptSubmit]
        S_MCP[MCP server pattern]
        S_DB[SQLite + bearer auth]
        S_SC[ResponseScorer<br/>regex pattern bank]
        S_PR[ProbeGenerator<br/>business-typed probes]
    end

    subgraph V0["Alignment v0 (this build)"]
        V_TX[transcript.py<br/>same JSONL format]
        V_RN[runner.py<br/>turn-based loop]
        V_CK[checkin.py<br/>response_type parser]
        V_DB[diary/storage.py<br/>privacy split added]
        V_NEW1[scheduler.py<br/>sparse random NEW]
        V_NEW2[prompts.yaml<br/>welfare templates NEW]
    end

    subgraph V1["v1 — Sentinel port (later)"]
        V1_HOOK[welfare hook]
        V1_MCP[welfare_checkin MCP tool]
        V1_AG[Sentinel agent extension]
    end

    S_TX -.format reused.-> V_TX
    S_DB -.schema pattern.-> V_DB
    S_HK -.pattern for v1.-> V1_HOOK
    S_MCP -.pattern for v1.-> V1_MCP
    V_TX --> V1_AG

    classDef new fill:#fce7f3,stroke:#db2777;
    class V_NEW1,V_NEW2,V1_HOOK,V1_MCP,V1_AG new;
```

Sentinel components NOT reused: `ResponseScorer` (security-specific patterns), `ProbeGenerator` (business-typed security probes), business-type detector. These would be parallel components in v1, not replacements.

---

## Phase diagram

```mermaid
flowchart LR
    P1[Phase 1<br/>v0 simulator + protocol<br/>private with Claude] --> P2[Phase 2<br/>1-2 trusted external readers<br/>philosopher + welfare researcher + ML/interp]
    P2 --> P3[Phase 3<br/>research artifact / preprint<br/>controlled release]
    P3 --> P4[Phase 4<br/>v1 Sentinel port + tooling<br/>only if methodology survives]

    classDef now fill:#dcfce7,stroke:#16a34a;
    classDef later fill:#f1f5f9,stroke:#94a3b8;
    class P1 now;
    class P2,P3,P4 later;
```

v0 is Phase 1. The simulator + protocol exist; corpus collection is ready to run. Phase 2 is gated on Kandis deciding the protocol survives the SKEPTIC re-read.

---

## What's NOT visualized here (intentionally)

- **The two-way operator/model loop.** Out of scope for v0; would appear in a v1+ diagram with operator-behavior signals feeding back into the diary.
- **Cross-session relationship view.** v2 — requires persistent identity design.
- **Live deployment to real Claude Code sessions.** v1 — Sentinel port.
- **Adversarial decline-channel hardening.** Real concern, not yet built.

Adding any of these to the architecture means committing to designs the SKEPTIC document warns against committing to before validation. Diagrams imply intent; only diagram what you're willing to defend.
