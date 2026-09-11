import type {
  ActivityEventView,
  DashboardDay,
  ProjectRuleView,
  RuleType,
  UnknownActivity,
  WorkSession,
  WorkSessionSource
} from '../shared/types'
import type { EngineSettings, ProjectRule } from '../core/types'
import { DEFAULT_SETTINGS } from '../core/defaults'
import { dayBounds } from '../shared/time'
import { all, get, lastId, run, setting } from './db'

type WorkRow = {
  id: number
  project_id: number | null
  project_name: string | null
  activity_label: string | null
  started_at: number
  ended_at: number | null
  duration_ms: number | null
  confidence: number | null
  source: WorkSessionSource
  status: 'open' | 'closed'
}

const WORK_SELECT = `
  SELECT w.*, p.name as project_name
  FROM work_sessions w
  LEFT JOIN projects p ON p.id = w.project_id
`

function mapWork(row: WorkRow): WorkSession {
  const ended = Number(row.ended_at ?? row.started_at)
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    activityLabel: row.activity_label,
    startedAt: row.started_at,
    endedAt: ended,
    durationMs: Number(row.duration_ms ?? Math.max(0, ended - row.started_at)),
    confidence: Number(row.confidence ?? 0),
    source: row.source,
    status: row.status
  }
}

export function loadEngineSettings(): EngineSettings {
  return {
    idleThresholdMs: Number(setting('idle_threshold_ms', String(DEFAULT_SETTINGS.idleThresholdMs))),
    startThreshold: Number(setting('start_threshold', String(DEFAULT_SETTINGS.startThreshold))),
    switchThreshold: Number(setting('switch_threshold', String(DEFAULT_SETTINGS.switchThreshold))),
    highConfidence: Number(setting('high_confidence', String(DEFAULT_SETTINGS.highConfidence))),
    mediumConfidence: Number(setting('medium_confidence', String(DEFAULT_SETTINGS.mediumConfidence))),
    switchDelayHighSec: Number(setting('switch_delay_high_sec', String(DEFAULT_SETTINGS.switchDelayHighSec))),
    switchDelayMediumSec: Number(setting('switch_delay_medium_sec', String(DEFAULT_SETTINGS.switchDelayMediumSec))),
    switchDelayLowSec: Number(setting('switch_delay_low_sec', String(DEFAULT_SETTINGS.switchDelayLowSec))),
    maxGapFillMs: Number(setting('max_gap_fill_ms', String(DEFAULT_SETTINGS.maxGapFillMs))),
    lockTimeoutMs: Number(setting('lock_timeout_ms', String(DEFAULT_SETTINGS.lockTimeoutMs))),
    confidenceDecay: Number(setting('confidence_decay', String(DEFAULT_SETTINGS.confidenceDecay)))
  }
}

export function listProjectRules(): ProjectRule[] {
  return all<{
    id: number
    project_id: number
    rule_type: ProjectRule['ruleType']
    rule_value: string
    weight: number
  }>('SELECT id, project_id, rule_type, rule_value, weight FROM project_rules').map((row) => ({
    id: row.id,
    projectId: row.project_id,
    ruleType: row.rule_type,
    ruleValue: row.rule_value,
    weight: row.weight
  }))
}

export function listProjectRuleViews(): ProjectRuleView[] {
  return all<{
    id: number
    project_id: number
    project_name: string
    rule_type: RuleType
    rule_value: string
    weight: number
  }>(
    `SELECT r.id, r.project_id, p.name as project_name, r.rule_type, r.rule_value, r.weight
     FROM project_rules r JOIN projects p ON p.id = r.project_id
     ORDER BY p.name COLLATE NOCASE, r.id`
  ).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    ruleType: row.rule_type,
    ruleValue: row.rule_value,
    weight: row.weight
  }))
}

export function createProjectRule(ruleType: RuleType, ruleValue: string, projectId: number, weight: number): void {
  run('INSERT INTO project_rules (project_id, rule_type, rule_value, weight) VALUES (?, ?, ?, ?)', [
    projectId,
    ruleType,
    ruleValue.trim(),
    weight
  ])
}

export function deleteProjectRule(id: number): void {
  run('DELETE FROM project_rules WHERE id = ?', [id])
}

