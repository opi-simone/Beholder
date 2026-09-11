import type { BeholderApi } from '../shared/types'

declare global {
  interface Window {
    beholder: BeholderApi
  }
}

export {}
