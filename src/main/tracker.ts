import { formatDuration, todayDate } from '../shared/time'
import type { AppSnapshot, StartTimerPayload, TrackingStatus } from '../shared/types'
import { classifyWindow } from './classify'
import { persistNow, setSetting, setting } from './db'
import { broadcastChanged, notifyIdleReturn, notifyTimerInterrupted } from './notify'
import {
  assignSession,
  countIdleUnreviewed,
  createMapping,
  deleteSession,
  extendSession,
  getLastSessionByKey,
  getSession,
  insertSession,
  isExcluded,
  pruneShortAutoSessions
} from './queries'
import { loadConfig } from './store'
import { getActiveWindow, getIdleMs } from './win32'

type OpenSession = {
  id: number
  key: string
  kind: 'auto' | 'idle' | 'manual'
}

let timer: ReturnType<typeof setInterval> | null = null
let open: OpenSession | null = null
let pendingSwitch: { key: string; since: number } | null = null
let wasIdle = false
let lastBroadcast = 0

type ManualState = {
  sessionId: number
  activityLabel: string
  projectId: number | null
  projectName: string | null
  startedAt: number
}

let manual: ManualState | null = null
let paused = false
let contextLabel = 'In attesa del contesto'
let idlePending = 0

function pollMs(): number {
  return Number(setting('poll_interval_ms', '3000')) || 3000
}

function idleMs(): number {
  return Number(setting('idle_threshold_ms', '300000')) || 300000
}

function minSessionMs(): number {
  return Number(setting('min_session_ms', '30000')) || 30000
}

function switchDebounceMs(): number {
  return Number(setting('switch_debounce_ms', '15000')) || 15000
}

function resumeGapMs(): number {
  return Number(setting('resume_gap_ms', '120000')) || 120000
}

function closeOpen(at?: number): void {
  if (!open) return
  const closing = open
  if (at !== undefined) extendSession(closing.id, at)
  open = null
  pendingSwitch = null
  if (closing.kind !== 'auto') return
  const session = getSession(closing.id)
  if (session && session.durationMs < minSessionMs()) {
    deleteSession(closing.id)
  }
}

function resumeIfCompatible(key: string, kind: OpenSession['kind'], now: number): boolean {
  const last = getLastSessionByKey(key)
  if (!last || last.origin === 'manual_timer') return false
  if (kind === 'auto' && last.origin !== 'auto') return false
  if (kind === 'idle' && last.origin !== 'idle_detection') return false
  if (last.aggregationKey !== key) return false
  if (now - last.endMs > resumeGapMs()) return false
  open = { id: last.id, key, kind }
  extendSession(last.id, now)
  return true
}

function beginAutoSession(
  now: number,
  key: string,
  processName: string,
  windowTitle: string,
  classified: ReturnType<typeof classifyWindow>
): void {
  if (resumeIfCompatible(key, 'auto', now)) {
    if (open) extendSession(open.id, now, windowTitle)
    return
  }
  const id = insertSession({
    startMs: now,
    endMs: now,
    processName,
    windowTitle,
    repoSlug: classified.repoSlug,
    projectId: classified.projectId,
    activityLabel: null,
    origin: 'auto',
    classificationSource: classified.source,
    aggregationKey: key
  })
  open = { id, key, kind: 'auto' }
}

function tick(): void {
  const now = Date.now()
  idlePending = countIdleUnreviewed(todayDate())

  if (manual) {
    extendSession(manual.sessionId, now)
    contextLabel = `Timer: ${manual.activityLabel}`
    maybeBroadcast(now)
    return
  }

  if (paused) {
    closeOpen()
    pendingSwitch = null
    contextLabel = 'Tracking in pausa'
    maybeBroadcast(now)
    return
  }

  const idleFor = getIdleMs()
  if (idleFor >= idleMs()) {
    const lastInput = now - idleFor
    const key = 'idle'
    if (!open || open.key !== key) {
      closeOpen(lastInput)
      pendingSwitch = null
      if (!resumeIfCompatible(key, 'idle', now)) {
        const id = insertSession({
          startMs: lastInput,
          endMs: now,
          processName: 'Idle',
          windowTitle: 'Inattività',
          repoSlug: null,
          projectId: null,
          activityLabel: null,
          origin: 'idle_detection',
          classificationSource: 'idle',
          aggregationKey: key
        })
        open = { id, key, kind: 'idle' }
      }
    } else {
      extendSession(open.id, now)
    }
    wasIdle = true
    contextLabel = 'Inattivo'
    maybeBroadcast(now)
    return
  }

  if (wasIdle && open?.kind === 'idle') {
    const session = getSession(open.id)
    closeOpen(now)
    wasIdle = false
    notifyIdleReturn(formatDuration(session ? now - session.startMs : idleFor))
  }

  const win = getActiveWindow()
  if (!win || isExcluded(win.processName)) {
    if (open?.kind === 'auto') {
      if (!pendingSwitch || pendingSwitch.key !== 'excluded') {
        pendingSwitch = { key: 'excluded', since: now }
      }
      if (now - pendingSwitch.since < switchDebounceMs()) {
        contextLabel = 'Escluso / nessuna finestra'
        maybeBroadcast(now)
        return
      }
    }
    closeOpen()
    contextLabel = 'Escluso / nessuna finestra'
    maybeBroadcast(now)
    return
  }

  const classified = classifyWindow({ processName: win.processName, windowTitle: win.windowTitle })
  const key = classified.aggregationKey
  const dayStamp = new Date(now).toDateString()

  if (open && open.kind === 'auto') {
    const current = getSession(open.id)
    if (current && new Date(current.startMs).toDateString() !== dayStamp) {
      closeOpen(now)
    }
  }

  if (open && open.key === key && open.kind === 'auto') {
    pendingSwitch = null
    extendSession(open.id, now, win.windowTitle)
  } else if (open && open.kind === 'auto' && open.key !== key) {
    if (!pendingSwitch || pendingSwitch.key !== key) {
      pendingSwitch = { key, since: now }
    }
    if (now - pendingSwitch.since < switchDebounceMs()) {
        contextLabel = `${win.processName} — ${classified.repoSlug ?? (win.windowTitle || '…')}`
      maybeBroadcast(now)
      return
    }
    const startedAt = pendingSwitch.since
    closeOpen()
    beginAutoSession(startedAt, key, win.processName, win.windowTitle, classified)
  } else {
    pendingSwitch = null
    beginAutoSession(now, key, win.processName, win.windowTitle, classified)
  }

  const projectBit = classified.repoSlug ?? (win.windowTitle || 'Non classificato')
  contextLabel = `${win.processName} — ${projectBit}`
  maybeBroadcast(now)
}

