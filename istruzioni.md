Beholder — Redesign del sistema di Time Tracking

1. Obiettivo

Beholder deve smettere di considerare ogni cambio finestra come un cambio di attività lavorativa.

Il problema attuale è che l'utente lavora spesso su più applicazioni nello stesso contesto operativo:

Cursor

Browser

Terminale

ChatGPT

ClickUp

Explorer

Outlook / Gmail

strumenti di sviluppo vari

Passare da una finestra all'altra non significa necessariamente cambiare progetto.

Esempio:

14:00 Cursor — progetto Cliente A
14:05 Chrome — staging.cliente-a.it
14:08 ChatGPT — ricerca su un problema tecnico
14:12 Cursor — progetto Cliente A
14:18 Terminal — repository Cliente A
14:21 Chrome — cliente-a.it

Il sistema NON deve creare 6 attività diverse.

Il risultato corretto deve essere:

14:00 → 14:21
Cliente A
21 minuti

La finestra attiva deve diventare soltanto un segnale di contesto, non l'unità di contabilizzazione.

2. Principio architetturale

Separare chiaramente:

Activity Events

Context Detection

Project Classification

Work Sessions

Task Association

Timesheet / Reporting

Flusso:

EVENTI GREZZI
↓
RICONOSCIMENTO CONTESTO
↓
CLASSIFICAZIONE PROGETTO
↓
SESSIONE DI LAVORO
↓
ASSOCIAZIONE TASK CLICKUP
↓
TIMESHEET

3. ActivityEvent

Gli ActivityEvent rappresentano la telemetria grezza del PC.

NON rappresentano direttamente ore lavorate.

Struttura consigliata:

ActivityEvent:
    id
    timestamp
    process_name
    window_title
    executable_path
    url
    workspace_path
    git_repository
    working_directory
    clickup_task_id
    idle_seconds

Esempio:

{
    "timestamp": "2026-09-10 14:05:22",
    "process_name": "firefox.exe",
    "window_title": "Homepage - Cliente A",
    "url": "https://staging.cliente-a.it",
    "workspace_path": null,
    "git_repository": null,
    "working_directory": null,
    "clickup_task_id": null,
    "idle_seconds": 0
}

Tutti gli eventi devono essere persistiti nel database.

4. WorkSession

La vera unità di lavoro deve essere la WorkSession.

Struttura consigliata:

WorkSession:
    id
    project_id
    clickup_task_id
    started_at
    ended_at
    duration_seconds
    confidence
    source
    status
    created_at
    updated_at

Esempio:

Project: Cliente A
Task: Fix checkout
Start: 14:00
End: 14:47
Confidence: 92%

Un cambio finestra NON deve chiudere automaticamente una WorkSession.

5. Tabella Projects

Beholder deve conoscere i progetti e i segnali che permettono di identificarli.

Struttura suggerita:

Project:
    id
    name
    clickup_space_id
    clickup_list_id
    is_active

Per ogni progetto devono essere definite regole di riconoscimento.

Esempio:

{
    "name": "Cliente A",
    "rules": {
        "folders": [
            "C:/development/cliente-a"
        ],
        "domains": [
            "cliente-a.it",
            "staging.cliente-a.it"
        ],
        "keywords": [
            "cliente a",
            "cliente-a"
        ],
        "repositories": [
            "cliente-a"
        ]
    }
}

Le regole dovrebbero essere salvate nel database, non hardcoded.

6. Project Classification

Creare un componente dedicato:

ProjectClassifier

Responsabilità:

ricevere ActivityEvent

valutare i segnali

assegnare uno score ai progetti

restituire:

candidate_project

confidence

evidenze che hanno determinato il risultato

Esempio:

Cliente A: 92
Cliente B: 15
Beholder: 0
Hydra: 0

Risultato:

candidate_project = Cliente A
confidence = 92

7. Scoring

Valori iniziali suggeriti:

Segnale

Score

Workspace Cursor corrisponde

+100

Repository Git corrisponde

+100

ClickUp task associato

+100

Dominio browser corrisponde

