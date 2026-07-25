# Plan: project publication + announcement queue

Status: **ALL STAGES SHIPPED** (0, 0b, 0c, 1, 2, 3, 4, 5, 6) · audited 2026-07-25 · Written
2026-07-24 · **The feature is complete.** Nothing goes out unreviewed, corrections cancel out, five
rehearsals reach twelve singers as twelve messages, the conductor can see and edit all of it before
it leaves, a queue nobody publishes says so on a clock, and the chorister is now asked what they want
to hear about rather than which of our event names they recognise.

**Read the two audit sections before changing anything below them.** The first, over stages 0–3,
found four defects — two of which falsified success criteria this file had already ticked — and one
policy question the fold had quietly answered on the reader's behalf. The second, over stages 5 and
6, found six smaller ones, all fixed, and ends with the one structural change left deliberately
unscheduled. Claims elsewhere in this document that either audit corrected are marked where they
stand; the audits themselves are the record.

**Stage 2 was taken before Stage 1, deliberately.** Stage 0b left the tree with no path from DRAFT to
ACTIVE (see the deploy blocker it recorded), so a queue would have had nothing to attach to: every
new project was a draft that could never be published. Publication was the blocker and is now done.
Stage 0c followed for the same reason in miniature: the queue would have had to collapse ~60 rows per
divisi save that the write path should never have produced.

This is a **staged plan, not a line-exact spec**. Each stage below states the goal, the scope, what
"done" looks like, and the traps found while surveying the tree. It deliberately stops short of
prescribing implementation — read the code, disagree where the code tells you something different,
and update this file when you do.

Stages were executed in separate sessions. Stage 0 and 0b stand alone and were worth shipping even if
the rest had never happened. Stages 5 and 6 were independent of each other: 5 finished the mechanism,
6 fixed what the reader is asked.

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

**Artist-facing emitters, all in `backend/roster/services.py`.** The route column is what Stage 1
settled; every one of them still builds the same Pydantic metadata DTO → `model_dump(mode="json")`
and hands it to `notifications/announcements.py`, which decides between the three.

| Site | Type | Level | Route |
|---|---|---|---|
| `ProjectManagementService.update_project` | `PROJECT_UPDATED` | WARNING / URGENT | **queued** |
| same method, cancellation branch | `PROJECT_CANCELLED` | URGENT | immediate + flushes the queue |
| `delete_participation` | `PROJECT_UPDATED` event=`removed` | WARNING | **queued** (never folded) + drops their rows |
| invitation on participation create | `PROJECT_INVITATION` | INFO | immediate (it *is* the announcement) |
| `RehearsalOperationsService.schedule_rehearsal` | `REHEARSAL_SCHEDULED` | INFO | **queued** |
| `update_rehearsal` | `REHEARSAL_UPDATED` | WARNING / URGENT | **queued** |
| `delete_rehearsal` | `REHEARSAL_CANCELLED` | URGENT | immediate + flushes that rehearsal |
| `CastingAndCrewService.assign_piece_casting` | `PIECE_CASTING_ASSIGNED` | INFO | **queued** |
| `update_piece_casting` | `PIECE_CASTING_UPDATED` | INFO | **queued** |
| `delete_piece_casting` | `PIECE_CASTING_UPDATED` event=`removed` | WARNING | **queued** |
| `save_piece_board` (Stage 0c) | all three of the above, at most one per singer | as above | **queued** |

Both reminder sweeps in `roster/tasks.py` call the dispatch tasks directly and stay that way: a
reminder is triggered by the clock, not by an edit, so there is no editorial decision to hold it for.

**Default channels** — `backend/notifications/delivery.py`. ~~Tiers~~ **preference groups** since
Stage 6, and the per-type contract is *derived* from them rather than written beside them. Everything
in `commitments` (invitation, project and rehearsal scheduled/moved/cancelled, **casting**, absence
decisions) and `messages` defaults e-mail **ON**; `materials` (scores, recordings, both reminders)
defaults e-mail **OFF**, push only. Casting moved groups in Stage 6 — see there for why, and for the
data migration that move needed.

Those defaults are per *event type*, which is why `PROJECT_BRIEFING` cannot have one of its own: it
carries several types at once, and which ones is an accident of how many things changed that week.
`NotificationRouter._route_briefing` answers each item by its own type instead — see the audit.

**Do not touch `notifications/message_content.py`** — it is the SSOT composing copy for push, e-mail
and the in-app bell in three languages. New work adds a composer there; it does not restructure it.

**`NotificationRecipientPolicy`** (`notifications/services.py`) offers two audiences and the
difference matters. `from_participations` narrows to `status='CON'` — a report about people who
committed. **`in_conversation` is the one for anything the cast is *told* about a live project**:
confirmed *and* still deciding, never declined. The queue and both bypassing alarms resolve through
it. Publication sidesteps both (it queries `INVITED` directly). See Stage 1's decision 3 and the
audit, which is where the second method came from — the two paths had drifted apart.

**The invitation modal already exists** — `frontend/src/features/notifications/components/ProjectInvitationToasts.tsx`,
mounted once in `DashboardLayout`, driven by pending `INVITED` participations, and already
coordinated with the chorister welcome overlay (see `welcome-invitation-and-email-gating-spec.md`).
Publication should feed it, not replace it.

~~**Divisi saves N requests**~~ — **fixed in Stage 0c.** One Save is now one `PUT
/api/piece-castings/board/`, reconciled server-side in one transaction. The per-casting emitters in
the table above still exist and still fire; they simply have no client left.

**A new `NotificationType` touches ~9 layers** (model choice, `delivery.py` **group**,
`message_content.py` composer, `push_payloads.py`, e-mail template, serializer, frontend
`NotificationItem`, the settings ledger, and all three locales). Miss one and it degrades to a silent
generic "system notification" — except the `delivery.py` one, which Stage 6 made impossible to miss:
`assert_preference_policy_is_coherent()` runs in the app's `ready()` and refuses to boot with a type
that belongs to no group.

The `NotificationItem` layer is really two, and Stage 5 found the second the hard way: `describe()`
gives the row its copy, but `navigateToContext` decides where a click *goes* — and it routes by
substring (`type.includes("PROJECT")`, `"REHEARSAL"`, `"CASTING"`, `"ABSENCE"`). A type named
outside that vocabulary type-checks, renders correctly and silently dead-ends at `/panel`.

The locale layer is **two** namespaces, and Stage 3 shipped only one of them:
`notifications.types.*` names the bell row, `settings.notifications.types.*` + `.type_desc.*` name
the ledger row. A type present in the first and absent from the second looks done and renders the raw
English Django label. ~~plus an entry in `NOTIFICATION_TYPE_META` deciding which group it files
under~~ — **Stage 6 moved grouping to the server**; the client half is now
`NOTIFICATION_TYPE_ICON`, which is decorative only and degrades to a bell. A type that has no
preference to express belongs in `UNGROUPED_DEFAULTS` (which *is* `HIDDEN_FROM_PREFS`), which is
where `PROJECT_BRIEFING` ended up.

---

## Stage 0 — DRAFT is silent · SHIPPED

**Goal:** no artist-facing notification ever leaves a `DRAFT` project.

**What landed:** `notifications/announcements.py` — `announce()` / `announce_bulk()` wrap the
`transaction.on_commit` dispatch and drop it while the project is a draft. All ten artist-facing
emitters in `roster/services.py` now route through it. Both reminder sweeps in `roster/tasks.py`
exclude drafts **in the `due` queryset**, before the atomic `reminder_sent_at` claim, so publishing
later leaves the one-shot reminder still available.

**Deviation from the original plan, deliberate:** the plan had invitations going silent in DRAFT
with no replacement until Stage 2, which would have left invitations unreachable — the emitter only
fires on participation create, so flipping to ACTIVE invited nobody. Stage 0 therefore also carries
a minimal publication act: `_invite_on_publication` fanned `PROJECT_INVITATION` out to every
`INVITED` participation when a project left DRAFT for ACTIVE. **Stage 2 has since replaced it** with
`ProjectPublicationService.send_invitations` — same recipients, full payload, its own endpoint. The
DRAFT→ACTIVE branch in `update_project` remains as the backstop for a bare status PATCH.

Two related behaviours also settled here:
- Publication **supersedes the field diff** of the same save — otherwise the cast's first ever
  message would have been `PROJECT_UPDATED` "Status: Szkic → Aktywny" (`status` is in
  `_PROJECT_CHANGE_KEYS`). Same shape as the existing cancellation branch.
- A draft **cancelled before publication is silent**: nobody was told the concert existed.

**Left as-is on purpose:** `ManagerNotificationHelper.notify_managers` and the absence
approval/rejection dispatch still call the tasks directly. Both are a different axis — manager
fan-out and the outcome of the artist's own request — and neither belongs behind this gate.

**Note for later stages:** tests patch `notifications.announcements.send_bulk_notifications_task.delay`
now, not the `roster.services` path. Anything routed through the gate must be patched at the gate.

**Verified:** 351 roster + notifications tests pass; ruff and mypy clean; frontend typecheck + build clean.

### Stage 0b — silence in the read models, and casting before consent

Added after the first pass, because Stage 0 as written only silenced *notifications* while the
project stayed fully visible in the artist's app. Two defects fixed:

