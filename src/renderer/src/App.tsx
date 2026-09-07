import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { AppSnapshot } from '../../shared/types'
import WindowShell from './components/WindowShell'
import DashboardPage, { TimerForm } from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import TimelinePage from './pages/TimelinePage'

type Page = 'dashboard' | 'timeline' | 'settings'

export default function App(): JSX.Element {
  const [snap, setSnap] = useState<AppSnapshot | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [timerOpen, setTimerOpen] = useState(false)

  async function refresh(): Promise<void> {
    setSnap(await window.beholder.getSnapshot())
  }

  useEffect(() => {
    void refresh()
    const offChanged = window.beholder.onChanged(() => {
      void refresh()
    })
    const offOpen = window.beholder.onOpen((next) => {
      if (next === 'timer') {
        setPage('dashboard')
        setTimerOpen(true)
        return
      }
      setPage(next)
    })
    return () => {
      offChanged()
      offOpen()
    }
  }, [])

  if (!snap) {
    return (
      <WindowShell title="Beholder" page="dashboard" onPage={setPage}>
        <p className="muted">Caricamento…</p>
      </WindowShell>
    )
  }

  if (!snap.privacyAccepted) {
    return (
      <WindowShell title="Beholder" page="dashboard" onPage={setPage}>
        <section className="card">
          <h1>Privacy locale</h1>
          <p>
            Beholder registra solo metadati su questo computer: nome processo, titolo finestra, timestamp e durata. Non
            registra tasti, clipboard, screenshot o contenuto di documenti. Nell&apos;MVP non invia dati in rete.
          </p>
          <button type="button" className="btn-primary" onClick={() => void window.beholder.acceptPrivacy().then(setSnap)}>
            Accetto, avvia Beholder
          </button>
        </section>
      </WindowShell>
    )
  }

  return (
    <WindowShell title="Beholder" page={page} onPage={setPage}>
      {page === 'dashboard' && <DashboardPage snap={snap} onOpenTimer={() => setTimerOpen(true)} />}
      {page === 'timeline' && <TimelinePage />}
      {page === 'settings' && <SettingsPage />}
      {timerOpen && <TimerForm onClose={() => setTimerOpen(false)} />}
    </WindowShell>
  )
}
