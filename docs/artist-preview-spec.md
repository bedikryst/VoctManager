# Artist preview — "What does Kasia see?" — spec

**Status:** stages 1–6 **done** 2026-08-19 · feature complete, verified
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
another person's data sitting on the manager's device, and the panel keeps
**two** stores that would have taken them:

- the React Query localStorage persister, which dehydrates the whole cache with
  no filter of its own — `PREVIEW_QUERY_OPTIONS` carries `meta: { persist: false }`,
  which `main.tsx` already honours;
- the **service worker**, whose NetworkFirst route matched the two dashboard
  paths by `pathname` alone and therefore cached `?artist=` reads for thirty
  days. It now excludes any request carrying the parameter. Two harms, not one:
  a member's timeline sitting in Cache Storage, and — because Workbox keys by
  full URL against a 16-entry cap — a handful of previews silently evicting the
  manager's OWN offline snapshots.

Offline download of a preview is not offered.

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

**10. A control in a preview stays on screen and goes inert; it is not removed.**
Settled while building stage 3, because both readings are defensible and only one
is right. The page answers two questions at once, and removing a control answers
the first one *wrong*: a manager who cannot find the RSVP pair concludes the
singer has none. So the button keeps its place, dimmed, and does nothing.

"Does nothing" is the `inert` attribute (React 19 passes it through), not a
`disabled` prop or a `pointer-events-none` class: `inert` takes the subtree out
of hit-testing, out of the tab order and out of the accessibility tree at once,
so the control is dead to a keyboard and a screen reader as well as to a mouse.
A handler that merely returns early is the same defect as trusting the server —
it leaves a control that looks live and is one refactor from being live.

**11. A document opener is inert for the same reason a write is.** Not because it
writes, but because every one of them is resolved from the CALLER and would open
the *manager's* document under the singer's name: `export_day_sheet` picks its
audience from `request.user` (a manager gets the production copy), a score
edition carries the caller's watermark and burns a copy number in
`ScoreAccessLog`, and `ScoreStandModal` would layer the conductor's annotations
over the page the singer actually sees. That the button exists is the answer to
"does Kasia have the score for Sunday"; opening it is the manager's own act and
belongs to the manager's own surfaces. Same rule retires the four `QuickTile`
links, the calendar subscription link and `AddToCalendar` (which would file the
singer's rehearsal in the manager's diary). It does **not** retire navigation to
the piece itself — see 14.

**12. Two widgets are suppressed outright rather than made inert**, because
neither is a control and both would be lying about the reader. `WelcomeMoment`
records "seen" server-side against the caller, so opening somebody's view would
spend the *manager's* own once-ever first crossing. `UnreadMessagesAlert` counts
the manager's inbox — and 1:1 threads are private from managers by design, so
there is no number it could honestly show. The preview states their absence on
its list instead (stage 4).

**13a. One dimming level, in one file.** `INERT_SURFACE`
(`shared/ui/primitives/inertSurface.ts`) is the whole look of a dead control.
Written per call site it had already drifted to three values, and the knowledge
base was dimming twice — card and buttons — which sank a preview row below the
row beside it. The constant is the look; `inert` is still what does the killing.

**13b. A control that is dead in a preview is dead for the whole row it sits
in.** The four `QuickTile`s are the case that made the rule: three were links
(inert) and the fourth opened the pitch pipe, so it stayed live — three dimmed
tiles beside one bright one reads as three broken tiles, not as a read-only
screen. The tile row goes inert together, the pitch pipe with it.

**13c. The role that filters a shelf is the TARGET's, not the caller's.**
`DocumentCategoryViewSet.list` asked `user_is_manager(request.user)` and then
subtracted the preview; it now asks `user_is_manager(target.user)` and needs no
subtraction. Same answer for every ordinary call, and the right answer when the
member being previewed holds the manager role themselves — they really would see
the manager's shelf, and a preview that showed them a chorister's would lie.

**13. Identity comes from the roster row, not from the read-models.** No
artist-facing endpoint tells its own reader their name — it has never needed to.
`ArtistService.getById` (manager-side, already cached by the panel) supplies the
name, face and voice that `ArtistPreviewProvider` carries, and `MembershipCard`
and the greeting read them from there. Left on the session's user, "Moja Karta"
would print the manager's face above somebody else's history.

**14. Opening a piece is navigation, not a control — so the songbook row lives.**
The first iteration killed the row along with its buttons, and that cost the
preview the half of the songbook that exists nowhere else: the singer's own part
on this piece, the conductor's note addressed to them, the sung text with its
IPA and translations, and the divisi they sit in. None of it is reachable from a
manager surface *as that singer receives it*, which makes "expand the piece" the
one question the preview could not answer. A row that opens produces no write,
resolves no document from the caller and sends no request that was not already
sent — the whole programme arrives in the one materials read-model.

Two rules keep it honest:

