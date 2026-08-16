import Database from 'better-sqlite3';
import { DB_PATH, ensureDataDir } from './paths';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  status        TEXT NOT NULL,
  phase         TEXT,
  progress      REAL DEFAULT 0,
  query         TEXT NOT NULL,
  depth         TEXT NOT NULL,
  spec_json     TEXT,
  verdict_json  TEXT,
  usage_json    TEXT,
  error         TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id   TEXT NOT NULL,
  ts       INTEGER NOT NULL,
  seq      INTEGER NOT NULL,
  phase    TEXT,
  agent    TEXT,
  type     TEXT NOT NULL,
  message  TEXT,
  data_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, seq);

-- Evidence store. Every fact an agent asserts should point at an artifact ref.
CREATE TABLE IF NOT EXISTS artifacts (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL,
  ref        TEXT NOT NULL,
  kind       TEXT NOT NULL,
  source     TEXT NOT NULL,
  url        TEXT,
  title      TEXT,
  as_of      TEXT,
  data_json  TEXT,
  text       TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id, ref);

CREATE TABLE IF NOT EXISTS reports (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL,
  section    TEXT NOT NULL,
  agent      TEXT NOT NULL,
  title      TEXT,
  content    TEXT,
  data_json  TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_run ON reports(run_id, section);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_run ON messages(run_id, created_at);

CREATE TABLE IF NOT EXISTS http_cache (
  key        TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  status     INTEGER NOT NULL,
  body       TEXT,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Cross-run memory: past calls scored against what actually happened.
CREATE TABLE IF NOT EXISTS memory (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  horizon       TEXT,
  horizon_end   TEXT,
  entry_price   REAL,
  verdict_json  TEXT,
  thesis        TEXT,
  outcome_json  TEXT,
  lesson        TEXT
);
CREATE INDEX IF NOT EXISTS idx_memory_symbol ON memory(symbol, created_at);
`;

let handle: Database.Database | null = null;

export function db(): Database.Database {
  if (handle) return handle;
  ensureDataDir();
  const conn = new Database(DB_PATH);
  conn.pragma('journal_mode = WAL');
  conn.pragma('synchronous = NORMAL');
  conn.pragma('busy_timeout = 5000');
  conn.exec(SCHEMA);
  handle = conn;
  return conn;
}

export function uid(prefix = ''): string {
  const s = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);
  return prefix ? `${prefix}_${s}` : s;
}

export function getSetting(key: string): string | null {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}
