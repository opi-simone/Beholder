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

export async function openDatabase(): Promise<void> {
  if (db) return
  dbPath = join(app.getPath('userData'), 'beholder.db')
  mkdirSync(dirname(dbPath), { recursive: true })

  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
  const SQL = await initSqlJs({
    wasmBinary: readFileSync(wasmPath)
  })

  if (existsSync(dbPath)) {
    db = new SQL.Database(readFileSync(dbPath))
  } else {
    db = new SQL.Database()
  }

  db.run(MIGRATION_001)
  const version = get<{ version: number }>('SELECT MAX(version) as version FROM schema_version')
  if (!version?.version) {
    db.run('INSERT INTO schema_version (version) VALUES (1)')
  }
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('poll_interval_ms', '3000')`)
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('idle_threshold_ms', '300000')`)
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('min_session_ms', '30000')`)
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('switch_debounce_ms', '15000')`)
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('resume_gap_ms', '120000')`)
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
