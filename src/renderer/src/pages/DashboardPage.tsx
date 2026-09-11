import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { AppSnapshot, DashboardDay, Project } from '../../../shared/types'
import { formatDuration, todayDate } from '../../../shared/time'

type Props = {
  snap: AppSnapshot
  onOpenTimer: () => void
  onOpenTimeline: () => void
}

export default function DashboardPage({ snap, onOpenTimer, onOpenTimeline }: Props): JSX.Element {
  const [day, setDay] = useState<DashboardDay | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [lockProject, setLockProject] = useState('')

  useEffect(() => {
    void window.beholder.getDashboard(todayDate()).then(setDay)
    void window.beholder.listProjects().then(setProjects)
  }, [snap])

  const paused = snap.trackingStatus === 'paused'
  const statusLabel =
    snap.trackingStatus === 'manual'
      ? 'Timer manuale'
      : snap.trackingStatus === 'paused'
        ? 'In pausa'
        : snap.trackingStatus === 'idle_pending'
          ? 'Inattivo'
          : snap.trackingStatus === 'locked'
            ? `Lock ${snap.projectLock?.projectName ?? ''}`
            : 'Tracking automatico'
  const maxProject = Math.max(1, ...(day?.byProject.map((row) => row.ms) ?? [0]))

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Dashboard giornaliera</p>
        <h1>Oggi</h1>
        <p className="muted">
          {snap.currentContextLabel}
          {snap.stickyProjectName ? ` · sticky: ${snap.stickyProjectName}` : ''} · {snap.machineState}
        </p>
      </section>
      {snap.unknownCount > 0 && (
        <button type="button" className="banner" onClick={onOpenTimeline}>
          <span>Da classificare oggi: {snap.unknownCount} intervallo/i.</span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      <section className="stats">
        <StatCard icon="clock" label="Tempo rilevato" value={formatDuration(day?.totalMs ?? 0)} />
        <StatCard icon="play" label="Timer manuali" value={formatDuration(day?.manualMs ?? 0)} />
        <StatCard icon="file" label="Da classificare" value={formatDuration(day?.unknownMs ?? 0)} tone="gold" />
        <StatCard icon="idle" label="Non attribuito" value={formatDuration(day?.unclassifiedMs ?? 0)} tone="purple" />
        <StatCard icon="pulse" label="Stato" value={statusLabel} tone="success" />
        <StatCard icon="hourglass" label="Timer attivo" value={snap.manualTimer ? snap.manualTimer.activityLabel : 'Nessuno'} />
      </section>
      <section className="card wide">
        <h2>Tempo per progetto</h2>
        {day && day.byProject.length === 0 ? (
          <p className="muted">Nessuna sessione oggi.</p>
        ) : (
          <div className="project-bars">
            {day?.byProject.map((row) => (
              <div key={row.projectId ?? 'none'} className="project-bar">
                <div className="project-bar-head">
                  <span>{row.name}</span>
                  <strong>{formatDuration(row.ms)}</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(8, (row.ms / maxProject) * 100)}%` }} />
                </div>
                {row.byLabel.length > 0 && (
                  <ul className="label-list">
                    {row.byLabel.map((item) => (
                      <li key={item.label}>
                        {item.label} · {formatDuration(item.ms)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="actions">
        <button
          type="button"
          className="btn-primary"
          disabled={Boolean(snap.manualTimer)}
          onClick={() => void window.beholder.setPaused(!paused)}
        >
          {paused ? 'Riprendi tracking' : 'Metti in pausa'}
        </button>
        {snap.manualTimer ? (
          <button type="button" className="btn-ghost" onClick={() => void window.beholder.stopTimer()}>
            Stop timer
          </button>
        ) : (
          <button type="button" className="btn-ghost" onClick={onOpenTimer}>
            Avvia timer manuale
          </button>
        )}
        {snap.projectLock ? (
          <button type="button" className="btn-ghost" onClick={() => void window.beholder.clearLock()}>
            Sblocca {snap.projectLock.projectName ?? 'progetto'}
          </button>
        ) : (
          <>
            <select value={lockProject} onChange={(e) => setLockProject(e.target.value)}>
              <option value="">Lock progetto…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost"
              disabled={!lockProject}
              onClick={() => void window.beholder.setLock(Number(lockProject))}
            >
              🔒 Lock
            </button>
          </>
        )}
      </div>
    </>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone = 'blue'
}: {
  icon: 'clock' | 'play' | 'file' | 'idle' | 'pulse' | 'hourglass'
  label: string
  value: string
  tone?: 'blue' | 'gold' | 'purple' | 'success'
}): JSX.Element {
  return (
    <article className="stat">
      <span className={`stat-icon ${tone}`}>{iconSvg(icon)}</span>
      <div>
        <span className="stat-label">{label}</span>
        <strong className={tone === 'success' ? 'ok' : undefined}>{value}</strong>
      </div>
    </article>
  )
}

function iconSvg(kind: string): ReactNode {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }
  if (kind === 'play') {
    return (
      <svg {...common}>
        <polygon points="8,6 18,12 8,18" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (kind === 'file') {
    return (
      <svg {...common}>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5" />
      </svg>
    )
  }
  if (kind === 'idle') {
    return (
      <svg {...common}>
        <path d="M4 18c2-6 14-6 16 0" />
        <circle cx="12" cy="8" r="3" />
      </svg>
    )
  }
  if (kind === 'pulse') {
    return (
      <svg {...common}>
        <path d="M3 12h4l2-5 4 10 2-5h6" />
      </svg>
    )
  }
  if (kind === 'hourglass') {
    return (
      <svg {...common}>
        <path d="M6 4h12M6 20h12M8 4c0 4 8 4 8 8s-8 4-8 8M16 4c0 4-8 4-8 8s8 4 8 8" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 10v4l2 1" />
    </svg>
  )
}

export function TimerForm({ onClose }: { onClose: () => void }): JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [activity, setActivity] = useState('Riunione')
  const [projectId, setProjectId] = useState<string>('')

  useEffect(() => {
    void window.beholder.listProjects().then(setProjects)
  }, [])

  return (
    <div className="modal">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          void window.beholder
            .startTimer({
              activityLabel: activity,
              projectId: projectId ? Number(projectId) : null
            })
            .then(onClose)
        }}
      >
        <h2>Timer manuale</h2>
        <label>
          Attività
          <input value={activity} onChange={(e) => setActivity(e.target.value)} required />
        </label>
        <label>
          Progetto (opzionale)
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Senza progetto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button type="submit" className="btn-primary">
            START
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annulla
          </button>
        </div>
      </form>
    </div>
  )
}
