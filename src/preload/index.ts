import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  AppSnapshot,
  AssignPayload,
  DashboardDay,
  Mapping,
  MatchType,
  Project,
  Session,
  StartTimerPayload
} from '../shared/types'

const api = {
  getSnapshot: (): Promise<AppSnapshot> => ipcRenderer.invoke('app:getSnapshot'),
  acceptPrivacy: (): Promise<AppSnapshot> => ipcRenderer.invoke('app:acceptPrivacy'),
  setPaused: (paused: boolean): Promise<AppSnapshot> => ipcRenderer.invoke('app:setPaused', paused),
  getDashboard: (date: string): Promise<DashboardDay> => ipcRenderer.invoke('dashboard:get', date),
  listSessions: (date: string): Promise<Session[]> => ipcRenderer.invoke('sessions:list', date),
  updateTimes: (id: number, startMs: number, endMs: number): Promise<void> =>
    ipcRenderer.invoke('sessions:updateTimes', id, startMs, endMs),
  deleteSession: (id: number): Promise<void> => ipcRenderer.invoke('sessions:delete', id),
  splitSession: (id: number, atMs: number): Promise<void> => ipcRenderer.invoke('sessions:split', id, atMs),
  mergeSessions: (firstId: number, secondId: number): Promise<void> =>
    ipcRenderer.invoke('sessions:merge', firstId, secondId),
  assignSession: (payload: AssignPayload): Promise<void> => ipcRenderer.invoke('sessions:assign', payload),
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
  createProject: (name: string): Promise<Project> => ipcRenderer.invoke('projects:create', name),
  listMappings: (): Promise<Mapping[]> => ipcRenderer.invoke('mappings:list'),
  createMapping: (matchType: MatchType, pattern: string, projectId: number): Promise<void> =>
    ipcRenderer.invoke('mappings:create', matchType, pattern, projectId),
  deleteMapping: (id: number): Promise<void> => ipcRenderer.invoke('mappings:delete', id),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: {
    pollIntervalMs?: number
    idleThresholdMs?: number
    minSessionMs?: number
    switchDebounceMs?: number
    resumeGapMs?: number
  }): Promise<void> => ipcRenderer.invoke('settings:update', patch),
  addExcluded: (processName: string): Promise<void> => ipcRenderer.invoke('excluded:add', processName),
  removeExcluded: (processName: string): Promise<void> => ipcRenderer.invoke('excluded:remove', processName),
  startTimer: (payload: StartTimerPayload): Promise<AppSnapshot> => ipcRenderer.invoke('timer:start', payload),
  stopTimer: (): Promise<AppSnapshot> => ipcRenderer.invoke('timer:stop'),
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  onChanged: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('app:changed', handler)
    return () => ipcRenderer.removeListener('app:changed', handler)
  },
  onOpen: (cb: (page: 'dashboard' | 'timeline' | 'timer') => void): (() => void) => {
    const handler = (_e: unknown, page: 'dashboard' | 'timeline' | 'timer'): void => cb(page)
    ipcRenderer.on('ui:open', handler)
    return () => ipcRenderer.removeListener('ui:open', handler)
  }
}

contextBridge.exposeInMainWorld('beholder', api)

export type BeholderApi = typeof api
