import { describe, expect, it } from 'vitest'
import { classifyActivity } from './classifier'
import { isNeutralContext } from './neutral'
import { extractCursorRepo, extractPathFromText } from './signals'
import type { ActivitySample, ProjectRule } from './types'

const rules: ProjectRule[] = [
  { id: 1, projectId: 1, ruleType: 'repository', ruleValue: 'cliente-a', weight: 100 },
  { id: 2, projectId: 1, ruleType: 'domain', ruleValue: 'cliente-a.it', weight: 90 },
  { id: 3, projectId: 1, ruleType: 'process', ruleValue: 'firefox.exe', weight: 0 }
]

function sample(partial: Partial<ActivitySample>): ActivitySample {
  return {
    timestamp: 0,
    processName: null,
    windowTitle: null,
    executablePath: null,
    url: null,
    workspacePath: null,
    gitRepository: null,
    workingDirectory: null,
    clickupTaskId: null,
    idleSeconds: 0,
    ...partial
  }
}

describe('classifier', () => {
  it('scores Cursor workspace as the matching project', () => {
    const result = classifyActivity(
      sample({
        processName: 'Cursor.exe',
        windowTitle: 'file.ts - cliente-a - Cursor',
        workspacePath: 'C:\\dev\\cliente-a',
        gitRepository: 'cliente-a'
      }),
      rules,
      null
    )
    expect(result.candidateProjectId).toBe(1)
    expect(result.confidence).toBe(100)
    expect(result.evidence.some((e) => e.signal === 'repository')).toBe(true)
  })

  it('scores a client domain in the browser', () => {
    const result = classifyActivity(
      sample({
        processName: 'firefox.exe',
        windowTitle: 'Homepage - Cliente A',
        url: 'https://staging.cliente-a.it/app'
      }),
      rules,
      null
    )
    expect(result.candidateProjectId).toBe(1)
    expect(result.confidence).toBe(90)
  })

  it('ignores process rules with weight 0', () => {
    const result = classifyActivity(
      sample({ processName: 'firefox.exe', windowTitle: 'Mozilla Firefox' }),
      rules,
      null
    )
    expect(result.candidateProjectId).toBeNull()
    expect(result.confidence).toBe(0)
  })

  it('adds last-project bonus to the sticky project', () => {
    const result = classifyActivity(
      sample({ processName: 'ChatGPT.exe', windowTitle: 'ChatGPT' }),
      rules,
      1
    )
    expect(result.scores.get(1)).toBe(20)
  })
})

describe('neutral context', () => {
  it('treats ChatGPT and StackOverflow as neutral', () => {
    expect(isNeutralContext(sample({ processName: 'ChatGPT.exe', windowTitle: 'ChatGPT' }), rules)).toBe(true)
    expect(
      isNeutralContext(
        sample({
          processName: 'chrome.exe',
          windowTitle: 'javascript - Stack Overflow',
          url: 'https://stackoverflow.com/questions/1'
        }),
        rules
      )
    ).toBe(true)
  })

  it('does not treat a client staging site as neutral', () => {
    expect(
      isNeutralContext(
        sample({
          processName: 'chrome.exe',
          windowTitle: 'Cliente A',
          url: 'https://staging.cliente-a.it'
        }),
        rules
      )
    ).toBe(false)
  })
})

describe('signals', () => {
  it('extracts a Cursor workspace folder', () => {
    expect(extractCursorRepo('● index.ts - beholder - Cursor')).toBe('beholder')
  })

  it('extracts a PowerShell working directory', () => {
    expect(extractPathFromText('PS C:\\Dev\\beholder>')).toBe('C:\\Dev\\beholder')
  })
})
