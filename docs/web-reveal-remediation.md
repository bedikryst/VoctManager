# Reveal remediation (`web/`) — the plan across sessions

Working plan for finishing the 2026-08 entrance-register pass. One session is not enough, so
this file is the contract between them.

Companion to `docs/web-landing-guardrails.md` §5, which states the *doctrine* (three registers,
three rules). This file is the *work*: what the doctrine does not yet describe, in what order to
fix it, and what was measured to decide that.

**How to read this file.** Etapy 0, 1 and 2 are done — each keeps its section, because the
measurements and the corrections inside them are the reasoning the later stages stand on.
`Etap 3` is the next thing. The stages are ordered by dependency, not by value. `Rejected` is
load-bearing: it records ideas that look right and are not, so they are not re-proposed.

**A method note earned twice.** Both Etap 1 and Etap 2 found the plan's own diagnosis too
narrow once the code was measured (1b was dropped outright; Etap 2's scope turned out to be
five pages wider than written). Before implementing any stage below, re-measure its claim
against the source — the plan is a record of what was true when it was written.

Started 2026-08-01.

---

## 0. The measurement everything else rests on

The pass gave the page four registers and one shared onset queue, but never budgeted a
choreography against the **scroll distance it plays over**. That omission is the single cause of
"some enter already done, some animate nicely" — the good ones are the short ones.

**The unit.** A node fires when its top edge crosses the trigger line and then keeps travelling
up the screen. At an unhurried desktop reading pace through Lenis (~350–450 px/s; take 400) on a
900 px viewport:

```
1 s of choreography  ≈  400 px of travel  ≈  44 % of the viewport
```

**The budget.** Trigger is at 88 % vh (`rootMargin: "0px 0px -12% 0px"`).

| target | travel | duration |
|---|---|---|
| finish in the reading zone (~45 % vh) | ~390 px | **~1.0 s** — nominal |
| finish before leaving the top of the screen | ~790 px | **~2.0 s** — hard ceiling |

**What the page actually runs**, measured from the CSS:

| choreography | ends at | verdict |
|---|---|---|
| ink `.reveal` | 0.90 s | ✅ |
| lead `.reveal-rule` | 1.05 s | ✅ duration — ❌ anchor, see below |
| ink + lead on one node | 1.08 s | ✅ |
| light `.reveal-light` | 1.80 s | ✅ conditionally — it is section-scale, so the reader watches the section's *middle*, which buys roughly double the budget |
| silence (`10-silence.css`) | 1.90 s | ⚠️ marginal — mid-page, no exemption |
| coda score / caption | 1.75 s / 2.60 s | ✅ exempt — page bottom, the scroll ends there and the reader has nowhere to travel to |
| **interlude knot** (`d-mandorla` 1.6 delay + 1.6) | **3.20 s** | ❌ |

The interlude is the page's structural punctuation and it is **1280 px — one and a half screens
— of travel long**. At any normal reading pace the band has left the viewport before the mandorla
closes. It has never been seen finishing.

**The anchor defect, which is separate from duration.** The trigger fires on the element's *top*,
but a lead rule is drawn wherever its border is:

- rule at the **top** (`.path-register`, `.ensemble-facts`, `.donation-list`, `.bank-card`) →
  draws exactly *on* the trigger line, i.e. in the bottom 12 % of the screen. Technically visible,
  practically not watched. This is the "borderline" half of the complaint.
- rule at the **bottom** (`.manifest-top`, `.path-entry`, `.path-next`) → draws `h` px lower still.
  `.path-entry` is 280–420 px tall, so its rule draws at **120–135 % vh — entirely off-screen**,
  every time, for every entry.

So the lead register — the one whose whole justification is "a scriptorium page is ruled before it
is written" — is the register nobody has ever actually watched. It predates this pass (the old
`.path-entry::after` had the same trigger), which is why it survived the rewrite unexamined.

---

## Etap 0 — done 2026-08-01 (this session)

Safe, self-contained, no visual retuning. All verified by `npm run build` (14 pages, exit 0).

