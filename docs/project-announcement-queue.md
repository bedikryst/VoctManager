# Plan: project publication + announcement queue

Status: AGREED, NOT STARTED · Written 2026-07-24 · Requires migrations (new model + possibly one field on `Project`).

This is a **staged plan, not a line-exact spec**. Each stage below states the goal, the scope, what
"done" looks like, and the traps found while surveying the tree. It deliberately stops short of
prescribing implementation — read the code, disagree where the code tells you something different,
and update this file when you do.

Stages are meant to be executed in separate sessions. Stage 0 and 0b stand alone and are worth
shipping even if the rest never happens.

---

## The problem

Persistence and announcement are one operation. Every write in `roster/services.py` also fans out a
notification, which produces three defects — only the first is about volume:

1. **Flood.** 5 rehearsals × 12 confirmed singers = 60 e-mails + 60 pushes. Saving divisi issues one
   HTTP request per casting, so one "Save" can emit ~60 more pushes.
2. **No editorial control.** A typo corrected one minute later ships as `URGENT` "rehearsal moved:
   19:00 → 19:30" for a rehearsal that never existed. This *devalues the alarm channel* — once
   URGENT usually means "the conductor was fixing something", a real reschedule stops landing. This
   is the worst of the three.
3. **No build/maintain distinction.** `Project.Status.DRAFT` is the model default but no emitter
   checks it, so a project still being planned already alarms its confirmed cast.

## The agreed model

**Phase 1 — Building (`DRAFT`): total silence to artists.** The conductor writes details, adds and
removes people, builds the programme, schedule and divisi. Nothing leaves the app. Managers see
everything in-app as they do today (this is about outbound channels + the artist's bell, not about
access control).

**Phase 2 — Publication (`DRAFT → ACTIVE`): one deliberate act.** Every invited artist receives a
full `PROJECT_INVITATION` — e-mail + push + in-app row + the existing invitation modal — carrying
the complete picture of the concert.

**Phase 3 — Maintenance (`ACTIVE`): the announcement queue.** Every subsequent change accrues in a
durable, server-side queue scoped to the project. The conductor reviews and publishes them as **one
composite briefing per recipient**, containing the shared changes (schedule, details) plus that
person's own changes (their voice line, their part). Cancellations bypass the queue.

Guiding invariant: **the database is the truth; the announcement is a courtesy.** An artist opening
the app always sees current data, queued or not. The announcement serves the people who are not
looking.

---

## Verified facts about the current tree

Surveyed 2026-07-24. Line numbers drift — treat them as pointers, not addresses.

**Artist-facing emitters, all in `backend/roster/services.py`:**

| Site | Type | Level |
|---|---|---|
| `ProjectManagementService.update_project` (~515) | `PROJECT_UPDATED` | WARNING / URGENT |
| same method, cancellation branch (~492) | `PROJECT_CANCELLED` | URGENT |
| `delete_participation` (~539) | `PROJECT_UPDATED` event=`removed` | WARNING |
| invitation on participation create (~600) | `PROJECT_INVITATION` | INFO |
| `RehearsalOperationsService.schedule_rehearsal` (~715) | `REHEARSAL_SCHEDULED` | INFO |
| `update_rehearsal` (~785) | `REHEARSAL_UPDATED` | WARNING / URGENT |
| `delete_rehearsal` (~814) | `REHEARSAL_CANCELLED` | URGENT |
| `CastingAndCrewService.assign_piece_casting` (~1036) | `PIECE_CASTING_ASSIGNED` | INFO |
| `update_piece_casting` (~1074) | `PIECE_CASTING_UPDATED` | INFO |
| `delete_piece_casting` (~1099) | `PIECE_CASTING_UPDATED` event=`removed` | WARNING |

All follow the same shape: build a Pydantic metadata DTO → `model_dump(mode="json")` →
`transaction.on_commit(lambda: send_*_task.delay(...))`. **That shape is the seam.** The metadata
construction is correct and stays; only its destination changes.

**Default e-mail tiers** — `backend/notifications/delivery.py`. Rehearsal scheduled/updated/cancelled
and project updated/cancelled/invitation all default e-mail **ON**. Casting defaults e-mail **OFF**
(push only). So the rehearsal schedule is precisely the high-volume mailer.

