export type TrackingStatus = 'running' | 'paused' | 'idle_pending' | 'manual'

export type SessionOrigin = 'auto' | 'manual_timer' | 'idle_detection'

export type ClassificationSource =
  | 'user_rule'
  | 'cursor_builtin'
  | 'unclassified'
  | 'manual'
  | 'idle'

export type MatchType = 'process' | 'title_contains' | 'repo'

export type AppSnapshot = {
  trackingStatus: TrackingStatus
  privacyAccepted: boolean
  currentContextLabel: string
  idlePendingCount: number
  manualTimer: { activityLabel: string; projectName: string | null; startedAt: number } | null
  pollIntervalMs: number
  idleThresholdMs: number
}

export type Project = {
  id: number
  name: string
}

export type Session = {
  id: number
  startMs: number
  endMs: number
  durationMs: number
  processName: string
  windowTitle: string
  repoSlug: string | null
  projectId: number | null
  projectName: string | null
  activityLabel: string | null
  origin: SessionOrigin
  classificationSource: ClassificationSource
}

export type Mapping = {
  id: number
  matchType: MatchType
  pattern: string
  projectId: number
  projectName: string
  priority: number
}

export type DashboardDay = {
  date: string
  totalMs: number
  manualMs: number
  unclassifiedMs: number
  idleMs: number
  byProject: { projectId: number | null; name: string; ms: number }[]
}

export type AppSettings = {
  pollIntervalMs: number
  idleThresholdMs: number
  excludedProcesses: string[]
}

export type StartTimerPayload = {
  activityLabel: string
  projectId: number | null
}

export type AssignPayload = {
  sessionId: number
  projectId: number | null
  activityLabel?: string | null
  remember?: boolean
}
