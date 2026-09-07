import type { BeholderApi } from './index'

declare global {
  interface Window {
    beholder: BeholderApi
  }
}

export {}
