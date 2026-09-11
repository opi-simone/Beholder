import type { ActivitySample } from '../../core/types'
import {
  basenameOfPath,
  extractCursorRepo,
  extractPathFromText,
  extractUrl,
  isCursorProcess,
  isTerminalProcess
} from '../../core/signals'
import type { ActiveWindow } from '../win32'
import { findGitRepoName } from './git-detector'

function guessUrl(title: string | null): string | null {
  const direct = extractUrl(title)
  if (direct) return direct
  if (!title) return null
  const host = title.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i)
  return host ? `https://${host[0]}` : null
}

export function enrichWindow(win: ActiveWindow | null, timestamp: number, idleSeconds: number): ActivitySample {
  if (!win) {
    return {
      timestamp,
      processName: null,
      windowTitle: null,
      executablePath: null,
      url: null,
      workspacePath: null,
      gitRepository: null,
      workingDirectory: null,
      clickupTaskId: null,
      idleSeconds
    }
  }

  const title = win.windowTitle || null
  const pathFromTitle = extractPathFromText(title)
  let workspacePath: string | null = pathFromTitle
  let workingDirectory: string | null = null
  let gitRepository: string | null = null

  if (isCursorProcess(win.processName) && title) {
    const repo = extractCursorRepo(title)
    gitRepository = repo
    if (pathFromTitle) {
      workspacePath = pathFromTitle
      gitRepository = findGitRepoName(pathFromTitle) ?? repo
    } else if (repo) {
      gitRepository = repo
    }
  }

  if (isTerminalProcess(win.processName) && pathFromTitle) {
    workingDirectory = pathFromTitle
    workspacePath = workspacePath ?? pathFromTitle
    gitRepository = findGitRepoName(pathFromTitle) ?? basenameOfPath(pathFromTitle)
  }

  return {
    timestamp,
    processName: win.processName,
    windowTitle: title,
    executablePath: win.executablePath,
    url: guessUrl(title),
    workspacePath,
    gitRepository,
    workingDirectory,
    clickupTaskId: null,
    idleSeconds
  }
}
