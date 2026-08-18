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

### Cost consequence — this section was wrong, see Stage 2

It predicted Sonnet 5 would cost **more** per score than Sonnet 4.6 (~$0.08 → ~$0.11), reasoning
from a ~30% tokenizer expansion plus higher image-token counts, and accepted that as the price of
better extraction.

Stage 2 measured it and found the opposite: **31% cheaper and 2.6× faster at identical accuracy.**
Input grew only ~9%, and Sonnet 5 reached the same result in 39% fewer *output* tokens — which at
$15/1M is where the bill actually lives. The reasoning above was not wrong about input tokenization;
it was wrong about which side of the ledger dominates.

The paragraph is kept rather than deleted because its closing premise still governs every decision
in this document: at these volumes AI spend is not the bottleneck — conductor correction time is.
That is why Stage 2 declined to cut `effort` for a cost saving it could not show was free.

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
made.

**Live proof, Stage 2 (2026-08-18):** `claude-sonnet-5` accepted, six real analyses returned
`stop_reason=end_turn` on `attempt=1`, pricing and cost attribution work end to end. What is still
unproven live: **`thinking: {"type": "disabled"}` has never been sent.** `analyze_score` and the
harness both run with thinking enabled; only `generate_program_note` takes the disabled path, and no
programme note has been generated on Sonnet 5 yet. 1.1 remains verified in shape only — Stage 3 is
where it meets the API.

### Question this

- Does Sonnet 5 still default to adaptive thinking when `thinking` is omitted? The whole of 1.1
  rests on it. If Anthropic changed the default, the explicit `disabled` branch is still correct
  and harmless — but the urgency argument evaporates.
- Is the Opus 5 `thinking: disabled` + `effort >= xhigh` rejection still real? If it was lifted, the
  guard becomes dead code worth deleting rather than carrying.
- ~~Is 49152 right?~~ **Answered in Stage 2:** over-cautious but harmless. Peak measured output is
  16 724 tokens, so even 32768 would not have truncated. An unused budget is not billed; lowering it
  only buys truncation risk on a long anthem. Left alone.

---

## Stage 2 — Golden-set measurement and `effort` tuning

**Status: DONE (2026-08-18) — Sonnet 5 confirmed, `effort` decision deliberately deferred**

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

### What was actually built and run (2026-08-18)

**The upgrade's stated rationale does not apply to this archive.** Stage 1 justified Sonnet 5 by
high-resolution vision for *scanned* scores. The developer confirmed scans are practically absent —
the real population is born-digital engravings that ship a text layer alongside the page image, where
raster resolution is not the constraint. Of the six real scores on disk, four carry no raster at all,
one is a 1215 px image (below even the *old* 1568 px ceiling, so both models see identical pixels)
and exactly one page — `Cicha_noc` p2, a 300 DPI scan — could in principle show the difference.
Corollary worth keeping: a scan only tests high-resolution vision if its long edge exceeds 1568 px.
A 150 DPI photocopy is downsampled the same by both generations.

Stage 2 therefore stopped being a tuning exercise and became a **keep-or-roll-back test**.

Golden set lives at `voct_data/golden_set/` (gitignored — copyrighted editions), 6 scores,
51 identity cells, 23 sung-text phrases, with a `README.md` recording why each file is in the set
and which fields were deliberately left unscored. The rule applied: only what the page answers
unambiguously goes into `expected.json` — an omitted field costs nothing, a wrong expectation
poisons every future comparison. Left out and documented: `composer_full_name` where the score
credits only an arranger (what a required field should hold when the source is silent is a product
decision, not a page fact), two-name and no-space arranger credits (measures formatting, not
extraction), and `musical_key` for accidental-bearing tonics (no canonical `B-flat`/`B♭`/`Bb` form).

Harness changes in the same commit:

- `sung_text_contains` — per-file phrases matched against the transcribed `sung_text`,
  **diacritic-sensitive** (the identity fold strips diacritics and would erase the signal), and
  punctuation-insensitive so an incidental syllable hyphen still matches the word while the
  engraver's word-joining underscore does not.
- `--only FILENAME` (repeatable) — iterating on one score must not re-bill the set.
- `_MODEL_OUTPUT_CEILING` gained the legacy ids. Without them the lookup fell back to the caller's
  `max_tokens`, so a baseline run could not escalate at all while the current model got two
  attempts — an asymmetry that would have read as a quality win for the new model.
- Token totals in the summary, because the cent column moves with the system prompt's cache state.

### Results

Two files (`01_adoro_te_devote` — 5 pages, Polish/Latin alternating verses, underscore-joined
underlay; `06_wsrod_nocnej_ciszy` — 3 pages, syllabified Polish underlay, arranger-only credit).
15 identity cells + 10 phrases per configuration. Cost at **standard** rates, not the promo.

| Configuration | Identity | Sung text | Cost | Wall time | Output tokens |
|---|---|---|---|---|---|
| `sonnet-4-6` / medium | 15/15 | 10/10 | 35¢ | 281 s | 18 089 |
| `sonnet-5` / medium | 15/15 | 10/10 | 24¢ | 110 s | 10 993 |
| `sonnet-5` / low | 15/15 | 10/10 | 17¢ | 57 s | 5 413 |

