import { BrowserWindow, Notification } from 'electron'

export function broadcastChanged(): void {
  refreshTray()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('app:changed')
  }
}

function refreshTray(): void {
  try {
    // lazy import to avoid circular deps with tracker
    const { refreshTrayMenu } = require('./tray') as { refreshTrayMenu: () => void }
    refreshTrayMenu()
  } catch {
    // tray not ready yet
  }
}

export function notifyIdleReturn(durationLabel: string): void {
  if (!Notification.isSupported()) return
  new Notification({
    title: 'Beholder',
    body: `Rilevata inattività (${durationLabel}). Revisiona il periodo in timeline.`
  }).show()
}

export function notifyTimerInterrupted(): void {
  if (!Notification.isSupported()) return
  new Notification({
    title: 'Beholder',
    body: 'Timer manuale interrotto all’ultimo campionamento noto.'
  }).show()
}
