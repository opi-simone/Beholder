import { formatDuration, todayDate } from '../shared/time'
import type { AppSnapshot, StartTimerPayload, TrackingStatus } from '../shared/types'
import { classifyActivity } from '../core/classifier'
import { DEFAULT_SETTINGS } from '../core/defaults'
import {
  initialEngineState,
  onActivity,
  onMidnightSplit,
  onPause,
  setHold
} from '../core/engine'
import type { EngineEffect, EngineState, ProjectHold } from '../core/types'
import { persistNow, setSetting, setting } from './db'
import { broadcastChanged, notifyIdleReturn, notifyTimerInterrupted } from './notify'
import { isExcluded, listProjects } from './queries'
import { enrichWindow } from './tracking/enrich'
import { getActiveWindow, getIdleMs } from './win32'
import {
  closeAnyOpenWorkSessions,
  closeUnknownActivity,
  closeWorkSession,
  countUnknownForDay,
  insertActivityEvent,
  insertUnknownActivity,
  insertWorkSession,
  loadEngineSettings,
  listProjectRules,
  projectNameById,
  reopenLastAutoSession,
  createProjectRule,
  touchUnknownActivity,
  touchWorkSession
} from './work-queries'
import { loadConfig } from './store'

let timer: ReturnType<typeof setInterval> | null = null
let engine: EngineState = initialEngineState()
let openWorkId: number | null = null
let openUnknownId: number | null = null
let lastBroadcast = 0
let paused = false
let contextLabel = 'In attesa del contesto'
let wasIdle = false

type ManualState = {
  activityLabel: string
  projectId: number | null
  projectName: string | null
  startedAt: number
}

let manual: ManualState | null = null

