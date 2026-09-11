import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { AppSnapshot, DashboardDay, Project } from '../../../shared/types'
import { formatDuration, formatLongDate, todayDate } from '../../../shared/time'
import {
  IconChart,
  IconChevron,
  IconClassify,
  IconClock,
  IconFile,
  IconHourglass,
  IconPlay,
  IconPulse,
  IconUser
} from '../icons'

type Props = {
  snap: AppSnapshot
  onOpenTimeline: () => void
}

export default function DashboardPage({ snap, onOpenTimeline }: Props): JSX.Element {
  const [day, setDay] = useState<DashboardDay | null>(null)

  useEffect(() => {
    void window.beholder.getDashboard(todayDate()).then(setDay)
  }, [snap])

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
      <section className="page-header">
        <div>
          <p className="eyebrow">Dashboard giornaliera</p>
          <h1>Oggi</h1>
          <p className="page-date">{formatLongDate()}</p>
        </div>
        <p className="page-quote">“Piccoli passi, risultati duraturi.”</p>
      </section>
      {snap.unknownCount > 0 && (
        <button type="button" className="classify-banner" onClick={onOpenTimeline}>
          <span className="classify-icon">
            <IconClassify width={18} height={18} />
          </span>
          <span>Da classificare oggi: {snap.unknownCount} intervallo/i.</span>
          <IconChevron width={16} height={16} />
        </button>
      )}
      <section className="stat-grid">
        <StatCard icon="clock" label="Tempo rilevato" value={formatDuration(day?.totalMs ?? 0)} hint="Tempo totale oggi" />
        <StatCard icon="play" label="Timer manuale" value={formatDuration(day?.manualMs ?? 0)} hint="Tempo tracciato manualmente" />
        <StatCard icon="file" label="Da classificare" value={formatDuration(day?.unknownMs ?? 0)} hint="Intervalli da assegnare" />
        <StatCard icon="idle" label="Non attribuito" value={formatDuration(day?.unclassifiedMs ?? 0)} hint="Tempo senza progetto" />
        <StatCard icon="pulse" label="Stato" value={statusLabel} hint="Monitoraggio attivo" tone="success" />
        <StatCard
          icon="hourglass"
          label="Timer attivo"
          value={snap.manualTimer ? snap.manualTimer.activityLabel : 'Nessuno'}
          hint={snap.manualTimer ? 'Timer in esecuzione' : 'Nessun timer in esecuzione'}
        />
      </section>
      <section className="card wide">
        <div className="card-head">
          <h2>Tempo per progetto</h2>
          <span className="chip">Oggi</span>
        </div>
        {day && day.byProject.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <IconChart width={22} height={22} />
            </span>
            <p>Nessuna sessione oggi.</p>
            <p className="muted">Il tempo tracciato verrà mostrato qui.</p>
          </div>
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
    </>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'blue'
}: {
  icon: 'clock' | 'play' | 'file' | 'idle' | 'pulse' | 'hourglass'
  label: string
  value: string
  hint: string
  tone?: 'blue' | 'success'
}): JSX.Element {
  return (
    <article className="stat">
      <span className={`stat-icon ${tone}`}>{iconSvg(icon)}</span>
      <div>
        <span className="stat-label">{label}</span>
        <strong className={tone === 'success' ? 'ok' : undefined}>{value}</strong>
        <span className="stat-hint">{hint}</span>
      </div>
    </article>
  )
}

function iconSvg(kind: string): ReactNode {
  const common = { width: 18, height: 18 }
  if (kind === 'play') return <IconPlay {...common} />
  if (kind === 'file') return <IconFile {...common} />
  if (kind === 'idle') return <IconUser {...common} />
  if (kind === 'pulse') return <IconPulse {...common} />
  if (kind === 'hourglass') return <IconHourglass {...common} />
  return <IconClock {...common} />
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