function maybeBroadcast(now: number): void {
  if (now - lastBroadcast < 1000) return
  lastBroadcast = now
  broadcastChanged()
}

export function snapshot(): AppSnapshot {
  const config = loadConfig()
  const status: TrackingStatus = manual
    ? 'manual'
    : paused
      ? 'paused'
      : open?.kind === 'idle'
        ? 'idle_pending'
        : 'running'
  return {
    trackingStatus: status,
    privacyAccepted: config.privacyAccepted,
    currentContextLabel: contextLabel,
    idlePendingCount: idlePending,
    manualTimer: manual
      ? {
          activityLabel: manual.activityLabel,
          projectName: manual.projectName,
          startedAt: manual.startedAt
        }
      : null,
    pollIntervalMs: pollMs(),
    idleThresholdMs: idleMs()
  }
}

export function setPaused(value: boolean): void {
  paused = value
  if (value && !manual) closeOpen()
  broadcastChanged()
}

export function isPaused(): boolean {
  return paused
}

export function startManualTimer(payload: StartTimerPayload, projectName: string | null): void {
  const now = Date.now()
  closeOpen(now)
  const activity = payload.activityLabel.trim()
  if (!activity) throw new Error('Nome attività obbligatorio')
  const id = insertSession({
    startMs: now,
    endMs: now,
    processName: 'Timer manuale',
    windowTitle: activity,
    repoSlug: null,
    projectId: payload.projectId,
    activityLabel: activity,
    origin: 'manual_timer',
    classificationSource: 'manual',
    aggregationKey: `manual:${activity}:${payload.projectId ?? 'none'}`
  })
  manual = {
    sessionId: id,
    activityLabel: activity,
    projectId: payload.projectId,
    projectName,
    startedAt: now
  }
  setSetting('manual_timer_open', String(id))
  contextLabel = `Timer: ${activity}`
  broadcastChanged()
}

export function stopManualTimer(): void {
  if (!manual) return
  extendSession(manual.sessionId, Date.now())
  manual = null
  setSetting('manual_timer_open', '')
  persistNow()
  broadcastChanged()
}

export function recoverInterruptedTimer(): void {
  const raw = setting('manual_timer_open', '')
  if (!raw) return
  const id = Number(raw)
  if (!id) {
    setSetting('manual_timer_open', '')
    return
  }
  const session = getSession(id)
  if (session) {
    notifyTimerInterrupted()
  }
  setSetting('manual_timer_open', '')
}

export function rememberAssignment(sessionId: number, projectId: number): void {
  const session = getSession(sessionId)
  if (!session) return
  if (session.repoSlug) {
    createMapping('repo', session.repoSlug, projectId, 20)
  } else {
    createMapping('process', session.processName, projectId, 5)
  }
  assignSession(sessionId, projectId, session.activityLabel, 'user_rule')
}

export function startTracker(initialPaused: boolean): void {
  paused = initialPaused
  recoverInterruptedTimer()
  pruneShortAutoSessions(minSessionMs())
  if (timer) clearInterval(timer)
  tick()
  timer = setInterval(tick, pollMs())
}

export function restartTrackerInterval(): void {
  if (timer) clearInterval(timer)
  timer = setInterval(tick, pollMs())
}

export function stopTracker(): void {
  const now = Date.now()
  if (manual) {
    extendSession(manual.sessionId, now)
    setSetting('manual_timer_open', '')
    manual = null
  } else {
    closeOpen(now)
  }
  if (timer) clearInterval(timer)
  timer = null
  persistNow()
}

export function getContextLabel(): string {
  return contextLabel
}

export function hasManualTimer(): boolean {
  return Boolean(manual)
}
