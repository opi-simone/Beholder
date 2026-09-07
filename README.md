# Beholder

Applicazione desktop Windows per tracciare il tempo di lavoro dal contesto del computer.
Local-first: i dati restano sul PC. MVP senza rete e senza installer obbligatorio.

## Avvio in sviluppo

```bash
npm install
npm run dev
```

La finestra principale può essere chiusa: Beholder resta nella system tray. Uscita solo da tray → **Esci**.

Dati: `%APPDATA%\Beholder\` (`config.json` + `beholder.db`).

## Funzionalità v0.1

- Tracking della finestra attiva su Windows (API `user32`, senza admin)
- Aggregazione dei campionamenti in sessioni
- Riconoscimento repo Cursor dal titolo + associazioni utente
- Idle detection (default 5 minuti)
- Timer manuale con priorità sul tracking automatico
- Timeline giornaliera modificabile (orari, assegnazione, split, merge, elimina)
- Dashboard per progetto
- System tray
- Esclusione applicazioni

## Sicurezza

Vedi [SECURITY.md](SECURITY.md). SQLite è persistito come file locale tramite `sql.js` (nessun server, nessuna compilazione `node-gyp`).
