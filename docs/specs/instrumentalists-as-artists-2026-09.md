# Instrumentalists as Artists — implementation plan

Status: IMPLEMENTED 2026-09-19 (stages 1–3), uncommitted, not yet verified in the browser. Decisions
confirmed with the developer: existing crew instrumentalists are re-added by hand (no data migration);
rehearsal call is a per-rehearsal flag.

## What shipped, and where it differs from the plan below

- Migration `roster/0050_artist_instrument_rehearsal_calls_instrumentalists_and_more`.
- The rehearsal call rule is now `Rehearsal.called_participations()` / `Rehearsal.calling_q()` plus
  `is_instrumentalist_account()`, and the seven copies were rewritten to call them: `delete_rehearsal`,
  `AnnouncementQueue.recipients_for`, the reminder task, the lead-sheet roll call, the member's
  `RehearsalViewSet` queryset, both `schedule_queries` windows, and the iCal feed. The invitation e-mail
  splits `rehearsals_for_all` from the new `rehearsals_for_choir`.
- `Artist.role_label` (instrument for a player, voice otherwise) is the backend half; the panel's half is
  `shared/lib/voiceTypes.ts` (`isSingingVoiceType`, `isInstrumentalist`, `artistRoleLabel`), read by the
  artist card/row/dossier, the identity card, the welcome, the cast row and the rehearsal pickers.
- `isCalled(session, singer)` on the attendance grid now takes the singer, not their id — a cell has to
  know whether the row is a player.
- Contract PDF branches on `instrument` before `voice_type` (`contract_pdf.html`), so the clause reads
  "partii instrumentalnej (Instrument: Organy)". DTP export gained an "Instrumentaliści" bucket and
  prints the instrument per line.
- **No `QUERY_CACHE_BUSTER` bump**, against the plan: every added field is optional and nothing
  dereferences it, so a restored snapshot in the old shape renders correctly (a cache predating this work
  holds no instrumentalists at all). A bump would discard every persisted snapshot for no gain.
- `artists.validation.*` had no entries in any catalogue — the form was printing raw keys for four
  existing rules. Added alongside `instrument_required` in all three locales.
- Tests: `backend/roster/test_instrumentalist.py` (15), `frontend/src/features/projects/lib/autoCast.test.ts`,
  `frontend/src/features/rehearsals/lib/attendanceStats.test.ts`.
- Verified 2026-09-19: ruff + mypy clean on roster/core/notifications; 1000 backend tests OK;
  frontend typecheck, 220 vitest tests and `npm run build` OK.

## Left for the developer

1. dev: `make up`, then `make migrate` (nothing applies migrations automatically).
2. Browser pass — the checklist is under **Verification** below.
3. Re-add the existing crew instrumentalists as artists by hand (roster → new artist → "Instrumentalista").
4. prod after deploy: `make migrate`.

## Context

Organists and other instrumentalists currently live as `Collaborator` (specialty `INSTRUMENT`) booked via
`CrewAssignment` on the `/crew` tab. Crew deliberately gets no account, no invitations, no scores and no
notifications — "a production note for the conductor". The 2026-08-25 Florent feedback round left "does an
instrumentalist get invites and scores, or stay a note?" open. Decision now: instrumentalists become
**Artists** — account, project invitation, scores, notifications, fee — but are **not called to rehearsals
by default** and are **not part of the S/A/T/B divisi**; they sit on the existing `ACC` casting line.

## Decision: reuse `Artist`, no new model

Rejected: a separate `Instrumentalist` model. Everything the ask needs already hangs off
`Artist` + `Participation` + `User`: activation invites (`backend/roster/invitations.py`), the
INVITED/CONFIRMED/DECLINED flow, `Participation.live_seats` (the one gate for schedule, songbook, scores,
shared markings), notification recipients, project channel membership, call sheet, contract PDF, fees. A
second model duplicates eight subsystems to save one enum value.

Precedent: `VoiceType.CONDUCTOR` (`'DIR'`) is already a non-singing Artist, special-cased in ~6 places.
The instrumentalist follows that shape, and the scattered `!= CONDUCTOR` checks become one predicate.

