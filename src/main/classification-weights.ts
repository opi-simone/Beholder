import { DEFAULT_WEIGHTS } from '../core/defaults'
import type { RuleType } from '../shared/types'

export function defaultWeight(ruleType: RuleType): number {
  return DEFAULT_WEIGHTS[ruleType]
}
