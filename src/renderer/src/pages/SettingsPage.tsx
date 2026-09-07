import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { AppSettings, Mapping, MatchType, Project } from '../../../shared/types'

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [excluded, setExcluded] = useState('')
  const [projectName, setProjectName] = useState('')
  const [matchType, setMatchType] = useState<MatchType>('repo')
  const [pattern, setPattern] = useState('')
  const [mapProject, setMapProject] = useState('')

  async function reload(): Promise<void> {
    const [s, p, m] = await Promise.all([
      window.beholder.getSettings(),
      window.beholder.listProjects(),
      window.beholder.listMappings()
    ])
    setSettings(s)
    setProjects(p)
    setMappings(m)
  }

  useEffect(() => {
    void reload()
  }, [])

  if (!settings) return <p className="muted">Caricamento…</p>

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Impostazioni</p>
        <h1>Tracking locale</h1>
      </section>
      <section className="card wide">
        <h2>Intervalli</h2>
        <label>
          Campionamento (secondi)
          <input
            type="number"
            min={1}
            max={15}
            value={Math.round(settings.pollIntervalMs / 1000)}
            onChange={(e) =>
              void window.beholder
                .updateSettings({ pollIntervalMs: Number(e.target.value) * 1000 })
                .then(reload)
            }
          />
        </label>
        <label>
          Soglia idle (minuti)
          <input
            type="number"
            min={1}
            max={60}
            value={Math.round(settings.idleThresholdMs / 60000)}
            onChange={(e) =>
              void window.beholder
                .updateSettings({ idleThresholdMs: Number(e.target.value) * 60000 })
                .then(reload)
            }
          />
        </label>
      </section>
      <section className="card wide">
        <h2>App escluse</h2>
        <p className="muted">I campionamenti di questi processi non vengono salvati.</p>
        <ul className="plain-list">
          {settings.excludedProcesses.map((name) => (
            <li key={name}>
              <span>{name}</span>
              <button type="button" className="btn-ghost" onClick={() => void window.beholder.removeExcluded(name).then(reload)}>
                Rimuovi
              </button>
            </li>
          ))}
        </ul>
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault()
            if (!excluded.trim()) return
            void window.beholder.addExcluded(excluded).then(() => {
              setExcluded('')
              void reload()
            })
          }}
        >
          <input placeholder="es. keepass.exe" value={excluded} onChange={(e) => setExcluded(e.target.value)} />
          <button type="submit" className="btn-primary">
            Escludi
          </button>
        </form>
      </section>
      <section className="card wide">
        <h2>Progetti</h2>
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault()
            if (!projectName.trim()) return
            void window.beholder.createProject(projectName).then(() => {
              setProjectName('')
              void reload()
            })
          }}
        >
          <input placeholder="Nome progetto" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <button type="submit" className="btn-primary">
            Crea
          </button>
        </form>
        <ul className="plain-list">
          {projects.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      </section>
      <section className="card wide">
        <h2>Associazioni</h2>
        <form
          className="inline wrap"
          onSubmit={(e) => {
            e.preventDefault()
            if (!pattern.trim() || !mapProject) return
            void window.beholder.createMapping(matchType, pattern, Number(mapProject)).then(() => {
              setPattern('')
              void reload()
            })
          }}
        >
          <select value={matchType} onChange={(e) => setMatchType(e.target.value as MatchType)}>
            <option value="repo">Repository</option>
            <option value="process">Processo</option>
            <option value="title_contains">Titolo contiene</option>
          </select>
          <input placeholder="pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} />
          <select value={mapProject} onChange={(e) => setMapProject(e.target.value)}>
            <option value="">Progetto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            Aggiungi
          </button>
        </form>
        <ul className="plain-list">
          {mappings.map((m) => (
            <li key={m.id}>
              <span>
                {m.matchType}: {m.pattern} → {m.projectName}
              </span>
              <button type="button" className="btn-ghost" onClick={() => void window.beholder.deleteMapping(m.id).then(reload)}>
                Elimina
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
