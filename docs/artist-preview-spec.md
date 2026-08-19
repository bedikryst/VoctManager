# Artist preview — "What does Kasia see?" — spec

**Status:** stage 1 (backend) **done** 2026-08-19 · stages 2–4 **open**
**Audience of the feature:** the manager and the conductor, answering a question a
chorister asked them. Never the chorister — nothing about this feature is visible
to an artist account.

## How to read this file

`Why` states the defect. `Decisions, settled` is the part you may not re-litigate
without writing a reason down here. `The two lists` is the canon of what is
withheld, in both directions. `Stages` is the work in the order it has to happen.
`Not doing` is the list of things that looked obvious and are wrong.

## Why

The conductor keeps asking what the choristers see. Today the only ways to answer
are guessing, or asking a singer to read their screen aloud. Both are worse than
the data we already hold: the artist surface is five destinations, and its data
spine is three CQRS read-models that already take a `user` argument rather than a
request — `get_artist_schedule(user)`, `get_artist_materials_queryset(user)`,
`EnsembleDirectoryService.get_ensemble(user)`. Answering "what does Kasia see" is
a matter of passing a different argument, not of becoming Kasia.

Two different questions hide inside the ask, and they need different answers:

- **"How does their app look?"** — a UI question, asked once.
- **"Does Kasia already see the score for Sunday?" / "Can they see the fees?"** — a
  data and permission question, asked constantly, per person.

This feature answers the second one, and gets the first for free by rendering the
real artist components.

## Decisions, settled

**1. Targeted read, not impersonation.** The manager never becomes the artist.
`request.user` is never swapped; no session, token or auth state changes. A query
parameter names *whose view is being asked about*, and only read-model endpoints
honour it.

Impersonation was rejected on a hard constraint, not on taste:
`messaging/views.py` documents 1:1 threads as private with "no cross-manager
visibility, and no superuser override". A manager who *becomes* Kasia reads her
correspondence with another manager. Impersonation would also stamp watermarked
scores with the wrong copy-holder name and burn a copy number in `ScoreAccessLog`
([`archive/score_protection.py`](../backend/archive/score_protection.py)), and
would require a read-only gate, a cache/offline purge on both edges of the
session, and an audit trail — all to reach a place this design reaches without
any of them.

**2. A synthetic "demo artist" row was rejected outright.** It would have to be
excluded from attendance counts, section censuses, auto-casting, payments,
contracts, notification recipients, ICS feeds, the score package, GDPR exports
and backups — forever, in every new query anyone writes. It also violates the
identity invariant that an `Artist` is a projection of a real account. And it
would answer with invented data, so it could never reproduce a real report.

**3. The preview is read-only by construction, not by a flag.** `?artist=` is
accepted on GET read-models only. No write endpoint reads it, so there is no code
path by which a preview can produce a write. The frontend still disables the
controls (stage 3) — because the *manager's own* credentials would otherwise
succeed: `AttendanceViewSet` lets a manager set anybody's attendance, so a live
RSVP button inside a preview would write Kasia's absence for real.

**4. Practice readiness is withheld from the preview, at the query.** The songbook
tells the singer *"Twoja prywatna notatka — nikt poza Tobą jej nie widzi"*
(`materials.readiness_hint`). That promise is kept by not fetching the rows:
`get_artist_materials_queryset(user, include_readiness=False)` drops the
`PieceReadiness` prefetch entirely, and the serializer emits `my_readiness: null`.
Not `NOT_STARTED` — an absent value must not be mistakable for "knows nothing".

**5. The preview refuses rather than falls back.** A non-manager passing `?artist=`
gets 403, not their own data under someone else's name. An artist who never
activated an account gets an explicit 409 — they genuinely see nothing, and
saying so is the correct answer.

**6. Preview caches live under their own root key, `["preview", …]`.** Not nested
under `PERSONAL_READMODEL_KEYS`. Two concrete reasons: `useUpsertScheduleAttendance`
patches optimistically by *prefix* over `["schedule","dashboard"]`, so a nested
preview cache would be silently rewritten by the manager's own RSVP elsewhere; and
a distinct root makes the persister exclusion a one-line predicate.

**7. Preview responses are never persisted or downloaded offline.** They are
another person's data sitting on the manager's device. The localStorage persister
currently dehydrates the entire cache with no filter — stage 2 adds the predicate
that excludes the `preview` root. Offline download of a preview is not offered.

**8. No new audit model.** Everything the preview shows, a manager can already
reach through the manager surfaces (castings, schedule, ensemble). The one thing
that would have been new exposure — readiness — is withheld. A structured log line
on preview access is enough.

**9. No money reaches a singer's screen, their own fee included.** Contracts and
settlement are a manager-side module still under construction; until it exists as
a whole, a figure reaches a person through a contract, not through the app.
Writing this list is what surfaced the one place that broke the rule:
`ParticipationMaterialsSerializer` was emitting the singer's own
`Participation.fee` onto their songbook row. It is gone, from the payload and
from `MaterialsDashboardItem`. Everything else was already right —
`ParticipationBasicSerializer` excludes `fee` for every non-manager caller,
`CrewAssignmentBasicSerializer` excludes `fee/is_paid/paid_at`, `Project` holds no
money of its own, `get_cast` is a whitelist, and the contract PDF, the `payment`
action and `bulk-fee` are all `IsManager`. The only template that prints an amount
is `contracts/contract_pdf.html`, reachable through manager-only endpoints alone.

