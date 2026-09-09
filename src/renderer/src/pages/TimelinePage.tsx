import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { sessionGroupLabel } from '../../../shared/grouping'
import type { Project, Session } from '../../../shared/types'
import { datetimeLocalValue, dayBounds, formatClock, formatDuration, shiftDate, todayDate } from '../../../shared/time'

type TimelineTab = 'cronologia' | 'riepilogo'

function clipDuration(session: Session, date: string): number {
  const { start, end } = dayBounds(date)
  return Math.max(0, Math.min(session.endMs, end) - Math.max(session.startMs, start))
}

export default function TimelinePage(): JSX.Element {
  const [date, setDate] = useState(todayDate())
  const [tab, setTab] = useState<TimelineTab>('cronologia')
  const [filterLabel, setFilterLabel] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')

  async function reload(): Promise<void> {
    const [list, projs] = await Promise.all([window.beholder.listSessions(date), window.beholder.listProjects()])
    setSessions(list)
    setProjects(projs)
  }

  useEffect(() => {
    setFilterLabel(null)
    void reload()
    return window.beholder.onChanged(() => {
      void reload()
    })
  }, [date])

  const groups = [
    ...sessions
      .reduce((map, session) => {
        const label = sessionGroupLabel(session)
        const cur = map.get(label) ?? { label, ms: 0, count: 0 }
        cur.ms += clipDuration(session, date)
        cur.count += 1
        map.set(label, cur)
        return map
      }, new Map<string, { label: string; ms: number; count: number }>())
      .values()
  ].sort((a, b) => b.ms - a.ms)

  const visible = filterLabel
    ? sessions.filter((session) => sessionGroupLabel(session) === filterLabel)
    : sessions

  return (
    <>
      <section className="hero row">
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
          className={tab === 'cronologia' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setTab('cronologia')}
        >
          Cronologia
        </button>
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
      </div>
      {error && <p className="banner danger">{error}</p>}
      {tab === 'riepilogo' ? (
        <div className="timeline">
          {groups.length === 0 && <p className="muted">Nessuna sessione in questo giorno.</p>}
          {groups.map((group) => (
            <button
              type="button"
              key={group.label}
              className="group-row"
              onClick={() => {
                setFilterLabel(group.label)
                setTab('cronologia')
              }}
            >
              <span>
                <strong>{group.label}</strong>
                <span className="muted">
                  {' '}
                  · {group.count} {group.count === 1 ? 'blocco' : 'blocchi'}
                </span>
              </span>
              <strong>{formatDuration(group.ms)}</strong>
            </button>
          ))}
        </div>
      ) : (
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
    </>
  )
}

function SessionRow({
  session,
  previous,
  projects,
  highlight,
  onError,
  onProjects
}: {
  session: Session
  previous?: Session
  projects: Project[]
  highlight?: boolean
  onError: (msg: string) => void
  onProjects: (projects: Project[]) => void
}): JSX.Element {
  const [start, setStart] = useState(datetimeLocalValue(session.startMs))
  const [end, setEnd] = useState(datetimeLocalValue(session.endMs))
  const [projectId, setProjectId] = useState(session.projectId ? String(session.projectId) : '')
  const [remember, setRemember] = useState(false)
  const [splitAt, setSplitAt] = useState(datetimeLocalValue(session.startMs + (session.endMs - session.startMs) / 2))

  useEffect(() => {
    setStart(datetimeLocalValue(session.startMs))
    setEnd(datetimeLocalValue(session.endMs))
    setProjectId(session.projectId ? String(session.projectId) : '')
  }, [session])

  const originLabel =
    session.origin === 'manual_timer' ? 'Manuale' : session.origin === 'idle_detection' ? 'Idle' : 'Automatico'

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
          {formatClock(session.startMs)} – {formatClock(session.endMs)} · {formatDuration(session.durationMs)}
        </strong>
        <span className="pill">{originLabel}</span>
      </header>
      <p>
        {session.processName}
        {session.repoSlug ? ` — ${session.repoSlug}` : session.windowTitle ? ` — ${session.windowTitle}` : ''}
      </p>
      <p className="muted">
        {session.projectName ?? 'Non classificato'}
        {session.activityLabel ? ` · ${session.activityLabel}` : ''}
        {` · ${session.classificationSource}`}
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
          Assegna
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
        <input type="datetime-local" value={splitAt} onChange={(e) => setSplitAt(e.target.value)} />
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void run(() => window.beholder.splitSession(session.id, new Date(splitAt).getTime()))}
        >
          Dividi
        </button>
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
