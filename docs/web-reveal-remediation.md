# Reveal remediation (`web/`) — the plan across sessions

Working plan for finishing the 2026-08 entrance-register pass. One session is not enough, so
this file is the contract between them.

Companion to `docs/web-landing-guardrails.md` §5, which states the *doctrine* (three registers,
three rules). This file is the *work*: what the doctrine does not yet describe, in what order to
fix it, and what was measured to decide that.

**How to read this file.** Etapy 0–3 are done, and so are 4a and 4b — each keeps its section,
because the measurements and the corrections inside them are the reasoning the later stages stand
on. **`Etap 4c` is the next whole thing**, and `Etap 5` after it. The stages are ordered by
dependency, not by value. `Rejected` is load-bearing: it records ideas that look right and are
not, so they are not re-proposed.

**A method note earned four times.** Etapy 1, 2, 3 and 4 each found the plan's own diagnosis
wrong once the code was measured:

- **1b** was dropped outright — two trigger lines invert neighbour ordering.
- **Etap 2**'s scope turned out to be five pages wider than written.
- **Etap 3**'s "keep the current ink curve" had been invalidated by Etap 2 itself.
- **Etap 4** claimed the subpage press was *blocked* on collapsing the two controllers. It was
  not: a register reads a moment, not a mechanism, so one selector list covering both trigger
  classes shipped the whole thing. The same paragraph filed `/press` as a tuning question when
  the page has **no `.reveal` at all** and can carry no register. Both were one grep away.

Before implementing any stage below, re-measure its claim against the source — the plan is a
record of what was true when it was written, and the later stages keep changing what the earlier
ones concluded. The recurring shape of the error is worth naming: **the plan reasons about what
things are called, and the code is decided by what things are gated on.**

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
| subpage blocks | `AboutPage` `.prose measure`, `.board-card`, `koncerty/[id]` rows — these were always in the ink register; Etap 4 only made the *other* registers reachable from them |

Checked and **correct as they are** — do not split: `.director-lede` (eyebrow + two-line h2 is one
utterance, and its paragraphs are already separate nodes), `.ensemble-lede` (same shape).

~~`.rite-quote` (the mark and its one line are a single emblem)~~ — **this clearance was wrong,
and how it was wrong is the lesson.** The judgement was editorial (is this one utterance?) where
1e's whole subject is geometric (does it fit the ink's travel?). Measured: 84 px mark + 46 px
margin + a heading that wraps to **two** lines at desktop sizes — 350 px, and the h2's top is
130 px below the node's. Fired on the mark, the inscription's top was at 102 % vh and it was 82 %
inked while still at 85 % vh, so it reached the reading zone already written. Split in Etap 3d.
When 1e's list is extended, ask the height question first and the editorial one second.

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

### The subpage half — deferred into Etap 4, and closed there as 4a

Not fixed in this pass, deliberately. **One line of the reasoning was wrong, and it inflated the
deferral:** "several breath headings there are not `.reveal` at all (`koncerty.astro` lines 176
and 284)". Both are *inside* a `.reveal` ancestor (lines 173 and 281), which the press's
descendant selector already covers — so they needed no judgement, only a class. The genuinely
trigger-less headings turned out to be three hero `<h1>`s and all of `/press`. See Etap 4a.

---

## Etap 3 — one easing per register — done 2026-08-01 (3a–3d)

The thesis is "three materials arrive differently", but the registers differed only in duration
and animated property. The differentiation was in *what* moves, not in *how* — the weaker half of
the claim.

**The plan's own prescription was wrong once more** (the third time, after 1b and Etap 2's scope).
It said `--ease-ink` should "keep the current curve". That was true when written and stopped being
true when **Etap 2 changed what the ink curve carries** — see 3c.

### The measure, and why it is this one

Read every curve by: *at what fraction of the clock is 82 % of the travel spent?* Past that point
the remainder is under the eye's threshold, so the nominal duration stops describing anything.
`--ease-slow` = `cubic-bezier(0.16, 0.84, 0.24, 1)` spends 50 % of the travel in **11 %** of the
clock and 82 % in **28 %**. Applied:

| register | nominal | 50 % at | 82 % at | travel at 82 % |
|---|---|---|---|---|
| ink `.reveal` | 0.90 s | 102 ms | 249 ms | ~100 px |
| ink press (`--wght`) | 0.90 s | 102 ms | 249 ms | ~100 px |
| light `.reveal-light` | 1.80 s | 204 ms | 499 ms | ~200 px |
| lead (already `--ease-rule`) | 0.85 s | 425 ms | 595 ms | ~238 px |