- `landing.ts` — `settle()` now ignores `transitionend` from `::before` on ink-bearing nodes.
  `is-settled` kills both transitions on a node, so accepting whichever ended first cut the other
  off. Today the pair ends 30 ms apart so nothing was visible, but it **locked the durations**:
  Etap 3 wants a faster rule, and without this guard that would silently start snapping the ink.
- `landing.ts` — `MAX_BACKLOG_MS` 900 → **450**. The cap is a scroll distance, not a comfort
  margin: 900 ms of backlog on top of a 900 ms ink carried a node ~720 px higher before it
  finished, and backlog only ever builds during a fast scroll — exactly when the node is already
  moving fastest. Two onsets deep is all the queue needs to break unison.
- `10-silence.css` — the word's resting 0.82 moved from `opacity` to `color` (`color-mix` on the
  `em`, which is the only ink that renders; the `<p>`'s own colour never showed). `opacity` now
  belongs to the register, so the hidden state is `var(--half-ink)` and not the untethered 0.26.
- `10-silence.css` — deleted the `@media (prefers-reduced-motion: reduce)` block. Every hidden
  state there is gated on `html.voct-motion`, which `DocumentGates.astro` adds **only** when
  reduced-motion is not set, so the block could never override anything. It was four resting
  values to hand-sync, and had already drifted (`.silence-ornament` was declared at 0.55 and 0.5
  at once).
- `09-kinetic.css` — deleted `@property --wght-reveal` and `@property --reveal-y`. Unused
  anywhere in `src/`; `--reveal-y` was the registration for the translate this pass removed.
- Comment truth: `landing.ts` header now lists `setupInterludeBreath` / `setupInteractions` and
  declares the heading-breath debt; `base.css` header no longer claims subpages have no ruled
  hairlines or photography (they do); `PathSection.astro` no longer points at `.path-entry::after`.

Not done, deliberately: everything below needs the change watched in a browser, which is the
developer's step, so batching it blind would only make it harder to attribute.

---

## Etap 1 — put the gesture where the eye is — done 2026-08-01

The whole answer to "some arrive already done". Delivered as 1a + 1c below, plus a lever pulled
forward out of Etap 3; **1b was dropped during the work — see "1b, and why it was wrong"**.

### 1a. Anchor every lead rule to the top of its element — DONE

Make the rule's position match the trigger's assumption, rather than teaching the observer about
per-element geometry (which would need a second observer with a `threshold: 1.0` fallback and a
height guard — fragile, and it fails *silently* to a permanently invisible hairline, because the
real border is transparent under `voct-motion`).

- `.path-register` dropped `border-top` **and its `.reveal-rule` class** — it was only ever a
  register node in order to carry that one line. Each `.path-entry` takes `border-top` instead of
  `border-bottom`, and `.path-register .path-entry:first-child` carries `--line-strong`, so the
  register's opening rule is now the first entry's own. `--rule-inset` returns to its default
  everywhere; `.manifest-top` is the only element left setting it.
- `.path-next` keeps the candle-gold closing line as a **static** `border-bottom`. It is the last
  hairline in the section with nothing beneath it, so drawing it would mean drawing it at the
  card's bottom edge — the single most off-screen position there is.
- `.manifest-top` **keeps** its bottom rule. It is 90–110 px tall, so the offset costs ≤ 0.3 s at
  reference pace — inside budget. Documented exception, not an oversight.

Pixel-neutral by construction: a 1 px border moved from the end of entry N to the start of entry
N+1 sits at the same y and costs the same flow height. Only *when* each line is drawn changed.

### 1b, and why it was wrong — DROPPED

The plan called for a second observer giving the lead register a later trigger line (70 % vh) so
rules would not draw in the bottom strip. **Do not build this.** Two trigger lines produce
ordering inversions between neighbouring nodes: `.donation-list` (lead) would fire at 70 % while
`.donation-rows` — its own first child, at effectively the same y — fires at 88 %, so the ledger's
rows would ink *before* the rule that opens them. One trigger line for every register is a
correctness requirement, not a simplification.

