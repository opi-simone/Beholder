import { BrowserWindow, Menu, app, ipcMain } from 'electron'
import type { AssignPayload, RuleType, StartTimerPayload } from '../shared/types'
import { defaultWeight } from './classification-weights'
import { openDatabase, persistNow, setSetting, setting } from './db'
import { broadcastChanged } from './notify'
import {
  addExcluded,
  createProject,
  listExcluded,
  listProjects,
  listSessionsForDay,
  removeExcluded
} from './queries'
import { loadConfig, updateConfig } from './store'
import { createTray, getTray } from './tray'
import {
  clearProjectLock,
  rememberAssignment,
  restartTrackerInterval,
  setPaused,
  setProjectLock,
  snapshot,
  startManualTimer,
  startTracker,
  stopManualTimer,
  stopTracker
} from './tracker'
import { createMainWindow, isQuitAllowed, setAllowQuit, showMainWindow } from './windows'
import {
  assignUnknown,
  assignWorkSession,
  createProjectRule,
  deleteProjectRule,
  deleteWorkSession,
  listActivityEventsForDay,
  listProjectRuleViews,
  listUnknownForDay,
  listWorkSessionsForDay,
  loadEngineSettings,
  mergeWorkSessions,
  splitWorkSession,
  updateWorkSessionTimes,
  workDashboardForDay
} from './work-queries'

if (process.platform === 'win32') {
  app.setAppUserModelId('com.beholder.app')
}

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
  ipcMain.handle('dashboard:get', (_e, date: string) => workDashboardForDay(date))
  ipcMain.handle('sessions:list', (_e, date: string) => listWorkSessionsForDay(date))
  ipcMain.handle('sessions:updateTimes', (_e, id: number, startMs: number, endMs: number) => {
    updateWorkSessionTimes(id, startMs, endMs)
    broadcastChanged()
  })
  ipcMain.handle('sessions:delete', (_e, id: number) => {
    deleteWorkSession(id)
    broadcastChanged()
  })
  ipcMain.handle('sessions:split', (_e, id: number, atMs: number) => {
    splitWorkSession(id, atMs)
    broadcastChanged()
  })
  ipcMain.handle('sessions:merge', (_e, firstId: number, secondId: number) => {
    mergeWorkSessions(firstId, secondId)
    broadcastChanged()
  })
  ipcMain.handle('sessions:assign', (_e, payload: AssignPayload) => {
    assignWorkSession(payload.sessionId, payload.projectId, payload.activityLabel ?? null)
    if (payload.remember && payload.projectId) {
      rememberAssignment(payload.sessionId, payload.projectId)
    }
    broadcastChanged()
  })
  ipcMain.handle('legacy:list', (_e, date: string) => listSessionsForDay(date))
  ipcMain.handle('events:list', (_e, date: string) => listActivityEventsForDay(date))
  ipcMain.handle('unknown:list', (_e, date: string) => listUnknownForDay(date))
  ipcMain.handle('unknown:assign', (_e, id: number, projectId: number, activityLabel: string | null) => {
    assignUnknown(id, projectId, activityLabel)
    broadcastChanged()
  })
  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:create', (_e, name: string) => createProject(name))
  ipcMain.handle('rules:list', () => listProjectRuleViews())
  ipcMain.handle('rules:create', (_e, ruleType: RuleType, ruleValue: string, projectId: number, weight?: number) => {
    createProjectRule(ruleType, ruleValue, projectId, weight ?? defaultWeight(ruleType))
    broadcastChanged()
  })
  ipcMain.handle('rules:delete', (_e, id: number) => {
    deleteProjectRule(id)
    broadcastChanged()
  })
  ipcMain.handle('lock:set', (_e, projectId: number) => {
    setProjectLock(projectId)
    return snapshot()
  })
  ipcMain.handle('lock:clear', () => {
    clearProjectLock()
    return snapshot()
  })
  ipcMain.handle('settings:get', () => {
    const engine = loadEngineSettings()
    return {
      pollIntervalMs: Number(setting('poll_interval_ms', '2000')),
      idleThresholdMs: engine.idleThresholdMs,
      startThreshold: engine.startThreshold,
      switchThreshold: engine.switchThreshold,
      highConfidence: engine.highConfidence,
      mediumConfidence: engine.mediumConfidence,
      switchDelayHighSec: engine.switchDelayHighSec,
      switchDelayMediumSec: engine.switchDelayMediumSec,
      switchDelayLowSec: engine.switchDelayLowSec,
      maxGapFillSec: Math.round(engine.maxGapFillMs / 1000),
      lockTimeoutMin: Math.round(engine.lockTimeoutMs / 60000),
      confidenceDecay: engine.confidenceDecay,
      excludedProcesses: listExcluded()
    }
  })
  ipcMain.handle(
    'settings:update',
    (
      _e,
      patch: {
        pollIntervalMs?: number
        idleThresholdMs?: number
        startThreshold?: number
        switchThreshold?: number
        highConfidence?: number
        mediumConfidence?: number
        switchDelayHighSec?: number
        switchDelayMediumSec?: number
        switchDelayLowSec?: number
        maxGapFillSec?: number
        lockTimeoutMin?: number
        confidenceDecay?: number
      }
    ) => {
      if (patch.pollIntervalMs !== undefined) {
        const v = Math.min(15000, Math.max(1000, patch.pollIntervalMs))
        setSetting('poll_interval_ms', String(v))
        restartTrackerInterval()
      }
      if (patch.idleThresholdMs !== undefined) {
        const v = Math.min(60 * 60 * 1000, Math.max(60 * 1000, patch.idleThresholdMs))
        setSetting('idle_threshold_ms', String(v))
      }
      if (patch.startThreshold !== undefined) {
        setSetting('start_threshold', String(Math.min(100, Math.max(0, patch.startThreshold))))
      }
      if (patch.switchThreshold !== undefined) {
        setSetting('switch_threshold', String(Math.min(100, Math.max(0, patch.switchThreshold))))
      }
      if (patch.highConfidence !== undefined) {
        setSetting('high_confidence', String(Math.min(100, Math.max(0, patch.highConfidence))))
      }
      if (patch.mediumConfidence !== undefined) {
        setSetting('medium_confidence', String(Math.min(100, Math.max(0, patch.mediumConfidence))))
      }
      if (patch.switchDelayHighSec !== undefined) {
        setSetting('switch_delay_high_sec', String(Math.min(600, Math.max(5, patch.switchDelayHighSec))))
      }
      if (patch.switchDelayMediumSec !== undefined) {
        setSetting('switch_delay_medium_sec', String(Math.min(600, Math.max(5, patch.switchDelayMediumSec))))
      }
      if (patch.switchDelayLowSec !== undefined) {
        setSetting('switch_delay_low_sec', String(Math.min(600, Math.max(5, patch.switchDelayLowSec))))
      }
      if (patch.maxGapFillSec !== undefined) {
        setSetting('max_gap_fill_ms', String(Math.min(3600, Math.max(0, patch.maxGapFillSec)) * 1000))
      }
      if (patch.lockTimeoutMin !== undefined) {
        setSetting('lock_timeout_ms', String(Math.min(480, Math.max(0, patch.lockTimeoutMin)) * 60000))
      }
      if (patch.confidenceDecay !== undefined) {
        setSetting('confidence_decay', String(Math.min(50, Math.max(0, patch.confidenceDecay))))
      }
      broadcastChanged()
    }
  )
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
