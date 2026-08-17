# Archive AI compiler — audit and remediation

Status: **two items open** · Audited 2026-08-17 · Surface: `frontend/src/features/archive/`
plus the `backend/archive` endpoints it consumes.

Companion to `docs/archive-ai-ingestion-pipeline.md`, which describes how the pipeline *works*.
This file is about how its **review cockpit** behaves in front of a conductor, what was wrong
with it, and what is still owed.

The pipeline itself audited clean: SSE, the poll fallback, cancel, the cost ceiling and the
provenance stamping all match their backend contracts. Everything below concerns the layer
between that machinery and the person approving its output.

---

## 1. Shipped 2026-08-17

Recorded so the next pass does not re-audit them. Code is the source of truth.

| # | Defect | Resolution |
|---|---|---|
| 1 | Review meter counted 10 metadata fields but claimed "Wszystkie pola zweryfikowane" over untouched translations; the library row counted *every* provenance entry, so the two surfaces printed different backlogs for the same piece | `pieceReviewBreakdown()` in `ProvenanceChip.tsx` is the single rollup — metadata + movement titles + translation texts, i.e. exactly the set with a verify control. Both surfaces read it |
| 2 | The meter lived inside the "Metadane" section, reading as that section's tally | Lifted above the sections it counts |
| 3 | Części / Tłumaczenia collapsed with no signal that anything needed a human | `CockpitSection` takes `pending`; the sections open themselves during a review with a non-zero backlog |
| 4 | Two approve doors — the one in `EditionsList` skipped the footer's unsaved-changes guard, so a conductor could publish with corrections still in the form | Removed. The action tray is the only door, and it inherited the confirm dialog |
| 5 | "Ponów analizę" offered on a READY edition — silently drops it to AWAITING, un-publishing materials the choir already has | Hidden for READY |
| 6 | Three cost formats across three surfaces, and `$0.00` printed for the first seconds of every upload | `constants/ingestionCost.ts`; zero returns `null` and callers omit the figure |
| 7 | SSE poll fallback hardcoded `piece_id: null`, so without SSE the finished upload row never offered "Sprawdź i zatwierdź" | Mapped from `ScoreEditionDetail.piece` |
| 8 | Failed ingestions that died **before** the resolver were unreachable — terminal (gone from `active/`), piece-less (on no card). PDF, error and AI spend vanished on reload | `GET /api/archive/editions/orphans/` + `OrphanIngestionsPanel` (retry / delete). Five tests in `archive/tests.py` |
| 9 | Piece Card's left pane picked `getPrimaryPdf` (default-then-newest), not the edition under review | `getReviewPdf()` prefers the AWAITING edition; annotations follow it |
| 10 | Five upload-row strings rendered in Polish for EN/FR users; `archive.provenance.*` absent from PL | Full pl/en/fr parity across the `archive` namespace; dead keys removed |
| 11 | `„tytuł"` — mismatched Polish quotation in the live analysis preview | `„tytuł”` |

**Investigated and dismissed:** local edit buffers in `MovementRow` / `TranslationRow` do not
re-seed after a refetch. This looked like a staleness bug, but `persist_analysis` is idempotent
and *skips* populated children (`if not piece.movements.exists()`), so a re-ingest cannot
rewrite a movement title underneath an open editor. The only path is two managers editing the
same piece at once, which single-tenant VoctFoundation does not have. Adding a reconciling
buffer here would be machinery for a scenario the pipeline cannot produce.

---

## 2. Open — B: the year checks cannot fire

**`AIHallucinationWarning` advertises coverage it does not have.** Two of its three checks
compare `piece.composition_year` against the composer's lifespan; its own header cites
"Rachmaninoff 1741" as the case it catches. The pipeline cannot produce that number.

Traced end to end:

- `ExtractedWorkIdentity` (`archive/dtos.py:131`) — the AI's identity extraction, `extra='forbid'`
  — has **no** composition-year field. It carries `composer_birth_year`, which is a different
  fact used to disambiguate the composer.