The measurement also showed the diagnosis was wrong. Rules did not read as marginal because they
were drawn low; they read as marginal because `--ease-slow` (`cubic-bezier(0.16, 0.84, 0.24, 1)`)
puts **82 % of the travel into the first 27 % of the clock** — so 82 % of the draw happened within
~115 px of the trigger, and the last fifth crawled for 760 ms. The lever was the easing, not the
trigger, so `--ease-rule` was pulled forward out of Etap 3 (see below). Etap 3 keeps `--ease-ink`
and `--ease-light`.

### 1c. Long choreographies inside the ceiling — DONE

Applied as a **single tempo factor per choreography**, not as hand-picked per-stroke values: the
internal rhythm — which stroke answers which, and how far behind — is the composition; the total
is only its tempo marking. Rewriting nine numbers by hand would have re-composed it.

- **Interlude** (`AetherInterlude.astro`) — ×0.625 on every duration and delay, putting the
  closing mandorla at 2.0 s (was 3.20 s). Measurement was worse than the plan recorded: the
  **gilding sweep ran 2.6 s + 1.5 s delay = 4.10 s**, over 1600 px of travel, a per-frame
  `background-clip: text` repaint playing two screens above the reader. It is the one stated
  deviation from the factor — delay takes ×0.625, duration is then set so the sweep closes with
  the last strokes at ~2.0 s. Justified because nothing is hidden behind it: the gold is already
  legible, so it is an accent riding the cadence, not a reveal that owes a wait.
- **Silence** (`10-silence.css`) — ×0.74 on all three onsets, so the writing order survives:
  dot 0.5 s, rules 1.1 s, word 1.4 s (was 1.90 s). Its rules also moved to `--ease-rule`; a
  `stroke-dashoffset` draw is a ruled line whatever element it lives on.
- **Coda** stays at 2.6 s, exempt — the scroll ends under it. Do not "fix" for consistency.

### 1d. `--ease-rule` — pulled forward from Etap 3 — DONE

`--ease-rule: cubic-bezier(0.45, 0.05, 0.55, 0.95)` — symmetric (x = y = 0.5 at the midpoint), so
a rule is drawn evenly across the reading zone instead of snapping in the strip below it. Applied
to the shared pseudo-rule, `.director-dark::after` and `.silence-rule`. `--rule-in` also came down
1.05 s → **0.85 s**, which finally makes the pairing true: the rule now completes 230 ms before
the ink it leads, where the two used to end 30 ms apart. That was only safe because Etap 0 stopped
`settle()` accepting the pseudo-rule's `transitionend` on ink-bearing nodes.

**Correction, same day.** The first attempt at 1c compressed only what was inside the block being
read — the knot strokes, the flame, the gilding — and missed everything else in the file: the
numeral (3.60 s), the inscription's letter-spacing settle (2.80 s), the two aether lines (2.35 s)
and the lumen ray (3.80 s). So the band's *longest* element was untouched and the pass left the
interlude worse-covered than it claimed. The method was the error: **enumerate every `transition`
in a file before touching any of them** (`grep -n "transition" <file>`), because a choreography is
not confined to the block that looks like it owns it. Fixed; ×0.625 now applies file-wide, with
the two ambient settles (numeral 2.25 s, ray 2.38 s) deliberately past the ceiling.

### 1e. Tall ink nodes — the same defect, one register over

Anchoring fixed *rules*; the identical geometry problem exists for **ink**. One `.reveal` on a
tall block means one trigger at the block's **top**, so the heading is watched being written while
the copy 200–300 px below it finished long before the reader's eye arrived. Reported from the
browser, and it is the ink half of the same complaint that produced 1a.

