# Instrumental pieces: who sees which scores — implementation plan

Status: **IMPLEMENTED 2026-09-20 (both stages), review pass applied 2026-09-21, uncommitted,
not yet checked in the browser.** No migration. Predicate lives as `instrumental_item_exists()` /
`castings_are_instrumental()` in `roster/models.py`; the songbook emits `is_instrumental` +
`materials_withheld`. The review pass closed the one path a singer still had to organ pages — a
book bound before the item turned instrumental (see **Rules**, last paragraph) — and aligned the
stand-in leader, the readiness ring, the casting rail, the cockpit and the printed sheet with the
table below. Left for the developer: the browser walk-through under **Verification**. Builds on
`instrumentalists-as-artists-2026-09.md` (shipped, `0dda81c`).

## The ask

1. A programme item on which **only instrumentalists** are cast hides its sheet music from the
   choir. Choristers see the title with an "Instrumental" badge; the item is left out of the
   project's generated score book.
2. An **instrumentalist** sees everything a chorister sees today — every score and the full
   project book — so they can follow where the choir is. (Revised 2026-09-20: an earlier draft
   limited players to the pieces they are cast on; dropped by the developer.)

## What the code does today (verified)

- Score access is **project-level only**. `artist_has_live_access_to_piece`
  (`backend/roster/queries/materials_queries.py:40`) asks "does this user hold a live seat in a
  non-closed project that programmes this piece" — never "is this artist cast on it".
  `artist_live_piece_ids` (`:86`) is the set-form twin used by annotations (`archive/views.py:910`).
- The songbook (`ParticipationViewSet.materials_dashboard` → `get_artist_materials_queryset` →
  `PieceMaterialsSerializer`, `roster/dashboard_serializers.py:198`) serialises every edition of
  every piece; `my_casting` is decorative. `project_castings` (`:248`) is already sliced to the
  project and `participation.artist` is select_related, so the casting rule can be evaluated in
  memory with no extra query.
- The score book is built **once per project** (`ScorePackageService.run_build`, stored on
  `project.score_pdf`); watermark and marks are applied at serve time. The programme loop exists
  twice with identical querysets: `ScorePackageService._ordered_items`
  (`score_package_service.py:156`) and `_resolve_program`
  (`roster/infrastructure/score_package_builder.py:282`). Staleness is detected on read
  (`compute_state` → `compute_source_hash`), so a change in the item set needs no hook.
- No flag meaning "instrumental" exists on `Piece`, `ScoreEdition`, `ProgramItem` or
  `ScorePackage`. `ProjectPieceCasting` (`roster/models.py:769`) links `participation` + `piece`
  + `voice_line`; "cast on this piece in this project" = `castings.filter(piece=…,
  participation__project=…)`. `save_piece_board` does not validate `voice_line` against the
  divisi, so an `ACC` seat can exist on a piece that declares no `ACC` line.
- Existing predicates: `VoiceType.INSTRUMENTALIST = 'INS'`, `is_instrumentalist_account(user)`
  (`roster/models.py:91`), `Artist.is_singer`; frontend `isInstrumentalist` /
  `isSingingVoiceType` (`frontend/src/shared/lib/voiceTypes.ts:36`).

## Rules (the contract)

An item is **instrumental** in a project when the piece has at least one non-deleted casting in
that project and every one of them belongs to an artist with `voice_type == 'INS'`. Zero castings
= a choir piece (unchanged: "no divisi = four-part reading"). Derived, not stored.

Reader rule, per programme item, applied on top of the existing lifecycle gate
(`materials_locked`, closed projects):

| reader | choir item | instrumental item |
|---|---|---|
| singer / conductor-artist (`voice_type != INS`) | full materials (as today) | title + badge; editions and tracks withheld |
| instrumentalist (`INS`) | full materials (as today) | full materials (+ badge) |
| manager | everything | everything (+ badge) |
| stand-in leader (led project door) | everything | everything (+ badge) |

The badge is a fact about the item, shown to everyone. Withholding is a fact about the reader:
only a non-instrumentalist seat is ever refused, and only on an instrumental item. "Materials" =
editions **and** practice tracks (one gate, same as `materials_locked`).

