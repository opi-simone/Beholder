import { describe, expect, it } from 'vitest'
import { classifyActivity } from './classifier'
import { DEFAULT_SETTINGS } from './defaults'
import { initialEngineState, onActivity, onPause } from './engine'
import { shouldGapFill, unknownCanAutoAssign } from './gap-fill'
import type { ActivitySample, EngineEffect, EngineState, ProjectRule, WorkSessionSource } from './types'

const A = 1
const B = 2

const rules: ProjectRule[] = [
  { id: 1, projectId: A, ruleType: 'repository', ruleValue: 'cliente-a', weight: 100 },
  { id: 2, projectId: A, ruleType: 'domain', ruleValue: 'cliente-a.it', weight: 90 },
  { id: 3, projectId: A, ruleType: 'keyword', ruleValue: 'cliente a', weight: 50 },
  { id: 4, projectId: B, ruleType: 'repository', ruleValue: 'cliente-b', weight: 100 },
  { id: 5, projectId: B, ruleType: 'keyword', ruleValue: 'cliente-b', weight: 50 }
]

function cursor(ts: number, repo: string): ActivitySample {
  return {
    timestamp: ts,
    processName: 'Cursor.exe',
    windowTitle: `index.ts - ${repo} - Cursor`,
    executablePath: 'C:\\Users\\me\\AppData\\Local\\Programs\\cursor\\Cursor.exe',
    url: null,
    workspacePath: `C:\\dev\\${repo}`,
    gitRepository: repo,
    workingDirectory: `C:\\dev\\${repo}`,
    clickupTaskId: null,
    idleSeconds: 0
  }
}

function chrome(ts: number, title: string, url: string | null): ActivitySample {
  return {
    timestamp: ts,
    processName: 'chrome.exe',
    windowTitle: title,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\chrome.exe',
    url,
    workspacePath: null,
    gitRepository: null,
    workingDirectory: null,
    clickupTaskId: null,
    idleSeconds: 0
  }
}

function chatGpt(ts: number): ActivitySample {
  return {
    timestamp: ts,
    processName: 'ChatGPT.exe',
    windowTitle: 'ChatGPT',
    executablePath: null,
    url: 'https://chatgpt.com',
    workspacePath: null,
    gitRepository: null,
    workingDirectory: null,
    clickupTaskId: null,
    idleSeconds: 0
  }
}

function idle(ts: number, idleSeconds: number, lastWindow: ActivitySample): ActivitySample {
  return { ...lastWindow, timestamp: ts, idleSeconds }
}

type MemSession = {
  id: number
  projectId: number | null
  startedAt: number
  endedAt: number
  source: WorkSessionSource
}

function apply(
  state: EngineState,
  effects: EngineEffect[],
  sessions: MemSession[],
  openId: { n: number | null },
  nextId: { n: number }
): void {
  for (const effect of effects) {
    if (effect.type === 'close_open_session' && openId.n != null) {
      const row = sessions.find((s) => s.id === openId.n)
      if (row) row.endedAt = effect.endedAt
      openId.n = null
    }
    if (effect.type === 'start_session') {
      const row: MemSession = {
        id: nextId.n++,
        projectId: effect.projectId,
        startedAt: effect.startedAt,
        endedAt: effect.startedAt,
        source: effect.source
      }
      sessions.push(row)
      openId.n = row.id
    }
    if (effect.type === 'reuse_last_session') {
      const last = [...sessions].reverse().find((s) => s.source === 'auto')
      if (last) {
        last.endedAt = effect.endedAt
        openId.n = last.id
      }
    }
    if (effect.type === 'touch_open_session' && openId.n != null) {
      const row = sessions.find((s) => s.id === openId.n)
      if (row) row.endedAt = effect.endedAt
    }
  }
}

function play(samples: ActivitySample[]): { state: EngineState; sessions: MemSession[] } {
  let state = initialEngineState()
  const sessions: MemSession[] = []
  const openId = { n: null as number | null }
  const nextId = { n: 1 }
  for (const sample of samples) {
    const classification = classifyActivity(sample, rules, state.stickyProjectId)
    const out = onActivity(state, sample, classification, DEFAULT_SETTINGS)
    state = out.state
    apply(state, out.effects, sessions, openId, nextId)
  }
  return { state, sessions }
}

function span(from: number, to: number, every: number, make: (ts: number) => ActivitySample): ActivitySample[] {
  const out: ActivitySample[] = []
  for (let ts = from; ts <= to; ts += every) out.push(make(ts))
  return out
}

const STEP = 2000