**The draft leaked through every artist read model.** `get_artist_schedule` excluded only CANCELLED,
`get_artist_materials_queryset` filtered on nothing but `is_deleted`, and
`DocumentsService._OPEN_PROJECT_STATUSES` listed `DRAFT`. A singer added to a draft saw the concert
in their schedule, its scores in materials, and the rest of the cast in "Moja Karta" — while the
conductor believed they were planning privately. All three now exclude drafts, filtered at the
*participation* level so the cast's rehearsals and participation map drop in the same stroke. The
conductor's own slices (`conducted_project_ids`, `get_conductor_materials_projects`) keep drafts.

**Divisi could not be built on a draft at all.** `assign_piece_casting` required
`Participation.Status.CONFIRMED`, and on a draft nobody has been asked, let alone confirmed.

The gate was on the wrong axis, not merely too strict for drafts. **Casting states an intention
("you sing B2"), not a fact about consent.** It is now refused only for `DECLINED` — a seat known to
be empty. This holds uniformly in DRAFT and ACTIVE, which matters: the days right after publication
are exactly when most of the cast has not answered yet and the conductor most wants to sketch
divisi. A draft-only exception would have locked the board precisely then.

Frontend follows the same rule: the drag guard in `useMicroCasting` and `isBlocked` in
`DraggableArtist` now key on `DEC`. The answer state travels with the singer as a chip on the card
(`Czeka` / `Odmowa`; confirmed carries none — the calm state is the absence of a chip), so it shows
in the pool and inside every voice line without a second component. Declined singers left on a line
**keep counting towards the piece deficit** — the hole must stay visible rather than silently read
as filled.

~~**Open consequence, still not handled after Stage 1:**~~ **closed in Stage 4.** When a singer
declines after being cast, their castings survive as a visible gap — intended, but nothing *told* the
conductor it had happened (the decline reaches managers through the digest, and the hole is only
visible to someone who opens the divisi tab). `useDeclinedWithSeats` now derives it in the hub header
from the two lists that shell already prefetches, naming whoever declined while still holding a seat.

**⚠ BLOCKS DEPLOY — resolved by Stage 2.** `ProjectCreateDTO.status` defaults to `DRAFT` and
`DetailsTab` never sends a status, so every project created through the app is a draft. The only
status control was the DONE ↔ ACTIVE toggle in `ProjectRow`, which on a draft resolved to DONE —
there was **no path from DRAFT to ACTIVE**, and worse, the frontend had no notion of `DRAFT` at all:
a draft rendered with the same gold "W przygotowaniu" badge as a live project, so the conductor had
no way to tell a silent project from a speaking one. Stage 2 fixes both.

## Stage 0c — one save, one write · SHIPPED

**Goal:** saving divisi stops being N HTTP requests.

**What landed, backend:**
- `PUT /api/piece-castings/board/`, manager-only. The payload is the board for one `(project, piece)`,
  not a list of edits: rows the payload omits are deleted, new rows are created, differing rows are
  updated. `CastingAndCrewService.save_piece_board` computes the whole plan **before** touching
  anything, then applies it in one `transaction.atomic()` — which also closes the partial-failure
  hole where the deletes committed and the creates 400'd.
- **Declarative was the right shape** for the notification problem, not just for the request count.
  Because a singer holds at most one seat per piece, reconciling by participation means each affected
  artist can only be created, updated *or* removed in a given save — so "one save, one message per
  singer" falls out of the model instead of needing a de-duplication pass.
- The metadata construction the ten emitters share was extracted into `_casting_metadata` /
  `_casting_removed_metadata`, so the per-casting endpoints and the board produce byte-identical
  payloads. Stage 1 has one composer to route, not two.
- Refusals are up-front and total: a declined singer cannot be *placed or moved* (an untouched row
  for someone who declined after being cast survives — that hole has to stay visible), a
  participation from another project is rejected, and one singer twice on one piece is rejected by
  the DTO. None of them half-write the board.
- Pre-existing duplicate rows for one singer on one piece collapse to one on the next save, silently:
  the singer keeps their seat, so nothing about it is news to them.