### 3a. The seam — DONE, no visual change

`--ease-ink` and `--ease-light` exist in `tokens.css` as **literal curves, not aliases of
`--ease-slow`** — an alias is a synonym, not a seam. `--ease-slow` still carries ~40 unrelated
declarations (vault, preloader, nave menu, registrum, hover states), so before this the ink could
not be retuned without moving all of them. Swapped at the five register declarations:
`landing/06-footer.css` (ink, light), `base.css` (subpage ink), `registers.css` ×2 (the press).

`base.css` is a **scope correction**: the plan filed the subpages under Etap 4, but Etap 4 is
blocked on collapsing the two *controllers* (`is-in` vs `is-visible`), not on the name of a curve.
Leaving the subpage ink on `--ease-slow` would have grown a second ink the moment 3c lands —
exactly the divergence Etap 4 exists to close.

Hover-state and ambient uses of `--ease-slow` were checked and deliberately left
(`.path-entry-title` tracking, `.ff` colophon faces, `13-spine.css`): they are not entrances.

### 3b. `--ease-light` — DONE, needs eyes

`cubic-bezier(0.6, 0.04, 0.34, 1)` — 82 % at 63 % of the clock → **1.13 s** of `--veil-lift`
(was 0.50 s). `--veil-lift` stays 1.8 s: duration and curve do not move in the same pass.

The plan's stated reason ("~80 % of its light in the first 400 ms") was roughly right and much
weaker than the two facts it missed:

- **The 0.58 multiplier.** The veil is `rgba(8, 8, 7, 0.58)`, so real scrim density went
  0.58 → **0.104** in half a second, then spent 1.3 s fading from 0.10 to 0 over a photograph.
  The tail was below threshold; the register's effective duration was ~0.5 s, making the
  *longest* register on paper the *shortest* in practice.
- **The geometry.** The veil is `inset: 0` on a section-scale host, so it fires when the
  **section's** top crosses 88 % vh. At 499 ms (~200 px of travel) the section top is at 66 % vh,
  so the photograph finished lighting with ~306 px of its 864 (`min-height: 96svh`) on screen.
  **The light register had never been watched either** — the same finding as the rules, one
  register over. Etap 0's exemption ("section-scale buys double the budget") was granted to a
  duration the register never spent.

Shape, and it is not the plan's "slow start, then flood": a plain ease-in ends at **maximum
velocity**, and a veil whose last shadow vanishes at full speed reads as a switch. The curve holds
(scrim 0.58 → 0.51 over the first 0.5 s, which costs nothing — an unlit photograph is legible, not
a hole), floods through the reading zone, then eases to nothing.

### 3c. `--ease-ink` — DONE, confirmed in the browser

`cubic-bezier(0.34, 0.62, 0.28, 1)` — 82 % at 43 % → **0.39 s** of `--ink-in` (was 0.25 s). Still
a genuine ease-out; the material still floods and then settles.

Two measurements say "keep the current curve" is no longer right:

1. **Etap 2 changed the channel.** When ink was opacity 0.44 → 1.0 alone, the front-load was
   defensible: opacity is low-acuity and the last 18 % is genuinely invisible. `.ink-press` put
   the variable-font weight axis on the same clock, and a stem width — with advance widths and
   reflow behind it — is high-acuity. Measured, a 520 → 300 press spends 82 % of its travel in
   **249 ms**. `registers.css` promises "the stroke settles into place while the ink darkens";
   what runs is a snap. Etap 2's whole deliverable is a quarter-second event.
2. **Etap 1d inverted the ink+lead pairing and did not notice**, because it compared nominal ends
   only. With the ink's `transition-delay: 0.18s`: ink 50 % at 282 ms / 82 % at **429 ms**; rule
   50 % at 425 ms / 82 % at **595 ms**. The ink passes both marks first. "Rule leads, ink follows"
   holds on the clock and is reversed on the eye. The new curve puts the ink's 82 % at 569 ms,
   just under the rule's 595 ms. **Do not fix this by lengthening the 0.18 s delay** — that moves
   the whole pair down the page instead of changing its internal order.

Blast radius is why it shipped separately: this is the one change that touches every entrance on
the site, landing and subpages alike. Confirmed in the browser — headings do not change line count
across the wider range, so the reflow risk flagged in Etap 2 did not materialise.

