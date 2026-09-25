# Conductor feedback, round 2 (2026-09-25)

Status: Stage 0 done — uncommitted, not yet seen in the browser. Stages 1 and 2 not started.

Eleven remarks from the conductor, sent from the production panel. Six were defects or
misreadings fixed in Stage 0; two are features (Stages 1–2); the rest needed an answer, not code
(see "Not built").

## Stage 0 — done in the triage session

- **Auto-cast** (`frontend/src/features/projects/lib/autoCast.ts`, tests beside it). The
  conductor had the line-up right — baritones seated `B1`, the bass `B2` — and the seat kept the
  baritones off the `BAR` line of the one piece that writes one ("everyone went to the basses").
  Order now: the part written for the singer's own voice type (Ms, Ct, Bar) → the seat → the
  family's only line → TUTTI. A baritone (seat `BAR`, or type BAR without a seat) is a bass where
  no baritone part is written and takes `B1` on an exact `B1`+`B2` split. **Rejected:** splitting
  the basses by voice type (BAS → `B2`) — with no baritone in the section it sends every bass
  down and leaves `B1` silent, and even quantity-aware it has to pick which bass moves up. The
  basses' split belongs to their seats. A conductor (`DIR`) is never placed — before, the TUTTI
  fallback would have cast him on a unison piece.
- **Concert sheets list a singer by the voice their seat names**:
  `core.voice_labels.voice_type_of_seat`, the same reading as `section_letters_of_seat`. Used by
  the day/call sheet sections (`_group_participations_by_voice`), the personal sheet's voice label
  and section mates, and the DTP programme export. The section, not the seat itself: a baritone
  seated `B1` prints under "Bass", never "Bass 1", because the one piece where he sings the
  baritone part would contradict a concert-wide "Bass 1"; per-piece tables print the real line.
  The profile, the Cast tab grouping, the divisi pool, the chorister's membership card and the
  invitation deliberately keep the profile voice type: none of them is a concert view.
- **Conductor out of the singing surfaces**: divisi pool (`useMicroCasting`), seat select
  (`CastTab`), the "Obsada wokalna" count (`ProjectPeopleCard`) and the "Zespół" tile
  (`ProjectStatusStrip`). His participation stays — it carries his fee (`finance`, `PROTECT`).
  Declined seats left both counts too.
- **Overview programme lists every piece** (`ProgramWidget`); the materials cast list lost its
  192px scroll box (`PieceDivisiRoster`).
- **Roll call**: bulk "fill gaps as present" is disabled until 2 h before the start
  (`isRegisterOpen` in `features/rehearsals/lib/attendanceStats.ts`). Single entries stay open —
  an excuse entered days ahead is legitimate. The server still accepts a future PRESENT; not
  guarded, because the only bulk path is this button.
- **"Otwórz odprawę" removed.** The workspace already auto-selected a project and its next
  rehearsal, so the pulse button re-selected what was on screen whenever there was one active
  project. The auto-select now prefers the pulse's project (`useRehearsalsData`, after the pulse
  memo, gated on `isLoading`), and the pulse card carries no action. The Polish view name
  "Odprawa" became "Lista obecności" — the conductor's own word for it; EN/FR ("Roll call",
  "Appel") were already right.

## Stage 1 — a conductor's note to the singers, per concert piece

Need, in his words: the internal "Notatki dyrygenta (wewnętrzne)" duplicated as an external note
for the singers — for one piece: "Uwaga: głosy dokładnie wg nagrań (!)".

**Decision: the note lives on `ProgramItem` (this concert's row), not on `Piece`.** An instruction
like this is about one performance; on `Piece` it would follow the piece into every later concert.
`Piece.description` stays internal — the singer materials DTO leaves it out on purpose
(`roster/dashboard_serializers.py`, the materials piece serializer).

Shape:
- `roster.ProgramItem.singer_note` — `TextField(blank=True)`, `verbose_name`/`help_text` through
  `gettext`, a migration. Manager-writable only.
- Read: add to `ProgramItemMaterialsSerializer` (`roster/dashboard_serializers.py`, ~L389–418) →
  the `MaterialsPiece` type → render at the head of `features/materials/PiecePage.tsx`, above the
  tabs, for every cast singer and the assistant conductor. Empty note renders nothing.
- Write: the Program tab row (`features/projects/editors/tabs/ProgramTab.tsx` → `SetlistRow.tsx`),
  beside the existing per-row pickers. Copy in all three locales; Polish label proposal
  "Uwaga dla śpiewaków".
- DTO change → bump the query cache buster.
- Notifications: none in this stage. Open for the developer: queue one per-piece notice when a
  note is added on a published project (announcement queue, subject `<piece>`).

Verify: materials serializer test that `singer_note` reaches a cast singer and `description`
still does not; typecheck; the developer looks at the piece page.

## Stage 2 — the assistant conductor writes back on the score

Need: "I can address notes to her — can she write things I will see? A chat around the score
would be great."

Today (`archive/views.py`, `_assert_can_write` and the layer read rules ~L885–971): the `leader`
layer is written by managers and read by managers plus a delegate with the `marks` scope. The
assistant can reach the conductor only through a message thread (`messaging.Thread`, artist ↔
manager) and the post-rehearsal debrief. Nothing she writes on the score is private to him.

**Decision: open the `leader` layer to the assistant's own marks under the existing `marks`
scope** — the layer becomes the shared desk of conductor and assistant. Not a threaded chat: one
assistant per concert does not justify threads, and a `COMMENT` annotation already pins text to a
place on the page. The `conductor` layer stays closed, as decided in
`docs/specs/project-leader-2026-09.md`.

Shape:
- Server: in `_assert_can_write`, allow `leader` for a live delegate with `marks` on a piece in
  `led_piece_ids(scope='marks')`, own rows only (`created_by`) — the same pattern as the
  `choir_marks` branch on `shared`. A non-manager `clear` removes only their own `leader` rows.
- Client: `scoreAnnotatorModeFor` and the Moje ⇄ Chór pill gain the leader layer as a writable
  target for the assistant (label to settle with the developer). The conductor already reads it.
- Tests: the assistant writes, edits and deletes her own leader mark; cannot touch the
  conductor's; a singer never reads the layer; a revoked or expired grant loses write.
- Notifications: none in this stage.

## Not built, and why

- **"Substitution possible" status** (a T2 who may drop out): the three participation statuses
  already cover it. He stays as he is; the conductor keeps the caveat in his private notepad.
  When it is settled: add the substitute with seat `T2`, run "Uzupełnij program", remove the
  singer who dropped out. On a published project adding someone sends the invitation at once —
  add the substitute only once he has agreed.
- **A "replace X with Y" helper** that moves all castings in one step: too rare to earn an
  endpoint; the three steps above do it.
- **Cast tab grouped by section — OPEN, recommended.** Today the tab groups by profile voice type,
  so the conductor's baritones (seated `B1`) sit under "Baryton", apart from his bass (`B2`), and
  the balance rail reads "Bas 1" for a section of three — his remark "baritones cannot be
  separated from B1". Recommendation: group by section (the seat's family, else the voice type's;
  a baritone folds into the basses, an unseated mezzo keeps her own group), print the profile voice
  as the caption under the name the way a player's instrument is, and count the rail by section.
  Rows move only when a seat changes family (a mezzo set to `S2`), not on B1 ⇄ B2. Waits for the
  developer's decision — he first asked to keep the profile grouping.
- **Icon of "Podaje ton"** (`KeyRound`): kept; the question was what the duty means, not the glyph.
