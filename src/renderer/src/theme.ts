import type { UiTheme } from '../../shared/types'

const STORAGE_KEY = 'beholder.theme'

export function readStoredTheme(): UiTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: UiTheme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore quota / private mode
  }
}

export function applyStoredTheme(): void {
  applyTheme(readStoredTheme())
}

export async function persistTheme(theme: UiTheme): Promise<void> {
  applyTheme(theme)
  try {
    await window.beholder.updateSettings({ theme })
  } catch {
    // database may not be open yet
  }
}

applyStoredTheme()

