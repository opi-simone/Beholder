export type TrackingStatus = 'running' | 'paused' | 'idle_pending' | 'manual' | 'locked'

export type MachineState = 'IDLE' | 'WORKING' | 'UNCERTAIN' | 'SWITCH_PENDING'

export type WorkSessionSource = 'auto' | 'manual_timer' | 'lock' | 'override'

export type SessionOrigin = 'auto' | 'manual_timer' | 'idle_detection'

export type ClassificationSource =
  | 'user_rule'
  | 'cursor_builtin'
  | 'unclassified'
  | 'manual'
  | 'idle'

export type MatchType = 'process' | 'title_contains' | 'repo'

export type RuleType =
  | 'folder'
  | 'domain'
  | 'keyword'
  | 'repository'
  | 'window_title'
  | 'working_directory'
  | 'clickup_task'
  | 'process'

export type AppSnapshot = {
  trackingStatus: TrackingStatus
  privacyAccepted: boolean
  currentContextLabel: string
  machineState: MachineState
  stickyProjectName: string | null
  unknownCount: number
  idlePendingCount: number
  manualTimer: { activityLabel: string; projectName: string | null; startedAt: number } | null
  projectLock: { projectId: number | null; projectName: string | null; expiresAt: number | null } | null
  pollIntervalMs: number
  idleThresholdMs: number
}

export type Project = {
  id: number
  name: string
}

export type WorkSession = {
  id: number
  projectId: number | null
  projectName: string | null
  activityLabel: string | null
  startedAt: number
  endedAt: number
  durationMs: number
  confidence: number
  source: WorkSessionSource
  status: 'open' | 'closed'
}

export type UnknownActivity = {
  id: number
  startedAt: number
  endedAt: number
  processName: string | null
  windowTitle: string | null
  url: string | null
  previousProjectId: number | null
  previousProjectName: string | null
  nextProjectId: number | null
  nextProjectName: string | null
  suggestedProjectId: number | null
  suggestedProjectName: string | null
  confidence: number | null
}

export type ActivityEventView = {
  id: number
  timestamp: number
  processName: string | null
  windowTitle: string | null
  url: string | null
  workspacePath: string | null
  gitRepository: string | null
  workingDirectory: string | null
  idleSeconds: number
  candidateProjectId: number | null
  candidateProjectName: string | null
  confidence: number | null
  evidence: string | null
  machineState: string | null
  isNeutral: boolean
}

/** Frozen pre-redesign window block. */
export type LegacySession = {
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

/** @deprecated Use WorkSession. Kept as alias for leftover imports. */
export type Session = LegacySession

export type Mapping = {
  id: number
  matchType: MatchType
  pattern: string
  projectId: number
  projectName: string
  priority: number
}

export type ProjectRuleView = {
  id: number
  projectId: number
  projectName: string
  ruleType: RuleType
  ruleValue: string
  weight: number
}

export type DashboardDay = {
  date: string
  totalMs: number
  manualMs: number
  unclassifiedMs: number
  unknownMs: number
  idleMs: number
  byProject: {
    projectId: number | null
    name: string
    ms: number
    byLabel: { label: string; ms: number }[]
  }[]
}

export type AppSettings = {
  pollIntervalMs: number
  idleThresholdMs: number
  startThreshold: number
  switchThreshold: number
  highConfidence: number
  mediumConfidence: number
  switchDelayHighSec: number
  switchDelayMediumSec: number
  switchDelayLowSec: number
  maxGapFillSec: number
  lockTimeoutMin: number
  confidenceDecay: number
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

export type BeholderApi = {
  getSnapshot: () => Promise<AppSnapshot>
  acceptPrivacy: () => Promise<AppSnapshot>
  setPaused: (paused: boolean) => Promise<AppSnapshot>
  getDashboard: (date: string) => Promise<DashboardDay>
  listSessions: (date: string) => Promise<WorkSession[]>
  updateTimes: (id: number, startMs: number, endMs: number) => Promise<void>
  deleteSession: (id: number) => Promise<void>
  splitSession: (id: number, atMs: number) => Promise<void>
  mergeSessions: (firstId: number, secondId: number) => Promise<void>
  assignSession: (payload: AssignPayload) => Promise<void>
  listLegacySessions: (date: string) => Promise<LegacySession[]>
  listEvents: (date: string) => Promise<ActivityEventView[]>
  listUnknown: (date: string) => Promise<UnknownActivity[]>
  assignUnknown: (id: number, projectId: number, activityLabel: string | null) => Promise<void>
  listProjects: () => Promise<Project[]>
  createProject: (name: string) => Promise<Project>
  listRules: () => Promise<ProjectRuleView[]>
  createRule: (ruleType: RuleType, ruleValue: string, projectId: number, weight?: number) => Promise<void>
  deleteRule: (id: number) => Promise<void>
  setLock: (projectId: number) => Promise<AppSnapshot>
  clearLock: () => Promise<AppSnapshot>
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  addExcluded: (processName: string) => Promise<void>
  removeExcluded: (processName: string) => Promise<void>
  startTimer: (payload: StartTimerPayload) => Promise<AppSnapshot>
  stopTimer: () => Promise<AppSnapshot>
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  closeWindow: () => Promise<void>
  quit: () => Promise<void>
  onChanged: (cb: () => void) => () => void
  onOpen: (cb: (page: 'dashboard' | 'timeline' | 'timer') => void) => () => void
}
