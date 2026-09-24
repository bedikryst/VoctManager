# Divisi and additional solo assignments

Status: Variant 2 selected; stage 1 implemented on 2026-09-24.
Stages 2-4 remain pending. The source changes are uncommitted.
Migration `roster.0063_project_solo_assignment` was applied to the Windows dev database.

## Need

The conductor needs singers to retain their choral assignment while also taking
short solos. Different singers may share a written solo part across passages;
one singer may take multiple passages. Five soloists in Lark are actual performers,
not mutually exclusive candidates. The user selected individually assigned solo
passages, additive to the singer's primary choral assignment.

## Score evidence

Source: the user-provided `05. The Lark Ascending [a12] (Vaughan Williams) VE.pdf`,
Vaughan Williams, arranged by Paul Drayton (2019), 25 PDF pages.

- PDF page 1 (bottom page number 23): soprano, alto, tenor and baritone solo
  staves are separate from the SATB choir.
- PDF page 5 (bottom page number 27), rehearsal mark 7: the soprano staff has
  a short SOLO passage followed by TUTTI.
- PDF page 12 (bottom page number 34), rehearsal marks 20-22: solo lines enter
  successively and overlap. Solo assignments cannot assume only one active soloist.
- The score does not identify the conductor's five singers or their handovers.

## Current application constraints

- `frontend/src/features/projects/editors/hooks/useMicroCasting.ts:615-638`
  moves an existing singer between voice lines rather than adding an assignment.
- `backend/roster/dtos.py:388-395` rejects repeated participants on one piece's board.
- `backend/roster/services.py:2509-2557` reconciles existing rows under that same
  assumption and removes additional rows as duplicates.
- `backend/roster/models.py:812-825` has an index, not a uniqueness constraint
  enforcing one singer per piece. Removing a database constraint is not the fix.
- `backend/roster/dashboard_serializers.py:266-268` selects one personal casting;
  personal materials and practice-track selection also assume one primary part.
- Multiple distinct singers can already occupy the single SOLO category.
  There is no verified alternative-candidate model or UI connector meaning "or".

## Considered options

1. **Additional soloist list:** retain the primary choral assignment; select
   soloists from the project's singers, including already assigned singers; attach
   an optional passage note to each. Simple, but missing entrances and handovers
   remain information in prose rather than individually fillable positions.
2. **Named solo assignments:** retain the primary choral assignment; allow the
   conductor to create entries with a name, optional score reference and performer.
   The same performer can fill multiple entries. Entries may overlap musically.
   References could be rehearsal marks, measures or words; no timeline editor or
   automatic score parsing is required to express this model.

Both options belong to the concert/project's casting of the work. Adding a solo
must not duplicate a participant or remove their choir part. A dedicated soloist
need not have a choir part. A future implementation must address the board,
personal view, materials, exports and relevant notifications together.

## Selected behavior and acceptance conditions

- The conductor can create, rename, order and remove individually assignable solo
  entries for the work in a project. Each has a label, an optional free-text score
  reference and one performer or an explicitly unassigned state.
- One singer can fill multiple entries while retaining their primary choral part
  and its notes. Dedicated soloists may have no choral assignment.
- Simultaneous solo entries are valid. These are actual duties, not alternative
  candidates. Do not add a substitute-management workflow or timeline editor.
- Count people uniquely and coverage by solo entry. A solo entry does not fill
  a vacant choral position or create another project participation.
- Preserve existing SOLO assignments and their relevant metadata without guessing
  a primary choir part or musical passage. Define and test compatibility/migration
  explicitly; inspect existing notes and pitch-giving flags before changing storage.
- Show all additional duties in the personal view and relevant exports and
  notifications. Keep primary practice-track selection tied to the choir part.
- Saving ordinary divisi must not erase solo entries, and editing solo entries
  must not erase ordinary divisi. Check authorization and project membership.

## Implementation plan — variant 2

### Storage boundary and compatibility

- Add `ProjectSoloAssignment` in roster: UUID, `project`, `piece`, ordered position,
  required label, optional free-text `score_reference`, nullable `participation`,
  `notes` (200 characters), `gives_pitch` and nullable `reference_edition`
  (the edition used when the score reference was last edited). A null
  participant is an open solo
  position. Validate that the piece is in the project's programme, a selected
  participant is live in that project and has not declined, and the label is not
  blank. The same participant may occupy several positions; do not impose a
  participant-per-piece unique constraint. Keep stable UUIDs on rename/reorder.