The score book is the choir's book: instrumental items are excluded from the build. The
instrumentalist opens the same book as everyone else (their organ-only pieces are not in it —
those sit as separate PDFs on the list). A per-recipient build is rejected: the book is a single
project-level artefact with page map, outline and hash.

A book is built once and served until rebuilt, so the board can turn an item instrumental
*after* its pages were bound. Such a book (`book_binds_instrumental_item`, read off the page map)
is withheld from every refused reader until the conductor rebuilds: the songbook reports
`has_score_pdf: false`, `score_pdf` answers 403 and `score_map` answers `available: false`. The
three exempt readers keep it. A hand-uploaded book has no page map and is never withheld — it is
the conductor's own decision. The cockpit names the withholding (`book_withheld_from_choir`) and
lists the items left out (`instrumental_pieces`), so the row count never silently shrinks.

Readiness is asked only about music the singer is given: a withheld item is out of the ring, the
"still to practise" filter and the row dot. The singer's printed day card carries the badge and no
score link on an instrumental item; the player's card and every manager sheet keep the link.

### Decided against

- **Explicit `ProgramItem.is_instrumental` flag.** One more field, one more UI control, and a
  second truth that can contradict the casting board. The board already is "organ plays in the
  Mass, not in the motet" per piece. Known cost of deriving: while a manager casts a mixed piece
  organist-first, the piece is briefly instrumental and hidden from the choir. Mitigation: the
  casting rail shows the badge live, so the state is visible while it is being made.
- **Hiding a choir piece from a singer who is not cast on it.** Not asked; choir casting is
  optional and most programmes cast nobody.
- **Limiting a player to the pieces they are cast on** (and refusing them the book). The
  developer wants the organist to follow the whole evening. Dropped 2026-09-20.
- **Per-recipient score book.** See above.

## Stage 1 — backend

**One predicate, two shapes**, in `backend/roster/models.py` next to `ProjectPieceCasting`
(same pattern as `Rehearsal.called_participations` / `calling_q` / `calls_seat`):

- `ProgramItem.instrumental_exists() -> Exists`-style annotation helper (name it
  `ProgramItem.instrumental_q()` or a module function `instrumental_item_exists()`): `Exists(castings
  for OuterRef piece + project, participation__is_deleted=False) & ~Exists(same, excluding
  participation__artist__voice_type='INS')`.
- `castings_are_instrumental(castings: Iterable[ProjectPieceCasting]) -> bool` — in-memory twin
  for prefetched rows: `bool(rows) and all(c.participation.artist.voice_type == INS)`.

Files:

1. `backend/roster/queries/materials_queries.py`
   - `artist_has_live_access_to_piece(user, piece_id)`: keep the live-seat ∩ non-closed base.
     If `is_instrumentalist_account(user)`: unchanged (project-level, as today). Else:
     `ProgramItem.objects.filter(piece_id=piece_id, project__in=seats.values('project_id'))
     .annotate(instrumental=…).filter(instrumental=False).exists()`. Update the docstring: this
     is the one rule for score, track and annotation access, and it now knows whether the
     reader is a player.
   - `artist_live_piece_ids(user)`: same split, returning piece ids. Annotations follow for free.
   - `user_has_live_access_to_piece`: untouched (led door stays open).
2. `backend/roster/dashboard_serializers.py`
   - `PieceMaterialsSerializer.to_representation`: after `project_castings`, compute
     `is_instrumental = castings_are_instrumental(project_castings)`; read
     `reader_is_instrumentalist` from context; `materials_withheld = is_instrumental and not
     reader_is_instrumentalist`; `editions`/`tracks` empty when `materials_locked or
     materials_withheld`. Emit two new keys: `is_instrumental`, `materials_withheld`. Extend
     the docstring's context list.
   - `ArtistMaterialsSerializer` (the one at `:382`): add `'reader_is_instrumentalist':
     participation.artist.voice_type == VoiceType.INSTRUMENTALIST` to `piece_context`.
     `has_score_pdf` unchanged — the player opens the choir's book.
   - `LedProjectMaterialsSerializer` (`:470+`): `reader_is_instrumentalist: True` (a leader is
     refused nothing); emit `is_instrumental` so the leader sees the badge.
