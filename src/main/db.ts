import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { app } from 'electron'
import initSqlJs, { type Database, type SqlValue } from 'sql.js'

const require = createRequire(__filename)

let db: Database | null = null
let dbPath = ''
let saveTimer: ReturnType<typeof setTimeout> | null = null

const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  process_name TEXT NOT NULL,
  window_title TEXT NOT NULL,
  repo_slug TEXT,
  project_id INTEGER,
  activity_label TEXT,
  origin TEXT NOT NULL,
  classification_source TEXT NOT NULL,
  aggregation_key TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS project_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS excluded_apps (
  process_name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_ms);
CREATE INDEX IF NOT EXISTS idx_sessions_key ON sessions(aggregation_key, end_ms);
`

const MIGRATION_002 = `
CREATE TABLE IF NOT EXISTS project_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  rule_type TEXT NOT NULL,
  rule_value TEXT NOT NULL,
  weight INTEGER NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS activity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  process_name TEXT,
  window_title TEXT,
  executable_path TEXT,
  url TEXT,
  workspace_path TEXT,
  git_repository TEXT,
  working_directory TEXT,
  clickup_task_id TEXT,
  idle_seconds INTEGER DEFAULT 0,
  excluded INTEGER DEFAULT 0,
  candidate_project_id INTEGER,
  confidence REAL,
  evidence TEXT,
  machine_state TEXT,
  is_neutral INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS work_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  activity_label TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER,
  confidence REAL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS unknown_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  process_name TEXT,
  window_title TEXT,
  url TEXT,
  previous_project_id INTEGER,
  next_project_id INTEGER,
  suggested_project_id INTEGER,
  confidence REAL
);

CREATE TABLE IF NOT EXISTS manual_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  activity_label TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  work_session_id INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_events_ts ON activity_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_work_sessions_start ON work_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_unknown_start ON unknown_activities(started_at);
`

function schemaVersion(): number {
  const version = get<{ version: number }>('SELECT MAX(version) as version FROM schema_version')
  return Number(version?.version ?? 0)
}

function migrate(): void {
  ensure().run(MIGRATION_001)
  let version = schemaVersion()
  if (!version) {
    ensure().run('INSERT INTO schema_version (version) VALUES (1)')
    version = 1
  }
  if (version < 2) {
    ensure().run(MIGRATION_002)
    ensure().run(`
      INSERT INTO project_rules (project_id, rule_type, rule_value, weight)
      SELECT project_id,
        CASE match_type
          WHEN 'repo' THEN 'repository'
          WHEN 'title_contains' THEN 'keyword'
          WHEN 'process' THEN 'process'
          ELSE match_type
        END,
        pattern,
        CASE match_type
          WHEN 'repo' THEN 100
          WHEN 'title_contains' THEN 50
          WHEN 'process' THEN 0
          ELSE 50
        END
      FROM project_mappings
    `)
    ensure().run('INSERT INTO schema_version (version) VALUES (2)')
  }

  const seed = (key: string, value: string): void => {
    ensure().run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value])
  }
  seed('poll_interval_ms', '2000')
  seed('idle_threshold_ms', '300000')
  seed('start_threshold', '60')
  seed('switch_threshold', '70')
  seed('high_confidence', '95')
  seed('medium_confidence', '80')
  seed('switch_delay_high_sec', '30')
  seed('switch_delay_medium_sec', '45')
  seed('switch_delay_low_sec', '90')
  seed('max_gap_fill_ms', '300000')
  seed('lock_timeout_ms', '3600000')
  seed('confidence_decay', '5')
}

export async function openDatabase(): Promise<void> {
  if (db) return
  dbPath = join(app.getPath('userData'), 'beholder.db')
  mkdirSync(dirname(dbPath), { recursive: true })

  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
  const SQL = await initSqlJs({
    wasmBinary: readFileSync(wasmPath) as never
  })

  if (existsSync(dbPath)) {
    db = new SQL.Database(readFileSync(dbPath) as never)
  } else {
    db = new SQL.Database()
  }

  migrate()
  persistNow()
}

export function persistNow(): void {
  if (!db || !dbPath) return
  writeFileSync(dbPath, Buffer.from(db.export()))
}

function schedulePersist(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    persistNow()
  }, 400)
}

function ensure(): Database {
  if (!db) throw new Error('Database non inizializzato')
  return db
}

export function run(sql: string, params: SqlValue[] = []): void {
  ensure().run(sql, params)
  schedulePersist()
}

export function get<T>(sql: string, params: SqlValue[] = []): T | undefined {
  const stmt = ensure().prepare(sql)
  try {
    stmt.bind(params)
    if (!stmt.step()) return undefined
    return stmt.getAsObject() as T
  } finally {
    stmt.free()
  }
}

export function all<T>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = ensure().prepare(sql)
  const rows: T[] = []
  try {
    stmt.bind(params)
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T)
    }
    return rows
  } finally {
    stmt.free()
  }
}

export function lastId(): number {
  const row = get<{ id: number }>('SELECT last_insert_rowid() as id')
  return Number(row?.id ?? 0)
}

export function setting(key: string, fallback: string): string {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? fallback
}

export function setSetting(key: string, value: string): void {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    value
  ])
}
