# Score Package Compiler — Model Upgrade to Claude Sonnet 5 (2026-08)

## How to read this file

This is a **staged refactor spec**, not a record. Each stage carries a `Status:` line and a
`Verify state` block that tells you how to check the *code* — never this document — for whether
the stage is already applied. The document can be stale; `grep` cannot.

Stages are independent commits. Stage 1 is a prerequisite for every other stage.

Background for the "why" lives in `archive-ai-ingestion-pipeline.md` (how the pipeline works) and
`archive-ai-compiler-remediation.md` (the 2026-06 audit, CLOSED). Neither needs re-reading to
execute this spec.

---

## Working agreement for every stage

Whoever picks up a stage — including the model that wrote this file — follows these:

1. **Be critical of this plan.** It was written 2026-08-18 from a code audit plus web research.
   Model behaviour, pricing and SDK defaults move fast. If a step looks wrong when you get to it,
   say so and stop — do not implement something you believe is incorrect just because it is
   written here. Every stage has a `Question this` block listing the assumptions most likely to
   have rotted.
2. **Check what is already done first.** Run the stage's `Verify state` block before editing.
   Partial application is expected (sessions get interrupted); re-applying an edit that is already
   in place is how you corrupt a file.
3. **Verify once, at the end.** Do NOT run tests, ruff, mypy or builds after each edit. Make every
   change in the stage, then run the verification block once, fix what it reports, and stop.
   Continuous test output is noise the developer does not want.
4. **Update the `Status:` line** of the stage you finished, in the same commit.
5. Commit straight to `master`. No branches, no worktrees.

---

## Why this refactor

The audit (2026-08-18) found the pipeline architecture **sound** — three-tier cost governance, the
overloaded-vs-terminal error taxonomy, `max_tokens` escalation with per-attempt billing, cooperative
cancel and the golden-set harness are all good and stay untouched. The problem is model currency
and two latent bugs that a naive model swap would trigger.

The pipeline runs `claude-sonnet-4-6`, two generations behind. The upgrade target is
**`claude-sonnet-5`**, chosen for one concrete reason: it is the first Sonnet-tier model with
high-resolution vision (2576 px long edge vs 1568 px). The dominant task is reading lyrics set
under staves on scanned choral scores — raster resolution is the lever that matters, not
general model intelligence.

### Cost consequence, stated honestly

Sonnet 5 is **more expensive per score than Sonnet 4.6**, despite identical $3/$15 sticker pricing:

- its tokenizer produces ~30% more tokens for the same text
- high-resolution vision raises image tokens per page

Estimated cost per typical 8-page SATB score: **~$0.08 → ~$0.11**. Across a 500-score archive that
is ~$40 → ~$57, one time. This is accepted deliberately: at these volumes AI spend is not the
bottleneck — conductor correction time is, and correction time is what better extraction buys back.

### Rejected alternatives — do not re-litigate without new evidence

| Option | Verdict | Reason |
|---|---|---|
| Kimi (Moonshot) | Rejected | Task is multi-page vision over scanned scores with Polish diacritics + IPA. K2 is a text model; the VL line is far smaller. Saving would be ~5¢/score. |
| GPT-5.6 | Rejected | No pricing or quality advantage over the other two. PDF-page tokenization was never verified — that is the number that would decide it, and nobody measured it. |
| Gemini 3.x | **Rejected for now, but the strongest alternative** | Genuinely cheaper (258 tokens/page nominal vs ~1500–4784) and technically better on two axes: 3072 px raster ceiling and a 1000-page limit vs Anthropic's ~100 (`MAX_PDF_PAGES`). Rejected because total saving across the whole archive is ~$35 against a week of rewrite: `ai_client.py` (~630 lines), a different caching model, the provenance enum migration, and prompt re-tuning from scratch. Revisit only if unreadable scans or the 100-page split become a real operational pain — that is a *capability* argument, not a cost one, and it is the one that would win. |
| Fable 5 | Rejected | Priced above the Opus tier and requires 30-day data retention. No fit. |