+90

File/folder path corrisponde

+80

Working directory terminale

+80

Titolo finestra contiene progetto

+50

Ultimo progetto attivo

+20

Applicazione generica

0

Lo score finale deve essere normalizzato in un valore 0-100.

Il sistema deve salvare anche le evidenze.

Esempio:

{
    "project_id": 12,
    "confidence": 94,
    "evidence": [
        "workspace_path",
        "git_repository"
    ]
}

8. Neutral Context

Alcune applicazioni NON devono causare automaticamente un cambio progetto.

Esempi:

ChatGPT

Google

Gmail

Outlook

Explorer

Calculator

Notepad

browser su siti generici

terminale senza working directory identificabile

Questi eventi devono essere classificati come:

NEUTRAL_CONTEXT

Se il progetto corrente è Cliente A e l'utente passa per alcuni minuti su ChatGPT, Beholder deve continuare ad attribuire il tempo a Cliente A finché non compaiono segnali forti di un altro progetto.

9. Sticky Project

Implementare il concetto di progetto persistente.

Quando un progetto viene identificato con buona confidenza:

sticky_project = project

Il progetto rimane attivo finché non arriva evidenza sufficientemente forte di un cambio.

Esempio:

Cursor — Beholder
→ sticky_project = Beholder

Chrome — StackOverflow
→ rimane Beholder

ChatGPT
→ rimane Beholder

Explorer
→ rimane Beholder

Cursor — Hydra
→ candidate = Hydra

Hydra persiste abbastanza a lungo
→ sticky_project = Hydra

10. State Machine

Implementare una state machine con almeno questi stati:

IDLE
WORKING
UNCERTAIN
SWITCH_PENDING

IDLE

L'utente è inattivo.

WORKING

È presente un progetto corrente con sufficiente confidenza.

UNCERTAIN

Il sistema sta ricevendo eventi non classificabili o appartenenti a contesti neutri.

Il progetto corrente continua a rimanere attivo, eventualmente con confidence decay.

SWITCH_PENDING

È stato rilevato un altro progetto ma il cambio non è ancora confermato.

11. Debounce sul cambio progetto

Non cambiare progetto immediatamente.

Parametri iniziali:

SWITCH_THRESHOLD = 70

SWITCH_DELAY_LOW = 90
SWITCH_DELAY_MEDIUM = 45
SWITCH_DELAY_HIGH = 10

MEDIUM_CONFIDENCE = 80
HIGH_CONFIDENCE = 95

Logica:

if confidence >= 95:
    switch_delay = 10

elif confidence >= 80:
    switch_delay = 45

else:
    switch_delay = 90

Il cambio deve essere confermato solo quando:

candidate_project != current_project
AND
confidence >= SWITCH_THRESHOLD
AND
candidate persiste per switch_delay

12. Cambio retroattivo

Il debounce serve a evitare falsi positivi, ma NON deve perdere tempo.

Esempio:

15:14:20 → Cliente B rilevato
15:15:50 → Cliente B confermato

La nuova sessione deve iniziare da:

15:14:20

non dalle 15:15:50.

Pseudo-codice:

close_current_session(
    ended_at=switch_started_at
)

start_session(
    project=candidate_project,
    started_at=switch_started_at
)

13. Algoritmo principale

Pseudo-codice:

def on_activity(event):

    if is_idle():
        handle_idle()
        return

    result = classifier.calculate_scores(event)

    candidate = result.best_project
    confidence = result.best_score

    if current_project is None:
        if confidence >= START_THRESHOLD:
            start_session(candidate)

        return

    if candidate == current_project:
        reset_switch_candidate()
        increase_current_confidence()
        return

    if is_neutral_context(event):
        keep_current_project()
        decay_confidence()
        return

    if confidence < SWITCH_THRESHOLD:
        keep_current_project()
        return

    handle_switch_candidate(
        project=candidate,
        confidence=confidence,
        timestamp=event.timestamp
    )

14. Gestione switch candidate

