import { BrowserWindow, app } from 'electron'
import { join } from 'node:path'

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function pageUrl(): string {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    return process.env['ELECTRON_RENDERER_URL']
  }
  return `file://${join(__dirname, '../renderer/index.html')}`
}

let mainWin: BrowserWindow | null = null
let allowQuit = false

export function setAllowQuit(value: boolean): void {
  allowQuit = value
}

export function isQuitAllowed(): boolean {
  return allowQuit
}

export function createMainWindow(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.show()
    mainWin.focus()
    return mainWin
  }

  mainWin = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    show: false,
    frame: false,
    backgroundColor: '#0F0F0D',
    title: 'Beholder',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWin.loadURL(pageUrl())
  mainWin.once('ready-to-show', () => {
    mainWin?.show()
    mainWin?.focus()
  })
  mainWin.on('close', (event) => {
    if (!allowQuit) {
      event.preventDefault()
      mainWin?.hide()
    }
  })
  mainWin.on('closed', () => {
    mainWin = null
  })

  return mainWin
}

export function showMainWindow(): void {
  createMainWindow()
}

export function hideMainWindow(): void {
  if (mainWin && !mainWin.isDestroyed()) mainWin.hide()
}

export function getMainWindow(): BrowserWindow | null {
  return mainWin
}