- The boundary is **project + piece**, like `ProjectPieceCasting`. `ProgramItem`
  is unique only by `(project, order)`: repeated appearances of one piece (including
  an encore) currently share its choral casting and will share its solos. A solo
  does not belong to the archive `Piece`, `ScoreEdition`, or an individual
  `ProgramItem`; another project can cast it differently. `score_reference` is a
  human description for the score used in this project, not parsed timing data.
  `reference_edition` is provenance, not part of the assignment's identity:
  stamp it from the resolved edition only when `score_reference` is edited.
  Changing the selected edition keeps assignments and references intact; the
  editor flags nonempty references whose stored edition differs from the
  currently resolved one (also when repeated items bind different editions).
  It must never silently rewrite or clear them.
- Do **not** run a data conversion on existing `ProjectPieceCasting.voice_line=SOLO`
  rows. They have no passage name; inventing one would misstate the score. Keep
  their IDs, participant, `notes` and `gives_pitch`, display them as clearly
  marked legacy solos in every casting consumer, and exclude them from the normal
  choral board's reconcile/delete set. New SOLO rows through the old board and
  single-casting create/update endpoints must be rejected; existing legacy rows
  remain readable and editable for `notes`/`gives_pitch`, but cannot change
  voice line through the old endpoint. Add an explicit manager-only
  conversion of one legacy row into one named position: require a real label,
  carry participant/notes/gives_pitch, leave score reference blank unless supplied,
  and delete that legacy row only within the same transaction. Send one change
  notification, not a removal plus assignment. Do not convert an unrelated choir
  casting. This is a compatibility workflow, not a migration of stored data.
- Keep `my_casting` as the primary **choral** assignment, or null. Put ordered
  `my_solo_assignments` and the legacy SOLO duties beside it. A solo-only singer
  has no synthetic choir voice and does not select a SOLO practice track. The
  score remains available through the live project participation. Merging two
  participations must move all named solos and legacy SOLO rows without deduping
  by piece; ordinary choir rows retain their one-seat rule.

### API and behaviour

- Add manager `GET /api/piece-castings/solos/?project=<id>&piece=<id>` and atomic
  `PUT /api/piece-castings/solos/` with `project`, `piece` and an ordered
  `solo_assignments` array. Each row has stable `id` when
  already saved, `label`, `score_reference`, nullable `participation`, `notes`,
  `gives_pitch` and `position`; GET also returns legacy SOLO rows separately.
  PUT reconciles **only named solos**, rejects duplicate/foreign IDs, foreign or
  declined participants and missing programme pieces, and returns saved rows.
  Preserve named rows when `/board/` or `/boards/` saves divisi; preserve choir
  rows when this endpoint saves solos. Add a manager-only conversion action for
  one legacy row at `POST /api/piece-castings/convert-solo/`. Choristers receive
  only their own duties via materials and
  personal views, not the full manager endpoint.
- Keep the current `PieceCasting` serializer and board payload for choral lines.
  The editor has a separate named-solo section with add, rename, reorder, assign,
  unassign and remove controls. Its picker uses **all** live project singers,
  including singers already seated on a choir line. Never move their choral chip
  when adding a solo. Do not put named solos into auto-cast, voice-family divisi,
  rehearsal-plan `piece -> voice_line` maps or practice-track selection.
- Count people by distinct participation/artist across choral, named and legacy
  duties. Show solo coverage as filled positions / all named positions, with
  legacy rows shown separately; a filled solo does not cover a missing choir
  requirement. One person holding a choir line and three solos remains one
  performer and one project participation. Unassigned positions count toward
  missing solo coverage, not performer count.
- Show all solo names, score references and performers on the manager board,
  chorister's work view/materials and call sheet. Show the same person's choir
  line and every solo side by side. The personal PDF must include all of that
  person's duties, including the solo-only case. Keep the score-book's manually
  entered `ProgramItem.performers` credit as an override; when it is empty and
  the cast line is enabled, derive it from filled solo positions without editing
  the stored field. Include named solos in the dossier/ensemble casting history
  and invitation summary while deduplicating project and piece performance
  counts. Preserve legacy SOLO visibility in those surfaces throughout rollout.
- Reuse the existing casting notification preference/types. For a save affecting
  several positions of one singer on one piece, queue one person+piece announcement
  containing the changed solo names/references and the resulting duties. Preserve
  normal choir assignment notices. The in-app item, email and push must all render
  solo duties, including removals, without treating a name as a voice-line code.

### Stages and exact files

1. **Model, compatibility and API.** Change `backend/roster/models.py`, create
   `backend/roster/migrations/0063_project_solo_assignment.py` with
   `makemigrations` (0062 is the current migration head), and change
   `backend/roster/dtos.py`, `backend/roster/serializers.py`,
   `backend/roster/services.py`, `backend/roster/views.py` and
   `backend/roster/tests.py`. Add the solo actions to the existing casting
   viewset/router; `backend/config/urls.py` needs no new route. Protect existing
   SOLO rows in board saves, direct CRUD and participation merges here.
