import type { EngineSettings, RuleType } from './types'

/** High delay is 30s so a 20s glance at another project does not confirm a switch. */
export const DEFAULT_SETTINGS: EngineSettings = {
  idleThresholdMs: 300_000,
  startThreshold: 60,
  switchThreshold: 70,
  highConfidence: 95,
  mediumConfidence: 80,
  switchDelayHighSec: 30,
  switchDelayMediumSec: 45,
  switchDelayLowSec: 90,
  maxGapFillMs: 300_000,
  lockTimeoutMs: 3_600_000,
  confidenceDecay: 5
}

export const DEFAULT_WEIGHTS: Record<RuleType, number> = {
  folder: 80,
  domain: 90,
  keyword: 50,
  repository: 100,
  window_title: 50,
  working_directory: 80,
  clickup_task: 100,
  process: 0
}

export const LAST_PROJECT_BONUS = 20

export const ACTIVITY_POLL_INTERVAL_MS = 2000
