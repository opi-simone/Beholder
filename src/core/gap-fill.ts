import type { CloseReason, EngineSettings } from './types'

export type ClosedSession = {
  projectId: number | null
  startedAt: number
  endedAt: number
  source: string
  closeReason?: CloseReason | null
}

export type UnknownInterval = {
  startedAt: number
  endedAt: number
  previousProjectId: number | null
  nextProjectId: number | null
}

export function shouldGapFill(args: {
  previous: ClosedSession | null
  nextProjectId: number | null
  nextStartedAt: number
  nextSource: string
  maxGapFillMs: number
}): boolean {
  const { previous, nextProjectId, nextStartedAt, nextSource, maxGapFillMs } = args
  if (!previous || nextProjectId == null) return false
  if (nextSource !== 'auto' || previous.source !== 'auto') return false
  if (previous.projectId !== nextProjectId) return false
  if (previous.closeReason === 'afk' || previous.closeReason === 'pause' || previous.closeReason === 'excluded') {
    return false
  }
  if (previous.closeReason === 'midnight') return false
  const gap = nextStartedAt - previous.endedAt
  return gap >= 0 && gap <= maxGapFillMs
}

export function unknownCanAutoAssign(unknown: UnknownInterval, settings: Pick<EngineSettings, 'maxGapFillMs'>): boolean {
  if (unknown.previousProjectId == null || unknown.nextProjectId == null) return false
  if (unknown.previousProjectId !== unknown.nextProjectId) return false
  return unknown.endedAt - unknown.startedAt <= settings.maxGapFillMs
}