**What landed, frontend:**
- `useMicroCasting.saveChanges` builds the board from `localCastings` and awaits one
  `useSavePieceCastingBoard` call; the response *is* the new baseline (real ids in place of the
  draft's temporary ones). The three per-casting mutation hooks, their service methods and
  `buildOptimisticPieceCasting` are gone — nothing optimistic is left to do when the editor already
  holds the draft.
- `useCastTab` re-added a previously declined artist as `CON`. That answered for them *and* — since
  Stage 2 — would have skipped them at publication, leaving someone in the cast who was never
  invited. It now re-invites (`INV`). **Half-fixed, completed in the audit:** the client stopped
  answering for them, but that path is a PATCH on the participation and went through DRF's default
  `perform_update`, so nothing ever *asked* them either. `ParticipationService.update_by_manager` now
  owns the transition.

**Also fixed here, same emitter:** a casting diff on `gives_pitch` / `notes` rendered as untranslated
`Gives pitch: False → True`. Both now have labels in `message_content._change_field_label`, booleans
localize through `_boolean_label`, and the in-app chip does the same via
`notifications.changes.boolean.*`. Verified end to end in pl/en/fr.

**Left standing on purpose:** the per-casting `POST/PATCH/DELETE /api/piece-castings/` endpoints. No
client calls them any more, but they are a legitimate REST surface. ~~Stage 1 must route both paths
into the queue, or retire them then~~ — **routed in Stage 1**: both the per-casting endpoints and the
board queue through the same seam, with the piece as the subject and the singer as the recipient.

**Verified:** 372 roster + notifications tests pass (12 new in `PieceCastingBoardTests`); ruff and
mypy clean; frontend typecheck, lint and build clean.

## Stage 1 — the announcement queue · SHIPPED

**Goal:** a durable, server-side, per-project queue of pending announcements.

**What landed, backend:**
- `notifications.PendingAnnouncement` (migration `0011`) — project FK, nullable recipient (null =
  broadcast), `subject_type` / `subject_id`, `kind`, notification type, level, the metadata JSON as
  the services build it, the field diff in its own three columns, `published_at`. A row is consumed
  exactly once: stamped when a publication takes it, soft-deleted when the conductor discards it.
- `notifications/announcement_queue.py` — `AnnouncementQueue` with `enqueue` / `pending_for` /
  `collapse` / `preview` / `publish` / `discard` (+ `discard_subject`, `discard_recipient`,
  `has_unannounced_creation` for the supersession rules below).
- `notifications/announcements.py` stays the seam and is now explicitly a three-way choice —
  **silent** (DRAFT), **queued** (`queue_announcement` / `queue_broadcast`), **immediate**
  (`announce` / `announce_bulk`). Which one an event takes is visible at its call site in
  `roster/services.py`, which is the point: the module docstring states the rule, the emitter shows
  the decision.
- `GET/POST/DELETE /api/projects/{id}/announcements/`, manager-only. GET is the collapsed preview
  with resolved recipient counts, POST publishes, DELETE abandons.
- The DRAFT one-way rule is now enforced, not assumed: `update_project` refuses a live project
  returning to DRAFT (`ProjectUnpublishException`, `project_cannot_unpublish`, HTTP 400, translated
  pl/fr). The frontend never sends it — this closes the API surface, not a UI path.

**Scope taken beyond the letter of the stage, deliberately:** the endpoint. Stage 1 as written is a
service with no door, which would have repeated Stage 0b's blocker in reverse — every edit on a live
project silently held back, with `publish` reachable only from a Django shell until Stage 4 ships a
surface. Sixty lines of view were cheaper than a documented deploy hole. The conductor-facing UI is
still Stage 4.

**Decisions taken:**
1. **One row per field, not per save.** Collapsing has to work at field granularity for the
   typo-and-fix case to disappear at all, and Stage 4 wants to exclude one line without dropping the
   rest. Splitting at enqueue rather than at publish makes each row independently meaningful.
2. **Urgency became one rule, applied per row.** The two emitters each carried their own
   "which fields are urgent" set; both reduced to *a change to when people have to be somewhere*.
   That now lives in the queue (`_TIME_CRITICAL_FIELDS`) and escalates rows individually, so a
   published announcement's level follows what **survived** collapsing. A reschedule that is reverted
   loses its alarm along with its row — which the per-save level could not have expressed.
3. **A queued broadcast reaches CON *and* INV, never DEC.** The plan flagged the `confirmed_only`
   default as a trap; the answer is that someone still deciding is exactly who needs to know the
   schedule moved, since the invitation they are weighing is now out of date. A decline ends the
   conversation. **Extended by the audit into one shared rule** (`in_conversation`): this decision
   changed the queue but left the two alarms that bypass it on the CON-only default, and a personal
   queued row ignored the decline entirely. Both are fixed; the rule now has one implementation.
4. ~~**Removal from the cast is never queued.**~~ — **reversed in Stage 3, and it was the wrong
   call.** The reasoning was sound as far as it went: every other change is safe to hold because the
   artist opening the app sees the truth anyway, and Stage 0b filters read models at the
   *participation* level, so a removed singer has nothing left to open. What it missed is that this
   is the one announcement that **cannot be taken back** — a conductor who mis-clicks Remove and
   re-adds the singer a minute later has already sent "you're no longer on this roster", and no
   amount of undo unsays it. Weighed against a silent gap of a few hours in someone's schedule, the
   irreversible message is the worse failure. It is now queued like everything else; see Stage 3.
   The one part of the decision that survives intact is dropping that person's pending personal
   rows, which would otherwise arrive as news about a project they can no longer see.
5. **Publication is one-way** (open decision #5), now enforced rather than assumed.

**Deviations from the plan as written — read these before changing the collapse:**
- **Rehearsal cancellation flushes that rehearsal, not the whole project queue.** The plan said
  cancellation "supersedes everything in it"; that is true of a *project* cancellation and false of a
  rehearsal one — cancelling one rehearsal out of five says nothing about a programme change.
- **A rehearsal created and cancelled before publication is silent**, both ways: no cancellation
  goes out and its queued creation is dropped. Same reasoning as Stage 0's draft-cancelled-in-silence
  — nobody was told it existed. The same fold silences a divisi seat given and taken back.
- **A collapsed creation is brought up to date from the newest row.** The plan's collapse rule alone
  would have published "new rehearsal, 19:00" *and* a correction to 19:30, because the creation row
  froze the old facts. Only keys the creation already carries are overwritten, so a later payload can
  never introduce a field the creation's composer does not expect, and the diff is excluded outright.
  This matters most for the `.ics`: a stale attachment puts the wrong hour in people's calendars, and
  no later correction reliably undoes that.
- **Label-only changes must not be collapsed away.** `run_sheet`, `conductor` and the mandatory/
  optional flip carry `old == new == None` *by construction* (Stage 0's `_change` renders them as
  self-describing labels), so the plain `old == new` drop rule would have silenced them entirely.
  They are recognised by both sides being absent on every row for that field.
- **The collapse key is derived, not stored.** Its parts are already columns; a denormalized copy
  would be one more thing to keep true. `PendingAnnouncement.collapse_key` composes it on read.
- **`queued_by` was not implemented.** No emitter has the acting user in scope, and threading a
  request user through eight service signatures for a column nothing reads yet is speculative.
  `created_at` answers "when". Add it with Stage 4 if the review sheet actually shows an author.

**Note for later stages:** tests may patch either `notifications.announcements.send_*_task.delay` or
`notifications.announcement_queue.send_*_task.delay` — both resolve `.delay` on the same shared task
object, so either target catches both routes. What changed is *when* the call happens: an emitter
test on a live project must now publish the queue before asserting anything went out.

**Verified:** 394 roster + notifications tests pass (22 new in `AnnouncementQueueTests`, covering
hold-and-release, revert-cancels-out, urgency following the surviving rows, label-only survival,
create-then-move, create-then-cancel silence, both flush rules, cast removal, audience resolved at
publish including sectionals, the three endpoint verbs, permissions and the one-way rule); ruff and
mypy clean. One pre-existing failure in `documents.DocumentCategoryTests` is a SQLite
`JSONField __contains` limitation, unrelated and identical on a clean tree. No frontend change: the
endpoint is additive and nothing in the client ever PATCHed a status back to DRAFT.

**What Stage 1 did *not* yet fix — now fixed.** Stage 1 bought the *editorial* half of the problem
(nothing goes out unreviewed, corrections cancel out, alarms stay meaningful) and left the volume
half untouched: publish replayed the collapsed set, so five scheduled rehearsals were still five
broadcasts. **Stage 3 bought the volume half** by folding a second time, per recipient.

## Stage 2 — publication of the project · SHIPPED

**Goal:** `DRAFT → ACTIVE` sends every invited artist one complete invitation.

**What landed, backend:**
- `GET/POST /api/projects/{id}/publish/`, manager-only. GET is the preview; POST flips the status
  and fans the invitations out inside one transaction. `ProjectPublicationService` in
  `roster/services.py` owns both, so the preview the conductor sees and the fan-out that follows are
  computed by the same code.
- `roster/invitations.py` — the invitation payload. The cast-wide half (schedule, programme) is
  resolved **once per publication** into a `ProjectInvitationContext`; only voice lines and
  sectional-restricted rehearsals are per participation. Composing it per artist would have issued a
  fresh set of queries for every member of the choir.
- `ProjectInvitationMetadata` gained `call_time_at/display`, `dress_code`, `rehearsals`, `program`,
  `voice_lines`, plus a new `InvitationRehearsalMetadata`. All optional — legacy rows and
  live-project invitations without a schedule render fine (verified).
- `_compose_project_invitation` extended with rows for call time, part, rehearsals, programme and
  dress code; the push body now carries the **rehearsal count** (`ngettext`, so Polish gets
  "2 próby" / "5 prób"). Multi-value rows are newline-joined and `transactional.html` renders them
  with `linebreaksbr` (escapes first — verified against an injected `<script>`).
- Translations: gettext binaries are absent on this machine, so `makemessages`/`compilemessages`
  cannot run. `polib` does both jobs from Python — see the scratchpad script pattern; the pl/fr/en
  `.po` **and** `.mo` are committed together.

**What landed, frontend:**
- `getProjectStatusPresentation` in `lib/projectPresentation.ts` is now the SSOT for how a status
  reads. All four statuses have their own badge; a draft can no longer render as though it were
  live. This also fixed CANCELLED, which had been showing the active badge.
- `PublishProjectModal` — recipient count, the gaps, who is unreachable, one confirm. Mirrors the
  artist-side invitation modal rather than inventing a surface.
- On a draft the hub's DONE toggle is replaced by a primary "Opublikuj projekt"; `ProjectRow` hides
  the toggle entirely (on a draft it resolved to DONE and skipped publication).
- The artist's invitation modal now shows the rehearsals, the programme, the call time and their own
  part — it is where the decision is actually made, so it had to carry the same payload the e-mail
  does. `formatEventMoment` / `voiceLineLabel` moved out of `NotificationItem` into
  `features/notifications/lib/notificationFormat.ts` so both surfaces render a stored row identically.
- A "Szkice" filter on the dashboard. Drafts still appear under "W przygotowaniu" too — a draft
  genuinely is in preparation, so this is a lens, not a separate bucket.

**Decisions taken (they answer three of the open questions):**
1. **Only `INVITED` participations are addressed** — not "everyone regardless of status" as the
   original scope said. A confirmed singer has already accepted (the creator is auto-confirmed on
   their own project) and a declined one has answered; both would read a fresh invitation as a bug.
   The preview reports them as `skipped_count` so a smaller recipient list never looks like a fault.
   This makes `confirmed_only` moot — the query never goes through `NotificationRecipientPolicy`.
2. **Someone added to an already-live project gets the full invitation immediately** (open decision
   #2). For them the whole project is news; sending the bare concert date while the rest of the cast
   read the full picture would be the wrong asymmetry. Same code path, one participation.
3. **Managers only may publish** (open decision #3). Publishing speaks to the whole ensemble;
   `Project.conductor` is an `Artist` link, not a permission. Revisit if conductors turn out not to
   be managers in practice.
4. **Publication happens once.** A second POST raises `ProjectAlreadyPublishedException`
   (`project_already_published`, HTTP 400). The DRAFT→ACTIVE branch in `update_project` survives as
   the backstop for a bare status PATCH, calling the same `send_invitations`, so no path can take a
   project live and leave its cast uninvited.

**Verified:** 360 roster + notifications tests pass (9 new in `ProjectPublicationTests`, covering
preview, gaps, unreachable artists, sectional scoping, double-publish, permissions, and the
latecomer); ruff and mypy clean; frontend typecheck, lint and build clean; invitation copy rendered
end to end in pl/en/fr including a legacy metadata row.

**Not done here:** the modal's behaviour when a dozen invitations arrive at once, and its
interaction with the welcome overlay, was left as the existing queue already handles it — but it has
not been re-tested under the new, taller invitation body.

## Stage 3 — the composite briefing · SHIPPED

**Goal:** publishing the queue produces **one** message per recipient, not N replayed ones.

**What landed, backend:**
- `NotificationType.PROJECT_BRIEFING` (migration `0012`, which also carries the new
  `AnnouncementSubject.PARTICIPATION`). Model choice, e-mail tier, composer, push (free — it projects
  the composer), a dedicated e-mail template, the frontend row, and the bell's locale keys.
  ~~All eight layers done~~ — **two were missed, both fixed in the audit:** the settings matrix had
  no label or description in any locale (so it rendered the raw English Django label), and the type
  should never have been offered there at all. A briefing has no preference of its own to express.
- **Publication now folds twice.** `AnnouncementQueue.collapse` still answers *what changed*;
  the new `AnnouncementQueue.plan` answers *how many envelopes leave*, which is a different question
  and the one the headline number is about. `PublicationPlan` assigns every announcement to one of
  three fates and every recipient to exactly one — **standalone**, **solo**, **briefing** (see the
  next decision). `preview` and `publish` are built from the same plan, so the count the conductor is
  shown and the fan-out that follows cannot disagree.
- `ProjectBriefingMetadata` / `BriefingItemMetadata`. **Each item carries the payload its own emitter
  built, untouched** — that is the load-bearing choice of the stage. A briefing line renders from
  exactly the same facts as the standalone message it would otherwise have been, so neither the
  composer nor `NotificationItem` needs a second vocabulary for a rehearsal or a part, and a future
  emitter gets a briefing rendering for free.
- `_compose_project_briefing` groups items into ordered sections (**your part → rehearsals → the
  concert**) and owns that order outright; the queue does not sort, it only hands over the list.
  `MessageContent` gained `sections`, which every other type leaves empty.
- `templates/emails/briefing.html` / `.txt`, routed through `_EMAIL_TEMPLATE_MAP`. It is **not** a
  bespoke template — it reads the same composed, localized context as `transactional` and only lays
  out the grouped sections. The conductor's note renders as a set-apart quote, escaped
  (verified against an injected `<script>`).
- **One multi-event `.ics`.** `ICalGeneratorService.build_events` is the new primitive;
  `build_single_event` delegates to it, and `_build_ics_attachment` accepts either a dict (unchanged)
  or the briefing's list. The queue lifts each rehearsal's `ics` out of the item payloads into the
  briefing's own, because attachments are per *message*: three invites would read as three pieces of
  news, which is exactly what the fold exists to prevent.
- `POST /api/projects/{id}/announcements/` takes an optional `note` (≤2000 chars,
  `AnnouncementPublishSerializer`).

**Decisions taken:**
1. **A recipient with one piece of news does not get a briefing.** "Rehearsal moved — Friday at
   19:00" names what happened far better than a briefing wrapping a single line, and it keeps the
   type-specific deep-link, tag and `.ics`. Only someone with *several* is folded. This is why the
   whole Stage 1 test suite survived the change untouched — and it means the fold costs nothing on
   the common single-edit day.
2. **A note always folds**, even a single change. A note is addressed to the reader rather than
   describing a field, so it needs the surface a briefing gives it.
3. **The briefing takes the loudest item's level.** A briefing containing a reschedule is an alarm,
   however calm the rest of it reads — otherwise batching would become a way of muting one.
4. **Removal from the cast is queued but never folded** (reversing Stage 1's decision 4 — see there
   for why). It is a message about *leaving*; a bullet under "what's new in Requiem" would file it
   under a project the reader can no longer open. `_STANDALONE_SUBJECTS` is the seam.
5. **A removal undone before publication is silent.** `create_or_restore_participation` discards the
   pending `PARTICIPATION` row, so a mis-click put back a minute later leaves no trace. The subject
   is the **artist**, not the participation row, because a re-add may mint a fresh row and the two
   must still cancel. They are re-invited but never told they had left. *Precision from the audit:*
   the re-invitation is honest because **the client sends `status: "INV"`**, not because the restore
   resets anything — `restore()` touches only `is_deleted`, and the service applies whatever
   `validated_data` carries. It is a client contract; treat it as one.
6. **`message_count` is the number worth showing.** `announcement_count` is how many things changed;
   `message_count` is how many messages leave. Stage 4's confirm button wants the second.
   **Corrected in Stage 4:** it was counting *dispatch operations*, so a broadcast to twelve singers
   scored 1 — one `send_bulk` call. That would have put "Send (1)" on the button while twelve people
   were written to, which is the very number this feature exists to make honest. It now counts
   **envelopes**: an unfolded broadcast is one per person in its audience, a briefing is one. A
   consequence worth knowing: a note no longer changes `message_count` at all — folding never adds or
   removes envelopes — it changes `briefing_count`, i.e. what arrives rather than how much.

**Trap that turned out not to be one:** the plan worried the queue might also enqueue a briefing row
for someone added to an already-live project. It cannot — Stage 2 sends them a full invitation on the
participation-create path, which never touches the queue.

**Verified:** 412 roster + notifications tests pass (18 new: `ProjectBriefingTests` covering the
5-rehearsals arithmetic, the lone-change exemption, per-recipient personal content, level
escalation, the single calendar, the note both in-service and through the endpoint, and
`message_count`; `BriefingCompositionTests` + `BriefingEmailTests` covering section order, the
moment-after-a-dash rule, Polish plurals, an unknown subject being dropped rather than guessed at,
and note escaping). ruff and mypy clean; frontend typecheck, lint and build clean.

**Left for Stage 4 — a real constraint, not a nicety:** `DELETE /announcements/` now drops the
queue *including a pending cast removal*, which would leave that person removed and never told. The
review sheet must not offer a bare "discard everything" without saying so.

## Stage 4 — the conductor's surface · SHIPPED

**Goal:** the conductor can see, edit and publish the queue without being nagged.

**What landed, backend.** Stage 1 shipped a queue whose smallest addressable unit was a *message*.
A review sheet needs a smaller one — a **line** — and that is what this stage added:

- `QueuedChange` + `AnnouncementQueue.describe()` — every pending change as the line the sheet
  offers, carrying the payload its emitter built, the level, the audience size, the name of whoever
  it is personal to, and whether it is currently held. `describe` reports the **whole** queue
  including held lines: the conductor has to see what they are holding back, not only what is going
  out.
- `preview()` now answers for a **selection**: `?exclude=<row id>,…&with_note=1`. The lines describe
  everything pending; every count describes what that selection would actually send. Both come from
  the same `_partition` + `plan` the publication runs, so the number on the confirm button cannot
  promise something else. It also reports `has_cast_removal` and, per recipient, which lines reach
  them and whether they arrive folded.
- `publish(exclude=…)` **holds** the named rows instead of dropping them, stamps only the rows it
  sent, and returns `held`. `AnnouncementPublishSerializer` takes the id list.
- `plan(has_note=…)` replaced `plan(note=…)`: only the note's *presence* changes the plan, so the flag
  travels without the text and the sheet can recount as soon as the conductor starts typing rather
  than refetching per keystroke.
- `message_count` now counts envelopes rather than dispatch calls — see the correction recorded under
  Stage 3's decision 6, which is what the confirm button depends on being true.
- Urgency is resolved **per line**, from the rows behind that field, not from the announcement's
  loudest row — otherwise every line of a diff containing a reschedule would wear the alarm and
  holding the reschedule could not visibly calm the rest.
- `_recipient_names` resolves through `Artist.all_objects` on purpose: the person a personal line is
  most often about is someone just taken off the cast, and their name is exactly what the sheet must
  show.
- The dashboard badge is an `Exists` annotation, manager-gated in the serializer.

**Renamed, and it is a breaking change to a Stage 1 response:** `announcement_count` → `change_count`,
`announcements` → `changes`. Nothing but the tests consumed the old shape (Stage 1's endpoint had no
client), and the new names say which of the three numbers a reader is looking at.

**What landed, frontend:**
- A quiet count pill in `ProjectHubLayout`, visible across every tab. It states a number and waits:
  an edit the cast has not been told about is a pending decision, not a fault.
- `AnnouncementReviewSheet` — lines grouped concert → rehearsals → parts, with cast removals set
  apart last. One checkbox per line, a note field, the fold shown from the readers' side, one confirm
  button carrying the message count. Built on `BottomSheet` + `ConfirmModal`, not a new interaction
  language.
- The prompt on **leaving the project** with a non-empty queue, asked once per visit.
- An "unannounced" badge on `ProjectRow`, so a waiting queue is visible without opening the project.
- `briefingItemSummary` / `renderChanges` / `changeLabel` moved out of `NotificationItem` into
  `features/notifications/lib/notificationFormat.ts`. The sheet renders a line from the same code the
  bell renders the delivered message with, so the conductor cannot be shown one description and the
  singer sent another.
- **Also fixed here (Stage 0b's open consequence):** a singer who declines *after* being cast leaves
  their seats standing as a deliberate hole, and nothing told the conductor. `useDeclinedWithSeats`
  derives it from the two lists the hub already prefetches and the hub header names them. Gold, not
  crimson — a gap to fill is not an alarm.

**Decisions taken:**
1. **Excluding a line holds it; it does not discard it** — the question Stage 1 left to this surface.
   A held row stays pending and turns up in the next review, collapsed against anything that happened
   to it meanwhile. This is what makes *one* per-line control enough: publishing the rest leaves
   exactly the rows the conductor never wanted to send, which one explicit discard then drops. The
   irreversible reading would have needed a second verb per line and a confirm for each.
2. **A line is one field only for a project diff.** Its fields are heterogeneous and separately
   meaningful — a venue and a dress code have nothing to do with each other. A rehearsal's diff is
   the opposite: "it moved, and the focus moved with it" is one fact about one evening, and the
   composer already renders it as one line on the artist's side. Splitting it would let the conductor
   publish half a fact.
3. **Holding a creation holds everything about that subject.** Otherwise excluding "new rehearsal"
   while keeping the change that followed announces a move to a rehearsal the cast has never heard
   of. The sheet cannot express that selection, but the endpoint takes row ids from a client, so the
   rule lives in `_partition` rather than in the UI. The union of *ticked* and server-`is_held` is
   what the sheet renders, so the cascade is visible rather than silently applied.
4. **Every count is the server's; the client mirrors none of the fold.** The first cut of the sheet
   recomputed the plan in TypeScript to avoid a round-trip per checkbox — which would have quietly
   reintroduced the one thing the whole design forbids, two answers to "how many messages leave".
   The query is keyed by the selection and `keepPreviousData` holds the sheet steady while it
   recounts.
5. **The badge is a flag, not a count** — and this settles open decision 4. An honest count needs
   collapsing; anything cheap enough for a list query can only see rows, and "3" beside a sheet
   listing one is a small lie told on every page load. Artists are shown nothing at all: the database
   is the truth and their app already displays it, so "not official yet" would only teach them to
   distrust what they can plainly see.
6. **The leaving prompt offers Review or Later — not Discard.** A deviation from the stage's letter.
   Discarding without the sheet in front of you is precisely how news dies quietly, and the warning
   that matters needs a name the prompt does not have. "Later" is a real answer: the queue is durable,
   and Stage 5 is what catches a conductor who forgets.
7. **Facts are shared with the artist's message; voice is not.** "You're no longer singing this one"
   is right in a singer's inbox and wrong on the conductor's desk, so a part is described in the third
   person on the sheet while still reading its piece, voice line and diff from the same metadata.

**Traps found, worth keeping:**
- **A disabled query still serves its last data.** The pill's read is gated on the project's flag, so
  after publishing it goes disabled — and would have kept advertising the count it last saw.
  `useSettleQueue` therefore *removes* the previews rather than invalidating them, and the pill is
  gated on the flag as well as the data.
- **A partial hold is expressible over the API but not in the sheet.** Holding one of two rows for the
  same field leaves the other to publish, so the counts are right while the line still describes the
  full-queue collapse. The sheet always holds whole lines, so its display and the plan agree; an API
  client doing otherwise gets correct sends and a stale description.
- **`queued_by` still not implemented.** Stage 1 deferred it to "if the review sheet shows an author".
  It does not: the sheet answers what changed and who will hear it, and on a single-tenant install
  with a handful of managers the author is not the question anyone is asking.
- **The note had a hole, found in the audit: it rides in a briefing and nowhere else.** A cast
  removal never folds (Stage 3's decision 4), so a queue holding *only* removals has no envelope to
  put a note in — and the sheet offered the field anyway, then dropped what was written on send.
  Silently swallowing something the conductor typed is the worst of the available behaviours, so the
  sheet now says so: with the note's presence applied, `briefing_count == 0` is exactly "nobody would
  receive this", and the hint turns into a sentence naming why and pointing at direct messaging. The
  removal's copy is deliberately left alone — "Prosimy o punktualność" under "you're no longer on
  this roster" would be grotesque.

**Verified:** 422 roster + notifications tests pass (11 new in `AnnouncementReviewTests`, covering
per-field project lines, a rehearsal diff staying whole, per-line urgency, a named cast removal, the
fold seen per recipient, the note recount before any text exists, an unticked line left pending, the
preview counting a selection while still listing what is held, the creation cascade refusing to send
an orphan change, publish-then-discard leaving exactly the held rows, and the badge being withheld
from artists); ruff and mypy clean; frontend typecheck, lint and build clean.

**Done:** the conductor can publish, or deliberately not publish, without guessing what will be sent.

## Stage 5 — safety net · SHIPPED

**Goal:** the queue cannot become the place where news quietly dies.

This is the risk the whole feature introduces: batching converts "too much noise" into "possibly no
signal", and a choir that *believes* it knows the schedule is worse off than a spammed one. Stage 4's
decision 6 was taken on the explicit promise of this sweep — the leaving prompt accepts "later"
without pressing further because "later" was supposed to be caught by a clock. It now is.

**What landed, backend:**
- `NotificationType.ANNOUNCEMENT_PENDING` (migration `notifications/0013`) — all nine layers, with
  the frontend navigation branch counted as one of them (see the trap below).
- `AnnouncementQueue.stale(now)` + `StaleQueue`. Three gates, each of which exists to keep the nudge
  honest, and the middle one is the load-bearing choice of the stage:
  - the concert has not happened yet;
  - **publication would actually send something** (`message_count > 0`);
  - the queue has been waiting longer than its own fuse, and the last nudge is older than that fuse.
    ~~Measured from the oldest pending row~~ — **corrected in the stages 5-6 audit:** from the oldest
    row behind a line that would actually be sent, so a mutually-cancelling edit cannot age the news
    beside it.
- `Project.announcement_nudged_at` (migration `roster/0036`) — a cooldown, not a one-shot claim,
  which is the one way it differs from `reminder_sent_at` beside it.
- `roster.dispatch_announcement_nudges`, hourly beat, claiming before dispatching exactly as the
  reminder sweep does. `ANNOUNCEMENT_NUDGE_HOURS` (24) and `ANNOUNCEMENT_NUDGE_URGENT_HOURS` (4) are
  settings, so the sweep can be exercised without manufacturing a day.
- `_compose_announcement_pending` + `AnnouncementPendingMetadata`. Two numbers only, and both are
  numbers the reader already sees elsewhere.

**What landed, frontend:** the bell row (gold, `Megaphone`), the preference row under **Operacje
zespołu**, and `?announce=1` on the project hub — the contract the push, the e-mail CTA and the bell
all deep-link to, which opens the review sheet on arrival and then strips itself from the URL.

**Decisions taken:**
1. **The fuse is also the cooldown, and there are two of them.** This settles open decision 6, and it
   is one mechanism doing both jobs rather than two: a calm queue waits ~24h and is re-raised daily,
   a queue holding a reschedule waits ~4h. Because the cooldown is *that row's* fuse rather than a
   flat day, **an escalation breaks through a stamp left by a calm nudge** — the morning's INFO nudge
   does not mute the reschedule queued at noon, since four hours later the stamp is already older
   than the urgent fuse. A second column recording the level it was last sent at would have bought
   nothing this does not.
2. **Urgency is read from what survived collapsing, not from the stored rows** — the same rule
   Stage 1's decision 2 applies to a published announcement and Stage 4 applies per line. A reschedule
   that was reverted does not keep the short fuse it was queued with. Only lines with a live audience
   count: an alarm addressed to a cast that has since declined is not a reason to hurry.
3. **A queue that would send nothing is never raised.** Rows are not news. A value moved and moved
   back leaves two rows and nothing to say, and "3 changes are waiting" about it would make the
   feature wrong about its own numbers — the one thing it cannot afford, since its entire claim is
   that the count on the button is the count that leaves. This is also what stops a mutually-cancelling
   queue nagging forever. The nudge therefore quotes `preview()`, the same call the review sheet is
   built from, rather than counting rows.
4. **Addressed to every manager, not to an owner.** The stage as written said "the project owner";
   there is no such field. Nothing records *who* queued a change (`queued_by` was deferred in Stage 1
   and again in Stage 4), and `Project.conductor` is an `Artist` link, not a permission — Stage 2's
   decision 3 already settled that publishing is a manager capability. Addressing the people who can
   actually act on it is the honest reading of what the tree knows.
5. **Tier 1 — e-mail ON, and deliberately not digestible.** Every other manager alert reports
   something that *happened*; this one reports that something has not. The failure it guards against
   is a conductor who stopped opening the app, which is precisely the reader the in-app pill, the
   dashboard badge and (for anyone who never subscribed a device) push cannot reach. Putting it in
   the daily digest would let a "you forgot" be deferred by up to a day, which is how a safety net
   fails rather than how it batches.
6. **One nudge per project, and it opens the sheet.** The queue is per project, the fuse is per
   project, and the action is per project — so folding several projects into one message would buy a
   smaller inbox at the price of the single tap that resolves it. The push tag is per project too, so
   a second nudge about the same queue replaces the first instead of stacking beside it.
7. **A concert already past is out of scope.** After it, a held rehearsal move is archaeology, and a
   project left ACTIVE would otherwise nag for as long as it existed — the worst nag case available.

**Traps found, worth keeping:**
- **`NotificationItem.navigateToContext` routes by substring** (`type.includes("PROJECT")`,
  `"REHEARSAL"`, `"CASTING"`, `"ABSENCE"`). A new type whose name contains none of them silently
  dead-ends at `/panel` — it type-checks, renders, and simply goes nowhere. This is a tenth layer
  hiding inside the ninth; `ANNOUNCEMENT_PENDING` needed an explicit branch before the chain.
- **A deliberately held line is re-raised every fuse.** Stage 4's decision 1 makes holding a
  legitimate indefinite state, and this sweep will keep asking about it. That is intended rather than
  overlooked: the whole premise of a safety net is that intent decays, and the conductor who genuinely
  means "never" has an explicit discard. It does mean "hold" and "discard" now differ in cost, which
  they did not before.
- **`AnnouncementQueue.stale` calls `preview()` per candidate project**, which collapses twice
  (`plan` and `describe` each do). Cheap at this scale and worth it: quoting the sheet's own numbers
  is what stops the nudge and the sheet disagreeing. Revisit only if the project count grows.

**Verified:** 458 roster + notifications tests pass (22 new: `AnnouncementNudgeTests` covering the
fuse in both directions, the cooldown, the escalation breaking through it, a queue collapsing to
silence, a queue nobody would receive, publish and discard both ending it, and the three
out-of-scope project states; `AnnouncementNudgeCopyTests` + `AnnouncementNudgeEmailTests` covering
the deep-link to the sheet, the per-project tag, hours-versus-days, the sub-hour floor, Polish's
three plural forms, and the row that is omitted rather than showing zero). ruff and mypy clean;
frontend typecheck, lint and build clean; pl/fr/en `.po` **and** `.mo` committed together.

**Done:** every criterion the mechanism was built for is now met, and the one that guards against
the mechanism itself is the last to land.

## Stage 6 — the ledger asks about consequences · SHIPPED

**Goal:** a chorister can decide what reaches them, in words they already use.

Not a bug fix. The audit closed the briefing's bypass at the router, which is the correct *mechanism*
and left the *interface* untouched. This stage was about the interface — and it turned out to be
about the backend's own model of itself as much as about the screen.

**The problem it fixed.** The matrix had ~18 rows keyed to internal event types: "Piece Casting
Changed", "Project Details Updated", "New Rehearsal Scheduled". Those are engineering categories. A
singer has no vocabulary in which they are three different decisions, and read the ledger as one long
list of near-synonyms. Worse, it asked a question the fold had made unanswerable: since Stage 3 the
**type of the envelope is an accident**, depending on how many things the conductor changed that
week. The audit's per-item routing rescued the *outcome*, but by quietly ignoring one of the rows the
UI still displayed. A setting the system has to work around is a setting in the wrong shape.

**What landed, backend.** `delivery.py` stopped being a list of e-mail-on types with a comment
describing tiers, and became the tiers themselves:

- `PreferenceGroup` + `PREFERENCE_GROUPS` — **commitments**, **messages**, **materials**, and the
  manager-only **team**, in render order. Each carries its member types and its per-channel default.
- **`DEFAULT_EMAIL_ENABLED_TYPES` is now derived from the groups, not written beside them.** That is
  the whole point rather than a tidy-up: a single control may only state a single answer, so a group
  whose members disagreed would be a switch that lies. Deriving makes the disagreement unrepresentable
  instead of merely tested for.
- `HIDDEN_FROM_PREFS` and the manager-only set moved out of `views.py`, where they were a second copy
  of the delivery policy, and are now derived too. The rule that replaced them is one sentence: **a
  group *is* a control, so a type nobody can control has no group** — `UNGROUPED_DEFAULTS` holds
  those five and their per-type defaults, and is exactly the hidden set.
- `assert_preference_policy_is_coherent()` runs in `NotificationsConfig.ready()`: every
  `NotificationType` placed exactly once, and no controllable group holding an override. The "~9
  layers" trap loses one layer permanently — this one now refuses to boot rather than degrading to
  the raw English Django label.
- `GET /api/notifications/preferences/` returns `{groups, preferences}` instead of a bare list. The
  rows stay flat and keyed by type, because that is still the storage grain and what the details
  disclosure writes at; the groups carry order, `controllable`, and the recommendation their control
  targets. **A breaking change to the response shape** — the only consumer is our own client, and the
  query key gained a `matrix` segment so a persisted snapshot of the old array cannot rehydrate into
  code that reads an envelope.
- No new endpoint. The plan asked for "bulk update per group"; the existing `PUT /preferences/`
  already applies a set of per-type rows atomically, and the client knows the members from the same
  payload it renders. A group endpoint would have been a second way to write the same rows and a
  strictly weaker one — it could not express the details rows at all.

**The load-bearing move: casting joined the commitments.** "You now sing S2 instead of S1" is a
change to what you must prepare — nearer to a moved rehearsal than to "new sheet music uploaded". Two
things make it safe now that were not true when casting was put on the push-only tier:

- **The volume objection died with the queue.** Casting was e-mail-off because it fanned out per edit
  to a whole cast. Since Stage 0c one save is one write, and since Stage 3 publication folds per
  recipient — so the ceiling is one envelope per person per publication, exactly as for a rehearsal.
  The cost is real and worth naming: a board save touching twelve singers on a live project now sends
  twelve e-mails where it sent none. That is the same twelve the rehearsal beside it would have sent,
  and one message each, not one per seat.
- **Everything a briefing can carry now lives in one group**, so the bypass the audit had to close
  cannot re-form. The router's per-item filter stays as the invariant's enforcement and stops firing
  in practice. `test_everything_a_briefing_can_carry_lives_in_one_group` is that invariant written down.

**Correction to this plan: it *is* a data migration** ("no schema change, no data migration" above was
wrong, and wrong in a way that would have silently excluded the readers the change is for).
`NotificationRouter.route` mints a preference row on first delivery, seeded from the default of the
day — so anyone who had *ever* received a casting notification already carried a stored "e-mail off"
row written by the system, not chosen by them. Left alone they would keep the old default forever and
be shown a "customized" marker for a choice they never made. `notifications/0014` releases exactly the
rows at the old default pair (e-mail off **and** push on); a row saying (off, off) expresses a real
decision about push and stands. Reverse is a genuine no-op: with the old default restored, an absent
row reads exactly as the deleted ones did.

**What landed, frontend.**
- `NotificationsTab` renders one panel per group: name, a sentence saying what it covers, and the two
  channel switches on the same grid as the rows, so the columns line up down the whole ledger. The
  per-type rows survive behind a "Szczegóły (n)" disclosure — removing them would have taken away
  control some users have already exercised.
- A **mixed** switch state, and the reason it exists is decision 2 below. `groupChannelState` /
  `nextGroupChannelValue` / `groupChannelPayload` live in `lib/preferences.ts` beside the divergence
  rule, so the ledger and the mutations share one definition.
- `notificationPreferenceGroups.ts` kept its name and lost its authority: it maps ids to glyphs and
  assembles the server's matrix. It no longer decides which group anything is in.
- `useUpdateGroupChannel` — one request, one optimistic step, writing only the members that differ
  and carrying the untouched channel at its stored value.

**Decisions taken:**
1. **The e-mail channel for commitments may be switched off** (open decision 7). It is the reader's
   inbox. Turning it off states the consequence in plain language beneath the group — "Nie dostaniesz
   e-maila, gdy zmieni się termin próby albo koncertu. W aplikacji nadal zobaczysz wszystko — ale
   tylko wtedy, gdy do niej zajrzysz." — and the rows keep the below-recommended marker and its
   Restore-recommended affordance. Say what is being given up; do not nanny, and do not let it break
   quietly. The sentence is per group, shown only where the group's own recommendation is e-mail ON,
   so `materials` never nags about a default it already meets — and only when the group is **wholly**
   off, since under a mixed state it would claim silence about events that still e-mail.
2. **A group whose members disagree renders as mixed, never coerced** (open decision 8). Someone who
   answered per type before this stage has a state the group control cannot express; painting it as
   plain "off" would misreport their own settings back to them, and silently writing one value over
   it would overwrite a choice they actually made. The switch has a third appearance and the group
   carries a "Częściowo" chip. Clicking resolves **upward** — the conventional reading of a partial
   control, and the safe direction: it adds delivery rather than silencing something nobody asked to
   lose. `aria-checked` stays binary (ARIA has no mixed state for `role="switch"`); the accessible
   name carries "włączony częściowo" instead of abusing it.
3. **Team operations keeps its per-type rows and gets no group control.** It is the one group whose
   members genuinely disagree by design: three digestible routine alerts beside the queue's safety
   net, which is deliberately e-mail-ON because it reports that something *has not* happened. A single
   switch there could only pick a side. `controllable: false` is that admission made structural, and
   the coherence assert refuses any other group holding an override.
4. **Grouping is the server's, and only the server's.** The plan suggested "a group→types map beside
   `default_channel_preferences`". Beside would have been two lists of the same types and a promise
   they agree. The client holds glyphs and nothing else, so the ledger a reader operates and the
   policy the router applies are the same object.

**Traps found, worth keeping:**
- **A lazily-minted preference row is not a preference.** The whole migration above exists because a
  row created by delivery is indistinguishable from one created by a click. Any future default change
  faces the same question; the answer is the (old-default-on-both-channels) filter, not a blanket wipe.
- **`channelGrid()` returns whole literal class names on purpose.** Tailwind scans source text, so a
  class assembled at runtime (`.replace(/^sm:/, "")` on a variant string) never reaches the
  stylesheet — the columns silently stop aligning while everything type-checks.
- **Four `type_desc` keys were missing all along** (`PROJECT_CANCELLED`, `REHEARSAL_SCHEDULED`,
  `REHEARSAL_CANCELLED`, `MESSAGE_RECEIVED`). Invisible while descriptions were optional; filled here,
  since the details rows are now something a reader opens deliberately.
- **`details_show` uses `{{n}}`, not `{{count}}`.** The number is parenthesised so no locale has to
  agree with it, and `count` would have dragged in i18next's plural resolution and three suffixed keys
  per language that nobody writes.

**Verified:** 471 roster + notifications tests pass (13 new: `PreferenceGroupPolicyTests` covering the
coherence assert, a controllable group governing what it promises, casting's new home, the
briefing-carries-one-group invariant and the group/hidden duality; `PreferenceLedgerShapeTests`
covering render order, every row naming a declared group, the recommendation a control targets, the
uncontrollable group promising nothing, and the manager group vanishing whole for an artist;
`CastingDefaultReleaseMigrationTests` covering the migration's three cases). ruff and mypy clean;
frontend typecheck, lint, build clean; 25 vitest assertions across the two rewritten unit suites.

**Done:** a chorister answers "what do you want to hear about?" in four sentences, and the router's
per-item filter has nothing left to do — it remains as the guard rather than as the mechanism.

---

## Audit — 2026-07-25

A read of stages 0–3 against the tree, after Stage 4 was written. Four defects, one policy question
the fold had answered without being asked, and two documentation claims that were stronger than the
code. The first two defects falsified success criteria this file already ticked.

**The audience rule now lives in one place.** `NotificationRecipientPolicy.in_conversation` —
confirmed *and* still deciding, never declined. The queue resolves broadcasts through it, and so do
the two alarms that bypass the queue. They had drifted: `delete_rehearsal` and the `PROJECT_CANCELLED`
branch of `update_project` both used the CON-only default, while Stage 1's decision 3 had moved the
queue to CON+INV and Stage 2 had made publication address exactly the `INVITED`. The consequence was
not marginal — a concert published yesterday has an entirely `INVITED` cast **by mechanism**, so
calling it off reached nobody but the auto-confirmed creator. `AnnouncementAudienceTests` covers both.

**`message_count` counted events, not envelopes.** `PublicationPlan.message_count` summed *solo
announcements* rather than the people they reach, so one rehearsal moved on a twelve-singer cast
reported `1` while twelve e-mails and twelve pushes left. Stage 4's confirm button and success toast
both read that number, which made the sheet's central promise false on the most common day of all:
the single-edit day, where nothing folds. Now counted per recipient.

**A personal row still fired at someone who had since declined.** `recipients_for` returned the
stored recipient unconditionally; the `DECLINED` exclusion only ever applied to broadcasts. A cast
removal is deliberately exempt — it has no live participation behind it by construction, and the
guard test says so.

**Re-inviting a declined singer on a live project reached nobody.** Stage 0c correctly changed
`useCastTab` from `CON` to `INV`, but that path is a PATCH on the participation, which went through
DRF's default `perform_update` and never touched `send_invitations`. The singer was silently moved
back to `INVITED`, the project reappeared in their schedule, and nothing ever put the question —
with no recovery, since publication runs once. Now routed through
`ParticipationService.update_by_manager`, which treats "back to INVITED" as an act rather than a
field write. Every other status a manager can set stays silent: answering CONFIRMED *for* someone is
bookkeeping, not a message to them.

### The fold was overruling the reader — the briefing now routes per item

Not a bug in anyone's code; a consequence nobody had stated. `PROJECT_BRIEFING` is **one type
carrying several**, and the router honoured the envelope's preference. So a singer who had switched
casting e-mail off — Tier 2, deliberately push-only *at the time; Stage 6 has since moved casting to
e-mail ON, but a reader may still switch it off and the defect would be identical* — received casting
news by e-mail the moment it travelled inside a briefing, and one who had switched rehearsal updates
off entirely still got them.
The reverse was worse: switching the briefing off would have opened a hole whose contents nobody
could predict, because *which* events a briefing gathers depends only on how busy that week was.

**A briefing is a delivery shape, not a category.** `NotificationRouter._route_briefing` now answers
each channel separately and carries only the items enabled on it, reading each item's own type. Three
consequences worth knowing:

- **Push and e-mail may carry different lines.** That is correct, not a discrepancy — it is what
  honouring two different preferences inside one message looks like.
- **The in-app row is untouched and always complete.** The bell is a record, not a channel.
- **The calendar is dropped whole if any rehearsal was filtered out.** Publication lifted the events
  out of their items (attachments are per message), so they cannot be matched back one by one; an
  attachment naming a date this copy never mentions would put a phantom rehearsal in someone's diary.
  A missing `.ics` is recoverable, a wrong one is not.

`PROJECT_BRIEFING` is therefore in `HIDDEN_FROM_PREFS`: a toggle on it would govern nothing the
reader can name. Its `delivery.py` entry survives only as the answer if it is ever re-exposed, and
says so. Preference rows are **read, never created** on this path — a briefing merely mentioning a
type must not freeze today's default as the reader's stated choice.

*Note for the pending dead-key sweep:* the settings-matrix keys for `PROJECT_BRIEFING`
(`settings.notifications.types.*`, `.type_desc.*`, and its `NOTIFICATION_TYPE_META` entry) are
unreferenced while the row is hidden, and are kept deliberately. Stripping them would make
re-exposing the type regress straight back to the raw English label — the exact defect the audit
found. Three lines are cheaper than that trap.

This is the small half of the answer. The other half is that the preference matrix asks the wrong
question — see Stage 6.

### Corrections to claims made above

- Open decision 1 and Stage 3's decision 5 both said "restoring a soft-deleted participation already
  re-applies `INV`". It is a *client* contract, not a server guarantee. Both marked in place.
- `PROJECT_BRIEFING`'s "all eight layers done" was two short.

### Known and deliberately not fixed

Each one line, so the next reader does not re-derive them.

- **Publication and queue publication are read-then-write without a lock.** Two concurrent POSTs
  would fan out twice. Single-tenant, but the duplicate is irreversible; `select_for_update` on the
  project and on the pending rows would close it.
- **`preview` can name a `change_id` absent from `changes`.** `describe()` collapses every pending
  row while `plan()` collapses only the taken ones, so holding a row can make a field survive that
  the full fold cancels out. The per-recipient list then points at a line the sheet is not showing.
  (Related to, but narrower than, the partial-hold trap Stage 4 recorded.)
- **A casting is lost when someone is removed and re-added.** `discard_recipient` drops their pending
  personal rows; the re-add only discards the `PARTICIPATION` row. Their seat survives in the
  database, unannounced.
- **Collapsing orders rows by `created_at` with no tiebreak.** `rows[0].change_old` against
  `rows[-1].change_new` is undefined for two rows sharing a timestamp. Microsecond resolution on
  Postgres makes it unlikely, and UUID4 primary keys are no use as a secondary sort.
- **The dashboard badge outlives the news it advertises** (found while building Stage 5). A queue
  whose rows all cancelled out still has rows, so `has_unannounced_changes` stays true forever: the
  hub pill correctly shows nothing (it reads the collapsed `change_count`) and the sweep correctly
  stays silent, but `ProjectRow` keeps its badge. Fixing it properly means collapsing inside a list
  query, which is exactly what Stage 4's decision 5 ruled out — a flag is all that is affordable
  there. Publishing or discarding the queue clears it.

**Verified after the audit:** 436 roster + notifications tests pass (13 new: `AnnouncementAudienceTests`
and `ReinvitationTests` covering both cancellation audiences, a personal row dropped on a late
decline, a removal still reaching someone with no participation left, and the three re-invitation
transitions; `BriefingRoutingTests` covering per-channel item filtering, a channel with nothing
enabled, the calendar rule both ways, no rows minted, and the type's absence from the matrix). ruff
and mypy clean; frontend typecheck, lint and build clean.

## Audit — stages 5 and 6, 2026-07-25

A read of the two stages against the tree, after they shipped. No defect falsified a success
criterion this time; the six below are the kind that would have gone unnoticed until they misled
somebody. All are fixed. The verification the stages claimed holds: 475 roster + notifications tests,
ruff and mypy clean, frontend typecheck/lint/build clean, locale parity across pl/en/fr and `.po`
matching `.mo` in both translated catalogues.

**The nudge's fuse dated the rows, not the news.** `stale()` took `Min(created_at)` over every
pending row and only then checked that publication would send something. So a venue moved and moved
back yesterday — two rows, no news — started the clock on a dress code changed an hour ago: the
queue nudged about something nobody had been sitting on, and quoted a `waiting_hours` that belonged
to a different edit. The same error as counting rows instead of messages (decision 3), one step
further in. `preview()` now reports `waiting_since` measured over the rows behind lines that are
neither held nor addressed to nobody, and `stale()` reads it from there. **Per line, not per
announcement**, because the line is the atom everywhere else in this surface: a project diff's dead
field is dropped with its rows, while a rehearsal's whole diff is one indivisible fact and is
therefore as old as its oldest row.

**The claim was unconditional.** `update(announcement_nudged_at=now)` over the whole stale set did
not re-check the cooldown, so two beats reading the queue at the same moment would both pass and both
send. The reminder sweep beside it gets away with a flat update because its `due` queryset carries
the very predicate the update flips; here the fuse is per project, so the condition has to travel
with each row. The sweep now claims one project at a time, conditionally, and skips what it did not
win — which is why `StaleQueue` carries its `fuse`.

**`_fuse()` restated the settings defaults** it was reading through `getattr`, so two places said
"24". Now `settings.ANNOUNCEMENT_NUDGE_HOURS` directly; `override_settings` still exercises it.

**The briefing invariant was defended by a hand-written list.** `test_everything_a_briefing_can_carry
_lives_in_one_group` enumerated five types "mirroring the queued emitters" — which cannot fail for the
case it exists for, since a new queued emitter simply would not appear in it. Stage 6's whole
argument is that a derived invariant beats a tested one ("deriving makes the disagreement
unrepresentable instead of merely tested for"), and this was the one place that did not take its own
advice. `announcements.QUEUEABLE_TYPES` now declares the set, `queue_announcement` /
`queue_broadcast` refuse a type outside it, and the test reads it. A new queued emitter registers
itself or fails the first time it fires.

**The preferences endpoint filtered group members through `HIDDEN_FROM_PREFS`** — but that set *is*
`UNGROUPED_DEFAULTS`, and the coherence assert forbids the overlap, so the filter never removed
anything and its `if not visible: continue` was unreachable. Dead code is cheap; dead code that casts
doubt on an invariant enforced ten lines away is not. Removed.

**`NOTIFICATION_TYPE_ICON` still mapped `SYSTEM_ALERT`**, an ungrouped type with no row to draw a
glyph on — the client-side twin of the same smell. Removed.

### Deliberately not changed

- **`change_count` counts lines that reach nobody.** The nudge's `change_count` is the whole
  collapsed queue, which is exactly what the hub's pill shows — the two agreeing matters more than
  the count matching the envelopes, which is what `message_count` is for.
- **A held line still ages its own queue.** `waiting_since` excludes held lines, so a queue holding
  *only* held rows never nudges — but the moment anything else is pending, the fuse dates from the
  live line. That is the intended reading of Stage 5's recorded trap: holding is a legitimate
  indefinite state and the sweep keeps asking, but it asks about what is actually waiting.
- ~~**The `team` group has no group control.**~~ — **done, see below.** It was never a bug; it was
  coherent and it cost the manager their group controls, which is a different kind of wrong.

## Stage 7 — the safety net becomes its own group · SHIPPED

Written as a spec under the stages 5–6 audit and executed unchanged; the reasoning is kept because it
is the argument for the shape, not a record of the work.

**Why.** `team` is `controllable=False` because `ANNOUNCEMENT_PENDING` disagrees with its three
siblings about e-mail, and a single switch there could only pick a side. The admission is honest, but
its cost is that **the manager — the reader with by far the most notification traffic — is the only
one who gets no group control at all** and must operate the ledger at the per-type grain Stage 6
exists to retire. The disagreement is also the *only* reason `_EMAIL_OVERRIDES`, the `controllable`
flag and the third invariant in `assert_preference_policy_is_coherent` exist; all three are machinery
serving one exception.

**The change.** Give the safety net its own single-member group. A one-member group is not a control
that lies — it governs exactly one type, honestly — and "tell me when I have forgotten to announce
something" is a consequence a manager can name, which is the test `PreferenceGroup` sets for a group
being a group.

```
safety_net  manager_only, email=True
  ANNOUNCEMENT_PENDING
team        manager_only, email=False
  PARTICIPATION_RESPONSE / ATTENDANCE_SUBMITTED / ABSENCE_REQUESTED
```

The ledger now renders `commitments · messages · materials · safety_net · team`, and `team` stays
last for the reason it always was: the daily-digest control sits directly beneath it. That argument
got stronger rather than weaker — after the split, `team`'s membership *is* `DIGESTIBLE_TYPES`, and a
test asserts both the equality and the fact that `team` is declared last.

**What it touched.**
1. `delivery.py` — the group split; `_EMAIL_OVERRIDES` and the `controllable` field deleted; the
   third invariant dropped from `assert_preference_policy_is_coherent` (the first two stay and are
   the ones that matter). What the deleted invariant checked is now unrepresentable: the defaults are
   derived from the group, so a control cannot promise what its members do not hold.
2. `views.py` — `recommended_email`/`recommended_push` are always the group's own.
3. `NotificationsTab.tsx` — `showRows`/`showActionBar` are gone (`expanded` alone decides the rows,
   the action bar is unconditional), and so is the `group.controllable &&` guard around
   `ChannelCells`. The dead `!showActionBar` separator class went with them.
4. `notificationPreferenceGroups.ts` — `safety_net: Megaphone`, the same glyph its single row draws.
5. Locales ×3 — `groups.safety_net`, `groups_desc.safety_net`, `groups_email_off.safety_net`.
6. Tests — `test_a_group_governs_what_it_promises` now covers every group with no exemption;
   `test_the_safety_net_is_a_group_of_its_own` carries the membership and the digest adjacency; the
   ledger's "uncontrollable group promises nothing" case became
   `test_each_row_agrees_with_the_group_that_speaks_for_it`, which states what the split bought as an
   invariant over every row rather than as a list of exceptions.

**One thing the spec did not foresee: `groups_desc.team` had become false.** It read "singers'
responses and the announcement queue waiting to go out — each of these rows answers for itself",
which described both the departed member and the missing control. Rewritten in all three locales to
name the three remaining events and their tie to the digest below. The `team` *label* still fits and
did not move.

**No data migration, as predicted.** No type changed group *default*: `ANNOUNCEMENT_PENDING` was
already e-mail ON through `_EMAIL_OVERRIDES` and is ON through its new group. Rows minted at the old
default remain correct — which is exactly the check migration `0014` had to fail before it was
written.

**The trap, avoided.** `groupChannelState` returns `"off"` for an empty row list, and a one-member
group makes the mixed state unreachable — the mixed handling is untouched, because `commitments`
still needs it.

**The DTO dropped `controllable` with the server** rather than keeping it a release. Holding it would
not have bought a stale cached client anything: `safety_net` is a group id that client has never
seen, so its label falls back to the raw key regardless. The degradation is cosmetic and survives one
refresh either way.

## Open decisions

Decide them when the stage arrives and record the answer here.

1. ~~Invitation *and* publication as one gesture~~ — **settled in Stage 2, re-verified in Stage 0c.**
   Nobody is invited before publication; publication addresses everyone still `INVITED`. The worry
   that this filter drops people is unfounded, and the reasoning is worth keeping: on a project built
   as a draft **everyone is `INVITED` by mechanism** — nothing could have asked them — so the filter
   is a no-op on the normal path. It is not a no-op for the two rows that are genuinely not awaiting
   an answer: the creator's own participation (`create_project_with_creator` auto-confirms it) and
   anyone who declined. Both would read a fresh invitation as a bug. The one path that manufactured a
   consent-less `CON` — re-adding a declined artist in `useCastTab` — was the real defect and is
   fixed in Stage 0c. ~~Restoring a soft-deleted participation already re-applies `INV`.~~ — that is
   a **client** contract, not a server guarantee (see the audit), and re-inviting a declined singer
   on a live project needed its own service path before it reached anyone at all.
2. ~~Newly added participant on a live project~~ — **settled in Stage 2:** full invitation
   immediately.
3. ~~Who may publish~~ — **settled in Stage 2:** managers only.
4. ~~Whether unannounced-but-saved changes should be visually marked for artists in the app~~ —
   **settled in Stage 4: they blend in silently.** The guiding invariant answers it: the database is
   the truth and the app always shows it, so a marker saying "this is not official yet" would teach
   the cast to distrust data that is in fact correct. The queue is the conductor's editorial buffer,
   not a provisional state of the concert. The badge exists, but only for managers.
5. ~~Whether publication should be reversible~~ — **settled in Stage 1: one-way, and now refused at
   the service rather than merely avoided.** A live project sent back to DRAFT would re-silence a
   concert the cast is already preparing for and strand whatever sits in its queue behind the draft
   gate. CANCELLED is how a project ends.
6. ~~Whether time-critical rows deserve a shorter fuse than the flat ~24h sweep~~ — **settled in
   Stage 5: yes, ~4h, and the fuse doubles as the cooldown.** Two fuses rather than one, read off
   the level that *survived* collapsing. Making the cooldown the same length as the fuse is what
   lets an escalation break through a stamp a calm nudge left earlier that day, which a flat
   24h cooldown would have muted for exactly as long as it mattered.
7. ~~Whether the e-mail channel for commitments may be switched off at all~~ — **settled in Stage 6:
   yes, and it says what that costs.** A locked channel is nobody's idea of respect, and the reader
   who turns it off learns the consequence at the moment they turn it off rather than from a missed
   call time. The below-recommended marker and Restore-recommended stay as the way back.
8. ~~How a group renders when its member types disagree~~ — **settled in Stage 6: mixed, and never
   coerced.** The switch has a third appearance, the group carries a "Częściowo" chip, and clicking
   resolves upward. Coercing would overwrite a real choice; painting it as "off" would misreport
   their settings back to them. `aria-checked` stays binary — ARIA has no mixed state for a switch —
   and the accessible name carries the word instead.

## Success criteria

- ✅ Building a project end to end emits **zero** notifications. *(Stage 0/0b)*
- ✅ Publication emits exactly one message per invited artist per enabled channel. *(Stage 2)*
- ✅ The 5-rehearsals × 12-singers scenario becomes **12 e-mails and 12 pushes**, not 60 and 120.
  *(Stage 3, with one multi-event `.ics` in place of five invites.)*
- ✅ A change made and reverted before publication emits nothing at all. *(Stage 1)*
- ✅ Cancelling a concert still reaches everyone immediately. *(Stage 1 keeps it off the queue and
  flushes what the queue was holding; the 2026-07-25 audit fixed the audience — it had been reaching
  the confirmed only, which on a freshly published concert is nobody.)*
- ✅ The conductor can see exactly what is about to be sent, hold back any single line of it, and
  press send once — with the count on the button equal to the number of messages that leave.
  *(Stage 4; the equality itself was only true after the 2026-07-25 audit — the count had been per
  announcement, not per recipient.)*
- ✅ Folding never overrules what a reader asked for. *(The audit: each item in a briefing is routed
  by its own type, so a preference holds however the news happens to travel.)*
- ✅ A queue nobody publishes eventually says so. *(Stage 5 — every other criterion above is about
  sending less; this is the only one that guards against sending nothing. It says so on the queue's
  own terms: never about rows that would publish to silence, and sooner when what is waiting is a
  change to when people have to be somewhere.)*
- ✅ A chorister can say what they want to hear about without being taught the type names.
  *(Stage 6 — the only criterion about the reader rather than the machinery. The ledger asks four
  questions about consequences; the per-type rows survive behind a disclosure for anyone who wants
  that grain, and the group map is the same object the router reads.)*
