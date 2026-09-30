# Notification copy audit — the bell speaks in sentences

Status: **Stages 1–4 implemented 2026-09-30** (records under each). Left: the developer's look at
the bell and the pushes, a native read of the FR copy, and the two open points in Stage 4's record.

Written 2026-09-30 from a manager's bell full of rows like `Piotr Jewuła / Pochwała Stworzenia ·
środa, 7 października o 18:14 / się spóźni`. Scope: every in-app surface that speaks for a
notification (bell rows in `NotificationItem.tsx`, the invitation toast, the assistant briefing
modal), the manager digest e-mail, and the push/e-mail defects found on the way. The engine
(`NotificationService` → router → `message_content.py`) is not in question and is not touched.
**Coverage** at the end lists all 29 `NotificationType`s and where each one is handled.

## Diagnosis

1. **The bell row is a sentence cut into lines.** `describe()` returns `title` (a name or a
   project), `context` (project · date) and `detail` (a lowercase verb tail: `się spóźni`,
   `zaprasza: X`, `czeka na Twój podpis`, `nieobecność usprawiedliwiona`). The tail was written to
   continue the bold name, but it renders two lines lower in another weight, so it reads as a
   fragment. `się spóźni` on its own is not even grammatical Polish (a clitic cannot open a clause).
   EN is worse: `confirmed`, `invited`, `excused`, `no longer cast`, `you’ve been removed`.
2. **The bold line is the same on every row.** The title is the project or the person, so a
   manager's bell reads `Pochwała Stworzenia` or `Piotr Jewuła` in bold five times over. The
   emphasis lands on the one thing that does not distinguish the rows.
3. **The bell is the poorer of two authors.** It composes its own copy from metadata (by design: it
   re-humanises dates on every render and follows the UI language), but it drops data it already
   receives:
   - `minutes_late` — push says `spóźni się ok. 15 min`, the bell says `się spóźni`;
   - `excuse_note` — in the e-mail, absent from the bell, and it is what a manager decides on;
   - `previous_status` — nobody reads it, so a singer **withdrawing after confirming** (CON→DEC)
     reads exactly like a first decline (INV→DEC); only the first means recasting;
   - `rehearsal_count` / `ends_at` — an absence over a span of 5 rehearsals shows only its first date.
4. **Nothing names the kind of event.** Rehearsal vs concert is inferred from the eyebrow and one
   verb (`potwierdza obecność` vs `potwierdza udział`). RSVP metadata carries neither the event's
   date nor its kind; `event_kind` exists only on briefing and reminder payloads. Singers read the
   internal word `projekt` (`Projekt odwołany`, `Aktualizacja projektu`).
5. **Rows outlive their truth.** `ANNOUNCEMENT_PENDING` re-nudges per fuse and every nudge is a new
   row; none is superseded or resolved when the queue is sent, so the bell keeps saying
   `15 osób jeszcze o tym nie wie` after they were told. `od 13 godzin` is frozen at emission.
   A singer reporting five rehearsals gives the manager five rows; push folds them, the bell does not.
6. **Gender hacks.** `mianował(a)`, `napisał(a)`, `Mianował(a) {{name}}`, and an eyebrow that
   genders the reader (`Jesteś asystentem dyrygenta`).
7. **Messages.** Every message in a thread is its own bell row, and reading the thread does not
   mark it read (nothing links `ThreadReadState` to `Notification.is_read`), so a conversation
   is counted twice — in the messages badge and in the bell. An unassigned singer's thread goes to
   every manager. The admin-message row never says who wrote it (push and toast do).
8. **Change chips.** The bell has no label for `duration` and `event_kind`, and localises only
   `voice_line` and `gives_pitch` values, where the backend's `_change_value` also localises
   `status`, `event_kind` and `duration`. The bell shows `duration: 90 → 120`,
   `event kind: CONCERT → MASS`, `Status: ACTIVE → DONE`.
9. **Plan start.** Invitation and reminder payloads carry the plan start (a trip's departure,
   `plan_start_*`), and push/e-mail show it (`Wyjazd — sob. 10.10, 14:00`). The bell's DTO has no
   such field, so a trip reminder in the bell names the concert hour, not the departure.
10. **The manager digest e-mail** (`_digest_detail`, `notifications/tasks.py`) repeats the bell's
   fragments for the same three types: no minutes, no rehearsal date on an attendance report, and
   `rehearsal_date or excuse_note` drops the note whenever a date exists.

## Rules for the new copy

- **Row anatomy.** Eyebrow (category) · **sentence** · context line · optional quote · chips.
  - `sentence`: one full sentence, capital letter, full stop. When there is an actor, the row
    renders `<actor semibold> <rest regular>` on one line; `rest` is the key's text and starts
    lowercase because it continues the name. No actor → the whole sentence is semibold.
    No `Trans`: the actor always leads in pl/en/fr, so `actor` + `rest` are two fields.
  - `context` (muted): the things the sentence did not say — project (plain, no quotes), place,
    the event's own date when the sentence does not carry it.
  - `quote`: user-authored text only (excuse note, focus, conductor's note, excerpt), in the
    locale's quotation marks, clamp 2. A focus is labelled (`Temat: …`), as push already does.
  - Chips and briefing bullets unchanged.
- **Narrative present or future, never past.** A name does not tell the grammatical gender
  (`będzie`, `spóźni się`, `prosi`, `powierza`, `przesyła`). `UserProfile.salutation` stays for
  greetings only. FR has the same trap in adjectives: `sera là`, not `sera présent(e)`.
- **Titles never in an inflected slot.** A head noun carries the case, the title stays nominative in
  quotes: `w koncercie „X”`, `w utworze „X”` (see memory `reference_polish_interpolation_dates`).
- **The event is named by its kind** (`Project.event_kind`: CONCERT / MASS / WEDDING / OTHER), via
  i18next `context` (`key_CONCERT`, `key_MASS`, …). Missing kind reads as CONCERT, the convention
  `_event_moment_label` already follows for legacy rows. Only sentences that name the event need it.
- **Full name, never first name alone** — a choir has several Piotrs.
- **The operating system decides what a lock screen shows, not the app.** iOS (Show Previews),
  Android (sensitive content on the lock screen) and desktop systems let each person hide
  notification content, and the app does not decide it again on their behalf. A push body carries
  the words a person wrote for its reader: the message, the admin message, the channel post, the
  excuse note, the conductor's note. The web push payload is encrypted end to end (RFC 8291), so
  the push service reads none of it. The old "lock-screen safe" rule was not even consistent: the
  e-mail carried the full text and the briefing push already carried the conductor's note.
- **Moments inside a sentence** use a new `formatEventPhrase()` beside `formatEventMoment()` in
  `notificationFormat.ts`, recomputed on every render like its sibling:

  | distance (event's own timezone) | PL | EN |
  |---|---|---|
  | today / tomorrow / yesterday | `dziś o 18:15` / `jutro o 18:15` / `wczoraj o 18:15` | `today at 18:15` … |
  | 2–6 days ahead | `w środę o 18:15` | `on Wednesday at 18:15` |
  | otherwise, same year | `w środę 14 października o 18:15` | `on Wednesday, 14 October at 18:15` |
  | other year | `… 14 października 2027 o 18:15` | `… 14 October 2027 at 18:15` |

  The preposition inflects with the weekday (`we wtorek`, `w środę`, `w niedzielę`), so each locale
  gets a 7-entry table `notifications.time.on_weekday.{0..6}` (0 = Sunday; FR is the bare weekday:
  `mercredi à 18:15`). Weekday index from the event-zone `dayKey` (`getUTCDay()` of
  `YYYY-MM-DDT00:00:00Z`). No `najbliższą` (redundant with a bare weekday, ambiguous on the day
  itself) and no `za 2 tygodnie` (fuzzy, needs arithmetic; the date is shorter and exact). Push and
  e-mail keep their current humaniser: they are frozen at send time, so a bare weekday would rot.
- **Spans** (absence over several rehearsals): `Intl.DateTimeFormat#formatRange` with
  `{ day: "numeric", month: "long" }` → `7–18 października`.