**Do not touch `notifications/message_content.py`** — it is the SSOT composing copy for push, e-mail
and the in-app bell in three languages. New work adds a composer there; it does not restructure it.

**`NotificationRecipientPolicy.from_participations`** (`notifications/services.py`) filters to
`status='CON'` by default. At publication time nobody has confirmed yet — everyone is `INV`. Calling
it with the default there sends to **zero people, silently**. It already accepts
`confirmed_only=False`.

**The invitation modal already exists** — `frontend/src/features/notifications/components/ProjectInvitationToasts.tsx`,
mounted once in `DashboardLayout`, driven by pending `INVITED` participations, and already
coordinated with the chorister welcome overlay (see `welcome-invitation-and-email-gating-spec.md`).
Publication should feed it, not replace it.

**Divisi saves N requests** — `frontend/src/features/projects/editors/hooks/useMicroCasting.ts`
runs deletes, then updates, then creates as separate `mutateAsync` calls.

**A new `NotificationType` touches ~8 layers** (model choice, `delivery.py` tier, `message_content.py`
composer, `push_payloads.py`, e-mail template, serializer, frontend `NotificationItem`, and all three
locales). Miss one and it degrades to a silent generic "system notification".

---

## Stage 0 — DRAFT is silent

**Goal:** no artist-facing notification ever leaves a `DRAFT` project.

**Scope:** a single guard applied to the artist-facing emitters listed above. Put the decision in one
place (a helper in `notifications/`) rather than repeating a status check in ten methods — Stage 1
will replace that helper's body with the queue.

**Traps:**
- Scope the gate to *artist-facing project broadcasts*. Manager-facing signals (attendance, RSVP,
  absence requests) and the manager digest are unrelated and must keep working.
- Suppressing the emitter also suppresses the in-app bell row, because the row is created inside
  `send_notification_task`. That is correct here: in DRAFT nobody should see anything.
- Automated reminders (`reminder_sent_at`, the rehearsal/project reminder sweeps) are not editorial.
  Confirm they cannot fire for a DRAFT project; if they can, gate them too.
- Verify how the frontend actually creates projects (`ProjectNewPage`) — the model default is DRAFT,
  but confirm nothing overrides it, or this stage is a no-op in practice.

**Done when:** creating a project, inviting people, adding rehearsals and casting produces zero
outbound notifications, and a test asserts it.

## Stage 0b — one save, one write

**Goal:** saving divisi stops being N HTTP requests.

**Scope:** a bulk casting endpoint that accepts the whole board state and reconciles it server-side;
`useMicroCasting` calls it once. Independent of the queue and worth doing anyway (it also fixes the
partial-failure hole where deletes succeed and creates fail).

**Done when:** one Save = one request = at most one notification per affected artist.

## Stage 1 — the announcement queue

**Goal:** a durable, server-side, per-project queue of pending announcements.

**Scope:** a new model in `notifications/` holding one row per pending change: project FK,
notification type, level, the metadata JSON exactly as the services build it today, a nullable
recipient (null = broadcast to the cast), a collapse key, who queued it, when. Plus an
`AnnouncementQueue` service with `enqueue` / `pending_for` / `publish` / `discard`.

The emitter seam from Stage 0 now routes into the queue instead of dispatching.

**Collapsing** happens at read/publish time, keyed on something like `rehearsal:{id}:date_time`:
keep the earliest `old` and the latest `new`, then **drop rows where `old == new` after collapse**.
That is what makes the typo-and-fix case disappear entirely rather than shipping as noise.

(The alternative — snapshotting the last-published state and diffing at publish — is semantically
cleaner but needs a snapshot serializer for project + rehearsals + castings kept permanently in
sync. Collapse-by-key was chosen for the effort/benefit ratio. If you find collapse getting hairy,
this is the fork to reconsider.)

**Traps:**
- Resolve broadcast recipients at **publish** time, not enqueue time — someone who confirmed in the
  meantime should be included. Personal rows carry their own recipient.
- Cancellation (project or rehearsal) does not queue. It dispatches immediately and should **flush
  the pending queue for that project**, since it supersedes everything in it.
- Decide what happens to the queue if the project moves back to DRAFT. Simplest coherent answer:
  publication is one-way; DRAFT is unreachable once left, except via CANCELLED.

**Done when:** edits on an ACTIVE project change the database and leave a pending row, and nothing
goes out until something calls `publish`.