- **The row leads into the preview, never out of it.** `previewPiecePath`
  (`app/providers/ArtistPreviewProvider`) points at
  `?tab=materials&project=…&piece=…` on the preview's own route;
  `/panel/materials/:projectId/:pieceId` is the MANAGER's copy of the same
  piece, carrying their casting, their guidelines and their readiness. The piece
  rides in the query string rather than in a nested route so the identity bar
  and the gate query do not remount around it, and it is a **push** where the
  tabs are a `replace`: opening a song is the one move a manager expects Back to
  undo, and Back lands on the songbook, not on the roster.
- **Everything on that page that is a control is inert** — the score openers,
  the mixer, the reference recordings and the pitch pipe (13b: the practice
  column dies together, or three dead panels beside one live one read as three
  broken panels). `ScoreStandModal` is not mounted at all in a preview: the
  openers above it are dead, and a stand that did open would be the manager's
  own — their annotations, their watermark, their copy number logged against the
  singer's page.

The readiness console is the fourth surface to state the withholding rather than
vanish (see 4): the slot keeps its label and says "ukryta" where the control
would be, because a section that is simply gone reads as "this person has no
such control". It stays absent for a member CONDUCTING the project, who has no
participation to report against and genuinely has no console.

## Shape

Route: `/panel/artists/:artistId/preview`, inside `ManagerRoute`.
Entry point: the artist row in `/panel/artists` and the artist editor panel.
Feature slice: `frontend/src/features/artist-preview/`.

The page is the artist shell rendered inside the manager's session: a persistent
header identifying whose view this is and that it is read-only, then the four
artist surfaces as tabs — **Pulpit**, **Harmonogram**, **Materiały**, **Kartoteka** —
each rendered with the *same components the artist uses*, fed from the preview
queries. Messages are absent by design, and the "what is hidden" panel says so.

The songbook has a second level inside the tab: `?tab=materials&project=…&piece=…`
renders `PiecePage` in place of the list, every control on it inert (decision
14). No further request — the whole programme is already in the materials
read-model the tab fetched.

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

- **Any amount at all, their own fee included.** Word it that way and not as
  "other people's rates": the contracts-and-settlement module is still being
  built, and until it exists a figure reaches a person through a contract, not
  through the app. `fee` is already gone from the songbook payload and from
  `MaterialsDashboardItem`, and `core/test_artist_preview.py` holds that line by
  asserting on the key. See *Decisions, settled* 9.
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
- **Any working control** — attendance, documents, scores and offline download
  keep their place and do nothing. Views still open: the four tabs, and a song
  in the songbook (decision 14).

Both lists ship as copy in `artist_preview.boundaries.*` and are rendered by
`PreviewBoundaries`. Change one and change the other in the same commit: a list
that stops matching the code is worse than no list, because it is believed.

## Stages

**Stage 1 — backend (done).** `core/preview.py` with `resolve_preview_target`;
`?artist=` on the five endpoints; `include_readiness` on the materials read-model
and `my_readiness: null` in the serializer; `core/test_artist_preview.py` covering
the gate, the redaction and each endpoint (14 tests; the knowledge-base one is
skipped off Postgres, because `allowed_roles` filtering needs JSONField
`__contains` — the same reason `documents.tests` has one pre-existing SQLite
error).

**Stage 2 — the shell (done).** `/panel/artists/:artistId/preview` inside
`ManagerRoute`; `app/providers/ArtistPreviewProvider` (id, name, face, voice,
`isPreview`), defaulting to "not a preview" so no artist surface needed a prop
threading through it; `PREVIEW_QUERY_ROOT` / `previewQueryKey` /
`PREVIEW_QUERY_OPTIONS` in `shared/api/queryPolicy`; `PreviewIdentityBar`;
`PreviewRefusal`; entry from the roster row and the dossier header (offered only
where `is_active && user`, since an archived or account-less member genuinely has
no view and the row already says so).

Three things worth knowing before touching it again:

- **The persister exclusion is `meta: { persist: false }`, not a new predicate.**
  `main.tsx` already honours that opt-out, so `PREVIEW_QUERY_OPTIONS` carries it
  along with a short `gcTime` (another person's data has no business sitting in
  the manager's tab for the rest of the day) and `retry: false` (every refusal
  here is final, and each attempt writes an audit line).
- **The gate is one query**, the schedule read-model with `?artist=`, asked by
  the shell under the Pulpit's own key so React Query serves both from one
  request. All five endpoints pass through `resolve_preview_target`, so they
  admit or refuse together — asking once is enough.
- **Every preview service call must go through an arrow.** React Query hands
  `queryFn` its own context object as the first argument, so
  `queryFn: Service.getX` would post an object into the new `previewArtistId`
  parameter. `tsc` caught the one existing call site (`useCommandItems`) that did
  this; a service whose first parameter is optional will not be caught next time.

