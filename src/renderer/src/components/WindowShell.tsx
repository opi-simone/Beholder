import type { JSX, ReactNode } from 'react'

type Page = 'dashboard' | 'timeline' | 'settings'

type Props = {
  title: string
  page: Page
  onPage: (page: Page) => void
  children: ReactNode
}

export default function WindowShell({ page, onPage, children }: Props): JSX.Element {
  return (
    <div className="window-shell">
      <header className="chrome">
        <div className="chrome-drag" />
        <div className="brand">
          <EyeMark />
          <span>Beholder</span>
        </div>
        <nav className="nav">
          <button type="button" className={page === 'dashboard' ? 'nav-btn active' : 'nav-btn'} onClick={() => onPage('dashboard')}>
            Dashboard
          </button>
          <button type="button" className={page === 'timeline' ? 'nav-btn active' : 'nav-btn'} onClick={() => onPage('timeline')}>
            Timeline
          </button>
          <button type="button" className={page === 'settings' ? 'nav-btn active' : 'nav-btn'} onClick={() => onPage('settings')}>
            Impostazioni
          </button>
        </nav>
        <div className="titlebar-controls">
          <button type="button" className="titlebar-btn" aria-label="Riduci" onClick={() => void window.beholder.minimize()}>
            ─
          </button>
          <button type="button" className="titlebar-btn" aria-label="Ingrandisci" onClick={() => void window.beholder.maximize()}>
            □
          </button>
          <button type="button" className="titlebar-btn titlebar-close" aria-label="Chiudi" onClick={() => void window.beholder.closeWindow()}>
            ✕
          </button>
        </div>
      </header>
      <div className="window-body">{children}</div>
    </div>
  )
}

function EyeMark(): JSX.Element {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c-5 0-9 4.2-10 7 1 2.8 5 7 10 7s9-4.2 10-7c-1-2.8-5-7-10-7zm0 11.2A4.2 4.2 0 1 1 12 7.8a4.2 4.2 0 0 1 0 8.4zm0-2.4a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z"
      />
    </svg>
  )
}
