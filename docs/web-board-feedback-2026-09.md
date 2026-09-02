# Public site — board feedback remediation (2026-09)

Record of the board's September review of `web/` (Ania: legibility, length, press; the founder:
no objection), the analysis that turned nine requests into five stages, and the spec for the
stage being built now.

## How to read this file

- **§1 Roadmap** — the five stages, what blocks each, and what was rejected. Read this to know
  what to do next.
- **§2 Etap 1** — the full spec for the stage in progress (legibility + the concert page's front
  matter). Read this to build it.
- **§3 Findings that outlive the stage** — measurements and rules that the next passes need.

Companion to `.ai/07_marketing_public_site.md` (rules) and `docs/web-landing-guardrails.md`
(the negative space). Nothing here overrides those two.

---

## §1 Roadmap

### The board's nine requests, and what they actually were

Three of Ania's four complaints are **one defect**, and that is the finding that shaped the whole
plan. She named "Skąd się wzięliśmy?" as a heading she cannot see. It is not a heading — it is a
`.micro` rubric label ([EnsembleSection.astro:84](../web/src/components/landing/EnsembleSection.astro#L84)),
and the `<h2>` beside it is set at `clamp(46px, 6vw, 96px)`. So she is not failing to see headings.
She is reading the **labels** as the headings, correctly — a label is the thing that says what a
section is about — and the labels are 10.5–11px Cinzel at weight 400.

That reframes the two complaints next to it:

- **"Za dużo tekstu."** The word count is not the problem and no text is being cut. A concert page
  runs eight bands whose section heads are all set in that same illegible atom, so the page reads
  as an undifferentiated wall. Length feels infinite when you cannot scan.
- **"Galeria i nazwiska na początek."** She is not asking for a reordering, she is reporting that
  nobody reaches them. The page already has an index (the tabula) — see below.

So Etap 1 treats the atom, and three complaints close without moving a word or a section.

### Stages

| # | Stage | Blocked by | Status |
|---|---|---|---|
| 1 | **Legibility + concert front matter** | nothing | *done* |
| 2a | **Copy desk** — editorial surface + concerts in three locales | nothing | *next* |
| 2b | **Concert notification list** ("newsletter") | RODO documents | ordered |
| 3 | **Press pack + `/press` recut** | assets from the ensemble (rider, photo selection) | ordered |
| 4 | **Liturgies & weddings subpage** | board decision on framing + legal form of the activity | ordered |
| 5 | **Q&A and testimonials** | consent path for publishing third-party statements | later |

**Etap 2 was split and changed shape.** Its spec is now
[docs/web-copy-desk-2026-09.md](web-copy-desk-2026-09.md) and that file overrides the paragraphs
below wherever they disagree. Three changes:

- **2a and 2b are separated.** The notification list is blocked by RODO documents; leaving it
  bundled would have put that blocker in front of Flo's clock, which is the opposite of why this
  stage is second.
- **It is not a read-only review surface.** Flo edits the **Polish** too — the concert copy is what
  he most wants to work on — so the surface is writable and permanent, and lives in the panel rather
  than as a noindex Astro route.
- **Concert detail pages are in scope after all, and go first.** The exclusion below was about
  translation *value*; it does not survive the fact that their Polish is the text he is most needed
  on, and they are the cheapest surface to make editable (`concerts.yaml` is already data). They are
  now translated as well: measured at ~8 700 translatable words per locale, not the 15.9k quoted
  below, which counted YAML syntax.

**Ordering note.** Etap 2a goes second not because translation is urgent but because **Flo is the
long pole** — he approves all locales at once, so his clock has to start before stages 3 and 4 run.
Build the desk, hand it over, then work on 3 and 4 while it sits with him.

### Stage detail

**Etap 2a — the copy desk.** Superseded by [its own spec](web-copy-desk-2026-09.md); the paragraph
kept here only records what the original reasoning was and where it broke. It read: the corpus is
~15.9k words in `concerts.yaml` alone, so concert detail pages are not translated — they are the
deepest Polish on the site and the least useful to a foreign visitor, who needs
who/what/how-to-book; translate `/kontakt`, `/koncerty` at index level and `/press`, with `/o-nas`
as the reference pattern ([i18n/content/o-nas.ts](../web/src/i18n/content/o-nas.ts) +
`TRANSLATED_ROUTES` as the lazy switch). And the review surface was to be a **read-only noindex
route** rendering PL | EN | FR side by side.

Both halves were wrong for the same reason: the plan assumed Flo's job was *checking translations of
finished Polish*. It is not — he is the editor of the Polish, and the concert pages are where that
matters most. `/o-nas` is still the reference pattern for content modules, and `/press` is still
excluded until Etap 3 recuts it.

**Etap 2b — the notification list.** Not a newsletter — a **concert notification list**, one mail per
evening, which is what the board actually wanted and the only version that survives the site's own
no-fabrication and *kairos not chronos* rules. Placement: at the register's foot or the Coda, where
a reader who has just learned there is no sixth date has an unmet need. What it needs is documents,
not a board vote:

- `docs/legal/klauzula-informacyjna.md` — add the purpose (verified absent).
- `docs/legal/rodo-ropa.md` — add the processing activity (verified absent; the file currently
  carries donations and `PatronLead` only).
- Basis: consent, art. 6(1)(a) RODO + art. 10 UŚUDE. Double opt-in is the proof.
- **Persist the consent evidence.** `PatronLead` validates `consent` and never stores it — fine for
  a donation, which leaves a transaction as evidence. A notification list leaves no other trace, so
  it must store the confirmation timestamp and the clause version. This is a deliberate divergence
  from the existing pattern, not an oversight to copy.
- **No third-party embed.** `.ai/07` forbids external requests outright: the form posts to our own
  backend. Sending can use anything afterwards.

**Etap 3 — press.** The reframing that settles the board's disagreement: **`/press` is not a
persuasion surface, it is an execution surface.** Nobody commits a fee off a press kit; they decide
from a recommendation, a hearing, or the main site. The page's real reader is the person who has
already said yes and now has to produce a poster, a programme book and a press release on a
deadline — often not the person who booked. If they cannot get a bio and a photo in a minute they
write their own text, and it is wrong.

So persuasion moves out (hero video, the three vignettes, the concert archive as prose — all of it
exists better on `/o-nas` and `/koncerty`) and what stays is: biogram in three lengths with
copy-to-clipboard, the downloadable pack, the technical and legal facts, one contact line.
~897 lines → ~300. The page is `noindex`, so its only traffic is a link we send: send it in the
*second* mail, after the yes.

The pack (`voctensemble-press-YYYY-MM.zip`, ≤50 MB): biogram at ~300 / ~1000 / ~2000 characters;
3–5 photos at 300 dpi **in both landscape and portrait** (the missing portrait is the single most
common reason a programmer writes back) with a `credits.txt`; logo as SVG + PNG on light and dark
with one line of usage rules; a one-page technical rider; invoicing details; one or two sample
programmes with durations; a text file of links to recordings. No video files, no photo archive,
no designed PDFs.

**Only the rider must come from the ensemble.** Everything else already exists. It has the longest
lead time — order it first.

**Etap 4 — liturgies and weddings.** The highest commercial value on the list and the only page
that genuinely needs SEO (the rest of the site is a patron/grant instrument). The data already
supports it: `variant: liturgy` is in the schema, Bobola is a real entry with a broadcast and a
photo report, and `/press` already carries a `#liturgie` section, so some copy exists.

Two constraints. **Not a services page with a price list** — that would devalue the rest of the
site. It is a page about what the music is when it serves a rite rather than a concert, with Bobola
as the exemplar and a wedding as one case. And it is a **board question before it is a design
question**: a foundation advertising paid services raises the odpłatna działalność pożytku
publicznego vs. działalność gospodarcza distinction. Ask before building.

**Etap 5 — Q&A and testimonials.** Both need a consent path for publishing other people's words,
which is a larger duty than collecting an address. Testimonials are 90% collection and editing, not
build: do not create `/testimony` before five real statements exist.

### Rejected, with reasons

- **A humorous / South Park-register Q&A.** The goal (make the ensemble approachable) is legitimate;
  the vehicle changes the site's genre. A page written in jokes on a site whose direction is radical
  subtraction reads as a different website pasted in. The approachability belongs to the singers'
  own voices answering real questions plainly.
- **Reordering the concert pages** (gallery and names to the top). It breaks a composed arc and
  contradicts the site's own rule that the rite does not market itself by face. The access problem
  it names is real and is solved by the front matter in §2 instead.
- **Cutting text on the concert pages.** Depth is the point of those pages; the complaint was
  legibility.
- **A sticky in-page index.** The page already has one — see §2.
- **The looping-phrase video grid.** Deferred until masters exist, and when they do it needs a
  design pass, not just implementation: autoplaying sound is forbidden by the creative direction,
  and a wall of moving thumbnails is the grid that `docs/web-imagines-spec.md` §2 rejected. Flagged
  now so it is not promised as a small feature.

---

## §2 Etap 1 — spec

Two changes. Neither cuts a word, moves a section, or spends permanent chrome.

### 2.1 The rubric atom is illegible, and the fix already exists in this codebase

`.micro` / `.eyebrow` / `.kd-section-label` are one family — base.css already treats them as one in
its two `:is(…)` rules — doing **three different jobs** at one size:

1. **naming a band** (`.kd-section-label` ×8 on a concert page, `.kol-section-label` ×8, the
   landing's section labels) — this is the job Ania named;
2. **labelling data** (`.kd-voces-voice`, `.kd-program-num`, `.tabula-meta`, the vault's form
   labels);
3. **incidental inscriptions** (`.kol-close`, the kickers, the footer colophon).

Measured state:

| atom | size | weight | tracking |
|---|---|---|---|
| `.eyebrow` (base.css) | 11px | **500** | 0.2em |
| `.micro` (landing, vault) | 11px | **unset → 400** | 0.24em |
| `.kd-section-label` | **10.5px** | **400** | 0.26em |
| `.lat` tier (base.css) | inherits | 500 | 0.12em |

`.eyebrow` was already lifted to 500 with a written rationale — *"inscriptional capitals at 11px
need the extra stroke to hold on the dark ground"* — and **the fix was never propagated to its two
siblings.** That is the defect: not a taste call, an unfinished pass.

The remedy is the one this site has already field-tested on the same material. Guardrails, on the
litany plate: *"What actually fails at this size is the letterform… the fix is the axis and the
size."* The values it landed on are still in
[15-litany.css:171](../web/src/styles/landing/15-litany.css#L171) — `clamp(13px, 1.15vw, 15px)` at
**weight 600**. Cinzel is a variable face (`font-weight: 400 900`), so the axis is free; base.css's
own hard constraint caps it at ~16px, which leaves exactly the room needed.

**Contrast, measured (not assumed).** These were computed, and they change what the fix has to be:

| pairing | ratio |
|---|---|
| `--ink-muted` on `--paper` | **4.53 : 1** |
| landing `.micro` — paper at 50% over the scrimmed nave | **4.43 – 4.89 : 1** |
| `--ink-soft` on `--paper` | 11.60 : 1 |

Everything sits within a whisker of the 4.5 line and dips under it wherever the photograph is
lighter. So contrast is a real but *secondary* fault: the dominant one is stroke, exactly as the
litany finding predicts. Raising the landing label's alpha to **0.62** lands 5.97–6.95 across every
plausible ground, without taking it to full paper where it would compete with the `<h2>` beside it.

#### The change

**(a) Stroke — universal, zero layout risk.** Weight → 600 on `.eyebrow`, both `.micro`
declarations, `.kd-section-label`, **and the `.lat` tier**. The Latin tier is the one that would
break silently: it sets 500 explicitly, so lifting only the parents would leave the Latin word
*lighter* than the gloss reading it — the two-tier rubric inverted.

**(b) Size — the section-naming role only.** A new atom, `.titulus`, defined once in base.css
(the file that already declares itself the single home for the rubric family), composing with
`.micro`/`.eyebrow`: **12.5px**, tracking relaxed to 0.18em.

Tracking comes *down* as size and weight go up. base.css already records why — *"0.3em pulled the
words apart into separate letters"* — and that pressure grows with weight.

`--micro` is **not** bumped. It is declared in two files
([01-foundation.css:39](../web/src/styles/landing/01-foundation.css#L39),
[vault.css:36](../web/src/styles/vault.css#L36)) and read by jobs 2 and 3, where the labels are not
the complaint and the layouts are tight (vault form rows, `tabula-meta`). Resizing the token would
be a site-wide layout change to fix a problem that lives in one of its three roles.

**(d) The rubric gloss moves from IBM Plex Mono to IBM Plex Sans.** Raised by the developer mid-pass
— *"does mono actually fit there, isn't it a bit terminal-ish?"* — and the answer is yes, for the
rubric gloss and nowhere else.

What the gloss must do is stated in base.css: stay a *quiet translation* that does not compete with
the Latin stone, the contrast carried by **face + case + colour**. Cinzel cannot take it — it has no
lowercase and maps it to small capitals, which would put both tiers in caps and spend the case
contrast. So the question was never Cinzel-or-mono, it was *which lowercase face*, and mono is the
wrong one on this site's own stated grounds: base.css's font comment already rejects the typewriter
register for rubrics (*"Cinzel replaces IBM Plex Mono there, whose typewriter register said
'terminal' about text that is epigraphic"*), and a gloss is the same epigraphic object as its Latin,
merely spoken aloud. That judgment had simply never been carried through to the second tier.

**Mono keeps the job it is actually for and must not be swept out of it:** strings a reader copies or
verifies character by character — IBAN, NIP, KRS, amounts, e-mail addresses, and the whole vault
(28 of the ~95 `var(--mono)` uses). That is a *ledger*, not a terminal, and mono is correct there.

Two further mono roles were surveyed and left alone as a separate decision, not part of this pass:
small metadata captions (`.imagines-name`, `.path-entry-place`, `.litany-readout`,
`.dateline-tempus`) and incidental UI (`.skip-link`, `.nave-close`, `.secondary-link`).

**(c) Ink floor.** `.ensemble-copy .micro` and `.final-contact .micro`: `rgba(244,241,233,.5)` →
`.62`. This is the label's *resting colour* and is unrelated to `--half-ink` (0.44), which is the
reveal register's entrance floor — do not conflate them.

### 2.2 The concert page's front matter

**The page already has an index.** It is the *tabula* — rendered by `SiteChrome` from the array the
page passes ([`[id].astro`:164–197](../web/src/pages/koncerty/[id].astro#L164)), carrying all eight
bands including Głosy and Obrazy. So "add an index" is the wrong instruction; the object exists and
is well made.

What it does not do is serve a **first** reading. [tabula.css](../web/src/styles/tabula.css) states
the weakness itself: *"the register is summoned by a POINTER, an act that is unambiguously a
request, and this by a scroll gesture the reader may not have meant as one."* The threshold is 180px
of deliberate backward scroll on desktop and **340px on touch**
([SiteChrome.astro:754](../web/src/components/SiteChrome.astro#L754)). A reader going down the page
for the first time never makes that gesture. The tabula serves *return*; nothing serves *arrival*.

So: **the page prints its own contents once, at the threshold, as front matter** — not as chrome,
not sticky, read once and left behind. A book's table of contents is at the front, and *tabula* is
literally the board a monastic house hung so the community could read what the week held.

- **Placement:** its own band between the hero and `#prolog`. The hero's last line is
  `Wejdź w wieczór`; the leaflet handed at the door belongs immediately after it.
- **Ground:** `--night`, continuing the dark opening stretch that `.kd-prologue` already holds.
- **Source:** the **same `tabula[]` array**, rendered a second time. No second list, no second
  vocabulary — the array is already guarded by the same `when` expressions as the bands, so a row
  can never point at a band this concert did not render.
- **Grammar:** the tabula's own — numeral, name, hairline leader, Latin figure at the right hand.
- **Rows are links** to the same anchors, so the gallery and the roster are reachable in one tap
  from the top of the page. That is Ania's complaint answered without moving either section.

The band names the two things she said were unreachable, on the first screen after the hero, and
the bar's tabula goes on doing what it does well.

### 2.3 Four traps this pass hit, all silent

Each of these looked correct in source and would have shipped wrong.

- **IBM Plex Mono ships here as two static masters, 300 and 400** (`public/fonts`), not a variable
  file. Cinzel is variable (400–900), so the weight fix is free on the Latin voice — but inheriting
  600 onto a mono gloss makes the browser synthesize a fake bold, which at 10–12px on a monospace
  smears. This is one of the reasons the gloss moved to Plex Sans (variable, 100–700).
- **`.titulus` must be written as a compound.** base.css ships in the shared bundle and the landing
  sheet loads *after* it, so a bare `.titulus` and `.micro { font-size: var(--micro) }` tie at
  (0,1,0) and the landing wins on order — the atom would have silently done nothing on the one page
  that prompted the whole pass. Written as `:is(.micro, .eyebrow, …).titulus` it is (0,2,0) and
  order-independent.
- **`.kd-section-label` was already overriding base.css's two-tier rule, invisibly.** The page rule
  is emitted as `.kd-section-label[data-astro-cid-…]` at (0,2,0), the base rule `:is(…):has(.lat)`
  is also (0,2,0), and the page bundle links last — so it wins, and its `font-family: var(--capitalis)`
  means concert pages have been running *both* tiers in Cinzel caps, separated on tracking and colour
  alone. Left as it is (it looks right and nobody has complained), but recorded: it means the concert
  pages are unaffected by the mono→sans change, and it is why weight 600 is safe on that rule.
- **`.reveal-rule` needs the host element to blank its own border and declare `--rule-ink`.** The
  register cannot know which side or which ink a hairline uses. A new night-band list has to join
  the group at the foot of `[id].astro` or it draws nothing.

### 2.4 Verification

`npm run check` — 0 errors, 0 warnings. `npm run build` — 15 pages, clean; the register audit reports
1010 nodes with one pre-existing note (photograph luminance, unrelated). The front matter renders
4–7 rows per concert. The developer reviews the rendering.

---

## §3 Findings that outlive this stage

- **The rubric family is one atom doing three jobs**, and it had no way to say which. `.titulus`
  names the largest of them. When a fourth label appears, decide which job it is before styling it.
- **Cinzel's floor on this site is ~12.5px at weight 600.** Below that the hairlines of a
  Trajan-lineage face fall under a device pixel. The ceiling is ~16px (base.css). That is the whole
  usable band, and it is narrow on purpose.
- **Before darkening a ground under type, measure it** (guardrails). Applied here in reverse: the
  measurements said contrast was near-compliant and the fault was stroke, which is why this pass is
  a weight change and not a colour change.
- **An atom fixed in one place must be swept across its family.** `.eyebrow` carried the right
  weight and the right reason for months while its two siblings did not, and nothing in the
  toolchain notices. base.css's `:is(…)` lists are the family roster — when one member changes,
  check the roster.
- **A gesture-summoned surface serves return, never arrival.** The tabula is correct and was still
  invisible to a first-time reader. Anything discovered by a gesture needs a second, stated home for
  the reader who does not yet know to ask.
- **Mono is a ledger face here, not a texture.** The test for any future `var(--mono)` is whether
  the reader will *copy or verify the string character by character*. IBAN, NIP, KRS, amounts,
  addresses: yes. Prose, glosses, captions: no.
- **A page-scoped rule ties with a base `:is(…):has(…)` rule and wins on bundle order.** Guardrails
  already record this going one way (page rules beating the register); `.kd-section-label` is the
  case going the other — a page quietly opting out of a site-wide typographic system with no error
  and no visible breakage. When base.css claims to own a shape, grep the pages for a rule of equal
  specificity before believing the claim.