---

## Stage 1 — Safe-swap prerequisites + the swap itself

**Status: DONE (2026-08-18)**

The four blocking defects are fixed in the same commit as the swap, because they are precisely what
makes the swap safe. Splitting them would leave a commit whose only effect is latent breakage.

### 1.1 `thinking` must be set explicitly — BLOCKING

`ai_client.py` set the `thinking` key only when `enable_thinking` was true. On Sonnet 4.6 an absent
`thinking` key means thinking is off. **On Sonnet 5 an absent `thinking` key means adaptive thinking
is ON.** `tasks.generate_program_note` passes `enable_thinking=False` deliberately — extended
thinking shares the `max_tokens` budget and starved the note's output (the historical stub-note
bug). Swapping the model without this fix silently reintroduces that bug.

Fix: add an explicit `else` branch setting `{"type": "disabled"}`.

Related constraint, guarded in the same place: **Opus 5 rejects `thinking: disabled` at
`effort` `xhigh` or `max` (HTTP 400).** Current call sites use `effort="medium"` so nothing breaks
today, but Stage 3 puts Opus 5 on the thinking-disabled path, so the guard goes in now.

### 1.2 Provenance model map — BLOCKING

`services/provenance.py` maps model id → `ProvenanceSource` and **falls back to `AI_OPUS` on an
unknown id**, logging only a warning. A bare model-constant swap would therefore label every
Sonnet-produced field as "Opus" in the review cockpit while `model_version` said otherwise.

Fix: add `claude-sonnet-5` / `claude-opus-5` keys. Old keys stay so a model rollback keeps working.

`ProvenanceSource` DB values are tier codes (`'AIS'`, `'AIO'`) so **no data migration is needed**.
Its *labels* were version-pinned (`'AI — Sonnet 4.6'`) and are now version-agnostic so they stop
rotting; the exact model id per row already lives in `model_version`. Those labels appear in no
`.po` catalogue (verified), so this costs no locale work — but Django tracks `choices` in
migrations, hence the cosmetic `AlterField` in `archive/migrations/0025_alter_provenancerecord_source.py`.
It touches no data. **It still has to be applied — `make migrate` is manual in every environment.**

### 1.3 Pricing table — BLOCKING

`_PRICING` raises `AIClientError` on an unknown model, so this one fails loudly rather than
silently — still a prerequisite. Sonnet 5 is $3/$15, Opus 5 is $5/$25 (identical to Opus 4.8).

Sonnet 5 introductory pricing of $2/$10 runs to **2026-08-31**. The table deliberately keeps the
$3/$15 standard rate: during the promo this over-reports spend, which is the safe direction and
consistent with the table's existing round-up policy. No action needed on 2026-09-01.

### 1.4 Token budget headroom

`ANALYZE_MAX_TOKENS` 32768 → 49152. The +30% tokenizer pushes the consolidated analysis (sung text
+ line-aligned IPA + translations + adaptive thinking, all sharing one budget) closer to truncation,
and each escalation re-bills the whole call. 49152 stays under the 65536 per-model ceiling so one
escalation step remains available.

Cost ceilings rise to match the more expensive model, so a long score fails on quality grounds
rather than on a budget that no longer reflects reality: per-run 100¢ → 150¢, lifetime 500¢ → 750¢.
Daily budget stays at 2000¢ — it is a runaway-loop circuit breaker, not a per-score allowance.

### 1.5 Housekeeping

- `anthropic>=0.88.0` → pinned exact. This pipeline depends on SDK-version-sensitive defaults
  (`thinking`, `output_config.effort`); an unpinned floor lets a container rebuild change behaviour.
- Eval harness `--effort` gains `xhigh` / `max` (supported by Sonnet 5 and Opus 5), and its
  `--max-tokens` default now imports the pipeline constant instead of duplicating the literal.
