import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { AppSnapshot, Project, UiTheme } from '../../../shared/types'
import {
  IconBriefcase,
  IconChart,
  IconChevron,
  IconEye,
  IconGear,
  IconGrid,
  IconList,
  IconLock,
  IconMoon,
  IconPause,
  IconPlay,
  IconSun
} from '../icons'

export type Page = 'dashboard' | 'timeline' | 'settings'

type Props = {
  page: Page
  onPage: (page: Page) => void
  theme: UiTheme
  onTheme: (theme: UiTheme) => void
  snap: AppSnapshot | null
  showFooter: boolean
  onOpenTimer: () => void
  children: ReactNode
}

const NAV: { id: Page | 'projects' | 'stats'; label: string; enabled: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', enabled: true },
  { id: 'timeline', label: 'Timeline', enabled: true },
  { id: 'projects', label: 'Progetti', enabled: false },
  { id: 'stats', label: 'Statistiche', enabled: false },
  { id: 'settings', label: 'Impostazioni', enabled: true }
]

export default function WindowShell({
  page,
  onPage,
  theme,
  onTheme,
  snap,
  showFooter,
  onOpenTimer,
  children
}: Props): JSX.Element {
  return (
    <div className="window-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <IconEye width={18} height={18} />
          </span>
          <span className="brand-copy">
            <strong>Beholder</strong>
            <small>Track what matters</small>
          </span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === page ? 'nav-item active' : 'nav-item'}
              disabled={!item.enabled}
              title={item.enabled ? item.label : 'Prossimamente'}
              onClick={() => {
                if (item.id === 'dashboard' || item.id === 'timeline' || item.id === 'settings') {
                  onPage(item.id)
                }
              }}
            >
              <NavIcon id={item.id} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-meta">
          <strong>v1.0.0</strong>
          <span>Track. Analyze. Improve.</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="titlebar">
          <div className="titlebar-drag" />
          <div className="titlebar-controls">
            <button
              type="button"
              className="titlebar-btn"
              aria-label={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
              onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <IconSun width={15} height={15} /> : <IconMoon width={15} height={15} />}
            </button>
            <button type="button" className="titlebar-btn" aria-label="Riduci" onClick={() => void window.beholder.minimize()}>
              ─
            </button>
            <button type="button" className="titlebar-btn" aria-label="Ingrandisci" onClick={() => void window.beholder.maximize()}>
              □
            </button>
            <button
              type="button"
              className="titlebar-btn titlebar-close"
              aria-label="Chiudi"
              onClick={() => void window.beholder.closeWindow()}
            >
              ✕
            </button>
          </div>
        </header>
        <div className="page-scroll">{children}</div>
        {showFooter && snap ? <AppFooter snap={snap} onOpenTimer={onOpenTimer} /> : null}
      </div>
    </div>
  )
}

function NavIcon({ id }: { id: (typeof NAV)[number]['id'] }): JSX.Element {
  const props = { width: 18, height: 18 }
  if (id === 'timeline') return <IconList {...props} />
  if (id === 'projects') return <IconBriefcase {...props} />
  if (id === 'stats') return <IconChart {...props} />
  if (id === 'settings') return <IconGear {...props} />
  return <IconGrid {...props} />
}

function AppFooter({ snap, onOpenTimer }: { snap: AppSnapshot; onOpenTimer: () => void }): JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [lockProject, setLockProject] = useState('')
  const paused = snap.trackingStatus === 'paused'

  useEffect(() => {
    void window.beholder.listProjects().then(setProjects)
  }, [snap])

  const trackingLabel =
    snap.trackingStatus === 'paused'
      ? 'In pausa'
      : snap.trackingStatus === 'manual'
        ? 'Timer manuale'
        : snap.trackingStatus === 'idle_pending'
          ? 'Inattivo'
          : snap.trackingStatus === 'locked'
            ? `Lock ${snap.projectLock?.projectName ?? ''}`.trim()
            : 'Tracking attivo'
  const trackingOn = snap.trackingStatus === 'running' || snap.trackingStatus === 'locked' || snap.trackingStatus === 'manual'

  return (
    <footer className="app-footer">
      <div className="footer-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={Boolean(snap.manualTimer)}
          onClick={() => void window.beholder.setPaused(!paused)}
        >
          <IconPause width={14} height={14} />
          {paused ? 'Riprendi tracking' : 'Metti in pausa'}
        </button>
        {snap.manualTimer ? (
          <button type="button" className="btn-ghost" onClick={() => void window.beholder.stopTimer()}>
            <IconPlay width={14} height={14} />
            Stop timer
          </button>
        ) : (
          <button type="button" className="btn-ghost" onClick={onOpenTimer}>
            <IconPlay width={14} height={14} />
            Avvia timer manuale
          </button>
        )}
        {snap.projectLock ? (
          <button type="button" className="btn-ghost" onClick={() => void window.beholder.clearLock()}>
            <IconLock width={14} height={14} />
            Sblocca {snap.projectLock.projectName ?? 'progetto'}
          </button>
        ) : (
          <label className="footer-lock">
            <IconLock width={14} height={14} />
            <select
              value={lockProject}
              onChange={(e) => {
                const value = e.target.value
                setLockProject(value)
                if (value) void window.beholder.setLock(Number(value)).then(() => setLockProject(''))
              }}
            >
              <option value="">Lock progetto…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <IconChevron width={14} height={14} />
          </label>
        )}
      </div>
      <div className="footer-status">
        <span className={trackingOn ? 'status-pill on' : 'status-pill'}>
          <span className="status-dot" />
          {trackingLabel}
        </span>
        <span className="status-pill muted-pill">{snap.manualTimer ? snap.manualTimer.activityLabel : 'Nessun timer'}</span>
      </div>
    </footer>
  )
}
