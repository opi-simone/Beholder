import { basename } from 'node:path'

export function isCursorProcess(processName: string | null | undefined): boolean {
  return /^cursor(\.exe)?$/i.test(processName ?? '')
}

export function isBrowserProcess(processName: string | null | undefined): boolean {
  return /^(chrome|msedge|firefox|brave|opera|vivaldi|chromium|waterfox|iexplore)(\.exe)?$/i.test(
    processName ?? ''
  )
}

export function isTerminalProcess(processName: string | null | undefined): boolean {
  return /^(windows.?terminal|wt|powershell|pwsh|cmd|windowsterminal|WindowsTerminal)(\.exe)?$/i.test(
    processName ?? ''
  )
}

function looksLikeFileName(part: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(part) || part.startsWith('\\\\') || part.startsWith('/')) return false
  return /\.\w{1,10}$/.test(part)
}

function looksLikePath(part: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(part) || part.startsWith('\\\\') || part.includes('/') || part.includes('\\')
}

function cleanSegment(part: string): string {
  return part
    .replace(/\s*\(Workspace\)\s*$/i, '')
    .replace(/\s*\[SSH:[^\]]*\]\s*$/i, '')
    .trim()
}

export function extractCursorRepo(title: string): string | null {
  let cleaned = title.replace(/^[●■◦]\s*/, '').replace(/\s*[●*]+$/, '').trim()
  cleaned = cleaned.replace(/\s*[-—–]\s*(Cursor|Visual Studio Code|Code - OSS|Code)(\s+.*)?$/i, '').trim()
  if (!cleaned) return null

  const parts = cleaned
    .split(/\s*[-—–•]\s*/)
    .map((p) => cleanSegment(p))
    .filter(Boolean)

  const folders = parts.filter((part) => !looksLikeFileName(part))
  if (folders.length === 0) return null

  const pathPart = folders.find((part) => looksLikePath(part))
  if (pathPart) {
    const base = basename(pathPart.replace(/[\\/]+$/, ''))
    return base || pathPart
  }

  return folders[0]
}

export function extractPathFromText(text: string | null | undefined): string | null {
  if (!text) return null
  const match = text.match(/(?:PS\s+)?((?:[A-Za-z]:\\|\\\\)[^\s>"']+)/)
  if (!match) return null
  return match[1].replace(/[\\/]+$/, '')
}

export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null
  const match = text.match(/https?:\/\/[^\s]+/i)
  return match ? match[0].replace(/[),.;]+$/, '') : null
}

export function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`
    return new URL(withProto).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function basenameOfPath(path: string | null | undefined): string | null {
  if (!path) return null
  const base = basename(path.replace(/[\\/]+$/, ''))
  return base || null
}