- Three untruthful comments corrected: the provenance docstring said `claude-opus-4-7` while the map
  said `4-8`; `_MODEL_OUTPUT_CEILING` claimed "Sonnet/Haiku 64K" when Sonnet's cap is 128K; the
  `ai_client` header named the old model tier.

### Verify state

```bash
# All three must print the new ids; none may print 4-6 / 4-8:
grep -n "claude-sonnet-5\|claude-opus-5\|claude-sonnet-4-6\|claude-opus-4-8" \
  backend/archive/infrastructure/ai_client.py backend/archive/services/provenance.py
# Must show the explicit disabled branch:
grep -n "disabled" backend/archive/infrastructure/ai_client.py
# Must print 49152:
grep -n "ANALYZE_MAX_TOKENS" backend/archive/tasks.py
```

### Verification command (run ONCE, at the end)

```powershell
& .venv\Scripts\python.exe -m ruff check backend\archive
& .venv\Scripts\python.exe -m mypy backend\archive
& .venv\Scripts\python.exe backend\manage.py makemigrations archive
& .venv\Scripts\python.exe backend\manage.py test archive --settings=config.test_settings_sqlite
```

**Verified 2026-08-18:** ruff clean, mypy clean (35 files), 57/57 archive tests pass, migration
generated. Note what this does *not* prove: the suite mocks the Claude client, so no live call was
made. Stage 1 is verified correct in shape, not accepted by the API — the first real proof that
`claude-sonnet-5` and `thinking: disabled` are accepted arrives in Stage 2.

### Question this

- Does Sonnet 5 still default to adaptive thinking when `thinking` is omitted? The whole of 1.1
  rests on it. If Anthropic changed the default, the explicit `disabled` branch is still correct
  and harmless — but the urgency argument evaporates.
- Is the Opus 5 `thinking: disabled` + `effort >= xhigh` rejection still real? If it was lifted, the
  guard becomes dead code worth deleting rather than carrying.
- Is 49152 right? It is derived from a ~30% tokenizer estimate, not a measurement. Stage 2 produces
  the real number — if no golden-set file truncates at 32768, this was over-cautious.

---

## Stage 2 — Golden-set measurement and `effort` tuning

**Status: NOT STARTED**

Stage 1 makes Sonnet 5 *safe*. Stage 2 establishes whether it is *better*, and finds the cheapest
`effort` that holds quality. This stage **cannot be executed by an agent alone** — it needs the
developer's API key and the golden PDF set, and every file is a real billed call.

**Blocker, found 2026-08-18: no golden set exists.** Nothing matching `*golden*` or an
`expected.json` is anywhere in the repo or gitignored paths. The harness was built in 2026-06 and
never fed, which means every quality claim about this pipeline to date — including the ones that
motivated the v2 rewrite — rests on spot-checking, not measurement. Stage 2 therefore starts with
human work that cannot be delegated: choose ~10-15 representative PDFs (clean engraving, faint
scan, Polish carol with an arranger credit, Latin motet, multi-movement work, a bilingual score,
and at least three that print **no** composition year so the null-discipline rule is measurable),
then hand-write `expected.json` from what is actually printed on each page.

Store it outside the repo or in a gitignored path — these are copyrighted editions.

The essentials once it exists:

- Baseline first: run the harness against `claude-sonnet-4-6` **before** relying on Stage 1's
  numbers, so the comparison has a floor. The model constant is now Sonnet 5, so the baseline needs
  a temporary override rather than the default path.
- Then Sonnet 5 at `effort=medium`, then a sweep (`low` / `medium` / `high`) and, if the golden set
  shows scan-related misses, `xhigh`.
- Optionally Opus 5, to price the quality ceiling. At these volumes the Sonnet-5-to-Opus-5 delta is
  roughly 5¢ per score — noise against conductor correction time, so decide on field accuracy alone.
- Record per-field accuracy, cost and wall time per configuration in a results table appended to
  this file. Whatever wins becomes the new default `effort` in `tasks.analyze_score`.

