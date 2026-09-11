import { shouldGapFill } from './gap-fill'
import type {
  Classification,
  CloseReason,
  EngineEffect,
  EngineSettings,
  EngineState,
  ProjectHold,
  WorkSessionSource
} from './types'
import type { ActivitySample } from './types'

export function initialEngineState(): EngineState {
  return {
    machine: 'IDLE',
    stickyProjectId: null,
    currentConfidence: 0,
    open: null,
    switchCandidate: null,
    hold: null,
    unknown: null,
    lastCloseReason: null,
    lastClosed: null
  }
}

export function switchDelaySec(confidence: number, settings: EngineSettings): number {
  if (confidence >= settings.highConfidence) return settings.switchDelayHighSec
  if (confidence >= settings.mediumConfidence) return settings.switchDelayMediumSec
  return settings.switchDelayLowSec
}

function pushLog(effects: EngineEffect[], lines: string[]): void {
  if (lines.length) effects.push({ type: 'debug_log', lines })
}

function closeUnknown(
  state: EngineState,
  endedAt: number,
  nextProjectId: number | null,
  suggested: number | null,
  confidence: number,
  effects: EngineEffect[]
): void {
  if (!state.unknown) return
  effects.push({
    type: 'close_unknown',
    endedAt,
    nextProjectId,
    suggestedProjectId: suggested,
    confidence
  })
  state.unknown = null
}

function closeOpen(state: EngineState, endedAt: number, reason: CloseReason, effects: EngineEffect[]): void {
  if (!state.open) return
  effects.push({ type: 'close_open_session', endedAt })
  state.lastClosed = {
    projectId: state.open.projectId,
    endedAt,
    source: state.open.source
  }
  state.lastCloseReason = reason
  state.open = null
}

function beginUnknown(state: EngineState, event: ActivitySample, effects: EngineEffect[]): void {
  if (state.unknown) return
  state.unknown = {
    startedAt: event.timestamp,
    processName: event.processName,
    windowTitle: event.windowTitle,
    url: event.url,
    previousProjectId: state.lastClosed?.projectId ?? state.stickyProjectId
  }
  effects.push({ type: 'begin_unknown', startedAt: event.timestamp })
}

function startSession(
  state: EngineState,
  args: {
    projectId: number | null
    startedAt: number
    confidence: number
    source: WorkSessionSource
    activityLabel: string | null
  },
  effects: EngineEffect[],
  settings: EngineSettings
): void {
  closeUnknown(state, args.startedAt, args.projectId, args.projectId, args.confidence, effects)

  if (
    shouldGapFill({
      previous: state.lastClosed
        ? {
            projectId: state.lastClosed.projectId,
            startedAt: 0,
            endedAt: state.lastClosed.endedAt,
            source: state.lastClosed.source,
            closeReason: state.lastCloseReason
          }
        : null,
      nextProjectId: args.projectId,
      nextStartedAt: args.startedAt,
      nextSource: args.source,
      maxGapFillMs: settings.maxGapFillMs
    }) &&
    state.lastClosed
  ) {
    state.open = {
      projectId: args.projectId,
      startedAt: state.lastClosed.endedAt,
      activityLabel: args.activityLabel,
      source: args.source,
      confidence: args.confidence
    }
    effects.push({ type: 'reuse_last_session', endedAt: args.startedAt, confidence: args.confidence })
    state.stickyProjectId = args.projectId
    state.currentConfidence = args.confidence
    state.machine = args.projectId != null ? 'WORKING' : 'UNCERTAIN'
    state.switchCandidate = null
    state.lastCloseReason = null
    return
  }

  state.open = {
    projectId: args.projectId,
    startedAt: args.startedAt,
    activityLabel: args.activityLabel,
    source: args.source,
    confidence: args.confidence
  }
  effects.push({
    type: 'start_session',
    projectId: args.projectId,
    startedAt: args.startedAt,
    confidence: args.confidence,
    source: args.source,
    activityLabel: args.activityLabel
  })
  state.stickyProjectId = args.projectId
  state.currentConfidence = args.confidence
  state.machine = args.projectId != null ? 'WORKING' : 'UNCERTAIN'
  state.switchCandidate = null
}

function touch(state: EngineState, at: number, effects: EngineEffect[], confidence?: number): void {
  if (!state.open) return
  if (confidence != null) state.open.confidence = confidence
  effects.push({ type: 'touch_open_session', endedAt: at, confidence })
}