## Row by row (PL reference; EN/FR carry the same meaning, gender-neutral)

`{when}` = `formatEventPhrase`. **Bold** = actor. Types not listed keep their current row.

### Manager-facing

| Type / case | Sentence | Context · quote |
|---|---|---|
| ATTENDANCE_SUBMITTED PRESENT | **{name}** będzie na próbie {when}. | project |
| … LATE with minutes | **{name}** spóźni się ok. {n} minut na próbę {when}. (`_one/_few/_many`: minutę / minuty / minut) | project |
| … LATE without minutes | **{name}** spóźni się na próbę {when}. | project |
| ABSENCE_REQUESTED, one evening | **{name}** prosi o zwolnienie z próby {when}. | project · quote: excuse note |
| … span | **{name}** prosi o zwolnienie z {n} prób: {range}. | project · quote: excuse note |
| PARTICIPATION_RESPONSE INV→CON | **{name}** potwierdza udział w koncercie „{project}”. | event date · place |
| … INV→DEC | **{name}** nie weźmie udziału w koncercie „{project}”. | event date |
| … CON→DEC | **{name}** wycofuje się z udziału w koncercie „{project}”. | event date |
| … DEC→CON | **{name}** jednak weźmie udział w koncercie „{project}”. | event date |
| ANNOUNCEMENT_PENDING | {n} zmiany w koncercie „{project}” czekają na wysłanie od {duration}. | detail: `15 osób jeszcze o nich nie wie.` |
| SITE_COPY_PROPOSED | **{name}** proponuje {n} zmiany w tekstach strony. | page(s), as today |
| REHEARSAL_DEBRIEF_POSTED | **{name}** przesyła podsumowanie próby z {date}. | project · quote: excerpt |
| NOTIFICATION_READ_RECEIPT | **{name}** potwierdza odczytanie wiadomości „{title}”. | — |

