import { basename } from 'node:path'
import type { ClassificationSource, MatchType } from '../shared/types'
import { all } from './db'

export type ClassifyInput = {
  processName: string
  windowTitle: string
}

export type ClassifyResult = {
  projectId: number | null
  repoSlug: string | null
  source: ClassificationSource
  aggregationKey: string
}

type MappingRow = {
  id: number
  match_type: MatchType
  pattern: string
  project_id: number
  priority: number
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

  // VS Code/Cursor: file - workspace - profile - app
  // The workspace is the first non-file segment; the last extra is usually the profile (e.g. Mundayco).
  return folders[0]
}

export function isCursorProcess(processName: string): boolean {
  return /^cursor(\.exe)?$/i.test(processName)
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function classifyWindow(input: ClassifyInput): ClassifyResult {
  const process = input.processName.toLowerCase()
  const title = input.windowTitle
  const repo = isCursorProcess(input.processName) ? extractCursorRepo(title) : null

  const mappings = all<MappingRow>(
    'SELECT id, match_type, pattern, project_id, priority FROM project_mappings ORDER BY priority DESC, id ASC'
  )

  for (const rule of mappings) {
    const pattern = rule.pattern.trim().toLowerCase()
    if (!pattern) continue
    if (rule.match_type === 'process' && process === pattern) {
      return {
        projectId: rule.project_id,
        repoSlug: repo,
        source: 'user_rule',
        aggregationKey: aggregationKey(input.processName, repo, title)
      }
    }
    if (rule.match_type === 'title_contains' && title.toLowerCase().includes(pattern)) {
      return {
        projectId: rule.project_id,
        repoSlug: repo,
        source: 'user_rule',
        aggregationKey: aggregationKey(input.processName, repo, title)
      }
    }
    if (rule.match_type === 'repo' && repo && repo.toLowerCase() === pattern) {
      return {
        projectId: rule.project_id,
        repoSlug: repo,
        source: 'user_rule',
        aggregationKey: aggregationKey(input.processName, repo, title)
      }
    }
  }

  if (isCursorProcess(input.processName) && repo) {
    return {
      projectId: null,
      repoSlug: repo,
      source: 'cursor_builtin',
      aggregationKey: aggregationKey(input.processName, repo, title)
    }
  }

  return {
    projectId: null,
    repoSlug: repo,
    source: 'unclassified',
    aggregationKey: aggregationKey(input.processName, repo, title)
  }
}

export function aggregationKey(processName: string, repo: string | null, title: string): string {
  if (repo) return `auto:${processName.toLowerCase()}:${repo.toLowerCase()}`
  return `auto:${processName.toLowerCase()}:${normalizeTitle(title)}`
}
