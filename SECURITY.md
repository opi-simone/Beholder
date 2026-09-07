# Security — Beholder MVP

## Principio

Beholder è local-first. Nell'MVP non apre porte di rete e non invia dati a server.

## Dati conservati

- Nome processo / applicazione
- Titolo della finestra
- Timestamp, durata, progetto/associazione
- Impostazioni locali (file SQLite `beholder.db` in `%APPDATA%\Beholder\`)

Percorso: `%APPDATA%\Beholder\`

## Dati non raccolti

- Tasti digitati
- Clipboard
- Screenshot
- Contenuto di form, email o documenti
- Password

## Permessi Windows

Il rilevamento della finestra attiva (milestone 2) userà API utente standard (`user32.dll`: `GetForegroundWindow`, `GetWindowText`, `GetLastInputInfo`). Non richiede amministratore, driver o servizi di sistema.

## Esclusioni

Le applicazioni in lista nera non verranno persistite (né metadati).

## Rete

L'MVP non effettua chiamate HTTP. Qualsiasi integrazione futura sarà esplicita e fuori da v0.1.