- `WorkLookupResult` (`archive/dtos.py:344`) — the MusicBrainz side — has none either.
- `_stamp(...)` in `resolvers.py:463-469` never stamps provenance for it.
- The only writer is `ArchiveManagementService._apply_piece_fields` (`services/management.py:94`),
  i.e. the manual write path.

So `Piece.composition_year` is null on every AI-ingested piece. The warning, and
`hasYearAnomaly`'s crimson triangle on the library row, fire only on a year the conductor typed
themselves — flagging the human's own input as a possible AI mistake.

The IPA-line-count check and the arranger-vs-modern-epoch check are real and do work.

**This needs a product decision before code:**

- **(a) Make the checks real.** Add `composition_year` to `ExtractedWorkIdentity` with a prompt
  description that distinguishes composition date from edition/arrangement date (the classic
  confusion on a reprint's title page), set it in `_merge_piece`, stamp AI provenance in
  `_stamp`, and add `"composition_year"` to `METADATA_PROVENANCE_FIELDS` so it grows a chip and
  joins the review meter — it is already in the server's `_PROVENANCE_TRACKED_FIELDS`, so
  verify/edit stamping needs no change. Cost: a few output tokens per ingest; the risk is a
  hallucinated year, which is precisely what the check then catches.
- **(b) Drop the pretence.** Delete both year branches from `AIHallucinationWarning` and
  `hasYearAnomaly` from `PieceRow`, leaving the two checks that work. Cheaper and honest, but
  the conductor loses the field entirely on AI-ingested pieces.

Recommendation: **(a)**. The year is on the title page the model already reads, the field
exists, the review apparatus around it exists, and it is the single most common thing a
conductor wants to know about a piece that the archive currently cannot tell them.

Estimate: ~2 h plus one ingest to verify against a real score.

---

## 3. Open — C: `ArchivePieceCardPage.tsx` is 1450 lines

Not a defect — the page works and its structure is sound. But it holds four presentational
components (`LabeledField`, `CockpitSection`, `FieldGroup`, `LegendDot`, `ReviewMeter`), the
zod schema, the patch-diffing submit, and the whole render tree in one file. It is the piece of
the archive most likely to be edited next, and every edit now costs a full read.

Suggested split, behaviour-preserving:

```
ArchivePieceCardPage.tsx      page shell, data wiring, submit, approve
components/CockpitSection.tsx CockpitSection + FieldGroup + LabeledField
components/ReviewMeter.tsx    ReviewMeter + LegendDot
components/PieceMetadataForm.tsx  the zod schema, TEXT_FIELD_KEYS, the three FieldGroups
```

Constraint: `pieceCardSchema` and `TEXT_FIELD_KEYS` must stay together — they are two halves of
one contract (which fields are blank-not-null on PATCH; see the `reference_serializer_blank_vs_null`
gotcha). Verify with `npm run build`; the developer checks the UI visually.

Estimate: ~2 h.

---

## 4. Endpoint map (as of this pass)

```
GET    /api/archive/editions/active/          in-flight ingestions      → ActiveIngestionsPanel
GET    /api/archive/editions/orphans/         FAILED and piece-less     → OrphanIngestionsPanel
GET    /api/archive/editions/{id}/events/     SSE live progress         → useLiveIngestion
POST   /api/archive/editions/{id}/approve/    AWAITING → READY          → Piece Card action tray
POST   /api/archive/editions/{id}/reingest/   re-run (bills again)      → EditionsList, orphans panel
POST   /api/archive/editions/{id}/cancel/     stop mid-flight           → ActiveIngestionsPanel
POST   /api/pieces/{id}/verify_field/         stamp MANUAL, no edit     → ProvenanceChip
```

A FAILED edition that *did* reach a Piece stays on that piece's card (`EditionsList` shows the
error and the retry). Only piece-less failures go to `orphans/` — the two lists must not
overlap, or the same dead upload grows two doors.