If the press ever needs to differ from the copy, the fallback is to give it its own timing
function on the **shared clock** — never to split the duration.

### 3d. The light register is still invisible, and the curve was not the main reason — DONE

Reported from the browser after 3b: the veil reads on the **portrait only**. On `.image-rite` the
section is simply already standing there on arrival — "wjeżdżam i już stoi" — and on `.ensemble`
and `.final-support` nothing changes at all.

**My own error to record, because it is the same error the plan keeps making:** 3b measured the
*curve* and never measured the *delta the veil actually produces*. Two independent causes, and
contrast is the dominant one.

**Cause 1 — the veil lands on ground its host has already crushed.** `rgba(8, 8, 7, 0.58)` is a
multiply by 0.42 over whatever is beneath. Taking one mid-bright photo pixel (sRGB 160) through
each host's own filter and scrim, at that section's **lightest** point:

| host | photo filter | own scrim, lightest | at rest | veiled | delta |
|---|---|---|---|---|---|
| `.portrait` | brightness 0.92 | none — `--veil-z: 3` puts the veil above the vignette | 150 | 68 | **82** |
| `.image-rite` | brightness 0.64 | 0.18 at the radial's centre | 87 | 41 | **46** |
| `.ensemble` | brightness 0.62 | 0.50 | 55 | 28 | **27** |
| `.final-support` | none | 0.78 → 0.88 | 41 → 26 | 22 → 16 | **19 → 10** |

That ranking is exactly the ranking of what is visible. The portrait is the **control**: the one
veil sitting on a near-full-brightness, unscrimmed image is the one that reads. Away from the two
radial centres the composite scrim reaches ~0.95, where the veil moves single-digit sRGB levels.
This is Etap 1f's finding one register over — a value calibrated in isolation, landing on ground
that eats it.

`.final-support` deserves the blunt conclusion: under a 0.78–0.88 gradient its photograph sits at
26–41/255 at rest. There is no visible photograph there to light, so no veil alpha rescues it —
the question is whether that section should carry a light register at all. That is an Etap 5
judgement ("what should lose a register") arriving early.

**Cause 2 — the veil's clock starts before the photograph arrives.** The trigger is 88 % vh on an
element whose top *is the section's top*. `.image-rite` is `min-height: 96svh`; after 3b the lift
is 82 % done at 1.13 s ≈ 452 px, i.e. section top at 38 % vh, while the reader "arrives" — section
filling the screen — between 1.08 s and 1.98 s after the trigger. The lift therefore finishes at
the moment of arrival rather than during it.

**The precedent is already in the code**: `setupManifestLight` runs `-26%` (trigger at 74 % vh)
and its comment records *"wjeżdżam i już stoi" was the 85 % defect*. The register observer sits at
**88 %** — earlier than the value already rejected once. 88 % is right for a short node (a
paragraph at 88 % vh is genuinely at the bottom edge) and wrong for the tallest nodes on the page,
which is what every light node is.

Etap 1b forbids giving the light register its **own trigger line** — that inverts neighbour
ordering and is a correctness requirement. A `transition-delay` is not a trigger line: onset order
is untouched, only the veil's own clock starts later. So the fix shape is a per-host
`--veil-delay` (default 0 s, so the portrait — which works — is not touched), not an observer
change.

**Blocker on that fix, and an undocumented ceiling worth knowing anyway:** `settle()` carries a
**2400 ms fallback timer** that adds `is-settled`, which strips the transition. The light register
is 1800 ms, so the margin is 600 ms — a 0.6 s veil delay lands exactly on the timer and the veil
would snap mid-lift. That timer is a hard ceiling on every register choreography and is written
down nowhere. (`.reveal-cue` nodes are exempt: `settle()` returns early, which is why the coda's
2.6 s caption is unaffected.)

**What was built, and what was deliberately not.**

- **`--veil-delay`, authored per host** (`landing/06-footer.css`, folded into the veil's existing
  shorthand). 0.6 s on `.image-rite`, `.ensemble` and `.final-support-media`; **`.portrait` keeps
  0 s** — it is the one host smaller than the screen, it arrives with its image, and it is the one
  that already reads. A delay is explicitly *not* a second trigger line: onset order between
  neighbours is untouched, which is what Etap 1b's rejection was protecting.
- **`settle()`'s fallback 2400 ms → `SETTLE_FALLBACK_MS` 3400 ms** (`scripts/landing.ts`). The
  old value left 600 ms of headroom over the 1800 ms veil, so a 0.6 s delay would have landed on
  the timer and snapped the veil mid-lift. Now named and commented as what it is: a hard ceiling
  on every register choreography, because `is-settled` strips the transition.
