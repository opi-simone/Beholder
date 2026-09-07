import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { AppSnapshot, DashboardDay, Project } from '../../../shared/types'
import { formatDuration, todayDate } from '../../../shared/time'

type Props = {
  snap: AppSnapshot
  onOpenTimer: () => void
}

export default function DashboardPage({ snap, onOpenTimer }: Props): JSX.Element {
  const [day, setDay] = useState<DashboardDay | null>(null)

  useEffect(() => {
    void window.beholder.getDashboard(todayDate()).then(setDay)
  }, [snap])

  const paused = snap.trackingStatus === 'paused'
  const statusLabel =
    snap.trackingStatus === 'manual'
      ? 'Timer manuale'
      : snap.trackingStatus === 'paused'
        ? 'In pausa'
        : snap.trackingStatus === 'idle_pending'
          ? 'Inattivo'
          : 'Tracking automatico'

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Dashboard giornaliera</p>
        <h1>Oggi</h1>
        <p className="muted">{snap.currentContextLabel}</p>
      </section>
      {snap.idlePendingCount > 0 && (
        <p className="banner">
          {snap.idlePendingCount} periodo/i idle da revisionare in timeline.
        </p>
      )}
      <section className="stats">
        <article className="stat">
          <span className="stat-label">Tempo rilevato</span>
          <strong>{formatDuration(day?.totalMs ?? 0)}</strong>
        </article>
        <article className="stat">
          <span className="stat-label">Timer manuali</span>
          <strong>{formatDuration(day?.manualMs ?? 0)}</strong>
        </article>
        <article className="stat">
          <span className="stat-label">Non classificato</span>
          <strong>{formatDuration(day?.unclassifiedMs ?? 0)}</strong>
        </article>
        <article className="stat">
          <span className="stat-label">Idle</span>
          <strong>{formatDuration(day?.idleMs ?? 0)}</strong>
        </article>
        <article className="stat">
          <span className="stat-label">Stato</span>
          <strong>{statusLabel}</strong>
        </article>
        <article className="stat">
          <span className="stat-label">Timer attivo</span>
          <strong>{snap.manualTimer ? snap.manualTimer.activityLabel : 'Nessuno'}</strong>
        </article>
      </section>
      <section className="card wide">
        <h2>Tempo per progetto</h2>
        {day && day.byProject.length === 0 ? (
          <p className="muted">Nessuna sessione oggi.</p>
        ) : (
          <ul className="plain-list">
            {day?.byProject.map((row) => (
              <li key={row.projectId ?? 'none'}>
                <span>{row.name}</span>
                <strong>{formatDuration(row.ms)}</strong>
              </li>
            ))}
          </ul>
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
      </div>
    </>
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