**The rule: a `.reveal` node is one utterance, and must fit the ink's own travel (~360 px).**
Group what is read as one thing (eyebrow + heading, an emblem and its line). Split what is read in
sequence (heading vs body, a card's rail vs its body). Controls stay out of the register: a
half-ink button is a button you are not sure you may press.

Done:

- **`.path-entry` / `.path-next`** — the entry keeps `.reveal-rule` (lead) and the ink moved to
  `.path-entry-rail`, `-title`, `-place`, `-summary`. The rule and the title end up ~220 ms apart
  through the queue, which is the pairing the shared node used to hard-code.
- **The landing footer had no entrance at all** — no `.reveal` anywhere in
  `islands/landing/SiteFooter.tsx`. It is not chrome: it numbers itself **IV**, continuing the
  interludes' I/II/III, so it is the page's last movement. Its five blocks now take ink in
  sequence. **This did not work on the first attempt, and the reason is now a guardrail:** the
  reveals were applied to nodes React had already thrown away. `useLiturgicalClock` snapshots the
  time during *render*, so on a static build the server HTML holds the build-time clock and the
  client renders `now` — a mismatch on every visit, which React answers by discarding the
  island's server DOM and re-rendering it. The observer was left holding detached elements and
  the footer sat at half-ink forever, with nothing in the console pointing at reveals. Fixed at
  the root (`suppressHydrationWarning` on the clock-derived text + a fresh snapshot on mount),
  because a guaranteed mismatch also meant every visit was throwing the footer's SSR away.
  **The general rule, before putting `.reveal` on any island:** the `className` prop must be a
  constant string (React writes the attribute only when its value changes, so constants survive
  re-renders) *and* the island must hydrate clean. The first condition is the obvious one; the
  second is the one that fails silently.

Still to do, in the page-by-page sweep (Etap 5) — measured as over or near budget:

| node | why |
|---|---|
| `.final-lede` | eyebrow + h2 + a four-line paragraph in one node |
| `.bank-card` | several `.bank-row`s under one onset |
| `.donation-rows` | three tiers under one onset |
| subpage blocks | `AboutPage` `.prose measure`, `.board-card`, `koncerty/[id]` rows — inherited when Etap 4 brings them into the register system |

Checked and **correct as they are** — do not split: `.director-lede` (eyebrow + two-line h2 is one
utterance, and its paragraphs are already separate nodes), `.ensemble-lede` (same shape),
`.rite-quote` (the mark and its one line are a single emblem).

### 1f. Interlude ink strength

The tempo work exposed a second problem: the drawing could not be *seen*. Candle gold on
parchment is the site's weakest pairing, and the band sat at `stroke-opacity` 0.2 (structural
strokes) and 0.13 (staff), plus 0.22 on the two aether lines — roughly 1.1–1.2:1 against the
ground, which is not subtlety but invisibility. Raised to 0.30 / 0.20 / 0.34, **calibrated in CSS
rather than in the per-path SVG attributes** so the band has one place to be read (CSS beats a
presentation attribute; the attributes stay as the no-CSS floor). The waves keep 0.55 and the
numeral keeps 0.07 — the waves were always the legible strokes and carry the knot's shape, and the
numeral is a watermark, where "barely there" is the whole idea. A flat multiplier over all of them
would have flattened the band's own hierarchy.

**Still needs eyes.** Every number in Etap 1 is derived from the budget model, not from watching
it. The likeliest thing to be wrong is the interlude factor: 0.625 is a big cut, and if the
opening strokes now read as hurried, the answer is a gentler factor (0.72–0.75) plus accepting
~2.3 s — not reverting to per-stroke tuning. Second likeliest: the ink strengths above may now be
too present; they were set to clear a perception threshold, not to a taste judgement.

---

## Etap 2 — fold the heading breath into the ink gesture — done 2026-08-01

The diagnosis held; **the scope in the plan did not**, which is the second time this file has
been wrong about the size of its own problem (see 1b). Recorded first, because it is the part a
later reader needs.

### What the plan said, and what the code said

The plan named `setupKinetic`'s four selectors — `.ensemble h2`, `.path h2`, `.section-title`,
`.final-support h2` — as the whole of the defect. Measured:

- Those four selectors are **three nodes**: `.path h2` and `.section-title` are the same element
  (`PathSection.astro`). Two of the three are *children* of the `.reveal` node, not the node.
- The identical defect — a reversible, scroll-scrubbed `wght` on nodes that are being inked —
  runs on **five subpages in pure CSS**, through `@keyframes headingBreath` +
  `animation-timeline: view()` with `animation-range: entry 0% cover 55%`: `/koncerty`
  (`.station-title` is literally `class="station-title reveal"`), `/koncerty/[id]`, `/o-nas`,
  `/kolofon`, `/kontakt`, plus `/press` with its own 300→380 keyframes.
