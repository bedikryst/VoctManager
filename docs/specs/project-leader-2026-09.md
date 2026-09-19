# Project leader ("Lider projektu") — promotion of the rehearsal delegate

Status: **All stages (0–4, 3b) done and audited** (2026-09-19; none seen in the browser yet;
`make migrate` pending for `roster/0052`, `roster/0053`, `roster/0054`, `notifications/0020`,
`notifications/0021`, `messaging/0004`). The audit closed a debrief leak to the cast, a stale
`led_by` that froze the rehearsal form, and the missing third dossier tile; it moved the debrief
off the digest shelf and made every "who leads" line a bare name. What is left is the developer's
look and the commit.

## Context

`roster.RehearsalDelegate` (2026-09) lets the conductor lend one person a bounded tie to ONE
project: read the `leader` annotation layer, take roll call, open the project's materials. The UI
calls it "zastępstwo" / "prowadzenie prób" and shows it only to the manager (a card at the bottom
of the Rehearsals tab) and to the delegate (a "Prowadzisz" badge on schedule cards, a
"Zastępstwo" pill in materials).

The conductor wants this to read as a **project leader** — normally one person for everything,
but decided per concert (the intended person is on maternity leave). He also runs **parallel
sectionals**: he takes the men (T+B) while the leader takes the women (S+A), at the same time or
not. The grant stays a relationship on one project (deliberately not a fourth `AppRole` — ~180
gates branch on `user_is_manager`, see the model docstring). What changes: vocabulary and
presentation, a per-rehearsal "who stands in front" pointer, a block in the artist dossier, and a
few powers a leader realistically needs.

## Decisions (settled with the developer, 2026-09-19)

- **Default leader = a suggestion, never an automatic grant.** The add form pre-selects the most
  recently appointed leader; nobody gets powers without the conductor clicking. No new model.
- **Debrief after a rehearsal, with a notification to managers.** New `NotificationType`.
- **Writing on the `shared` layer is opt-in**: fourth scope boolean, default OFF.
- **Choristers see who leads**: per rehearsal, only when it is not the conductor.
- **Sectionals with different leaders**: `Rehearsal.led_by` (nullable FK Artist); null = the
  project's conductor. Sectionals themselves already exist (`invited_participations`, form
  `targetType` SECTIONAL/CUSTOM in `useRehearsalsTab.ts`) — nothing to add there.

## What stays, and why

- Model name `RehearsalDelegate`, table, `NotificationType.REHEARSAL_DELEGATED/_ENDED` values,
  `led_projects_q` and friends: a rename would be a table migration plus a data migration of
  stored notifications for zero behaviour. Only `verbose_name`/`help_text`/docstrings change.
- The three existing scopes and their semantics (`any` = visibility, specific = power).
- `leader` layer stays read-only for the leader; `conductor` layer stays closed (carries judgments
  about singers). The leader's own thoughts go to `personal`, or to `shared` when scope 4 is on.
- Leader never issues an attendance verdict (`is_manager` flag on `AttendanceRecordDTO`).
- Lead sheet renders the same `RehearsalInspector` as the manager (`allowManagerActions=false`).

---

## Stage 0 — Vocabulary, presentation, suggestion

Goal: the thing is called "Lider projektu" everywhere a person reads it; the manager sees the
leader as a project fact; the add form offers the last leader with one click.

Backend (`backend/roster/`):
- `models.py` `RehearsalDelegate` (~L946-1010): docstring + `verbose_name`s ("Project Leader",
  "Leader"), help_texts. No schema change, but Django DOES emit migrations for `verbose_name`,
  `help_text` and `choices` labels (`roster/0051`, `notifications/0019`, both no-op SQL) —
  `make migrate` still has to record them.
- `views.py` `ProjectViewSet.delegates` / `delegate_detail` (~L991-1067): unchanged routes. Add
  `GET /api/projects/{pk}/delegates/suggested/` → `{"artist": <id>|null}`: the artist of the most
  recent `RehearsalDelegate` row (`all_objects`, ordered `-created_at`) whose artist is active and
  not already a live leader of this project. Put the query in `RehearsalDelegationService`.