Divisi (developer left it to me): instrumentalists **do** appear on the per-piece casting board — "organ
plays in the Mass, not in the a cappella motet" is per-piece information, and `VoiceLine.ACCOMPANIMENT`
(`'ACC'`, `backend/core/constants.py:41`) already exists for it. They are excluded only from the S/A/T/B
family logic (autocast families, section balance rail, line-up seat select).

## Model shape

- `VoiceType.INSTRUMENTALIST = 'INS'` — ONE value, not one per instrument (each enum value costs 3 locales
  + 2 sort tables + the salutation map).
- `Artist.instrument = CharField(max_length=60, blank=True)` — human label ("Organy", "Trąbka"). Required
  when `voice_type == INS`, forced blank otherwise (DTO validation, not a DB constraint — matches how
  `sight_reading_skill` is handled).
- `SINGING_VOICE_TYPES: frozenset` in `backend/roster/models.py` next to `VoiceType` + `Artist.is_singer`
  property; frontend mirror `isSingingVoiceType(voiceType)` in `frontend/src/shared/lib/voiceLabels.ts`
  (domain label helpers already live there). Replaces `!= CONDUCTOR` / `!== "DIR"` where the meaning is
  "is a singer" (balance rail, form field visibility). The call-sheet `!= CONDUCTOR` at
  `document_generator.py:614` STAYS a conductor check — instrumentalists belong on the call sheet.
- `Rehearsal.calls_instrumentalists = BooleanField(default=False)`. A tutti rehearsal (empty
  `invited_participations`) calls every live seat EXCEPT instrumentalists unless this is set; an explicit
  `invited_participations` list always wins (an instrumentalist listed on a sectional is called). The
  dress rehearsal ticks the box. Conductors are unaffected — the exclusion is `voice_type == INS`, not
  `not is_singer`.
- One migration in `roster/` via `makemigrations`: AddField ×2 + AlterField choices.

## Stage 1 — backend model, validation, documents

Files: `backend/roster/models.py`, `backend/roster/dtos.py`, `backend/roster/serializers.py`,
`backend/roster/cast_order.py`, `backend/roster/infrastructure/document_generator.py`,
`backend/templates/contracts/contract_pdf.html`, `backend/locale/{pl,en,fr}/LC_MESSAGES/django.po`.

- `models.py:57-65` add `INSTRUMENTALIST`; add `SINGING_VOICE_TYPES`; `Artist.instrument` after
  `voice_type` (`:96`); `Artist.is_singer`; `Rehearsal.calls_instrumentalists` after `is_mandatory`
  (`:798`). Comments state intent (why one value, why the flag lives on the rehearsal).
- `dtos.py:119-140` artist create/update DTOs: `instrument` field; validator "required iff INS, blank
  otherwise". `VOICE_TYPE_VALUES` (`:29`) picks the new value up automatically.
- `serializers.py`: `instrument` into the explicit manager field list (`:52,81,133` area) and into every
  nested artist payload the panel reads — participation artist, cast snapshot `get_cast` (`:287-300`),
  roll-call rows (`views.py:2048-2058`), roster action (`views.py:667-674`). `RehearsalSerializer`
  (`:385`) gains `calls_instrumentalists`; `RehearsalCreateDTO`/`RehearsalUpdateDTO` too
  (`services.py:1512,1560`).
- `core/serializers.py:130-168` (own profile): pass `instrument` through so the member's identity card can
  show it.
- `cast_order.py:37-46`: `INSTRUMENTALIST: 7`, `CONDUCTOR: 8` (instruments print after the choir).
- `document_generator.py`: `_group_participations_by_voice` (`:1595-1625`) — rows for INS print the
  instrument after the name; DTP export buckets (`:536-549`) get an "Instrumentaliści" bucket instead of
  falling into 'Inne'; `section_mates` (`:1020-1031`) skipped for non-singers.