- ABSENCE_REQUESTED carries `status` ABSENT or EXCUSED. Before wording them, read what the singer's
  own attendance control calls each option; if ABSENT is "I won't come" rather than a request, it
  reads **{name}** nie przyjdzie na próbę {when}. The manager's sentence must match the button the
  singer pressed.
- `{duration}` for the queue is live: `now − (created_at − waiting_hours)`, hours under 48, then days
  (the backend `_waiting_phrase` rule). Every counted phrase (`zmiany`, `osób`, `prób`, `minut`)
  takes the i18next plural suffixes, as the existing `announcement_pending_*` keys do.
- EN reference: `Anna Kowalska will be about 15 minutes late for the rehearsal on Wednesday at
  18:15.` · `… is taking part in the concert “X”.` · `… can’t take part …` · `… has withdrawn from
  the concert “X”.` · `… asks to be excused from the rehearsal on Wednesday at 18:15.`

### Singer-facing

| Type / case | Sentence | Context · quote |
|---|---|---|
| PROJECT_INVITATION | **{inviter}** zaprasza Cię do śpiewania w koncercie „{project}”. (no inviter: `Zaproszenie do śpiewania w koncercie „{project}”.`) | event date · place · detail: plan start |
| PROJECT_UPDATED | Zmiany w koncercie „{project}”: | chips |
| … removed | Nie śpiewasz już w koncercie „{project}”. | — |
| PROJECT_BRIEFING | Co nowego w koncercie „{project}” — {n} zmiany: | bullets · quote: note |
| PROJECT_CANCELLED | Koncert „{project}” się nie odbędzie. (verb without agreement, so one form per kind noun) | event date |
| PROJECT_REMINDER | Koncert „{project}” już {when}. | place · detail: plan start |
| REHEARSAL_SCHEDULED | Nowa próba {when}. | project · place · quote: `Temat: …` |
| REHEARSAL_UPDATED, date moved | Próba przeniesiona — teraz {when}. | project · place · chips |
| … plan only | Plan próby {when} jest gotowy. / revised: Zmieniony plan próby {when}. | project |
| … other | Zmiany w próbie {when}: | project · chips |
| REHEARSAL_CANCELLED | Próba {when} jest odwołana — nie musisz przychodzić. | project |
| REHEARSAL_REMINDER | Próba {when}. | project · place · detail: the reader's part (`planWindowLabel`, unchanged) · quote: `Temat: …` |
| REHEARSAL_DELEGATED | **{by}** powierza Ci rolę asystenta dyrygenta w koncercie „{project}”. | scope chips · quote: note |
| REHEARSAL_DELEGATION_ENDED | Twoja rola asystenta dyrygenta w koncercie „{project}” dobiegła końca. | — |
| REHEARSAL_LEAD_ASSIGNED | Prowadzisz próbę {when}. | project · place · section chips |
| PIECE_CASTING_ASSIGNED | Śpiewasz partię {voice} w utworze „{piece}”. (the pill goes: the voice is in the sentence) | project · event date |
| PIECE_CASTING_UPDATED | Zmiana Twojej partii w utworze „{piece}”: / solos: Zmiany w Twoich solówkach w utworze „{piece}”: | project · chips |
| … removed | Nie śpiewasz już w utworze „{piece}”. | project |
| MATERIAL_UPLOADED | Nowe nuty utworu „{piece}”. / Nowe nagranie utworu „{piece}”. / no kind: Nowe materiały do utworu „{piece}”. | composer |
| ABSENCE_APPROVED | Masz zwolnienie z próby {when} — nie musisz przychodzić. / span: Masz zwolnienie z {n} prób: {range}. | project |
| ABSENCE_REJECTED | Twoja prośba o zwolnienie z próby {when} nie została przyjęta — liczymy na Ciebie. / span analogous | project |
| CONTRACT_ISSUED | Umowa za udział w koncercie „{project}” czeka na Twój podpis. | — |