describe('acceptance', () => {
  it('case 1: Cursor A → Chrome A → ChatGPT → Cursor A is one WorkSession', () => {
    const t0 = 1_000_000
    const samples = [
      ...span(t0, t0 + 60_000, STEP, (ts) => cursor(ts, 'cliente-a')),
      ...span(t0 + 62_000, t0 + 120_000, STEP, (ts) =>
        chrome(ts, 'Homepage - Cliente A', 'https://staging.cliente-a.it')
      ),
      ...span(t0 + 122_000, t0 + 180_000, STEP, (ts) => chatGpt(ts)),
      ...span(t0 + 182_000, t0 + 240_000, STEP, (ts) => cursor(ts, 'cliente-a'))
    ]
    const { sessions, state } = play(samples)
    const auto = sessions.filter((s) => s.source === 'auto')
    expect(auto).toHaveLength(1)
    expect(auto[0].projectId).toBe(A)
    expect(state.stickyProjectId).toBe(A)
  })

  it('case 2: ChatGPT for 3 minutes stays on A', () => {
    const t0 = 1_000_000
    const samples = [
      ...span(t0, t0 + 30_000, STEP, (ts) => cursor(ts, 'cliente-a')),
      ...span(t0 + 32_000, t0 + 212_000, STEP, (ts) => chatGpt(ts)),
      ...span(t0 + 214_000, t0 + 260_000, STEP, (ts) => cursor(ts, 'cliente-a'))
    ]
    const { sessions } = play(samples)
    expect(sessions.filter((s) => s.source === 'auto')).toHaveLength(1)
    expect(sessions[0].projectId).toBe(A)
  })

  it('case 3: 20s of Cursor B does not switch', () => {
    const t0 = 1_000_000
    const samples = [
      ...span(t0, t0 + 60_000, STEP, (ts) => cursor(ts, 'cliente-a')),
      ...span(t0 + 62_000, t0 + 82_000, STEP, (ts) => cursor(ts, 'cliente-b')),
      ...span(t0 + 84_000, t0 + 140_000, STEP, (ts) => cursor(ts, 'cliente-a'))
    ]
    const { sessions, state } = play(samples)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].projectId).toBe(A)
    expect(state.machine).not.toBe('SWITCH_PENDING')
  })

  it('case 4: 3 minutes of Cursor B switches retroactively', () => {
    const t0 = 1_000_000
    const bStart = t0 + 60_000
    const samples = [
      ...span(t0, t0 + 58_000, STEP, (ts) => cursor(ts, 'cliente-a')),
      ...span(bStart, bStart + 180_000, STEP, (ts) => cursor(ts, 'cliente-b'))
    ]
    const { sessions } = play(samples)
    expect(sessions).toHaveLength(2)
    expect(sessions[0].projectId).toBe(A)
    expect(sessions[0].endedAt).toBe(bStart)
    expect(sessions[1].projectId).toBe(B)
    expect(sessions[1].startedAt).toBe(bStart)
  })

  it('case 5: 15 min AFK closes retroactively and starts a new session', () => {
    const t0 = 1_000_000
    const lastActive = t0 + 40_000
    const afkTick = lastActive + 15 * 60_000
    const back = afkTick + 2000
    const samples = [
      ...span(t0, lastActive, STEP, (ts) => cursor(ts, 'cliente-a')),
      idle(afkTick, 15 * 60, cursor(afkTick, 'cliente-a')),
      ...span(back, back + 20_000, STEP, (ts) => cursor(ts, 'cliente-a'))
    ]
    const { sessions } = play(samples)
    expect(sessions.length).toBeGreaterThanOrEqual(2)
    expect(sessions[0].endedAt).toBe(afkTick - 15 * 60_000)
    expect(sessions[1].startedAt).toBe(back)
    expect(sessions[1].projectId).toBe(A)
  })

  it('case 6: unknown gap under 5 min between A and A is filled', () => {
    expect(
      shouldGapFill({
        previous: {
          projectId: A,
          startedAt: 0,
          endedAt: 10_000,
          source: 'auto',
          closeReason: 'unknown'
        },
        nextProjectId: A,
        nextStartedAt: 10_000 + 3 * 60_000,
        nextSource: 'auto',
        maxGapFillMs: DEFAULT_SETTINGS.maxGapFillMs
      })
    ).toBe(true)
  })

  it('case 7: unknown between A and B is not auto-assigned', () => {
    expect(
      unknownCanAutoAssign(
        {
          startedAt: 10_000,
          endedAt: 40_000,
          previousProjectId: A,
          nextProjectId: B
        },
        DEFAULT_SETTINGS
      )
    ).toBe(false)
    expect(
      shouldGapFill({
        previous: {
          projectId: A,
          startedAt: 0,
          endedAt: 10_000,
          source: 'auto',
          closeReason: 'unknown'
        },
        nextProjectId: B,
        nextStartedAt: 40_000,
        nextSource: 'auto',
        maxGapFillMs: DEFAULT_SETTINGS.maxGapFillMs
      })
    ).toBe(false)
  })

  it('pause does not gap-fill', () => {
    expect(
      shouldGapFill({
        previous: {
          projectId: A,
          startedAt: 0,
          endedAt: 10_000,
          source: 'auto',
          closeReason: 'pause'
        },
        nextProjectId: A,
        nextStartedAt: 12_000,
        nextSource: 'auto',
        maxGapFillMs: DEFAULT_SETTINGS.maxGapFillMs
      })
    ).toBe(false)
  })
})

describe('onPause', () => {
  it('closes the open session', () => {
    const t0 = 1_000_000
    let state = initialEngineState()
    const sessions: MemSession[] = []
    const openId = { n: null as number | null }
    const nextId = { n: 1 }
    for (const sample of span(t0, t0 + 10_000, STEP, (ts) => cursor(ts, 'cliente-a'))) {
      const classification = classifyActivity(sample, rules, state.stickyProjectId)
      const out = onActivity(state, sample, classification, DEFAULT_SETTINGS)
      state = out.state
      apply(state, out.effects, sessions, openId, nextId)
    }
    const paused = onPause(state, t0 + 12_000)
    apply(paused.state, paused.effects, sessions, openId, nextId)
    expect(paused.state.open).toBeNull()
    expect(sessions[0].endedAt).toBe(t0 + 12_000)
  })
})