3. `backend/roster/score_package_config.py` — add `book_program_items(project) ->
   QuerySet[ProgramItem]`: the shared queryset (select_related/prefetch as today) with
   `.annotate(instrumental=…).filter(instrumental=False).order_by('order')`. Replace the two
   copies: `ScorePackageService._ordered_items` and `_resolve_program` both call it. The hash
   then changes when an item flips, and `compute_state` reports the book stale.
4. `backend/roster/views.py` — nothing. `ScoreEditionDownloadView`, `score_pdf` and
   `score_map` keep their gates; the first calls the predicate, the other two serve the same
   book to every seat.
5. Tests, `backend/roster/test_instrumentalist.py` (existing file; add a class):
   - dashboard: singer on a project with an organ-only item → `editions == []`, `tracks == []`,
     `is_instrumental True`, `materials_withheld True`; choir item unchanged.
   - dashboard: organist on the same project → every item full, `materials_withheld False`
     everywhere, organ item `is_instrumental True`, `has_score_pdf` as for a singer.
   - dashboard: item with organist + one soprano cast → not instrumental for anyone.
   - download view: singer → 404 on the organ edition, 200 on a choir edition; organist → 200
     on both.
   - annotations queryset: singer cannot list shared marks on the organ edition.
   - package: `book_program_items` skips the organ item; `compute_source_hash` differs before and
     after casting a soprano on it.
   - manager preview (`?artist=<singer>`) withholds the organ item exactly as the singer's own
     request does.

No migration. `ruff` + `mypy` on `roster` and `archive`; run `roster` tests with
`config.test_settings_sqlite`.

## Stage 2 — frontend

1. `frontend/src/features/materials/types/materials.dto.ts` — `MaterialsPiece`: add
   `is_instrumental: boolean` and `materials_withheld: boolean` (both required in the type; the
   backend always emits them). No `QUERY_CACHE_BUSTER` bump: an old snapshot without the keys
   renders as today, and the server refuses the download regardless.
2. `frontend/src/features/materials/components/PieceRow.tsx` — next to the "Bis" pill
   (`:146-154`), same `Eyebrow as="span" color="incense"` shape: `t("materials.piece.instrumental_badge")`
   when `piece.is_instrumental`. Quick actions already hide when there is no PDF and no track.
3. `frontend/src/features/materials/PiecePage.tsx` — `hasReadinessSlot` also requires
   `!piece.materials_withheld` (nothing to learn on music you are not given); show the same
   badge in the header. The existing no-PDF state covers the rest.
4. `frontend/src/features/projects/editors/hooks/useMicroCasting.ts` — `PieceProgress` gains
   `isInstrumental: boolean`, computed in the `pieceProgress` memo from `effectiveCastings` and
   the members' `voiceType` (`isInstrumentalist`), so the rail reflects the draft board live.
   `ProgramCastingRail.tsx` renders the same badge on the item. Do not touch `resolveAutoSeat`.
5. Locales, all three (`frontend/src/shared/config/locales/{pl,en,fr}/translation.json`), one
   key `materials.piece.instrumental_badge`: PL "Instrumentalny", EN "Instrumental",
   FR "Instrumental". The file is NOT sorted — insert next to the sibling `materials.piece.*` keys.

`npm run typecheck`, then `npm run build`.

## Verification (developer, in the browser)

- dev, as a chorister: a project with an organ-only item shows the title + "Instrumentalny",
  no PDF/track actions, no readiness control; the project book opens without that item.
- dev, as the organist: every PDF opens, the organ item carries the badge, "Otwórz książkę"
  opens the choir's book (without the organ item).
- dev, as manager: `?artist=<chorister>` preview matches the chorister's view; the casting rail
  shows the badge as soon as the only seat on a piece is the organist's.

## Left open

- The manager-side readiness board counts the instrumental item in "N pieces" for singers.
  Cosmetic; leave until someone notices.
- A conductor-artist (`DIR`) holding a live seat is treated as a singer here (instrumental items
  withheld) unless they are also `Project.conductor` or hold a materials grant, which the led
  door already covers. Revisit only if one complains.
- The printed day card decides "refused" from the recipient's voice type alone; a singer who
  also leads the project gets a card without the organ link although the app would open it.
  One missing link on paper, not a leak — leave it.
