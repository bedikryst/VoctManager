# Copy desk — the site's editorial surface (2026-09)

Spec for what `docs/web-board-feedback-2026-09.md` called "Etap 2 — translation review surface".
The stage changed shape during design and is now a different object; this file is the authority
for it, and §1 of the board-feedback file points here.

## How to read this file

- **§1 What changed and why** — the reframe. Read this before questioning any decision below.
- **§2 The two-iteration rule** — the sequencing (all three locales at once, never PL-then-the-rest),
  how OUR translation passes are run, and the separate rule that a Polish edit invalidates what was
  built on it.
- **§3 Architecture** — where it lives, who is source of truth, how someone gets in.
- **§4 The segment** — the unit everything else is built on.
- **§5 `concerts.yaml`** — the measured corpus and the `*Pl` trap that blocks three locales.
- **§6 Order of work** — stages, and what each one delivers. **§6a** and **§6b** record what stages
  A and B shipped; **§6c** splits stage C and states the four defects that forced the split.
- **§7 Traps** — things that look correct and ship wrong.
- **§8 Open decisions.**

Companion to `.ai/07_marketing_public_site.md` (rules) and `docs/web-landing-guardrails.md` (the
negative space). Nothing here overrides those two.

---

## §1 What changed and why

The board-feedback roadmap specified a **read-only noindex route** rendering PL | EN | FR side by
side, so Florent could *check* translations of copy whose Polish was finished. Two facts from the
developer changed that:

1. **Florent wants to edit the Polish**, especially on the concert pages, where his musical
   authority is the reason the text exists at all. The Polish is not frozen source — it is copy he
   is expected to improve.
2. **He will not do this in rounds.** He wants all three locales in front of him at once.

A read-only page cannot serve either. If he can only annotate, he has to describe locations in
prose ("Contact page, second paragraph"), the developer hunts for the string, ambiguities become
e-mails, and the stage costs the exact three sittings he refused.

So the object is not a translation review surface. It is a **copy desk**: a permanent editorial
surface over the site's whole text, in every locale, where Florent is editor-in-chief and
translation is one of the operations performed on a segment rather than the point of the exercise.

Two consequences that are easy to miss:

- **It is a route, not a handover.** A document mailed to a reviewer is a snapshot; the desk
  renders whatever the modules currently hold. When Etap 3 (`/press`) and Etap 4 (liturgies) add
  copy, the same link shows the new segments flagged as new since his last visit — he returns to a
  handful of rows, not to a re-read. This is the strongest argument for the route, stronger than
  "a spreadsheet loses the inline `<em>`".
- **Concert detail pages come first, not last.** The roadmap excluded them from *translation* on
  value grounds and that judgment still holds for the reader-facing question. But for *editing*
  they are first, and three independent reasons converge: they are the text Florent cares about
  most, they are two thirds of the corpus, and they are the cheapest to make editable because
  `concerts.yaml` is already a separate structured data file — nothing to extract from templates.
  Highest value and lowest cost are the same object.

The developer's correction, recorded because it moderates the above: the Polish is **not** a throwaway
AI draft. It comes either from Florent's own PDFs or from the developer's redaction of them, and is
already at a usable level. Expect nuance, word choice and clause order — not rewriting. That is why
translating now, against the current Polish, is not wasted work.

## §2 The two-iteration rule

### First, the sequencing this keeps being confused with

**Florent is handed PL, EN and FR at once. There is no round in which he approves the Polish and
the translations are written afterwards.** It comes straight from §1.2 — he will not work in
rounds — and §6's stage E is where it is scheduled: both locales are drafted against the Polish as
it stands, *before* he has seen the desk. The board-feedback file says the same thing in one line:
"he approves all locales at once".

The objection this answers is "why translate copy the editor is about to change". Because of what
he is going to change: syntax, word choice, clause order, the occasional recast sentence — §1's
closing paragraph, which is the developer's own correction and the reason the Polish is not treated
as a throwaway draft. Repairing a translation after an edit of that size is one segment's work and
the desk finds the segments for you (the source hash, below). Holding two locales back until the
Polish is declared final costs the stage a second sitting, which is exactly what §1 says he refused.

A Polish rewrite deep enough to invalidate the *sense* of a whole page is the case where this would
be wasted work — and it is the case §1 measured and does not expect.

**A translation this project produces is never handed over on the pass that wrote it. Minimum two
iterations: draft the locale, then re-read the whole of it against the Polish. If the second pass
finds anything, there is a third.** This is a rule about OUR work — the agent's EN and FR drafts —
not about how many rounds a human editor is allowed.

The reason is what translating ~8 700 words per locale actually does to a writer. Drafting is
sequential and local: each segment is rendered against the one Polish sentence in front of it, and
the faults that matter are the ones only visible from outside that window — a term rendered two
ways in two concerts, a register that drifts from programme-book to blurb across a long page, a
line that reads fine in English and no longer says what the Polish said, a French incipit that
picked up hard spaces `lib/typo.ts` is about to add again. None of those are visible from inside
the sentence that produced them, and none of them are caught by "check as you go", because the
checker is the drafter at the same altitude.

So the second pass is a different job from the first and has to be run as one: read the locale end
to end **beside the Polish**, segment by segment, with the drafting finished. Terminology and
register are checked across concerts, not within one. Do not merge it into the drafting pass and do
not treat it as proofreading — spelling is not what it is for.

**Iteration count is a floor, not a plan.** Two is the minimum; the third pass is decided by what
the second one finds, not scheduled in advance. Size the stage as if there will be three.

### And separately: a Polish edit invalidates its translations

Not the same rule, and easy to file under it. Florent edits the Polish — that is the point of the
desk — and every Polish edit, even a single word, puts the two translations built on it out of
date, because a translator renders a *sense* and the sense is what he is adjusting. So a segment
whose Polish moved is retranslated against the new Polish and goes back marked *source changed
since your translation* — and the retranslation is itself subject to §2 above.

The desk must make that cheap, which is what §4's source hash is for. A build that cannot tell
which translations are stale has not implemented this, whatever the UI looks like.

## §3 Architecture

### Git stays source of truth

The database holds **proposals**. Git holds the site. Never the other way round.

An editor's change is a proposal until the developer accepts it; accepted proposals are written into
`concerts.yaml` and the content modules by a script, reviewed as an ordinary `git diff`, committed
and deployed. Nothing reaches the public site without passing through a diff.

The alternative — database as source of truth, Astro building from an API — is a real CMS and was
rejected on three grounds. It removes the site's copy from git (losing blame, diff and review,
including on the legal texts, which must never change silently); it makes the static build depend on
a live backend; and it flattens copy that is deliberately interwoven with composition and the
guardrails. The proposal model uses the same data shape a CMS would need, so it is not a dead end: a
later "trusted editor publishes directly" mode is an addition, not a rewrite.

### Where it lives

**A mode inside the VoctManager panel**, not a second application. Accounts, roles, notifications,
the design system and i18n all already exist there; a standalone app on a subdomain rebuilds every
one of them.

- **Layout takeover.** The desk is not a tab competing for chrome. Entering it replaces the whole
  app shell — no nav dock, no sidebar, full bleed for the text — with a single `← Panel` affordance
  in a corner. Route tree of its own (`/redakcja/*`), its own shell component; the panel's shell is
  not rendered at all.
- **`translate.voctensemble.com`** is the address editors are given: a DNS-level redirect into that
  route tree. It is a convenience, not an architecture — no code lives at that host.

### Who gets in

**Do not add a fourth `AppRole`.** Measured: ~180 occurrences of `is_manager` across 28 backend
files and ~100 of `isManager` in the frontend, and the decisive ones are **negative** —
`ManagerRoute` (`if (!isManager(user))`), `ConductorDeck`, `useCommandItems`. The codebase splits
the world binarily into manager and not-manager, so an `EDITOR` role would land in the not-manager
branch everywhere and be served as an artist: schedule, materials, personal file. That is ~280 call
sites to audit for a permission that is orthogonal to what a role means here.

Instead: **a capability flag on `UserProfile`** (`can_edit_site_copy`), independent of `role`. It
disturbs nothing. Florent and Ania already have accounts; the flag is set from Django admin — no
frontend UI for editor management in this stage, deliberately.

**Token links are deferred, not rejected.** When a genuinely external reviewer appears (a translator
who is not in the ensemble), the right door is a per-person signed link, not an account: it keeps a
stranger out of the identity model entirely — no acceptance of a choir application's terms they will
never use, no RODO footprint, and revocation is deleting a row. Build it then. What must **not** be
built is an anonymous public picker ("I am working as Florent"): proposals are harmless because the
developer gates them, but an unattributed edit destroys the one fact the two-iteration rule depends
on — who wrote this, and against which source.

## §4 The segment

The unit of everything: one editable field of one page or concert.