**Plan start** (invitation, reminder): when the payload carries `plan_starts_at`, the row gets a
detail line in the push's shape — `{title} — {moment label} · {plan_start_place}`
(`Wyjazd — sobota, 10 października, 14:00 · parking przy filharmonii`). `{title}` is
`plan_start_title` (the manager's own text, so it never goes into a sentence) or, for a typed
window, `plan_start_window` named through the existing `notifications.changes.<key>` labels —
the backend's `_plan_start_title` rule. Add the fields to the FE DTOs; the shape is
`plan_start_metadata` in `roster/queries/day_plan_queries.py`.

### Messages (both audiences)

| Type | Sentence | Context · quote |
|---|---|---|
| MESSAGE_RECEIVED | **{sender}** pisze w wątku „{subject}”. | quote: snippet |
| CUSTOM_ADMIN_MESSAGE | **{sender}** przesyła wiadomość „{title}”. | quote: message, clamp 3 |
| CHANNEL_MESSAGE | unchanged: push-only, no bell row is created in production (only `seed_db` writes them); the `describe()` case stays as a fallback | — |
| SYSTEM_ALERT | unchanged: no emitter | — |

Push, per the lock-screen rule above (Stage 4):

| Type | Push title | Push body |
|---|---|---|
| MESSAGE_RECEIVED | `{sender} — {subject}` | the message text (the `snippet`, already 200 chars; `_MAX_BODY_LEN` cuts the rest) |
| CUSTOM_ADMIN_MESSAGE | `{sender} — {title}` | the message text |
| CHANNEL_MESSAGE | the project (the channel) | `{sender}: {snippet}` — a name before a colon is the chat convention and is grammatical in every locale; no snippet → today's `Nowy wpis na kanale — {sender}.` |
| ABSENCE_REQUESTED | unchanged | today's facts, then the excuse note in quotes |
| REHEARSAL_DELEGATED | unchanged | today's sentence (reworded per Stage 4), then the note in quotes |

The metadata already carries every one of these texts, so no emitter changes. The three
composers' docstrings and comments that say "lock-screen safe" state the new intent.

### Eyebrows (category, not a repeat of the sentence)

PL changes only: PROJECT_UPDATED and PROJECT_BRIEFING → `Zmiany`; PROJECT_CANCELLED and
REHEARSAL_CANCELLED → `Odwołanie` (the crimson accent stays); REHEARSAL_SCHEDULED /
REHEARSAL_UPDATED → `Próba`; REHEARSAL_DELEGATED / _DELEGATION_ENDED / _LEAD_ASSIGNED →
`Asystent dyrygenta`; REHEARSAL_DEBRIEF_POSTED → `Po próbie`; ABSENCE_* → `Nieobecność`;
MATERIAL_UPLOADED → `Materiały`. EN/FR follow the same map.

### Change chips

- Add FE labels for `duration` and `event_kind` in all three locales, and localise their values in
  `renderChange` the way `_change_value` does: `status` through the project-status labels,
  `event_kind` through the event-kind labels, `duration` as `2 h 30 min`.
- **Verify before relying on it:** `_format_change_value` (`roster/services.py`) `strftime`s the
  `date_time` / `call_time` values as read from the model, which Django returns in UTC. Write the
  test first: a project at 19:00 Europe/Warsaw moved to 20:00 must diff as `… 19:00 → … 20:00`. If
  it reads 17:00, localise to the event's timezone before formatting — the chip is wrong in push,
  e-mail and bell alike.

### Other in-app surfaces

- `ProjectInvitationToasts`: `invitation_toast.title` `Nowe zaproszenie do projektu` names the
  event kind (`Zaproszenie do śpiewania w koncercie`); `invites` `Zaprasza: {{name}}` →
  `Zaprasza Cię {{name}}`.
- `DelegationBriefingModal`: eyebrow → `Asystent dyrygenta`; `asked_by_lede`
  `{{name}} mianował(a) Cię asystentem dyrygenta w tym projekcie.` →
  `{{name}} powierza Ci rolę asystenta dyrygenta w tym projekcie.`; `asked_lede` →
  `Od teraz masz rolę asystenta dyrygenta w tym projekcie.` The bell row no longer reads
  `delegation.asked_by` once it carries the actor; delete it after grepping for other readers.
- `CustomAdminMessageToast` (`Od: {{name}}`) is fine as it is.

### Manager digest e-mail

`_digest_detail` (`notifications/tasks.py`) renders each row as the push headline does, not as a
bare status phrase: `spóźni się ok. 15 min` with the minutes, the rehearsal's moment on attendance
rows, and the excuse note beside the date rather than instead of it (`rehearsal_date or
excuse_note` today). Same three types, same wording as the bell's manager rows.

## Stages

**Stage 1 — manager rows (what the screenshot shows).** Frontend: `formatEventPhrase` +
`on_weekday` tables; `RowContent` gains `actor`, `sentence`, `quote`; `NotificationItem` renders the
new anatomy with the typography primitives; manager rows and eyebrows as above. Backend:
`update_status_by_artist` (`roster/services.py`) fills `starts_at` / `timezone` from the project and
a new `event_kind` on `ManagerActionMetadata` (+ the FE DTO). Files: `NotificationItem.tsx`,
`notificationFormat.ts` (+ a new `notificationFormat.test.ts`: today/tomorrow/yesterday, +2…+6
bare weekday, +7 full date, other year, `we wtorek`, an event at 00:30 Warsaw that is the previous
day in UTC), `notifications.dto.ts`, `backend/notifications/dtos.py`, `roster/services.py`, the
three `translation.json`. Delete the stubs this replaces (`notifications.status.*`,
`notifications.inapp.*` tails) only after grepping every reader of those keys outside the bell.
Also in this stage, because they are factual misses rather than wording: the manager digest rows
(`notifications/tasks.py`), and the plan-start line on the invitation and reminder rows — the
first concert trip is on 10.10, and its bell reminder would otherwise name the concert hour.

*Done 2026-09-30, and where it differs from the text above:*
- The singer's control sends only ABSENT ("Nie będę obecny"; EXCUSED is masked to it), so
  ABSENCE_REQUESTED reads **{name}** nie przyjdzie na próbę {when}. EXCUSED, on legacy rows only,
  reads prosi o zwolnienie.
- `ANNOUNCEMENT_PENDING` gained `event_kind` too, so its sentence names the Mass as a Mass.
- The RSVP context is the event date only: `ManagerActionMetadata` carries no venue, and a
  manager answering for their own production does not need it.
- A legacy row without an ISO moment keeps its sentence without `{when}`; the context line carries
  the stored date.
- Eyebrows changed only on the manager rows (ABSENCE_REQUESTED → `Nieobecność`,
  REHEARSAL_DEBRIEF_POSTED → `Po próbie`). ABSENCE_APPROVED / _REJECTED keep theirs until Stage 2:
  the rejected row has no sentence yet, so its eyebrow is still what states the verdict.
- The digest row is the push headline in bold (`Ada Nowak spóźni się ok. 15 min`), the project
  beside it, and `Próba — {when} · „note”` under it; a span is its dates and its count.
- Taken from Stage 4 because the digest and the push share the helper: the PARTICIPATION_RESPONSE
  push title reads `previous_status` (CON→DEC `wycofuje się z udziału`, DEC→CON `jednak weźmie
  udział`), and PL `declined the invitation` is now `nie weźmie udziału`. Stage 4 keeps the body.
- Deleted: `notifications.status.*`, `inapp.absence_requested`, `inapp.read_receipt`,
  `inapp.announcement_pending_*`, `inapp.site_copy_changes_*`. The other `inapp.*` keys belong to
  Stage 2's singer rows; `casting_removed` is also read by `briefingItemSummary`.

**Stage 2 — singer rows.** Add `event_kind` to the payloads that name the project and lack it:
invitation, project updated/removed, project cancelled, contract issued, delegation, delegation
ended (grep each emitter; `ProjectBriefingMetadata` and the reminder already carry it). Then the
singer table, the message rows, the change chips (the UTC test first) and the other in-app
surfaces above.

*Done 2026-09-30, and where it differs from the text above:*
- The UTC test failed as feared: a concert moved 19:00 → 20:00 in Warsaw diffed as
  `17:00 → 18:00` in push, e-mail and bell. `_change` now takes the event's zone before and after
  the save (`old_zone` / `new_zone`), for projects and rehearsals alike. The rehearsal test also
  showed that `update_rehearsal` never saved a new venue or zone (the apply loop skipped both
  before `setattr`) while announcing the move; fixed in the same place.
- `CONTRACT_ISSUED` has no production emitter (only `seed_db`), so its `event_kind` is carried by
  the DTO and the seed. `PROJECT_CANCELLED` also gained the event moment, so its context line can
  name the date to free; the push does not read it.
- Worded for players too, since instrumentalists are cast: `zaprasza Cię do udziału w…` (not
  `do śpiewania`), `Nie jesteś już w obsadzie koncertu „X”.`, `Twoja partia w utworze „X”:
  Sopran 1.` (not `Śpiewasz partię…`: nobody sings `Akompaniament`), `Nie masz już partii w
  utworze „X”.` The toast title follows: `Zaproszenie do udziału w koncercie`.
- No future-tense or `już` in rows that outlive their evening: the reminder reads `Koncert „X”
  jutro o 19:00.` and a moved rehearsal `Nowy termin próby: {when}.` (`teraz jutro`, `odbędzie
  się wczoraj` and `już wczoraj` are what a re-rendered old row would have said).
- ABSENCE_REJECTED says `Nie możemy Cię zwolnić z próby {when} — liczymy na Ciebie.`, matching the
  e-mail: the singer pressed "Nie będę obecny", so there was no request to decline.
- The assistant modal names the event by kind (`w tym koncercie`, `w tej mszy`), not `w tym
  projekcie`. REHEARSAL_LEAD_ASSIGNED keeps the topic as a `Temat:` quote, like the other
  rehearsal rows.
- The pill is gone from every row (voice, solos and material kind are in the sentences).
- Deleted: `inapp.project_removed`, `inapp.absence_approved`, `inapp.invited_by`,
  `inapp.contract_issued`, `delegation.asked_by`, `materialKinds.*`, `briefing.count_*`. Fixed on
  the way: `briefing.more` interpolated `{{n}}` but was given `count`, so it printed `{{n}}`.

**Stage 3 — rows that stop lying.**
- A new `ANNOUNCEMENT_PENDING` for a project marks the older unread ones for that project read;
  publishing or discarding the queue marks them all read (`roster/tasks.py`
  `dispatch_announcement_nudges`, and wherever the queue is published / discarded).
- The bell folds a singer's `ATTENDANCE_SUBMITTED` burst (same `artist_id`, 30-minute window —
  the push fold's window) into one row: **{name}** będzie na {n} próbach, na {k} się spóźni. with
  one bullet per rehearsal. `ABSENCE_REQUESTED` never folds: each one waits for a decision. Opening
  the folded row marks every member read.
- Messages: the bell keeps one row per thread — a newer unread `MESSAGE_RECEIVED` for a thread
  folds the older unread ones under it (`i jeszcze 2 wiadomości`). Reading the thread marks that
  reader's rows for it read: hook it where reading is recorded (`_touch_read_state` in
  `messaging/services.py`), so the bell and the messages badge stop counting one conversation twice.