- `notifications/message_content.py` `_compose_rehearsal_delegated` /
  `_compose_rehearsal_delegation_ended` (~L1092-1180) and `notifications/models.py` labels
  (~L42-45): copy says "leader of project X" instead of "asked to run rehearsals". English only
  in this stage. NB the premise "no project `.po` files" was wrong: `backend/locale/{pl,en,fr}`
  exist (~1070 msgids) — the delegation copy was simply never added to them in 2026-09, so a
  Polish reader gets this e-mail/push in English. Separate task (polib, see memory
  `reference_locale_files_editing`).

Frontend:
- Rename `features/projects/editors/tabs/components/RehearsalDelegatesCard.tsx` →
  `ProjectLeadersCard.tsx` (git mv; keep `project.delegates.ts` API file name — the URL is
  `/delegates/`). Title "Lider projektu", description explains "one person for the programme,
  decided per concert". Row: name + `Badge` "Lider" (`ACCENT_BADGE.gold`; "Lider" is a label, so
  no `casing="natural"`). **Drop the three per-scope chips on every row** (canon
  `.ai/04_design_system.md`: a chip only for the exception): show a `Caption`
  "Zakres ograniczony: bez obecności" only when a scope is off. Expiry/note captions stay.
- Add form: person `Select` pre-selected from `suggested/` (new hook `useSuggestedLeader` in
  `project.delegates.ts`, key under `projectKeys.delegates`). Candidates: the cast first, then
  every other active non-instrumentalist artist — the backend already supports a leader without a
  seat (`can_open_materials` help_text), the form just never offered it. Check whether
  `shared/ui/primitives/Select` supports option groups; if not, a disabled divider option.
  Scope checkboxes move under a collapsed "Zakres (zaawansowane)" toggle, all on by default.
- `RehearsalsTab.tsx` (~L257-270 candidates, ~L710-716 mount): rename only.
- `features/projects/ProjectCard/widgets/ProjectFactsCard.tsx` (~L212-216): new `FactRow`
  "Lider" under "Dyrygent"; value = live leaders' names joined, dash when none. Needs
  `ProjectSerializer` (`roster/serializers.py` ~L262-375) to expose `leaders: [{artist_id, name}]`
  (live rows only — reuse the predicate pieces of `led_projects_q`; prefetch in
  `ProjectViewSet.get_queryset` ~L570-643). Type in `features/projects/types/project.dto.ts` +
  `shared/types/index.ts` Project. Bump the query cache buster if the DTO shape is persisted.
- Badges/copy: `materials.project.standing_in_badge` "Zastępstwo" → "Lider";
  `rehearsals.lead.role` fallback "Zastępstwo" → "Lider projektu";
  `DelegationBriefingModal.tsx` (~L179) eyebrow "Prowadzisz próby" → "Jesteś liderem projektu";
  `notifications.delegation.*`, `projects.delegates.*` (keep the key prefix; only values change).
- i18n: pl/en/fr `shared/config/locales/*/translation.json` — every changed value in all three.
- `.ai/01_project_domain.md` (~L5-25): add the leader relationship to roles, `RehearsalDelegate`
  to the roster entity list, the `leader` annotation layer (doc is stale on all three).

Tests: `roster/test_rehearsal_delegation_api.py` + one test for `suggested/`.

---

## Stage 1 — Who stands in front of which rehearsal (`led_by`) + sectionals

Goal: a rehearsal names its leader; the schedule tells the leader "this one is yours" and tells
everyone else who leads when it is not the conductor; parallel sectionals become two rehearsals
with two different `led_by`.

Backend:
- `roster/models.py` `Rehearsal` (~L824-871): `led_by = FK(Artist, SET_NULL, null, blank,
  related_name='led_rehearsals')`; docstring: null = the project's conductor; a value is an
  announcement, not a permission (permissions stay on the project grant). `makemigrations`.
- `roster/serializers.py` `RehearsalSerializer` (~L378-455): writable `led_by_id`, read
  `led_by_name` (+ `led_by_artist_id`). `validate`: value must be the project's conductor or an
  artist with a live `roll_call` grant on the project (direct `RehearsalDelegate` filter — the row
  has `artist`, no user hop needed).
- `RehearsalUpdateDTO` / `RehearsalOperationsService.update_rehearsal` (`services.py`,
  `views.py` ~L2155-2173): carry the field.
- `RehearsalDelegationService.revoke` (`services.py` ~L1380-1390): clear `led_by` on this
  artist's **future** rehearsals of the project (past ones are history — they feed the dossier).