**Stage 3 — the four surfaces (done).** Pulpit, Harmonogram, Materiały,
Kartoteka, rendered from `ArtistDashboard` / `Schedule` / `Materials` /
`ChoristerHubPage` themselves. Two adjustments the components needed:
`ChoristerHubPage` branches on `isManager` to give a manager the curator surface,
which is exactly backwards here (the question is what the MEMBER's card looks
like); and `Materials` normally sits under `MaterialsLayout`, so the preview
mounts `PracticePlayerProvider` itself — without the docked `MiniPlayerBar`,
which would otherwise keep playing another person's rehearsal tracks after the
manager has left.

Withheld readiness travels as `MaterialsReadinessStatus | null` in the DTO, and
three surfaces state it rather than zeroing it: `ReadinessRing` swaps the ring
for a dashed "ukryta" block, the songbook group header swaps the ring and the
"x z y partii gotowych" caption for one chip, and `PieceRow` simply drops its
dot — a "hidden" glyph repeated down twelve rows would bury the rows that carry
a real mark. `useProjectReadiness` gained `isWithheld` so the three cannot
disagree, and `PiecePage`'s readiness console is gated on a non-null value.

**Stage 4 — the two lists and close (done).** `PreviewBoundaries` — a trigger in
the identity bar and a `BottomSheet` carrying both lists above, the messages
tab's absence stated on the second one rather than left as a gap, and a fourth
line saying that no control on the page can be pressed. A sheet, not an inline
panel: fifteen sentences above the preview would push the thing being previewed
off a phone, and the lists are read once. Copy in `artist_preview.boundaries.*`,
pl/en/fr.

The identity bar's subtitle lost the word "dokładnie" in the same pass. Readiness
is withheld by design, so "exactly these data" was false in the one place a
manager is most likely to check; the sheet beside it now names the exceptions.

**Stage 5 — the first-iteration sweep (done).** Four defects the build could not
catch, all found by reading the seam rather than the diff:

- the service-worker cache (decision 7);
- `ReadinessRing` kept a live `<Link>` in a preview whenever readiness was NOT
  withheld — which happens on a project the previewed member CONDUCTS, since
  conducted rows are served their own empty readiness rather than a withheld one.
  The ring now reads the preview itself and renders an inert `<span>`;
- the four refusal sentences (`core/preview.py`) were never added to the pl/fr
  catalogues, and `PreviewRefusal` renders the server's sentence verbatim — a
  Polish manager read the 403/404/409 in English. Added and compiled;
- the shelf-role question above (13c), and the dimming drift (13a/13b).

The tab now rides in `?tab=`, `replace: true`: the answer to "look at her
songbook" is a link, a reload lands back on the surface being discussed, and Back
still belongs to the roster rather than walking four tabs.

Also fixed here, unrelated to the preview but blocking a clean `vitest` run:
`fieldShell.test.ts` had been red since the iOS field-zoom commit (0a768f9)
changed the shell to `text-base fine-pointer:text-sm`. Its frozen legacy block
is evidence and must never be edited to match — the change is DECLARED instead,
as `DECIDED.touchTextScale`, merged into the fourteen expectations it touches.
22/22 green.

**Stage 6 — the songbook's second level (done).** The one thing a manager
reported as blocked, and the one place the preview was answering less than it
holds. `previewPiecePath` + `previewSongbookPath` in the provider module (the
only module both ends already import, so the URL scheme has one owner);
`PiecePage` accepts the ids as optional props and keeps reading `useParams` on
its own route; the row in `PieceRow` navigates again — into the preview — while
its quick actions stay inert; the shell renders the piece in place of the list
and drops both parameters on any tab change, so leaving the songbook closes the
song. Score openers, mixer, reference recordings and pitch pipe inert;
`ScoreStandModal` unmounted; the readiness console keeps its slot and says
"ukryta". Copy: `materials.piece_page.readiness_withheld` in pl/en/fr, and the
boundaries sheet's fourth line rewritten in all three — it claimed no button on
the page could be pressed, which stopped being true the moment a row opened.

## Not doing

- **Impersonation** — see *Decisions, settled* 1.
- **A demo/mannequin artist** — see 2.
- **Previewing messages** — 1:1 threads are private from managers by design;
  showing them here would be a redesign of that decision, not a preview of it.
- **Editing anything from the preview** — the answer to "Kasia can't see the
  score" is a fix in the manager surface, not a write from inside her view.
- **Previewing an artist with no account** — they see nothing; the preview says so.
- **Rendering the preview in the member's own language or timezone.** The panel
  chrome stays in the manager's, because the question is what the app TELLS them,
  not what their phone looks like — and the server already answers `?artist=` in
  the caller's language. A preview that also switched locale would be a second
  thing to get wrong for no question anybody asked.
- **A role toggle on the manager's own session** ("render me as an artist"). It
  would show manager-shaped payloads under an artist skin, because the serializers
  branch on `is_manager` server-side — a preview that lies in exactly the
  direction that matters.