*Done 2026-09-30, and where it differs from the text above:*
- The push fold's window is not 30 minutes: it is 10 s of quiet with a 60 s ceiling
  (`push_fold.py`), because it holds a push back while it waits. The bell holds nothing back, so it
  keeps the 30 minutes, measured from the burst's newest report (`lib/notificationFold.ts`).
- Folding runs within each read state, and read history folds too: one row per thread in the
  history as well, not only among unread rows. A burst keeps the latest report per rehearsal (as
  the push fold does), lists the evenings in date order, capped at five like the briefing, and
  opens on the first evening. The "Nowe" badge counts notifications, not rows, to match the header
  and the bell badge.
- Opening a folded row reads every member through the push's `opened` endpoint; the FE hook is now
  `useMarkNotificationsOpened`.
- Supersede lives in `NotificationService.mark_resolved`. Any publish that takes rows and any
  discard (whole, partial, or the one a project cancellation runs) reads the project's nudges for
  every manager. `discard_subject` / `discard_recipient` do not.
- Found on the way: a read nudge counted its wait on to now, so `od 13 godzin` kept growing in the
  history after the queue was sent. The wait now stops at `read_at`.
- Thread rows are read only up to the moment of the read, and replying reads them too. Rows written
  before this deploy for threads already read stay unread until clicked or "mark all read".