- `ParticipationViewSet.schedule_dashboard` (`views.py` ~L1564-1619): rehearsal items gain
  `led_by: {artist_id, name} | null` (explicit only) and `i_stand_in_front: bool` =
  `led_by == my artist` OR (`led_by` null AND I am `project.conductor`). `i_lead` unchanged (=
  may run roll call). Data comes through `get_artist_schedule` (`queries/schedule_queries.py`) —
  add `led_by` to its select_related.
- `RehearsalViewSet.lead_sheet` (`views.py` ~L2001-2090): add `led_by` to the response.

Frontend:
- `features/schedule/types/schedule.dto.ts` (~L61-74) + `hooks/useScheduleData.ts` (~L94) →
  `TimelineEvent` gets `ledBy`, `iStandInFront`.
- `features/schedule/components/TimelineRehearsalCard.tsx` (~L217-226, ~L300-324): badge
  "Prowadzisz" ← `iStandInFront` (was `iLead`); roll-call button ← `iLead` (unchanged); new
  `Caption` "Prowadzi: {name}" when `ledBy && !iStandInFront` (never for the conductor default —
  canon: no chip for the resting default).
- `features/projects/editors/tabs/RehearsalsTab.tsx` + `hooks/useRehearsalsTab.ts` (form state
  ~L340-354) + `components/RehearsalTimelineRow.tsx`: `Select` "Prowadzi" with options "Dyrygent"
  (null) + live leaders with `roll_call`; rendered only when the project has at least one leader
  (otherwise the field cannot vary). Timeline row: `Caption` "Prowadzi: X" when set.
  `project.optimistic.ts` + `project.dto.ts` Rehearsal type: `led_by_id`, `led_by_name`.
- `features/rehearsals/components/RehearsalInspector.tsx` header: "Prowadzi: X" when set.
- `features/rehearsals/LeadSheet.tsx` (~L117-127): `roleText` uses `led_by` when it is the reader.

Notification `REHEARSAL_LEAD_ASSIGNED` → the `led_by` artist, on set/change (not on clear):
"Poprowadzisz próbę 3 października (soprany, alty)". Follow the NotificationType checklist
(~8 layers: `notifications/models.py`, `dtos.py`, `message_content.py`, `delivery.py` group,
frontend `notifications.dto.ts` union + `NotificationItem.tsx`, i18n, tests). Tag
`rehearsal-lead:{rehearsal_id}` so a reassignment replaces the previous push. Not folded into
`REHEARSAL_DELEGATED`: the frontend briefing queue (`useDelegationBriefingQueue.ts`) keys on that
type and would re-open the onboarding modal.

Tests: `roster/test_rehearsal_delegation_api.py` (validation of `led_by`, revoke clears future
rows), `roster/test_delegate_attendance.py` (schedule flags), `notifications/tests.py` (copy).

Shapes settled while building (2026-09-19):
- `RehearsalSerializer` writes `led_by_id`, reads `led_by_artist_id` + `led_by_name`; the
  may-lead check lives in `validate()` (needs the validated `project`), and `_may_lead` reads the
  conductor off `project.conductor_id` plus a direct `RehearsalDelegate` filter with
  `live_delegate_q(scope='roll_call')`.
- `led_by_id` is excluded from the cast's change diff in `update_rehearsal` (like
  `calls_instrumentalists`); the named person is told directly by `_announce_lead_assigned`,
  which is silent for the conductor and for an artist without an account.
- The form's "Prowadzi" select uses a sentinel value (`__conductor__`) because Radix refuses an
  empty item value; the form state keeps `""` for the conductor and the payload sends `null`.
- The lead sheet's `led_by` compares against `user.artist_profile_id`; when somebody else is
  announced the header reads "Prowadzi X." instead of "Prowadzisz próbę.".
- The push's sections are the first letter of `Artist.voice_type` for the invited seats (the same
  grouping the sectional form uses), so mezzos and countertenors name no section — as in the form.

---

## Stage 2 — Dossier & leader badge

Goal: the manager sees leadership in the artist's dossier and spots current leaders in the list.

