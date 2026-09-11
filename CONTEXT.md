# Beholder

Local time tracking for knowledge work. Beholder infers which Project the user is really working on, not which window is in the foreground.

## Language

**ActivityEvent**:
A raw telemetry sample from the PC at a point in time (process, title, paths, idle). It is not billed time.
_Avoid_: activity (in the timer-label sense), session, window session

**WorkSession**:
A time interval attributed to a Project. This is the timesheet unit.
_Avoid_: session as a window-change block, ActivityEvent

**Project**:
A local job or client that work is attributed to.
_Avoid_: ClickUp Space, account, client as a separate entity

**ProjectRule**:
A stored signal that can identify a Project (folder, domain, keyword, repository, window title, working directory, process).
_Avoid_: project mapping, hardcoded rule

**Sticky project**:
The Project currently believed to be in progress, kept until strong evidence of a change.
_Avoid_: current window, aggregation key

**Neutral context**:
An ActivityEvent that must not by itself change the sticky project (generic apps, generic sites, unidentifiable terminal). Time stays on the sticky project.
_Avoid_: excluded app, unclassified, unknown

**Unknown activity**:
A time interval that could not be attributed to a Project and is kept for later resolution.
_Avoid_: discarded event, idle, neutral context

**AFK**:
A stretch with no input long enough to mean the user stopped working. It is not work and does not become a WorkSession.
_Avoid_: idle session, idle_detection row

**Project Lock**:
An explicit user hold that attributes all ActivityEvents to one Project until the user unlocks, AFK, or a timeout.
_Avoid_: classifier result, sticky project

**Manual Override**:
A user correction of a WorkSession or interval. It outranks the classifier and must survive future reprocessing.
_Avoid_: Project Lock, mapping

**Manual timer**:
A user-started interval with an optional activity label; it acts as a Project Lock plus label for its duration.
_Avoid_: ActivityEvent, ClickUp Task

**Classification**:
The deterministic scoring of one ActivityEvent against ProjectRules, producing a candidate Project, confidence, and evidence.
_Avoid_: LLM classification (not in this context)

**Switch candidate**:
A Project other than the sticky project that is strong enough to start a pending change, not yet confirmed.
_Avoid_: sticky project, confirmed switch

**Gap filling**:
Merging a short unattributed interval that sits between two WorkSessions of the same Project.
_Avoid_: assigning unknown time between two different Projects

**Legacy session**:
A frozen window-keyed row from the pre-redesign `sessions` table. It is historical evidence, not a WorkSession.
_Avoid_: WorkSession, ActivityEvent