- Not done, and in no stage: when a manager claims an unassigned thread, the other managers' rows
  for it stay unread and point at a thread they can no longer open (Diagnosis 7).

**Stage 4 — push and e-mail defects** (`message_content.py`, `backend/locale/*/django.po` + `.mo`).
- Replace every `…(a)` form in sentences with narrative present (`powierza Ci`, `przesyła
  podsumowanie`), and every `…(a)` detail label with a gender-free noun phrase (`Mianował(a)` →
  `Nominacja od`, `Napisał(a)` → `Od`); grep `(a)` in the PL catalog and in `pl/translation.json`
  for the rest. Put quotes around every `w projekcie %(project)s`. Some of these msgids may be dead;
  fix the live ones, leave the dead ones to `makemessages`.
- `REHEARSAL_LEAD_ASSIGNED` push title truncates (`… (soprany, al…`): sections move to the body.
- `ATTENDANCE_SUBMITTED` push body names the rehearsal: `Próba — {when} · {project}`.
- `PARTICIPATION_RESPONSE` push: body = event kind + date + project; CON→DEC title
  `{name} wycofuje się z udziału`.
- `ANNOUNCEMENT_PENDING` push title `Obsada jeszcze o tym nie wie` points at nothing:
  `{n} zmiany czekają na wysłanie — {project}`, body `Obsada jeszcze o nich nie wie · od {h}`.