Backend:
- `roster/queries/dossier_queries.py` `get_artist_dossier` (~L35-201): new top-level block
  `leadership: {projects_led, rehearsals_led, debriefs_written, projects: [{project_id, title,
  date_time, status, is_live, expires_at, scopes: {marks, roll_call, materials, choir_marks}}]}`.
  `projects_led` = distinct projects with a delegation row (`all_objects`, past or live).
  `rehearsals_led` = `Rehearsal.objects.filter(led_by=artist, date_time__lt=now)` — honest thanks
  to Stage 1 (a grant does not mean she stood there; `led_by` does). `debriefs_written` = 0 until
  Stage 4 (`debrief_by=artist`). Also `projects[].led: bool` on the history rows (project in the
  led set) — a led project the artist is not cast in appears only in `leadership.projects`,
  which is the point of the separate list.
- `roster/serializers.py` `ArtistSerializer` (list DTO): annotate `is_project_leader` =
  `Exists(RehearsalDelegate live rows for this artist, scope any)` — used by the list badge.

Frontend:
- `features/artists/types/artistDossier.dto.ts`: `ArtistDossierLeadership`, `DossierProject.led`.
- `features/artists/components/ArtistDossier.tsx` `StatsSection` (~L152-266): after the count
  grid, a conditional block (pattern = earnings block ~L195-244): `Eyebrow` "Prowadzenie" +
  `CountTile`s (projekty / próby / raporty — raporty tile only once Stage 4 exists), then a
  compact list of led projects with `Badge` "Lider" + "do {date}" / "bieżący". Rendered only when
  `projects_led > 0` (canon: figure only when it exists). `ProjectHistoryItem` (~L294-296):
  `Badge` "Lider" next to the status badge when `led`.
- `features/artists/components/ArtistCard.tsx` (~L162-176), `ArtistRow.tsx` (~L152-178): `Badge`
  "Lider" (`ACCENT_BADGE.gold`) in the existing badge row when `is_project_leader`.
  `shared/types/index.ts` Artist type gets the flag.

Tests: `roster/tests.py` `ArtistDossierQueryTests` (~L326-475; + leadership block, led project
without a seat), `roster/test_instrumentalist.py` untouched.

Shapes settled while building (2026-09-19):
- `leadership.projects[].scopes` carries the three existing switches only; `choir_marks` joins
  when Stage 3 adds the column (adding a key the model does not have would be a lie in the DTO).
- `is_live` and the list's `is_project_leader` both ask `live_delegate_q(scope='any')` AND
  exclude `Project.CLOSED_STATUSES` — the same shape as the delegated branch of `led_projects_q`,
  so "current leader" in the roster means "holds power today". `Project.leaders` (the facts card)
  deliberately keeps closed projects; the two questions differ.
- One leadership row per project: `update_or_create` revives rows, but a revoked and a later live
  row on one project can coexist, and the dossier folds them, preferring the live one.
- `is_project_leader` falls back to a query when the annotation is missing (the PATCH response
  serialises the saved instance), so editing a profile cannot switch the badge off.
- The dossier's led-project rows reuse `projects.delegates.*` copy (badge, "do {date}", withheld
  scopes) so the roster and the project tab describe one appointment in one voice.

---

## Stage 3 — Wider powers: project channel, `shared` marks, rehearsal focus

Goal: a leader can talk to the cast, may (opt-in) mark the score for the whole choir, and can
set what a rehearsal is about.

**Channel** (`backend/messaging/`):
- `models.py` `ChannelRole`: add `LEADER`. `ChannelMembership` docstring: LEADER rows are
  created on grant and dropped on revoke/expiry — not synced from Participation.
- `signals.py` (~L38-84): `_reconcile_membership` / `_drop_membership` must only touch MEMBER
  rows (verify — today they may drop by (project, user) regardless of role). New receivers on
  `RehearsalDelegate` post_save (live → ensure LEADER row, mirror of
  `ChannelService.ensure_manager_membership` `services.py` ~L197-203) and on revoke (soft delete
  → drop LEADER row unless a confirmed participation keeps a MEMBER row).
- `views.py` `_get_accessible` (~L429-437) + `get_queryset` (~L421) + `by-project` (~L558-564)
  need no change once rows exist eagerly; expiry by date has no row-dropping — add the same
  `led_projects_q` check in `_get_accessible` as a guard (expired leader without a seat → 404).
- Frontend: nothing — the leader's channel appears in the existing channel list.

**Choir marks** (scope 4):
- `roster/models.py` `RehearsalDelegate.can_mark_for_choir = BooleanField(default=False)`,
  help_text: writes the `shared` layer — the choir's official markings. `makemigrations`.