export function insertActivityEvent(input: {
  timestamp: number
  processName: string | null
  windowTitle: string | null
  executablePath: string | null
  url: string | null
  workspacePath: string | null
  gitRepository: string | null
  workingDirectory: string | null
  clickupTaskId: string | null
  idleSeconds: number
  excluded: boolean
  candidateProjectId: number | null
  confidence: number | null
  evidence: string | null
  machineState: string | null
  isNeutral: boolean
}): void {
  run(
    `INSERT INTO activity_events (
      timestamp, process_name, window_title, executable_path, url, workspace_path, git_repository,
      working_directory, clickup_task_id, idle_seconds, excluded, candidate_project_id, confidence,
      evidence, machine_state, is_neutral
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.timestamp,
      input.processName,
      input.windowTitle,
      input.executablePath,
      input.url,
      input.workspacePath,
      input.gitRepository,
      input.workingDirectory,
      input.clickupTaskId,
      input.idleSeconds,
      input.excluded ? 1 : 0,
      input.candidateProjectId,
      input.confidence,
      input.evidence,
      input.machineState,
      input.isNeutral ? 1 : 0
    ]
  )
}

export function insertWorkSession(input: {
  projectId: number | null
  activityLabel: string | null
  startedAt: number
  endedAt: number
  confidence: number
  source: WorkSessionSource
}): number {
  const now = Date.now()
  const duration = Math.max(0, input.endedAt - input.startedAt)
  run(
    `INSERT INTO work_sessions (
      project_id, activity_label, started_at, ended_at, duration_ms, confidence, source, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    [
      input.projectId,
      input.activityLabel,
      input.startedAt,
      input.endedAt,
      duration,
      input.confidence,
      input.source,
      now,
      now
    ]
  )
  return lastId()
}

export function touchWorkSession(id: number, endedAt: number, confidence?: number): void {
  if (confidence != null) {
    run(
      `UPDATE work_sessions
       SET ended_at = ?, duration_ms = MAX(0, ? - started_at), confidence = ?, updated_at = ?, status = 'open'
       WHERE id = ?`,
      [endedAt, endedAt, confidence, Date.now(), id]
    )
    return
  }
  run(
    `UPDATE work_sessions
     SET ended_at = ?, duration_ms = MAX(0, ? - started_at), updated_at = ?, status = 'open'
     WHERE id = ?`,
    [endedAt, endedAt, Date.now(), id]
  )
}

export function closeWorkSession(id: number, endedAt: number): void {
  run(
    `UPDATE work_sessions
     SET ended_at = ?, duration_ms = MAX(0, ? - started_at), status = 'closed', updated_at = ?
     WHERE id = ?`,
    [endedAt, endedAt, Date.now(), id]
  )
}

export function reopenLastAutoSession(endedAt: number, confidence: number): number | null {
  const row = get<{ id: number }>(
    `SELECT id FROM work_sessions WHERE source = 'auto' AND project_id IS NOT NULL
     ORDER BY ended_at DESC LIMIT 1`
  )
  if (!row) return null
  run(
    `UPDATE work_sessions
     SET ended_at = ?, duration_ms = MAX(0, ? - started_at), confidence = ?, status = 'open', updated_at = ?
     WHERE id = ?`,
    [endedAt, endedAt, confidence, Date.now(), row.id]
  )
  return row.id
}

export function getWorkSession(id: number): WorkSession | undefined {
  const row = get<WorkRow>(`${WORK_SELECT} WHERE w.id = ?`, [id])
  return row ? mapWork(row) : undefined
}

export function closeAnyOpenWorkSessions(endedAt: number): void {
  const open = all<{ id: number }>('SELECT id FROM work_sessions WHERE status = ?', ['open'])
  for (const row of open) closeWorkSession(row.id, endedAt)
}

export function listWorkSessionsForDay(date: string): WorkSession[] {
  const { start, end } = dayBounds(date)
  return all<WorkRow>(
    `${WORK_SELECT} WHERE w.started_at <= ? AND IFNULL(w.ended_at, w.started_at) >= ? ORDER BY w.started_at ASC`,
    [end, start]
  ).map(mapWork)
}

export function updateWorkSessionTimes(id: number, startedAt: number, endedAt: number): void {
  if (endedAt <= startedAt) throw new Error('Fine deve essere dopo inizio')
  run(
    'UPDATE work_sessions SET started_at = ?, ended_at = ?, duration_ms = ?, updated_at = ? WHERE id = ?',
    [startedAt, endedAt, endedAt - startedAt, Date.now(), id]
  )
}

export function deleteWorkSession(id: number): void {
  run('DELETE FROM work_sessions WHERE id = ?', [id])
}

export function assignWorkSession(
  id: number,
  projectId: number | null,
  activityLabel: string | null
): void {
  const row = get<WorkRow>('SELECT * FROM work_sessions WHERE id = ?', [id])
  if (!row) throw new Error('Sessione non trovata')
  run(
    `UPDATE work_sessions
     SET project_id = ?, activity_label = ?, source = 'override', updated_at = ?
     WHERE id = ?`,
    [projectId, activityLabel ?? row.activity_label, Date.now(), id]
  )
  run(
    `INSERT INTO manual_overrides (project_id, activity_label, started_at, ended_at, work_session_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [projectId, activityLabel ?? row.activity_label, row.started_at, row.ended_at, id, Date.now()]
  )
}

export function splitWorkSession(id: number, atMs: number): void {
  const row = get<WorkRow>('SELECT * FROM work_sessions WHERE id = ?', [id])
  if (!row) throw new Error('Sessione non trovata')
  const ended = Number(row.ended_at ?? row.started_at)
  if (atMs <= row.started_at || atMs >= ended) throw new Error('Punto di split fuori intervallo')
  const now = Date.now()
  run('UPDATE work_sessions SET ended_at = ?, duration_ms = ?, updated_at = ? WHERE id = ?', [
    atMs,
    atMs - row.started_at,
    now,
    id
  ])
  run(
    `INSERT INTO work_sessions (
      project_id, activity_label, started_at, ended_at, duration_ms, confidence, source, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.project_id,
      row.activity_label,
      atMs,
      ended,
      ended - atMs,
      row.confidence,
      row.source,
      row.status,
      now,
      now
    ]
  )
}

export function mergeWorkSessions(firstId: number, secondId: number): void {
  const a = get<WorkRow>('SELECT * FROM work_sessions WHERE id = ?', [firstId])
  const b = get<WorkRow>('SELECT * FROM work_sessions WHERE id = ?', [secondId])
  if (!a || !b) throw new Error('Sessione non trovata')
  const [left, right] = a.started_at <= b.started_at ? [a, b] : [b, a]
  if (left.project_id !== right.project_id) {
    throw new Error('Riassegna allo stesso progetto prima di unire')
  }
  const leftEnd = Number(left.ended_at ?? left.started_at)
  const rightEnd = Number(right.ended_at ?? right.started_at)
  const gap = right.started_at - leftEnd
  if (gap > 5000) throw new Error('I blocchi non sono adiacenti')
  const end = Math.max(leftEnd, rightEnd)
  run('UPDATE work_sessions SET ended_at = ?, duration_ms = ?, updated_at = ? WHERE id = ?', [
    end,
    end - left.started_at,
    Date.now(),
    left.id
  ])
  run('DELETE FROM work_sessions WHERE id = ?', [right.id])
}

export function insertUnknownActivity(input: {
  startedAt: number
  processName: string | null
  windowTitle: string | null
  url: string | null
  previousProjectId: number | null
}): number {
  run(
    `INSERT INTO unknown_activities (
      started_at, ended_at, process_name, window_title, url, previous_project_id, confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.startedAt, input.startedAt, input.processName, input.windowTitle, input.url, input.previousProjectId, 0]
  )
  return lastId()
}

export function touchUnknownActivity(id: number, endedAt: number): void {
  run('UPDATE unknown_activities SET ended_at = ? WHERE id = ?', [endedAt, id])
}

export function closeUnknownActivity(
  id: number,
  endedAt: number,
  nextProjectId: number | null,
  suggestedProjectId: number | null,
  confidence: number
): void {
  run(
    `UPDATE unknown_activities
     SET ended_at = ?, next_project_id = ?, suggested_project_id = ?, confidence = ?
     WHERE id = ?`,
    [endedAt, nextProjectId, suggestedProjectId, confidence, id]
  )
}

export function deleteUnknownActivity(id: number): void {
  run('DELETE FROM unknown_activities WHERE id = ?', [id])
}

export function listUnknownForDay(date: string): UnknownActivity[] {
  const { start, end } = dayBounds(date)
  return all<{
    id: number
    started_at: number
    ended_at: number | null
    process_name: string | null
    window_title: string | null
    url: string | null
    previous_project_id: number | null
    previous_project_name: string | null
    next_project_id: number | null
    next_project_name: string | null
    suggested_project_id: number | null
    suggested_project_name: string | null
    confidence: number | null
  }>(
    `SELECT u.*,
       prev.name as previous_project_name,
       nextp.name as next_project_name,
       sug.name as suggested_project_name
     FROM unknown_activities u
     LEFT JOIN projects prev ON prev.id = u.previous_project_id
     LEFT JOIN projects nextp ON nextp.id = u.next_project_id
     LEFT JOIN projects sug ON sug.id = u.suggested_project_id
     WHERE u.started_at <= ? AND IFNULL(u.ended_at, u.started_at) >= ?
     ORDER BY u.started_at ASC`,
    [end, start]
  ).map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    endedAt: Number(row.ended_at ?? row.started_at),
    processName: row.process_name,
    windowTitle: row.window_title,
    url: row.url,
    previousProjectId: row.previous_project_id,
    previousProjectName: row.previous_project_name,
    nextProjectId: row.next_project_id,
    nextProjectName: row.next_project_name,
    suggestedProjectId: row.suggested_project_id,
    suggestedProjectName: row.suggested_project_name,
    confidence: row.confidence
  }))
}

export function assignUnknown(id: number, projectId: number, activityLabel: string | null): void {
  const row = get<{
    started_at: number
    ended_at: number | null
    previous_project_id: number | null
  }>('SELECT started_at, ended_at, previous_project_id FROM unknown_activities WHERE id = ?', [id])
  if (!row) throw new Error('Intervallo non trovato')
  const ended = Number(row.ended_at ?? row.started_at)
  const sessionId = insertWorkSession({
    projectId,
    activityLabel,
    startedAt: row.started_at,
    endedAt: ended,
    confidence: 100,
    source: 'override'
  })
  run('UPDATE work_sessions SET status = ? WHERE id = ?', ['closed', sessionId])
  run(
    `INSERT INTO manual_overrides (project_id, activity_label, started_at, ended_at, work_session_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [projectId, activityLabel, row.started_at, ended, sessionId, Date.now()]
  )
  deleteUnknownActivity(id)
}

export function countUnknownForDay(date: string): number {
  const { start, end } = dayBounds(date)
  const row = get<{ n: number }>(
    `SELECT COUNT(*) as n FROM unknown_activities
     WHERE started_at <= ? AND IFNULL(ended_at, started_at) >= ?
       AND (suggested_project_id IS NULL OR previous_project_id IS NULL OR previous_project_id != IFNULL(next_project_id, -1))`,
    [end, start]
  )
  return Number(row?.n ?? 0)
}

export function listActivityEventsForDay(date: string): ActivityEventView[] {
  const { start, end } = dayBounds(date)
  return all<{
    id: number
    timestamp: number
    process_name: string | null
    window_title: string | null
    url: string | null
    workspace_path: string | null
    git_repository: string | null
    working_directory: string | null
    idle_seconds: number
    candidate_project_id: number | null
    candidate_name: string | null
    confidence: number | null
    evidence: string | null
    machine_state: string | null
    is_neutral: number
  }>(
    `SELECT e.*, p.name as candidate_name
     FROM activity_events e
     LEFT JOIN projects p ON p.id = e.candidate_project_id
     WHERE e.timestamp >= ? AND e.timestamp <= ?
     ORDER BY e.timestamp ASC`,
    [start, end]
  ).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    processName: row.process_name,
    windowTitle: row.window_title,
    url: row.url,
    workspacePath: row.workspace_path,
    gitRepository: row.git_repository,
    workingDirectory: row.working_directory,
    idleSeconds: row.idle_seconds,
    candidateProjectId: row.candidate_project_id,
    candidateProjectName: row.candidate_name,
    confidence: row.confidence,
    evidence: row.evidence,
    machineState: row.machine_state,
    isNeutral: Boolean(row.is_neutral)
  }))
}

