import { DEFAULT_WEIGHTS, LAST_PROJECT_BONUS } from './defaults'
import { isNeutralContext } from './neutral'
import { basenameOfPath, hostnameOf } from './signals'
import type { ActivitySample, Classification, Evidence, ProjectRule } from './types'

function norm(value: string): string {
  return value.trim().toLowerCase()
}

function contains(hay: string | null | undefined, needle: string): boolean {
  if (!hay) return false
  return norm(hay).includes(norm(needle))
}

function equalsPathish(hay: string | null | undefined, needle: string): boolean {
  if (!hay) return false
  const a = norm(hay).replace(/\//g, '\\')
  const b = norm(needle).replace(/\//g, '\\')
  return a === b || a.includes(b) || b.includes(a)
}

function processEquals(processName: string | null | undefined, pattern: string): boolean {
  if (!processName) return false
  const a = norm(processName).replace(/\.exe$/, '')
  const b = norm(pattern).replace(/\.exe$/, '')
  return a === b
}

function domainMatch(event: ActivitySample, value: string): boolean {
  const host = hostnameOf(event.url)
  const needle = norm(value)
  if (host && (host === needle || host.endsWith(`.${needle}`) || needle.includes(host))) return true
  return contains(event.url, value) || contains(event.windowTitle, value)
}

function ruleMatches(event: ActivitySample, rule: ProjectRule): boolean {
  const value = rule.ruleValue.trim()
  if (!value) return false
  switch (rule.ruleType) {
    case 'folder':
      return (
        equalsPathish(event.workspacePath, value) ||
        equalsPathish(event.workingDirectory, value) ||
        equalsPathish(event.executablePath, value)
      )
    case 'domain':
      return domainMatch(event, value)
    case 'keyword':
      return (
        contains(event.windowTitle, value) ||
        contains(event.processName, value) ||
        contains(event.url, value) ||
        contains(event.workspacePath, value) ||
        contains(event.gitRepository, value) ||
        contains(event.workingDirectory, value)
      )
    case 'repository':
      return (
        processEquals(event.gitRepository, value) ||
        processEquals(basenameOfPath(event.workspacePath), value) ||
        processEquals(basenameOfPath(event.workingDirectory), value) ||
        contains(event.gitRepository, value)
      )
    case 'window_title':
      return contains(event.windowTitle, value)
    case 'working_directory':
      return equalsPathish(event.workingDirectory, value)
    case 'clickup_task':
      return Boolean(event.clickupTaskId && norm(event.clickupTaskId) === norm(value))
    case 'process':
      return processEquals(event.processName, value)
    default:
      return false
  }
}

export function classifyActivity(
  event: ActivitySample,
  rules: ProjectRule[],
  stickyProjectId: number | null
): Classification {
  const scores = new Map<number, number>()
  const evidenceByProject = new Map<number, Evidence[]>()

  for (const rule of rules) {
    if (!ruleMatches(event, rule)) continue
    const weight = rule.weight
    if (weight === 0) continue
    const prev = scores.get(rule.projectId) ?? 0
    scores.set(rule.projectId, prev + weight)
    const list = evidenceByProject.get(rule.projectId) ?? []
    list.push({
      signal: rule.ruleType,
      weight,
      detail: rule.ruleValue
    })
    evidenceByProject.set(rule.projectId, list)
  }

  if (stickyProjectId != null) {
    const prev = scores.get(stickyProjectId) ?? 0
    scores.set(stickyProjectId, prev + LAST_PROJECT_BONUS)
    const list = evidenceByProject.get(stickyProjectId) ?? []
    list.push({ signal: 'last_project', weight: LAST_PROJECT_BONUS, detail: String(stickyProjectId) })
    evidenceByProject.set(stickyProjectId, list)
  }

  let candidateProjectId: number | null = null
  let best = 0
  for (const [projectId, raw] of scores) {
    const score = Math.min(100, raw)
    scores.set(projectId, score)
    if (score > best) {
      best = score
      candidateProjectId = projectId
    }
  }

  const evidence = candidateProjectId != null ? (evidenceByProject.get(candidateProjectId) ?? []) : []
  const isNeutral = isNeutralContext(event, rules)

  return {
    scores,
    evidenceByProject,
    candidateProjectId: best > 0 ? candidateProjectId : null,
    confidence: best,
    evidence,
    isNeutral
  }
}

export function defaultWeight(ruleType: ProjectRule['ruleType']): number {
  return DEFAULT_WEIGHTS[ruleType]
}