- `ABSENCE_APPROVED`: push title says `usprawiedliwiona`, subject says `zatwierdzona` — one word.
- EN `REHEARSAL_UPDATED` lead `is not where it was` is wrong for a time-only change.
- EN/FR `settings.notifications.types.*` are Django Title Case labels (`Artist Attendance Info`,
  `Assigned to Piece`): rewrite as sentence-case labels matching PL.
- The push shapes in the **Messages** table: message, admin message and channel pushes carry the
  text people wrote; the absence and delegation pushes carry their notes. This replaces the
  `Wiadomość od: %(sender)s` title.

*Done 2026-09-30, and where it differs from the text above:*
- `(a)` and reader-gendering: `powierza Ci rolę asystenta dyrygenta`, `Od teraz masz rolę…`,
  subject `Asystujesz dyrygentowi w projekcie „X”`, `przesyła podsumowanie`; labels `Nominacja
  od`, `Od` (debrief author), `Decyzja` (who revoked a delegation: `Zmiana od` did not read), and
  the admin field labels `Autor podsumowania` / `Nominacja od`. Also `nawet jeśli sam w nim nie
  śpiewasz` (lost `sam`), `nie jesteś menedżerem` → `nie zarządzasz tym projektem`, and FR
  `nommé(e)` / `Vous êtes (désormais, plus) assistant du chef`, rewritten around `le rôle`.
- Quotes on every live `w projekcie`, `projektu`, `w utworze` slot. FR got « » only in strings
  touched anyway.
