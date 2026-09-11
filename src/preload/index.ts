import { contextBridge, ipcRenderer } from 'electron'
import type { BeholderApi } from '../shared/types'

const api: BeholderApi = {
  getSnapshot: () => ipcRenderer.invoke('app:getSnapshot'),
  acceptPrivacy: () => ipcRenderer.invoke('app:acceptPrivacy'),
  setPaused: (paused) => ipcRenderer.invoke('app:setPaused', paused),
  getDashboard: (date) => ipcRenderer.invoke('dashboard:get', date),
  listSessions: (date) => ipcRenderer.invoke('sessions:list', date),
  updateTimes: (id, startMs, endMs) => ipcRenderer.invoke('sessions:updateTimes', id, startMs, endMs),
  deleteSession: (id) => ipcRenderer.invoke('sessions:delete', id),
  splitSession: (id, atMs) => ipcRenderer.invoke('sessions:split', id, atMs),
  mergeSessions: (firstId, secondId) => ipcRenderer.invoke('sessions:merge', firstId, secondId),
  assignSession: (payload) => ipcRenderer.invoke('sessions:assign', payload),
  listLegacySessions: (date) => ipcRenderer.invoke('legacy:list', date),
  listEvents: (date) => ipcRenderer.invoke('events:list', date),
  listUnknown: (date) => ipcRenderer.invoke('unknown:list', date),
  assignUnknown: (id, projectId, activityLabel) => ipcRenderer.invoke('unknown:assign', id, projectId, activityLabel),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (name) => ipcRenderer.invoke('projects:create', name),
  listRules: () => ipcRenderer.invoke('rules:list'),
  createRule: (ruleType, ruleValue, projectId, weight) =>
    ipcRenderer.invoke('rules:create', ruleType, ruleValue, projectId, weight),
  deleteRule: (id) => ipcRenderer.invoke('rules:delete', id),
  setLock: (projectId) => ipcRenderer.invoke('lock:set', projectId),
  clearLock: () => ipcRenderer.invoke('lock:clear'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  addExcluded: (processName) => ipcRenderer.invoke('excluded:add', processName),
  removeExcluded: (processName) => ipcRenderer.invoke('excluded:remove', processName),
  startTimer: (payload) => ipcRenderer.invoke('timer:start', payload),
  stopTimer: () => ipcRenderer.invoke('timer:stop'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onChanged: (cb) => {
    const handler = (): void => cb()
    ipcRenderer.on('app:changed', handler)
    return () => ipcRenderer.removeListener('app:changed', handler)
  },
  onOpen: (cb) => {
    const handler = (_e: unknown, page: 'dashboard' | 'timeline' | 'timer'): void => cb(page)
    ipcRenderer.on('ui:open', handler)
    return () => ipcRenderer.removeListener('ui:open', handler)
  }
}

contextBridge.exposeInMainWorld('beholder', api)

export type { BeholderApi }
