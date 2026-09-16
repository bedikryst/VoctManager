# Colophon remediation (`web/`) — the plan across sessions

Working plan for `/kolofon` (`web/src/pages/kolofon.astro`), started 2026-08-01 from a full audit
of the page — copy, registers, cascade, accessibility, data.

Companion to `docs/web-landing-guardrails.md` (doctrine, and the negative space) and
`docs/web-reveal-remediation.md` (the register machinery and its measured budgets). This file is
neither: it is one page's work, in dependency order.

**How to read this file.** Every stage carries the measurement that made it decidable, so a later
session can check the claim rather than trust it. Stages marked DONE keep their reasoning because
the open stages stand on it. `Rejected` and `Traps` are load-bearing — they record what looks
right and is not.

**Read this before implementing anything below.** `web-reveal-remediation.md` opens with a method
note earned seven times: *the plan reasons about what things are called, and the code is decided
by what things are gated on.* Every stage of that file found its own diagnosis wrong once the code
was measured. Assume the same of this file. Concretely, before starting a stage:

1. **Re-measure its claim against the source**, and where the claim is about the cascade, against
   the emitted CSS in `dist/_astro/`, not the `.astro` file. Six of this audit's findings are
   invisible in source.
2. **Check the slot, not the property.** Before adding a register class to an element, check
   whether that element already declares `transition` (a register REPLACES it) and whether a
   page-local rule already sets the property the register drives (a scoped Astro rule is emitted
   at +1 per compound and silently outranks the register).
3. **Push back.** If a stage below is wrong, say so and fix the plan rather than implementing it
   faithfully. Three of this plan's stages reverse a decision an earlier pass recorded, and each
   one says so; there is no presumption that what is written here survives contact with the code.

