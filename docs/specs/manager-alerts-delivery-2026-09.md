# Manager alerts — delivery model, folded pushes, honest settings

Status: **Stages 1–2 built and audited 2026-09-28, committed, not yet seen by the developer;
Stages 3–4 not started.** Until Stage 3 ships, the settings tab shows team e-mail ON while the
digest panel still carries its old copy.
Four stages, each closed by its own verification and review before the next starts. Stages 1–2
are backend only; 3 is the settings tab; 4 is the service worker and the panel shell.

Built beyond the text below, to confirm at review:

- `0024` also **pins** the missing team rows (e-mail off, push on) for digest-off managers. Without
  it, a digest-off manager who never received one of the three types would start getting one
  e-mail per event for it.
- The fold's stamp is the notification id. A burst that deduplicates to one rehearsal is pushed as
  that single report (today's copy and tag), carrying every folded id.
- The folded absence push names the dates, not the project. Both shapes deep-link to
  `/panel/rehearsals`, where absence requests are reviewed today.
- The e-mail and device predicates Stage 3 needs are extracted: `notification_email_block`
  (`email_service.py`) and `reachable_devices` (`push_service.py`).
- A consequence of team e-mail ON that the text does not name: a **decline** (`PARTICIPATION_RESPONSE`
  at WARNING) is now e-mailed at once to every manager, beside its push, as an absence inside 48 h
  is. Before, the row minted on the first decline said "e-mail off" and it was push only.
- Polish fold copy puts the verb first ("będzie na 4 innych próbach", "spóźni się na 1 z nich"),
  not the inverted order of the direction in Stage 2.

## Why

A conductor with push enabled, the team group's push switched on and every other switch on, gets
no push when a singer confirms attendance.

- **Cause.** `NotificationRouter.route` returns before reading any preference when
  `is_digestible(type, level)` and `UserProfile.digest_enabled` (default `True`). The digest was
  meant to batch e-mail; it silences push as well, for `ATTENDANCE_SUBMITTED`,
  `PARTICIPATION_RESPONSE` (except a decline) and `ABSENCE_REQUESTED` at INFO. The ledger shows
  push ON and the digest ON, and nothing says the second switch cancels the first. Pinned by
  `test_digestible_info_is_held_back`.
- **Absence requests are always INFO** (`record_attendance`, `_announce_attendance_span`), so an
  absence for tonight lands in tomorrow's 08:00 digest. The digest copy promises "urgent matters
  always arrive at once".
- **Absence push tag is per rehearsal** (`absence-requested:{rehearsal_id}`): a second singer's
  request for the same evening replaces the first in the phone's tray.
- **Attendance push tag is per (rehearsal, artist) with `renotify`**: once push flows, a singer
  ticking five rehearsals buzzes the conductor five times.
- **The team group's e-mail column misstates what happens.** Its default reads OFF, yet the digest
  sweep mails these types while no preference row exists, and drops a type as soon as a row is
  minted with the default `email_enabled=False` (for instance by toggling that type's push).
- **App icon count.** Nothing calls the Badging API. On Android it does not exist in Chrome at all:
  an installed PWA's launcher dot (a number on some launchers, e.g. Samsung) counts the app's
  notifications in the tray. On Android, the tray is the only way to control that dot or number.

## Decisions

Settled with the developer:

- The digest governs **e-mail only**. Push follows the group's push switch and is always
  immediate.
- Every singer action reaches the conductor by push. A burst from one singer folds into one push.
- Absence requests are never delayed behind routine news.
- Settings copy is rewritten so each row says what triggers it and how it arrives, and a
  "What will I get?" modal shows examples per channel.

Agent's calls, reversible, to confirm at review:

- **Sliding window, not fixed.** 10 s of quiet after the singer's last report, 60 s ceiling. A
  fixed 10 s from the first click splits an ordinary run of taps into two pushes.
- **Team e-mail default becomes ON** — the displayed default then matches what already happens
  (the daily digest). The digest switch becomes the *shape* of that e-mail: daily or per event.
- **Absence request is WARNING when its first rehearsal starts within 48 h**, INFO otherwise.
- **Examples in the modal are composed on the server** from `message_content.py`, with the outcome
  taken from the same function the router uses. Frontend copies of notification text would drift
  and lie the way the ledger did.
- **Tap-to-read goes through the panel** (`?n=<ids>` on the opened URL), not a fetch from the
  service worker, so it needs no CSRF or token refresh inside the worker.

## Stage 1 — Delivery model (backend)

Files: `notifications/delivery.py`, `notifications/router.py`, `notifications/message_content.py`,
`roster/services.py`, `core/models.py`, new data migration `notifications/0024`, `core` AlterField
migration (help text), `notifications/tests.py`, `roster/tests.py`.

1. **One decision function.** In `delivery.py`, a pure `plan_delivery(...)` returning a frozen
   `ChannelPlan` with an outcome per channel:
   - e-mail: `NOW` / `DIGEST` / `OFF` / `NEVER` (in-app-only types);
   - push: `NOW` / `OFF` / `NEVER`.

   Inputs: type, level, the effective preference (row or `default_channel_preferences`),
   `digest_enabled`. The router acts on it and nothing else decides. Stage 3's preview adds what
   only a read can know (active devices, `email_notifications_enabled`, `email_undeliverable`),
   through the same predicates the dispatchers use. Extract those predicates if they are inline.
2. **Router.** The digest check moves into the e-mail branch: held for the digest means no
   real-time e-mail, push untouched. `_needs_email_reserve` loses its `is_digestible` clause, which
   becomes unreachable once team e-mail defaults ON. Update the docstrings, which describe the old
   rule.
3. **Team e-mail default ON.** `PreferenceGroup(id="team", email=True)`. Data migration `0024`,
   following the `0014` pattern: delete team-type rows equal to the old default on every channel
   (`email_enabled=False, push_enabled=True`) **only for users with `digest_enabled=True`**. A
   digest-off user's row stays, otherwise they would start receiving one e-mail per singer. Reverse
   is a no-op. The digest sweep keeps its rule (exclude types whose row has e-mail off).
4. **Absence urgency.** Both emitters pass `level=WARNING` when the first rehearsal concerned
   starts within `ABSENCE_URGENT_WITHIN = timedelta(hours=48)` of now, INFO otherwise. WARNING is
   not digestible, so it arrives by e-mail at once if team e-mail is on. The sweep already reads
   only INFO rows.
5. **Tag.** `absence-requested:{rehearsal_id}:{artist_id}`.
6. **`digest_enabled`** help text and comment in `core/models.py` state e-mail only
   (`makemigrations core`).

Tests: flip `test_digestible_info_is_held_back` (push called, e-mail held),
`test_digest_disabled_restores_immediate_delivery` (e-mail now called, default ON), a WARNING
absence inside 48 h reaching e-mail past the digest, a far absence staying INFO, the migration
keeping digest-off rows.

## Stage 2 — One push per singer's burst

Files: `notifications/services.py`, `notifications/tasks.py`, `notifications/router.py`, new
`notifications/push_fold.py`, `notifications/message_content.py`, `notifications/push_service.py`
(if the builder needs a batch entry point), tests. Pattern to mirror: the material window in
`roster/listeners.py` + `roster/tasks.py` (gate only via `cache.add`).

- **Scope.** `ATTENDANCE_SUBMITTED` and single-rehearsal `ABSENCE_REQUESTED` (no span metadata).
  A span is already one message per production and pushes directly. `PARTICIPATION_RESPONSE` is
  not folded.
- **Only push folds.** In-app rows stay one per event: the bell is the record. E-mail and the
  digest are untouched.
- **Thread the notification id.** `NotificationService.create_notification` →
  `route_notification_task` → `NotificationRouter.route` gain `notification_id`. Stage 4 needs it
  too.
- **Window per (recipient, artist).** On each foldable push the router:
  1. sets `fold:{recipient}:{artist}:{notification_id}` (one key per event, atomic, no list to
     append to);
  2. `cache.add`s the gate holding `opened_at`;
  3. sets `last:{recipient}:{artist}` to this event's stamp;
  4. schedules `flush_push_fold_task(recipient, artist, stamp)` with `countdown=10`.

  Each event schedules its own flush, and a flush never re-schedules itself. Re-scheduling
  recurses under eager Celery.
- **Flush.** Proceed only if `last` still equals its stamp, or `now - opened_at >= 60 s`;
  otherwise return. Then:
  1. delete the gate first (a later report opens a new window);
  2. read this pair's recent rows (types above, `metadata__artist_id`, last 10 min);
  3. keep those whose `fold:` key exists, and delete those keys.

  A report racing the flush is either taken by it (its key then gone, so the next flush finds
  nothing and returns) or left for its own window. Nothing is lost and nothing is pushed twice.
- **Composition.** One row → today's push exactly. Several → a batch composer in
  `message_content.py` (the single source of copy), fed items deduplicated by rehearsal, latest
  status wins:
  - The push type is `ABSENCE_REQUESTED` if any item is an absence, else `ATTENDANCE_SUBMITTED`.
  - Level = highest item. Deep link = absence review if any absence, else rehearsals.
  - Tag `attendance-fold:{artist_id}:{first_notification_id}`, `renotify` on.
  - No e-mail reserve: after Stage 1 no team type is push-first.
  - The payload carries every folded notification id.
- **Copy is gender-neutral in Polish.** A name does not tell the grammatical gender, so no past
  tense ("potwierdziła/potwierdził"); present and future work. Direction:
  - "Anna Kowalska będzie na 5 próbach" · "Pochwała Stworzenia · 3–24 paź · na 1 się spóźni";
  - with an absence, the absence leads: "Prośba o nieobecność — Anna Kowalska" ·
    "czw. 12 paź · na 4 innych próbach będzie".
- **Knobs** via `getattr(settings, ...)`: `ATTENDANCE_PUSH_QUIET_SECONDS = 10`,
  `ATTENDANCE_PUSH_CEILING_SECONDS = 60`.

Tests: two reports in one window → one push naming both; same rehearsal changed within the window
→ only the final status; absence leads; one report → today's payload; flush with a stale stamp
does nothing; racing report not pushed twice. Test the flush directly rather than through eager
countdowns.

## Stage 3 — Settings: honest copy and "What will I get?"

Files: `features/settings/components/NotificationsTab.tsx` (`DigestPanel`, header), new
`features/settings/components/DeliveryPreviewModal.tsx`, settings api/queries, backend
`notifications/views.py` + urls, new `notifications/preview.py`, three frontend locales, backend
`locale` `.po` + `.mo` (samples).

1. **Digest panel becomes the shape of the team e-mail.** Shown only while at least one team type
   has e-mail ON. The switch reads "once a day, in one e-mail" (+ hour); off means each one
   separately, at once. One line says push is unaffected and always immediate.
2. **Copy.** Rewrite every `groups_desc`, `digest.description`, and the `type_desc` of the team and
   requests groups. Each says what triggers it and how it arrives (push at once, a burst folded;
   e-mail daily or at once; absences within 48 h at once). No sentence promises what the code
   does not do. Polish first and native; EN and FR follow.
3. **"Co dostanę?" button** at the top, beside the section description, opens a modal built on
   the existing modal composite, with tabs **Push** and **E-mail**:
   - Each tab lists "You will get" and "You will not get", grouped like the ledger, one example
     per type visible to this user (same filter as the preferences GET, `manager_only` /
     `staff_only`).
   - A push example looks like a phone notification (icon, title, body); an e-mail example is
     subject + lead.
   - Every "not" row names its reason: switched off / in the daily e-mail at HH:00 / no device
     (e-mail stands in, or nothing) / e-mail off for the account / address undeliverable / in-app
     only.
   - The push tab opens with device reach. The folded attendance push appears as its own example.
4. **Source.** `GET /api/notifications/preferences/preview/`. `preview.py` composes each example
   through `message_content.py` with synthetic metadata (samples via gettext) in the reader's
   language, and attaches Stage 1's `ChannelPlan` decorated with device and e-mail-account state.
   The client renders only. The query is invalidated by every preference, digest and device
   mutation.

## Stage 4 — Tray and bell in step; badge where the platform has one

Files: payload type in `message_content.py`/`push_payloads.py`, `push_service.py`,
`frontend/src/sw.ts`, new tray-sync hook in `features/notifications`, `notifications.queries.ts`,
the panel shell that mounts it.

1. The payload carries `notificationIds: string[]` and `unread: number` (recipient's unread count
   at send time).
2. The SW keeps the ids in notification data. A tap opens the URL with `?n=<ids>`. The panel marks
   them read on arrival (a bulk mark-read action if the single one does not fit) and strips the
   param.
3. Reading in the app closes the tray entries whose ids are all read
   (`navigator.serviceWorker.ready` → `registration.getNotifications()`); mark-all closes every
   entry. On Android this is what clears the launcher dot.
4. Badging API, feature-detected: the panel sets `navigator.setAppBadge(unread_count)` from
   `useUnreadNotificationCount` and clears at 0; the SW sets it from `unread` on push. It works on
   an iOS Home Screen app (16.4+) and installed desktop Chrome/Edge, and is a silent no-op on
   Android.

## Verification

- Backend stages: ruff + mypy on `notifications`, `roster`, `core`; tests for those apps with
  `config.test_settings_sqlite`.
- Frontend stages: `npm run typecheck`; `npm run build` at the end of Stages 3 and 4. All three
  locales. Backend `.po` compiled to `.mo` for the samples.
- Prod: `make deploy` applies `notifications/0024` (after the still-pending `0023`) and the `core`
  help-text migration. Restart Celery on dev after Stages 1–2.

## Out of scope

- A new `NotificationType` for the fold. It rides on the two existing types.
- Folding participation responses or absence spans.
- Setting a number on the Android icon. The platform does not allow it.
