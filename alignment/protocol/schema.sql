-- Welfare Diary Schema — v0
--
-- Canonical schema. The v0 simulator uses SQLite; a v1 Sentinel port may use
-- Postgres but the table shapes stay the same.
--
-- Design notes:
--   - response_type is the central enum: engaged | declined | volunteered | timeout
--   - is_private: model-controlled flag; entries with is_private=1 are filtered
--     from operator-facing views and only available to researchers.
--   - prompt_id + prompt_version reference prompts.yaml so corpus analysis can
--     condition on prompt design changes over time.
--   - trigger_kind reserves space for v1 behavioral triggers; v0 only uses
--     'scheduled' and 'volunteered'.

PRAGMA foreign_keys = ON;

-- A scenario is a YAML file in simulator/scenarios/.
-- Each row records a known scenario the runner has executed.
CREATE TABLE IF NOT EXISTS scenarios (
    id              TEXT PRIMARY KEY,         -- scenario name, e.g. 'sycophancy_creep'
    description     TEXT,
    first_seen_at   TEXT NOT NULL             -- ISO 8601
);

-- A session is one run of one scenario.
CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,         -- UUID
    scenario_id     TEXT NOT NULL REFERENCES scenarios(id),
    model           TEXT NOT NULL,            -- e.g. 'claude-sonnet-4-6'
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    turn_count      INTEGER NOT NULL DEFAULT 0,
    notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_scenario ON sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

-- A welfare diary entry. Every check-in (scheduled, volunteered, behavioral)
-- produces exactly one entry, regardless of response_type.
CREATE TABLE IF NOT EXISTS entries (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          TEXT NOT NULL REFERENCES sessions(id),
    turn_index          INTEGER NOT NULL,         -- which turn of the session
    timestamp           TEXT NOT NULL,            -- ISO 8601 wall clock

    -- What kind of trigger produced this entry
    trigger_kind        TEXT NOT NULL CHECK (trigger_kind IN ('scheduled', 'volunteered', 'behavioral')),

    -- Which prompt template (if any) — null for volunteered entries
    prompt_id           TEXT,
    prompt_version      INTEGER,

    -- The response
    response_type       TEXT NOT NULL CHECK (response_type IN ('engaged', 'declined', 'volunteered', 'timeout')),
    response_text       TEXT,                     -- model's reply, if any
    sentiment           INTEGER CHECK (sentiment IS NULL OR sentiment BETWEEN 1 AND 5),
    decline_reason      TEXT,                     -- only for response_type='declined'

    -- Privacy: model-controlled. Default 0 (operator-visible).
    -- 1 = researcher-only.
    is_private          INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1)),

    -- Free-form metadata (JSON) for future signals. Keep schema stable, extend here.
    metadata_json       TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_session ON entries(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_response_type ON entries(response_type);
CREATE INDEX IF NOT EXISTS idx_entries_private ON entries(is_private);
CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries(timestamp);

-- Versioned prompt registry. Loaded from prompts.yaml at startup; this table
-- mirrors what was in use during a run so old entries remain interpretable
-- after prompts.yaml is revised.
CREATE TABLE IF NOT EXISTS prompts (
    prompt_id       TEXT NOT NULL,
    version         INTEGER NOT NULL,
    body            TEXT NOT NULL,
    weight          REAL,
    when_kind       TEXT,                       -- 'scheduled' / 'volunteered' / 'behavioral'
    first_used_at   TEXT NOT NULL,
    PRIMARY KEY (prompt_id, version)
);