| part | purpose |
|---|---|
| `key` | stable dotted id — `concert.wcielenie.program.3.note`, `page.kontakt.hero.lede` |
| `kind` | `text` (plain) or `html` (inline `<em>/<strong>/<a>` allowed) — decides the editor and the sanitizer |
| `locale` | which column this value belongs to |
| `value` | the proposed text |
| `source_hash` | hash of the **Polish** value this translation was made against |
| `status` | `draft` / `proposed` / `accepted` / `rejected` |
| `author`, `updated_at` | attribution; the reason anonymous access is refused |

Two derived states drive the whole UI and both come free from the fields above:

- **stale** — a non-Polish segment whose `source_hash` no longer matches the current Polish. This is
  the two-iteration rule made mechanical.
- **new since last visit** — a segment created after the editor's last session. This is what keeps
  later stages from reading as a fresh wall of text.

The key must be derivable from the content module or YAML path in **both** directions: the extractor
produces it, and the apply script writes back through it. A key that can only be generated one way
turns acceptance into manual patching, which at ~500 segments is a guaranteed error.

### What the editor sees

Reading order, in the site's typography — not a table. Section headings, then paragraphs, each one
clickable into an inline editor. A locale switch above the text (PL / PL+EN / PL+FR / all three;
three columns are too tight on a laptop for a long paragraph). Per-segment: the original under a
toggle, a one-line comment field, and the status chip. Per page: a contents list with counts —
segments, touched, accepted, new — so an editor can see what they have already done, which was an
explicit request.

### What the developer sees

A notification when an editor proposes changes. The same view in reviewer mode: old → new per
segment, accept / reject / edit further. Accepted segments accumulate into a patch that
`npm run apply-copy` writes into the repo. Then: `git diff`, commit, deploy.

## §5 `concerts.yaml` — the measured corpus and the blocking defect

### Measured

