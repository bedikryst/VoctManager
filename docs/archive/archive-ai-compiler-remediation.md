# Archive AI compiler — audit and remediation

Status: **closed** · Audited 2026-08-17 · Surface: `frontend/src/features/archive/`
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
| 12 | Two of `AIHallucinationWarning`'s three checks compared a `composition_year` the pipeline could never produce — the field was null on every AI-ingested piece | The AI now extracts it (§2). Both schemas, `_merge_piece`, `_stamp`, the review meter and a chip on the card |
| 13 | `ArchivePieceCardPage.tsx` held five presentational components, the form contract and the whole render tree in 1450 lines | Split into `CockpitSection` / `ReviewMeter` / `PieceMetadataForm`; the page is ~950 lines of shell, wiring, submit and approve (§3) |

**Investigated and dismissed:** local edit buffers in `MovementRow` / `TranslationRow` do not
re-seed after a refetch. This looked like a staleness bug, but `persist_analysis` is idempotent
and *skips* populated children (`if not piece.movements.exists()`), so a re-ingest cannot
rewrite a movement title underneath an open editor. The only path is two managers editing the
same piece at once, which single-tenant VoctFoundation does not have. Adding a reconciling
buffer here would be machinery for a scenario the pipeline cannot produce.

---

## 2. Shipped — B: the year checks can now fire

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

**Resolved as (a) — the AI extracts the year.** `composition_year` is now on both
`ExtractedWorkIdentity` and `ScoreAnalysisResult`, projected through `_identity_from_analysis`,
written by `_create_piece`, blank-filled by `_merge_piece`, stamped `AI_SONNET` by `_stamp`, and
listed in `METADATA_PROVENANCE_FIELDS` — so it grows a chip on the card and joins the review
meter. It was already in the server's `_PROVENANCE_TRACKED_FIELDS`, so verify/edit stamping
needed no change. Seven tests in `archive/tests.py`.

**The prompt is written as a SOURCING rule, not as a definition** — this is the whole substance
of the change and the part to preserve on any future edit:

- The hard case is not "composition year vs edition year". It is that a reprint's title page
  usually prints NO composition date at all, only the publisher's. A field defined as "the
  composition year" therefore has no correct answer on most scores, and the model's two
  attractors are the year it can SEE (©) and the year it REMEMBERS ("Ave verum — 1791").
- Describing the distinction defends only against the first. The second is the dangerous one: a
  recalled year is plausible, sits inside the composer's lifespan, and so passes the very check
  this field exists to feed. Hence the explicit anti-recall clause, mirroring the sung-text rule
  ("transcribe the words PRINTED ON THIS SCORE… even when the work is famous") that already
  fights the same pull. Null is stated as the expected answer.
- Null is free: `_stamp` skips empty values and the rollup only counts fields with a provenance
  row, so a score with no printed date adds nothing to the conductor's backlog.
- A year outside 500-2100, or non-numeric, degrades to null rather than raising —
  `ScoreAnalysisResult` is parsed from model-authored JSON, where one stray field must not cost
  the whole run.

**Known limits — do not oversell these checks.** The lifespan comparison needs a `composer` with
parseable dates, which traditional carols, hymns and folk arrangements (the bulk of this
archive) do not have; for those the warning stays silent whatever the year says. And it only
catches years OUTSIDE the lifespan, never a plausible invented one. What actually protects the
record is the provenance chip and the review meter: the field arrives unverified and a human
clears it before approve. `composition_year` is in `evaluate_ingestion`'s `SCORABLE_FIELDS` —
measure it with golden entries that expect **null**, since the failure mode worth counting is a
year invented for a score that never printed one.

---

## 3. Shipped — C: `ArchivePieceCardPage.tsx` split

Never a defect — the page worked and its structure was sound; it was simply 1450 lines, so every
edit to the most-edited surface in the archive cost a full read. Split with no behaviour change:

```
ArchivePieceCardPage.tsx          page shell, data wiring, submit, approve  (~950)
components/CockpitSection.tsx     CockpitSection + FieldGroup + LabeledField
components/ReviewMeter.tsx        ReviewMeter + LegendDot
components/PieceMetadataForm.tsx  pieceCardSchema, TEXT_FIELD_KEYS, the three FieldGroups
```

`pieceCardSchema` and `TEXT_FIELD_KEYS` deliberately live in one file — they are two halves of
one contract (which fields are blank-not-null on PATCH; see the `reference_serializer_blank_vs_null`
gotcha), and the page imports both from there. The page still owns the single `useForm` instance
and passes it down, because the composer, divisi and duration controls outside the metadata block
are driven by the same form; `PieceMetadataForm` renders that instance rather than owning a
second one.

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