- `09-kinetic.css` claimed "Removed; JS is the only driver". True of the landing, false as a
  statement about the site — and `@keyframes headingBreath` sits in the *shared* `tokens.css`
  precisely because those five pages still run it.

So a landing-only fix would have left the defect on 12 of 13 pages and opened a divergence.
See "the subpage half" below for how that was sequenced.

### The measurement

`p = clamp01((vh − rect.top) / (0.75·vh))`, `wght = 520 − 200p`:

| moment | position | wght |
|---|---|---|
| breath starts | top at 100 % vh | 520 |
| **ink triggers** | 88 % vh | 488 — 16 % of the breath already spent |
| **ink ends** (0.9 s ≈ 390 px) | ~45 % vh | 373 — the breath is 73 % done |
| breath ends | 25 % vh | 320 |

The breath's travel is 0.75 vh = 675 px = **1.69 s** at reference pace: inside the 2.0 s ceiling,
but 1.9× the ink's clock and aligned with it at neither end. Reversibility was the headline
defect; the mistiming is the one that made the two motions read as unrelated.

Two smaller truths fell out: the CSS declares `font-weight: 300` on all three headings while the
JS settled at **320**, so the stylesheet lied to anyone who scrolled — and the direction 520→320
does *not* cancel the ink, as it first appears. Ink mass ≈ opacity × stroke goes 0.44·520 = 229 →
1.0·300 = 300, still rising ~1.3×, while the letterform changes shape. The authored direction was
kept; only its clock changed.

### What was built

- **`styles/registers.css`** (new, loaded by `BaseLayout` on every page) — the `.ink-press`
  mechanism. Opt-in per element, so no paragraph ever breathes. `--wght` travels
  `--wght-press` (520) → `--wght-rest` (300) over `--ink-in` with the ink's own easing, driven
  by `.is-visible` on the press node **or on its `.reveal` ancestor**. Gated on
  `html.voct-motion`, so no-JS and reduced-motion visitors render the plain `font-weight` and
  are never left on the pressed weight. This is Etap 4's destination sheet, seeded early on
  purpose: a second heading system in `06-footer.css` would have to be moved again in a month.
- **The rest weight is now 300, not 320** — the value the three type rules already declared. It
  is one token (`--wght-rest`) and it is also correct for every subpage heading
  (`.station-title`, `.rite-head h2`, `.coda h2` … all `font-weight: 300`), which is what makes
  it the site's number rather than the landing's. If the eye disagrees, that is a one-line flip.
- **`landing.ts`** — `setupKinetic` → `setupHeroBreath`, hero only. The hero stays scrubbed and
  that is not an oversight: it is keyed to the *threshold*, a moment the visitor crosses and
  leaves, so tracking position is the honest reading. Removing the headings also took 3
  `getBoundingClientRect()` per frame out of a loop that runs the length of the page.
- **`wght()` now writes only on a real change.** Separate finding, same file: past 90 vh the
  hero's scrubbed value is pinned, but the loop kept re-assigning an identical inline
  declaration to `.hero-title` and `.hero-title em` on every scroll frame for the rest of the
  page — which still dirties style. One comparison removes it.
- **`@property --wght` was registered twice** — `tokens.css` (`inherits: true`, 400) and
  `09-kinetic.css` (`inherits: false`, 320) — so the effective descriptors were a function of
  bundle order, not of anything in the source. Collapsed to one registration in `tokens.css`
  with `inherits: false`, which is safe **only** because every reader sets the property on the
  same element that reads it; `font-variation-settings` is the inherited property, and it
  inherits its already-substituted value. Declaring `--wght` on a wrapper and reading it on a
  child would now fail silently.
- **Dead registrations deleted**: `--wght-em` and `--wght-add`, neither referenced anywhere
  (same reasoning as Etap 0). `--wght-add`'s comment described JS that splits the wordmark's
  letters for cursor reactivity — there is no such code in `SiteFooter.tsx`; `--wght-mark`'s
  only reader is the footer clock's 9 s pulse. Comment corrected rather than deleted.

### Three implementation traps, all silent when broken

1. **`transition` is a shorthand.** `.section-title` is both the press and the `.reveal` node,
   so a second `transition` declaration would have *replaced* the ink's opacity transition
   instead of adding to it — the heading would have snapped to full ink. The combined rule uses
   longhands, which also leaves `transition-delay` untouched so a future ink+lead+press node
   keeps the lead's 0.18 s.