- Contract: `document_generator.py:467-469` + `contract_pdf.html:225-226` — INS reads "wykonania partii
  instrumentalnej (Instrument: Organy)" instead of "partii wokalnej (Głos: …)". Legal text → three
  `django.po` entries. "Instrumentalist" → "Instrumentalista" already exists in `pl/django.po:1568`.
- Announcement diff whitelist: check `backend/notifications/announcement_queue.py` field-diff whitelist
  for REHEARSAL — `calls_instrumentalists` must either be whitelisted with a human label or excluded, never
  leak as `str()` (see memory `reference_notification_change_diff_leak`).
- `Project.conductor` `limit_choices_to` (`models.py:213`) unchanged.

## Stage 2 — backend: ONE rehearsal call rule

The "invited list, else whole cast" rule is copied in 7 backend places. Introduce two helpers on
`Rehearsal` and route every copy through them (same remedy `Participation.live_seats` applied):

- `Rehearsal.called_participations(self) -> QuerySet[Participation]` — recipient side: invited rows if
  any, else project's live participations minus INS unless `calls_instrumentalists`. Callers:
  `services.py:1621-1623` (delete_rehearsal), `notifications/announcement_queue.py:533` (recipients_for),
  `roster/tasks.py:172` (reminder), `views.py:2048-2058` (roll-call `standing_cast`),
  `document_generator.py:1554-1559` (rehearsal sheet header — `is_whole_ensemble` stays "no explicit
  list").
- `Rehearsal.calling_q(seat_ids, *, instrumentalist: bool) -> Q` — artist side: `Q(invited__in=seats) |
  (Q(invited__isnull=True) [& Q(calls_instrumentalists=True) if instrumentalist])`. Callers:
  `views.py:1995-1998` (RehearsalViewSet non-manager), `queries/schedule_queries.py:62,162` (absence
  range / self-report window), `core/ical_service.py:135-136` (feed), `invitations.py:87-110`
  (`rehearsals_for_all` must not list a tutti to an instrumentalist it does not call).
- `record_attendance` (`services.py:1666-1692`) needs no gate: roll-call never offers a row for someone
  not called, and the range writer already goes through `schedule_queries`.

## Stage 3 — frontend

Files: `frontend/src/shared/types/index.ts`, `frontend/src/shared/lib/voiceLabels.ts`,
`frontend/src/features/projects/lib/{autoCast,voiceFamilies}.ts`,
`frontend/src/features/projects/editors/hooks/{useCastTab,useRehearsalsTab}.ts`,
`frontend/src/features/rehearsals/lib/attendanceStats.ts`,
`frontend/src/features/projects/lib/attendanceMatrix.ts`,
`frontend/src/features/artists/components/ArtistEditorPanel.tsx`,
`frontend/src/features/artists/{types/artist.dto.ts,hooks/useArtistForm.ts}`,
`frontend/src/features/crew/constants/crewSpecialties.ts`, locales ×3, `i18n-static-keys.ts`.

- Types: `VoiceType` union (`shared/types/index.ts:26-33`) += `"INS"`; `Artist` type += `instrument:
  string`; `Rehearsal` type += `calls_instrumentalists`. Bump the query persister buster (memory
  `reference_query_cache_buster`: DTO change = bump).
- `shared/lib/voiceLabels.ts`: `isSingingVoiceType()` and `artistRoleLabel(t, voiceType, instrument)` →
  instrument when INS and non-empty, else `t("dashboard.layout.roles.<vt>")`. Apply where a PERSON's role
  is printed: `features/artists/components/{ArtistCard,ArtistRow,ArtistDossier}.tsx`, CastTab row,
  `MicroCastingTab.tsx:296-307` pool rows, attendance matrix rows, `SettingsIdentityCard.tsx:56`,
  `WelcomeMoment.tsx:169`. Group headers keep the generic "Instrumentaliści".
- `voiceFamilies.ts:49-58` `VOICE_TYPE_ORDER`: `"INS"` before `"DIR"`.
- Autocast `autoCast.ts:106-126` `resolveAutoSeat`: for a non-singing voice type return
  `INS && lines.includes("ACC") ? "ACC" : null` BEFORE the TUTTI fallback — today an unmapped type falls
  onto TUTTI, which would print a sung part for the organist. Comment states the rule.
- `useCastTab.ts:306-328` balance rail: `!== "DIR"` → `isSingingVoiceType`; `:336-344` seat select hidden
  for INS (`default_voice_line` stays blank; blank already means "derived from voice type").
- Rehearsal call rule, one client helper: extend `resolveInvited` (`attendanceStats.ts:64-72`) to apply
  the flag and make it the only reader — `attendanceMatrix.ts:110-153` `buildRoster` + `isCalled`
  (`:192-195`) and `useRehearsalsTab.ts:280-303` `resolveCalledParticipations` call it. Rehearsal editor
  (`RehearsalsTab.tsx`): checkbox "Wezwij instrumentalistów", shown only when the project has an INS
  participation, sent as `calls_instrumentalists`. `attendanceMeta.tsx:142-172` already files unknown
  types under `OTHER`; label that bucket "Instrumentaliści / inni" or keep — verify the Record type
  compiles with the new union member.
- Artist form `ArtistEditorPanel.tsx`: `instrument` Input rendered when `voice_type === "INS"`;
  `vocal_range_*` (`:381-412`) and `sight_reading_skill` (`:414-427`) rendered only for singers (fixes the
  same wart for DIR in passing). Zod (`artist.dto.ts:12-25`): `instrument` required iff INS.
  `voiceToSalutation` (`:34-38`) already yields "N" for unknown types.
- Crew: `crewSpecialties.ts:72-80` INSTRUMENT stays (tuners, instrument transport) but its description
  copy changes to say a playing musician gets an Artist card — three locales
  (`dashboard.layout.specialty_descriptions.INSTRUMENT`). No picker surgery, no data migration
  (developer re-adds the 1–3 existing instrumentalists by hand).
- Locales pl/en/fr: `dashboard.layout.roles.INS` ("Instrumentalista" / "Instrumentalist" /
  "Instrumentiste"), artist form label + placeholder, rehearsal checkbox label + hint, crew description.
  Mirror in `i18n-static-keys.ts`. `voice_types.*` (`pl:5166`) is singer-only by design — leave it.
- Accepted as-is: `useAdminDashboardData.ts:137-162` counts INS only in the total, like DIR.

## Out of scope

- Migrating existing `Collaborator(INSTRUMENT)` rows — manual (decided).
- Seed data (`seed_db.py`) — optional one organist if cheap.
- Per-(rehearsal, participation) call lists — the flag covers "the organist comes to the generalna";
  "this trumpeter never, that organist always" is handled by marking EXCUSED.

## Verification (once, end of stage 3)

- Backend: `& .venv\Scripts\python.exe -m ruff check backend\roster backend\notifications backend\core`
  and mypy on the same; `& .venv\Scripts\python.exe backend\manage.py test roster
  --settings=config.test_settings_sqlite`. New `backend/roster/test_instrumentalist.py`: DTO
  instrument-iff-INS; tutti rehearsal excludes INS from `called_participations` and from the INS user's
  `RehearsalViewSet` list / schedule window until the flag is set; INS listed on a sectional is called;
  contract PDF text for INS (pattern: `test_contract_document.py`); call sheet grouping.
- Frontend: `npm run typecheck`, `npm run build`; extend the autoCast vitest suite if one exists
  (`resolveAutoSeat`: INS → ACC when declared, never TUTTI) and `resolveInvited` with the flag.
- Developer, in the browser (dev, `make up` + `make migrate`): create an INS artist → invite to a project →
  tutti rehearsal: absent from roll-call and from the artist's schedule; tick the flag: present; "Uzupełnij
  utwór" on a piece declaring ACC seats them on ACC, on a piece without ACC leaves them unseated; contract
  and call sheet name the instrument.

## After implementation

- Write `.agent/memory/project_instrumentalists_2026-09.md` (decision, ACC, flag, crew INSTRUMENT kept
  for tuners, manual migration) + one `MEMORY.md` line; update `project_florent_feedback_2026-08.md`
  "Otwarte" paragraph to point at it.
- prod: `make migrate` is manual after deploy.