def handle_switch_candidate(project, confidence, timestamp):

    if switch_candidate != project:
        switch_candidate = project
        switch_started_at = timestamp
        return

    elapsed = timestamp - switch_started_at

    delay = calculate_switch_delay(confidence)

    if elapsed >= delay:

        close_current_session(
            ended_at=switch_started_at
        )

        start_session(
            project=project,
            started_at=switch_started_at
        )

        reset_switch_candidate()

15. Idle / AFK

Parametro iniziale:

IDLE_THRESHOLD = 300

equivalente a 5 minuti.

Scenario:

14:00 Cliente A
14:42 utente smette di usare PC
14:47 Beholder raggiunge la soglia AFK

La sessione deve terminare retroattivamente alle:

14:42

non alle 14:47.

Formula:

idle_started_at = current_time - idle_seconds

Chiudere la sessione a:

ended_at = idle_started_at

Quando l'utente torna:

nuova attività

nuova classificazione

eventuale nuova WorkSession

16. Gap Filling

Implementare un post-processing delle sessioni.

Parametro:

MAX_GAP_FILL = 300

5 minuti.

Esempio:

10:00 Cliente A
10:20 UNKNOWN
10:25 Cliente A

Se UNKNOWN dura meno di MAX_GAP_FILL:

A → UNKNOWN → A

trasformare in:

10:00 → 10:25 Cliente A

NON fare invece automaticamente:

A → UNKNOWN → B

In questo caso l'intervallo UNKNOWN deve rimanere da classificare oppure essere risolto usando ulteriori segnali.

17. Unknown Events

Gli eventi non classificabili NON devono essere scartati.

Salvare:

UnknownActivity:
    id
    started_at
    ended_at
    process_name
    window_title
    url
    previous_project_id
    next_project_id
    suggested_project_id
    confidence

Dashboard suggerita:

Da classificare oggi: 17 minuti

Esempio:

10:13 - 10:18
ChatGPT

precedente: Cliente A
successivo: Cliente A

Suggerimento:
Cliente A

18. Manual Override

Prevedere la possibilità per l'utente di scegliere manualmente:

Cliente A
Fix Checkout

Un override manuale deve avere priorità molto alta sul classifier.

Possibile struttura:

manual_override = {
    "project_id": 12,
    "task_id": 443,
    "started_at": "...",
    "expires_at": "..."
}

19. Project Lock

Aggiungere una funzione Lock.

UI:

🔒 Cliente A

Quando il lock è attivo:

tutti gli ActivityEvent vengono attribuiti al progetto bloccato

nessun cambio progetto automatico

il lock può terminare:

manualmente

dopo AFK

dopo timeout configurabile

Questo è utile quando l'utente sa già che lavorerà per un certo periodo su un progetto aprendo molte applicazioni differenti.

20. Cursor Detection

Cursor deve essere una delle fonti più importanti.

Provare a recuperare:

workspace_path
project folder
repository Git
window title

Esempio:

C:\dev\dentalprestigepartner

deve permettere di classificare:

Dental Prestige

Il solo dato:

process = Cursor.exe

non è sufficiente.

21. Browser Detection

Idealmente recuperare la URL della tab attiva.

Segnali utili:

hostname
path
page title

Esempio:

https://dentalprestigepartner.it/wp-admin/

→ Dental Prestige

Esempio:

https://github.com/opiquad/dentalprestige

→ Dental Prestige

Le URL generiche non devono causare cambi progetto.

22. Terminal Detection

Provare a recuperare:

working_directory
repository Git corrente
window title

Esempio:

PS C:\Dev\beholder>

→ Beholder

23. ClickUp

Beholder è già integrato con ClickUp.

ClickUp deve essere usato principalmente come:

Project ↔ ClickUp Space/List
Task ↔ ClickUp Task

Un task ClickUp aperto è un segnale forte, ma NON deve essere l'unica fonte di verità.

Score suggerito:

CLICKUP_TASK_MATCH = 100

24. AI / LLM

NON usare un LLM come sistema principale di tracking.

Motivi:

costo

latenza

privacy

comportamento poco deterministico

