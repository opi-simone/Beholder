import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { workSessionGroupLabel } from '../../../shared/grouping'
import type {
  ActivityEventView,
  LegacySession,
  Project,
  UnknownActivity,
  WorkSession
} from '../../../shared/types'
import { datetimeLocalValue, dayBounds, formatClock, formatDuration, shiftDate, todayDate } from '../../../shared/time'

type TimelineTab = 'riepilogo' | 'sessioni' | 'unknown'

function clipWork(session: WorkSession, date: string): number {
  const { start, end } = dayBounds(date)
  return Math.max(0, Math.min(session.endedAt, end) - Math.max(session.startedAt, start))
}

export default function TimelinePage(): JSX.Element {
  const [date, setDate] = useState(todayDate())
  const [tab, setTab] = useState<TimelineTab>('riepilogo')
  const [filterLabel, setFilterLabel] = useState<string | null>(null)
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [unknowns, setUnknowns] = useState<UnknownActivity[]>([])
  const [events, setEvents] = useState<ActivityEventView[]>([])
  const [legacy, setLegacy] = useState<LegacySession[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [debug, setDebug] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)
  const [error, setError] = useState('')

  async function reload(): Promise<void> {
    const [list, projs, unk, ev, leg] = await Promise.all([
      window.beholder.listSessions(date),
      window.beholder.listProjects(),
      window.beholder.listUnknown(date),
      debug ? window.beholder.listEvents(date) : Promise.resolve([]),
      showLegacy ? window.beholder.listLegacySessions(date) : Promise.resolve([])
    ])
    setSessions(list)
    setProjects(projs)
    setUnknowns(unk)
    setEvents(ev)
    setLegacy(leg)
  }

  useEffect(() => {
    setFilterLabel(null)
    void reload()
    return window.beholder.onChanged(() => {
      void reload()
    })
  }, [date, debug, showLegacy])

  const groups = [
    ...sessions
      .reduce((map, session) => {
        const label = workSessionGroupLabel(session)
        const cur = map.get(label) ?? { label, ms: 0, count: 0, labels: new Map<string, number>() }
        const ms = clipWork(session, date)
        cur.ms += ms
        cur.count += 1
        const task = session.activityLabel?.trim() || '(senza task)'
        cur.labels.set(task, (cur.labels.get(task) ?? 0) + ms)
        map.set(label, cur)
        return map
      }, new Map<string, { label: string; ms: number; count: number; labels: Map<string, number> }>())
      .values()
  ].sort((a, b) => b.ms - a.ms)

  const visible = filterLabel
    ? sessions.filter((session) => workSessionGroupLabel(session) === filterLabel)
    : sessions

  return (
    <>
      <section className="page-header row">
        <div>
          <p className="eyebrow">Timeline</p>
          <h1>{date}</h1>
        </div>
        <div className="actions">
          <button type="button" className="btn-ghost" onClick={() => setDate(shiftDate(date, -1))}>
            Giorno precedente
          </button>
          <button type="button" className="btn-ghost" onClick={() => setDate(todayDate())}>
            Oggi
          </button>
          <button type="button" className="btn-ghost" onClick={() => setDate(shiftDate(date, 1))}>
            Giorno successivo
          </button>
        </div>
      </section>
      <div className="subnav">
        <button
          type="button"
          className={tab === 'riepilogo' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => {
            setTab('riepilogo')
            setFilterLabel(null)
          }}
        >
          Riepilogo
        </button>
        <button
          type="button"
          className={tab === 'sessioni' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setTab('sessioni')}
        >
          Sessioni
        </button>
        <button
          type="button"
          className={tab === 'unknown' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setTab('unknown')}
        >
          Da classificare
        </button>
        <label className="check">
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
          Debug
        </label>
        <label className="check">
          <input type="checkbox" checked={showLegacy} onChange={(e) => setShowLegacy(e.target.checked)} />
          Storico precedente
        </label>
      </div>
      {error && <p className="banner danger">{error}</p>}
      {tab === 'riepilogo' && (
        <div className="timeline">
          {groups.length === 0 && <p className="muted">Nessuna sessione in questo giorno.</p>}
          {groups.map((group) => (
            <button
              type="button"
              key={group.label}
              className="group-row"
              onClick={() => {
                setFilterLabel(group.label)
                setTab('sessioni')
              }}
            >
              <span>
                <strong>{group.label}</strong>
                <span className="muted">
                  {' '}
                  · {group.count} {group.count === 1 ? 'sessione' : 'sessioni'}
                </span>
                {group.labels.size > 1 && (
                  <span className="muted block">
                    {[...group.labels.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, ms]) => `${name} ${formatDuration(ms)}`)
                      .join(' · ')}
                  </span>
                )}
              </span>
              <strong>{formatDuration(group.ms)}</strong>
            </button>
          ))}
        </div>
      )}
      {tab === 'sessioni' && (
        <div className="timeline">
          {filterLabel && (
            <p className="banner">
              Filtro: {filterLabel}{' '}
              <button type="button" className="btn-ghost" onClick={() => setFilterLabel(null)}>
                Mostra tutti
              </button>
            </p>
          )}
          {visible.length === 0 && <p className="muted">Nessuna sessione in questo giorno.</p>}
          {visible.map((session) => {
            const fullIndex = sessions.findIndex((item) => item.id === session.id)
            const previous = fullIndex > 0 ? sessions[fullIndex - 1] : undefined
            return (
              <SessionRow
                key={session.id}
                session={session}
                previous={previous}
                projects={projects}
                highlight={Boolean(filterLabel)}
                onError={setError}
                onProjects={setProjects}
              />
            )
          })}
        </div>
      )}
      {tab === 'unknown' && (
        <div className="timeline">
          {unknowns.length === 0 && <p className="muted">Niente da classificare in questo giorno.</p>}
          {unknowns.map((item) => (
            <UnknownRow key={item.id} item={item} projects={projects} onError={setError} />
          ))}
        </div>
      )}
      {debug && (
        <section className="card wide">
          <h2>ActivityEvent</h2>
          {events.length === 0 ? (
            <p className="muted">Nessun evento (attiva Debug e attendi il campionamento).</p>
          ) : (
            <ul className="plain-list debug-list">
              {events.map((event) => (
                <li key={event.id}>
                  <span>
                    {formatClock(event.timestamp)} {event.processName ?? '—'} — {event.windowTitle ?? ''}
                    {event.isNeutral ? ' · neutro' : ''} · {event.candidateProjectName ?? 'nessun progetto'} ·{' '}
                    {event.confidence ?? 0}% · {event.machineState ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {showLegacy && (
        <section className="card wide">
          <h2>Storico precedente</h2>
          <p className="muted">Blocchi finestra precedenti al redesign. Solo lettura.</p>
          {legacy.length === 0 ? (
            <p className="muted">Nessuno storico in questo giorno.</p>
          ) : (
            <ul className="plain-list">
              {legacy.map((row) => (
                <li key={row.id}>
                  <span>
                    {formatClock(row.startMs)}–{formatClock(row.endMs)} {row.processName}
                    {row.repoSlug ? ` — ${row.repoSlug}` : ''} · {row.projectName ?? 'Non classificato'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function sourceLabel(source: WorkSession['source']): string {
  if (source === 'manual_timer') return 'Manuale'
  if (source === 'lock') return 'Lock'
  if (source === 'override') return 'Override'
  return 'Automatico'
}

function SessionRow({
  session,
  previous,
  projects,
  highlight,
  onError,
  onProjects
}: {
  session: WorkSession
  previous?: WorkSession
  projects: Project[]
  highlight?: boolean
  onError: (msg: string) => void
  onProjects: (projects: Project[]) => void
}): JSX.Element {
  const [start, setStart] = useState(datetimeLocalValue(session.startedAt))
  const [end, setEnd] = useState(datetimeLocalValue(session.endedAt))
  const [projectId, setProjectId] = useState(session.projectId ? String(session.projectId) : '')
  const [remember, setRemember] = useState(false)

  useEffect(() => {
    setStart(datetimeLocalValue(session.startedAt))
    setEnd(datetimeLocalValue(session.endedAt))
    setProjectId(session.projectId ? String(session.projectId) : '')
  }, [session])

  async function run(action: () => Promise<void>): Promise<void> {
    try {
      onError('')
      await action()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Operazione non riuscita')
    }
  }

  return (
    <article className={highlight ? 'session highlight' : 'session'}>
      <header>
        <strong>
          {formatClock(session.startedAt)} – {formatClock(session.endedAt)} · {formatDuration(session.durationMs)}
        </strong>
        <span className="pill">{sourceLabel(session.source)}</span>
      </header>
      <p>
        {session.projectName ?? 'Non classificato'}
        {session.activityLabel ? ` · ${session.activityLabel}` : ''}
      </p>
      <p className="muted">
        confidenza {Math.round(session.confidence)}% · {session.status}
      </p>
      <div className="session-edit">
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            void run(() => window.beholder.updateTimes(session.id, new Date(start).getTime(), new Date(end).getTime()))
          }
        >
          Salva orari
        </button>
      </div>
      <div className="session-edit">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Non classificato</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Ricorda
        </label>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            void run(async () => {
              const pid = projectId ? Number(projectId) : null
              await window.beholder.assignSession({
                sessionId: session.id,
                projectId: pid,
                remember: Boolean(remember && pid)
              })
            })
          }
        >
          Override
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            void run(async () => {
              const name = window.prompt('Nome progetto')
              if (!name) return
              const created = await window.beholder.createProject(name)
              onProjects([...projects, created].sort((a, b) => a.name.localeCompare(b.name)))
              setProjectId(String(created.id))
            })
          }
        >
          Nuovo progetto
        </button>
      </div>
      <div className="session-edit">
        <button
          type="button"
          className="btn-ghost"
          disabled={!previous}
          onClick={() => previous && void run(() => window.beholder.mergeSessions(previous.id, session.id))}
        >
          Unisci al precedente
        </button>
        <button type="button" className="btn-danger" onClick={() => void run(() => window.beholder.deleteSession(session.id))}>
          Elimina
        </button>
      </div>
    </article>
  )
}

function UnknownRow({
  item,
  projects,
  onError
}: {
  item: UnknownActivity
  projects: Project[]
  onError: (msg: string) => void
}): JSX.Element {
  const [projectId, setProjectId] = useState(item.suggestedProjectId ? String(item.suggestedProjectId) : '')

  async function run(action: () => Promise<void>): Promise<void> {
    try {
      onError('')
      await action()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Operazione non riuscita')
    }
  }

  return (
    <article className="session">
      <header>
        <strong>
          {formatClock(item.startedAt)} – {formatClock(item.endedAt)} · {formatDuration(item.endedAt - item.startedAt)}
        </strong>
        <span className="pill">Unknown</span>
      </header>
      <p>
        {item.processName ?? '—'}
        {item.windowTitle ? ` — ${item.windowTitle}` : ''}
      </p>
      <p className="muted">
        precedente: {item.previousProjectName ?? '—'} · successivo: {item.nextProjectName ?? '—'}
        {item.suggestedProjectName ? ` · suggerito: ${item.suggestedProjectName}` : ''}
      </p>
      <div className="session-edit">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Progetto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-primary"
          disabled={!projectId}
          onClick={() =>
            void run(() => window.beholder.assignUnknown(item.id, Number(projectId), null))
          }
        >
          Assegna
        </button>
      </div>
    </article>
  )
}
