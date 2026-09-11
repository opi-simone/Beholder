import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { AppSnapshot, UiTheme } from '../../shared/types'
import WindowShell from './components/WindowShell'
import DashboardPage, { TimerForm } from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import TimelinePage from './pages/TimelinePage'
import { persistTheme, readStoredTheme } from './theme'

type Page = 'dashboard' | 'timeline' | 'settings'

export default function App(): JSX.Element {
  const [snap, setSnap] = useState<AppSnapshot | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [timerOpen, setTimerOpen] = useState(false)
  const [theme, setTheme] = useState<UiTheme>(readStoredTheme)

  async function refresh(): Promise<void> {
    setSnap(await window.beholder.getSnapshot())
  }

  function changeTheme(next: UiTheme): void {
    setTheme(next)
    void persistTheme(next)
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

  useEffect(() => {
    if (!snap?.privacyAccepted) return
    void persistTheme(theme)
  }, [snap?.privacyAccepted])

  return (
    <WindowShell
      page={page}
      onPage={setPage}
      theme={theme}
      onTheme={changeTheme}
      snap={snap}
      showFooter={Boolean(snap?.privacyAccepted)}
      onOpenTimer={() => setTimerOpen(true)}
    >
      {!snap ? (
        <p className="muted">Caricamento…</p>
      ) : !snap.privacyAccepted ? (
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
      ) : (
        <>
          {page === 'dashboard' && (
            <DashboardPage snap={snap} onOpenTimeline={() => setPage('timeline')} />
          )}
          {page === 'timeline' && <TimelinePage />}
          {page === 'settings' && <SettingsPage theme={theme} onTheme={changeTheme} />}
          {timerOpen && <TimerForm onClose={() => setTimerOpen(false)} />}
        </>
      )}
    </WindowShell>
  )
}
