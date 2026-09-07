import { BrowserWindow, Menu, app, ipcMain } from 'electron'
import type { AssignPayload, MatchType, StartTimerPayload } from '../shared/types'
import { openDatabase, persistNow, setSetting, setting } from './db'
import { broadcastChanged } from './notify'
import {
  addExcluded,
  assignSession,
  createMapping,
  createProject,
  dashboardForDay,
  deleteMapping,
  deleteSession,
  listExcluded,
  listMappings,
  listProjects,
  listSessionsForDay,
  mergeSessions,
  removeExcluded,
  splitSession,
  updateSessionTimes
} from './queries'
import { loadConfig, updateConfig } from './store'
import { createTray, getTray } from './tray'
import {
  rememberAssignment,
  restartTrackerInterval,
  setPaused,
  snapshot,
  startManualTimer,
  startTracker,
  stopManualTimer,
  stopTracker
} from './tracker'
import { createMainWindow, isQuitAllowed, setAllowQuit, showMainWindow } from './windows'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })
}

function registerIpc(): void {
  ipcMain.handle('app:getSnapshot', () => snapshot())
  ipcMain.handle('app:acceptPrivacy', async () => {
    updateConfig({ privacyAccepted: true })
    await bootTracking()
    return snapshot()
  })
  ipcMain.handle('app:setPaused', (_e, paused: boolean) => {
    setPaused(paused)
    updateConfig({ trackingPaused: paused })
    return snapshot()
  })
  ipcMain.handle('dashboard:get', (_e, date: string) => dashboardForDay(date))
  ipcMain.handle('sessions:list', (_e, date: string) => listSessionsForDay(date))
  ipcMain.handle('sessions:updateTimes', (_e, id: number, startMs: number, endMs: number) => {
    updateSessionTimes(id, startMs, endMs)
    broadcastChanged()
  })
  ipcMain.handle('sessions:delete', (_e, id: number) => {
    deleteSession(id)
    broadcastChanged()
  })
  ipcMain.handle('sessions:split', (_e, id: number, atMs: number) => {
    splitSession(id, atMs)
    broadcastChanged()
  })
  ipcMain.handle('sessions:merge', (_e, firstId: number, secondId: number) => {
    mergeSessions(firstId, secondId)
    broadcastChanged()
  })
  ipcMain.handle('sessions:assign', (_e, payload: AssignPayload) => {
    if (payload.remember && payload.projectId) {
      rememberAssignment(payload.sessionId, payload.projectId)
    } else {
      assignSession(
        payload.sessionId,
        payload.projectId,
        payload.activityLabel ?? null,
        payload.projectId ? 'user_rule' : 'unclassified'
      )
    }
    broadcastChanged()
  })
  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:create', (_e, name: string) => createProject(name))
  ipcMain.handle('mappings:list', () => listMappings())
  ipcMain.handle('mappings:create', (_e, matchType: MatchType, pattern: string, projectId: number) => {
    createMapping(matchType, pattern, projectId, 10)
    broadcastChanged()
  })
  ipcMain.handle('mappings:delete', (_e, id: number) => {
    deleteMapping(id)
    broadcastChanged()
  })
  ipcMain.handle('settings:get', () => ({
    pollIntervalMs: Number(setting('poll_interval_ms', '3000')),
    idleThresholdMs: Number(setting('idle_threshold_ms', '300000')),
    excludedProcesses: listExcluded()
  }))
  ipcMain.handle('settings:update', (_e, patch: { pollIntervalMs?: number; idleThresholdMs?: number }) => {
    if (patch.pollIntervalMs) {
      const v = Math.min(15000, Math.max(1000, patch.pollIntervalMs))
      setSetting('poll_interval_ms', String(v))
      restartTrackerInterval()
    }
    if (patch.idleThresholdMs) {
      const v = Math.min(60 * 60 * 1000, Math.max(60 * 1000, patch.idleThresholdMs))
      setSetting('idle_threshold_ms', String(v))
    }
    broadcastChanged()
  })
  ipcMain.handle('excluded:add', (_e, processName: string) => {
    addExcluded(processName)
    broadcastChanged()
  })
  ipcMain.handle('excluded:remove', (_e, processName: string) => {
    removeExcluded(processName)
    broadcastChanged()
  })
  ipcMain.handle('timer:start', (_e, payload: StartTimerPayload) => {
    const project = payload.projectId ? listProjects().find((p) => p.id === payload.projectId) : null
    startManualTimer(payload, project?.name ?? null)
    return snapshot()
  })
  ipcMain.handle('timer:stop', () => {
    stopManualTimer()
    return snapshot()
  })
  ipcMain.handle('window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })
  ipcMain.handle('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('window:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })
  ipcMain.handle('app:quit', () => {
    setAllowQuit(true)
    app.quit()
  })
}

async function bootTracking(): Promise<void> {
  await openDatabase()
  startTracker(loadConfig().trackingPaused)
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  registerIpc()
  createTray()
  const config = loadConfig()
  if (config.privacyAccepted) {
    await bootTracking()
  }
  createMainWindow()
})

app.on('before-quit', () => {
  setAllowQuit(true)
  try {
    stopTracker()
    persistNow()
  } catch {
    // db may not be open yet
  }
  updateConfig({ trackingPaused: loadConfig().trackingPaused })
})

app.on('window-all-closed', () => {
  if (!getTray() && isQuitAllowed()) app.quit()
})
