import type { WorkSession } from './types'

export function workSessionGroupLabel(session: WorkSession): string {
  if (session.projectName) return session.projectName
  if (session.activityLabel) return session.activityLabel
  return 'Non classificato'
}
