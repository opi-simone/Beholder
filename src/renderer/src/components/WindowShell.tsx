import type { JSX, ReactNode } from 'react'
import TitleBar from './TitleBar'

type Page = 'dashboard' | 'timeline' | 'settings'

type Props = {
  title: string
  page: Page
  onPage: (page: Page) => void
  children: ReactNode
}

export default function WindowShell({ title, page, onPage, children }: Props): JSX.Element {
  return (
    <div className="window-shell">
      <TitleBar title={title} />
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
      <div className="window-body">{children}</div>
    </div>
  )
}