12 143 words total (the roadmap's "15.9k" counted YAML syntax).

| category | words | disposition |
|---|---|---|
| Polish prose (`note` 2904, `gallery[].alt` 621, `verbum` 557, `movements[].line`, `about` 485, `programArc` 388, `essence`, `prologue`, `pullQuote`, `reflection`, `programNote`, `facts`, `meta`, `video.caption`…) | **~6 500** | translate |
| vernacular glosses of foreign originals (`textPl` 1565, `inscriptioPl` 422, `claspTextPl` 243, `movements[].pl`) | **~2 200** | translate — but see below, this is verse |
| foreign originals (`text` 1698, `inscriptio` 191, `claspText` 227) | ~2 100 | **never translated** |
| proper names & structure (`composer`, `work`, `roster.groups[].names`, `credits[].name`, years, voicing, file stems) | ~1 300 | never translated |

So roughly **8 700 words per locale**, ~17 400 words of output for EN + FR.

### The `*Pl` suffix means two different things

This blocks three locales and would have shipped as silent nonsense.

```yaml
text:    "Es ist ein Ros' entsprungen…"    # the German original — content, not a locale
textPl:  "Wyrosła różdżka…"                # NOT the Polish variant of the page
inscriptio:   "Et egredietur virga…"       # Latin — present in every locale
inscriptioPl: "I wyrośnie różdżka…"        # a gloss
movements:
  - lat: "Prophetia"
    pl:  "Zapowiedź"                       # same shape again
    line: "Zanim padnie słowo o Dziecku…"  # ordinary prose
```

`textPl` is **not** the Polish rendering of `text` in the i18n sense. It is *the translation of a
foreign original into the reader's language*, and on the English page that slot must hold an English
translation. Adding `textEn` beside `textPl` creates two incompatible meanings of the same suffix in
one file, and nobody would later be able to tell which `Pl` is a locale and which is content.

**The rename, before any EN/FR data exists:**

```yaml
text: "Es ist ein Ros' entsprungen…"
textGloss: { pl: "Wyrosła różdżka…", en: "…", fr: "…" }
inscriptio: "Et egredietur virga…"
inscriptioGloss: { pl: "…", en: "…", fr: "…" }
movements:
  - lat: "Prophetia"
    gloss: { pl: "Zapowiedź", en: "Prophecy", fr: "Prophétie" }
```

This is a mechanical migration of the existing file plus the components that read it, and it must
land **before** translation starts, not alongside it. **Shipped 2026-09-02 — see §6a for what it
actually did and the two places it departs from this sketch.**

**And one more departure, from C3 (§8, §6f):** the `en`/`fr` slots sketched above never get filled.
A locale map in `concerts.yaml` is `pl`-only and the schema enforces it; the gloss's English and
French live in `concerts.en.yaml` / `concerts.fr.yaml` under the same desk key. The rename's point
survives intact — the map still marks "this is the vernacular of a foreign original, not a locale
of the page" — it just holds one language.

**The rule the file now states in its own header, and the one to hold the line on:** a locale map is
what a *foreign original's vernacular* takes, and nothing else. `movements[].line` is not one — an
earlier draft of this block showed it as a map, and it is ordinary Polish prose exactly like
`note`, `essence`, `programArc` and `gallery[].alt`. Making one prose field a map while the other
forty stay strings puts two shapes for one thing back in the file, which is the fault the rename
exists to remove. All prose migrates together or not at all; today it is `pl`-only strings entering
the desk by key (§4), and how it holds three locales is stage G's question, not stage A's.

### Sung texts are translated in full (decided)

Every locale gets the original **and** a gloss in the reader's language. This is the layer that
carries the site's meaning; a French reader looking at an untranslated 16th-century German stanza is
being handed the wrong object.

Where a canonical published translation of a hymn exists, **use it and credit it** rather than
inventing one — "Lo, how a rose e'er blooming" is the English of this text, and an invented
alternative reads as an error to anyone who knows the repertoire. For anything whose author died
less than 70 years ago, the canonical translation is under copyright: flag it rather than pasting
it, and treat the rights question the way `docs/…` already treats ZAiKS.

### Biblical references are locale-dependent

`inscriptioRef: "Iz 11, 1"` — the book abbreviation and the separator differ per language
(`Is 11:1` in English, `Is 11, 1` in French). Either localize the string per locale or store the
reference structurally (book id + chapter + verse) and format it. The second is correct and cheap
at this size; do it during the rename.

### Dates baked into prose

`meta: "Bazylika NSPJ, Kraków · 20 stycznia 2024"` and `verbum.speaker: "o. Jarek Naliwajko SJ ·
20 stycznia 2024"` embed a Polish-formatted date inside a translatable string. Translating the
string by hand carries the date along and it will drift from the structured `date` field. Split the
date out and format it from the existing date value per locale. Note the known trap: Polish and
French month/day capitalization does not survive naive formatting (see the project's
`reference_polish_interpolation_dates`).

## §6 Order of work

| # | stage | delivers |
|---|---|---|
| A | `concerts.yaml` locale-map migration (§5) + components that read it — **done, §6a** | the file can hold three locales at all |
| B | backend: segment model, proposals API, `can_edit_site_copy`, notification — **done, §6b** | proposals can exist |
| C1 | the key contract + extractor (read direction) + the hash-parity fixture — **done, §6d** | the corpus has stable ids |
| C2 | the ingest seam: the extractor's door, retirement, `applied_at` + segment stamp — **done, §6e** | the mirror can be refreshed |
| C3 | `apply-copy` (write direction) + the `en`/`fr` overlay files — **done, §6f** | proposals can reach git |
| D1 | panel: `/redakcja/*` shell + contents list — **done, §6g** | a way in |
| D2 | the editor: reading-order column, locale switch, inline edit, autosave — **done, §6h** | the desk |
| D3 | reviewer mode: old → new, accept / reject / edit further — **done, §6i** | the patch gets made |
| E | EN + FR draft for all six concerts (~8 700 words × 2), pass 1 — **EN pass 1 done, §6j** | Florent's first sitting |
| F | `/en/koncerty/[id]`, `/fr/koncerty/[id]` routes, per-concert `TRANSLATED_ROUTES`, hreflang | the pages exist |
| G | static pages extracted into content modules (`kontakt`, `koncerty` index, `obrazy`, `kolofon`, chrome), then landing | the rest of the corpus enters the desk |

### §6a Stage A — what shipped (2026-09-02)

`concerts.yaml` migrated in one pass by a throwaway line-level script (never a YAML round-trip: the
file's comments are half its value, and a parse-and-dump would have deleted every one of them).
Each transform asserted it could reproduce the ORIGINAL Polish string from what it wrote, which is
what made a 611-line diff safe to accept. Counts: 6 `metaPlace`, 2 `dateLabel`, 1 `speaker`,
60 `inscriptioGloss`, 28 structural refs, 42 `textGloss`, 9 `claspTextGloss`, 25 `gloss`.
Verified in `dist/`: every dateline, citation and gloss renders character-identical to before, and
the node counts per class match the YAML counts exactly.

**Four decisions worth carrying.**

- **The locale map requires `pl` and leaves `en`/`fr` optional** (`LocalizedText`,
  `pickLocale`, both in `i18n/config.ts`). Polish is the source a translation *renders*, so a map
  without it would be a translation of nothing — no fallback on the Polish page, and nothing for
  §4's `source_hash` to hash. Fallback is per FIELD, not per concert: a half-translated evening
  builds and prints Polish only where the English is still missing.
- **The dateline is composed at render, never stored.** `metaPlace` is the place half (copy, per
  locale); the moment comes from `date` through `lib/dates` (`longDate(iso, locale)` — ICU gives
  lowercase months in PL/FR and `en-GB` day-first, all three correct) or, where the day is genuinely
  vague, from a `dateLabel` map ("jesień 2025"). `verbum.speaker` is now the name alone, with the
  concert's own date appended — "o." is "Fr" in English and "P." in French, so the name is copy and
  the date never is. A `superRefine` fails the build on a concert with neither `date` nor
  `dateLabel`, because the alternative is a hero that prints a place, no moment, and no error.
- **`inscriptioRef` is structural** (`lib/scriptureRef`): `{ scripture: [{ book, chapter,
  chapterAlt?, verses[] }], source? }`. Three things in "Iz 11, 1" are language choices, not one —
  the abbreviation, the chapter/verse mark (`, ` in PL/FR, `:` in EN) and the mark between two
  verse groups (`. ` in PL, `, ` in EN), which is why `verses` is a LIST: "Ps 84, 2–4. 7" is the one
  citation in the corpus that has two. The book table ships complete in all three locales because a
  book abbreviation is a lexical fact, not copy for Florent to review — it is the only en/fr text
  this stage wrote.
- **`source` exists because not every incipit comes from a numbered verse.** Four references are
  named sources ("Salve Regina", "Introit Requiem", "Modlitwa za Ukrainę"), and they are copy: the
  first is a proper title that stays itself in all three, the second is "Requiem Introit" in
  English, the third is a translation. A locale map is right for all of them and the translator's
  job includes knowing which is which.

**One finding for whoever translates this file.** `inscriptioPl` was doing two jobs, not one, and
`inscriptioGloss` inherits both: on a work with an `inscriptio` it is that Latin's vernacular, but
on a work WITHOUT one it is a standalone editorial note occupying the same slot — "tekst:
H. M. MacGill (1876)", "aranżacja współczesna kolędy polskiej", "na sześć głosów wysokich · fermata
ciszy na końcu". Those are our prose about the work, not a translation of anything, and rendering
them back against a Latin that is not there would invent a source. §5's corpus table counts the
whole 422 words as "vernacular glosses"; some of it is ordinary editorial Polish.

**Left standing, deliberately.** The CSS hooks still read `.kd-text-pl`, `.kd-movement-pl`,
`.station-inscriptio-pl` and their siblings. They are page-scoped presentational names, `-pl` there
means "the gloss column" rather than a locale, and `.kd-inscriptio-gloss` is already taken by the
wrapper span — so renaming them now buys nothing and collides. Sweep them when stage F forks the
route, which is also when the three locales stop sharing one file.

### §6b Stage B — what shipped (2026-09-02)

New Django app `copydesk` (`/api/copydesk/*`), plus the capability flag and the notification.

**§4's segment is TWO tables, and that is the one real departure from the sketch above.**
`CopySegment` is a *projection of git* — key, locale, kind, the value the repository currently
holds, and the page/label/order the desk renders it by. `CopyProposal` is what the database
actually owns. The split is forced by the two derived states: "stale" needs the current Polish and
"new since last visit" needs to know when a segment first appeared, and neither is a fact about a
proposal. Nothing in the API writes the mirror — the extractor does, through
`CopyDeskService.upsert_segments`, and `update_or_create` keeps `created_at` a true first-seen (a
reconciliation that recreated rows would flag the whole corpus as new on every run).

**Five decisions worth carrying.**

- **Staleness is measured against the Polish as it currently *means*, not as it currently ships.**
  `effective_source_hashes` prefers an accepted-but-unapplied Polish proposal, then an open one,
  and falls back to the repository value. Waiting for the commit would leave a window in which a
  translation whose source has already moved reads as fresh — exactly the silence §2 exists to
  break. Where the sketch says `source_hash` is one field, it is now two: on the *segment* it is
  the Polish the published translation renders (stamped at apply); on the *proposal* it is the
  Polish the editor wrote against.
- **A blank hash means "unknown", never "fresh".** Every translation predating the desk carries
  one, and the DTO reports `is_stale` and `source_known` separately so the desk can say so rather
  than dressing ignorance up as freshness.
- **The hash normalizes, and every rule is one the TypeScript extractor must mirror** (`hashing.py`
  is the SSOT, `normalize_for_hash` is exported for exactly that): NFC, CRLF→LF, hard spaces folded
  to ordinary ones, ends stripped. Interior whitespace is deliberately left alone. The hard-space
  rule is load-bearing — `lib/typo.ts` inserts those at build time, so without it a typographic
  pass would mark every translation on a page stale.
- **One open proposal per person per segment, revised in place; two editors may compete.** The
  desk autosaves, so a row per keystroke would bury the reviewer — but auto-resolving a clash
  between Florent and Ania would silently discard somebody's words. The reviewer sees both.
  `ACCEPTED`/`REJECTED` are terminal and a further change is a new proposal, so the record of what
  was decided against which Polish survives the next edit.
- **`can_edit_site_copy` is a capability; reviewing is `is_staff`.** Editing and reviewing are
  different powers: accepting is not an opinion about wording, it is the decision to put a value
  into the repository and commit it. Managership is the wrong test — §3 expects an editor to be a
  manager. `copy_desk_seen_at` sits beside the flag on `UserProfile`, server-side for the same
  reason as `welcome_seen_at`: a visit is a fact about the person, not about a browser.

**§8's notification decision, resolved: one digest per editor per sitting, raised by the clock.**
Per segment was rejected on three counts — volume (~500 segments, of which one concert page is
dozens), granularity (the reader's unit of action is one trip to reviewer mode, so a message per
segment is an alert per thing nobody acts on individually), and the fact that a sitting that
crossed three pages is honestly described by its counts rather than split into three notifications
all leading to the same screen. The harder half was defining "a session": §1 rules out rounds and
the desk autosaves, so there is no submit button to hang a digest on. **The session boundary is a
pause** — `copydesk.dispatch_copy_proposal_digests` reports an editor only once their most recent
unannounced proposal is older than `QUIET_PERIOD` (30 min), on the same hourly beat and with the
same claim-before-dispatch guard as the announcement nudge. A continuous two-hour sitting therefore
produces one message, not four, and one proposal still being typed holds back the whole sitting
rather than having its older half reported out from under the editor. Revising a proposal clears
`notified_at`: wording that no longer stands was described by a digest that already went out.

`SITE_COPY_PROPOSED` is **not** in `DIGESTIBLE_TYPES` — it is already a digest, and batching a
batch would cost it up to a day for nothing. Its preference group `site_copy` needed a new
`staff_only` flag on `PreferenceGroup`: the group's audience is narrower than manager, and without
it every other manager would be shown a switch over a notification they cannot receive, which is
the one fault `notifications/delivery.py` exists to prevent.

**Left for stage C, with the fields already in place.** `applied_at` on the proposal and
`GET /api/copydesk/proposals/patch/` (accepted-and-unapplied, keyed by `key`+`locale`, which is what
the apply script addresses in the YAML) are the seam `apply-copy` writes through. The extractor's
entry point is `upsert_segments`; it must produce keys matching `KEY_PATTERN`, and `scope` is always
derived from the key, never supplied.

**The reviewer's route is `/redakcja/przeglad`.** Promised by the push, the e-mail CTA and the
bell's deep-link; stage D owns the shell but not this address.

A–D are infrastructure and can be verified without any translation existing. E is the long pole and
is where pass 1 of §2 happens. G's last item — the landing — is deliberately last: the guardrails
forbid restructuring its composition, and its copy is the most tightly bound to it.

`/press` is **not** in this list. It is rewritten in Etap 3 (897 → ~300 lines); translating it first
is the one piece of work in this plan that would genuinely be thrown away. It joins the desk after
the recut, and Florent is told up front that a small second batch is coming — a stated expectation
costs nothing, a surprise costs his goodwill.

### §6c Stage C, split into three — and why

**Measured before splitting.** `concerts.yaml` yields **428 Polish segments** across the six
concerts — 279 ordinary prose strings and 149 locale maps — from **47 field families**, the largest
being `program[].note` (58), `program[].inscriptioGloss` (55), `gallery[].alt` (48) and
`program[].textGloss` (42). At three locales that is **1 284 desk rows**. The size is not the reason
to split; the count of independent judgments is. Deciding, for 47 families, whether a field is copy
at all, which locales may hold it, what its label reads and where it sorts, is 47 decisions that no
build or test can check — and doing them in the same pass as the two mechanically dangerous scripts
is how one of them gets made by accident.

**Four defects found by reading the shipped code, not by writing new code.** Each is the kind that
builds green and fails silently, and each would have been hit mid-pass by a single-run stage C.

1. **Two thirds of the corpus has nowhere to put a translation.** **Closed in C3 — §6f: the overlay
   files receive all of them.** Only the `*Gloss`/`localized` maps
   and `about.{en,fr}` can hold one; ordinary prose is a bare `z.string()`. So 279 of 428 fields —
   558 of the desk's translation rows — could be proposed, reviewed and accepted with no slot in the
   repository to receive them. §5 deferred "how prose holds three locales" to stage G, but stage E
   *writes those very translations*: the real deadline is before C3, and it is now §8's decision.
2. **Nothing ever stamps `CopySegment.source_hash`.** **Closed in C2 — §6e.** §6b puts the stamp at apply time and the apply
   path did not exist, so today every translation row reports `source_known=False` in perpetuity and
   the stale state — §2 made mechanical, the entire reason the hash exists — never fires once.
   `apply-copy` must carry the accepted proposal's `source_hash` onto its segment in the same call
   that sets `applied_at`; `upsert_segments` must keep leaving that column out of its `defaults`
   (it does), or the next extractor run erases the provenance it just recorded.
3. **There is no ingest seam, and no retirement.** **Closed in C2 — §6e, which chose the endpoint.**
   `upsert_segments` is a Python classmethod, the
   extractor is a node script reading YAML in `web/`, and Postgres publishes no host port — so
   something has to carry one to the other. **Recommended: a staff-only ingest endpoint**, so the
   whole loop is one command run from the repo (`npm run copy:sync` = extract, then POST), which is
   also how `apply-copy` must already reach the database. It does not break the rule that the desk's
   API never writes the mirror: that rule is about the EDITOR-facing routes, and this door is
   staff-only with a git-derived payload. Guard it by refusing to run against a dirty
   `src/content/` — a mirror built from uncommitted text describes a site nobody is serving. The
   alternative, a management command fed over `docker compose exec -T … < file`, avoids the new
   endpoint at the cost of coupling the loop to the server; C2 chooses. Separately, nothing removes
   a key that has left the site: a deleted `note` would sit on the desk forever. Whatever carries
   the rows also prunes what the extractor did not emit, **scoped to the scopes it actually read**
   — a run over one concert must not retire the other five, and a run that retires many keys at
   once must say so loudly, because that is the signature of a shifted list (§6d).
4. **`about.en.title` already holds the English concert title.** **Closed in C3 — §6f: the block is
   gone and `concert.<id>.title` owns it.** `concert.<id>.title` in `en` and
   `concert.<id>.about.en.title` are one fact with two homes. The contract names ONE owner and
   makes the other a render-time fallback; otherwise the desk asks an editor to write the same
   sentence twice and whichever copy is not written goes stale without a signal. **Narrowed while
   building C1:** it is the ONLY such pair. `about.place` ("Bazylika NSPJ · Kraków") and
   `metaPlace` ("Bazylika NSPJ, Kraków") are different lines for different surfaces, and
   `about.blurb` is a shorter register than `essence` — so `about.{en,fr}.place`/`blurb` are
   legitimate translations of their own fields rather than duplicates of anything.

**C1 — the key contract and the extractor.** The contract is a table, one row per field family:
YAML path → key template, `kind`, `label`, `order`, and which locales the repository can hold for
it. It is the stage's real output; the extractor is a walk over it. `scope` is never in the table —
it is `scope_from_key`, both sides. Verified by `node --test`: every emitted key matches
`KEY_PATTERN`, resolves back to exactly one YAML path, and is unique across the corpus; and the
**hash-parity fixture** — one file of adversarial strings (NBSP, narrow NBSP, thin space, CRLF, NFD
`é`, `ł`, a block scalar's trailing newline) with expected digests, read by BOTH the node test and a
new Python test, so a drift between `hashing.py` and its mirror fails on both sides rather than
marking the whole corpus stale one day. Reads YAML through a parser, which is safe: the ban in §7 is
on parse-and-**dump**.

**C2 — the ingest seam.** The door defect 3 describes, the scoped prune with its loud report, and
`POST /api/copydesk/proposals/applied/` (reviewer-only) which stamps `applied_at` and defect 2's
segment hash together. Backend-shaped, backend-verified: ruff, mypy, copydesk tests on sqlite.

**C3 — `apply-copy`.** Writes Polish back into `concerts.yaml` by line and translations into the
overlay files, authenticating with reviewer credentials against `/api/token/` because the host
cannot reach the database. Dry-run is the default. §8's decision shrinks the dangerous half to one
operation — replacing a Polish scalar in place, never inserting a key — and it still gets two
proofs, not one: each transform reconstructs its own pre-image (stage A's rule), and the whole file
is re-read afterwards to assert that every untouched field is byte-identical and the comment count
is unchanged. The second is what would actually catch a stray parse-and-dump. C3 also empties the
`about.en`/`about.fr` blocks into the overlays, so that each fact ends up with exactly one home.

**D is split for the opposite reason.** C's risk is silent data damage and its check is a test; D's
risk is a surface nobody can read, and its only check is the developer's eye — which cannot be
applied to three surfaces built in one sitting, because by the third the first is no longer being
looked at. D1 ends with an empty shell and a real contents list, D2 with one page editable, D3 with
the reviewer's queue; each is a thing to open and judge before the next is designed on top of it.
The canon is `.ai/04_design_system.md`, and the takeover in §3 means the desk composes the panel's
primitives without the panel's chrome — not that it invents its own.

### §6d Stage C1 — what shipped (2026-09-02)

`web/copydesk/`: `contract.mjs` (the table), `extract.mjs` (the walk), `index.mjs`
(`npm run copy:extract`), `normalize.mjs` (the hash mirror), `fixtures/hash-parity.json`, and
`copydesk.test.mjs` (`npm run test:copydesk`), plus a `HashParityFixtureTests` on the Python side.
**46 copy families against 65 not-copy rows; 427 keys, 1 281 desk rows, 28 of them already
translated** — the `about.en`/`about.fr` blocks, which are the only translations the repository
holds today.

**Five decisions worth carrying.**

- **The contract's declaration order IS the desk's reading order.** `order` is a counter over the
  table, laid out in the sequence /koncerty/[id] prints — hero, próg, słowo, refleksja, program,
  cytat, głosy, zapis, obrazy, koda — with the two fields that live on /o-nas at the end, saying so
  in their label. Re-ordering the table re-orders the desk and never touches a key.
- **Both tables are complete, and a test enforces it.** The suite walks every leaf in the corpus
  and fails on a path that neither `CONCERT_CONTRACT` nor `NOT_COPY` names. This is the only
  mechanical form §7's warning can take — "when a new field appears beside a `lat`/`text`/
  `inscriptio`, ask which meaning its name carries" is otherwise a sentence in a document nobody
  opens while editing YAML. The reverse direction (a table row for a path the corpus lacks) is
  reported, not asserted: five of them are optional fields six concerts have not used yet, and
  only the zod schema could tell those from a field that was removed.
- **A list is keyed by a natural id where one exists that is not itself copy** — `gallery[].img`
  and `movements[].id` — and by position everywhere else. Position is stable only under APPEND:
  inserting a work mid-programme re-keys every work below it and the desk loses their proposals and
  their first-seen date. Accepted because a past concert's programme does not gain a work, and
  guarded in C2 rather than prevented — a run that retires many keys at once has the signature of a
  shifted list and must say so instead of pruning quietly. `roster.groups[].voice` and
  `credits[].role` look like natural keys and are not: they are the values about to be translated.
- **The hash mirror does not use `trim()`.** JavaScript strips U+FEFF, which Python does not treat
  as whitespace at all; Python strips U+0085 and U+001C–U+001F, which JavaScript leaves standing.
  Two of the twenty parity cases exist for exactly this, and a naive mirror passes eighteen of them
  — which is the shape of the failure worth designing against, since the eighteen would have been
  read as proof.
- **Every segment in this corpus is `TEXT`.** There is no `<em>`, `<strong>` or `<a>` anywhere in
  `concerts.yaml`, so §7's `contenteditable` trap and the `HTML` sanitizer path do not bite until
  stage G brings the static pages in.

**Two more dates baked into copy — §6a's sweep was incomplete.** Both print Polish on the English
page and neither is caught by anything today. `reflectionAttribution` carries one inside a
translatable string ("Florent de Bazelaire · 20 stycznia 2024"), which is exactly what
`verbum.speaker` was before stage A split it, and it will drift from the concert's own `date` the
moment either is edited. `viaDate` is a hand-written Polish abbreviation of the same moment
("sty 2024", "jesień 2025") — it is excluded from the desk because a date is never copy, not
because it is harmless: the via-rail will print "sty 2024" on the English page until it is derived
from `date`/`dateLabel`. Both are recorded in the contract at the field they affect. Fix them where
stage F forks the route, or earlier if a locale ships first.

### §6e Stage C2 — what shipped (2026-09-02)

Two staff-only endpoints and the client that closes the loop: `POST /api/copydesk/segments/ingest/`
(reconcile the mirror, then retire), `POST /api/copydesk/proposals/applied/` (stamp `applied_at` and
carry the provenance onto the segment), and `web/copydesk/sync.mjs` — `npm run copy:sync`, which is
`copy:extract` plus the POST plus the guard.

**Five decisions worth carrying.**

- **The door is HTTP, not a management command** — §6c's recommendation, taken. Three reasons, and
  the third is the one that settles it. The loop runs from a checkout on any machine, which is how
  `apply-copy` must already reach the database, since Postgres publishes no host port. The rule that
  the desk's API never writes the mirror is about the EDITOR-facing routes; this door is staff and
  its payload is derived from git. And the alternative pipes ~300 kB of Polish prose through
  `docker compose exec -T … < segments.json`: on this developer's Windows shell that is a recorded
  way to lose UTF-8 silently (the same trap that once killed an `OPŁACONE` on a `¢`), and a mirror
  corrupted that way looks like copy nobody wrote rather than like an error.
- **The clean-tree guard is a client, and can only be one.** The server has no checkout to inspect,
  so `copy:sync` refuses on a dirty `src/content/` (`--allow-dirty` overrides) and the payload
  carries the revision it claims, which the ingest logs. What the server can offer is traceability,
  not enforcement: when a mirror looks wrong the first question is which tree it was built from.
- **The prune is narrowed to the scopes the payload carried, and it is a soft delete.** A payload is
  the truth about the pages in it and says nothing about the others, so extracting one concert
  leaves the other five standing. Retirement keeps the tombstone, and a key that comes back gets a
  NEW row rather than reviving the old one — with positional keys (§6d), `program.3.note` returning
  is not evidence that it is the same note, and handing its proposals to whatever now sits at
  position 3 would attach an editor's comment about one work to another.
- **A run that retires more than five keys says so, names them, and counts the proposals it
  stranded.** Above the threshold the log line is a WARNING and `copy:sync` prints a block instead
  of a line. It reports rather than refuses, deliberately: the extractor is the authority on what
  the site holds, a run that blocked on its own reading would leave the mirror describing a page
  that no longer exists, and the undo for a false alarm is `restore()`. The threshold is a smoke
  alarm and not a proof — inserting into a three-item list trips nothing — which is why the message
  names the keys: a shifted list is recognisable by eye, because the names share a prefix and run
  consecutively.
- **The apply stamp moves the segment's VALUE as well as its hash.** This is the one write into the
  mirror that is not the extractor's, and it is narrow on purpose: the caller has just written that
  exact string into the working tree, so the projection is being told what git now holds. Carrying
  only the hash is not enough — when a Polish edit and the translations written against it are
  applied in one patch, staleness is measured against the Polish the MIRROR holds, so the
  translations would read stale the moment they became correct. With the value moving too, the seam
  is consistent whichever order `apply-copy` and `copy:sync` run in. The other half of defect 2 is a
  negative and now has a test of its own: `upsert_segments` still keeps `source_hash` out of its
  `defaults`, and a test fails if it ever gains one, because the extractor knows nothing about
  provenance and would erase the stamp on the next run.

**Two smaller shapes, recorded because they are the sort of thing a later change quietly reverses.**
Re-posting an applied batch is a skip, not an error — a script that wrote the files and lost the
response has to be able to say so again — while an id that resolves to nothing stamps nothing at
all and returns it, because the ids come from `/proposals/patch/` and one that does not exist means
the script and the database disagree about what was written. And a row carrying a field the mirror
cannot hold is a 400 that names its POSITION: `SegmentUpsertDTO` forbids extras (`paths` travels
beside the rows, never inside them), and at ~1 300 rows an unlocated validation error is a hunt.

### §6f Stage C3 — what shipped (2026-09-02)

The write direction, in five files: `web/copydesk/yamlEdit.mjs` (the splicer), `overlay.mjs` (the
two locale files, read and written), `client.mjs` (the HTTP door both commands now share),
`apply.mjs` (`npm run copy:apply`), and `src/lib/copyOverlay.ts`, which is the read side the site
renders through. Plus `base_value` on `GET /proposals/patch/`.

**The `about.{en,fr}` blocks are gone.** 10 blocks, 28 values, 38 lines deleted and **zero
inserted**, by a throwaway line-level script that proved its own removal: no comment inside a
removed span, the removed slices put back reproduce the original file byte for byte, every other
leaf identical, comment lines 142 → 142. The 28 values now sit in `concerts.en.yaml` /
`concerts.fr.yaml` under the desk's own keys, and the extractor reads them from there: **427 keys,
1 281 rows, 28 translated before the move and after it** — the desk's view of the site did not
change by one row, which is the whole claim the move had to make.

**Six decisions worth carrying.**

- **The pre-image is the MIRROR's value, not the file's, and that is what makes the check worth
  running.** Comparing the file to itself proves nothing; `base_value` is what the desk believes
  the repository holds, so a mismatch means the tree and the mirror disagree — a hand edit in
  `concerts.yaml`, or a `copy:sync` older than the checkout — and the row is refused with both
  strings printed. It is value-level rather than byte-level for a concrete reason: the folded
  blocks in this corpus are hand-wrapped at deliberate points, so no emitter reproduces their bytes,
  and a byte-level pre-image would have failed on 112 of 427 fields.
- **The style is tried, not argued about.** Each candidate rendering is spliced into the real
  document and parsed THERE, and is kept only if the value comes back exactly. The field's existing
  style is tried first, so a diff shows the sentence that changed rather than a restyled block —
  and the fallbacks catch what no rule would have: a plain scalar whose new value is `2024` becomes
  quoted rather than a number, and one carrying `: ` or ` #` stops being plain. A folded block IS
  re-wrapped (greedy, ~100 columns, the corpus's own measure), which is the one visible cost.
- **Four proofs, and the cheapest one carries the weight.** Pre-image, in-situ re-parse, then:
  revert every span and the original file must return byte for byte — which subsumes the comment
  count, because a comment cannot survive being reconstructed if it moved. The fourth is a survey
  of every other leaf. Then the file is read back FROM DISK and checked again, and a write that
  fails that check is rolled back to the bytes it started from. Dry run is the default; `--write` is
  the flag that touches anything.
- **The corpus is Polish-only by rule now, and three independent things say so.** `localized` is
  `z.object({pl}).strict()`, so a hand-added `en:` fails the build instead of being silently
  stripped; the extractor throws, naming the path and the file to move it to; and the accounting
  test no longer covers `.en`/`.fr` siblings, so one appearing is an unaccounted field. Three
  guards for one rule is not belt-and-braces here — the failure it prevents is a fact with two
  homes, which is silent in every direction: whichever copy the reader is not looking at goes stale
  with nothing to say so.
- **An empty value is refused, and a refused row is a non-zero exit.** Writing `""` into a scalar
  deletes the field rather than clearing it, and the honest answer to an editor who emptied a box is
  to reject the proposal. A retired key still carrying an accepted proposal is reported on every run
  and keeps the exit code red — standing pressure to either restore the field or reject the
  proposal, where a green run would let it sit forever.
- **Two accepted proposals on one segment collapse to the last decision, and BOTH are stamped.**
  §6b keeps the competition on purpose; the apply script writes the later one and reports the
  earlier as superseded. Stamping only the winner would leave the loser in tomorrow's patch, to be
  written over the value that replaced it. A superseded row whose winner was refused is not stamped
  at all — nothing about that segment reached the repository.

**Left standing, deliberately.** `pickLocale` still reads `en`/`fr` off a `LocalizedText` at render
and the corpus can no longer hold either, so every surface but the /o-nas milestone list prints
Polish regardless of locale. Nothing regressed — the concert pages have no `en`/`fr` routes yet —
but **stage F's first job is feeding the overlay into those call sites**, not forking the route:
`metaPlace`, `dateLabel`, every `*Gloss` and `inscriptioRef.source` are read through `pickLocale`
today and each needs the overlay merged in before an English concert page can be anything but
Polish. `lib/registrum.ts` is the same story for the nav rail, where §6d's `viaDate` finding also
still stands.

### §6g Stage D1 — what shipped (2026-09-02)

The takeover and the contents list, in seven files: `widgets/copy-desk-shell/CopyDeskShell.tsx`
(the second shell in the app), `pages/copydesk/CopyDeskContentsPage.tsx`,
`pages/copydesk/CopyDeskReviewPage.tsx`, and `features/copydesk/` (the DTOs, the service, the
contents query, `lib/scopeGroups.ts`, and the two components). Plus the route tree in `App.tsx`,
`canEditSiteCopy` in `shared/auth/rbac.ts`, and one command-palette row. **1 281 rows across six
concert pages, every count resting at zero** — which is the correct picture and the whole point of
judging this surface before the editor is designed on top of it.

**Six decisions worth carrying.**

- **The shell gates the whole tree on ONE request, and the 403 IS the refusal screen.** The panel
  never learns `is_staff`, and the server admits staff to the desk whether or not the flag is set
  (§6b), so a client-side predicate could not be the gate without locking a developer out of their
  own reviewer route. `canEditSiteCopy` therefore decides one thing only: whether the panel OFFERS
  the way in. The contents query is both the gate and the first read, so the two pages below it
  share one cache entry rather than asking twice — and a corpus already in hand outranks a refetch
  that failed, because the reconciling tier re-asks on every mount and a train tunnel is not a
  revoked capability.
- **The visit is stamped on the way OUT, and D1 owns it because nothing else could.**
  `copy_desk_seen_at` is null until something writes it, and `is_new` is
  `seen_at is not None and created_at > seen_at` — so before this stage the `new` counter could
  never fire once, on any row, ever. Stamping on ARRIVAL would have been worse than not stamping:
  the counter would clear itself before the reader had seen what it counted. It is written from the
  shell's unmount, only if the corpus was actually read, and only as fire-and-forget — a stamp that
  fails is next visit's list being slightly longer, not something to interrupt an editor with.
- **Two kinds of figure per row, and the split is the design.** How big a page is and how much work
  stands on it (`segments`, `touched`, `accepted`) are FACTS about the row and read as one plain
  sentence through `StatLine`. What is NEW since the last visit and what has gone STALE under an
  edited Polish are exceptions: they wear a chip, and they appear only when they exist. Stale is
  GOLD, never crimson — a translation whose source moved is work waiting, not something broken —
  and new is `incense`, because it is news rather than work. A page nobody has touched says nothing
  beyond its size, which is what will keep a returning editor's eye on the handful of rows that
  changed instead of on six identical ones.
- **The rows do not open, and nothing on screen says they will.** §6c splits D is for judging one
  surface at a time; a row linking into an unbuilt editor would have been a second empty surface,
  and a sentence promising one would be stage-note copy somebody has to remember to delete. The
  rows carry no hover, no chevron and no pointer cursor, so nothing invites the click that has
  nowhere to go. **D2's first move is making the row a link.**
- **The contents list has no page order of its own.** The payload arrives ordered by scope KEY —
  `concert.9-kart`, `concert.aeternam`, `concert.bobola` — which is slug order and means nothing to
  a reader. It is grouped by key family (`concert.*` today, `page.*` from stage G) and sorted by
  title inside the family, which is at least the order somebody hunting for a title looks in. The
  site's own sequence is chronological and the desk carries no date per page: putting it right means
  the extractor emitting a per-scope order, and that is a contract change, not a sort.
- **A `segment` is a ROW, and the page says so once.** The count is key × locale, so a concert with
  71 editable fields reports 213 — a figure nobody can check unless the surface states what it
  counts. It is not divided by three anywhere: nothing guarantees a key holds all three locales once
  the extractor has retired a row.

**Two smaller shapes.** The desk is the THIRD surface that has to set `body.admin-mode` — the panel
shell and the auth shell are the others — because `body:not(.admin-mode) *` hides the cursor
outright, a rule left over from the public zone this app used to carry; a full-screen route that
forgets it is a screen with nothing to point at. And `PageTransition` gained an optional
`className`: its `min-h-screen` is the composite owning the caller's layout, right under the panel
(where a page starts at the top of the viewport) and wrong under any shell with a band above it,
where every short state scrolled by exactly the height of that band.

**Left standing, deliberately.** The `new` and `stale` chips cannot be seen yet — the first visit
has no `seen_at` to be new against, and no proposal can exist until D2 — so their design is the one
part of this surface the eye has not judged. And the palette row is gated on the profile flag alone,
so a staff account without `can_edit_site_copy` reaches the desk by URL (the server admits it) but is
not offered it; setting the flag on one's own account in the admin is the intended fix, and it is
also the only way to see what an editor sees.

### §6h Stage D2 — what shipped (2026-09-03)

The editor, at `/redakcja/:scope`: `pages/copydesk/CopyDeskScopePage.tsx`, `features/copydesk/`
(`components/SegmentRow`, `components/SegmentCell`, `components/SittingClosure`, `lib/fields`,
`lib/proposals`, `lib/localeView`, `model/sittingStore`, plus the segment DTOs, the three writes and
their cache patches), the contents row turned into a link, and the shell's back affordance stepping
to the spis rather than always to the panel. On the backend, one addition: `POST
/api/copydesk/notify/` and the `dispatch_digest_for_author` the hourly sweep now shares with it.

**§8's notification decision, amended: the pause stays the guarantee, and the editor may raise the
digest early.** The question re-opened before building was whether the desk should have a "confirm
and send" button instead of the 30-minute quiet period, the developer's own objection to it being
that an editor might not notice the button. The objection is right and it is not the decisive
argument; the decisive one is what each design does when the control IS missed. **A submit that
nobody presses leaves a finished evening unseen indefinitely, and neither party knows: the editor
believes they have delivered, the reviewer has nothing to read. A clock that nobody notices costs
half an hour.** One failure is silent and permanent, the other is a delay, so the clock keeps the
work and the button becomes an accelerator: it announces what is already saved, and pressing it is
the only thing it does. That also spares the model a state — "written but not sent" would have to be
honoured by the reviewer's queue, the patch endpoint and the digest, or the button would be a lie.

What the button genuinely buys, and the clock cannot, is **closure**: an editor learns their evening
arrived somewhere, which is the difference between finishing and wondering. Hence the shape — the
control appears in the rail only once this visit has written something, and comes back if the editor
carries on writing after pressing it; the foot of the column says in one sentence what happens if
they never do. It is never called *zatwierdź*: accepting is the reviewer's word for the decision to
commit, and one word over two powers is how an editor comes to believe they have published.

**Seven decisions worth carrying.**

- **The cell is a `<textarea>` at rest, not a paragraph that swaps into one.** A page is seventy-odd
  fields and the swap costs a measurement, a focus hand-off and a reflow per click; the `ghost` field
  shell already draws nothing until the pointer or the caret arrives, which is the same read for none
  of the machinery. Its height comes from a mirror span sharing one CSS grid cell — same type, same
  padding, a trailing U+200B so the last newline does not collapse — rather than from
  `scrollHeight`, so opening the three-language view does not run two hundred forced layouts.
- **The resting state says nothing at all.** The corpus is 1 281 rows; a row that decorates itself is
  1 281 things to look past. Chips appear only where a fact exists (a settled verdict, a Polish that
  has moved, another editor at the same paragraph), and the original, the comment field and the
  withdrawal appear only once the editor has written something. The language mark is a 24 px gutter
  and is dropped entirely when one language is on screen — the switch already said which.
- **Polish is in every view, which is what makes "the original" unambiguous.** The four views are
  PL / +EN / +FR / +EN +FR, so a translation is never on screen without the source it renders. The
  toggle under a touched cell therefore shows what the REPOSITORY holds for that cell — never the
  Polish, which is already beside it. The page's width follows the switch (3xl / 5xl / 7xl): a
  `note` of several hundred words set in three columns at 3xl is three ribbons.
- **The autosave patches the cache and deliberately does not recompute staleness.** The response
  carries an id and a status, so a settled sentence costs one round trip rather than a re-read of
  213 rows. But whether a Polish edit has just invalidated its translations is the SERVER's verdict
  — it hashes under the same normalization the extractor mirrors — and a second, hand-rolled answer
  in the client is how the desk would start disagreeing with the digest about which rows are out of
  date. The reconciling tier fetches the truth back on the next mount or window focus.
- **A cell adopts the server's value only while nothing of its own is in flight.** The reconciling
  tier refetches on every window focus, and an editor who alt-tabs mid-sentence must not come back to
  the paragraph they were replacing. The same ref makes the field flush on blur, on unmount and on a
  locale switch, so nothing depends on the debounce being the right length.
- **The corpus is not persisted.** The panel dehydrates its whole query cache for 24 h of offline
  paint; a day-old copy of the site's text restored on a cold boot would put an editor's paragraph
  next to a source that has moved, which is the exact silence the source hash exists to break.
  `meta: { persist: false }`, the same door the score-package blob uses.
- **The page's figures are counted from the payload it is drawing.** `71 pól · 213 segmentów ·
  4 ruszone` comes from the segments in hand, not from the contents list's row for the same scope:
  two figures beside each other answer for the same set of rows or they are not siblings.

**Two smaller shapes.** An emptied field says so WHILE it is being typed, because `apply-copy`
refuses an empty value outright — clearing a YAML scalar deletes the field rather than emptying it,
and the honest moment to say that is before the editor moves on. And §7's French spacing warning is
one sentence, in French, printed once per page whenever the French column is on screen, whatever
language the desk's own chrome is in: it is advice to the hands typing, not chrome to translate.

**Left standing, deliberately.**

- **A comment with an unchanged value is a real proposal** and reaches the reviewer as one. "This
  sentence bothers me and I do not know what it should say" is worth carrying; whether it should
  count as *touched* on the contents list is a question the reviewer's queue will answer better than
  a guess here.
- **Another editor's open proposal is named, not readable.** The cell says "Ania też tu pisze" and
  shows nothing of her wording — a competing draft displayed as text would invite an editor to revise
  a sentence the site has never carried. Reading both is the reviewer's screen, which is D3.
- **The sitting is client-side and shallow.** Reloading the page loses the counter, so the offer of
  an early digest disappears; nothing else changes, because the proposals are on the server and the
  clock reports them regardless. This is the one place where "it is only an accelerator" is doing
  real work.
- **No field-to-field keyboard motion, and 71 fields render at once.** Both are judgments to make on
  the built surface rather than in advance; the column is the thing to look at first.

### §6i Stage D3 — what shipped (2026-09-03)

The reviewer's queue at `/redakcja/przeglad`: `pages/copydesk/CopyDeskReviewPage.tsx` rewritten,
`features/copydesk/` (`lib/wordDiff` + its test, `lib/queue`, `components/DiffText`,
`components/ProposalVerdict`, `components/QueueField`, `components/PatchBand`,
`components/GrowingTextarea`), the queue read and the verdict write. On the backend, one addition:
`GET /api/copydesk/proposals/queue/` with `CopyDeskService.review_queue` and `patch_summary`.

**The queue needed a read of its own, and that was the first thing to settle.** Nothing could
answer "what is waiting" from the endpoints that existed: the contents list counts touched segments
per page and names none of them, and the editor's endpoint is one page at a time — so composing the
queue meant six requests pulling 1 281 rows to find the four that were waiting, growing a request
per page every time the corpus does. The new read is narrow (reviewer-only, open proposals only)
and deliberately returns the SAME shape the editor's page returns: a queue entry is a segment
carrying its proposals, so one set of types, one `readCell`, one reading of what a cell is in,
serve both surfaces.

**Six decisions worth carrying.**

- **The old → new is a word-level diff, and that is the whole surface.** §1 measured the editing to
  expect — nuance, word choice, clause order — and printing a three-hundred-word `note` twice to
  report a changed conjunction is six hundred words of reading for a verdict about one. `wordDiff`
  trims the common head and tail, aligns only what differs, and the test asserts the property that
  makes it safe to trust: `same + removed` rebuilds the original, `same + added` rebuilds the
  proposal — the same reconstruction proof stage A demanded of every `apply-copy` transform. Three
  shapes, chosen from the change rather than from a control: nothing to compare (a first
  translation) prints the proposal alone, a replacement (under 30 % of the letters surviving) prints
  both texts whole, everything else is one paragraph with two marks. Gold for what arrives,
  graphite struck for what leaves — a deletion is not an alarm.
- **"Edit further" is not a fourth state, and the diff follows the working value.** Correcting the
  wording and accepting is ONE act (the endpoint has taken an optional `value` since stage B), so
  the moment the reviewer touches a word the diff shows what will actually land in the file rather
  than what was proposed. A chip says the wording on screen is theirs and one control puts the
  author's back. The text swaps into a field on demand here — the opposite of the editor's cell and
  for the opposite reason: there the resting state is editable across seventy fields, here the
  resting state is a diff, which no textarea can hold.
- **A note without a rewrite is told apart before it is drawn.** `isNoteOnly` compares the proposal
  to the value the repository holds; where they are equal there is no diff at all, a `Tylko uwaga`
  chip stands in its place, and the text is printed once as what it is — the value the site is
  serving, which the note is about. Otherwise the reviewer would read an old → new whose two halves
  are the same paragraph and conclude the desk was broken.
- **Accepting one of two competing proposals does not close the other, and the field says so.**
  `review_proposal` leaves competitors alone by design (§6b), so the sentence appears exactly where
  the decision is made, only when there is more than one, and both wordings are readable in full —
  which is the D2 gap this screen closes, since the editor's cell names the other person without
  showing their words.
- **The patch band is what keeps the screen from reading as publication.** Accepting writes nothing
  anywhere, so a queue that simply emptied as things were settled would imply a site that had
  changed. The band states what is accepted and unwritten, which pages it touches, how long the
  oldest decision has waited, and the two commands in the order they are run — a dry run is the
  default and `--write` is the whole difference between looking and writing. It counts FIELDS, not
  decisions: two accepted proposals competing for one field collapse to one write, and promising a
  diff twice its real size is the same defect as any other figure that does not match its set.
- **A verdict refetches where the autosave patches.** The autosave moves one field of 213 and knows
  exactly what changed; a verdict moves three things at once, two of them the server's arithmetic
  (accepting a Polish value restates which translations are stale). A hand-rolled second answer is
  how the queue would start disagreeing with the band above it, and the read it costs is the queue
  — only ever as long as the work waiting.

**Three shapes lifted out rather than retyped**, each because this stage would have been the second
copy: `GrowingTextarea` (the mirror-span field, now shared with the editor's cell, which owns the
type and padding so the field and its mirror cannot drift), `formatRelativeTime` in
`shared/lib/time/intl.ts` (the notification bell had the only copy, privately), and `familyIcon`
beside `FAMILY_LABELS` in `lib/scopeGroups.ts`.

**Left standing, deliberately.**

- **The reviewer's `comment` is never sent, and that is a hole worth naming.** The endpoint accepts
  one, but it writes the SAME column the editor wrote their note in — so a rejection reason would
  replace the editor's own words — and no surface renders a reviewer's comment back to the person
  who proposed the change. A reason typed here would erase something and reach nobody. Giving the
  reviewer a voice on the row means a second column and a place for it on the editor's cell; until
  then the channel is the messaging feature.
- **A verdict is one click both ways, and there is no undo.** `ACCEPTED`/`REJECTED` are terminal by
  design (§6b), so nothing on this screen can be taken back. Arming only the refusal was considered
  and rejected: it would make rejecting feel graver than accepting, when accepting is the one that
  ends in a commit. What actually protects each is different and already there — an acceptance
  passes a `git diff` before anybody reads it, and a rejection shows on the editor's own cell, which
  is where the person who cares is looking.
- **No filter, no keyboard motion, and the group order is recency.** The queue is grouped by page,
  most recently worked page first — deliberately not the contents list's title order, because a
  contents list is a map of the site and a queue is a record of what arrived. Whether it wants a
  filter by page, locale or author is a judgment to make on a queue that has actually been long
  once, not in advance.

### §6j Stage E — the route in, and what pass 1 delivered (2026-09-03)

Glossary and rights ledger in `docs/web-copy-desk-translation-glossary.md`; drafts in
`web/copydesk/drafts/<locale>/<scope>.yaml`; one new command, `npm run copy:propose`.
**EN pass 1 complete: 428 of 428 keys across all six pages.** FR and both second passes remain.

**The opening question — desk or overlay — is settled by one line of the backend, not by taste.**
`CopySegment.source_hash` has exactly one door: `mark_applied`, reached through an ACCEPTED
proposal (§6e). `upsert_segments` refuses that column by design and a test enforces the refusal. So
translations typed straight into `concerts.en.yaml` would leave all 854 rows reporting
`source_known=False` for ever: Florent edits the Polish and NOTHING ever lights up stale, on any
row, and no later run can repair it — a row gains provenance only by being proposed and applied.
That is §6c's second defect re-entering by the back door. The visibility argument cuts both ways
(the extractor reads the overlays, so the desk shows the values either route) and is therefore not
the deciding one; provenance is.

**Six decisions worth carrying.**

- **A verdict is feedback to its author, and the desk now says so.** The import arrives as one
  accepted proposal per cell, so before this stage's amendment every translated cell would have
  worn a green *Przyjęte* and every page would have reported ~142 accepted for ever — against a
  surface whose resting state is meant to say nothing (§6h). `readCell` now takes the settled
  verdict from the reader's OWN proposals, and `scope_summaries` counts `accepted` the same way.
  `touched` deliberately keeps counting everybody's: an open proposal is a state the page is IN,
  and an editor who cannot see that a colleague is mid-way through a page loses a real fact.
- **`copy:propose` refuses unless the desk's Polish equals the checkout's Polish.** The hash the run
  is about to stamp asserts "this translation renders that source"; a mirror older than the corpus
  would make the assertion false while everything looked healthy. Proposals are posted as DRAFT,
  not PROPOSED, because the sitting digest reports PROPOSED only and an import has no sitting to
  announce to the person who ran it. Coverage is reported per page, and the remaining keys are
  named once a page is within twelve of finished — which is the checklist a skipped line shows up in.
- **A gloss is the sung text in the READER's language, so it collapses into the original when the
  two are the same language.** Thirteen of the forty-two sung texts here are English; one is Polish.
  Their slots are filled in every locale regardless — an empty one falls back to Polish and would
  print a Polish stanza under an English original, and `apply-copy` refuses an empty value — and it
  is the PAGE that declines to print the pair (`glossFor`, `i18n/config.ts`). A draft says
  `= original` and `copy:propose` fills it from the corpus: copying a stanza by hand into a second
  field is how a transcription error enters a text nobody proofreads twice.
- **The corpus had one hole this rule exposed, and it is now closed.** `wolanie-gor.program.11`
  ("Stoi lód na Prośnie") is the only sung text whose original is Polish, so it had NO `textGloss`
  key at all — the extractor emits what the Polish needs — and its English and French had nowhere
  to go. It now carries `textGloss.pl` repeating the song verbatim; the corpus is 428 keys, and the
  Polish page prints it once, exactly as it prints the thirteen English ones once.
- **The rights ledger is short because of what it does NOT govern.** The site already publishes a
  Polish gloss of every one of these texts, so an English or French one we write adds no new
  category of use. What the ledger controls is pasting somebody else's PUBLISHED translation, and
  its trap is that "the author died over 70 years ago" is insufficient for liturgical texts: ICEL
  2010 and AELF are under copyright although the Latin is ancient. Public-domain layer instead —
  BCP/Coverdale, Douay, the Authorised Version; Crampon and Segond — and never a composer's own
  singing version (Rutter's English of the Ukrainian prayer is his publisher's).
- **Three fields are not translations of themselves, and reading them as such would have been the
  quiet failure.** `textNote` states where the printed glosses come from, so its English has to be a
  true sentence about the ENGLISH ones — it is written last, after the ledger settles for that page.
  A note about the Polish reception ("known in Polish as…, tr. 1912") becomes the equivalent
  sentence about the target language's. And `inscriptioGloss` is a gloss on 34 works and a
  standalone editorial note on 26 — measured, not estimated.

**One correction proposed to a value the repository already held.** `concert.hymn-poleglym.title`
reads "Hymn for the Fallen" in `concerts.en.yaml`; the work the evening is named after is John
Williams's **"Hymn to the Fallen"**, and program.8's note says the evening took its name from it, so
the near-miss breaks the link. It is proposed as a change, and the `git diff` will show it.

**Two more dates baked into copy, on top of §6d's two.** `concert.bobola.facts.1` is literally
"16 maja 2026", and `roster.note` carries "1 czerwca 2024" / "14 września 2025" inside a
translatable sentence. Rendered by hand for now, and they will drift from `date` exactly as
`reflectionAttribution` does. Stage F's sweep should take all five together.

**Open for pass 2, and stated so the next pass does not have to rediscover them.** The psalm
register: 9 Kart uses the Book of Common Prayer psalter, which is defensible (it is the psalter
Gibbons himself set, and his is the one psalm printed in its own English) but shifts register
against a Polish gloss written in modern Polish — Florent's to overturn. And the German carol's
French: "Dans une étable obscure" is an adaptation rather than a translation, so the ledger offers
it rather than assuming it.

## §7 Traps

- **`contenteditable` injects markup.** The browser will produce `<div>`, `<br>` and styled `<span>`
  inside an edited `html` segment. The export path must whitelist `<em> <strong> <a>` and flatten
  everything else, and `text` segments must be edited as plain text with no HTML path at all. This
  is the same failure mode as the annotation payload sanitizer: a serializer that rebuilds its
  payload silently drops whatever is not on the list.
- **Do not let editors type French punctuation spacing.** `lib/typo.ts` inserts the narrow no-break
  spaces before `? ! : ;` and pins orphans at build time. Hand-typed hard spaces double up. Say so
  on the desk, in French, in one sentence.
- **Source drift is silent without the hash.** §4 exists for this. A translation whose Polish moved
  looks perfectly fine on screen.
- **`TRANSLATED_ROUTES` is a manual ordering contract.** `i18n/config.ts` states it: add the path
  only *after* both route files exist, or every localized link starts pointing at a 404. With six
  concerts this becomes six entries, each flipped independently — do not flip the set for the whole
  concert section at once.
- **Astro scoped styles do not reach injected DOM**, and delegated clicks must capture, not bubble,
  because of the ClientRouter. Both are recorded project traps and both apply to any preview the
  desk renders using site markup.
- **Alt text is translatable copy.** `gallery[].alt` is 621 words. It is not decoration; leaving it
  Polish on the English page is an accessibility regression, not a cosmetic one.
- **A key named `pl` under a foreign original is the `*Pl` trap wearing a different hat.** The
  suffix was the visible half; `movements[].pl` and `interlude.pl` were the same ambiguity written
  as a nested key, and a grep for `Pl:` would not have found either. Both are `gloss` now. When a
  new field appears beside a `lat`/`text`/`inscriptio`, ask which of §5's two meanings its name
  carries before writing it.
- **A migration of this file may not go through a YAML parser.** `concerts.yaml` is ~2 500 lines of
  which a large share is comments carrying decisions nothing else records (the veil per station,
  the run boundaries, the consent scope on the roster). Any parse-and-dump deletes all of them
  silently and the build stays green. Rewrite lines, and make each transform prove it can
  reconstruct the original string.
- **The file is CRLF on a Windows checkout,** so a migration script that splits on `\n` matches
  nothing at all and reports a clean run over zero changes. Split on `/\r?\n/` and restore the
  ending on write.
- **`apply-copy` re-wraps a folded block it edits.** Changing one word in a `>-` paragraph reflows
  the lines below it, because the file's own wrapping is by hand and no emitter reproduces it (§6f).
  The diff is therefore bigger than the edit, and reading it means reading the paragraph rather than
  the changed line. Nothing else in the file moves — that is what the reconstruction proof asserts.

## §8 Open decisions

- ~~**Notification shape.**~~ **Settled 2026-09-02 — one digest per editor per sitting, where a
  sitting ends at a 30-minute pause. Reasoning and mechanism in §6b; amended 2026-09-03 in §6h,
  which keeps the pause as the guarantee and lets the editor raise their own digest early.**
- ~~**Where a translated PROSE value lives in the repository**~~ **Settled 2026-09-02 — (b), the
  per-locale overlay. Built in C3 (§6f); the corpus is Polish-only and three guards enforce it.** `concerts.yaml` is Polish-only from here on; `concerts.en.yaml` and
  `concerts.fr.yaml` hold every translated value under the desk's own dotted key. The consequence
  worth stating separately, because it is the strongest argument for the choice: `apply-copy`'s
  line-level path now only ever REPLACES a Polish scalar in place — it never inserts a key, never
  opens a flow map, never indents a block scalar under a new locale. The overlays are written
  whole, carry no comments to lose, and cannot damage the corpus. Stage A's locale maps keep their
  shape (they mark a *gloss of a foreign original*, which was their point) and simply stay
  `pl`-only; the `about.{en,fr}` block, the one place translations sit today, is C3's to move out
  so that each fact has exactly one home. The reasoning as it stood before the decision: **(a)
  Migrate all 279 prose fields to locale maps**, the way stage A migrated the glosses:
  one file, one shape for everything, `pickLocale` already reads it — at the price of a second
  line-level rewrite of the file §7 says may never meet a parser, and of a Polish source file whose
  every paragraph is buried under two translations the Polish editor is not reading.
  **(b) Per-locale overlay files** (`concerts.en.yaml`, `concerts.fr.yaml`) keyed by the desk's own
  dotted key: the Polish file is never restructured again, the overlays are machine-written and
  carry no comments to lose, and `apply-copy`'s dangerous path shrinks to Polish edits only — at the
  price of a second place to look and a merge in the loader. **(b) is the recommendation**, on the
  strength of shrinking the one operation in this plan that can destroy the corpus; the objection to
  answer is §5's rule against two shapes for one thing, and the answer is that the split is by
  *language*, not by field — every field behaves identically. Decide before C3; C1 and C2 are
  unaffected either way, because the desk shows an empty `en` column regardless of where its value
  will eventually be written.
- **Whether accepted proposals auto-commit.** Currently manual (`apply-copy` → developer commits).
  A bot commit is a later convenience and needs no model change.
- **Whether the reviewer gets a voice on the row.** Raised by D3 (§6i): `comment` is one column with
  two possible authors, so a reviewer's note would overwrite the editor's, and nothing renders it
  back to them anyway. Either a second column plus a place on the editor's cell, or the answer stays
  "say it in a message" — decide when somebody actually wants to explain a rejection.
- ~~**Copyright on canonical hymn translations**~~ **Settled 2026-09-03 — canonical only where it is
  public domain, our own everywhere else. The ledger is `docs/web-copy-desk-translation-glossary.md`
  §4; the reasoning and the ICEL/AELF trap are in §6j.** The framing that made it short: the site
  already publishes a Polish gloss of every one of these texts, so a gloss WE write in another
  language adds no new category of use, and the only thing needing control is pasting somebody
  else's published translation.
- **The psalm register in English** (raised by §6j). 9 Kart follows the Book of Common Prayer
  psalter, which is what the repertoire is sung from and what Gibbons himself set — and which reads
  three centuries older than the modern Polish beside it. A decision for Florent on the desk, not
  one to take for him.