function holdExpired(hold: ProjectHold, now: number): boolean {
  return hold.expiresAt != null && now >= hold.expiresAt
}

function handleIdle(
  state: EngineState,
  event: ActivitySample,
  settings: EngineSettings,
  effects: EngineEffect[]
): void {
  const idleStartedAt = event.timestamp - event.idleSeconds * 1000
  const endedAt = idleStartedAt
  closeUnknown(state, endedAt, null, state.stickyProjectId, 0, effects)
  closeOpen(state, endedAt, 'afk', effects)
  state.hold = null
  state.switchCandidate = null
  state.stickyProjectId = null
  state.currentConfidence = 0
  state.machine = 'IDLE'
  pushLog(effects, [
    `[${new Date(event.timestamp).toISOString()}] AFK`,
    `idle_started_at=${new Date(endedAt).toISOString()}`,
    `threshold=${settings.idleThresholdMs}ms`
  ])
}

function confirmSwitch(
  state: EngineState,
  projectId: number,
  confidence: number,
  switchStartedAt: number,
  eventTs: number,
  effects: EngineEffect[],
  settings: EngineSettings
): void {
  closeOpen(state, switchStartedAt, 'switch', effects)
  startSession(
    state,
    {
      projectId,
      startedAt: switchStartedAt,
      confidence,
      source: 'auto',
      activityLabel: null
    },
    effects,
    settings
  )
  state.switchCandidate = null
  state.machine = 'WORKING'
  pushLog(effects, [
    `[${new Date(eventTs).toISOString()}] Switch confirmed`,
    `Old ended_at=${new Date(switchStartedAt).toISOString()}`,
    `New project=${projectId} started_at=${new Date(switchStartedAt).toISOString()}`
  ])
}

function handleSwitchCandidate(
  state: EngineState,
  projectId: number,
  confidence: number,
  timestamp: number,
  effects: EngineEffect[],
  settings: EngineSettings,
  evidenceLines: string[]
): void {
  if (!state.switchCandidate || state.switchCandidate.projectId !== projectId) {
    state.switchCandidate = { projectId, confidence, startedAt: timestamp }
    state.machine = 'SWITCH_PENDING'
    pushLog(effects, [
      `[${new Date(timestamp).toISOString()}]`,
      `Current project: ${state.stickyProjectId}`,
      `Candidate: ${projectId}`,
      `Confidence: ${confidence}`,
      'Evidence:',
      ...evidenceLines,
      'State: SWITCH_PENDING',
      `Switch started: ${new Date(timestamp).toISOString()}`
    ])
    touch(state, timestamp, effects)
    return
  }

  state.switchCandidate.confidence = confidence
  const elapsedSec = (timestamp - state.switchCandidate.startedAt) / 1000
  const delay = switchDelaySec(confidence, settings)
  if (elapsedSec >= delay) {
    confirmSwitch(state, projectId, confidence, state.switchCandidate.startedAt, timestamp, effects, settings)
    return
  }
  state.machine = 'SWITCH_PENDING'
  touch(state, timestamp, effects)
}

function applyHold(
  state: EngineState,
  event: ActivitySample,
  effects: EngineEffect[],
  settings: EngineSettings
): void {
  const hold = state.hold
  if (!hold) return
  const source: WorkSessionSource = hold.source === 'manual_timer' ? 'manual_timer' : 'lock'
  if (!state.open || state.open.source !== source || state.open.projectId !== hold.projectId) {
    closeUnknown(state, event.timestamp, hold.projectId, hold.projectId, 100, effects)
    closeOpen(state, event.timestamp, 'lock_end', effects)
    startSession(
      state,
      {
        projectId: hold.projectId,
        startedAt: event.timestamp,
        confidence: 100,
        source,
        activityLabel: hold.activityLabel
      },
      effects,
      settings
    )
    return
  }
  touch(state, event.timestamp, effects, 100)
  state.stickyProjectId = hold.projectId
  state.currentConfidence = 100
  state.machine = 'WORKING'
  state.switchCandidate = null
}

export function setHold(state: EngineState, hold: ProjectHold | null): EngineState {
  return { ...state, hold }
}