2. **`is-settled` strips transitions, and the press rules out-specify it.** `06-footer.css`'s
   `:is(.reveal, .reveal-light).is-settled { transition: none }` is (0,2,0); the press rules are
   (0,3,1) and would have kept the pair hot for the session. `registers.css` carries its own
   settled override at matching specificity, placed last.
3. **The `html:not(.voct-motion)` gate in `index.astro` neutralises `opacity` and `transform`
   only.** A weight declared outside `html.voct-motion` would have stranded every heading at 520
   for a no-JS visitor. The press therefore declares `font-variation-settings` *inside* the gate,
   the same contract `.reveal-rule::before` and `.reveal-light` already follow.

### Needs eyes

`font-variation-settings` changes advance widths, so a press re-lays-out its heading each frame.
`.ensemble h2` has a pinned `<br />` and `.section-title` is short, but **`.final-copy h2`**
("Niech muzyka ma swoje miejsce.", `clamp(48px, 6.5vw, 108px)`, no pinned break) could change
line count between 520 and 300 and shove the paragraph under it. The old system carried the same
risk smeared across a scroll; on a 0.9 s clock it would show as a jump. If it does, narrow the
range (`--wght-press: 420`) rather than dropping the press.

### The subpage half — deferred, deliberately, into Etap 4

Not fixed in this pass, and this is a decision rather than an omission: adopting `.ink-press` on
the five subpages means deciding *which* headings deserve a register, because several breath
headings there are not `.reveal` at all (`koncerty.astro` lines 176 and 284). That judgement is
Etap 5's, and Etap 4 is where the shared controller that fires it arrives. Until then the site
runs two heading systems, which is recorded in `tokens.css` beside the keyframes and in
`09-kinetic.css`, so it cannot be rediscovered as a surprise.

---

## Etap 3 — one easing per register

The thesis is "three materials arrive differently", but all three run on `--ease-slow` and differ
only in duration and animated property. The differentiation is currently in *what* moves, not in
*how* — which is the weaker half of the claim.

`cubic-bezier(0.16, 0.84, 0.24, 1)` is heavily front-loaded. Concretely wrong twice:

- a line drawn along a straightedge has near-constant speed; the rule currently *shoots* and then
  crawls to its end.
- the veil puts ~80 % of its light in the first 400 ms and then spends 1.4 s on the rest. Light
  entering a nave does the opposite.

Three tokens — `--ease-ink` (keep the current curve), `--ease-rule` (near-linear),
`--ease-light` (slow start, then flood). Do this **after** Etap 1, or it will be tuned against
timings that are about to move.

---

## Etap 4 — lift the registers out of the landing bundle

The registers stop at the landing's edge, and twelve other pages speak ink only — with the exact
trigger this pass diagnosed as wrong. `BaseLayout.astro`'s subpage observer still runs
`{ rootMargin: "0px 0px -8% 0px", threshold: 0.1 }`, and `landing.ts` explains at length why a
ratio threshold lets node size set the tempo.

`data-d` covers about half the nodes, so "a subpage's cadence is authored per element, it needs no
queue" is half true:

| page | `.reveal` | `data-d` |
|---|---|---|
| `koncerty/[id].astro` | 40 | 20 |
| `koncerty.astro` | 29 | 13 |
| `AboutPage.astro` | 29 | 18 |
| `kolofon.astro` | 22 | 14 |
| `kontakt.astro` | 15 | 7 |

And `data-d` tops out at 0.36 s in 90 ms steps — a different tempo from the 220 ms queue for the
same gesture.

Work: move the three register definitions from `landing/06-footer.css` into
`styles/registers.css` — which **already exists** since Etap 2 and is already loaded by
`BaseLayout` on every page — collapse the duplicate `.reveal` definition and its two trigger
classes (`is-in` vs `is-visible`) into one controller, and adopt the lead register on
`/koncerty`'s entry rules and the light register on `/o-nas`'s portrait. The duplication was
justified while the two definitions differed; since this pass they express the same register, and
keeping both is now pure cost.

