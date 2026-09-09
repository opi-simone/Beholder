import { Menu, Tray, app } from 'electron'
import { getTrayIcon } from './icon'
import { hasManualTimer, isPaused, setPaused, snapshot, stopManualTimer } from './tracker'
import { getMainWindow, setAllowQuit, showMainWindow } from './windows'
import { loadConfig, updateConfig } from './store'

let tray: Tray | null = null

function openPage(page: 'dashboard' | 'timeline' | 'timer'): void {
  showMainWindow()
  getMainWindow()?.webContents.send('ui:open', page)
}

export function refreshTrayMenu(): void {
  if (!tray) return
  const snap = safeSnapshot()
  const paused = snap ? isPaused() : loadConfig().trackingPaused
  const manual = snap ? hasManualTimer() : false
  const label = snap?.currentContextLabel ?? 'Beholder'
  tray.setToolTip(manual ? `Beholder — ${label}` : paused ? 'Beholder — in pausa' : `Beholder — ${label}`)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Apri Beholder', click: () => openPage('dashboard') },
      { label: `Contesto: ${label}`, enabled: false },
      { type: 'separator' },
      {
        label: 'Avvia timer manuale',
        enabled: !manual,
        click: () => openPage('timer')
      },
      {
        label: 'Ferma timer manuale',
        enabled: manual,
        click: () => stopManualTimer()
      },
      {
        label: paused ? 'Riprendi tracking' : 'Metti in pausa tracking',
        enabled: !manual,
        click: () => {
          const next = !paused
          setPaused(next)
          updateConfig({ trackingPaused: next })
        }
      },
      { label: 'Timeline di oggi', click: () => openPage('timeline') },
      { type: 'separator' },
      {
        label: 'Esci',
        click: () => {
          setAllowQuit(true)
          app.quit()
        }
      }
    ])
  )
}

function safeSnapshot(): ReturnType<typeof snapshot> | null {
  try {
    return snapshot()
  } catch {
    return null
  }
}

export function createTray(): Tray {
  if (tray) return tray
  tray = new Tray(getTrayIcon())
  refreshTrayMenu()
  tray.on('double-click', () => openPage('dashboard'))
  return tray
}

export function getTray(): Tray | null {
  return tray
}
