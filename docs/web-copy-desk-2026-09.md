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

**The profile payload reports the EFFECTIVE capability, not the stored column** (amended 2026-09-03).
`user_can_edit_site_copy` admits staff whatever the flag says, so a serializer echoing the column
would hide every doorway from the one account that can also review — the developer, who has no
reason to have set the flag on themselves. The panel then offers the desk to exactly whom the server
will admit, from one predicate. Two doorways exist and neither is a nav tab: the command palette
(⌘K) and the sidebar footer, beside settings and log-out. That placement is the constraint from D1
restated — `/redakcja` replaces the shell, so a rail item pointing at it would be a tab that closes
the panel, while the footer is already where the panel keeps what leaves it.

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
| F | `/en/koncerty/[id]`, `/fr/koncerty/[id]` routes, per-concert `TRANSLATED_ROUTES`, hreflang — **done, §6o** | the pages exist |
| G | static pages onto the desk (`kontakt`, `koncerty` index, `obrazy`, `kolofon`, chrome, `/404`), then landing — **`kontakt` (§6r–§6u), `koncerty` (§6v, §6w), `obrazy` (§6x), `kolofon` (§6y) and the chrome + `/404` (§6z) are through the whole loop and live in three locales** | the rest of the corpus enters the desk |
| H | `o-nas.ts` → YAML + overlays (§6r's named debt) — **done, §6aa; the desk now holds every page the site has** | the desk holds every page |
| I | the donation vault (~1 870 lines: the invitation, the validation, the regulamin) — **not started** | the "Support us" every foreign page already offers |
| J | the privacy policy (2 116 words, today a static file in `public/`) — **not started** | the RODO notice the footer already links in three locales |
| K | the landing (index + eleven partials) + `TRANSLATED_ROUTES` "/" — **not started** | the site is translated |

**H–K in that order, decided 2026-09-04, and the ordering is against intuition on purpose.** The
landing is the biggest block of prose left and it is LAST, because it is the only one of the four
that a foreign reader cannot reach at all: `/en` does not exist. The vault and the privacy policy
are already reachable from every English and French page on the site — the nav's "Support us"
opens a Polish island, the footer's Index column links a Polish RODO notice — so they are live
gaps on ten built pages where the landing is a gap on none. Fixing what a reader can already reach
beats writing what they cannot. `o-nas` goes first inside that because it is the cheapest: its
English and French are written and reviewed already, so the stage moves prose between files and
adds none.

Two gates belong to **I** and must be answered before its drafts are written, not after: what
language the Axepta / PayU checkout actually renders in (a translated form that hands a French
donor to a Polish gateway is a promise the site cannot keep), and which language of the donation
regulamin governs. The recommendation on the second is Polish governing with EN/FR informational
and a sentence in the document saying so — and the regulamin goes on the desk like any page,
because the desk is the only machinery here that stamps `source_hash`, and silent drift between
language versions is worse in a legal text than in copy.

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
**EN pass 1 complete: 428 of 428 keys across all six pages.** Pass 2 is §6k; FR remains.

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

### §6k Stage E — what EN pass 2 found (2026-09-03)

Read from the files, not from the pass that wrote them: the Polish of all 428 keys in reading order
out of `copydesk/segments.json`, the English beside it, one page at a time, with the termbase and
the register checked **between** concerts rather than inside one. **Twenty-four corrections and
eight restored quotation marks**, and the diff of `copydesk/drafts/en/` is the whole evidence that
the pass happened. Five kinds of defect, and the first is the one only a second pass can see.

- **One Polish word doing two jobs, answered with two English words.** `wołanie` names the
  concert *The Call of the Mountains*, its first act and the piece the evening is named after —
  and the act was called "Cry" while everything around it said "call", so the English reader lost
  a thread the Polish reader cannot miss. Same shape three more times: `różdżka` was rod three
  times and rose once (`wcielenie`), `róg` was trumpet twice and horn once, `zawierzenie` was
  "Commendation" as an act and "entrustment" in both lines that lead to it (`aeternam`). All four
  are now single words and are in the glossary as such, with the page each one bites on.
- **Facts that drifted in translation, which is the failure a fluent paragraph hides best.**
  "the coffin of the Princess of Wales" — that title belongs to a living person; the Polish says
  Diana. The Coventry Carol's shadow fell "across the stable", an image the Polish does not have,
  in place of the Massacre of the Innocents, which it does. The Hejnał became "a bugle call". The
  Ukrainian prayer asked for "the light of freedom and of day" where both the Polish and the
  Ukrainian say a *ray* of freedom and light. Patrick's legend changed sides: it is the king's men
  who see deer.
- **A poster fact that says more in English than in Polish.** `Pamięć Ukrainy` had become "In
  memory of Ukraine" — which in English is what one writes about a country that is gone. It reads
  "Remembrance for Ukraine".
- **A note that answered only half of its Polish sentence.** `9-kart.textNote` said where the
  *English* comes from and dropped the clause saying the texts follow the concert programme —
  the half that is a fact about the evening rather than about a language. §6j's rule that these
  fields are not translations of themselves cuts both ways: the sentence still has to say
  everything its Polish says.
- **Punctuation the Polish marks and the English silently dropped.** Eight `„…"` pairs — the film,
  the mystery play, the Lorica, "lullaby of death", `Jäger` glossed as "hunter" — where the same
  drafts had faithfully kept the quotes around collection titles. Mirroring the Polish is the rule;
  a check that counts `·`, `„`, em dashes and line breaks per key now runs over the drafts and is
  clean.

**Two things pass 2 deliberately did not change, because they are not its call.** `9-kart.title`
spells "Nine Leaves" where the Polish poster prints `9 Kart` and every `facts` row keeps its
numeral — but that title is a value the repository already held, and overturning an existing
editorial choice on a matter of style is Florent's, not a pass's. It goes to him with the psalm
register (§8). And the English's habit of turning a Polish comma into an em dash stays: it is
idiomatic in the target language, which is the whole point of not translating word for word.

**A second correction to a value the repository already held,** on top of §6j's title: `toward` in
`aeternam.about.blurb` is the American form on an `en-GB` site. One word, and the `git diff` shows
it beside the other.

**Why the drafts now carry comments.** A translation that took a decision — a published version
used and why that one, a word the whole page has to keep using, a form avoided because it is under
copyright — carries the reason as a `#` line above the key. The proposal's `comment` column
already exists end to end (model, DTO, serializer, the editor's *Uwaga* box, rendered back in
`ProposalVerdict`), but it is the wrong home for this: it lives only in the database, never appears
in the `git diff` that is the actual review, and belongs to ONE proposal — a terminal proposal is
never edited, so the next value for that segment starts with no reason attached. The drafts are in
git, sit beside the value, and are what a translator opens. The desk's comment stays what it is:
a note from an editor to a reviewer about one proposal.

**Two gaps this pass hit that belong to stage F.** `wcielenie` and `aeternam` have no `textNote`
key in the corpus at all, so the pages that use Baker's and Neale's public-domain translations have
nowhere to credit them; the ledger in the glossary is the record until the field exists. And
`src/pages/koncerty/[id].astro` imports no i18n at all — about seventeen section labels are
hardcoded Polish (`Próg wieczoru`, `Program koncertu`, `Głosy wieczoru`, `Tekst i przekład`, the
`Zapis słowa wprowadzającego…` note). Translating the corpus does not by itself produce an English
concert page, and flipping a `TRANSLATED_ROUTES` entry before that template is localized would
publish English copy inside Polish furniture.

### §6l Stage E — French, both passes (2026-09-03)

**428 of 428 keys, written from the Polish and never from the English.** The relay is the failure
this ordering exists to prevent: a French value rendered from an English one inherits every
decision the English pass took — its em dashes, its `9 Leaves`, its Book of Common Prayer register —
and none of them is a fact about French. Pass 2 then read the Polish beside the French from the
files, page by page, exactly as §6k did.

**French has no `= original` rows at all.** Thirteen of the sung texts are English and one is
Polish, so the English drafts inherited fourteen slots they did not have to write; French inherits
none. Every one of the forty-two glosses is written here, which is why this locale is the larger
piece of work despite having the same key count.

**And every one of them is ours.** The ledger offered Crampon (1923) for the psalms and the
biblical passages, and pass 1 declined it: a `textNote` that credits a source is an assertion about
what is printed above it, and the pass could not verify Crampon's wording line by line. Writing our
own adds no new category of use — §4's principle — and it buys the thing the English psalms lost:
the French reads in the same register as the modern Polish beside it, where Coverdale reads three
centuries older (§8). The glossary's French column is now labelled *offered*, not shipped.

**What pass 2 found — the same five shapes as English, in French clothing.** `zawierzenie` used
alone ("la recommandation de Tavener") reads in French as an endorsement rather than a liturgical
act, and needed its supporting noun. Fauré's *Pie Jesu* was written "pour une voix d'enfant" where
the Polish says a boy's. `Nimrod` had John Cameron placing the communion text "dessous" in a
construction no French sentence would use. The Psalm 47 incipit dropped its "all" ("Vous tous,
peuples"). `retour sur la terre` had to lose its article to become the idiom the Polish means.
The Vivancos title, contracted into "du Cri des bergers", would have recapitalised a title §1 says
never changes. And the gallery alt texts needed the support noun French requires before a bare
title ("pendant le concert *Contemplation de l'Incarnation*"), which the Polish gets free from its
case endings.

**Two French-only traps, both held.** No hard space is typed anywhere — `lib/typo.ts` inserts the
narrow no-break space before `? ! : ;` and around the guillemets at build time, and a check over
the drafts confirms not one U+00A0 or U+202F reached them. And `„…"` became `«…»` in all 48 places
across 39 keys, with the counts checked per key rather than per file.

**The French overlay already held fourteen values, and the dry run is what found the collisions.**
Five of them differed from the draft: four `about.blurb` renderings that were merely *different*
("des pièces d'Allegri" against "la musique d'Allegri", "face à" against "devant"), and one that
the repository had right and the draft had wrong —
`L'Appel des montagnes` capitalises the noun after the article, as a French title does. The four
were adopted from the repository and the capital was taken into the eleven places the draft names
the title, so the French side of this commit overturns nothing: `copy:propose` now reports 414 new
and **14 already in the repository**. The rule this settles for stage G: a value the repository
already holds is changed only for a defect, and the defect is named in the diff.

**One thing the translation found in the Polish, which is Florent's to decide.**
`9-kart.program.4.textGloss` opens "Śpiewaj Panu nową pieśń" — singular — where the same page's
incipit says "Śpiewajcie" and Bach's German is plural ("Singet dem Herrn"). Both foreign columns
render it plural, because the sung text is what a gloss glosses; the Polish is the odd one out and
the corpus is not ours to correct.

### §6m Stage E — running the loop, and the credentials it needs (2026-09-03)

**There is no API key and there is no separate copy-desk account.** The three commands that leave
the checkout sign in at `POST /api/token/` with an email and a password, exactly as a browser does,
because Postgres publishes no host port and HTTP is the only door from a checkout to the mirror
(§6e). The account must be `is_staff`: `IsCopyReviewer` gates accepting a proposal and reading the
accepted patch, and accepting *is* the decision to commit (`copydesk/permissions.py`). The
developer's own superuser is that account. The request goes to `http://localhost:8000` — the panel
in the developer's own Docker — so nothing leaves the machine.

**Where the credentials live: `web/.env`, gitignored, never the shell profile.** The three scripts
run under `node --env-file-if-exists=.env`, so the file is read at start-up and no `setx` is needed;
`--if-exists` keeps the commands working when the values come from the environment instead.
`web/.env.example` is the committed template. A password in `setx` is a password in the user's
registry for every process on the machine, which is a worse trade than a gitignored file next to the
code that reads it.

**The loop, as `make` targets.** They exist because this is run rarely — a sequence nobody remembers
in a year is a sequence that gets reconstructed wrongly, and the npm scripts underneath say nothing
about their own order. The comment block above them in the `Makefile` is the runbook's short form.

```
make up && make migrate      # nothing applies migrations for you, in any environment
make copy-sync               # the corpus enters the desk. Until this runs, /redakcja is EMPTY
make copy-draft              # drafts → accepted proposals, EN then FR
make copy-check              # what the patch would write; touches nothing
make copy-apply              # writes the overlays, stamps applied, prints the diff
```

Underneath: `npm run copy:sync`, `copy:propose -- --locale <l> --write`, `copy:apply` and
`copy:apply -- --write`, all run in `web/`.

`copy:propose` without `--write` and `copy:sync --dry-run` are pure local reads and need neither the
stack nor the credentials — they are the way to check coverage offline. **`copy:apply`'s dry run is
not**: the patch it prints comes from the server, so it signs in like the rest.

**WHICH MACHINE, AND WHICH DESK — the part that is easy to get backwards.** The commands run from a
developer's checkout, always, and `COPYDESK_API` decides which panel they feed. **Never on the
server**: its `/root/voctmanager/web` is a deploy artifact — it has no `node_modules` (the site is
built inside an image, so `npm ci` never runs there) and, worse, anything `copy:apply` wrote into it
would sit as an uncommitted change that the next `git pull` overwrites, having reached no reader.
The desk an editor actually uses is **production's**, because that is where Florent and Ania have
accounts, so the working shape is: `COPYDESK_API=https://voctensemble.com` in `web/.env`, the loop
run from the laptop, the diff committed and deployed from there. The dev stack is for rehearsing the
machinery against a database nobody is reading.

**Three failures worth recognising on sight.** A sign-in that returns 401 is the password; a 403 on
the first real request is an account that is not `is_staff`; and a 500 or a missing-table error from
`copy:sync` is the dev database being older than the copy-desk migrations — `make migrate` is a
separate manual step in every environment.

**Why this is not a button in the panel, and what would have to change for it to be one.** All four
targets are operations on a CHECKOUT: `copy:sync` reads `src/content/` and refuses to ingest text
that is not committed, `copy:apply` writes two files and hands them to `git diff`. The panel runs in
a container that has no checkout, no working tree and no commit rights, and giving it those is the
open decision "whether accepted proposals auto-commit" (§8) — a bot identity, a deploy key and a
push, not a button. What the panel could cheaply gain instead is the *reading*: which revision the
mirror was last ingested at, and how many accepted proposals are waiting for the repository. That is
one endpoint over data the desk already stores, and it is the honest half of "see it in the app" —
the state, not the trigger. Not built; worth building when the desk has an editor other than its
author.

### §6n Stage E — the run itself, and the four things production taught it (2026-09-03)

**It ran, against production, from the laptop: 856 values, of which 830 were written by this run**
(416 EN + 414 FR; 26 were already in the repository from stage C3 and needed nothing). Both overlays
now hold 428 of 428, `hymn-poleglym.title` reads "Hymn to the Fallen", and `copy:extract` reports
`856 already translated`. Stage E is closed.

**The loop as written could not survive its own volume, and three of the four fixes are in
`client.mjs`.** The command posts twice per value — propose, then accept — so a locale is ~830
requests at a panel that allows 300 a minute per account and runs one Django process on a one-vCPU
droplet next to the site it serves. What that produced, in the order it appeared: a 500 three
quarters of the way through the English run; a 429 nine seconds into the French one; and then a
stretch where the worker answered 500 to *everything*, `POST /api/token/` included, for the better
part of a minute. Only the last of those is interesting, and it is the diagnosis for all three: the
import was a load test aimed at production, and the panel's own users were behind it in the queue.

- **Requests are paced at 400 ms** — under half the server's cap, deliberately. A locale takes a few
  unattended minutes, which is the right price for a command that runs twice a year.
- **5xx and dropped connections are retried** (2 s, 5 s, 15 s, 30 s), because a wedged worker
  recovers in tens of seconds and losing the run at row 300 costs everything above it.
- **429 is retried on the server's own `Retry-After`**, up to twelve times. It is the one 4xx that
  means "later" rather than "never", and DRF does not record a throttled request in its own history,
  so waiting costs nothing but time.
- **And `copy:propose` is now RESUMABLE**, which is the fix that made the rest survivable: it reads
  `proposals/patch/` first and skips every value the desk already holds accepted and unwritten.
  `plan()` cannot answer that question — it compares the drafts against the REPOSITORY, and these
  are precisely the values that have not reached it. Re-running a broken import now costs the
  remainder instead of a second proposal on every row. Accepting tolerates a 409 for the same
  reason: a retried accept that follows one which landed and lost its response is asking for the
  state it already has.

**The fourth fix is the panel's, and the run is what exposed it.** Between the verdict and the next
`copy:apply` the desk held 830 decided sentences that no file carried — and the editor's cell had
nowhere to show them: `segment.value` is git's, so the screen read as a chip saying "Przyjęte" over
an empty field. The first editor to see it read it as lost work, and said so. `readCell` now also
reports `awaiting` — the newest accepted, unapplied proposal on the row, whoever wrote it — and the
cell prints it in gold under the field, labelled as waiting for the repository rather than as
published. It costs no request: the payload already carried every proposal with its `applied_at`.

**Two smaller things from the same sitting, both reported by the same editor.** The scope page now
carries a two-line legend above the text, because the row's controls appear only after a field is
touched and its chips only where a fact exists — so an editor meets every one of them unannounced,
and "what does Cofnij do" has no answer anywhere on the surface. And the three-language view is no
longer capped at a single column's reading measure: `all` takes the shell's full width (raised to
1760), because three columns each need a measure of their own and a cap sized for one squeezed all
three into ribbons with the screen empty on both sides.

**Florent and Ania lose `is_staff`** (decided 2026-09-03, executed in the Django admin) and keep
`can_edit_site_copy`. This is §7's first trap taken at its word rather than moved: they are editors,
and staff would make them reviewers of their own proposals. The one thing to check while doing it —
`user_is_manager` is role-MANAGER **or** staff, so an account whose profile role is not MANAGER
loses the manager screens along with the admin.

### §6o Stage F — the fork, and the defect the chrome was hiding (2026-09-03)

`src/pages/koncerty/[id].astro` is now three route files over one component
(`components/pages/ConcertPage.astro`, the AboutPage pattern), the chrome is
`i18n/content/koncert.ts`, and `/en/koncerty/[id]` and `/fr/koncerty/[id]` build for all five
page-bearing concerts. **Proved by diff: every Polish page in `dist/` is word-for-word identical to
the pre-stage build** — the only additions anywhere are the hreflang graph and
`og:locale:alternate`.

**The chrome was about forty lines. The page was not translated at all, and that is the finding.**
Every prose field — `title`, `essence`, `prologue`, the whole `verbum`, `reflection`, 58 × `note`,
`rubric`, `credits[].role`, `roster.groups[].voice`, 621 words of `gallery[].alt` — was read
straight off `concerts.yaml`, which is Polish. Worse, the *locale maps* looked translated and were
not: `pickLocale(c.metaPlace, "en")` returns Polish, because stage C3 made the corpus Polish-only
and moved every translation to the overlay. So the honest description of stage F is not "fork a
route" but "connect the page to the corpus the desk has been filling since stage E", and the fork
was the smaller half. `say(field, polish)` in the component is the one door; `pickLocale` is gone
from the page and now carries a warning in `i18n/config` naming the trap.

**Six decisions worth carrying.**

- **`TRANSLATED_ROUTES` drives `getStaticPaths`, which dissolves §7's ordering contract for this
  route.** The trap exists because a hand-written page's switch and its route files are two
  separate acts; a parameterized route has no such gap — `src/pages/{en,fr}/koncerty/[id].astro`
  exist for the whole family and read the set themselves, so adding an id emits the two pages and
  lights every link to them in the same build. Six concerts are six entries, each flipped on its
  own, and there is no window in which a link points at a page that is not there. Five are on;
  `bobola` has no page in any locale.
- **`glossFor` no longer takes a `LocalizedText`, and that was a live bug in waiting.** It read the
  map through `pickLocale`, so on an English page it would have compared the English original
  against the POLISH gloss, found them different, and printed the Polish stanza under the English
  one — the exact failure §6j's rule exists to prevent, arriving through the collapse check rather
  than through an empty slot. It now takes the value the caller resolved.
- **`viaDate` is deleted from the corpus, not worked around.** `contract.mjs` filed it under stage F
  and it was the last Polish month written into data: `shortDate` reproduces all four hand-written
  values exactly (`sty 2024`, `cze 2024`, `lut 2025`, `maj 2026`), and the two evenings whose day is
  vague carry no `date` at all and state a `dateLabel`, which is copy and comes through the overlay.
  One derivation, `viaMoment` in `lib/dates`, now serves the chrome's registrum, `/koncerty`,
  `/obrazy`, `/press` and the landing.
- **Three shared libraries took a locale rather than a second copy.** `galleryRuns` (the rehearsal's
  name and the run head's date), `photoCredit` (four labels: `Fot.` / `fot.` / `źródło:` /
  `archiwum zespołu`) and `registrum` (title, place and moment, read from the overlay). The credit
  opener stayed a caller's choice — a colophon opens a sentence, a run head opens a clause — because
  folding them into one would have capitalized `/obrazy`'s run heads as a silent side effect.
- **The `-pl` hooks are swept, and the collision that deferred them had a right answer.**
  `.kd-text-pl`, `.kd-movement-pl`, `.kd-interlude-pl`, `.kd-clasp-pl`,
  `.kd-program-inscriptio-pl`, `.kd-inscriptio-pl` and `/koncerty`'s `.station-inscriptio-pl` are
  `-gloss` now. The two names already taken by a wrapper became `-line`: the wrapper is the LINE the
  verse and its gloss sit on, which is what it always was. `.voice-pl` in the chrome went with them
  (`.voice-gloss`, in `SiteChrome`, `StickyHeader` and `nave-menu.css`) — it was the one already
  shipping a lie, holding English on `/en/o-nas` under a name that said Polish.
- **The registrum's ribbons localize their hrefs; the archive's does not.** `/obrazy` is Polish-only
  by its own spec, so the link stays a Polish URL — but its NAME is translated
  (`UI.nav.archive` / `archiveGloss`), because a reader of the English chrome has to know where a
  link goes before following it into a Polish page.

**Two things this stage found and did NOT fix, both corpus decisions rather than code.** An
honorific is not a name: `credits[].name` is `NOT_COPY`, so the French page prints
"Parole d'introduction · o. Jarek Naliwajko SJ" in the credits while the verbum's citation, whose
`speaker` IS copy, correctly reads "P. Jarek Naliwajko SJ". The same person, two honorifics, one
page. Splitting the honorific off the name is a contract change and belongs with whoever decides
it. And `reflectionAttribution`, `roster.note` and `bobola.facts.1` still carry hand-rendered
months inside translatable strings, exactly as §6j recorded — they read correctly in all three
locales today and will drift from `date` the first time one moves.

**Left standing, deliberately.** `LANG_SWITCHER_ENABLED` stays `false`: the ten new pages are
link-only, and hreflang plus localized links do their work without a visible chip. `/koncerty`,
`/obrazy`, the landing and `/press` stay Polish-only — they are stage G's — so a foreign concert
page links back into Polish for the section it belongs to, which `localizePath` handles by
returning the Polish URL rather than a 404. And the footer's `tempusLiturgicus` incipit still
prints its Polish gloss in every locale; it is chrome nobody has translated yet, and it is on every
page, not just these.

### §6p After F — the rail that was never sticky, and reading marks per page (2026-09-03)

Two post-stage-F items, and the first one is a reminder that a computed style is not a behaviour.

**The rail was `position: sticky` and it scrolled away anyway.** Measured on the device rather than
read off the file (`vm-shot/kd-desk-rail.cjs`, 390×844 and 1440×900): computed `position: sticky`,
`top: 0px`, and `getBoundingClientRect().top` reporting **−2000 at scrollY 2000**. The cause was two
levels above the desk — `<body class="… overflow-x-hidden …">` in `frontend/index.html`. A box with
one axis `hidden` and the other `visible` computes the visible axis to `auto`, so the body became a
scroll container while the document went on scrolling on `html`; a sticky element inside it then
resolves against a scrollport that never moves. The fix is `overflow-x: clip` (which clips
identically and creates no scroll container), declared in `panel.css` under a `hidden` fallback for
engines that do not know `clip`, and the utility removed from `index.html` so the rule lives with
its reasoning. Verified by the same harness: `rectTop: 0` at every scroll position, both viewports.

Three things worth carrying from it.

- **It was never a copy-desk bug.** `DashboardLayout` has no inner scroll container either, so
  every page-level `sticky` in the panel was dead — including `Schedule`'s tab pill, whose own
  comment says it exists so the view control "stays reachable", and the `sticky top-0` group
  headers in `CastTab`, `CrewTab` and `RehearsalsTab`. They now do what they were written to do.
  The desk is simply where it showed, because it is the surface whose ONE affordance was the thing
  scrolling away.
- **The bar was also unreadable once it stayed.** `bg-ethereal-canvas/90` with no blur let the body
  text travel visibly through it — invisible as a defect for as long as the bar itself was
  invisible. It is `/92` plus `backdrop-blur-md` now; a flat opaque fill would have printed a lid
  across the ambient layer's wash, which is at its strongest under exactly that band.
- **The desk now has two exits.** §6g's step-back-one-level is right about where an editor wants to
  go from a page of text, and wrong that "the panel is one click further" is acceptable in a
  takeover with no other doors. The rail carries `← Spis treści` on the left and `Panel` opposite it
  on any page below the index; on the index the left link IS the panel, so the slot names the room
  instead. The decorative `Redakcja` eyebrow was hidden below `sm` anyway — nothing load-bearing was
  displaced.

**And `copy_desk_seen_at` is gone, replaced by `copydesk.CopyScopeVisit` — one watermark per reader
per page.** The single profile-wide stamp answered "when were you last on the desk", which is not
the question the surface asks: opening one page of a corpus declared the whole of it read,
permanently, and nothing anywhere could put a page back. The new model is a table of
`(user, scope, seen_at)` and everything the contents list shows is a **comparison** against it —
never a stored state, which is what keeps the split free of tick-boxes.

- `new` = created after the mark. **No mark at all means every row is new**, which is the state a
  first reading is actually in; the old code reported zero new to a first-time visitor, silently.
- `changed` = already there at the mark, and the published value has moved since. Never overlaps
  `new`; the two partition the page.
- The split is `new + changed > 0`, or no mark. `stale` is deliberately **not** part of it: it does
  not clear by being read, so a page carrying it could never leave the pending half however often
  it was reviewed. It stays a count on the row, on whichever side that row sits.

**The one act that writes a mark is a button at the foot of the page**, and the placement is the
argument. `SittingClosure` sits in the rail because it belongs to the sitting rather than to any one
page and because nobody loses anything by missing it. This one is the reader's own claim that they
read a page, so it goes where that claim becomes true — a control in the rail would be pressable
from the first paragraph and would mean nothing. The header states the same fact for orientation on
arrival, read from the same summary so the two cannot disagree. Nothing stamps on arrival or on
departure any more, and the shell no longer stamps at all.

**No data migration, deliberately.** There is no honest way to turn one desk-wide timestamp into per-page
marks, and the tempting one — stamping every scope that existed at that moment — would assert a review
that never happened for exactly the pages the split exists to find. The stamps start empty, so the first
load after this ships puts the whole corpus under "do przejrzenia". For a surface nobody has reviewed
yet that is the correct starting state, not a regression.

**It forced one change with a wider blast radius, and that change was overdue.** `upsert_segments`
used `update_or_create`, which saves unconditionally, so `updated_at` (`auto_now`) meant "when the
extractor last ran" rather than "when this text moved" — and `changed` is computed from exactly that
column. The ingest now compares and writes only rows that actually differ. Two consequences beyond
this feature: a no-op `copy:sync` reports `0 updated` instead of 830, and `CopySegment.updated_at`
becomes load-bearing — anything that saves a segment for an unrelated reason will tell every reader
their page moved.

**A layout defect the same harness found**, which is the case for measuring rather than reasoning
twice in one session: a contents row can now carry three chips, and beside a 390px title they took
the whole line and truncated the page's name to `Konte…` — on the one row where the title vanished
outright. Rows stack below `sm` now; the title keeps the full measure and the marks sit under it.

### §6q Stage G — the shape, not yet built

The corpus the desk holds today is `concerts.yaml` and nothing else. Stage G is the rest of the
site's text: `kontakt`, the `/koncerty` index, `/obrazy`, `/kolofon` and the chrome, then the
landing. Measured, so the stage is sized honestly rather than optimistically: `kontakt.astro` 419
lines, `koncerty.astro` 821, `obrazy.astro` 856, `kolofon.astro` 940, `index.astro` 189 over eleven
landing partials — roughly 3 200 lines of Astro to read copy out of, against a stage F whose whole
chrome was forty.

Four things that make it a different job from F rather than a bigger one.

- **There is no `concerts.yaml` to extract from.** A concert's copy is already a structured data
  file; a static page's copy is interleaved with its composition. The output of this stage is a
  content module per page (`i18n/content/kontakt.ts`, the `o-nas.ts` pattern) plus contract entries,
  and the extraction is a judgement call per string — which is why §5's rule about accounting for
  every field in one of the two tables matters more here than it did for the corpus.
- **This is where `HTML` segments and the `contenteditable` sanitizer first fire.** `contract.mjs`
  says so in as many words: every segment in today's corpus is plain text, and the static pages
  bring inline `<em>/<strong>/<a>` with them. §7's sanitizer trap has not been exercised once yet.
- **`TRANSLATED_ROUTES` owes the ordering contract again.** The concert pages are exempt because
  `src/pages/{en,fr}/koncerty/[id].astro` filter their own `getStaticPaths` through the set. Every
  page in this stage is hand-written, so each one is: both route files first, then the entry.
- **Each page still owes §2's two passes per locale.** The word count is smaller than stage E's
  ~8 700 per locale, but the rule is a floor and not a schedule.

Three open items ride along with it and are **not to be settled without Florent** — all three are
contract or editorial decisions rather than code: the psalm register in English (§8), `9
Kart`'s `program.4.textGloss` in the singular, and the honorific in `credits[].name` (§6o's closing
paragraph — splitting the honorific off the name is a `contract.mjs` change).

### §6r Stage G1 — where a page's words live, decided, and `kontakt` moved into it (2026-09-03)

§6q sketched the output of this stage as "a content module per page, the `o-nas.ts` pattern". Built
against that sketch, the first page found the sketch and §8 pulling in opposite directions, and the
question had to be settled before a single line of `kontakt.ts` could be written: **`o-nas.ts` holds
three locales of prose in TypeScript literals, and `copy:apply` has no way to write a `.ts` file at
all.** It writes a Polish scalar into `concerts.yaml` through `yamlEdit.mjs` and it rewrites an
overlay whole. Nothing else.

**Decided: a page's PROSE is YAML on the desk's own terms; a page's CHROME stays a typed triple.**

The line between them is not "prose vs label", which is unfalsifiable at the margin — is a section
rubric a label? is a scroll cue? — but **whether completeness can be demanded**:

- An aria-label, a button, a landmark name must exist in all three locales or the page is broken
  for somebody. `Record<Locale, T>` makes the compiler say so, and adding a section without
  translating its landmark cannot build. That is `ui.ts` and `koncert.ts`, and page chrome joins
  them at `i18n/content/<page>.ts`.
- A paragraph arrives one field at a time, through review, over months. Requiring completeness would
  mean an English page shows nothing until every field is translated. So prose takes the shape the
  corpus already has: Polish source, per-locale overlay, fallback **per field**.

That rule DERIVES the split `koncert.ts` already states in prose ("everything here is the PAGE
talking; everything the CONCERT says comes from `concerts.yaml` through the overlay") instead of
contradicting it, and it answers the sketch: the file §6q named still exists at the path it named —
it holds the page's schema, its key contract and its chrome, and its words live next door.

The second argument is the heavier one and it is about danger rather than taxonomy. **A TypeScript
writer would be a second implementation of the one operation in this system that can destroy
hand-written text** — and a worse one than the YAML it duplicates: a YAML block scalar holds prose
verbatim, while a TS literal needs every quote, backslash and `${` escaped, in French sentences and
in `<a href="…">` attributes, where a bug corrupts the file and leaves it parsing. `yamlEdit.mjs`
already proves four things about a write before a byte lands. Two implementations of that is a
defect on its own terms.

**What shipped.** `/kontakt` renders from a shared component in three locales, with no word changed:

- `src/content/pages/kontakt.yaml` — the Polish prose, 36 copy fields, and the three non-copy fields
  a channel needs (`id`, `email`) plus the board's names, each with its reason in a comment.
- `src/i18n/content/copySpec.ts` — the key rule, **once**, because it is read from both ends: the
  page looks a key up in the overlay and the extractor emits the same key from the same YAML. Two
  implementations would diverge in silence — a good translation stored under a key the page never
  asks for, and a page still printing Polish with nothing anywhere reporting an error.
- `src/i18n/content/kontakt.ts` — zod schema (`.strict()` throughout, so a hand-added `en:` fails
  the build instead of being dropped), the desk contract in reading order, and the chrome triple.
- `src/lib/pageCopy.ts` — parse, validate, substitute per field from the overlay, and localize every
  internal `href` inside an HTML field through `localizePath`, so a translator writes `/press` and
  never thinks about locale prefixes.
- `src/lib/copyOverlay.ts` — one lookup over four files now (`concerts.{en,fr}.yaml` +
  `pages.{en,fr}.yaml`), refusing a key that appears in two of them.
- `ContactPage.astro` + three one-line routes. **Not** in `TRANSLATED_ROUTES` — the prose is still
  Polish, and the set is what makes a page's links, canonical and hreflang point at it.

**Two rules this settled, both mechanical rather than judged.**

- **The `Html` suffix IS the segment kind.** A field named `…Html` renders through `set:html` and is
  an `HTML` segment; everything else is `TEXT`, edited as plain text with no markup path at all.
  Derived from the name rather than declared per field, so the two cannot disagree — and it is the
  authoring convention the content modules already state. `kontakt` has four of them, which is where
  §7's `contenteditable` sanitizer finally gets something to sanitize.
- **A page's lists are keyed by an explicit `id`, never by position.** `concerts.yaml` keys
  positionally and pays for it (§6d). A hand-written page has no reason to: `channels.items` carry
  `id: booking`, so reordering a channel re-keys nothing. An email cannot serve — `@` and `.` are
  not legal inside a key part, which `KEY_PATTERN` would have caught only at ingest.

**The proof that no word moved.** `/kontakt` was built before the refactor and after it, and the two
renders compared with only what moving a file is allowed to change normalized away (Astro's per-file
scoped-style id, asset content hashes, insignificant whitespace, `&nbsp;` vs U+00A0). Four
differences remained, all of them intended: `"inLanguage":"pl"` added to the JSON-LD, the scoped
stylesheet renamed `kontakt.css` → `ContactPage.css`, `data-copied="Skopiowano"` added to the three
copy buttons (the confirmation is read off the button now, because one script serves three locales),
and the island's `uid`. No text node, no tag, no href differs. Whitespace normalization can hide a
lost space that mattered, so the hunks were read rather than counted.

**Left standing, deliberately.** `/en/kontakt` and `/fr/kontakt` build, carry English and French
chrome around Polish prose, and canonicalize to `/kontakt` — because `localizePath` returns the
Polish URL for a path outside `TRANSLATED_ROUTES`. That is the ordering contract doing its job, not
a defect: route files first, the set afterwards, once the prose is genuinely translated.

**And the debt this creates, named rather than buried:** `o-nas.ts` is now the one page holding
prose in TypeScript. It should move to `content/pages/o-nas.yaml` with today's reviewed EN/FR going
into the overlays — otherwise the desk will hold every page but the one it was modelled on.

### §6s Stage G2 — the pages reach the extractor, and what still holds them at the door (2026-09-03)

G1 settled where a page's words live and moved `kontakt` into it. G2 is the walk that turns those
words into segments: `copy:extract` now carries **two corpora**, and the second one is the first to
produce `HTML` rows at all.

**What shipped.**

- `copydesk/extractPages.mjs` — the page walk. It imports `walkCopy` and each page's spec straight
  from `src/i18n/content/`, which Node reads by stripping the types with no build step: the rule
  that turns a field into a key exists once and is executed by both ends, exactly as §6r requires.
  `PAGE_SPECS` is the registry — adding a page is that line plus its content module.
- `copydesk/segment.mjs` — the segment itself, lifted out from under the concerts extractor:
  `SITE_LOCALES`, the DTO ceilings and `KEY_PATTERN` mirrored from the backend, the three-locale row
  builder, and the guard that refuses a row the ingest would reject. Two corpora, one segment; a
  second copy of the ceilings would drift the expensive way, as a 400 three thousand rows into a
  batch.
- `segments.json` carries both, and `paths` says which corpus a record addresses by its SHAPE: a
  page's record names the file it lives in, a concert's is a location inside `concerts.yaml` that
  still wants its concert's index in front of it. The write direction has to branch on that anyway.
  Merging refuses a key both corpora claim — the same rule `lib/copyOverlay` enforces at module
  load, one step earlier, where the key is minted rather than read.
- Overlay READS learned the corpus (`pages.{en,fr}.yaml`); the write side did not, deliberately —
  `renderOverlay` would give a pages overlay a header naming `concerts.yaml`, and the run that
  writes it belongs to the stage that can sanitize what an editor submits.
- The extractor validates a page through its own zod schema before walking it, so `.strict()` fires
  here too: a hand-added `en:` in `kontakt.yaml` stops the extraction rather than being dropped.

**Measured:** 464 keys · 1 392 rows across both corpora, of which `kontakt` is 36 keys — four of
them `HTML`, which are the first four segments in this system that §7's sanitizer has any work to
do on. Two consecutive `copy:extract` runs are byte-identical.

**Accounting is mechanical for a page now, in both directions.** Every leaf of `kontakt.yaml` is
either in the page's contract or in its `notCopy` table, and a test proves the walk goes RED on a
field in neither — the positive test can only ever run against a file somebody already accounted
for, so the negative one is what says the guard bites. The zod schema does NOT make this redundant:
`.strict()` refuses a field the schema does not know about, and this refuses a field the schema does
know about that nobody classified — a line of prose that renders on the page and is invisible to
the desk, so no editor is ever offered it and no locale ever gets it. A third rule that was prose in
`copySpec.ts` and is now asserted: a list's `keyBy` must be declared not-copy, because an identity
an editor is about to translate is not an identity.

**What deliberately does NOT reach the desk yet.** `sync.mjs` posts by namespace —
`SYNCED_NAMESPACES` holds `concert` and not `page`. Extraction is complete regardless; that one line
is the door. Until the desk rebuilds a submitted value from §7's whitelist, showing an editor an
`HTML` row would be offering an edit the repository cannot safely take back: `contenteditable`
submits `<div>`, `<br>` and styled `<span>` into a field whose value is written into a content file
the guardrails keep free of presentation.

**What G3 owes**, in the order the door opens: the sanitizer wired end to end (the backend module
exists; nothing calls it on this path yet), then the pages overlay WRITER — `renderOverlay`'s header
per corpus and `apply.mjs` branching on the key's namespace to write a page's Polish scalar through
`yamlEdit.mjs` — then `SYNCED_NAMESPACES`. `TRANSLATED_ROUTES` stays last, per §6q's ordering
contract: route files, then real translations, then the set.

### §6t Stage G3 — the door opens, and the sanitizer trap was never the one we wrote down (2026-09-03)

G2 held the pages at the door with one line and named three things G3 owed, in order. The first of
them was already built, and finding that out changed what the stage was.

**The sanitizer was wired from the first copydesk commit.** §6s says "the backend module exists;
nothing calls it on this path yet". `services.sanitize_for_kind` is the one entry point into
`CopySegment.value`, and both write paths have always gone through it: `save_proposal` at the moment
an editor's autosave lands, and `review_proposal` when the reviewer rewrites the wording on the way
to accepting it. What was genuinely missing was proof of the second one and of a stronger property
than "hostile markup is removed":

- **A reviewer's own rewrite is the second way a value reaches the repository, and it is the one
  nothing else guards.** `apply-copy` writes `proposal.value` verbatim into a content file; if the
  reviewer's edit skipped the whitelist, the guardrails' rule that content files carry no
  presentation would be enforced against the editor and not against the person who overrules them.
  Asserted now.
- **The whitelist has to be a SUPERSET of the markup the corpus already holds.** An editor's first
  proposal on an `html` field is that field's own markup with one word changed, and it is rebuilt on
  the way in — so anything the site authored that the pass does not recognise is stripped in
  silence, and what the editor sees is their sentence accepted with the link simply gone. The four
  constructions in `kontakt.yaml` (`<em>`, an internal `<a href>`, a `mailto:` one) are asserted to
  survive untouched, and to survive a second pass over the first pass's output — an escape that is
  not idempotent corrupts the field a little more with every edit.

**And the trap §7 records is not the one this desk has.** There is no `contenteditable` anywhere in
`features/copydesk`: the editor is a `GrowingTextarea`, `kind` reaches the frontend DTO and nothing
reads it, and no value is ever rendered as markup. So an `HTML` field is edited as its own source —
the editor sees `<em>Wyrosła</em>` and types `<em>`. That is safe on both ends (React escapes what
it renders, the whitelist rebuilds what it stores) and it is the honest shape while the vocabulary
is three tags, but it is a DECISION rather than the absence of one, and the desk currently says
nothing about it. The sanitizer's real job here is narrower and still worth its existence: a paste
carries markup as text into a plain field, and `text` segments have no markup path at all.

**What shipped, in the order the door opens.**

- `copydesk/overlay.mjs` takes the corpus as a parameter rather than assuming the evenings.
  `renderOverlay` and `writeOverlay` now write either pair, and the header — the only prose in a
  machine-written file — names its own Polish source, because it is what an emergency edit reads
  before touching anything. Two paragraphs the hand-written `pages.{en,fr}.yaml` stubs carried are
  now produced for all four files rather than lost to the first machine write: the per-field
  fallback rule, and (in French only) §7's warning that `lib/typo.ts` inserts the narrow no-break
  spaces at build and a hand-typed one doubles up.
- `copydesk/apply.mjs` branches on the key's namespace. It reads every Polish corpus up front —
  `concerts.yaml` and each registered page — plans every file's rewrite in full before a byte is
  written, and rolls all of them back together if the on-disk verification fails. A page's Polish
  goes through the same `yamlEdit.mjs` splice with the same four proofs; nothing about that
  operation is page-specific, which is the whole argument §6r made against a TypeScript writer.
- `SYNCED_NAMESPACES` gained `page`. It stays a set rather than becoming nothing: it is the throttle
  a corpus is opened through, and a corpus whose extractor works before its writer does belongs
  outside it, or the desk collects accepted proposals nothing can carry into the repository.

**Two invariants asserted rather than trusted.** `paths` tells the corpora apart by SHAPE and a key
tells them apart by NAMESPACE, and they agree by construction — so the writer checks them against
each other and refuses the row when they disagree. A `segments.json` older than this stage carries
page records with no file in them, and guessing would splice a paragraph into whichever corpus
happened to have something at that path. The second is the one G2 left standing: before this, `plan`
built its paths from the concerts extractor alone, so a `page.` row was refused with "the corpus has
no such key" — a true sentence about the wrong corpus, which would have sent a reviewer to restore a
field that never left.

**Proved end to end, not only in units.** `copy:apply --write` was run against a stub panel serving a
four-row patch — a concert's Polish, a concert's English, a page's Polish, a page's English — and it
wrote `concerts.yaml`, `concerts.en.yaml`, `pages/kontakt.yaml` and `pages.en.yaml` in one run, each
verified from disk. The two hand-written corpora came back with their comment lines and scalar
counts intact, all four files pure CRLF, and `git diff` showed one changed line in each Polish file.
The site then built with a populated pages overlay. The tree was restored afterwards; nothing of the
rehearsal is committed.

**What is still owed, and by whom.** `TRANSLATED_ROUTES` stays last, per §6q — route files, then
real translations, then the set; `/kontakt` is written and its prose is still Polish. `o-nas.ts` is
still the one page holding prose in TypeScript (§6r's named debt). And the desk owes an `HTML` row
one sentence saying what the editor is looking at, in the same place §7 says French punctuation
spacing has to be said.

### §6u Stage G4 — `/kontakt` goes through the whole loop, and two pages it found on the way (2026-09-04)

G3 opened the door and left three things owed. This stage walked the first page all the way through
the loop the desk was built for — extract, sync, propose, accept, apply, flip the route — which is
the first time any of it has run end to end on real translations rather than on a rehearsal.

**One tool change, and it was the door the page corpus was still shut behind.** `copy:propose` read
the evenings alone (`readCorpus` → `extractAll`), so every `page.` key would have been refused with
"the corpus has no such key" — a true sentence about the wrong corpus, which is exactly the shape of
error §6t caught in `apply.mjs` and fixed there. It reads both corpora now. Nothing else in the
command is corpus-specific: a draft file is a page's worth of work, and whether that page is an
evening or `/kontakt` is a fact about the key's namespace and nothing more.

**What shipped.** `copydesk/drafts/{en,fr}/kontakt.yaml` — 36 fields each, both §2 passes — carried
in as proposals (`copy:sync`: 108 rows created, the page corpus entering the mirror at last;
`copy:propose --write`: 36 + 37), accepted, and written by `copy:apply --write` into
`pages.en.yaml`, `pages.fr.yaml` and `concerts.fr.yaml`. Then `/kontakt` entered
`TRANSLATED_ROUTES`, which is what makes the two foreign pages canonicalize to themselves and every
localized link across the site point at them. Verified in `dist/`: three titles, three h1s, a
complete hreflang graph on all three, and `/en/kontakt` reachable from `/en/o-nas` and from every
English concert page.

**Four decisions worth carrying.**

- **The four `HTML` fields came back through the sanitizer unchanged**, which is §6t's superset rule
  holding in production rather than in a unit test: `to <em>us.</em>`, both `<a href>` links and the
  `mailto:` one survived the round trip a proposal makes through `sanitize_for_kind` on the way in
  and out. This is the first time the whitelist has met markup an editor could actually lose.
- **A page's translation follows the corpus's own renderings, not fresh ones.** The hero names four
  venues and three of them are already on the site in English and French — `Łódź Cathedral` /
  `la cathédrale de Łódź` from the 9-kart gallery, `the Tempel Synagogue` / `la synagogue Tempel`
  and Tyniec's abbey from `/o-nas`. A reader who follows the link must not meet the same building
  under a second name, and the draft that says "archcathedral" because the Polish says
  "archikatedra" is the failure mode: it is a good translation of the sentence and a bad one of the
  site. §2's second pass is what finds this — the first pass has only the one Polish line in front
  of it.
- **French takes the split the French wants.** `hero.title1`/`title2Html` are two composed lines and
  the Polish breaks them "Napisz / do nas." French cannot break `Écrivez-nous` at all, so the line
  is `Écrivez-nous / un mot.` — the addressee stays whole and the emphasis moves to the last word,
  which is what the contract's own note about the break licenses. Same class of decision in the
  RODO note: `(art. 6, § 1, f) RGPD)` closes a parenthesis in the middle of its own citation, so
  the citation leaves the parenthesis (`au titre de l'art. 6, § 1, f) RGPD`) rather than being
  transliterated into a shape French does not use.
- **The `HTML` sentence G3 owed is per PAGE, not per row.** A field carrying tags is
  self-identifying — the editor can see them in the textarea. What they cannot see is that this is
  deliberate, that they are editing the field's own source, and that a tag they delete takes the
  emphasis or the link off the site with it. So it sits beside the French spacing note, shown when
  the page actually holds an `HTML` field, which also keeps it from becoming forty identical
  captions when `/kolofon` arrives. `kind` reaches `CopyDeskField` for this; it is a property of the
  KEY, so every locale of one field agrees on it.

**Two defects found by running the loop, not by writing new code.** Neither is in the copy desk.

- **`concert.wcielenie.programLede` had two translations and one of them was a lie.** `ede9a30`
  edited the Polish from "Dziesięć spojrzeń i bis" to "Dziesięć spojrzeń" and hand-edited
  `concerts.en.yaml` in the same commit, leaving `concerts.fr.yaml` saying `Dix regards et un bis` —
  a French page advertising an encore its own lede no longer names. **A hand edit of an overlay is
  the one move that makes the stale machinery blind**, and the overlay header says so in as many
  words: the desk never learned the Polish had moved, so it never marked the French stale, and the
  drift surfaced only because `copy:propose`'s dry run compares every drafted value against the
  repository. The correction went through the desk like any other value. Note what did NOT need
  correcting: `programArc` still says "the joy of the encore" in all three, because the encore is
  still in the programme — the edit shortened the LEDE, and the arc was right to keep it.
- **Ten foreign concert pages have carried a Polish footer since stage F.**
  `ConcertPage.astro` rendered `<SiteFooter />` with no `lang`, while `AboutPage` and `ContactPage`
  pass it. The default is Polish and it is there on purpose — "every un-migrated caller renders
  byte-identical to before" — which is what made this invisible for a whole stage: the page built,
  the audit passed, and the only symptom was a site map reading "O nas · Koncerty · Obrazy ·
  Kontakt" under an English concert. The remaining `<SiteFooter />` callers (404, kolofon, koncerty,
  obrazy, press) are correct: those pages are Polish-only and are stage G's.

**What is still owed.** `o-nas.ts` is still the one page holding prose in TypeScript (§6r's named
debt), and it is now also the one page whose translations no editor can reach. The next pages are
`/koncerty`, `/obrazy`, `/kolofon` and the chrome, each of them a content module plus a contract
plus two route files before its entry in `TRANSLATED_ROUTES`; the landing stays last. And the
donation vault's terms (`Regulamin darowizn`, and the privacy link beside it) print Polish in every
locale on every page that carries the island — legal copy, so a decision rather than an oversight,
but it is the one Polish text left on a finished English page.

### §6v Stage G5 — `/koncerty`, three sources on one route, and the gold missing since G1 (2026-09-04)

The second page, and the first one where the desk's corpus is not the only thing the page reads.
`/kontakt` says everything it says; `/koncerty` prints six concerts' worth of the OTHER corpus
between its own hero and its own coda, so the stage's real work was drawing the line three ways
rather than two.

**What shipped.** `/koncerty` renders from a shared component in three locales, with no word
changed: `src/content/pages/koncerty.yaml` (31 copy fields), `src/i18n/content/koncerty.ts` (schema,
contract, chrome), `src/i18n/content/repertuar.ts` (the era names), `components/pages/KoncertyPage.astro`
and three one-line routes. `PAGE_SPECS` gained the page — **495 keys · 1 485 rows across both
corpora**, of which `koncerty` is 31. Both drafts are written and through §2's two passes
(`copydesk/drafts/{en,fr}/koncerty.yaml`); the loop itself — `copy:sync`, `copy:propose --write`,
accept, `copy:apply --write`, `TRANSLATED_ROUTES` — is the developer's to run, because it writes to
the live panel.

**Four decisions worth carrying.**

- **Three sources meet on this route and each keeps its own door.** What the PAGE says is the
  desk's prose. What a CONCERT says goes through `withOverlay(concertKey(id, field), lang, polish)`
  — the same `say()` the detail page uses, and never `pickLocale`, which §7 says returns Polish in
  every locale on a Polish-only corpus. Thirteen fields per station travel that way (title,
  essence, `metaPlace`, `dateLabel`, both incipit halves, every `facts[i]`, every `links[i].label`,
  `posterAlt`, `realizacja`), so the English index reads its evenings in English without a single
  new translation being written. The chrome is the third door.
- **An era's NAME is a label, not prose — and it left the catalogue because two pages print it.**
  `repertoire.yaml` held `title` and `span` in Polish; /koncerty prints them and so does the
  landing's litany plate. §6r's test decides it: completeness CAN be demanded of a one-word band
  heading — a band whose head is missing in French is a broken page, not a page waiting for review
  — so they take `Record<Locale, …>` in `i18n/content/repertuar.ts`, and `eraName(id, locale)`
  THROWS on an era nobody named. The catalogue now holds no copy at all, which is a rule that can
  be stated: composers, work titles and datings are names and structure.
- **The dating qualifiers are named, not translated.** Twelve `works[].year` values carry a Polish
  word — "ok. 1727", "pocz. XVI w.", "aranż. współczesna", "trad. Oksytania" — and they print
  Polish in every locale. A dating is never copy on this site (stage A's rule, which is why
  `viaDate` and `inscriptioRef` became structural), so the fix is structural and belongs with
  whoever does that; pretending it is copy would put a formatting convention on the desk for
  Florent to review. Recorded in the file's own header and here, rather than left to be discovered.
- **The h1's break moved and the gold moved with it.** `intro.title1`/`title2Html` are two composed
  lines; the Polish breaks "Koncerty / Duchowe." English reverses noun and adjective, so the split
  is "Spiritual / Concerts." and the emphasis — which is the gold — lands on the noun instead of
  the adjective. French keeps the Polish order and the gold lands where Polish put it. That is the
  contract's own licence about the break, and it is worth stating that the licence moves a COLOUR,
  not only a line ending.

**The defect the proof found, and it was not on this page.** `/koncerty` was built before the
refactor and after it and the two renders compared: **the word stream is identical, 2 915 words to
2 915**, and the only markup differences are the ones moving a file is allowed to make — the scoped
stylesheet and the two page scripts renamed with their component, the island's `uid`,
`"inLanguage":"pl"` added to the JSON-LD, and block-scalar folding where the source had a newline.
The landing's litany is byte-identical but for the build clock. What the comparison surfaced was
one difference it could not explain: **`<em>` inside a `set:html` field carries no scope
attribute.**

Astro scopes a rule by appending its cid attribute to EVERY compound, so `.hero h1 em` compiles to
`h1[cid] em[cid]` — and an element the page injected as a string has no cid. The rule matches
nothing, silently, and the text still renders. Measured: **`/kontakt` has printed its title's
emphasised word without the candle gold since G1 shipped**, along with the gold `<em>` in the
channels intro and the underline on both prose links; `/o-nas` has printed nine `<strong>` at the
browser's default weight instead of the `.prose strong` 500 since long before the desk existed.
Five rules across three components are `:global(…)` now, and the emitted CSS was checked for the
bare descendant rather than trusted. This is the recorded "Astro scoped styles do not reach
injected DOM" trap arriving through a door nobody had it filed under: not `innerHTML` from a
script, but the page's own copy.

**One thing for the editor rather than for the code.** `rites.items.porzadek.text` quotes the
ensemble's marginal note in FRENCH guillemets — «kolejność jest bardzo ważna» — where Polish
typography takes „ ” and where the corpus itself uses „kolejność ważna" (`concert.wcielenie.programArc`).
Left exactly as it stood, because the byte-for-byte proof depends on not touching the Polish and
because it is now the desk's to change; both translations follow the corpus's rendering of that
note rather than this one's punctuation.

**What is still owed.** The loop for this page, then `/obrazy`, `/kolofon` and the chrome, then the
landing. `o-nas.ts` is still the one page holding prose in TypeScript (§6r's named debt) and the
one page whose translations no editor can reach. The donation vault's terms still print Polish in
every locale on every page carrying the island.

### §6w Stage G5 — the loop run, and the attribute the desk was eating (2026-09-04)

The second page all the way through, and the run is unremarkable: `copy:sync` at `88f6a9a` put
**93 rows into the mirror** (31 keys × 3 locales, 0 updated, 0 retired — the desk now holds 495
keys); `copy:propose --write` posted and accepted **31 EN and 31 FR**, `page.koncerty 31 / 31` in
both; `copy:apply --write` wrote **62 translations, 0 Polish edits, 0 refused** into `pages.en.yaml`
and `pages.fr.yaml` and stamped every one. Then `/koncerty` entered `TRANSLATED_ROUTES`. Verified in
`dist/`: three titles, three h1s, a complete hreflang graph with a self-canonical on each, the five
concert pages and `/o-nas` linking to the reader's own index, and — the check §6v's fix earns —
`h1[data-astro-cid-…] em{color:var(--candle)}` in the emitted CSS, the scope-free `em` that means
the injected emphasis takes the gold.

**And a third defect the loop found rather than a test: the desk was silently eating an attribute
the corpus writes.** `sanitize_for_kind` rebuilds every submitted value from
`<em> <strong> <a href>`, and `href` on `<a>` was the whole of `ALLOWED_ATTRIBUTES` — so
`<em lang="fr">Concerts Spirituels</em>`, which is how this page names the eighteenth-century
series in all three languages, came back as `<em>`. It is visible in the applied patch and it is
now in both overlays: `intro.noteHtml` and `rites.ledeHtml`, where English prose has lost the one
marker saying that phrase is French (in the French overlay the attribute was redundant anyway).
Nothing warned. That is §7's own trap — *a whitelist that is not a superset of the corpus destroys
the corpus, one edit at a time* — arriving through the half the trap did not spell out: it says
"before adding a TAG to a content file, add it to `ALLOWED_TAGS`", and an attribute cuts exactly
the same way. The corpus authored the `lang` before the desk ever saw the page, so the first thing
through the door lost it.

- **`lang` is meaning, not presentation, which is why it belongs on the list** beside `href` and
  nowhere near `class` or `style`: a screen reader changes voice on it and the hyphenator changes
  language. It is whitelisted on `em`, `strong` and `a`, its value checked against BCP 47's shape
  and dropped — not escaped — when it does not parse.
- **The emit had a latent bug that only a second allowed attribute could show.** It rebuilt the
  whole tag string per attribute rather than accumulating, so of two recognised attributes only the
  last survived. One allowed attribute made it unobservable. It accumulates now, first occurrence
  wins on a repeat.
- **The test that should have caught this is a hand-written list of the corpus's shapes**, and it
  named `kontakt.yaml` only, because that was the whole page corpus when it was written. It now
  carries `koncerty.yaml`'s two as well and says in its own docstring that a page joining the corpus
  adds its shapes in the same commit. A test that enumerates a moving corpus by hand is worth
  keeping only if the rule for extending it is written where it is read.

**What this owes, and it is the developer's:** the fix is backend code, and the desk that stripped
the attribute is **production's**. Until `backend/copydesk/sanitizers.py` is deployed, a proposal
carrying `lang` still loses it, so the two English fields keep the stripped form — and
`copy:propose` will report those four rows (two per locale) as "to propose" on every run, because
the drafts carry the attribute and the repository does not. After the deploy: `copy:propose --write`
for both locales, `copy:apply --write`, one four-row diff, done.

### §6x Stage G6 — `/obrazy`, the page that is mostly not words (2026-09-04)

The third page, and the one where the desk's share of a page is smallest: **nine copy fields**
standing around 48 photographs. Everything else a reader meets was already owned by something —
which made the stage's work deciding what each of those things is, rather than writing prose.

**What shipped.** `/obrazy` renders from a shared component in three locales:
`src/content/pages/obrazy.yaml` (9 fields), `src/i18n/content/obrazy.ts` (schema, contract, chrome,
declensions), `src/i18n/content/miejsca.ts` (seven venues in three languages),
`components/pages/ObrazyPage.astro` and three one-line routes. `PAGE_SPECS` gained the page — **504
keys · 1 512 rows**. Both drafts went through §2's two passes, then the whole loop: `copy:sync` (27
rows created), `copy:propose --write` (9 + 9), `copy:apply --write` (18 translations, 0 Polish
edits, 0 refused), `TRANSLATED_ROUTES`. **The proof the move changed no Polish: 1 499 words, in the
same order, before and after** — the only markup differences the ones moving a file is allowed to
make.

**Four decisions worth carrying.**

- **A venue's NAME is a label, and this page prints it as a heading — so it left the corpus the way
  the era names did.** `concerts.yaml`'s `venue` is `schema.org` `Place.name`, declared not-copy in
  the desk's own table, and it cannot also be the name a reader meets in three languages without
  one field meaning two things. `i18n/content/miejsca.ts` names the seven buildings,
  `placeName(venue, locale)` throws on a room nobody named, and `galleryRuns` titles a run through
  it. **This fixed a defect the stage did not introduce**: every foreign concert page has headed its
  gallery runs `Bazylika NSPJ, Kraków` since stage F, under a dateline reading `Sacred Heart
  Basilica, Kraków` — one building under two names inside one document, which is precisely what §6u
  set the rule against. The renderings are the site's own, taken from the overlays and the alt text,
  not freshly invented.
- **A noun that must agree with a computed number is chrome, not prose.** "48 fotografii · 5
  wieczorów · 6 miejsc" is counted at build, and Polish declines 2–4 apart from 5-and-up, so the
  three nouns take `Record<Locale, …>` with `few` present only where a language has that category.
  Nobody reviews a plural form; a missing one is a broken line. Same test as a landmark, so the same
  shape.
- **The page's own name comes from the entrance that leads to it.** The footer's Index column has
  said `Images` in English since the column existed, and `koncert.ts` already calls one evening an
  `Image`. So the h1 is `Images` in both foreign locales and the breadcrumb prints the h1 rather
  than a chrome string of its own — a reader must land on the page they pressed, and one word may
  not have two homes.
- **`meta.description` loses its count on the contract's own instruction.** The Polish says "z
  pięciu Koncertów Duchowych" while the page beside it counts the evenings at build. The number is
  a lie waiting for the sixth gallery, so the note tells the translator to render it count-free
  rather than faithfully — the same call §6v's `/koncerty` description already made, arriving here
  as an editorial decision the desk now owns.

**What is still owed by this page.** The tour list on a concert page prints `dates[].venue`, which
is deliberately the fuller legal string — a street address in one case, "(dolny kościół)" in
another — so it stayed Polish on the foreign pages. That is a decision about whether an itinerary
prints a NAME or an ADDRESS, not a translation, and it belongs to whoever makes it rather than to
this stage. And the four `lang="fr"` rows from §6w re-propose on every run until the sanitizer fix
is deployed; they apply as no-ops in the meantime.

### §6y Stage G7 — `/kolofon`, the page that is mostly other people's names (2026-09-04)

The fourth page, and the one where the desk's share was decided almost entirely by accounting
rather than by writing: **55 copy fields** standing among four typefaces, six collaborators, six
photographers, a board of three, a registry of numbers and nine Latin rubrics — none of which is
copy. A name and a number are the same in every language, and the Latin is the same in every
language on purpose, so what a language actually renders here is the vernacular tier of each
rubric, the four sentences the page is set by, the materials, the type notes and the roles.

**§6w's owed item is discharged and did not need doing again.** The sanitizer fix reached
production and `eea4fd6` applied the four `lang="fr"` rows; this stage's `copy:propose` reported
`55 to propose · 504 already in the repository` in both locales, with nothing re-proposing.

**What shipped.** `/kolofon` renders from a shared component in three locales:
`src/content/pages/kolofon.yaml` (55 copy fields), `src/i18n/content/kolofon.ts` (schema, contract,
chrome), `components/pages/KolofonPage.astro` and three one-line routes. `PAGE_SPECS` gained the
page — **559 keys · 1 677 rows**. Both drafts went through §2's two passes, then the whole loop:
`copy:sync` (165 rows created, 0 updated, 0 retired), `copy:propose --write` (55 + 55),
`copy:apply --write` (110 translations, 0 Polish edits, 0 refused), `TRANSLATED_ROUTES`. **The proof
the move changed no Polish: 1 724 words, in the same order, before and after**, with 19 markup lines
differing and every one of them a difference moving a file is allowed to make.

**Four decisions worth carrying.**

- **One paragraph, one home — and the page READS the other page's field rather than holding its
  own.** The foundation's mission stands verbatim on `/kontakt` and in `Fundatio` here, so
  `KolofonPage` calls `pageCopy(KONTAKT_PAGE, lang).locus.mission`. Two desk rows carrying one
  paragraph is exactly the drift §7 says the machinery cannot see: an editor moves one, nothing
  marks the other stale, and the two pages state the foundation's purpose differently in the same
  locale — which is precisely how `concert.wcielenie.programLede` shipped a French encore that no
  longer existed (§6u). The price is real and is the point: an edit on `/kontakt` changes the
  colophon, and `kontakt.ts`'s contract entry says so in capitals so that nobody discovers it from
  a diff. This is the first cross-page read on the desk; the rule it sets is that a paragraph
  printed twice is read twice, never written twice.
- **A phrase that must agree with a computed date is chrome, not prose.** "Złożono i odbito 4
  września 2026" takes the same test /obrazy's counted nouns took (§6x): French demands the article
  before the date, Polish demands none, English demands neither, and nobody reviews a preposition.
  So `impressio` is a `Record<Locale, …>` prefix and the date is formatted by `lib/dates` — the
  site's one long-date formatter, which also retires a hand-rolled `Intl` call and gives the line
  the register every dateline has. It is composed from the LOCAL calendar day rather than
  `toISOString`, because a build after 22:00 in a positive-offset zone would otherwise date the
  impression tomorrow.
- **The frame count is /obrazy's declension, imported rather than restated.** `Imagines` prints
  "8 fot." beside a photographer's name and the archive prints the same number three screens away
  on another page; the file's own comment already demanded they agree, and this stage made the
  agreement mechanical by calling `counted(n, OBRAZY_CHROME[lang].figure, lang)`. The evenings come
  through the desk's overlay by concert key and the places through `i18n/content/miejsca`, so the
  foreign colophon names each building and each evening as the rest of the site names them — with
  no new translation written for any of it.
- **The `&nbsp;` the markup carried does not follow the words into the corpus.** The page had
  fifteen hand-pinned bindings; nine of them are made by `lib/typo.ts`'s own rules (every one-letter
  Polish conjunction), and six are not ("bez cookies", "na licencji", "po stronie", "ta sama", "tu
  jesteś", "gdy wrócisz"). Those six are given up rather than written into YAML as a literal U+00A0,
  which an editor cannot see in a textarea and would delete without knowing. The precedent was
  already set and is worth stating: `kontakt.yaml` holds the same mission sentence with "na cele
  statutowe" unpinned. The corpus carries words; `lib/typo.ts` carries the breaks.

**Two defects found by running the page, not by writing new code. Neither is in the copy desk.**

- **Astro drops the whitespace between an expression and whatever stands next to it**, and the
  word-stream proof is blind to exactly that. `{copy.fundatio.statuteLink} <span>↗</span>` shipped
  the arrow hard against the document's name, and `{t.impressio} {impressioLabel}` shipped
  "odbito4 września". The proof could not see either, because it replaces every tag with a space
  before counting words — so "…(PDF)" and "↗" read as two words whether or not a space separated
  them. It was the normalized MARKUP hunks that caught it, which is the whole reason §6r says the
  hunks are read rather than counted. The fix is `{" "}` and one template literal; the lesson is
  that a word-stream proof answers "did a word move", never "did a space".
- **The nave card's fine print linked "Kolofon" — the Polish word, at the Polish URL — from every
  English and French page on the site.** `ui.ts` has carried `footer.colophon` in three locales
  since the chrome was translated; nothing read it, because that one link was hand-written before
  `SiteChrome` learned `lang` and nobody grepped the callers afterwards. Same shape as the Polish
  footer under ten English concert pages (§6u), one component further in, and the same lesson: when
  a shared component learns `lang`, the literals already inside it are the thing to sweep.

**What is still owed.** The chrome, then the landing. `o-nas.ts` is still the one page holding prose
in TypeScript (§6r's named debt) and the one page whose translations no editor can reach. The
donation vault's terms still print Polish in every locale on every page carrying the island.
`dates[].venue` on the concert pages is still the fuller legal string in Polish (§6x). And one
small divergence this page did not create and did not fix: the statute link's screen-reader note
says "otwiera się w nowym oknie" where the footer's `statuteAria` says "nowej karcie" — one fact,
two wordings, and changing the Polish was not this stage's to do.

### §6z Stage G8 — the chrome, which turned out to be a sweep (2026-09-04)

The fifth stage of G, and the first one that **adds nothing to the desk from the surface it was
named after**. The question the stage was set was not "how do we translate the chrome" — the
chrome has been a `Record<Locale, …>` since stage F — but "which of it is prose Florent edits".
All 38 keys of `ui.ts` were put through §6r's completeness test, and the answer is: **none of
it**.

- **35 are landmarks, affordances and index labels.** A missing locale there is a broken page, not
  a paragraph awaiting review. They stay typed.
- **Three looked like candidates and are not.** `nav.archiveGloss` ("wszystkie fotografie") and
  `footer.statuteAria` are two-word labels. `footer.donationNote` ("Darowizna na cele statutowe.")
  is genuinely a claim rather than a label — and it is the **third printing of a fact
  `kontakt.yaml` already owns**, which §6y settled: a sentence printed twice is READ twice, never
  written twice. Putting it on the desk would have created the drift the rule exists to stop.

So `PAGE_SPECS` grew by a page and not by the chrome. **563 keys · 1 689 rows** (+4 keys, +12
rows), all of them `/404`'s.

**The sweep was the stage.** G7 found a hand-written `<a href="/kolofon">Kolofon</a>` in the nave
card. It was not one literal; it was five, all the same shape — correct when typed, blind once the
file around them learned `lang` — and two of them were the site's worst-reachable defect since
stage F:

- **The mobile Via sent every concert row to the Polish page.** `href={r.href}` where the desktop
  ribbon two hundred lines above already called `localizePath`, on the surface this file's own
  comment calls "the phone's only road to the pages the desktop hangs under KONCERTY". A comment
  beside it asserted "concert pages stay Polish-only" — false since §6o.
- **`registrum-all` and `via-all` carried a hand-written `/obrazy`** from before §6x translated it,
  while the footer's Index column on the same page offered `/en/obrazy`. One reader, two addresses
  for one page.
- **`via-all` printed `Obrazy`** where `t.nav.archive` has said "Images" in both foreign locales
  since the chrome was translated.
- **`SiteFooter` printed the Polish season gloss on every page in every locale** — under the Latin
  incipit and inside the `aria-label`, out of a field literally named `pl`. That is §7's
  key-named-for-a-locale trap in a third disguise, and the field is `gloss: Record<Locale, …>`
  now. The canonical hour's poem did the same in the mobile card.
- **Three islands had never learned a locale at all**, and this is the half the stage was not
  looking for: `ImageLightbox` (four accessible names, on /obrazy, /kolofon and every concert
  page), `VideoPlayer` (five, plus a scrubber whose `aria-valuetext` joined the times with the
  Polish word "z"), and `ScrollTopButton` — which `BaseLayout` mounts on **every page of the
  site** and which prints a VISIBLE Polish hint, "wróć w ciszę", beside the cursor.

**Four decisions worth carrying.**

- **A locale a client island holds is read from the document, never taken as a prop.**
  `ScrollTopButton` is `transition:persist`: the ClientRouter keeps the island's INSTANCE across a
  swap, so a prop freezes at whichever language the tab opened on — a Polish landing, one
  navigation, and the control is offering Polish to an English reader with nothing reporting an
  error. `i18n/documentLocale.ts` reads `<html lang>`, which every swap rewrites, and
  `useDocumentLocale` re-reads it on `astro:page-load`. The chrome's own delegated script takes
  the same route for a different reason: it binds once per tab (`__voctChrome`) and outlives every
  document it acts on, so it must ask when it acts rather than remember.
- **A gloss that must agree with a computed HOUR or SEASON is chrome.** Same test §6x applied to a
  counted noun and §6y to a computed date, one turn further: five seasons and eight hours are
  closed tables walked by the calendar and the clock, so a missing locale is a broken line rather
  than one awaiting review. They are complete triples in `lib/tempusLiturgicus` and
  `horaeCanonicae`, and they went through §2's two passes like any draft.
- **A blank leaf speaks the language of the shelf it was found on, and that is an nginx decision.**
  `/404` is a page of the desk now (`content/pages/404.yaml`, `i18n/content/notFound.ts`,
  `NotFoundPage.astro`, three routes) — but three documents are useless while one `error_page`
  serves them all. A `map $uri $marketing_404` in `nginx.conf` picks the leaf from the prefix that
  was asked for, and the whole existing miss cascade (marketing files → app assets → `@not_found`)
  stays intact: only the leaf at the end of it turns. A pair of prefix `location` blocks would
  have duplicated that cascade to change its last line.
- **`/404` stays OUT of `TRANSLATED_ROUTES`, and this is the first page to earn that.** The set's
  documented job is to light LINKS, a language switcher and an hreflang graph. Nothing links to a
  404; it is reached by a mistake, through nginx. An hreflang graph on a `noindex` leaf is noise
  Google discards, and a switcher on it offers a choice of blank leaves. So: three documents, no
  ledger entry, and `NotFoundPage` composes its own canonical from `lang` rather than looking one
  up. The ordering contract is untouched — it forbids entering the set early, not staying out.

**The page is four fields, and the accounting is why.** What a reader meets is five Latin rubrics,
a number, two sentences and four ways out. The rubrics are locale-neutral, `404` is a number, and
the four ways' vernacular names are the names the chrome **already prints** for those destinations
— `ui.footer.home`, `CONCERT[lang].meta.breadcrumb`, `ui.nav.about`, `ui.nav.contact`. Restating
them here would have put four rows on the desk carrying names that already exist, and the first
edit to either copy would leave a reader looking at two words for one destination on one screen.
Both drafts also had their register decided by evidence rather than taste: "karta" is published by
this site as **Leaf** and **feuillet** (`9 Kart` → "Nine Leaves from the Book of Psalms", "Neuf
feuillets du Livre des Psaumes"), which is what makes the `Vacat` above it legible in all three.

**The loop:** `copy:sync` (12 created, **0 updated, 0 retired** — nothing else in the corpus
moved), `copy:propose --write` (4 + 4, with **"559 already in the repository" and nothing
re-proposing**, which discharges §6x's owed item: the sanitizer fix is deployed and the four
`lang="fr"` rows have stopped re-proposing), `copy:apply --write` (8 translations, 0 Polish edits,
0 refused).

**The proof the move changed no Polish: 236 words, in the same order, before and after** — and
because a word-stream proof is blind to attributes (§6y), all 415 attribute values were compared
too: two class names differ, `nf-way-pl` → `nf-way-name` and `foot-incipit-pl` →
`foot-incipit-gloss`, both renamed on purpose because neither holds one language any more.

**What is still owed.** H–K in §6's table. Inside this stage's own reach, two small divergences it
did not create: the statute link's screen-reader note still says "otwiera się w nowym oknie" where
`footer.statuteAria` says "nowej karcie" (§6y), and `dates[].venue` on the concert pages is still
the fuller Polish legal string (§6x). And one this stage inspected and left standing on purpose:
the footer's postal address prints "ul. Św. Filipa 23/3" in every locale, because an address is
written the way it must be written on an envelope.

### §6aa Stage H — `/o-nas`, the page the pattern was modelled on (2026-09-04)

§6r named this debt the day the pattern was invented: `o-nas.ts` held three locales of prose in
TypeScript literals from before the desk existed, so the site's founding text was the one page no
editor could reach and no reviewer could accept a word of — `copy:apply` splices a YAML scalar and
rewrites an overlay, and can write a `.ts` file by no means at all. **The desk now holds every page
the site has.**

**What shipped.** `src/content/pages/o-nas.yaml` (73 copy fields), `src/i18n/content/o-nas.ts`
(schema, contract, and the ten landmark names as a `Record<Locale, …>`), `AboutPage.astro` reading
both. The eight Latin rubrics and the four stanza numerals went into the markup, where the rest of
the site keeps its locale-neutral tier. `PAGE_SPECS` gained the page — **636 keys · 1 908 rows**.
The whole loop: `copy:sync` (219 created, **0 updated, 0 retired**), `copy:propose --write` (73 +
73, with 563 already in the repository and nothing re-proposing), `copy:apply --write` (146
translations, 0 Polish edits, 0 refused). `TRANSLATED_ROUTES` needed no edit — **the first page of
the whole stage that was already in it**, since /o-nas has been live in three languages since
stage F.

**The proof the move changed nothing: all three locales are word-identical to the pre-move build —
2 225 PL, 2 498 EN, 2 583 FR, in the same order** — with every attribute value compared as well,
because a word-stream proof is blind to those (§6y). Exactly one attribute differs per locale, and
it is the fix below. The four `HTML` fields came back through the sanitizer untouched, both `<em>`
and both `<strong>`.

**This page had no draft to write, and that changed what the pass was.** Its English and French were
already written and reviewed; the stage moved them between files and invented none. What they had
never had is §2's second pass against the REST of the site — they were written before any other page
was translated, so every term they share with a page published since had to be checked against what
that page prints. Seven were, and all seven already agreed (Spiritual Concerts, the foundation, the
board, seven centuries, St Andrew Bobola, the Tempel Synagogue, Tyniec's abbey). The eighth did not,
and it is the third finding below.

**Four findings worth carrying.**

- **The board's roles were paired to faces BY POSITION.** `boardMembers` is a hard-coded triple in
  the component and the roles were `c.governance.roles[i]`, which was safe while both lists lived in
  one TypeScript file and stopped being safe the moment the roles became a desk list an editor can
  reorder. They carry an `id` now and the component looks a remit up by it, throwing rather than
  rendering a card with a name, a face and no role — and the empty string would have gone into the
  portrait's alt text, where nobody would have seen it.
- **The statutory-purposes list was carrying its own section's `aria-label`.** `<ol class="goals">`
  and the `<section>` around it both read `c.foundation.aria`, so a screen reader met two things
  called "Fundacja VoctFoundation" on one screen with no way to tell which had just been entered. It
  is `goalsAria` now — the one attribute the before/after comparison shows changing on the Polish
  page, and the reason that comparison reads attributes at all (§6y: a word-stream proof is blind to
  them).
- **The Latin rubric `Via` has two different POLISH glosses.** /koncerty calls it "Droga koncertów"
  and /o-nas calls it "Co już wybrzmiało", so the English and French follow their own Polish and
  print "The path of the concerts" on one page and "What has sounded" on the other. §6y's rule —
  one rubric, one gloss — is broken here in the source language, which makes it Florent's editorial
  question rather than a translation defect, and both drafts say so in their headers rather than
  harmonising it unasked. Note the chrome already agrees: /o-nas's `milestonesAria` is exactly
  /koncerty's published gloss.
- **The panel went down mid-run, and the resumability §6n built for a different reason is what
  saved it.** `copy:propose --locale en --write` failed at sign-in: a connect timeout, then
  `POST /api/token/` answering with the marketing site's HTML — nginx's miss cascade reporting that
  Django did not answer at all. Probed directly, every proxied path (`/api/`, `/api/token/`,
  `/api/copydesk/segments/`) hung to a full timeout while everything nginx serves statically (the
  site, `/panel/`'s shell) returned 200: **the whole panel, not the copy desk**. It lasted about
  fifteen minutes and recovered on its own. The last thing the worker answered was `copy:sync` —
  one request carrying ~1 900 rows at a one-vCPU droplet, which is the shape §6n already caught,
  and a reason to treat the ingest as the heavy half of the loop rather than the cheap one. When it
  came back, `copy:propose` found 29 EN values already accepted and posted the remaining 44 instead
  of a second proposal on every row. **The diagnosis is worth more than the incident**: HTML from
  `POST /api/token/` never means "bad credentials", it means nothing was listening — a 401 is the
  password, a 403 is a non-staff account (§6m), and a page of marketing HTML is neither.

**And one thing this stage did NOT do.** The field names took the convention the later pages settled
on (`lede`, `title1`, `p2`) instead of the `…Text` suffix that predated deriving the segment kind
from `…Html`. That is free only because the keys were being minted in the same commit; it is not a
precedent for renaming a field that already carries proposals, which re-keys it and loses them.

**What is still owed.** I–K in §6's table: the donation vault, the privacy policy, then the landing.
The vault's terms still print Polish in every locale on every page carrying the island, `dates[].venue`
on the concert pages is still the fuller Polish legal string (§6x), and the statute link's
screen-reader note still says "otwiera się w nowym oknie" where `footer.statuteAria` says "nowej
karcie" (§6y).

## §7 Traps

- **`overflow-x: hidden` on the body kills every page-level `position: sticky`.** One axis `hidden`
  and the other `visible` computes the visible axis to `auto`, so the body becomes a scroll
  container while the document scrolls on `html`, and a sticky element resolves against a scrollport
  that never moves. It is `clip` in `panel.css` now (§6p) — but the trap is the diagnosis, not the
  fix: the computed style says `sticky`, the element is in the flow, and nothing anywhere reports an
  error. Measure `getBoundingClientRect().top` after a scroll; anything but ~0 means it is not
  sticking, whatever the computed style claims.
- **A hand edit of an overlay is the one move that makes the stale machinery blind.** The desk
  computes staleness from the mirror, and only `copy:sync` moves the mirror; so editing
  `concerts.yaml` and one overlay in the same commit — which looks like the careful thing to do —
  leaves the desk holding the old Polish, marking nothing stale, and the OTHER locale silently
  wrong. It shipped: `concert.wcielenie.programLede` said `Dix regards et un bis` on a French page
  whose Polish had dropped the encore from the lede a day earlier (§6u). If you must edit an overlay
  by hand, run `copy:sync` in the same breath — the file's own header says so — and remember there
  are two of them.
- **A prop whose default is Polish is invisible when it is wrong.** `SiteFooter`'s `lang` defaults
  to `DEFAULT_LOCALE` so that un-migrated callers render byte-identical to before, which is right
  for the migration and lethal afterwards: `ConcertPage` never passed it, and ten English and French
  concert pages shipped a Polish site map for the whole of stage F with nothing failing. When a
  shared component learns `lang`, grep every caller in the same pass; the build cannot tell you.
  The other half is INSIDE the component: `SiteChrome` has taken `lang` since the chrome was
  translated and still linked a hand-written `<a href="/kolofon">Kolofon</a>` from its nave card,
  so every English and French page on the site offered the colophon in Polish (§6y). A literal that
  was correct when it was typed does not announce itself when the file around it learns a locale.
  §6z found four more of them in the same file, one of which — `href={r.href}` on the mobile Via —
  sent every concert row to the Polish page on a phone, which is the only road a phone has to a
  concert at all. **When a shared component learns `lang`, grep its own body for `href="` and for
  bare text nodes in the same pass you grep its callers.**
- **A `transition:persist` island holds the locale it was BORN with, for the life of the tab.** The
  ClientRouter keeps the island's instance across a swap, so a `lang` prop is set once and never
  again: `ScrollTopButton` is mounted by `BaseLayout` on every page of the site, and a reader who
  arrives on the Polish landing and navigates to `/en/kontakt` keeps a Polish accessible name and a
  VISIBLE Polish hint under their cursor. Nothing errors, nothing rerenders, and the prop looks
  correct in the source. Read `<html lang>` instead (`i18n/documentLocale`), which every swap
  rewrites, and re-read it on `astro:page-load`. The same rule covers a document-delegated script
  bound once per tab: it must ASK at the moment it acts, never close over a value.
- **Astro drops the whitespace between an expression and whatever stands beside it**, and a
  word-stream proof cannot see it. `{copy.link} <span>↗</span>` renders with the arrow hard against
  the link, and `{t.impressio} {impressioLabel}` renders "odbito4 września" — silently, in a page
  that builds and reads correctly everywhere else. Moving copy out of markup turns every text node
  that sat beside a tag into exactly this shape, so it is a migration trap rather than an authoring
  one. Write the space into the expression (`{" "}`, or one template literal), and read the
  normalized markup hunks: a proof that strips tags to spaces before counting words answers "did a
  word move", never "did a space".
- **A watermark is written by an act, never by a visit.** The desk's reading marks are per page
  (`CopyScopeVisit`) and only the control at the foot of a page writes one. Stamping on arrival or
  on departure looks like a convenience and is a lie the surface cannot walk back: it declares a
  213-row concert reviewed because somebody opened it to check a line, and nothing puts a page back.
  The single `copy_desk_seen_at` did exactly this for the whole corpus.
- **`CopySegment.updated_at` means "this text moved", and only the ingest can break that.**
  `upsert_segments` compares before it saves for this reason; an unconditional `update_or_create`
  makes the column mean "when the extractor last ran" and tells every reader the whole corpus
  changed after any `copy:sync` at all.
- **Every editor who is `is_staff` is a REVIEWER.** `user_is_copy_reviewer` tests staff and nothing
  else, and `copy_desk_reviewers` mails the digest to every active staff account. So an editor who
  was made staff for some unrelated admin errand can accept their own proposals and receives the
  reviewer's digest — the two-iteration rule quietly loses its second iteration, and nothing on
  screen says so. Grant `can_edit_site_copy` and leave staff alone; if an editor genuinely needs the
  Django admin, the reviewer test has to move to a narrower predicate before they get it.
- **A whitelist that is not a superset of the corpus destroys the corpus, one edit at a time.**
  `sanitize_for_kind` rebuilds every submitted value from `<em> <strong> <a href>` on both write
  paths — the editor's autosave and the reviewer's rewrite — which is the right guard and is the
  same failure mode as the annotation payload sanitizer: a serializer that rebuilds its payload
  silently drops whatever is not on the list. The trap is which direction that cuts. An editor's
  first proposal on an `html` field is that field's own markup with one word changed, so a
  construction the site authored and the list does not know is stripped on the way in, and what the
  editor sees is their sentence accepted with the link gone. Before adding a tag OR AN ATTRIBUTE to
  a content file, add it to `ALLOWED_TAGS` / `ALLOWED_ATTRIBUTES`; the test that asserts the page
  corpus's own shapes survive untouched — and survive a second pass over the first pass's output —
  is what says the two still agree, and it is a hand-written list that a new page has to extend in
  its own commit. The attribute half is not hypothetical: `<em lang="fr">` reached both overlays
  stripped before anyone read the patch (§6w).
  The original wording of this trap named `contenteditable`, and this desk has none (§6t): the
  editor is a plain textarea, an `HTML` field is edited as its own source, and nothing renders a
  segment as markup. `text` segments have no markup path at all in either reading.
- **A module the extractor imports may not reach for the bundler.** `i18n/content/copySpec.ts` and
  each page's `i18n/content/<page>.ts` are imported by Node directly — type-stripping, no build step
  — so that the key a translation is stored under is the same expression as the key the page looks
  up. One `?raw`, one `astro:assets`, one `import.meta.glob` anywhere in that import graph and the
  extractor stops resolving, with an error that names a module three hops away from the one that
  broke. The Vite-only half lives in `lib/pageCopy.ts` and imports the pure half, never the reverse.
- **Do not let editors type French punctuation spacing.** `lib/typo.ts` inserts the narrow no-break
  spaces before `? ! : ;` and pins orphans at build time. Hand-typed hard spaces double up. Say so
  on the desk, in French, in one sentence.
- **Source drift is silent without the hash.** §4 exists for this. A translation whose Polish moved
  looks perfectly fine on screen.
- **`TRANSLATED_ROUTES` is a manual ordering contract — except where the route reads it.**
  `i18n/config.ts` states it: add the path only *after* both route files exist, or every localized
  link starts pointing at a 404. The concert pages are exempt because
  `src/pages/{en,fr}/koncerty/[id].astro` filter their own `getStaticPaths` through the set (§6o),
  so page and links appear together; every hand-written page still owes the contract. Flip one
  concert at a time regardless — a concert enters when its translation is reviewed, not when the
  section is. And the set is not a register of translated documents: it lights LINKS, a language
  switcher and an hreflang graph, so a page nothing links to belongs OUTSIDE it however many
  locales it exists in. `/404` is the first (§6z) — three documents, no entry, and its component
  composes its own canonical from `lang`.
- **A `LocalizedText` from `concerts.yaml` carries `pl` and nothing else.** Since stage C3 the
  corpus is Polish-only and translations live in the overlay, so `pickLocale` on a concert field
  returns Polish in EVERY locale — silently, on a page that looks translated. This is what stage F
  found across the whole concert page (§6o). Read a concert's copy through `lib/copyOverlay`;
  `pickLocale` is for maps that genuinely hold their own locales.
- **An error page is served by nginx, not by the router, so translating it is half a code change.**
  The build emits `/404.html`, `/en/404.html` and `/fr/404.html` and every one of them is dead
  weight while `error_page 404 /404.html` names a single file — the routes exist, the pages are
  correct, and a French reader still meets the Polish leaf. It is `$marketing_404` (a `map` in
  `infra/nginx/nginx.conf`, used by both `prod.conf` and `local.conf`) now. `map` is http-only,
  which is why a rule about the public site's error page lives in the core config rather than
  beside the server block that uses it.
- **A route tree outside `/panel` has to be declared twice, and neither place is the router.** The
  desk lives at `/redakcja/*`, which nginx (`infra/nginx/{prod,local}.conf`) and the service
  worker's navigation allowlist (`frontend/src/sw.ts`) each have to know, mirroring one another. It
  was in neither, so navigating inside the app worked and a RELOAD 404'd into the marketing site —
  on the one surface reached mainly by link, where a cold load is the normal way in. Missing from
  nginx, a reload 404s; missing from the worker, the same load fails only offline.
- **Astro scoped styles do not reach injected DOM**, and delegated clicks must capture, not bubble,
  because of the ClientRouter. Both are recorded project traps and both apply to any preview the
  desk renders using site markup.
- **AN `HTML` COPY FIELD IS INJECTED DOM, which is the same trap wearing the desk's clothes.** Astro
  scopes a rule by appending its cid attribute to EVERY compound, so `.hero h1 em` ships as
  `h1[data-astro-cid-…] em[data-astro-cid-…]` — and the `<em>` inside a `set:html` field has no cid,
  because the page handed the browser a string. The rule matches nothing, in silence, and the text
  renders perfectly in the wrong colour or weight. It shipped three times: `/kontakt`'s title lost
  its candle gold for the whole of G1–G4, so did the `<em>` in its channels intro, so did the
  underline on both of its prose links, and `/o-nas`'s nine `<strong>` have been at the browser's
  default weight since before the desk existed (§6v). Any rule reaching INTO a `…Html` field needs
  `:global(…)` on the injected compound — and the check is the emitted CSS, not the source: grep
  `dist/_astro/*.css` for the bare descendant. The build cannot tell you, and neither can the page.
- **Alt text is translatable copy.** `gallery[].alt` is 621 words. It is not decoration; leaving it
  Polish on the English page is an accessibility regression, not a cosmetic one.
- **A key named `pl` under a foreign original is the `*Pl` trap wearing a different hat.** The
  suffix was the visible half; `movements[].pl` and `interlude.pl` were the same ambiguity written
  as a nested key, and a grep for `Pl:` would not have found either. Both are `gloss` now. When a
  new field appears beside a `lat`/`text`/`inscriptio`, ask which of §5's two meanings its name
  carries before writing it. It reappeared OUTSIDE the corpus in §6z: `Tempus.pl` in
  `lib/tempusLiturgicus` sat under a Latin season name, read perfectly as "the Polish of this
  Latin", and printed "okres zwykły" into the footer of every English and French page on the site.
  The name is what hid it — nobody greps a field called `pl` for a missing translation. Anywhere a
  vernacular tier stands under a Latin one, the field is `gloss` and its type is
  `Record<Locale, string>`.
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