Per file, Sonnet 5 / medium: Adoro 20¢ / 101 s, Wśród nocnej ciszy 4¢ / 9 s. The spread is the
ECONOMY rules — a wholly-Polish score returns no IPA and no translation, so it costs a fifth of a
bilingual one. Every call returned `stop_reason=end_turn` on `attempt=1`; nothing truncated.

### Decisions

**Keep Sonnet 5 — on measured grounds, not the ones Stage 1 argued.** Identical accuracy to Sonnet
4.6 at **31% lower cost and 2.6× lower latency**. The mechanism is output volume: Sonnet 5 reached
the same perfect result in 39% fewer output tokens, and output at $15/1M dominates the bill. Input
grew only ~9% (20 283 → 22 110), not the ~30% the tokenizer estimate predicted.

**Default `effort` stays `medium`.** `low` matched it on every cell and is a third cheaper again, but
the set does not discriminate: *every* configuration scored 100%, including the old model. A test
everything passes cannot rank quality, and promoting a quality-reducing dial on that basis is the
error this stage exists to prevent. It is also the wrong trade for this project — the spec's own
premise is that AI spend is not the bottleneck, conductor correction time is, and lower effort
trades exactly the wrong way for an unmeasured gain. Promote `low` only after the golden set
contains cases that actually separate configurations (ambiguous credits, a multi-movement work,
an unclear key) and `low` still matches `medium` on them.

**Do not touch the `ANALYZE_SCORE` prompt.** A gap was hypothesised in its `== SUNG TEXT ==` section:
it never says the underlay is syllabified and must be reassembled into words. The measurement
refuted it — both models reconstruct `w_Ho-stii` → `w Hostii` and `w_o-fie-rze` → `w ofierze`
correctly as written, 10/10 phrases including the tightest underlay in the set. Changing a prompt
that scores perfectly would invalidate the cache and the provenance version for nothing.

**Leave `ANALYZE_MAX_TOKENS` at 49152.** Peak observed output is 16 724 tokens (Sonnet 4.6 on the
5-page bilingual score); Sonnet 5 peaked at 10 465. So 49152 is roughly triple what the hardest file
in the set needs — but an unused budget is not billed, and lowering it only buys a truncation risk on
a long anthem. Stage 1's "Question this" asked whether 49152 was over-cautious: yes, harmlessly.

### Still open

- The set is 6 files, of which 2 are measured. The spec's original target was 10–15 with hard cases.
  Every configuration scoring 100% is the symptom of a set that is too easy, not of a solved problem.
- Sung-text scoring covers 23 phrases, not full transcription fidelity. It catches the named failure
  modes; it does not measure IPA alignment or translation quality at all.
- `xhigh` / `max` and Opus 5 were not run. With accuracy already at ceiling they can only cost more;
  they become worth measuring when the set contains files that `medium` fails.

Spend for this stage: 93¢ reported at standard rates (~74¢ actual under the promo), including one
17¢ call lost to a console-encoding crash on the host before its result was scored.

### Question this

- Both models scored 100%. That is a statement about the golden set, not about the models — treat
  every conclusion above as bounded by two born-digital scores whose fields were chosen for being
  unambiguous. The cost and latency findings are robust (large, consistent, mechanistically
  explained); the accuracy finding is only "no regression on easy material".
- The keep-Sonnet-5 decision now rests on cost and speed. If a future release inverts that, the
  decision inverts with it — there is no longer a capability argument holding it in place.
- `_normalize` still strips diacritics for identity fields, so a Polish composer name misread as
  `Kramarz`/`Kramarz` with a wrong diacritic scores as a hit. Only the sung-text path is
  diacritic-sensitive.

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
| Sonnet 5 vision = 2576 px; Sonnet 4.6 = 1568 px | Anthropic docs. **Irrelevant to this archive** — Stage 2 found the scores are born-digital. |
| Sonnet 5 tokenizer ≈ +30% tokens | Anthropic migration docs. **Measured at ~+9%** on real score PDFs (Stage 2). |
| Absent `thinking` = adaptive on Sonnet 5 | Anthropic docs |
| Opus 5 rejects `thinking: disabled` at effort ≥ xhigh | Anthropic docs |
| Cache minimum: 1024 (Sonnet) / 512 (Opus 5) | Anthropic docs |
| Gemini 258 tokens per PDF page, 3072 px, 1000 pages | ai.google.dev — primary source |
| Gemini / GPT per-token pricing | **Third-party aggregators. Verify at source before acting.** |
| ~$0.08 per score today, ~$0.11 on Sonnet 5 | **Falsified.** Measured 2026-08-18: Sonnet 5 is 31% *cheaper* than 4.6. Per-score cost is dominated by sung language, not model — a wholly-Polish score skips IPA and translation and costs 4¢ against 20¢ for a bilingual one. |
| Sonnet 5 accuracy ≥ Sonnet 4.6 | **Measured, weakly.** 15/15 identity + 10/10 phrases for both, on two born-digital scores. Establishes no regression; does not establish superiority. |
| Peak output for one analysis = 16 724 tokens | Measured (Sonnet 4.6, 5-page bilingual score). Sonnet 5 peaked at 10 465. |
| GPT PDF-page tokenization | **Never verified.** Would decide any GPT comparison. |
