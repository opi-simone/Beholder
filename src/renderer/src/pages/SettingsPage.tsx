import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { AppSettings, Project, ProjectRuleView, RuleType, UiTheme } from '../../../shared/types'

const RULE_TYPES: { value: RuleType; label: string }[] = [
  { value: 'repository', label: 'Repository' },
  { value: 'folder', label: 'Cartella' },
  { value: 'domain', label: 'Dominio' },
  { value: 'keyword', label: 'Parola chiave' },
  { value: 'window_title', label: 'Titolo finestra' },
  { value: 'working_directory', label: 'Working directory' },
  { value: 'process', label: 'Processo' }
]

export default function SettingsPage({ theme, onTheme }: { theme: UiTheme; onTheme: (theme: UiTheme) => void }): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [rules, setRules] = useState<ProjectRuleView[]>([])
  const [excluded, setExcluded] = useState('')
  const [projectName, setProjectName] = useState('')
  const [ruleType, setRuleType] = useState<RuleType>('repository')
  const [pattern, setPattern] = useState('')
  const [mapProject, setMapProject] = useState('')

  async function reload(): Promise<void> {
    const [s, p, r] = await Promise.all([
      window.beholder.getSettings(),
      window.beholder.listProjects(),
      window.beholder.listRules()
    ])
    setSettings(s)
    setProjects(p)
    setRules(r)
  }

  useEffect(() => {
    void reload()
  }, [])

  if (!settings) return <p className="muted">Caricamento…</p>

  function patch(next: Partial<AppSettings>): void {
    void window.beholder.updateSettings(next).then(reload)
  }

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Impostazioni</p>
          <h1>Tracking per progetto</h1>
        </div>
      </section>
      <section className="card wide">
        <h2>Aspetto</h2>
        <p className="muted">Scegli il tema dell&apos;interfaccia. La preferenza resta salvata.</p>
        <div className="theme-toggle" role="group" aria-label="Tema">
          <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => onTheme('light')}>
            Chiaro
          </button>
          <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => onTheme('dark')}>
            Scuro
          </button>
        </div>
      </section>
      <section className="card wide">
        <h2>Algoritmo</h2>
        <label>
          Campionamento (secondi)
          <input
            type="number"
            min={1}
            max={15}
            value={Math.round(settings.pollIntervalMs / 1000)}
            onChange={(e) => patch({ pollIntervalMs: Number(e.target.value) * 1000 })}
          />
        </label>
        <label>
          Soglia AFK (minuti)
          <input
            type="number"
            min={1}
            max={60}
            value={Math.round(settings.idleThresholdMs / 60000)}
            onChange={(e) => patch({ idleThresholdMs: Number(e.target.value) * 60000 })}
          />
        </label>
        <label>
          Soglia avvio sessione
          <input
            type="number"
            min={0}
            max={100}
            value={settings.startThreshold}
            onChange={(e) => patch({ startThreshold: Number(e.target.value) })}
          />
        </label>
        <label>
          Soglia cambio progetto
          <input
            type="number"
            min={0}
            max={100}
            value={settings.switchThreshold}
            onChange={(e) => patch({ switchThreshold: Number(e.target.value) })}
          />
        </label>
        <label>
          Delay switch alta confidenza (s)
          <input
            type="number"
            min={5}
            max={600}
            value={settings.switchDelayHighSec}
            onChange={(e) => patch({ switchDelayHighSec: Number(e.target.value) })}
          />
        </label>
        <label>
          Delay switch media confidenza (s)
          <input
            type="number"
            min={5}
            max={600}
            value={settings.switchDelayMediumSec}
            onChange={(e) => patch({ switchDelayMediumSec: Number(e.target.value) })}
          />
        </label>
        <label>
          Delay switch bassa confidenza (s)
          <input
            type="number"
            min={5}
            max={600}
            value={settings.switchDelayLowSec}
            onChange={(e) => patch({ switchDelayLowSec: Number(e.target.value) })}
          />
        </label>
        <label>
          Gap filling max (secondi)
          <input
            type="number"
            min={0}
            max={3600}
            value={settings.maxGapFillSec}
            onChange={(e) => patch({ maxGapFillSec: Number(e.target.value) })}
          />
        </label>
        <label>
          Timeout lock (minuti, 0 = solo manuale/AFK)
          <input
            type="number"
            min={0}
            max={480}
            value={settings.lockTimeoutMin}
            onChange={(e) => patch({ lockTimeoutMin: Number(e.target.value) })}
          />
        </label>
        <label>
          Decay confidenza (punti per evento)
          <input
            type="number"
            min={0}
            max={50}
            value={settings.confidenceDecay}
            onChange={(e) => patch({ confidenceDecay: Number(e.target.value) })}
          />
        </label>
        <p className="muted">
          Il timesheet è la sessione di lavoro su un progetto, non il cambio finestra. Le app escluse non vengono
          salvate; ChatGPT e siti generici restano sul progetto corrente.
        </p>
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
        <h2>Regole di riconoscimento</h2>
        <form
          className="inline wrap"
          onSubmit={(e) => {
            e.preventDefault()
            if (!pattern.trim() || !mapProject) return
            void window.beholder.createRule(ruleType, pattern, Number(mapProject), ruleType === 'process' ? 50 : undefined).then(() => {
              setPattern('')
              void reload()
            })
          }}
        >
          <select value={ruleType} onChange={(e) => setRuleType(e.target.value as RuleType)}>
            {RULE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input placeholder="valore regola" value={pattern} onChange={(e) => setPattern(e.target.value)} />
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
          {rules.map((m) => (
            <li key={m.id}>
              <span>
                {m.ruleType} ({m.weight}): {m.ruleValue} → {m.projectName}
              </span>
              <button type="button" className="btn-ghost" onClick={() => void window.beholder.deleteRule(m.id).then(reload)}>
                Elimina
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