difficoltà di debug

gran parte dei casi è risolvibile con regole

Il classifier principale deve essere deterministico.

Eventualmente usare AI soltanto per:

UNKNOWN / AMBIGUOUS CONTEXT

Esempio:

Cliente A score 45
Cliente B score 40

In casi del genere è possibile prevedere in futuro un classificatore AI opzionale.

Non implementarlo nella prima versione del redesign.

25. Database

Mantenere almeno queste entità:

projects
project_rules
activity_events
work_sessions
unknown_activities
manual_overrides
settings

Possibile schema SQLite.

projects

CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    clickup_space_id TEXT,
    clickup_list_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

project_rules

CREATE TABLE project_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    rule_type TEXT NOT NULL,
    rule_value TEXT NOT NULL,
    weight INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);

Tipi possibili:

folder
domain
keyword
repository
window_title
working_directory
clickup_task

activity_events

CREATE TABLE activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    process_name TEXT,
    window_title TEXT,
    executable_path TEXT,
    url TEXT,
    workspace_path TEXT,
    git_repository TEXT,
    working_directory TEXT,
    clickup_task_id TEXT,
    idle_seconds INTEGER DEFAULT 0
);

work_sessions

CREATE TABLE work_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    clickup_task_id TEXT,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    duration_seconds INTEGER,
    confidence REAL,
    source TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);

26. Configurazione iniziale

Usare inizialmente:

ACTIVITY_POLL_INTERVAL = 2

IDLE_THRESHOLD = 300

START_THRESHOLD = 60

SWITCH_THRESHOLD = 70

HIGH_CONFIDENCE = 95
MEDIUM_CONFIDENCE = 80

SWITCH_DELAY_HIGH = 10
SWITCH_DELAY_MEDIUM = 45
SWITCH_DELAY_LOW = 90

MAX_GAP_FILL = 300

Questi valori devono diventare configurabili.

27. Architettura codice suggerita

beholder/
│
├── tracking/
│   ├── activity_monitor.py
│   ├── idle_detector.py
│   ├── browser_detector.py
│   ├── workspace_detector.py
│   └── git_detector.py
│
├── classification/
│   ├── project_classifier.py
│   ├── scoring.py
│   └── rules.py
│
├── sessions/
│   ├── session_manager.py
│   ├── state_machine.py
│   └── gap_filler.py
│
├── integrations/
│   └── clickup/
│
├── database/
│   ├── models.py
│   └── repository.py
│
└── ui/

Separare rigorosamente:

Tracking

da:

Classification

da:

Session Management

28. Vincoli fondamentali

NON implementare il sistema secondo queste regole:

cambio finestra = cambio attività

NON implementare semplicemente:

ignora cambi finestra inferiori a X secondi

Questa sarebbe soltanto una patch e non risolverebbe il problema.

Esempio:

Cursor Cliente A
↓
Chrome per 8 minuti
↓
Cursor Cliente A

Gli 8 minuti Chrome possono tranquillamente appartenere allo stesso lavoro Cliente A.

La domanda corretta non è:

quanto tempo è rimasta aperta questa finestra?

ma:

a quale contesto lavorativo appartiene questa attività?

29. Reporting

Gli ActivityEvent non devono essere mostrati come timesheet principale.

Esempio dati grezzi:

14:00 Cursor
14:04 Firefox
14:07 ChatGPT
14:11 Cursor

Report corretto:

14:00 → 14:36
Beholder
36 minuti

Le ActivityEvent possono essere visualizzate soltanto come dettaglio/debug.

30. Aggregazione giornaliera

Le WorkSession possono essere frammentate internamente.

Esempio:

09:00-09:13 Cliente A
09:13-09:20 Cliente B
09:20-10:04 Cliente A

Il riepilogo deve aggregare:

Cliente A    57 min
Cliente B     7 min

Se disponibili anche i task:

Cliente A
 ├─ Fix checkout       42 min
 └─ Aggiornamenti WP   15 min

Cliente B
 └─ Supporto            7 min

31. Logging e Debug

