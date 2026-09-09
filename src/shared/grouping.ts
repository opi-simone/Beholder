import type { Session } from './types'

export function sessionGroupLabel(session: Session): string {
  if (session.origin === 'idle_detection' && !session.projectId) return 'Idle'
  if (session.projectName) return session.projectName
  if (session.repoSlug) return session.repoSlug
  if (session.activityLabel) return session.activityLabel
  return session.processName || 'Non classificato'
}
