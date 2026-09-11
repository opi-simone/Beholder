import type { DashboardDay, Mapping, Project, Session } from '../shared/types'
import { dayBounds } from '../shared/time'
import { all, get, lastId, run } from './db'

type SessionRow = {
  id: number
  start_ms: number
  end_ms: number
  duration_ms: number
  process_name: string
  window_title: string
  repo_slug: string | null
  project_id: number | null
  project_name: string | null
  activity_label: string | null
  origin: Session['origin']
  classification_source: Session['classificationSource']
  aggregation_key: string
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    startMs: row.start_ms,
    endMs: row.end_ms,
    durationMs: row.duration_ms,
    processName: row.process_name,
    windowTitle: row.window_title,
    repoSlug: row.repo_slug,
    projectId: row.project_id,
    projectName: row.project_name,
    activityLabel: row.activity_label,
    origin: row.origin,
    classificationSource: row.classification_source
  }
}

const SESSION_SELECT = `
  SELECT s.*, p.name as project_name
  FROM sessions s
  LEFT JOIN projects p ON p.id = s.project_id
`

export function listProjects(): Project[] {
  return all<{ id: number; name: string }>('SELECT id, name FROM projects ORDER BY name COLLATE NOCASE').map((p) => ({
    id: p.id,
    name: p.name
  }))
}

export function createProject(name: string): Project {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Nome progetto vuoto')
  run('INSERT INTO projects (name, created_at) VALUES (?, ?)', [trimmed, Date.now()])
  return { id: lastId(), name: trimmed }
}

export function listMappings(): Mapping[] {
  return all<{
    id: number
    match_type: Mapping['matchType']
    pattern: string
    project_id: number
    project_name: string
    priority: number
  }>(
    `SELECT m.id, m.match_type, m.pattern, m.project_id, p.name as project_name, m.priority
     FROM project_mappings m JOIN projects p ON p.id = m.project_id
     ORDER BY m.priority DESC, m.id ASC`
  ).map((m) => ({
    id: m.id,
    matchType: m.match_type,
    pattern: m.pattern,
    projectId: m.project_id,
    projectName: m.project_name,
    priority: m.priority
  }))
}

export function createMapping(
  matchType: Mapping['matchType'],
  pattern: string,
  projectId: number,
  priority = 10
): void {
  run('INSERT INTO project_mappings (match_type, pattern, project_id, priority) VALUES (?, ?, ?, ?)', [
    matchType,
    pattern.trim(),
    projectId,
    priority
  ])
}

export function deleteMapping(id: number): void {
  run('DELETE FROM project_mappings WHERE id = ?', [id])
}

export function listExcluded(): string[] {
  return all<{ process_name: string }>('SELECT process_name FROM excluded_apps ORDER BY process_name').map(
    (r) => r.process_name
  )
}

export function addExcluded(processName: string): void {
  run('INSERT OR IGNORE INTO excluded_apps (process_name) VALUES (?)', [processName.trim().toLowerCase()])
}

export function removeExcluded(processName: string): void {
  run('DELETE FROM excluded_apps WHERE process_name = ?', [processName.trim().toLowerCase()])
}

export function isExcluded(processName: string): boolean {
  const row = get<{ n: number }>(
    'SELECT COUNT(*) as n FROM excluded_apps WHERE process_name = ?',
    [processName.trim().toLowerCase()]
  )
  return Number(row?.n ?? 0) > 0
}