## Stage 2 — publication of the project

**Goal:** `DRAFT → ACTIVE` sends every invited artist one complete invitation.

**Scope:** a publish action on the project (its own endpoint, not a bare status PATCH — it has
side effects and needs a preview). It fans `PROJECT_INVITATION` out to everyone with a participation
regardless of status, enriched with the full picture: date, venue, call time, dress code, the
schedule, the programme, their voice line if cast.

Assess whether `ProjectInvitationMetadata` can carry that richer payload or whether the invitation
composer needs extending. Adding fields to the DTO without labelling them in `message_content.py`
leaks raw values into the change list — check that behaviour before extending.

**Traps:**
- `confirmed_only=False` (see verified facts) or this ships to nobody.
- The existing invitation modal is the in-app surface. Confirm it still behaves when a dozen
  invitations arrive at once and when the welcome overlay is also pending.
- Decide who may publish: managers only, or the assigned conductor too. `Project.conductor` is an
  `Artist` FK and is not the same thing as manager rights.

**Done when:** publishing a fully-built draft delivers one invitation per person on every channel
they have enabled, and the modal shows it.

## Stage 3 — the composite briefing

**Goal:** publishing the queue produces **one** message per recipient, not N replayed ones.

**Scope:** a new notification type (working name `PROJECT_BRIEFING`) whose metadata is sectioned —
schedule, casting, details — plus an optional free-text note from the conductor. Each recipient's
briefing is assembled from the shared sections and their own personal rows, personal first.

Remember the ~8-layer checklist. This is the stage that most easily half-ships.

**Also here:** the e-mail currently attaches one `.ics` per rehearsal. A briefing announcing five
rehearsals should attach **one multi-event `.ics`**. Small change, large difference in daily use.

**Traps:**
- "Removed from the cast" must not be a bullet inside "what's new in Requiem". It is a personal
  message and should stay its own notification.
- Someone added to an already-published project is not receiving a *briefing* — for them the whole
  project is news. Recommended: they get a full invitation at the next publish. Revisit if that
  feels wrong in use.

**Done when:** a queue containing 5 schedule changes and 12 casting changes publishes as 12
messages, each personalised.

## Stage 4 — the conductor's surface

**Goal:** the conductor can see, edit and publish the queue without being nagged.

**Scope:**
- A quiet count pill in the project hub header (the queue is project-scoped, so it belongs in
  `ProjectHubLayout`, visible across all tabs — not per-tab).
- A review sheet: changes grouped by section, **each row individually excludable**, a note field, the
  recipient count, and a per-recipient preview. One confirm button.
- The assertive prompt fires on **leaving the project with a non-empty queue** — publish / later /
  discard. Not on entering an edit.
- An "unannounced" badge on the project card in the dashboard list.

Reuse `EditorActionBar`, `ConfirmModal`, `BottomSheet` and the existing dirty-state plumbing that
`MicroCastingTab` already uses; this is not a new interaction language.

**Done when:** the conductor can publish, or deliberately not publish, without guessing what will
be sent.

## Stage 5 — safety net

**Goal:** the queue cannot become the place where news quietly dies.

This is the risk the whole feature introduces: batching converts "too much noise" into "possibly no
signal", and a choir that *believes* it knows the schedule is worse off than a spammed one.

**Scope:** a Celery beat sweep that nudges the project owner when a queue has been sitting unpublished
for ~24h, and a check that the unannounced badge is visible from the dashboard without opening the
project.

---

## Open decisions

Not decided; decide them when the stage arrives and record the answer here.

1. Invitation *and* publication as one gesture — i.e. is a person ever invited before the project is
   published? Under this plan, no. Confirm that matches how the conductor actually works.
2. Whether a newly added participant on a live project gets a full invitation immediately or at the
   next publish.
3. Whether the conductor (as `Project.conductor`, not as a manager) may publish.
4. Whether unannounced-but-saved changes should be visually marked for artists in the app, or blend
   in silently. Both are defensible.

## Success criteria

- Building a project end to end emits **zero** notifications.
- Publication emits exactly one message per invited artist per enabled channel.
- The 5-rehearsals × 12-singers scenario becomes **12 e-mails and 12 pushes**, not 60 and 120.
- A change made and reverted before publication emits nothing at all.
- Cancelling a concert still reaches everyone immediately.