Ogni decisione del classifier deve poter essere spiegata.

Esempio log:

[14:21:14]
Current project: Cliente A

Candidate: Cliente B
Confidence: 92

Evidence:
+100 workspace_path=C:\dev\cliente-b
+50 window_title contains "cliente-b"

State:
SWITCH_PENDING

Switch started:
14:21:14

Successivamente:

[14:22:44]

Candidate persisted for 90 sec.

Switch confirmed.

Old:
Cliente A
ended_at=14:21:14

New:
Cliente B
started_at=14:21:14

Questi log sono fondamentali per calibrare l'algoritmo.

32. Reprocessing

Poiché gli ActivityEvent vengono conservati, il sistema deve essere progettato per permettere in futuro il ricalcolo delle WorkSession.

Possibile comando futuro:

reprocess_day(2026-09-10)

Il processo:

elimina o invalida le WorkSession generate automaticamente

legge gli ActivityEvent

applica il nuovo classifier

rigenera le sessioni

Gli override manuali NON devono essere persi.

33. Criteri di accettazione

La nuova implementazione può essere considerata riuscita se:

Caso 1

Cursor Cliente A
→ Chrome Cliente A
→ ChatGPT
→ Cursor Cliente A

Risultato:

1 WorkSession Cliente A

Caso 2

Cursor Cliente A
→ ChatGPT 3 minuti
→ Cursor Cliente A

Risultato:

1 WorkSession Cliente A

Caso 3

Cursor Cliente A
→ Cursor Cliente B per 20 secondi
→ Cursor Cliente A

Risultato:

Cliente A

senza cambio sessione.

Caso 4

Cursor Cliente A
→ Cursor Cliente B per 3 minuti

Risultato:

switch Cliente A → Cliente B

con timestamp retroattivo all'inizio del cambio.

Caso 5

Cliente A
→ 15 minuti AFK
→ Cliente A

Risultato:

Sessione Cliente A
AFK escluso
Nuova sessione Cliente A

Caso 6

Cliente A
→ UNKNOWN 3 minuti
→ Cliente A

Risultato:

gap filling

e quindi una sessione continua Cliente A.

Caso 7

Cliente A
→ UNKNOWN
→ Cliente B

Risultato:

UNKNOWN non assegnato automaticamente

a meno che non esistano evidenze sufficienti.

34. Priorità di implementazione

Implementare in questo ordine.

Fase 1

Separare ActivityEvent e WorkSession.

Fase 2

Creare Projects e ProjectRules.

Fase 3

Implementare ProjectClassifier deterministico.

Fase 4

Implementare Sticky Project.

Fase 5

Implementare State Machine.

Fase 6

Implementare Debounce e switch retroattivo.

Fase 7

Implementare Idle / AFK.

Fase 8

Implementare Gap Filling.

Fase 9

Aggiungere Unknown Activities.

Fase 10

Aggiungere Manual Override e Project Lock.

Fase 11

Migliorare rilevamento Cursor, browser, Git e terminale.

Fase 12

Aggiungere UI di debug e calibrazione.

35. Indicazione per Cursor

Prima di modificare il codice esistente:

analizzare l'architettura corrente di Beholder

identificare il codice che crea/modifica le sessioni quando cambia active window

NON riscrivere tutto da zero se non necessario

mantenere compatibilità con SQLite e ClickUp esistenti

proporre una migration del database

separare tracking grezzo e contabilizzazione

implementare il redesign in step piccoli e verificabili

aggiungere test automatici per i casi descritti nei criteri di accettazione

Prima di procedere con modifiche distruttive, generare un breve piano tecnico dei file da modificare.

36. Obiettivo finale

Beholder non deve più rispondere alla domanda:

Quale finestra è attiva?

Deve rispondere alla domanda:

Su quale progetto sta realmente lavorando l'utente in questo momento?

La finestra attiva è soltanto uno dei segnali utilizzati per prendere questa decisione.

Il sistema deve privilegiare stabilità, prevedibilità e possibilità di correzione rispetto a una falsa precisione automatica.