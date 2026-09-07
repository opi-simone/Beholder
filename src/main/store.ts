import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type BeholderConfig = {
  privacyAccepted: boolean
  trackingPaused: boolean
}

const DEFAULTS: BeholderConfig = {
  privacyAccepted: false,
  trackingPaused: false
}

function configDir(): string {
  return join(app.getPath('userData'))
}

function configPath(): string {
  return join(configDir(), 'config.json')
}

export function loadConfig(): BeholderConfig {
  try {
    if (!existsSync(configPath())) return { ...DEFAULTS }
    const raw = readFileSync(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<BeholderConfig>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function updateConfig(patch: Partial<BeholderConfig>): BeholderConfig {
  const next = { ...loadConfig(), ...patch }
  mkdirSync(configDir(), { recursive: true })
  writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