export function onActivity(
  state: EngineState,
  event: ActivitySample,
  classification: Classification,
  settings: EngineSettings
): { state: EngineState; effects: EngineEffect[] } {
  const next: EngineState = { ...state, hold: state.hold ? { ...state.hold } : null }
  if (next.open) next.open = { ...next.open }
  if (next.switchCandidate) next.switchCandidate = { ...next.switchCandidate }
  if (next.unknown) next.unknown = { ...next.unknown }
  if (next.lastClosed) next.lastClosed = { ...next.lastClosed }

  const effects: EngineEffect[] = []
  const idleMs = event.idleSeconds * 1000

  if (event.excluded) {
    closeUnknown(next, event.timestamp, null, next.stickyProjectId, 0, effects)
    closeOpen(next, event.timestamp, 'excluded', effects)
    next.switchCandidate = null
    next.machine = next.stickyProjectId != null ? 'UNCERTAIN' : 'IDLE'
    return { state: next, effects }
  }

  if (idleMs >= settings.idleThresholdMs) {
    handleIdle(next, event, settings, effects)
    return { state: next, effects }
  }

  if (next.hold && holdExpired(next.hold, event.timestamp)) {
    next.hold = null
    closeOpen(next, event.timestamp, 'lock_end', effects)
  }

  if (next.hold) {
    applyHold(next, event, effects, settings)
    return { state: next, effects }
  }

  const candidate = classification.candidateProjectId
  const confidence = classification.confidence
  const evidenceLines = classification.evidence.map((e) => `+${e.weight} ${e.signal}=${e.detail}`)

  if (next.stickyProjectId == null || !next.open) {
    if (candidate != null && confidence >= settings.startThreshold) {
      closeUnknown(next, event.timestamp, candidate, candidate, confidence, effects)
      startSession(
        next,
        {
          projectId: candidate,
          startedAt: event.timestamp,
          confidence,
          source: 'auto',
          activityLabel: null
        },
        effects,
        settings
      )
      next.machine = 'WORKING'
      return { state: next, effects }
    }
    next.machine = 'UNCERTAIN'
    beginUnknown(next, event, effects)
    return { state: next, effects }
  }

  if (candidate != null && candidate === next.stickyProjectId) {
    next.switchCandidate = null
    next.currentConfidence = Math.min(100, Math.max(next.currentConfidence, confidence))
    next.machine = 'WORKING'
    touch(next, event.timestamp, effects, next.currentConfidence)
    closeUnknown(next, event.timestamp, candidate, candidate, confidence, effects)
    return { state: next, effects }
  }

  if (classification.isNeutral) {
    next.switchCandidate = null
    next.currentConfidence = Math.max(0, next.currentConfidence - settings.confidenceDecay)
    next.machine = 'UNCERTAIN'
    touch(next, event.timestamp, effects, next.currentConfidence)
    return { state: next, effects }
  }

  if (candidate == null || confidence < settings.switchThreshold) {
    next.currentConfidence = Math.max(0, next.currentConfidence - settings.confidenceDecay)
    next.machine = 'UNCERTAIN'
    touch(next, event.timestamp, effects, next.currentConfidence)
    return { state: next, effects }
  }

  handleSwitchCandidate(next, candidate, confidence, event.timestamp, effects, settings, evidenceLines)
  return { state: next, effects }
}

export function onPause(state: EngineState, at: number): { state: EngineState; effects: EngineEffect[] } {
  const next: EngineState = { ...state }
  const effects: EngineEffect[] = []
  closeUnknown(next, at, null, next.stickyProjectId, 0, effects)
  closeOpen(next, at, 'pause', effects)
  next.switchCandidate = null
  next.hold = null
  next.stickyProjectId = null
  next.currentConfidence = 0
  next.machine = 'IDLE'
  return { state: next, effects }
}

export function onMidnightSplit(
  state: EngineState,
  midnight: number
): { state: EngineState; effects: EngineEffect[] } {
  const next: EngineState = { ...state }
  const effects: EngineEffect[] = []
  if (!next.open) return { state: next, effects }
  const projectId = next.open.projectId
  const confidence = next.open.confidence
  const activityLabel = next.open.activityLabel
  const source = next.open.source
  closeOpen(next, midnight, 'midnight', effects)
  next.lastCloseReason = 'midnight'
  startSession(
    next,
    { projectId, startedAt: midnight, confidence, source, activityLabel },
    effects,
    {
      idleThresholdMs: 0,
      startThreshold: 0,
      switchThreshold: 0,
      highConfidence: 95,
      mediumConfidence: 80,
      switchDelayHighSec: 30,
      switchDelayMediumSec: 45,
      switchDelayLowSec: 90,
      maxGapFillMs: 0,
      lockTimeoutMs: 0,
      confidenceDecay: 0
    }
  )
  return { state: next, effects }
}