function pollMs(): number {
  return Number(setting('poll_interval_ms', '2000')) || 2000
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function applyEffects(effects: EngineEffect[], sampleProcess: string | null, sampleTitle: string | null, sampleUrl: string | null): void {
  for (const effect of effects) {
    if (effect.type === 'close_open_session' && openWorkId != null) {
      closeWorkSession(openWorkId, effect.endedAt)
      openWorkId = null
    }
    if (effect.type === 'start_session') {
      openWorkId = insertWorkSession({
        projectId: effect.projectId,
        activityLabel: effect.activityLabel,
        startedAt: effect.startedAt,
        endedAt: effect.startedAt,
        confidence: effect.confidence,
        source: effect.source
      })
    }
    if (effect.type === 'reuse_last_session') {
      openWorkId = reopenLastAutoSession(effect.endedAt, effect.confidence)
    }
    if (effect.type === 'touch_open_session' && openWorkId != null) {
      touchWorkSession(openWorkId, effect.endedAt, effect.confidence)
    }
    if (effect.type === 'begin_unknown') {
      openUnknownId = insertUnknownActivity({
        startedAt: effect.startedAt,
        processName: sampleProcess,
        windowTitle: sampleTitle,
        url: sampleUrl,
        previousProjectId: engine.unknown?.previousProjectId ?? engine.lastClosed?.projectId ?? null
      })
    }
    if (effect.type === 'close_unknown' && openUnknownId != null) {
      closeUnknownActivity(
        openUnknownId,
        effect.endedAt,
        effect.nextProjectId,
        effect.suggestedProjectId,
        effect.confidence
      )
      openUnknownId = null
    }
    if (effect.type === 'debug_log') {
      console.debug(effect.lines.join('\n'))
    }
  }
}

function tick(): void {
  const now = Date.now()
  const settings = loadEngineSettings()

  if (paused && !manual && !engine.hold) {
    contextLabel = 'Tracking in pausa'
    maybeBroadcast(now)
    return
  }

  if (engine.open && new Date(engine.open.startedAt).toDateString() !== new Date(now).toDateString()) {
    const split = onMidnightSplit(engine, startOfLocalDay(now))
    engine = split.state
    applyEffects(split.effects, null, null, null)
  }

  const idleFor = getIdleMs()
  const win = getActiveWindow()
  const excluded = Boolean(win && isExcluded(win.processName))
  const sample = enrichWindow(win, now, Math.round(idleFor / 1000))
  sample.excluded = excluded

  const rules = listProjectRules()
  const classification = classifyActivity(sample, rules, engine.stickyProjectId)

  if (!excluded) {
    insertActivityEvent({
      timestamp: sample.timestamp,
      processName: sample.processName,
      windowTitle: sample.windowTitle,
      executablePath: sample.executablePath,
      url: sample.url,
      workspacePath: sample.workspacePath,
      gitRepository: sample.gitRepository,
      workingDirectory: sample.workingDirectory,
      clickupTaskId: sample.clickupTaskId,
      idleSeconds: sample.idleSeconds,
      excluded: false,
      candidateProjectId: classification.candidateProjectId,
      confidence: classification.confidence,
      evidence: JSON.stringify(classification.evidence),
      machineState: engine.machine,
      isNeutral: classification.isNeutral
    })
  }

  const out = onActivity(engine, sample, classification, settings)
  engine = out.state
  applyEffects(out.effects, sample.processName, sample.windowTitle, sample.url)
  if (openUnknownId != null) {
    touchUnknownActivity(openUnknownId, now)
  }

  if (idleFor >= settings.idleThresholdMs) {
    wasIdle = true
    contextLabel = 'Inattivo (AFK)'
    maybeBroadcast(now)
    return
  }
  if (wasIdle) {
    notifyIdleReturn(formatDuration(idleFor))
    wasIdle = false
  }

  const stickyName = projectNameById(engine.stickyProjectId)
  if (engine.hold?.source === 'manual_timer' && manual) {
    contextLabel = `Timer: ${manual.activityLabel}`
  } else if (engine.hold?.source === 'lock') {
    contextLabel = `Lock: ${projectNameById(engine.hold.projectId) ?? 'progetto'}`
  } else if (stickyName) {
    const winBit = win ? `${win.processName}` : ''
    contextLabel = `${stickyName}${winBit ? ` · ${winBit}` : ''}`
  } else if (win && !excluded) {
    contextLabel = `${win.processName} — ${classification.candidateProjectId ? stickyName ?? '…' : 'non classificato'}`
  } else {
    contextLabel = excluded ? 'Escluso / nessuna finestra' : 'In attesa del contesto'
  }

  maybeBroadcast(now)
}

function maybeBroadcast(now: number): void {
  if (now - lastBroadcast < 1000) return
  lastBroadcast = now
  broadcastChanged()
}

export function snapshot(): AppSnapshot {
  const config = loadConfig()
  const status: TrackingStatus = engine.hold?.source === 'manual_timer' || manual
    ? 'manual'
    : paused
      ? 'paused'
      : engine.hold?.source === 'lock'
        ? 'locked'
        : engine.machine === 'IDLE'
          ? 'idle_pending'
          : 'running'
  const unknownCount = countUnknownForDay(todayDate())
  return {
    trackingStatus: status,
    privacyAccepted: config.privacyAccepted,
    currentContextLabel: contextLabel,
    machineState: engine.machine,
    stickyProjectName: projectNameById(engine.stickyProjectId),
    unknownCount,
    idlePendingCount: unknownCount,
    manualTimer: manual
      ? {
          activityLabel: manual.activityLabel,
          projectName: manual.projectName,
          startedAt: manual.startedAt
        }
      : null,
    projectLock:
      engine.hold?.source === 'lock'
        ? {
            projectId: engine.hold.projectId,
            projectName: projectNameById(engine.hold.projectId),
            expiresAt: engine.hold.expiresAt
          }
        : null,
    pollIntervalMs: pollMs(),
    idleThresholdMs: Number(setting('idle_threshold_ms', String(DEFAULT_SETTINGS.idleThresholdMs)))
  }
}

export function setPaused(value: boolean): void {
  paused = value
  if (value && !manual && !engine.hold) {
    const out = onPause(engine, Date.now())
    engine = out.state
    applyEffects(out.effects, null, null, null)
  }
  broadcastChanged()
}

export function isPaused(): boolean {
  return paused
}

function applyHoldNow(hold: ProjectHold | null): void {
  engine = setHold(engine, hold)
}

export function startManualTimer(payload: StartTimerPayload, projectName: string | null): void {
  const now = Date.now()
  const activity = payload.activityLabel.trim()
  if (!activity) throw new Error('Nome attività obbligatorio')
  const settings = loadEngineSettings()
  const expires = settings.lockTimeoutMs > 0 ? now + settings.lockTimeoutMs : null
  applyHoldNow({
    projectId: payload.projectId,
    activityLabel: activity,
    startedAt: now,
    expiresAt: expires,
    source: 'manual_timer'
  })
  manual = {
    activityLabel: activity,
    projectId: payload.projectId,
    projectName,
    startedAt: now
  }
  setSetting('manual_timer_open', '1')
  contextLabel = `Timer: ${activity}`
  const sample = enrichWindow(getActiveWindow(), now, 0)
  const classification = classifyActivity(sample, listProjectRules(), payload.projectId)
  const out = onActivity(engine, sample, classification, settings)
  engine = out.state
  applyEffects(out.effects, sample.processName, sample.windowTitle, sample.url)
  broadcastChanged()
}

export function stopManualTimer(): void {
  if (!manual && engine.hold?.source !== 'manual_timer') return
  applyHoldNow(null)
  if (openWorkId != null) {
    closeWorkSession(openWorkId, Date.now())
    openWorkId = null
  }
  if (engine.open) {
    engine = { ...engine, open: null, hold: null }
  }
  manual = null
  setSetting('manual_timer_open', '')
  persistNow()
  broadcastChanged()
}

export function setProjectLock(projectId: number): void {
  const now = Date.now()
  const settings = loadEngineSettings()
  const expires = settings.lockTimeoutMs > 0 ? now + settings.lockTimeoutMs : null
  applyHoldNow({
    projectId,
    activityLabel: null,
    startedAt: now,
    expiresAt: expires,
    source: 'lock'
  })
  const sample = enrichWindow(getActiveWindow(), now, 0)
  const classification = classifyActivity(sample, listProjectRules(), projectId)
  const out = onActivity(engine, sample, classification, settings)
  engine = out.state
  applyEffects(out.effects, sample.processName, sample.windowTitle, sample.url)
  broadcastChanged()
}

export function clearProjectLock(): void {
  applyHoldNow(null)
  if (openWorkId != null && engine.open?.source === 'lock') {
    closeWorkSession(openWorkId, Date.now())
    openWorkId = null
    engine = { ...engine, open: null }
  }
  broadcastChanged()
}

export function recoverInterruptedTimer(): void {
  const raw = setting('manual_timer_open', '')
  if (!raw) return
  notifyTimerInterrupted()
  setSetting('manual_timer_open', '')
}

export function rememberAssignment(_sessionId: number, projectId: number): void {
  const project = listProjects().find((p) => p.id === projectId)
  if (!project) return
  createProjectRule('keyword', project.name, projectId, 50)
}

export function startTracker(initialPaused: boolean): void {
  paused = initialPaused
  engine = initialEngineState()
  openWorkId = null
  openUnknownId = null
  closeAnyOpenWorkSessions(Date.now())
  recoverInterruptedTimer()
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
  if (!paused) {
    const out = onPause(engine, now)
    engine = out.state
    applyEffects(out.effects, null, null, null)
  } else if (openWorkId != null) {
    closeWorkSession(openWorkId, now)
    openWorkId = null
  }
  manual = null
  setSetting('manual_timer_open', '')
  if (timer) clearInterval(timer)
  timer = null
  persistNow()
}

export function getContextLabel(): string {
  return contextLabel
}

export function hasManualTimer(): boolean {
  return Boolean(manual) || engine.hold?.source === 'manual_timer'
}