## Shape

Route: `/panel/artists/:artistId/preview`, inside `ManagerRoute`.
Entry point: the artist row in `/panel/artists` and the artist editor panel.
Feature slice: `frontend/src/features/artist-preview/`.

The page is the artist shell rendered inside the manager's session: a persistent
header identifying whose view this is and that it is read-only, then the four
artist surfaces as tabs — **Pulpit**, **Harmonogram**, **Materiały**, **Kartoteka** —
each rendered with the *same components the artist uses*, fed from the preview
queries. Messages are absent by design, and the "what is hidden" panel says so.

### The transport

One query parameter, `?artist=<uuid>`, honoured by exactly five GET endpoints:

| Endpoint | Serves |
|---|---|
| `GET /api/participations/schedule-dashboard/` | timeline: projects, rehearsals, own attendance |
| `GET /api/participations/materials-dashboard/` | songbook: programme, castings, scores, tracks |
| `GET /api/documents/my-ensemble/` | ensemble directory + own standing |
| `GET /api/documents/artist-metrics/` | membership card figures |
| `GET /api/documents/categories/` | knowledge base, role-filtered |

The security boundary is one function — `core/preview.py::resolve_preview_target`.
Every one of the five resolves through it and none re-implements the check.

Refusals: **403** (a non-manager named somebody), **404** (no such member, or a
malformed id), **409** (the member exists but has no view — no account yet, or
archived). Note for stage 2: the shared error envelope
(`core/exceptions.py::enterprise_exception_handler`) flattens DRF's own error code
into `error_code` derived from the status, and nests the original message under
`errors.detail`. So the *reason* for a 409 travels as a server-translated
sentence, not a machine code — render `errors.detail` verbatim rather than
branching on a code that is not there.

## The two lists

The page carries both, because the conductor's question is usually one of them.

### What a chorister does not see (and you do)

Grounded in code, not folklore:

- **Any amount at all, their own included** — see *Decisions, settled* 9.
- **Budgets, contracts and contract PDFs** — manager-only endpoints
  (`participations/{id}/contract`, `payment`, `bulk-fee` all carry `IsManager`).
- **Projects still in DRAFT** — `get_artist_schedule` drops them from the cast's
  timeline *and* their rehearsals in one stroke. A conductor keeps their own.
- **Announcements not yet published** — DRAFT is silence, by the queue's design.
- **Who else was absent** — the artist's rehearsal card carries `absent_count`,
  a number, never the names.
- **Capability data** — `sight_reading_skill`, `vocal_range_bottom/top` are
  explicitly excluded from the ensemble directory.
- **Contact details of other singers** — `SectionMemberDTO` is a whitelist:
  name, avatar, voice line. No e-mail, no phone.
- **Documents in categories not granted to ARTIST** — `allowed_roles` gating,
  enforced again at download.
- **The archive** — a chorister sees the programme of their own concerts, never
  the catalogue.
- **Scores and tracks after the concert** — `materials_locked` for COMPLETED and
  CANCELLED projects.
- **Protected editions** — an UNKNOWN licence is treated as protected.
- **The whole manager panel** — artists, rehearsal attendance centre, archive,
  logistics, crew, projects.

### What you will not see here (deliberately)

- **Practice readiness** — the singer was promised nobody sees it. Rendered as an
  explicit "hidden" marker, never as an empty state.
- **Their 1:1 messages** — private by design, including from other managers.
- **Their notifications inbox.**

## Stages

**Stage 1 — backend (done).** `core/preview.py` with `resolve_preview_target`;
`?artist=` on the five endpoints; `include_readiness` on the materials read-model
and `my_readiness: null` in the serializer; `core/test_artist_preview.py` covering
the gate, the redaction and each endpoint (14 tests; the knowledge-base one is
skipped off Postgres, because `allowed_roles` filtering needs JSONField
`__contains` — the same reason `documents.tests` has one pre-existing SQLite
error).

**Stage 2 — the shell.** Route, `ArtistPreviewProvider` (carries `artistId`,
display name, `isPreview`), preview query keys under the `preview` root, persister
exclusion predicate, the identifying header, entry points from the roster.

**Stage 3 — the four surfaces.** Pulpit, Harmonogram, Materiały, Kartoteka
rendered from the artist components with every control inert; readiness shown as
withheld; `ReadinessRing` and the "x z y partii gotowych" caption suppressed
rather than zeroed.

**Stage 4 — the two lists, i18n and close.** The "what is hidden" panel; keys in
pl/en/fr; `npm run build`; ruff + mypy + the touched app tests.

## Not doing

- **Impersonation** — see *Decisions, settled* 1.
- **A demo/mannequin artist** — see 2.
- **Previewing messages** — 1:1 threads are private from managers by design;
  showing them here would be a redesign of that decision, not a preview of it.
- **Editing anything from the preview** — the answer to "Kasia can't see the
  score" is a fix in the manager surface, not a write from inside her view.
- **Previewing an artist with no account** — they see nothing; the preview says so.
- **A role toggle on the manager's own session** ("render me as an artist"). It
  would show manager-shaped payloads under an artist skin, because the serializers
  branch on `is_manager` server-side — a preview that lies in exactly the
  direction that matters.