Do this **before 2026-08-31** if convenient — Sonnet 5 introductory pricing makes the sweep a third
cheaper, and a sweep is the most call-heavy thing in this spec.

### Question this

- The harness scores identity fields only (`SCORABLE_FIELDS`). It does **not** score sung-text
  fidelity, IPA alignment or translation quality — the outputs high-res vision was supposed to
  improve. A pass on identity is therefore weak evidence for the actual thesis of this upgrade.
  Consider adding a sung-text similarity check before trusting the result.
- `_normalize` strips diacritics on both sides, so a Polish transcription error in exactly the place
  that matters most (`Bóstwo` vs `Bostwo`) scores as a hit. Fine for identity, misleading if the
  harness is ever extended to sung text.

---

## Stage 3 — Programme note on Opus 5

**Status: NOT STARTED**

Move `tasks.generate_program_note` from Sonnet to Opus 5. The note is ~900 input tokens and ~400
output: **~1.5¢ on Opus 5 vs ~0.9¢ on Sonnet 5**, a difference of six tenths of a cent per note. It
is also the only text in this pipeline that reaches the audience verbatim, printed in a concert
programme. Opus 5 writes materially better prose.

Depends on Stage 1's explicit `thinking: disabled` (1.1) and its effort guard — without both, this
stage either re-breaks the stub-note bug or 400s.

Secondary benefit: `GENERATE_PROGRAM_NOTE` is ~480 tokens, below Sonnet's 1024-token minimum
cacheable prefix, so its `cache_control` marker is currently dead. **Opus 5's minimum is 512
tokens** — still above 480. The marker stays dead unless the prompt grows past 512 tokens; if this
stage also expands the prompt, caching starts working as a side effect. Do not expand it *just* to
cross the threshold — a 5-minute-TTL cache is worth little on an on-demand, one-at-a-time call.

### Question this

- Is prose quality actually the constraint? If conductors rewrite notes for reasons other than
  style (wrong facts, wrong length, wrong tone), a better writer model fixes nothing and the
  prompt or the fact sheet is the real target.

---

## Stage 4 — Provider-pluggable eval harness

**Status: NOT STARTED — optional, deferred by design**

The golden-set harness is the most valuable asset in this subsystem and it is welded to `AIClient`.
Extracting a provider protocol — one method, `analyze(pdf_bytes, instructions) -> (ScoreAnalysisResult,
CallCost)` — turns "should we switch to Gemini?" from an argument into a command, permanently, for
every future model release. Estimated ~150 lines including a Gemini implementation.

Deliberately last: it is an investment in knowledge, not a fix. Stages 1 and 3 correct defects and
come first. Do not start Stage 4 to answer a question nobody is currently blocked on.

---

## Measured vs assumed

Honesty ledger, so nobody treats an estimate as a fact:

| Claim | Basis |
|---|---|
| Sonnet 5 vision = 2576 px; Sonnet 4.6 = 1568 px | Anthropic docs |
| Sonnet 5 tokenizer ≈ +30% tokens | Anthropic migration docs |
| Absent `thinking` = adaptive on Sonnet 5 | Anthropic docs |
| Opus 5 rejects `thinking: disabled` at effort ≥ xhigh | Anthropic docs |
| Cache minimum: 1024 (Sonnet) / 512 (Opus 5) | Anthropic docs |
| Gemini 258 tokens per PDF page, 3072 px, 1000 pages | ai.google.dev — primary source |
| Gemini / GPT per-token pricing | **Third-party aggregators. Verify at source before acting.** |
| ~$0.08 per score today, ~$0.11 on Sonnet 5 | **Estimate.** Real figure: `ScoreEdition.objects.filter(ingestion_cost_cents__gt=0).aggregate(Avg('ingestion_cost_cents'))` |
| GPT PDF-page tokenization | **Never verified.** Would decide any GPT comparison. |