- **The veil alphas were NOT raised, and that reverses the recommendation made when 3d was
  filed.** Working it through: to clear threshold on `.ensemble` the veil would need ~0.78, which
  leaves the photograph at 18/255 — that breaks rule 1 ("never blank, only unlit") to fix a
  register whose whole promise is rule 1. The honest reading is that the doctrine's promise is
  *already* spent on these hosts by their own scrims, not by the veil. Timing was the lever that
  could be pulled without lying: a 27-level delta that plays while you are looking at it is far
  more perceptible than the same delta finishing before you arrive, because change detection is
  much more sensitive than absolute level. Whether the register is viable at all on a 0.78–0.88
  scrimmed section is an **Etap 5** question about that section's design, not about the register.

**The rite's text — the developer's own hypothesis, and it was right.** Not a section-level bug:
`.rite-quote` was a single 350 px register node, so it fired on the mark and its heading was
below the fold. See the correction folded into Etap 1e's list. Split into two nodes (mark, h2),
which the shared onset queue paces so the emblem still reads as one gesture.

**Found while measuring it: `VoxMoment` had no entrance at all** — no `.reveal` anywhere in the
island, the same omission the landing footer had before Etap 1e, and in the section that is the
heart of movement II. `.vox-eyebrow` and `.vox-line` now take ink. The player is deliberately
excluded: it carries a `veiled` state of its own, and a light register over it would be two veils
on one node. Both classNames are constant strings and the island's first client render matches
the server's, which are the two conditions the footer failed.

### Adjacent, fixed in the same pass

`--wght-press` / `--wght-rest` were **never declared** — they existed only as `var(…, 520)` /
`var(…, 300)` fallbacks in `registers.css`, while this plan and the guardrails both called them
"one token" and two other stylesheets pointed at `registers.css` as their home. Now real tokens in
`tokens.css`, fallbacks dropped (a fallback on a declared token hides a missing-token bug), and
the three referring comments corrected.

Also noted, not acted on: **`--ease-slow` is declared twice** — `tokens.css` and
`landing/01-foundation.css`, both on `:root`, identical values. Same shape as the `--sans`
landmine. Benign today; the new tokens live in `tokens.css` only.

---

## Etap 4 — lift the registers out of the landing bundle

Split into three on measurement. **4a and 4b are done; 4c is the open one** and is a bigger,
different thing than the paragraph that used to stand here assumed.

### The dependency the plan asserted, which does not exist

The plan said the subpage press "is blocked on the very controller collapse above". It is not. A
register reads a **moment**, not a mechanism: `registers.css`'s trigger rule lists both classes
(`.is-visible` for the landing's queue, `.is-in` for `BaseLayout`'s observer) and fires on
whichever arrives. Specificity was the only thing to check, and it lands right —
`html.voct-motion .reveal.ink-press` (0,3,1) out-specifies `base.css`'s
`html.reveal-ready .reveal` (0,2,0) for the transition longhands, while `base.css` keeps sole
ownership of `transition-delay`, so each subpage's authored `data-d` cadence survives untouched.

### 4a. The ink press on the subpages — DONE 2026-08-01

Six `@supports` blocks and both keyframe sets deleted; `.ink-press` authored on 22 headings
across `/koncerty`, `/koncerty/[id]`, `/o-nas`, `/kolofon`, `/kontakt`.

**The press shipped at 520 and was raised to 600 the same day; the correction is the interesting
part.** All six heading sets already declare `font-weight: 300` = `--wght-rest`, so only the
*origin* was ever in question:

| | travel | clock | rate |
|---|---|---|---|
| subpage keyframes as they ran | 640 → 300 = 340 | `entry 0% cover 55%` = 0.55·(vh+h) ≈ 550 px ≈ **1.38 s** | 247 u/s |
| landing press, as shipped in 4a | 520 → 300 = 220 | `--ink-in` 0.9 s | 244 u/s |
| **600, the value that stuck** | 300 | 0.9 s | 333 u/s |

The argument for keeping the landing's 520 was that the two rates agree to within 3 u/s — one
gesture at one tempo, which the subpages were already running. **Watched, it was invisible**, and
the rate argument turns out to be circular: the landing's 244 u/s is itself derived from 520, so
it cannot be evidence that 520 is right. The non-circular half was only ever the reflow risk, and
that is a *ceiling* argument, not a *value* argument.