- REHEARSAL_UPDATED: the push title said `Próba przeniesiona` for a topic-only change too. It
  now says `przeniesiona` only when `date_time` changed (the bell's rule), else `Zmiana próby —
  {when}`. The PL lead's `nowy termin` had the EN lead's fault and was rewritten with it.
- REHEARSAL_DELEGATION_ENDED: the e-mail lead said `Od teraz … asystuje kto inny`, but the
  emitter is a plain revoke. It now says that what the role opened has closed again.
- REHEARSAL_LEAD_ASSIGNED body opens with `Sekcyjna: soprany, alty` (`sectional_call_label`).
- PARTICIPATION_RESPONSE body: `Msza — sobota, 10 października o 19:00 · X`. A legacy row
  without the moment keeps the bare project. ANNOUNCEMENT_PENDING with no count (legacy) keeps
  `Zmiany czekają na ogłoszenie — X` as its title.
- ABSENCE_APPROVED is `usprawiedliwiona` in the push, the subject and the PL settings label.
  Settings: PL `Odpowiedź artysty` → `Odpowiedź na zaproszenie` as well.
- Found on the way: the copy-desk nudge named French in English (`French` existed only under
  `msgctxt "sung language"`). Dead msgids (the old `push_payloads.py` set, replaced titles) stay
  in the catalogs for `makemessages`.
- Open: ABSENCE_REJECTED names one verdict three ways: push and subject `Nieobecność
  niezatwierdzona`, settings `Nieobecność odrzucona`, bell `Nie możemy Cię zwolnić…`. Not
  changed without a decision. Also still open from Stage 3: the 30-minute fold window.

## Verification

Per stage: `npm run typecheck` and `npm run test` in `frontend/`; `npm run build` at the end of
Stage 2. Backend stages: ruff + mypy on `notifications` and `roster`, and their tests with
`config.test_settings_sqlite`; `.mo` recompiled after `.po` edits. The developer checks the bell
visually. FR is agent-written and wants a native read before it counts as done.

## Decided against

- **Server-rendered bell copy** (the bell showing `MessageContent` title/body). One author would
  end the drift, but the bell must re-humanise `jutro` on every render, follow a UI language
  switch, and survive the persisted query cache, and its row has room the push does not. Two
  authors stay; this spec is the bell's reference text.
- **Relative distances** (`najbliższa środa`, `za 2 tygodnie`) — see the moment table.
- **First names only** — ambiguous in a choir.
- **Using `salutation` for third-person verbs** — it is a greeting preference, and most profiles
  are NEUTRAL anyway.
- **Rewording `projekt` across all push and e-mail copy** — the July push rewrite is sound; Stage 4
  fixes defects only.

## Coverage

All 29 `NotificationType`s (`notifications/models.py`), with the stage that touches the bell row:

| Stage | Types |
|---|---|
| 1 | ATTENDANCE_SUBMITTED, ABSENCE_REQUESTED, PARTICIPATION_RESPONSE, ANNOUNCEMENT_PENDING, SITE_COPY_PROPOSED, REHEARSAL_DEBRIEF_POSTED, NOTIFICATION_READ_RECEIPT; plan start on PROJECT_INVITATION and PROJECT_REMINDER |
| 2 | PROJECT_INVITATION, PROJECT_UPDATED, PROJECT_BRIEFING, PROJECT_CANCELLED, PROJECT_REMINDER, REHEARSAL_SCHEDULED, REHEARSAL_UPDATED, REHEARSAL_CANCELLED, REHEARSAL_REMINDER, REHEARSAL_DELEGATED, REHEARSAL_DELEGATION_ENDED, REHEARSAL_LEAD_ASSIGNED, PIECE_CASTING_ASSIGNED, PIECE_CASTING_UPDATED, MATERIAL_UPLOADED, ABSENCE_APPROVED, ABSENCE_REJECTED, CONTRACT_ISSUED, MESSAGE_RECEIVED, CUSTOM_ADMIN_MESSAGE |
| unchanged | CHANNEL_MESSAGE (push-only), SYSTEM_ALERT (no emitter) |

Beyond the row: Stage 1 the manager digest; Stage 2 the chips, the invitation toast and the
assistant modal; Stage 3 attendance and message folding, queue supersede, read-on-open; Stage 4
push/e-mail. Out of scope, as they are not notifications: account e-mails (activation, password
reset), and the push permission primer and nudges.