export function insertSession(input: {
  startMs: number
  endMs: number
  processName: string
  windowTitle: string
  repoSlug: string | null
  projectId: number | null
  activityLabel: string | null
  origin: Session['origin']
  classificationSource: Session['classificationSource']
  aggregationKey: string
}): number {
  const duration = Math.max(0, input.endMs - input.startMs)
  run(
    `INSERT INTO sessions (
      start_ms, end_ms, duration_ms, process_name, window_title, repo_slug,
      project_id, activity_label, origin, classification_source, aggregation_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.startMs,
      input.endMs,
      duration,
      input.processName,
      input.windowTitle,
      input.repoSlug,
      input.projectId,
      input.activityLabel,
      input.origin,
      input.classificationSource,
      input.aggregationKey
    ]
  )
  return lastId()
}

export function extendSession(id: number, endMs: number, windowTitle?: string): void {
  if (windowTitle !== undefined) {
    run(
      'UPDATE sessions SET end_ms = ?, duration_ms = MAX(0, ? - start_ms), window_title = ? WHERE id = ?',
      [endMs, endMs, windowTitle, id]
    )
  } else {
    run('UPDATE sessions SET end_ms = ?, duration_ms = MAX(0, ? - start_ms) WHERE id = ?', [endMs, endMs, id])
  }
}

export function getSession(id: number): Session | undefined {
  const row = get<SessionRow>(`${SESSION_SELECT} WHERE s.id = ?`, [id])
  return row ? mapSession(row) : undefined
}

export function getLastSessionByKey(aggregationKey: string): (Session & { aggregationKey: string }) | undefined {
  const row = get<SessionRow>(`${SESSION_SELECT} WHERE s.aggregation_key = ? ORDER BY s.end_ms DESC LIMIT 1`, [
    aggregationKey
  ])
  return row ? { ...mapSession(row), aggregationKey: row.aggregation_key } : undefined
}

export function pruneShortAutoSessions(minDurationMs: number, exceptId?: number): void {
  if (exceptId) {
    run('DELETE FROM sessions WHERE origin = ? AND duration_ms < ? AND id != ?', ['auto', minDurationMs, exceptId])
  } else {
    run('DELETE FROM sessions WHERE origin = ? AND duration_ms < ?', ['auto', minDurationMs])
  }
}

export function listSessionsForDay(date: string): Session[] {
  const { start, end } = dayBounds(date)
  return all<SessionRow>(
    `${SESSION_SELECT} WHERE s.start_ms <= ? AND s.end_ms >= ? ORDER BY s.start_ms ASC`,
    [end, start]
  ).map(mapSession)
}

export function updateSessionTimes(id: number, startMs: number, endMs: number): void {
  if (endMs <= startMs) throw new Error('Fine deve essere dopo inizio')
  run('UPDATE sessions SET start_ms = ?, end_ms = ?, duration_ms = ? WHERE id = ?', [
    startMs,
    endMs,
    endMs - startMs,
    id
  ])
}

export function deleteSession(id: number): void {
  run('DELETE FROM sessions WHERE id = ?', [id])
}

export function assignSession(
  id: number,
  projectId: number | null,
  activityLabel: string | null,
  source: Session['classificationSource']
): void {
  run('UPDATE sessions SET project_id = ?, activity_label = ?, classification_source = ? WHERE id = ?', [
    projectId,
    activityLabel,
    source,
    id
  ])
}

export function splitSession(id: number, atMs: number): void {
  const row = get<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id])
  if (!row) throw new Error('Sessione non trovata')
  if (atMs <= row.start_ms || atMs >= row.end_ms) throw new Error('Punto di split fuori intervallo')
  run('UPDATE sessions SET end_ms = ?, duration_ms = ? WHERE id = ?', [atMs, atMs - row.start_ms, id])
  run(
    `INSERT INTO sessions (
      start_ms, end_ms, duration_ms, process_name, window_title, repo_slug,
      project_id, activity_label, origin, classification_source, aggregation_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      atMs,
      row.end_ms,
      row.end_ms - atMs,
      row.process_name,
      row.window_title,
      row.repo_slug,
      row.project_id,
      row.activity_label,
      row.origin,
      row.classification_source,
      row.aggregation_key
    ]
  )
}

export function mergeSessions(firstId: number, secondId: number): void {
  const a = get<SessionRow>('SELECT * FROM sessions WHERE id = ?', [firstId])
  const b = get<SessionRow>('SELECT * FROM sessions WHERE id = ?', [secondId])
  if (!a || !b) throw new Error('Sessione non trovata')
  const [left, right] = a.start_ms <= b.start_ms ? [a, b] : [b, a]
  if (left.process_name.toLowerCase() !== right.process_name.toLowerCase()) {
    throw new Error('Merge consentito solo con lo stesso processo')
  }
  const leftProject = left.project_id
  const rightProject = right.project_id
  if (leftProject !== rightProject) {
    throw new Error('Riassegna allo stesso progetto prima di unire')
  }
  const gap = right.start_ms - left.end_ms
  if (gap > 5000) throw new Error('I blocchi non sono adiacenti')
  run('UPDATE sessions SET end_ms = ?, duration_ms = ? WHERE id = ?', [
    Math.max(left.end_ms, right.end_ms),
    Math.max(left.end_ms, right.end_ms) - left.start_ms,
    left.id
  ])
  run('DELETE FROM sessions WHERE id = ?', [right.id])
}

export function dashboardForDay(date: string): DashboardDay {
  const sessions = listSessionsForDay(date)
  const { start, end } = dayBounds(date)
  const clip = (s: Session): number => {
    const from = Math.max(s.startMs, start)
    const to = Math.min(s.endMs, end)
    return Math.max(0, to - from)
  }

  let totalMs = 0
  let manualMs = 0
  let unclassifiedMs = 0
  let idleMs = 0
  const by = new Map<string, { projectId: number | null; name: string; ms: number }>()

  for (const s of sessions) {
    const ms = clip(s)
    if (s.origin === 'idle_detection' && !s.projectId) {
      idleMs += ms
      continue
    }
    totalMs += ms
    if (s.origin === 'manual_timer') manualMs += ms
    if (!s.projectId) unclassifiedMs += ms
    const key = s.projectId ? String(s.projectId) : 'none'
    const name = s.projectName ?? 'Non classificato'
    const cur = by.get(key) ?? { projectId: s.projectId, name, ms: 0 }
    cur.ms += ms
    by.set(key, cur)
  }

  return {
    date,
    totalMs,
    manualMs,
    unclassifiedMs,
    idleMs,
    byProject: [...by.values()]
      .map((row) => ({ ...row, byLabel: [] as { label: string; ms: number }[] }))
      .sort((a, b) => b.ms - a.ms),
    unknownMs: 0
  }
}

export function countIdleUnreviewed(date: string): number {
  const { start, end } = dayBounds(date)
  const row = get<{ n: number }>(
    `SELECT COUNT(*) as n FROM sessions
     WHERE origin = 'idle_detection' AND start_ms <= ? AND end_ms >= ?`,
    [end, start]
  )
  return Number(row?.n ?? 0)
}