What the measurement should have been:

- **The press shares its clock with an opacity ramp from 0.44 to 1.**  A 2.3× change in lightness
  is a far louder channel than ~25 % of a weight axis, so the two compete rather than compound.
  Amplitude therefore buys less than the arithmetic suggests, which is exactly why a value chosen
  by arithmetic read as nothing.
- **The site already speaks heavier than 520 at its loudest moments** — the footer wordmark pulses
  to 580 (`06-footer.css`), the hero's emphasis opens at 620 (`landing.ts`). 520 was not the safe
  number, it was the timid one, sitting under everything else the design does with this axis.

600, and **the clock did not move with it.** A faster press is a shorter exposure, and change
detection needs dwell time — speeding it up works against the thing being fixed. If 600 still
under-reads, the next lever is a timing function of the press's own on the shared clock, which
`--ease-ink` makes available: it spends 82 % of the travel in 0.39 s of the 0.9 s, so more than
half the clock currently carries almost nothing. That is sanctioned (Etap 3c) in a way that
splitting the duration is not. What is *not* available is a heavier origin: past ~620 the press
would open outside the range the design ever rests in.

**`/press` keeps no press, and its keyframes were deleted rather than adopted.** Two findings,
either one sufficient:

1. **It has zero `.reveal` nodes** — the whole page, measured. No trigger class ever reaches it,
   so a press there freezes on the pressed weight forever. This is not a tuning question; it is
   not answerable in CSS at all.
2. **`pressHeadingBreath` was a defect, not a third opinion about the gesture.** It ended at
   **380** while `.press-hero-title`, `.press-section-head h2` and `.press-booking-title` all
   declare `font-weight: 300`. So the page rested on a weight its own stylesheet never named —
   and only for visitors with JS, motion *and* scroll-driven-animation support; everyone else got
   300. That is `registers.css`'s stated constraint 1, violated in the code that the constraint
   was written next to.

Whether `/press` should join the register system at all is an **Etap 5** question about the page.

**Two constraints found while wiring it, both silent when broken.**

- A press that is a **child** of its register node now inherits `--reveal-delay`. Without it a
  heading inside a `data-d` block would start its stroke up to 0.36 s before the ink around it —
  the pair reading as two events. `--reveal-delay` is unregistered, so it inherits; the landing
  sets no `data-d` at all, so its fallback is what runs there.
- **`vt-nav` composure reached the register node only.** `base.css` strips the transition of
  every above-the-fold `.reveal` during a ClientRouter swap so the incoming page is snapshotted
  already written — but a press *inside* one would have played its stroke while the ink beside it
  snapped. `registers.css` now carries the matching override, last in the file because it ties
  the other press rules at (0,3,1).

**Deliberately not covered:** the three bare hero `<h1>`s (`/o-nas`, `/kontakt`, `/koncerty`).
Their `.reveal`s sit on inner `<span>`s — *below* the heading — and the press reads triggers from
itself or an ancestor. Etap 5's call.

### 4b. Lead and light out of the landing bundle — DONE 2026-08-01

`.reveal-rule` / `-v` and `.reveal-light` move to `styles/registers.css` with both trigger
classes, which is what makes the plan's own stated goal (the lead register on `/koncerty`'s entry
rules, the light on `/o-nas`'s portrait) possible at all — you cannot adopt a register that lives
in another page's bundle. Two guardrails learned on the landing were written into the mechanism's
own comments, because they travel with it: anchor a lead rule to the **top** of its element
(Etap 1a), and measure a veil's **real delta against its host's ground** before granting the
light register (Etap 3d).

### The ink register did NOT move, and this is the finding

The two ink definitions differ in their **gate**, not their class name — and the plan only ever
looked at the class name.

| | hidden state | un-gated by | trigger |
|---|---|---|---|
| landing | bare `.reveal` | `index.astro`, `html:not(.voct-motion) .voct-landing …` | `.is-visible` |
| every other page | `html.reveal-ready .reveal` | `base.css`, `html:not(.voct-motion) .reveal` | `.is-in` |

`reveal-ready` is the same class that **starts `BaseLayout`'s observer**, and the landing sets
`reveal={false}` precisely to keep that observer off its nodes. So there are only two ways to
merge the gate, and both are controller decisions:

- give the landing `reveal-ready` → `BaseLayout`'s observer runs on landing nodes *alongside*
  `landing.ts`'s queue, and whichever reaches a node first sets its cadence. The landing's
  authored 220 ms unison is gone.