**Carried in from Etap 2, and the reason it lands here:** five subpages still scrub a reversible
heading weight in CSS (`@keyframes headingBreath` + `animation-timeline: view()` in
`koncerty.astro`, `koncerty/[id].astro`, `AboutPage.astro`, `kolofon.astro`, `kontakt.astro`,
plus `press.astro`'s own `pressHeadingBreath`). They take `.ink-press` instead, which deletes six
`@supports` blocks and both keyframe sets. It waits for this stage because the press fires on the
register's trigger class and subpages fire `.is-in` — so the adoption is blocked on the very
controller collapse above. Note the tuning question that comes with it: the subpage keyframes
open at **640** where the landing's press opens at 520, and `.press-*` runs the opposite
direction (300 → 380). One of those is the site's gesture; deciding which is part of the work,
not a detail to preserve three ways.

---

## Etap 5 — the page-by-page sweep

Only after 1–4, because the sweep is a judgement about *which nodes deserve a register*, and that
judgement is worthless while the registers themselves mistime. Per page: what should gain a
register, what should lose one, what should change register. Record decisions here as they are
made, then consolidate into the guardrails when the sweep closes.

---

## Rejected — do not re-propose

**Left→right reveals on body copy.** The site already spends this gesture twice, on the two
materials where it is *literally true*: the lead register (a ruled line genuinely is drawn from
one end) and the manifest sweep (the page's one authored moment for copy). Generalising it to
every paragraph spends the manifest — the same argument the guardrails already make about the
silence motif: stating your best idea everywhere weakens the first statement of it.

The obvious objection — "a mask withholds text, which breaks rule 1" — is **not** the reason, and
should not be cited as one: the manifest's own mask sweeps full-ink → half-ink, never to
transparent, so a doctrine-compliant sweep is perfectly constructible. The reasons that do hold
are the manifest-devaluation above, and cost: a masked text layer re-rasterises every frame
(no compositor path), and the manifest can afford that for 4 nodes at 4.6 s in a way 30 nodes on
a scroll cannot.

**Line-by-line reveals.** Refused on identity, not cost. A single left→right mask over a wrapped
paragraph exposes the *end* of line 1 before the *start* of line 2, which is anti-writing — so
doing it properly needs real line boxes, which needs JS line-splitting. That breaks `lib/typo.ts`
(the build pins line breaks with nbsp), breaks selection and copy-paste, needs re-running on
resize, on font load and after every View Transition swap, and is *the* signature move of the
2024–26 premium-landing template. §5 closes with "coherence is the filter against showreel"; this
is the exact thing that line is for.

**What the instinct behind both is actually pointing at**, and where it is answered: the ink event
is low-salience, and it frequently happens off-screen. That is Etap 1 (geometry) and Etap 2
(fold the weight change into the ink so the gesture has a second dimension) — neither of which
adds a mechanism, and both of which delete a defect.

**Direction, where it is sanctioned.** Direction belongs to the *order of onsets*, not to the
inside of a glyph. `.ensemble-facts` inking its three columns left→right at ~120 ms apart is a
left-to-right reveal, costs nothing, and is the queue mechanism the page already runs. That is
the shape to reach for when a group wants direction.

---

## Accepted, documented, not defects

- **`.reveal-cue` nodes never receive `is-settled`.** `settle()` returns early for them: a cue has
  no transition of its own to strip. Their authored choreography keeps its `transition`
  declarations alive afterwards. Negligible, and stripping it would need a per-section list of
  what to strip.
- **`--rule-from` (`06-footer.css`) is declared and never set.** Left in place deliberately: both
  centre-out rules on the page (`.director-dark::after`, `.silence-rule`) are currently
  hand-rolled, and Etap 1 is the moment to route them through this slot instead.
- **The hero has no light register.** It is the only full-bleed photograph without a veil, and
  that is correct — the preloader curtain parting *is* its arrival. Stated so it is not "fixed".
- **The hero runs a different tempo from the body.** `.intro-stage` s2–s7 step ~180 ms
  start-to-start; the onset queue steps 220 ms. A threshold is crossed faster than a page is read.
  Do not unify them for consistency's sake.