export function workDashboardForDay(date: string): DashboardDay {
  const sessions = listWorkSessionsForDay(date)
  const unknowns = listUnknownForDay(date)
  const { start, end } = dayBounds(date)
  const clip = (from: number, to: number): number => {
    const a = Math.max(from, start)
    const b = Math.min(to, end)
    return Math.max(0, b - a)
  }

  let totalMs = 0
  let manualMs = 0
  let unclassifiedMs = 0
  let unknownMs = 0
  const by = new Map<
    string,
    { projectId: number | null; name: string; ms: number; labels: Map<string, number> }
  >()

  for (const s of sessions) {
    const ms = clip(s.startedAt, s.endedAt)
    if (s.projectId == null) {
      unclassifiedMs += ms
    }
    totalMs += ms
    if (s.source === 'manual_timer') manualMs += ms
    const key = s.projectId ? String(s.projectId) : 'none'
    const name = s.projectName ?? 'Non classificato'
    const cur = by.get(key) ?? { projectId: s.projectId, name, ms: 0, labels: new Map() }
    cur.ms += ms
    const label = s.activityLabel?.trim() || '(senza task)'
    cur.labels.set(label, (cur.labels.get(label) ?? 0) + ms)
    by.set(key, cur)
  }

  for (const u of unknowns) {
    unknownMs += clip(u.startedAt, u.endedAt)
  }

  return {
    date,
    totalMs,
    manualMs,
    unclassifiedMs,
    unknownMs,
    idleMs: 0,
    byProject: [...by.values()]
      .map((row) => ({
        projectId: row.projectId,
        name: row.name,
        ms: row.ms,
        byLabel: [...row.labels.entries()]
          .map(([label, ms]) => ({ label, ms }))
          .sort((a, b) => b.ms - a.ms)
      }))
      .sort((a, b) => b.ms - a.ms)
  }
}

export function projectNameById(id: number | null | undefined): string | null {
  if (id == null) return null
  const row = get<{ name: string }>('SELECT name FROM projects WHERE id = ?', [id])
  return row?.name ?? null
}