- drop the gate to a bare `.reveal` → any future page with `reveal={false}` hides its copy at
  half-ink with nothing left to reveal it. Silent, and permanent.

Hence 4c below. Both definitions now carry a comment saying what they are waiting on, so the
duplicate cannot be rediscovered as an oversight.

### The cascade measurement 4b actually turned on

`base.css` already records this class of bug biting once, with the note that **dev did not show
it** (Vite injects in import order; Rollup does not). Measured from `dist/` rather than assumed:

```
/          VaultIsland.css [tokens + registers] → index.css [landing] → base.css
subpages   VaultIsland.css [tokens + registers] → base.css → vault.css → page.css
```

`registers.css` is emitted **first on every page**. So every rule moved into it lost every
equal-specificity tie it used to win, and the moved rules are written to win on **specificity**
instead. The one that matters: the ink+lead pairing at (0,3,0) beats `base.css`'s `data-d` offset
at (0,2,0) — which is also the right order of authority, since a stagger between siblings is
decoration and rule-then-ink is the gesture. **Verify any further move against the emitted CSS,
never against the dev server.**

### 4c — one controller — OPEN, and it is not a lift

`BaseLayout.astro`'s observer runs `{ rootMargin: "0px 0px -8% 0px", threshold: 0.1 }`;
`landing.ts` runs `-12%` with a shared 220 ms onset queue and a `settle()` state machine.

The ratio threshold is a real defect and worth the measurement: a node fires when
`top = 0.92·vh − 0.1·h`, so on a 900 px viewport a 40 px node fires at 91.6 % vh and an 800 px
node at 83 % vh — **node size sets the tempo**, which is the thing `landing.ts` was written to
avoid. (Latent, not yet reachable: a `.reveal` taller than ~8280 px could never reach ratio 0.1
and would never fire at all.)

But "one controller" also means one delay policy, and `data-d` covers about half the nodes:

| page | `.reveal` | `data-d` |
|---|---|---|
| `koncerty/[id].astro` | 40 | 20 |
| `koncerty.astro` | 29 | 13 |
| `AboutPage.astro` | 29 | 18 |
| `kolofon.astro` | 22 | 14 |
| `kontakt.astro` | 15 | 7 |

`data-d` tops out at 0.36 s in 90 ms steps against the queue's 220 ms. So the collapse is a
**retune of five pages' cadence and a decision about 94 authored attributes**, plus the gate
choice above. That is Etap 5's kind of judgement, not Etap 4's kind of move, and it may well
belong *after* the sweep decides which nodes deserve a register at all.

Also waiting on nothing in particular, and cheap once 4c lands: `.is-visible` is shared with
three unrelated React components (`.scroll-top`, `.movement-spine`, `.gratitude`/`.failure`),
while `.is-in` collides with nothing. If a single name is chosen, that is the argument.

---

## Etap 5 — the page-by-page sweep

Only after 1–4, because the sweep is a judgement about *which nodes deserve a register*, and that
judgement is worthless while the registers themselves mistime. Per page: what should gain a
register, what should lose one, what should change register. Record decisions here as they are
made, then consolidate into the guardrails when the sweep closes.

Questions already banked for it, each arrived at by measuring something else:

| question | where it came from |
|---|---|
| **Should `/press` join the register system at all?** It has zero `.reveal` nodes, so it speaks none of the site's entrance language. Its heading breath was deleted in 4a rather than converted. | Etap 4a |
| **Should `.final-support` carry a light register?** Under its own 0.78–0.88 gradient the photograph sits at 26–41/255 at rest; there is no visible image there to light, and no veil alpha rescues it without breaking "never blank, only unlit". | Etap 3d |
| **Do the three bare hero `<h1>`s want a press?** `/o-nas`, `/kontakt`, `/koncerty` — their `.reveal`s are on inner `<span>`s, below the heading, so a press needs the reveals restructured, not just a class. | Etap 4a |
| **The tall-node splits**, carried from 1e: `.final-lede`, `.bank-card`, `.donation-rows`, and the subpage blocks (`AboutPage` `.prose measure`, `.board-card`, `koncerty/[id]` rows) now that they are in the register system. | Etap 1e |
| **Should `/koncerty`'s entry rules take the lead register, and `/o-nas`'s portrait the light?** Possible since 4b; whether they *should* is this sweep's call. | Etap 4b |

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
