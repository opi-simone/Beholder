import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

export function findGitRepoName(start: string | null | undefined): string | null {
  if (!start) return null
  let dir = start
  for (let i = 0; i < 14; i++) {
    if (existsSync(join(dir, '.git'))) return basename(dir) || null
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}