2. **Editor and coverage.** Change
   `frontend/src/features/projects/editors/hooks/useMicroCasting.ts`,
   `frontend/src/features/projects/editors/tabs/MicroCastingTab.tsx`,
   `frontend/src/features/projects/ProjectCard/hooks/useProgramFulfillment.ts`,
   `frontend/src/features/projects/editors/tabs/components/ProgramCastingRail.tsx`,
   `frontend/src/features/projects/types/project.dto.ts`,
   `frontend/src/features/projects/api/project.service.ts`,
   `frontend/src/features/projects/api/project.read.queries.ts`,
   `frontend/src/features/projects/api/project.piece-casting.mutations.ts` and
   `frontend/src/shared/types/index.ts`. Add a focused named-solo editor component
   under `frontend/src/features/projects/editors/tabs/components/` and test its
   ordinary-board isolation and per-position coverage. Keep `DivisiBucket`,
   `CastMemberChip` and auto-cast behaviour choral-only.
3. **Personal and printed consumers.** Change
   `backend/roster/queries/materials_queries.py`,
   `backend/roster/dashboard_serializers.py`,
   `backend/roster/queries/dossier_queries.py`,
   `backend/roster/invitations.py`, `backend/documents/services.py`,
   `backend/roster/infrastructure/document_generator.py`,
   `backend/roster/infrastructure/score_package_builder.py`,
   `backend/templates/projects/call_sheet_pdf.html`,
   `frontend/src/features/materials/types/materials.dto.ts`,
   `frontend/src/features/materials/components/PieceRow.tsx`,
   `frontend/src/features/materials/PiecePage.tsx`,
   `frontend/src/features/materials/components/PieceDivisiRoster.tsx` and
   `frontend/src/features/schedule/components/TimelineProjectCard.tsx`.
   Verify choir-only track logic in
   `frontend/src/features/materials/hooks/useMaterialsData.ts`,
   `frontend/src/features/materials/player/PracticePlayerProvider.tsx` and
   `frontend/src/features/materials/player/RehearsalDock.tsx`; change them only
   if the new DTO would otherwise alter their current choir-only behaviour.
   Cover PDFs and history in `backend/roster/tests.py`,
   `backend/roster/test_score_package_cockpit.py` and `backend/documents/tests.py`.
4. **Notifications and locale.** Change `backend/notifications/dtos.py`,
   `backend/notifications/message_content.py`,
   `frontend/src/features/notifications/types/notifications.dto.ts`,
   `frontend/src/features/notifications/components/NotificationItem.tsx`,
   `backend/notifications/tests.py` and the three
   `frontend/src/shared/config/locales/{pl,en,fr}/translation.json` files. For
   new backend gettext strings, update and compile
   `backend/locale/{pl,en,fr}/LC_MESSAGES/django.po` and `django.mo`.

### Acceptance tests and finish gate

- A singer on T1 receives three named solo positions in one project/piece. Saving
  either editor leaves the other layer untouched; the singer keeps T1 notes and
  T1 practice track, sees all three names/references, receives one consolidated
  notification per save, and counts as one person. Reordering retains position IDs.
- A project participant with no choir casting receives two solos. Materials and
  personal PDF show both; no `my_casting=SOLO` or solo practice-track preference
  appears. Two simultaneous solos and an unassigned third position are valid;
  coverage is 2/3 and performer count is one.
- An existing SOLO row with nonempty notes and `gives_pitch=True` survives an
  empty or full choir-board save, appears in UI/materials/PDF/counts, and is not
  duplicated by the new model. Explicit conversion with a supplied name carries
  both fields and the same performer atomically; an invalid conversion leaves
  the original row unchanged. No automatic data migration or retroactive notice.
- Reject cross-project participants, declined participants, non-programme pieces,
  duplicate IDs and writes by a chorister. A repeated ProgramItem for the same
  piece reads the same project-level solo positions. A different project using
  that piece reads none of them. Switching editions preserves positions and
  raises a reference-review cue without changing their text.
- Verify programme coverage, personal and manager PDFs, score-book credit
  fallback/override, dossier and invitation deduplication, and in-app/email/push
  rendering for assignments, edits, unassignments and removals. Run backend
  roster/documents/notifications tests plus ruff and mypy on touched apps; run
  frontend `npm run typecheck` and `npm run build` once after the full stage.

Implementation handoff: continue with stage 2 in a fresh session. Do not repeat
the variant decision or broaden ordinary divisi. Preserve all uncommitted changes,
especially in `backend/roster/services.py`. Stage 4 still needs to render the
solo change metadata queued by stage 1 in the in-app, email and push messages.
