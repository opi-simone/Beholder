import { hostnameOf, isBrowserProcess, isTerminalProcess } from './signals'
import type { ActivitySample, ProjectRule } from './types'

const NEUTRAL_PROCESSES = [
  /^chatgpt(\.exe)?$/i,
  /^explorer(\.exe)?$/i,
  /^calc(ulator)?(\.exe)?$/i,
  /^notepad(\.exe)?$/i,
  /^outlook(\.exe)?$/i,
  /^olk(\.exe)?$/i,
  /^ms-teams(\.exe)?$/i,
  /^teams(\.exe)?$/i,
  /^slack(\.exe)?$/i,
  /^discord(\.exe)?$/i,
  /^spotify(\.exe)?$/i,
  /^searchhost(\.exe)?$/i,
  /^applicationframehost(\.exe)?$/i
]

const GENERIC_HOSTS = [
  'google.com',
  'www.google.com',
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
  'bing.com',
  'duckduckgo.com',
  'yahoo.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'reddit.com',
  'youtube.com',
  'youtu.be',
  'wikipedia.org',
  'stackoverflow.com',
  'stackexchange.com',
  'gmail.com',
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'office.com',
  'login.microsoftonline.com'
]

function haystack(event: ActivitySample): string {
  return [
    event.processName,
    event.windowTitle,
    event.url,
    event.workspacePath,
    event.gitRepository,
    event.workingDirectory
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isGenericHost(host: string | null): boolean {
  if (!host) return true
  return GENERIC_HOSTS.some((g) => host === g || host.endsWith(`.${g}`))
}

function domainHitsARule(event: ActivitySample, rules: ProjectRule[]): boolean {
  const host = hostnameOf(event.url)
  const title = (event.windowTitle ?? '').toLowerCase()
  const url = (event.url ?? '').toLowerCase()
  return rules.some((rule) => {
    if (rule.ruleType !== 'domain') return false
    const value = rule.ruleValue.trim().toLowerCase()
    if (!value) return false
    if (host && (host === value || host.endsWith(`.${value}`) || value.endsWith(host))) return true
    return title.includes(value) || url.includes(value)
  })
}

export function isNeutralContext(event: ActivitySample, rules: ProjectRule[]): boolean {
  const process = event.processName ?? ''
  if (NEUTRAL_PROCESSES.some((re) => re.test(process))) return true

  const blob = haystack(event)
  if (/\b(chatgpt|openai)\b/i.test(blob) && !domainHitsARule(event, rules)) return true
  if (/\b(gmail|outlook)\b/i.test(blob) && isBrowserProcess(process) && !domainHitsARule(event, rules)) {
    return true
  }

  if (isBrowserProcess(process)) {
    if (domainHitsARule(event, rules)) return false
    return isGenericHost(hostnameOf(event.url))
  }

  if (isTerminalProcess(process) && !event.workingDirectory && !event.gitRepository && !event.workspacePath) {
    return true
  }

  return false
}
