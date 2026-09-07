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

export function extractCursorRepo(title: string): string | null {
  const cleaned = title.replace(/\s*[-—–]\s*Cursor(\s+.*)?$/i, '').trim()
  if (!cleaned) return null
  const parts = cleaned
    .split(/\s*[-—–]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const last = parts[parts.length - 1]
  if (/\.\w{1,8}$/.test(last) && parts.length >= 2) {
    return parts[parts.length - 2]
  }
  return last
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