- `roster/permissions.py` `LeadScope` + `_SCOPE_FIELD` (~L35-41): add `'choir_marks'`.
- `archive/views.py` `AnnotationViewSet._assert_can_write` (~L884-920): non-manager may write
  `shared` when the edition's piece is in `led_piece_ids(scope='choir_marks')`. Reserved ink and
  own-row rules stay. `get_queryset` is unaffected (`shared` is already readable). PDF export of
  `shared` is unchanged.
- `roster/serializers.py` `RehearsalDelegateSerializer` (~L647-675) + frontend
  `project.delegates.ts` DTO/grant/patch (~L27-60): the field. `ProjectLeadersCard` scope row
  (label "Nanosi uwagi dla chóru", hint says it is the choir's official layer), default off.
- `notifications/dtos.py` metadata (~L258-297) + `message_content.py` `_delegation_scope_rows`
  (~L1066-1089) + frontend `RehearsalDelegationMetadata` + `NotificationItem.tsx` `changeChips`:
  fourth row.

**Focus** (what the rehearsal is about):
- `PATCH /api/rehearsals/{pk}/lead-sheet/` — same URL as the read-model, body `{focus}`
  (Stage 4 adds `debrief`). Allowed for manager or `user_leads_project(scope='roll_call')`
  (project-wide, like attendance — a forgotten `led_by` must not block it). Goes through
  `RehearsalOperationsService.update_rehearsal` with a DTO limited to the two fields.
- `features/rehearsals/LeadSheet.tsx` + `api/leadSheet.queries.ts`: inline edit of focus in the
  page header area (`Input`, the clickable-row/inline-edit pattern), mutation invalidates
  `["leadSheet", id]` and the schedule keys.

Tests: `messaging/tests.py` (~L453-560; leader membership lifecycle),
`archive/test_annotation_delegate.py` (shared write with/without scope 4),
`roster/test_rehearsal_delegation_api.py` (lead-sheet PATCH focus, 403 without scope).

Shapes settled while building (2026-09-19):
- `ChannelMembership.role` is the SOURCE that owns the seat, not a power: one row per
  (channel, user), and `messaging/signals.py` has two receivers (Participation, RehearsalDelegate)
  that each only take back a seat of their own role. A seat both sources hold is handed over
  (`MEMBER` ↔ `LEADER`) when one source ends, and `_seat` never rewrites a live row's role — the
  premise "sync must only touch MEMBER rows" was the same rule seen from one side.
- Expiry by the clock and a closed project raise no signal, so the seat stays and is re-asked at
  read time: `ProjectChannelViewSet.get_queryset` ORs `led_projects_q(scope='any')` against LEADER
  rows (`role__in`, spelled positively so it binds to the same membership row), `_get_accessible`
  asks `user_leads_project`, and `by-project` goes through `_get_accessible` too.
- `can_mark_for_choir` is in `_SCOPE_FIELD`, so `any` now counts it — a grant with only this
  switch on "exists" for its holder (opens the schedule, not the register).
- `_assert_can_write` opens `shared` for a non-manager only through
  `led_piece_ids(scope='choir_marks')`; the own-row and reserved-ink rules are layer-blind, so
  the conductor's shared marks stay his and crimson stays his.
- `PATCH lead-sheet/` uses a two-field-shaped `LeadSheetUpdateDTO` (`focus` now, `debrief` in
  Stage 4; `extra='forbid'` makes any other field a 400) that converts to `RehearsalUpdateDTO`,
  so the cast's change diff and the announcement queue see one kind of edit. Same 404-for-strangers
  as the read; answers with the whole read model.
- The focus editor lives INSIDE `RehearsalInspector` (prop `onSaveFocus`), not beside the page
  header: the plan already sits under the date there, and a second copy above it would have been
  two places to read one line. `InlineEditable` gained a `subtitle` variant (serif italic, `md`)
  so the editable line is set exactly as the static one.
- Leaders card / dossier: the fourth scope reads the other way round — the caption
  `projects.delegates.scope.choir_marks_granted` appears when it is ON, never in the "Zakres
  ograniczony" list.

### Stage 3b — the annotator's `leader` mode (done 2026-09-19)

The score annotator has a third mode. Shapes settled while building:
- The fact travels per PIECE: `MaterialsPiece.may_mark_for_choir` (materials dashboard, both
  root serializers, from `led_piece_ids(target.user, scope='choir_marks')`), because that is the
  shape of `_assert_can_write`. `scoreAnnotatorModeFor({isManager, mayMarkForChoir})` in
  `features/annotations` is the ONLY way a mount picks a mode; the concert book arms `leader`
  only when every piece in the programme carries the flag.
- `leader` mode: toolbar pill is a two-state toggle (own pencil ⇄ choir, `Lock`/`Users`), not the
  conductor's ladder. `canModify` = personal rows + shared rows whose `created_by` is the reader;
  `isCleared` = the same; `audiences` = `[]` (own pencil is not an audience, so a placed mark is
  not moved between layers — erase and redraw). The incoming-marks watcher runs for every
  non-conductor mode and drops rows authored by the reader.
- `useAnnotationMutations` takes `authorId` and stamps drafts with it (was `created_by: null`), so
  a leader's shared mark is theirs from the first frame, offline included.
- Server `clear` for a non-manager now wipes own `personal` + own `shared` where `choir_marks`
  holds (`archive/views.py`), mirroring the write door; the conductor's shared rows never go.
- Sidebar names the shared layer "Chór" for a leader ("Dyrygent" for a singer); the guide's lead
  fact is `annotations.guide.leader.*` ("Moje albo dla chóru").
- Not done, by choice: the schedule's book mounts (`NextEventHero`, `TimelineProjectCard`) pass
  no mode and stay `personal` for everyone, managers included — the songbook is the writing place.

---

## Stage 4 — Debrief ("Po próbie")

Goal: the leader hands the evening back to the conductor in three sentences; the conductor is
told and reads it where the rehearsal lives.

Backend:
- `roster/models.py` `Rehearsal`: `debrief = TextField(blank)`, `debrief_by = FK(Artist,
  SET_NULL, null, related_name='+')`, `debrief_at = DateTimeField(null)`. `makemigrations`.
- `PATCH /api/rehearsals/{pk}/lead-sheet/` accepts `debrief`; refused before
  `rehearsal.date_time` (a report on a rehearsal that has not happened). Sets `debrief_by` to the
  writer's artist and `debrief_at = now()`; a manager writing it is recorded the same way.
- `RehearsalSerializer` read fields `debrief`, `debrief_by_name`, `debrief_at` (manager surfaces).
- Notification `REHEARSAL_DEBRIEF_POSTED` → managers (recipient pattern: the manager pings in
  `RehearsalOperationsService.record_attendance` `services.py` ~L1670-1760), on first write and
  on change; tag `rehearsal-debrief:{rehearsal_id}`; body = first ~200 chars. Checklist again.
- Dossier `debriefs_written` (Stage 2 placeholder becomes real).

Frontend:
- `features/rehearsals/LeadSheet.tsx`: section "Po próbie" (`SectionCard` + `Textarea` from
  `shared/ui`, save button) shown once the rehearsal has started; shows author + time when saved.
- `features/rehearsals/components/RehearsalInspector.tsx`: read-only "Po próbie" block for the
  manager (author, time, text) when a debrief exists — same component both sides, gated by
  `allowManagerActions` only for editing affordances.
- Notification rendering + i18n ×3.

Tests: `roster/test_rehearsal_delegation_api.py` (before/after date_time, author stamping),
`notifications/tests.py` (copy).

Shapes settled while building (2026-09-19):
- `LeadSheetUpdateDTO` keeps `extra='forbid'` and now carries both `focus` and `debrief` as
  optional; `model_fields_set` routes each — the plan through `update_rehearsal` (cast diff), the
  debrief through `RehearsalOperationsService.post_debrief` (managers only, never a diff). A patch
  naming neither is a 400.
- `post_debrief` refuses with `ValueError` before `date_time` (view turns it into
  `make_error_response` 400 on `debrief`); stamps `debrief_by` from `Artist(user=writer)` — null
  for a manager without a row — and `debrief_at = now()`; a wipe keeps the stamp and is silent;
  an unchanged save is silent; a first write and every change notify.
- `ManagerNotificationHelper.notify_managers` gained `exclude_user_id` so a manager writing the
  debrief is not told of their own. Recipients otherwise = every active MANAGER/ADMIN.
- `REHEARSAL_DEBRIEF_POSTED` has a group of its own, `debriefs` (manager-only, e-mail ON), sitting
  between `safety_net` and `team`. It was first filed under `team`, which by the test-pinned
  invariant IS `DIGESTIBLE_TYPES` — and that held the push and the e-mail until the next
  morning's digest. The digest exists for routine fan-out (one row per singer per rehearsal); a
  debrief is written once, only for an evening somebody other than the conductor ran, and it is
  the one manager-facing thing worth arriving that night. Split out by exactly the move that once
  took `safety_net` out of team ops, so the invariant survives untouched.
- Composer: title = author, body = excerpt, `url_path = /panel/rehearsals?rehearsal=<id>`;
  `useRehearsalsData` consumes `?rehearsal=` once (deep link into the manager's workspace, then
  strips it). A non-manager recipient lands on the lead sheet.
- `debrief_by_name` is the bare name (not `str(Artist)`, which appends the voice) — a signature,
  not a credit. The audit extended that everywhere somebody is named as LEADING: `led_by_name`,
  `_led_by_payload`, `Project.leaders[].name`, `RehearsalDelegateSerializer.artist_name`. A card
  telling the choir who to expect at the front has no use for the voice that person sings when
  they are not standing there; `artist_voice_display` carries it separately where it is wanted.
- Frontend: one `RehearsalDebrief` block at the FOOT of `RehearsalInspector` (prop
  `onSaveDebrief`, mirrors `onSaveFocus`): editor once the rehearsal has started when the prop
  is present, read-only text + "author · time" otherwise, nothing when never written. Textarea +
  explicit save button rather than `InlineEditable`: a paragraph typed after the choir has left
  wants a visible commit. `useUpdateLeadSheetFocus` became `useUpdateLeadSheet(patch)`.
- Cache buster NOT bumped (same reason as Stage 1: nothing is committed yet, nobody holds a
  snapshot). Bump once before the first deploy that carries any of these DTO changes.
- `.po` copy for the new type is English-only, as for every delegation type (see Traps).

---

## Cross-cutting

- **i18n**: every changed/new string in pl, en, fr. Key prefixes kept: `projects.delegates.*`,
  `rehearsals.lead.*`, `notifications.delegation.*`, `schedule.rehearsal.*`,
  `materials.project.*`. New: `projects.rehearsals.form.led_by*`, `schedule.rehearsal.led_by`,
  `rehearsals.lead.debrief.*`, `artists.dossier.leadership.*`, `notifications.lead_assigned.*`,
  `notifications.debrief.*`. `translation.json` is NOT sorted — append in place.
- **Docs**: this file's `Status:` line is updated per stage. `.ai/01_project_domain.md` updated in
  Stage 0.
- **Query cache**: new fields on persisted DTOs (Project, Rehearsal, schedule) → bump the cache
  buster.
- Celery is not involved; no `docker restart` needed. `make migrate` after Stages 1, 3, 4 — dev
  AND prod, manually (nothing applies migrations on its own).

## Verification (once per stage, at the end)

- Backend (repo root): `& .venv\Scripts\python.exe -m ruff check backend\roster backend\archive
  backend\messaging backend\notifications`; same for mypy; tests
  `& .venv\Scripts\python.exe backend\manage.py test roster archive messaging notifications
  --settings=config.test_settings_sqlite` (host, no Docker; the known `documents` JSONField
  SQLite failure is not in this set).
- Frontend (in `frontend/`): `npm run typecheck`, `npm run build` at the end of the stage.
- UI: the developer looks in his own browser. Per stage, one concrete thing to look at: S0 the
  leaders card + "Lider" fact; S1 a sectional pair (men/women, same time) with two different
  "Prowadzi" and the leader's schedule showing one badge; S2 a dossier of the leader; S3 the
  leader posting in the channel and marking `shared`; S4 a debrief and its notification.

## Traps

- `led_projects_q` traverses a multi-valued relation → `.distinct()` on every new caller.
- `any` vs specific scope: visibility asks `any`, power asks the scope.
- `update_or_create` in `RehearsalDelegationService.grant` revives soft-deleted rows, so
  `created_at` is the FIRST grant — do not use it for "since when"; `led_by` is the honest signal.
- `AttendanceRecord` has no `recorded_by` — "roll calls taken" is not derivable; not a stat.
- `ChannelMembership` sync by Participation must not eat LEADER rows (Stage 3).
- New `NotificationType` = ~8 layers each (Stage 1 and Stage 4 add one each); the delivery group in
  `notifications/delivery.py` decides e-mail.
- Never author locale JSON through PowerShell (UTF-8 mangling is irreversible).
