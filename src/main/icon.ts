import { app, nativeImage } from 'electron'
import { join } from 'node:path'

function resourceFile(name: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, name)
  }
  return join(process.cwd(), 'resources', name)
}

export function getWindowIconPath(): string {
  return resourceFile('icon-256.png')
}

export function getTrayIcon(): Electron.NativeImage {
  return nativeImage.createFromPath(resourceFile('icon-32.png'))
}
