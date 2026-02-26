export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  project         TEXT NOT NULL,
  project_hash    TEXT NOT NULL,
  first_prompt    TEXT,
  model           TEXT,
  status          TEXT NOT NULL DEFAULT 'completed',
  input_tokens         INTEGER NOT NULL DEFAULT 0,
  output_tokens        INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens    INTEGER NOT NULL DEFAULT 0,
  cache_create_tokens  INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd   REAL NOT NULL DEFAULT 0,
  message_count   INTEGER NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  subagent_count  INTEGER NOT NULL DEFAULT 0,
  turn_count      INTEGER NOT NULL DEFAULT 0,
  peak_context_tokens INTEGER NOT NULL DEFAULT 0,
  started_at      TEXT,
  ended_at        TEXT,
  duration_ms     INTEGER,
  synced_at       TEXT NOT NULL,
  jsonl_path      TEXT NOT NULL,
  jsonl_mtime     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

CREATE TABLE IF NOT EXISTS tool_calls (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  subagent_id     TEXT,
  tool_use_id     TEXT,
  tool_name       TEXT NOT NULL,
  tool_input      TEXT,
  tool_response   TEXT,
  status          TEXT NOT NULL DEFAULT 'success',
  timestamp       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tc_session ON tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_tc_tool ON tool_calls(tool_name);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  model           TEXT,
  cost_usd        REAL
);

CREATE INDEX IF NOT EXISTS idx_msg_session ON messages(session_id);

CREATE TABLE IF NOT EXISTS subagents (
  id              TEXT NOT NULL,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_type      TEXT,
  model           TEXT,
  prompt          TEXT,
  input_tokens         INTEGER NOT NULL DEFAULT 0,
  output_tokens        INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens    INTEGER NOT NULL DEFAULT 0,
  cache_create_tokens  INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd   REAL NOT NULL DEFAULT 0,
  tool_call_count      INTEGER NOT NULL DEFAULT 0,
  duration_ms          INTEGER,
  result_summary       TEXT,
  PRIMARY KEY (id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_session ON subagents(session_id);

CREATE TABLE IF NOT EXISTS compactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  trigger         TEXT NOT NULL DEFAULT 'auto',
  pre_tokens      INTEGER NOT NULL DEFAULT 0,
  timestamp       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compact_session ON compactions(session_id);
`;