**State: all eight stages shipped 2026-08-01 (A, B, E, F, G, H first; C and D in a second pass
the same day).** Verification, both passes: `npm run build` green, `npx astro check` 0 errors, the
emitted CSS re-measured for every cascade claim, and the orphan sweep over `dist/kolofon.html`
clean (matching an ordinary space, not `\s`, per the guardrails' Python gotcha). Em-dashes inside
`<main>`: 5 → 1. What remains is in **Open**, and none of it is a defect on this page.

**Two later passes shipped 2026-08-15.** The first: three changes on the page (the lede's last
sentence, a frame tally in `Imagines`, a `Wideo` row), `dateModified` off the graph, and five of
this page's own decisions applied to the surfaces that share its content — it also supersedes the
author-address item in **Open**. The second (`15b`): `Imagines` became the page's only interactive
rubric, each name opening its own frames through a new authored-set form of the
`[data-image-open]` contract. Both are below, in order.

---

## The page, and what it is for

A colophon is the closing inscription: **who, where, when, with what types, with whose help, and
to whom the praise.** The page had five of those six and the sixth (the *types*, `Typi`) is its
best-designed block, because it does not describe the typefaces — hovering a row makes the face
demonstrate its own axis. **That is the page's governing idea and every stage below is an
application of it: a colophon shows its craft, it does not explain it.**

The temptation this page has to survive is the opposite move — a paragraph about the site's
"guiding thought" (the drawing parchment, the rite, the three registers). That is the deleted
ImageRite paragraph one level up: explaining your own metaphor, on the one page where a reader
would forgive it, which is exactly why it would be worst here. **Considered and rejected as
prose; adopted as a specimen** — see Etap E.

---

## What was measured (2026-08-01)

Evidence for the stages. All from source + `dist/` at commit `28d44f1`.

| # | finding | how it was measured |
|---|---|---|
| 1 | `kolofon.astro:186` says "Wszystkie **trzy**" over a list of **four** faces | count the `<li>`; the fourth arrived in `cbb9318` |
| 2 | base.css's two-voice rubric is **dead** on this page | `dist/kolofon.html` link order `base` → `kolofon`; both rules at (0,2,0); later wins |
| 3 | `.kol-dot` is `rgba(244,241,233,.42)` — **invisible on parchment** | emitted `.kol-dot[data-astro-cid-hcsdgg4r]{color:#f4f1e96b}`, page-global, 5 paper bands |
| 4 | `specimen.html` ships with **4 Google Fonts CDN requests** | `grep -c 'fonts.googleapis\|fonts.gstatic' dist/specimen.html` |
| 5 | registry numbers set in `--serif`, against `tokens.css:32` and against `/o-nas` | `AboutPage.astro:532` sets `.legal-grid .v { font-family: var(--mono) }` |
| 6 | the **lead register is used nowhere outside the landing** | `grep -rn reveal-rule src/` → 8 hits, all `components/landing/` |
| 7 | the page carries **~29 hairlines the layout already owns** | 15 `.kol-def` + 4 `.kol-font` + 6 `.kol-collab li` + 4 `.kol-band-rule-top::before` |
| 8 | four `<li>` in the tab order with no action | `tabindex="0"` on `.kol-font`, `cursor: default`, no role, no handler |
| 9 | the `Typi` specimens are **invisible on touch** | the whole demo is `:hover` / `:focus-visible` |
| 10 | 5 em-dashes and 3 negation clusters in ~12 short paragraphs | counted in markup with comments stripped |
| 11 | **no photographer is credited anywhere on the site** | `grep -rn "fot\.\|fotograf"` over `src/pages`, `src/components` |
| 12 | `--dark` reaches this page only through `vault.css`'s shim | `vault.css:21` `:root { --dark: #080807 }`, marked "re-declared for pages that don't load the landing foundation layer" |
| 13 | four running-text roles were wearing `.micro`, the rubric LABEL utility | `vault.css:34` `.micro { font-family: var(--capitalis); letter-spacing: .24em; text-transform: uppercase }`, unscoped, (0,1,0), and no page rule set a face on those four |

Added in the second pass (Etapy C and D), same date:

| # | finding | how it was measured |
|---|---|---|
| 14 | the page's registers arrive via **`VaultIsland.css`**, linked first | `dist/kolofon.html` links exactly three sheets — `VaultIsland` → `vault` → `kolofon`; `grep 'voct-motion .reveal'` hits only the first. The page bundle is last, which is what makes Trap 1 bite |
| 15 | **`.reveal-cue` has no CSS anywhere on the site** | `grep -l reveal-cue dist/_astro/*.css` → `index.*.css` only (landing-authored choreography). It is a controller selector (`reveal.ts:19`) and nothing else, so a page adopting it authors the whole gesture |
| 16 | a cue really is exempt from the 3400ms ceiling | `settle()`'s first statement returns on `.reveal-cue`, before the listener and before the fallback timer are attached. **Cited as `reveal.ts:85` in the plan; it is line 113 as of the tail-observer work** — grep for the string, the line number has already moved once |
| 17 | `pathLength` on basic shapes already ships | `AetherInterlude.astro:135-136`, two `<circle class="knot-draw" pathLength="1">` vesica halves, drawn by `stroke-dashoffset` on the landing |

---

## Etap A — the measured defects — DONE 2026-08-01

Six independent fixes, none of which needs a decision. Ordered by blast radius.

### A1. The miscount

`kolofon.astro` — "Wszystkie trzy" → four faces. Trivial, listed first because on a page whose
only promise is accuracy about craft, a miscount is the one error that costs the whole page.

### A2. Put the rubrics back on the site's rubric contract

`base.css:228` declares the two-voice rubric and **names `.kol-eyebrow` and `.kol-section-label`
in its selector list**: `.lat` = capitalis, caps, candle, tracked ("the stone"); the rest = mono,
lowercase, muted ("the gloss reading it aloud"). Canonical instance:
`landing/06-footer.css:222` (`.latin` / `.pl`).

Measured in `dist/`: both the base rule (`:is(…):has(.lat)`) and the page's scoped rule
(`.kol-section-label[data-astro-cid-…]`) land at **(0,2,0)**, and `base.css` is linked *before*
the page bundle — so the page wins the tie and `font-family: var(--mono)` /
`text-transform: lowercase` never apply. Both halves render as gold Cinzel caps, and `.lat` —
whose job is to *introduce* caps and gold — contributes only a **narrower tracking** (0.12em
against the host's 0.26em), i.e. the Latin word ends up tighter than the Polish one. The device is
inverted, not merely absent.

The comment above that rule warns "Page rules may no longer set `.lat`". It guarded the `.lat`
tier and not the host — the same *checked the property, not the slot* failure the reveal plan
names seven times.

Fix: the two page rules stop setting `font-family` / `text-transform` and hand the tiers back.
The host keeps the geometry (`display`, `gap`, `font-size`, `margin`) and supplies what base.css
does not: `letter-spacing: .1em` (the gloss tier's tracking, per `06-footer.css:233`) and a muted
colour. `--ink-muted` on parchment; the seal band is dark, so `.kol-band-deep .kol-section-label`
takes a paper-muted alpha, and `.kol-eyebrow` already had the right dark-ground colour.

**`.kd-section-label` on `/koncerty/[id]` has the identical override** (`_id_.B2jlhbG9.css`,
same tie, same result). Out of scope here — recorded so it is not rediscovered as a colophon bug.
Six of the rule's ten hosts are overridden site-wide.

### A3. The invisible separator

`.kol-dot` was declared once, page-global, with the dark hero's alpha, so the `·` between the
Latin and Polish halves disappears on all five parchment bands. Fixed by making it ground-agnostic
(`currentColor` at reduced opacity) rather than by adding a second colour per band.

### A4. Delete `specimen.astro`

The file documents its own removal: *"DWA POWODY, DLA KTÓRYCH TA STRONA MUSI ZNIKNĄĆ PO DECYZJI"*
— it pulls candidate faces from the Google Fonts CDN, breaking `.ai/07`'s **no third-party
requests at all**, and *"zbudowany serwis i tak wyemituje `specimen.html`"* despite `noindex` and
the sitemap exclusion. The decision it existed to serve has been made (Cinzel and IBM Plex Sans
both ship from `public/fonts/`). `noindex` does not stop a transfer to a third party under RODO;
deleting the file does.

Its `customPages` / sitemap-filter entry in `astro.config.mjs` goes with it.

### A5. Registry numbers to `--mono`

`tokens.css:32` assigns `--mono` to *"data whose alignment carries meaning: live numerals,
coordinates, **registry numbers**"*. `/o-nas` obeys it; the colophon set KRS / NIP / REGON in
`--serif`, so the same datum rendered two ways on two pages. Scoped to the identifier rows — the
prose `dd`s (Siedziba, Zarząd, Statut, Polityka) stay serif, because they are copy and not data.

### A6. The small ones

- `tabindex="0"` removed from the four `.kol-font` rows — non-interactive elements in the tab
  order are stops that do nothing (WCAG 2.4.3). The `:focus-visible` outline and the
  `:focus-visible` branches of the four specimen rules went with it: nothing can focus a plain
  `<li>`, so they were dead selectors once the attribute was gone. Keyboard access to the specimen
  is restored by Etap D, which fires it on arrival for everyone including touch. **Etap D
  therefore must not be skipped without restoring focus access here** — between these two stages
  the specimen is mouse-only, which is a narrower regression than the four dead tab stops but is
  still a regression.
- `font-style` dropped from `.kol-font-sample`'s transition list — no rule changes `font-style` on
  hover, and between `normal` and `italic` it is a discrete property anyway.
- `.kol-def` takes `grid-template-columns: subgrid` against columns declared on `.kol-defs`, so the
  `dt` / `dd` columns line up instead of each row sizing its own label. This needs **four** parent
  tracks (`max-content 1fr max-content 1fr`) with each row spanning two — a `.kol-def` occupies one
  column of a two-track parent, so it has nothing to subgrid there. Behind
  `@supports (grid-template-columns: subgrid)`, with the pre-subgrid two-track layout as the base,
  and the mobile override repeated inside a second `@supports` because the single-column fallback
  and the subgrid path want different values.

### A7. The gloss voice, one level down from A2

Not in the original audit brief; found while wiring A2 and folded in because it is the **same
defect at a smaller scale** — four roles set in the stone voice that were written for the gloss.

`.micro` (`vault.css:34`, reaching this page because the colophon imports the vault partial) is the
rubric LABEL utility: capitalis, 11px, 0.24em, UPPERCASE. It was on four roles that are running
text — the seal caption, the four typeface credit lines, the licence sentence, and the six
collaborator functions — none of which declared a face of their own, so all four rendered as
tracked all-caps Cinzel.

**The evidence is in the strings, not in taste.** Every one of them is written in sentence case
with Polish diacritics and commas ("Christian Thalmann · garaldyckie pismo do oddychania"), and two
carry reading measures (`max-width: 42ch`, `60ch`) that mean nothing on a lapidary label. They were
authored to be read lowercase and were being rendered as inscriptions.

They take `.kol-gloss` — mono, sentence case, muted, the same tier `06-footer.css`'s `.pl` defines
and the same tier A2 just restored to the rubrics. **`.kol-close` keeps `.micro`**: "Cracoviae ·
MMXXVI · Laus Deo" is an inscription, which is exactly what that utility is for.

Two consequences worth stating: `.kol-license`'s measure went 60ch → 74ch, because mono at 12.5px
sets far fewer characters per line than the caps did; and `.kol-font-meta` keeps its own
`transition: color` and its hover to candle, which is unaffected because it carries no register.

---

## Etap B — the lead register — DONE 2026-08-01

The doctrine's own words: *"A scriptorium page is pricked and ruled before one letter is written,
so a rule that precedes its text is the only entrance this site can make that is literally true of
the object it imitates."* The colophon is the one page where that is also true of the **content** —
it is a page about setting a page — and it was the page using none of it.

The precondition the register states is already satisfied and this is the part to verify rather
than assume: *"Do not add a hairline in order to have something to rule."* Nothing is added here.
All three hosts carry a `border-top` the layout has always had.

| host | count | register |
|---|---|---|
| `.kol-def` | 14 | ink + lead (see below) |
| `.kol-font` | 4 | ink + lead |
| `.kol-collab li` | 9 | ink + lead — six collaborators plus Etap H's three photographers |
| `.kol-regula li` | 4 | ink + lead — Etap E, rows in the page's existing list grammar |

Wiring follows the landing's worked pattern exactly (`04-rooms-interludes.css:429`):
`html.voct-motion .X.reveal-rule { border-top-color: transparent; --rule-ink: var(--line); }` —
the real border stays for no-JS and reduced-motion visitors, and only under the motion gate is it
handed to a pseudo-rule that can be drawn. Top-anchored, which is `--rule-inset`'s default and is
also the truer reading (Etap 1a of the reveal plan: a scribe rules the line, then writes on it).

**`.kol-defs` gives up its `.reveal` and keeps its `data-d`.** This reverses part of Etap 5b,
which measured `.kol-defs` at 399px, called it "39 px over budget", and kept it whole. That call
was made on *geometry* alone and it was right on geometry. It is being reversed for a different
reason: with the ink on the container and the lead on the rows, rows 3..15 would be **ruled after
they were written**, which inverts the one gesture the pairing exists to express. The technique is
5b's own — *"`data-d` sets `--reveal-delay` for a whole subtree, so the container becomes the
cadence carrier and its children take the registers"* — and it retires the 399px overage as a side
effect.

**Ink + lead is the one permitted pair** (`registers.css`), and `registers.css:132` already gives
the ink its 0.18s offset behind the rule on a shared node. Nothing to author.

**Trap, checked:** none of the three hosts declared a `transition` before this. `.kol-font-sample`
does, but it is a *child* of the register node, not the node — verified, because this is precisely
how `.path-entry-title` lost its hover for a month.

**Trap, hit:** the four section separators (`.kol-band-rule-top::before`, a 60px hairline) **cannot
take this register** — `.reveal-rule` draws through `::before` and that pseudo-element is already
spent. Left alone. Do not "fix" it by moving the separator to `::after`; the register's hidden
state (`:not(.is-in)::before`) is what the controller keys on, and a second pseudo would need its
own rule set for no gain on four decorative marks.

**`data-d` on the two `<dl>`s is now inert, and it was left in place deliberately.** Once a node
carries ink AND lead, `registers.css:132` (`.reveal:is(.reveal-rule,…).is-in`, (0,3,0)) out-specifies
`html.voct-motion .reveal`'s `transition-delay: var(--reveal-delay)` ((0,2,1)) and pins the delay to
the pairing's 0.18s — so the subtree's `data-d` no longer reaches those rows' ink. It happens to be
the same 0.18s that `[data-d="2"]` sets, so nothing moved. Recorded because it is invisible and
because it comes back to life the moment a row loses `.reveal-rule`: **do not tune the row cadence
by editing `data-d` on the container** — it will do nothing, and the hour spent finding out is the
reason this paragraph exists.

---

## Etap C — the seal draws — DONE 2026-08-01

**The page's largest unspent moment.** The sigil is the centrepiece, it is generated per visit,
and it simply appeared.

**Why this one is permitted where the wordmark is not.** `web-landing-guardrails.md` §2 forbids
drawing the V, and the reason is specific: the letterform's identity lives in stroke modulation
that a uniform-stroke skeleton cannot carry, so a wireframe of it is *a different object*. The
same paragraph states the exception: *"The only parts that may be drawn are the parts that truly
are lines."*

**Re-measured before implementing, and it holds.** `sigil.ts` emits `<circle>` and `<line>` and
nothing else; the fills are dots and the roman `<text>`; the single `<path>` is inside `<defs>` as
the `textPath` geometry and is never rendered. No letterform, no modulation to lose. **If the
generator ever grows a rendered filled path, this stage's justification goes with it.**

### What shipped

`buildSigilSvg` now tags every element with a `sg-` class naming its step, and every element in
the `sg-draw` family carries `pathLength="1"` — so CSS draws it with `stroke-dasharray: 1 1`
alone: no `getTotalLength`, no measurement, no per-element bookkeeping. Two families, and they are
not interchangeable: `sg-draw` is the structure (rings, rays) and is drawn; `sg-fade` is
everything with no travel worth watching (dots, tip ticks, the inscription) and fades.

Normalising to `pathLength="1"` also decides something: a ring and a ray then share one clock
regardless of length, so **the composition is carried by the order, not by how long each stroke
is**. That is the intent — the seal is being written, not raced.

| step | class | delay | duration | ends |
|---|---|---|---|---|
| outer ring(s) — the field | `sg-ring` | 0s | 0.62s | 0.62s |
| inner ring — the socket for the candle | `sg-socket` | 0.16s | 0.50s | 0.66s |
| 4 cardinal rays | `sg-ray-a` | 0.34s | 0.46s | 0.80s |
| 4 intercardinals answering | `sg-ray-b` | 0.46s | 0.46s | 0.92s |
| tip ornaments + micro-dots | `sg-orn` | 0.80s | 0.42s | 1.22s |
| the central candle | `sg-candle` | 0.98s | 0.36s | 1.34s |
| the roman date | `sg-date` | 1.10s | 0.45s | **1.55s** |

The cardinal/intercardinal split is the generator's own: it already alternates ray weight *"so the
shape reads as a star not a wheel"*, and drawing in the same two groups says the same thing twice
instead of contradicting it.

**1.55s ≈ 620px of travel**, so the seal closes with the figure's top still ~170px down a 900px
screen — inside the ~2.0s ceiling with room, rather than at the "may sit at the long end" limit
the plan allowed itself. `--ease-rule` for the draws (a drawn stroke is a ruled line wherever it
lives, per the reveal plan's Etap 1c), `--ease-ink` for the fades.

### The three traps, one of which the plan did not have

1. **`:global()` is mandatory and the plan never mentioned it.** The page's `<style>` is scoped,
   so `.sg-draw` compiles to `.sg-draw[data-astro-cid-hcsdgg4r]` — and the SVG is injected with
   `innerHTML`, so it carries no `data-astro-cid` at all. Every rule reaching inside the seal
   would have matched **nothing**, silently, with the page still building green. The existing
   `.kol-seal-mount :global(svg)` was the proof sitting in the file the whole time. This is Trap 1
   of this document ("measure the emitted CSS") in a form it had not yet taken: not a rule that
   loses a cascade, a rule that cannot match.
2. **The hidden state is `:not(.is-in)`, as the plan said, and the reason is exactly as stated** —
   the SVG arrives on `astro:page-load`, so a late injection has to render finished rather than
   stuck at dashoffset 1. In practice the injection wins the race anyway (an IntersectionObserver
   callback is deferred past the synchronous `astro:page-load` handler), but the keying costs
   nothing and covers the case where it does not.
3. **Reduced motion needed no `@media` rule, and the plan implied it would.** `DocumentGates`
   withholds *both* `voct-motion` and `reveal-ready` under `reduce`, so `setupReveals()` returns
   early and `.is-in` never lands on a subpage at all. The `html.voct-motion` gate on the hidden
   state is the entire reduced-motion story. A `transition: none` was added under `@media
   (prefers-reduced-motion: reduce)` only for the one path that can reach it: a preference flipped
   mid-session, where the gate stays on the root until the next navigation.

**`pathLength` on basic shapes was not a new risk.** It already ships: `AetherInterlude.astro`
draws two `<circle pathLength="1">` vesica halves on the landing.

### Also in this stage — the caption

**It lied without JS**: the fallback is a circle and a dot, while the `figcaption` promises a seal
that turns per visit and vanishes with the tab. The caption now belongs to the generated seal —
`display: none` by default, revealed by a `data-sigil-live` flag the script sets right after the
injection. A visitor without JS gets the circle and no claim about it.

Rewriting the copy to be true of both states was the alternative and was rejected: the fallback is
a static circle, so *any* sentence about per-visit variation is false of it. There is nothing
truthful left to say, which means the sentence belongs to the state it is true of.

**No layout shift worth counting.** The caption sits ~900px down, below the fold on every ordinary
viewport, so its arrival is not in the CLS window. It also reports a zero rect while hidden, which
is precisely the case BaseLayout's above-the-fold settle already filters for.

---

## Etap D — the specimens fire on arrival — DONE 2026-08-01

The `Typi` rows are the best idea on the page and on a phone **nothing happened** — four names and
four notes. The demo was entirely `:hover`, and after Etap A6 removed the four dead tab stops it
was mouse-only everywhere.

### What shipped

A one-shot swell and return on `.kol-font-sample`, a **child** of the register node, keyed on the
parent's `.is-in`. One register per node holds (the row is ink + lead from Etap B) while the
choreography lives on an element carrying none — the same separation Etap B uses for `.kol-defs`.
Hover stays, as the repeat for a mouse.

**A one-shot swell and return, not a settle.** This deliberately breaks the pattern `.ink-press`
follows, and the reason is that it is not the same kind of thing. The press is an **entrance** and
must be one-way, because a reversible weight means scrolling back up rethickens a heading the page
has finished writing. A specimen is not an entrance: the axis *is* the subject matter, and the way
you show an axis is to travel it and put it back. Sanctioned here and nowhere else on the site.

`animation`, not `transition`, because out-and-back cannot be expressed as a transition — and
`animation-fill-mode` stays at **none**, which is load-bearing rather than a default left alone:
`forwards` would hold the last keyframe forever and the hover repeat could never out-rank it again.

**Each face states its four numbers once**, as `--spec-wght` / `--spec-wght-peak` / `--spec-track`
/ `--spec-track-peak`, read by three consumers: the resting state, the hover repeat and the
keyframe. They were literals in two places before the keyframe existed and would have been
literals in four after. The generic rule sets `font-weight` **and** `font-variation-settings` from
the same value — the axis wins wherever there is one, and on Plex Mono, which has none,
`font-weight` is what picks between the two shipped faces.

### The budget, and the plan's own number

**The plan's "start after the row's ink is spent (~0.6s)" mislabels its number.** The row is
ink + lead, so `registers.css:132` pins it to a 0.18s delay and the ink ends at **1.08s**, not
0.6s. 0.6s is where the ink is ~82% *perceptually* — and that is the right thing to measure
against, because waiting for the true end would close the gesture at ~2.4s, past the ceiling.

Shipped as `1.3s` at `0.6s`, peak at 42–58% of the clock: **peak at 1.15s, back at rest at 1.9s.**

**The return is allowed to run late, on purpose,** and this is the one place the stage reads the
budget differently from how the plan wrote it. The outbound travel *is* the demonstration and it
lands inside the reading zone; the return is housekeeping, and it costs nothing if it finishes as
the row is leaving the top of the screen. Holding both halves inside 2.0s would have meant ~0.6s
each way — faster than the 1.1s hover the block already had, i.e. a worse demonstration to satisfy
a rule that was not protecting anything.

### Measured, not assumed

- **No queue, no per-row `data-d`** — as the plan suspected, and now measured: the rows sit ~134px
  apart, so at reference pace their own triggers are ~335ms apart already, wider than the shared
  queue's 220ms step. All four do overlap during a fast scroll; four short text runs reflowing at
  once in a 760px column is the same load the hover already carried, one row at a time.
- **No sample reaches a second line at the heavy end.** The widest is "Cormorant Garamond":
  ~340px at the 44px cap, and ~212px at the 28px floor against ~319px of column on a 375px screen
  (`--gutter: max(28px, 5vw)`).
- **Every axis claim in the plan was true.** `public/fonts/` + the `@font-face` blocks in
  `base.css`: Cormorant `300 700` variable (roman + italic), Cinzel `400 900` variable, Plex Sans
  `100 700` variable, Plex Mono as two statics (300/400) — which is why its weight *snaps* at the
  peak while the tracking carries its demo, exactly as the pre-existing comment said.

### Two guards, both measured in `dist/`

- `html.voct-motion.vt-nav .kol-font.is-in .kol-font-sample { animation: none }`. BaseLayout
  settles the above-the-fold reveals inside a ClientRouter swap and `vt-nav` strips their
  transition — but a transition is **all** it strips, so on a viewport tall enough to reach `Typi`
  the animation would have played through the page transition. Mirrors `registers.css:323`.
- The reduced-motion `animation: none` is written at the *same* specificity as the trigger and
  wins on source order, which is only true because the `@media` block sits later in the file.
  Verified in the emitted bundle: trigger at byte 7773, `vt-nav` guard at 7923 (higher
  specificity), reduced-motion at 8226 (tie, later).

**Keyboard access is now restored** in the way A6 promised — by the specimen firing for everyone
on arrival, rather than by a focus target that does nothing when it is reached.

---

## Etap E — `Regula` — DONE 2026-08-01

The stage that answers "should the colophon describe the guiding thought". **It states the rule
and stops; it never explains it, and every line is set in an element that obeys it.**

Four lines, no paragraph after any of them, under a `Regula · Reguła` rubric — a Rule in the
monastic sense, which is the register the whole site already speaks (registrum, station, breviary,
liturgy). Placed as the **first parchment band**, between the seal and `Constructio`: the rule
governs the materials, so it precedes them. `Constructio` picks up the `kol-band-rule-top`
separator that was previously unnecessary on it.

| line | how it is demonstrated |
|---|---|
| everything waits at half-ink until it is written | **ink**, locally — the reader watches this sentence ink |
| the card is ruled before the first letter | **lead**, locally — its hairline is drawn, then it inks |
| a photograph is brought out by light | the rest of the site — see below |
| the letter stays where it was set | the rest of the site — nothing on it travels |

**The fourth line does not take `.ink-press`, and the reason is a rule and not a preference.** The
press *"never lands on body copy"* (`registers.css`) — it is the nib a heading is written with, and
these lines are copy however lapidary they read. Two lines demonstrated locally and two
demonstrated site-wide is also the more honest symmetry: a Rule is not obliged to perform itself
four times on one screen.

**The light register is stated and not demonstrated, deliberately.** It needs a photograph, and
the colophon is the only page on the site without one (`grep BleedImage`). Granting it one *in
order to have something to light* is the tail wagging the dog, and the register's own rule is that
it is granted **by role**, never invented for a demo. Decided with the developer 2026-08-01: the
page stays photoless. The demonstration of light lives on every other page; here the line is the
inscription of a rule, which is what a Rule is. If the page ever takes a photograph for its own
reasons, the line gets its veil for free.

**The negation budget was the drafting constraint, and it is why the lines are phrased as
positives.** A Rule is natively prohibitive — four lines of "nothing may…" would have put four
negations on a page that Etap G is stripping down to one. Each line therefore states what the page
*does*, and the prohibition is left implicit in the demonstration.

---

## Etap F — `Impressio` — DONE 2026-08-01

A colophon states which impression this is and when it was struck. The page had the inscription
(`Cracoviae · MMXXVI · Laus Deo` — correct locative, correct formula, the best line on the page)
but not the fact.

The build date, taken once in the frontmatter and used twice: as the impression line above
`.kol-close`, and as `dateModified` on the `WebPage` JSON-LD, which the graph was missing. One
source, two consumers.

Set in `--mono`, because a date is data (`tokens.css:32`) and because it must read as the factual
half against the inscription's Latin. Formatted through `Intl.DateTimeFormat("pl-PL")`, which
gives the Polish genitive month ("1 sierpnia") — the ordinary Polish reading, and the reason not to
hand-roll a month table.

**Not merged into `.kol-close`.** The inscription is terse Latin and the impression is a Polish
fact; running them together would cost the inscription its finality for no gain. Two lines, the
fact then the inscription, which is also the historical order.

---

## Etap G — the copy sweep — DONE 2026-08-01

Three negation clusters and five em-dashes in roughly twelve short paragraphs.

**Negations, down to one.** The guardrails' one-negation rule (from the `/kontakt` and `/o-nas`
refactors), and the same disease the guardrails already flag as untouched in the vault copy
(*"Bez pośredników, bez zakładania konta.", "Bez prowizji."*):

- `Pomiar` — "bez cookies" **kept**. It is the one negation on the page, and it earns the slot:
  for a privacy-minded reader it is a load-bearing factual claim that no positive phrasing carries.
- `Prywatność` — "strona **nie** sięga po zewnętrzny kod — **bez** Google Analytics i piksela
  Meta" restated as what the page *does*: everything comes from this domain, with Plausible named
  as the single exception. Says strictly more than the negative version did.
- the seal caption — "**niczego nie** zapisujemy" restated as what happens to the seed: it goes
  when the tab does. Concrete where the negation was abstract.

**Em-dashes, five → one.** Three were a colon or a full stop wearing a costume. The one kept is in
`Gratiarum actio`, where the dash separates the list from its provenance and is doing real work.
Rule from the guardrails: *reach for a full stop, colon or semicolon first.*

---

## Etap H — `Imagines` — DONE 2026-08-01

**The gap that mattered most.** The site carries ~50 photographs. The colophon credits type
designers by name (Christian Thalmann, Natanael Gama, Bold Monday), a recording engineer, a
lighting designer, an animator, a violinist, two organists — and **no photographer**. `grep -rn
"fot\.\|fotograf"` over `src/pages` and `src/components` returned nothing anywhere on the site. On
a page whose whole argument is that craft gets named, that was the one asymmetry with teeth.

Source of truth, per the developer (2026-08-01): **`src/content/concerts.yaml` caption strings**.
A gallery caption carrying `(fot. …)` names the photographer; a caption without one is the
foundation's own. Extracted:

| photographer | credited captions |
|---|---|
| Kamila Grudzińska | 7 |
| Wojciech Przybył | 3 |
| Jakub Garbacz | 1 |

11 of 43 gallery images carry a credit; the remaining 32 are the foundation's. Consents are in
place for all of it.

**The rubric is authored, not derived.** Deriving it from YAML at build time was considered and
rejected for now: three names is not a maintenance problem, the derivation would need a parser for
a free-text caption convention (`(fot. …)`) that nothing validates, and a silent parse failure
would drop a human credit. Recorded so it is not re-proposed as an obvious win — **but the
convention is now load-bearing**, so if a fourth photographer is ever added to `concerts.yaml`
the rubric has to be updated by hand. See "Open" below.

**Superseded 2026-08-10 — the rubric is derived, and the uncredited frames are the ensemble's.**
Both halves of this section are now wrong, and one of them had already cost something:

- The parser argument expired when stage 3 of `web-imagines-spec.md` moved credits out of caption
  text into a typed `gallery[].credit` field. There is nothing left to parse, so the rubric is
  read off the collection in `kolofon.astro` and walks the Via in order. The hand-kept list had in
  fact drifted before anyone added a name to it: it filed Wojciech Przybył under Archikatedra
  Łódzka, and his frames are Rybnik's.
- "A caption without one is the foundation's own" was recorded as a provenance guess. The founder
  confirmed it on 2026-08-10: an entry with no `credit` was shot by the ensemble itself. Every
  surface now prints that as `archiwum zespołu` (`lib/photoCredit`) instead of stating a gap —
  the `/obrazy` note asking readers to claim their photographs is gone, because there is nothing
  unattributed left to claim.

Three hands joined the three already there: Tomasz Czajkowski (Wcielenie), Edyta Gonet (9 Kart ·
Łódź) and Andrzej Płachetko (Hymn Poległym) — none of them needed an edit here. A fourth entry,
PieninyInfo (Wołanie Gór), is an outlet rather than a photographer and carries the new
`gallery[].source` field: the rubric prints it under its own `źródło` role, because a masthead set
in a photographer's voice credits it with an authorship nobody claimed.

---

## Rejected

Ideas that look right and are not. Do not re-propose without new evidence.

- **A paragraph on the site's guiding thought / the drawing parchment / the three registers.** The
  ImageRite failure one level up. See "The page, and what it is for". Adopted as Etap E's
  specimen instead, and that is the whole of the answer.
- **A photograph on the colophon so the light register has a host.** Etap E. The register is
  granted by role; inventing a host inverts that.
- **Drawing the wordmark on this page.** `web-landing-guardrails.md` §2, verified and rejected on
  sight once already. The sigil is drawable; the V is not.
- **The lead register on `.kol-band-rule-top`'s 60px separators.** `::before` is taken. Etap B.
- **Deriving `Gratiarum actio` from `concerts.yaml`'s `credits:` blocks.** They are two different
  records, not a divergent copy. Measured: the YAML `credits:` name Florent, o. Jarek Naliwajko SJ,
  o. Przemysław Wysogląd SJ, Ada Bystrzycka, ks. inf. Dariusz Raś, M. Wasilewski-Kruk, Joanna
  Indyk, Paulina Niemiec, Maria Tur, Magdalena Prześlica. The colophon names Jakub Garbacz,
  Ada Bystrzycka, Sebastian Kuźma, Radu Ropotan, Krzysztof Michałek, Michał Piechnik, Fundacja
  Carpe Diem, Ośrodek Kultury Norwida — and **Kuźma, Multiscena, Carpe Diem and Norwid appear
  nowhere in the YAML at all**, i.e. the colophon holds information that exists in no other file.
  Overlap is one name. Replacing one with the other would delete real credits. See "Open".
- **Singers' names on the colophon.** Consent exists (developer, 2026-08-01), and it is still the
  wrong page: `project_concert_detail_template_2026-07` settled that singer names belong to concert
  pages, where they say who sang *that* concert. Forty-four names on the colophon would turn a
  craft inscription into a roster and duplicate the concert pages without adding a fact.

---

## Open

Carrying real work, in rough order of value. **No stage is open** — everything below is either
editorial, a change the developer has to make outside the code, or a defect that belongs to
another page.

- **`Gratiarum actio` needs reconciling with `concerts.yaml`.** The two lists are independent
  records (see Rejected) and the colophon is missing people the concert pages credit — Joanna
  Indyk, the string quartet, the two priests, the basilica cantor. Whether they belong on a
  colophon or only on their concert page is an editorial call for the developer; it is not a
  merge that can be done mechanically. ~~If a fourth photographer joins the YAML, `Imagines` needs
  the same hand-update.~~ — void 2026-08-10: `Imagines` is derived from `gallery[].credit`, so a
  name added to `concerts.yaml` reaches the colophon on its own. Only `Gratiarum actio` is still
  hand-kept, and deliberately (see Rejected).
- **`Iura` — what may the press reuse.** `/press` is `noindex`, so a journalist arriving at the
  colophon learns nothing about rights. One rubric, one line, pointing at `/press`.
- ~~**The author's address is a personal Gmail.**~~ **DONE 2026-08-01** — the developer moved it
  to `krystian.bugalski@voctensemble.com`, and all five places changed at once: the `mailto:` and
  the JSON-LD `author` node here, plus both `SiteFooter` copies (Astro and React). Splitting them
  would have left exactly the identity blur this item was filed about. **The mailbox has to exist
  on the foundation's domain** — the code now points at it either way.
  **Superseded 2026-08-15 — the author's address is `krystian@bugalski.dev`.** The 2026-08-01
  objection was to a *personal Gmail*, and a professional domain is not the thing it was filed
  against. The distinction the `Auctor` rubric draws is the argument: a colophon carries the
  printer's mark beside the publisher's imprint, and an address inside `voctensemble.com` folds
  the two into one party. The foundation's mailbox is live and stays live — it is simply not what
  signs the craft. Same five places, moved together for the original reason.
  **The one place that legitimately keeps it** is `backend/config/settings.py:344`
  (`PATRON_NOTIFICATION_EMAIL`): that is where a patronage lead is delivered, i.e. the developer
  wearing a foundation hat, not the site's author. Left alone deliberately. Worth a separate look
  that patronage leads land there rather than at `patronat@` — out of this page's scope.
- **`lang="la"` on the other ~45 `.lat` hosts.** The colophon's ten are done. The same Latin/Polish
  rubric runs across `/koncerty`, `/koncerty/[id]`, `/o-nas` and the landing, all of it currently
  read aloud as Polish. Mechanical, but it touches every page, so it wants its own pass.
- **`--dark` reaches this page through `vault.css`'s compatibility shim** (`vault.css:21`,
  explicitly "re-declared for pages that don't load the landing foundation layer"). The colophon's
  entire dark hero and seal band therefore depend on `import "../styles/vault.css"` staying in the
  page for an unrelated reason. Third instance of the pattern `--sans` and `--ease-slow` already
  have. The fix is one line in `tokens.css` and deleting two duplicates, but it touches the landing,
  so it wants its own pass and its own verification.
- **KRS / NIP / REGON are hard-coded in nine places** (`SiteFooter.astro`, `SiteFooter.tsx`,
  `FinalSupportSection`, `AboutPage` ×2, `VaultModal`, `RegulaminModal`, `vaultConfig.ts`,
  `kontakt`, `kolofon`, `index`). Not urgent and not this page's problem, but a registry number
  does change and one copy will be missed.
- **`.kd-section-label` on `/koncerty/[id]` has Etap A2's defect**, unfixed. Same tie, same result.
- **`/kolofon` is not in `TRANSLATED_ROUTES`.** Correct under the lazy ledger; noted because the
  EN/FR footers link to it by its Polish URL.

---

## Pass 2026-08-15 — the identity sweep, and three on the page itself

Triggered by the developer asking three questions about the page and one about his address. The
audit that came with it reached past `/kolofon`, because three of the five defects were the
colophon's own decisions left unapplied on the surfaces that share its content.

**On the page.**

- **The lede's fourth sentence is gone** (`Tu robimy to samo.`). Etap G had already trimmed it once
  (`… : w swoim rzemiośle.`), which was the right direction and not far enough. The reason is the
  page's own Rule rather than concision: the lede names the three things a colophon records —
  place, time, who published — and `Złożono i odbito …` / `Cracoviae · MMXXVI · Laus Deo` **are**
  those three, in the historical order, at the foot of the page. Saying "we do the same here" at
  the top spends the ending 2 000px before the reader reaches it. The definition stays: it glosses
  the TITLE, a word most readers do not know, which is a different act from explaining a metaphor.
- **`Imagines` prints a frame tally per hand** — `Kamila Grudzińska · 8 fot. · …`. A roll of six
  names states that six people photographed the cycle and leaves their shares indistinguishable;
  the count is what makes the block an attribution. Derived, like the rest of the rubric.
  **The trap is in the loop**: `run.credits` is deduplicated per run, so tallying it counts
  EVENINGS. The walk is now frame by frame over `run.shots`. Totals: Grudzińska 8, Przybył 4,
  Gonet 3, Czajkowski 2, Płachetko 2, Garbacz 1, PieninyInfo 1 (`źródło`) = 21 credited of 48.
  Abbreviated as `/obrazy` abbreviates (`1 fotografia` / `n fot.`) — one fact must not meet the
  reader under two labels on two pages.
- **`Constructio` gained a `Wideo` row** — `AV1 i H.264 · własny odtwarzacz, pliki z naszej domeny`.
  The block described the image pipeline and was silent on film, which is the landing's heaviest
  material. Phrased positively on purpose: the page runs on one negation (`bez cookies`) and
  "bez osadzeń z YouTube" would have made a second. "Własny odtwarzacz" is also what keeps the
  `Prywatność` row true of a page that plays video.
- **`dateModified` is off the JSON-LD.** It was the build timestamp, spent twice with the visible
  impression line so the two could not disagree — but a deploy is not an edit, so the graph
  announced a modification to the colophon every time anything else on the site shipped. The
  visible line stays: a colophon dating its own impression is the truth it exists for. This was the
  only `dateModified` on the site.

**Off the page — the colophon's decisions, applied where they were missed.**

- **`↗` came off the author `mailto:` in BOTH footers.** The rule is Etap-era and was written into
  `kolofon.astro` alone: the arrow marks a link that opens elsewhere IN THE BROWSER, and a
  `mailto:` hands off to a mail client. `SiteFooter.astro` and `SiteFooter.tsx` had carried it
  since.
- **The landing footer's `Site ·` is now `Auctor ·`** (`lang="la"`), which is the vocabulary that
  block already speaks — `omnia iura reservata` sits beside it, INSCRIPTIO FINALIS / CONSILIUM /
  CORPUS / VOX above. It was the one English word in a Polish footer, and it is the rubric the
  colophon puts over the same name. The site-map footer keeps Polish `Realizacja`: that string is
  translated per locale (`t.realizedBy`), this one is not.
- **The four typeface names in the landing footer lost `tabIndex={0}`** and gained the colophon's
  arrival specimen (Etap D, ported to `06-footer.css`). Four stops in the tab order that announce
  nothing and pay out in a font wobble no screen reader perceives. **`11-mobile.css:497` hides that
  list on a phone**, so unlike the colophon there was no touch defect to fix — the win is keyboard
  and everyone who never hovers. The four literals per face became `--ff-*` custom properties for
  the same reason the colophon's did: three consumers now read them.
- **`MecenatPanel.tsx` moved to `@voctensemble.com`.** It was the only file on the site using
  `@voctfoundation.com` — two addresses, on the donation surface. Both domains are the foundation's
  and both deliver (nginx `prod.conf` redirects them), so nothing was broken; what was broken is
  that a reader deciding to commit money met `patronat@voctfoundation.com` here and
  `patronat@voctensemble.com` in the footer and had to work out whether that is one inbox or two
  organisations. `SITE` (`i18n/config.ts`) makes `voctensemble.com` canonical and every JSON-LD
  `@id` hangs off it; addresses follow. **Recorded as a decision, so a foundation-voice/ensemble-
  voice split is not re-proposed one panel at a time** — if it is ever wanted it is a whole-site
  editorial pass, not nine files drifting apart.
- **`Andrzej Płachetko`, not `Płachetka`.** `concerts.yaml` had it right in all three places and
  therefore so did the site; both docs carried the typo, and this file is the one a later session
  reads to check a credit against. Fixed here and in `web-imagines-spec.md:134`.

**Verification.** `npx astro check` 0 errors; `astro build --outDir dist-verify` green; register
audit clean (its 1 note is R10, six dark photographs, unrelated and pre-existing). Copy metrics
re-measured on the built page: **0 orphans** against an ordinary space, 0 straight quotes, 0 leaked
comments. **Em-dashes in `<main>` read 3, not the audit's 1 — and none of them is from this pass**:
byte-identical in the previous `dist/`. They arrived with the 2026-08-10 `Imagines` lede
(`Fotografie bez podpisu — tu i w całym serwisie — pochodzą …`, a genuine parenthetical pair) and
the `Gratiarum actio` lede. The metric in the 2026-08-01 audit is stale, not violated.

**Considered and not done.** A photo rail beside the `Imagines` names — `web-imagines-spec.md §2`
rejects thumbnail grids for this archive because these are low-contrast chiaroscuro frames that
render as black rectangles when small, and a rail is that failure in a narrower strip. **Do not
re-propose.**

---

## Pass 2026-08-15b — `Imagines` opens its frames

The lightbox, shipped the same day once the tally was on the page. It was staged behind the count
on purpose and the staging is the design: a bare name that turns out to be pressable is a hidden
affordance, where "8 fot." beside it is a legible invitation. **The order was the point — do not
read this as two passes that could have been one.**

**What it answers that nothing else on the site does.** `/obrazy` is ordered by evening, so a
photographer is scattered across it by construction; no surface could say *which of these are
hers* until this one. Seven triggers, 21 frames: Grudzińska 8, Przybył 4, Gonet 3, Czajkowski 2,
Płachetko 2, Garbacz 1, PieninyInfo 1.

**A second form of the `[data-image-open]` contract, and why.** The set is AUTHORED as JSON on the
one element that opens it (`data-image-set`), not collected by `data-image-group`. The group form
is a DOM walk over the frames themselves, and this page shows no photograph — satisfying it would
have meant emitting a row of hidden `[data-image-open]` carriers per hand, i.e. inventing markup so
a lookup would work. Both forms arrive at the island as an `ImageFrameSet` and the room cannot tell
them apart, which is what keeps this an extension rather than a mode. Documented in
`lib/imageFrame.ts` (the contract's owner); three touch points in `scripts/image-triggers.ts`
(`collect`, `preload`, the click guard). `JSON.parse` is wrapped — a throw inside a delegated
CAPTURE-phase listener would take down every other trigger on the page, the vault's included.

**Two things measured rather than assumed.**

- **Zero new emitted images.** 620 emitted / 75 pruned, byte-identical to the build before the
  lightbox, because `framedShot` is the same helper `/obrazy` calls and Astro dedupes the
  transform. This was the main cost risk and it is not one.
- **+5.0 KB gzip for the whole feature** (HTML + `image-lightbox.css` + the island), 117.7 → 122.7.
  The JSON itself is +13.9 KB raw but only +1.5 KB gzip — 21 `srcset` strings sharing a path prefix
  are close to free once compressed. Worth knowing before anyone "optimises" the payload into a
  lookup table.

**The room opens without a `thumb`, and that is unavoidable here.** Every other trigger on the site
is a photograph, so it hands the room its own decoded rendition to stand under the frame while the
full one loads. A name has none. The compensation is `preload` on hover, extended to warm an
authored set's FIRST item — which is why that branch exists and must not be tidied away. On touch
there is no hover and the frame opens dark for one load; accepted.

**Traps for whoever touches the CSS.** `.kol-collab-open` deliberately carries **no `font`
shorthand**: `font: inherit` resets family and size, `.kol-collab-name` (worn by the same element)
sets both, the two tie at (0,1,0), and the shorthand would win on source order and set six
photographers in the UA's system font. Verified in the emitted CSS. `justify-self: start` is
load-bearing too — the row's first track is `1fr`, and a stretched button rules its hairline out to
the column's width instead of the name's.

**The hairline stands at REST**, which is `/obrazy`'s argument for its `↗` and binds harder here:
`Gratiarum actio` below uses the identical row shape and is not pressable, so a mark that appeared
only under a pointer would leave a reader who never hovers unable to tell the two lists apart.

**Verification.** `astro check` 0 errors, build green, register audit clean (R10 only). All seven
payloads parse, all 21 frames carry `href` back to their evening, singular/plural correct in the
Polish `aria-label` (`otwórz fotografię` / `fotografie`). WCAG 2.5.3 holds — every accessible name
opens with the visible text. Copy metrics unchanged: 0 orphans, 3 em-dashes (the pre-existing
ones), 0 leaked comments. The seven new tab stops are real actions, which is the exact opposite of
the four removed from the landing footer in the pass above.

---

## Post-implementation audit (2026-08-01, after all eight stages)

A full pass over the finished page — copy, facts, cascade, accessibility, weight — run as if by
someone who had not written it. **What it confirmed is worth as much as what it found**, because
four of this page's claims are checkable and all four check out.

### Verified, so nobody re-checks them

- **The privacy claim is TRUE, measured not trusted.** `grep` over the built page for external
  hosts returns exactly one request: `plausible.io/js/script.tagged-events.js`. YouTube, Instagram,
  Facebook and zrzutka.pl are `<a href>` (navigation, not a request), `schema.org` is a JSON-LD
  `@context` string, `w3.org` is an `xmlns`. Fonts are local `woff2`. The copy says "everything
  comes from this domain, Plausible is the only exception" and that is exactly what ships.
- **`Imagines` is exact.** All 11 credited captions in `concerts.yaml` belong to `9-kart`, split
  7 Grudzińska / 3 Przybył / 1 Garbacz, and the venue split matches too: Grudzińska's seven are all
  "Bazylika NSPJ w Krakowie", the other four all "Archikatedra Łódzka". The rubric's venues are
  right. (9 Kart also played Rybnik; no gallery frame from it, so no credit is owed.)
- **Registry data, address and board match every other file** — KRS/NIP/REGON identical in all
  nine copies, `ul. Św. Filipa 23/3 · 31-150 Kraków` as everywhere, board in `AboutPage`'s order.
- **Copy metrics hold**: 1 em-dash in `<main>` (the one doing real work), 1 negation ("bez
  cookies"), 0 orphans against an ordinary space, 0 straight quotes.
- **`vault.css` is NOT dead weight.** It looked like 42 KB imported for `--dark` and `.micro`; it
  is 132 of its 170 classes in use on this page (chrome, footer, the whole vault). Do not
  "optimise" it away. Page total 173 KB uncompressed, of which 76 KB is shared chrome CSS.

### Found, and all of it fixed the same day

**`--candle` on parchment was 2.10:1 — a WCAG AA failure — and the fix is a token, not a patch.**
`--candle` was drawn for dark grounds, where it is 8.46:1 and beautiful; on paper it fails
outright, and it fails identically on `/o-nas`. So the answer is not a colophon override but
**`--candle-ink: #7f693a`** (`tokens.css`) — the same hue scaled to 64%, clearing AA at 4.67:1
and the *lightest* value that does. Its rule: **gold text under ~18px on any paper ground.**
`--candle` keeps the dark grounds, the large display gold, and every rule, border and mark, where
no contrast minimum applies. Applied to nine sites, all verified to sit on parchment: the
colophon's `.kol-author-role`, `.kol-link:hover` and `.kol-font-meta` hover, plus `/o-nas`'s
`.letter-mark`, `.collab-label`, `.doing a` (colour *and* its `color-mix` border),
`.milestone-date` and `.g-num`. **`.hero h1 em` on `/o-nas` deliberately kept `--candle`** — it
sits on a photograph, not on paper. Worth knowing before anyone lightens anything else:
`--ink-muted` clears AA at 4.53, by 0.03.

**IBM Plex now names its designer.** `Typi` named Christian Thalmann and Natanael Gama — two
people — then "Bold Monday dla IBM" twice. Now *Mike Abbink i Bold Monday dla IBM*, which is the
canonical credit. It was Etap H's asymmetry in a second place: on the one page whose argument is
that craft gets named, two faces named a person and two named a company.

**`lang="la"` on all ten Latin strings** — the eight rubric halves, the ninth on the eyebrow, and
`Cracoviae · MMXXVI · Laus Deo`. A Polish screen reader was pronouncing every one as Polish. The
site has ~45 more `.lat` hosts on other pages; this page is its densest Latin and the rest is a
separate sweep (see Open).

**`.sr-only` added to `base.css`, because the site had no such utility at all** — which is why
the `↗` was the only new-window signal and it is `aria-hidden`. The Statut PDF link now says so in
words for anyone who cannot see the glyph. The same `↗` came **off** the `mailto:`, where it
promised a browser tab and delivered a mail client.

**The footer stopped skipping a heading level** (`h2` → `h4` → now `h3`). **The trap in it:
`SiteFooter.astro` styles those headings by TAG (`.foot-col h4`), so changing the markup alone
would have left a live element with a dead rule.** Selector and tag moved together; the rule now
carries a comment saying they must.

**`.kol-impressio` and `.kol-close` now ink in** (`data-d="3"` / `"4"`). They were the only two
text nodes in `<main>` with no register — everything else arrives, those two were simply there.
Both are safe hosts, checked: neither declares a `transition`, and neither does `.micro`.

### Copy, including a sweep for generative-AI tells

Run over the built page, not the source. **The prose tells came back zero across the board** —
`nie tylko … ale`, `To nie X. To Y.`, empty intensifiers (`prawdziwie`, `wyjątkowy`, `starannie`,
`z pasją`), mission-speak (`nasza misja`, `wierzymy, że`, `świat, w którym`), filler
(`w jednym miejscu`, `w sercu`, `swego rodzaju`), hedges, and rhetorical triads. Sentence lengths
run 3 · 4 · 6 · 6 · 6 · 6 · 7 · 7 · 17 · 19 words, which is the opposite of the uniform 15–25
band that generated prose sits in. The two "English loans" a regex flagged are `Framework` (a
`<dt>` label) and `Content` (in the product name *Astro Content Collections*).

What the sweep and the read did find, all changed:

| was | now | why |
|---|---|---|
| `Tu robimy to samo: w swoim rzemiośle.` | `Tu robimy to samo.` | the colon-and-coda is a flourish, and the page proves the point below rather than asserting it |
| `… osobno dla każdej strony. Bliżej rzemiosła niż biblioteki komponentów.` | clause deleted | a value claim, and a punchy fragment closing a paragraph. **On the one page whose stated rule is that it shows and never explains, it was the page breaking its own Rule** |
| `Wszystko czeka w półcieniu…` | `Wszystko czeka wpisane blado…` | the line demonstrates INK (`--half-ink`) and was borrowing the LIGHT register's word — while line three of the same Rule is the one about light |
| `znika razem z kartą` | `znika, gdy zamkniesz tę stronę` | `karta` already meant the manuscript leaf (`Kartę liniuje się…`) and the concert cycle (`9 Kart`) on this page |
| `garaldyckie pismo do oddychania` | `garaldowa antykwa na nagłówki i tekst` | `garaldycki` is a coinage (`garaldy` / `garaldowy` is the usage), and "do oddychania" was the one vague note among four factual ones |
| `Zdjęcia z koncertów cyklu` | `Zdjęcia z Koncertów Duchowych` | the cycle has a name and a colophon is read standalone |
| `projekt · kod · obecność cyfrowa` | `projekt · kod` | a marketing noun standing beside two facts; the triad was the reason it was there |
| `credits z plakatów i programów, ułożone tu jako wpis archiwalny` | `nazwiska z plakatów i programów` | an English loan mid-Polish sentence, plus a clause explaining what the list obviously is |
| meta `… Pieczęć rzemiosła w jednym miejscu.` | clause deleted | `w jednym miejscu` is pure filler |

**`Twórczynie i twórcy` was left alone deliberately.** It reads as an institutional tic, but in
Polish cultural writing it is a considered register choice and it opens a credits list — removing
it is an editorial act, not a copy fix, and it is the developer's to make.

**Two of these were mine, introduced during this same pass and caught by re-measuring**: the
`sr-only` string arrived carrying an em-dash, an hour after the audit got `<main>` down to one
(now a comma, in a string only a screen reader hears); and `prozę` is not the Polish typographic
word for running text (now `tekst`).

After all of it, the metrics still hold: **1 em-dash, 1 negation, 0 orphans, 18 pinned nbsp.**

### Known and deliberately not fixed

**A specimen hovered inside its 0.6s delay yanks back to rest** when the animation takes over.
The obvious guard (`:hover { animation: none }`) is worse: unhovering re-applies the animation and
fires the whole swell a second time, at an arbitrary moment. Requires hovering one specific row
within 600ms of it crossing 88% vh, with a mouse, mid-scroll. Left alone on purpose.

**One real defect was found in Etap C's own CSS and fixed**: `var(--sg-in)` / `var(--sg-at)` had
no fallbacks, so any future `sg-draw` element reaching the page without a step class would leave
the shorthand invalid at computed-value time and **snap into place instead of drawing** — silently,
on one element out of thirty. Now `var(--sg-in, .5s)` / `var(--sg-at, 0s)`.

---

## Traps, for whoever picks this up

1. **Measure the emitted CSS.** Findings 2, 3 and 5 are invisible in the `.astro` source. Astro
   scopes page styles by appending `[data-astro-cid-…]` to **every compound**, so a page rule
   routinely ties or beats a shared-sheet rule and wins on bundle order.
   **The same mechanism has a second, worse form**, found in Etap C: an element created at
   runtime (`innerHTML`, a React island's children, anything not in the SSR output) carries no
   `data-astro-cid`, so a scoped rule aimed at it matches **nothing**. Not a lost cascade — no
   match at all, silent, and the build stays green. Anything reaching inside injected markup needs
   `:global()`. `.kol-seal-mount :global(svg)` is the page's own precedent.
2. **A register replaces `transition`, it does not add to it.** Check the element first. Check
   the reverse too: a page-local rule touching a register node's `opacity` or `transition`
   silently out-specifies the register and leaves it inert.
3. **`.is-in` is the trigger. `.is-visible` is not** — that belongs to React islands with their
   own visibility state.
4. **Anything whose point is a moment must be triggered by arrival, not by bind.**
5. **A choreography's duration is a scroll distance.** ~400px/s; 1s ≈ 44% of a 900px screen.
6. **The page's own `<style>` is scoped; `base.css`, `tokens.css` and `registers.css` are not.**
   A fix that belongs to the site does not go in `kolofon.astro`.
7. **`html.voct-motion` is the whole reduced-motion story on a subpage.** `DocumentGates` withholds
   both `voct-motion` and `reveal-ready` under `reduce`, so BaseLayout's `setupReveals()` returns
   early and **`.is-in` never lands at all**. A choreography gated on `html.voct-motion … .is-in`
   is already dead under `reduce`; a `@media (prefers-reduced-motion: reduce)` rule beside it
   covers only a preference flipped mid-session, and needs to be written to win on specificity or
   source order if it is going to cover even that.
8. **`animation` and `transition` are different slots, and `vt-nav` only strips one.** The
   navigation-composure rules in `base.css` / `registers.css` kill transitions so a swapped-in page
   is snapshotted already written. An animation on an above-the-fold node plays straight through
   the page transition unless it is guarded separately.
