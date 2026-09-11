export type RuleType =
  | 'folder'
  | 'domain'
  | 'keyword'
  | 'repository'
  | 'window_title'
  | 'working_directory'
  | 'clickup_task'
  | 'process'

export type MachineState = 'IDLE' | 'WORKING' | 'UNCERTAIN' | 'SWITCH_PENDING'

export type WorkSessionSource = 'auto' | 'manual_timer' | 'lock' | 'override'

export type CloseReason = 'switch' | 'afk' | 'pause' | 'excluded' | 'midnight' | 'lock_end' | 'unknown' | 'stop'

export type ActivitySample = {
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
  excluded?: boolean
}

export type ProjectRule = {
  id: number
  projectId: number
  ruleType: RuleType
  ruleValue: string
  weight: number
}

export type Evidence = {
  signal: string
  weight: number
  detail: string
}

export type Classification = {
  scores: Map<number, number>
  evidenceByProject: Map<number, Evidence[]>
  candidateProjectId: number | null
  confidence: number
  evidence: Evidence[]
  isNeutral: boolean
}

export type EngineSettings = {
  idleThresholdMs: number
  startThreshold: number
  switchThreshold: number
  highConfidence: number
  mediumConfidence: number
  switchDelayHighSec: number
  switchDelayMediumSec: number
  switchDelayLowSec: number
  maxGapFillMs: number
  lockTimeoutMs: number
  confidenceDecay: number
}

export type OpenWork = {
  projectId: number | null
  startedAt: number
  activityLabel: string | null
  source: WorkSessionSource
  confidence: number
}

export type SwitchCandidate = {
  projectId: number
  confidence: number
  startedAt: number
}

export type ProjectHold = {
  projectId: number | null
  activityLabel: string | null
  startedAt: number
  expiresAt: number | null
  source: 'lock' | 'manual_timer'
}

export type OpenUnknown = {
  startedAt: number
  processName: string | null
  windowTitle: string | null
  url: string | null
  previousProjectId: number | null
}

export type EngineState = {
  machine: MachineState
  stickyProjectId: number | null
  currentConfidence: number
  open: OpenWork | null
  switchCandidate: SwitchCandidate | null
  hold: ProjectHold | null
  unknown: OpenUnknown | null
  lastCloseReason: CloseReason | null
  lastClosed: { projectId: number | null; endedAt: number; source: WorkSessionSource } | null
}

export type EngineEffect =
  | { type: 'close_open_session'; endedAt: number }
  | {
      type: 'start_session'
      projectId: number | null
      startedAt: number
      confidence: number
      source: WorkSessionSource
      activityLabel: string | null
    }
  | { type: 'reuse_last_session'; endedAt: number; confidence: number }
  | { type: 'touch_open_session'; endedAt: number; confidence?: number }
  | { type: 'begin_unknown'; startedAt: number }
  | {
      type: 'close_unknown'
      endedAt: number
      nextProjectId: number | null
      suggestedProjectId: number | null
      confidence: number
    }
  | { type: 'debug_log'; lines: string[] }
