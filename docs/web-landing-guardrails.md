# Landing (`web/`) — settled decisions and landmines

Record of what has already been tried, decided or rejected on the public site, so it is not
re-proposed. Companion to `.ai/07_marketing_public_site.md` (rules) — this file is the
*negative* space: the things that look like good ideas and are not.

Last consolidated: 2026-07-30.

---

## 1. Copy — the tells that were removed, and must not creep back

The landing's form was always authored; its **language** was the part that read as generated.
Two sweeps (2026-07-12, 2026-07-29) removed six measurable tics. Counts are the "after" state.

| Tic | Rule now |
|---|---|
| Em-dash as the all-purpose pause | Was in 11 of 12 paragraphs. Now 3 deliberate uses only: two inside the quoted founding text (Florent's voice), one in the VoxMoment reprise. Reach for a full stop, colon or semicolon first. |
| `od X po Y` range frame | Was 9×. Two homes left: the hero pitch, and the Isaiah→Simeon arc in the *Wcielenie* note. Anywhere else, list proper names instead. |
| `wybrzmienie` as a noun for "concert" | Was 8×. One home left: the verb in the CTA "Pomóż mu wybrzmieć". It is a nominalisation; used as a label it reads as translated Polish. |
| `nie X — Y` (apophasis) | Exactly one on the whole site: the manifest's "Sacrum nie zdobi. / Odsłania." Everything else states positives. |
| The silence motif | It is the page's best idea and was stated six times. The form already enacts it (`tacet.`, the coda fermata). Adding a seventh sentence about silence weakens the first six. |
| Headings as short declaratives + period | 9 of 10 were "abstract noun + verb + full stop". That cadence *is* the premium-AI-landing signature. At least a couple of headings should be names, numerals or fragments — the reason DirectorSection reads most human is that its h2 is simply "Florent de Bazelaire". |

**The meta-rule that generates most of the above:** a model explains its own metaphor in the next
sentence; an editor states it and stops. The deleted ImageRite paragraph ("światło ma własną
reżyserię… bo nawa jest tu instrumentem") was the clearest case — the photograph already showed
the beam, the nave and the listeners.

### Content that is deliberately absent

- **Florent's personal biography** (Warsaw, studies, Jesuit years) — stays out until he supplies
  an authorised biogram. Never publish unconfirmed life details.
- **Collaborator names** — consent first.
- **Donation amounts mapped to line items** — the tiers stay qualitative. Publishing anything
  implying musician rates was ruled out and is not a copy problem to "fix".
- **A future date.** As of 2026-07 nothing is scheduled. The register's open card states the two
  real preconditions (a host, and fees for the singers) rather than implying a date exists.
- **The Bobola Mass** — real and already sung, but a liturgy, not a Koncert Duchowy. Putting it in
  the register would falsify the roman numbering. It belongs on `/koncerty`.

---

## 2. Landmines — verified, do not re-propose

**`SilenceMoment` never takes the scroll.** An enforced ~2.8s scroll-lock was built and then
deleted: on touch (and in DevTools device emulation, where `pointer` can still report `fine`) a
page that ignores a swipe reads as broken. `scripts/landing.ts` says `no scroll-lock, ever`. The
pause is spatial — section height and reveal timing. General principle: a musical rest is measured
time, but on a page the reader holds the clock, so the only honest rest is space.

**`BrandGlyph` is a masked PNG, not SVG.** Any stroke-draw, morph or path animation of the mark is
impossible until a real vector logo exists. Fade and scale are the only options today, and neither
is worth doing. Do not generate a *new* logo variant as a workaround: the mark is already
consistent across chrome, threshold, vault and modals, and two almost-identical marks read worse
than one static one.

**`transitions.css` — never animate the incoming layer.** The model is "turned leaf": the outgoing
page drifts and dissolves on top, the incoming is drawn fully opaque underneath the whole time.
Sliding the new layer in from an offset uncovers a strip of `#080807` bedrock along one edge —
a dark band flashing across the parchment pages. Both paths (native `::view-transition` *and* the
attribute-driven `data-astro-transition-fallback`) must always be choreographed together, or the
"mobile menu doesn't fade" bug returns.

**A page can never arm its own `<html>` gate.** Astro's swap strips every attribute off `<html>`
and copies the incoming document's, so JS-set classes (`reveal-ready`, `voct-motion`,
`preloader-skip`) are dropped on every navigation — and the arriving page's inline scripts cannot
restore them in time: a `<script>` parsed by `DOMParser` is flagged already-started and does not
execute on insertion, so Astro re-runs it in `runScripts()`, *after* the view transition has begun.
`data-astro-rerun` is therefore a trap for anything pre-paint: the new page paints with its content
visible, the gate lands mid-dissolve, the hidden state engages **with its transition**, and the
reveal observer has to bring the text back — text appears, blinks out, replays, hitting a different
subset of elements each navigation. This was live for `reveal-ready`, `voct-motion` and
`preloader-skip` at once, which is why it read as several processes racing. The fix, and the only
shape that works: the **outgoing** document arms the incoming one — `DocumentGates.astro` decides
from `<html data-reveal>` / `<html data-rite>` and applies the classes to `event.newDocument` in
`astro:before-swap`, before the swap copies its attributes. Anything else on `<html>` that CSS keys
a hidden state on must go through that one place. Corollary: `astro:after-swap` is the only moment
where the incoming DOM has real layout *and* the new snapshot is not taken yet, so measured work
(settling above-the-fold reveals) belongs there and nowhere else — and it must skip zero-box nodes,
or reveals inside a closed `<details>` (the `/koncerty` programme rows) report top 0, get settled,
and lose their cascade.

**The parallax controller's first run always MOVES the layer.** A `[data-parallax]` layer rests at
its CSS position (`.bleed` is `top: -10%`) but its settled position is another `cap` px above that,
so the first `applyParallax()` shifts every hero photo. Placement therefore has to be part of a
page's first painted state, never a correction to it: it runs at module time and in
`astro:after-swap` (before the new snapshot). Hanging it on `astro:page-load` alone — which is the
window `load` event on a cold start, and post-snapshot on a navigation — is what made the hero
visibly jump mid-transition. Same rule for anything else that positions a layer from JS.

**A hero photo is not painted when the transition starts.** The incoming page is drawn opaque
underneath the dissolving old one, so an unloaded photo is what the visitor looks at for the whole
420ms. Two defences, both needed: `.bleed` carries `background-color: #080807` (the transition's own
bedrock, so a gap reads as the site's ground and never as the parchment body — that was the white
flash), and BaseLayout holds the swap up to `HERO_WARM_MS` while a hidden clone of the incoming
`picture.bleed` warms the cache. Clone rather than hand-build a preload: `<source media>` is art
direction and `<source type>` is format negotiation, and both resolve against a real viewport that
the DOMParser'd document does not have.

**`transition:persist` emits no `view-transition-name`.** Only `transition:name`/`animate` do, so
`::view-transition-group(site-cursor)` and `(scroll-top)` never matched anything — the persisted
islands ride inside the root snapshot and a faint copy drifts off with the outgoing page. Do not
"fix" it by naming them: the cursor is drawn with `mix-blend-mode: difference`, which a named group
stops compositing against the page (the same trap `registrum.css` hit with `backdrop-filter`). If
the ghost ever becomes visible enough to matter, hide those elements on
`astro:before-preparation` — the last event before the old snapshot is taken.

**Any delegated link handler on `document` MUST capture.** ClientRouter's own click handler is a
*bubbling* `document` listener registered from `<head>`, i.e. ahead of every script Astro emits into
the body — so a bubbling listener of ours reaches the anchor **second**, after the router has
already `preventDefault`ed it and started navigating. Our `preventDefault` then lands on a consumed
event and the handler's own `navigate()` becomes a *second* navigation into a live one: the router
aborts the first, `skipTransition()`s its View Transition, and re-fetches and re-swaps the same page.
Which of three failures the visitor sees — no transition at all, the new page jumping, or a stall of
a whole beat plus a hero warm — only depends on which frame the second call lands in, which is why
it read as intermittent. Field-hit twice: `SiteChrome.astro`'s registrum ribbons and mobile "Vitta"
voices (every subpage; the landing's React header was immune because React binds on the island root,
below `document`), and `landing.ts`'s Lenis anchors, where the router quietly took every `#hash`
click — native jump with no `ANCHOR_OFFSET`, so the fixed bar covered the target, plus a junk
history entry per click. Capture-phase is the contract (`scripts/vault-triggers.ts` had it right);
branches that navigate should still honour `defaultPrevented` so capturing listeners can coexist.
Related: a link to the **current** URL is still a full navigation to Astro — an in-menu row for the
page you are already on has to `preventDefault` and dismiss, or the whole document re-swaps under
the card and the reader is thrown back to the top of the page they were reading.

**Leaving a page from inside an overlay must SPEND the overlay's history entry.** The nav card /
vault / lightbox each push a hash-marked entry on open so the mobile back button dismisses them
(`lib/overlayHistory.ts`). Navigating away with a plain `navigate()` stacks the destination on top
of that entry, so the first back press lands on the shadow — same page, hash only — where the
router's same-page hash path runs and nothing visible happens. The press is simply eaten. The exit
therefore goes through `navigateFromOverlay`, which uses `history: "replace"`. Two things that owes
compensation, both inside that helper, and both silent if forgotten: Astro copies the *current*
entry's stored scroll onto a replaced entry (a push zeroes it), so a later back→forward would
restore the previous page's offset; and **Plausible hooks `pushState`, never `replaceState`** — the
navigation is invisible to analytics unless `plausible("pageview")` is called by hand. On a
mobile-first site that is most of the traffic, so any future switch from push to replace anywhere
has to carry the same two lines with it.

**Movement inscriptions must stay short (~13 characters).** `13-spine.css` hides the spine label
below 1440px because the gutter is narrow; a longer inscription pushes that breakpoint up until
the label effectively never shows. This is why `Lumen quaerit` → `Lumen Christi` and not
`Lumen ad revelationem`.

**`Vox memoriae` and `Sustinete nos` stay.** Both are grammatical. `Sustinete nos` is site-wide nav
vocabulary (`SiteChrome.astro`, `StickyHeader.tsx`), and `Vox` anchors `data-movement="vox"` plus
the VoxMoment eyebrow. Only movement I was actually broken Latin (a verb with no subject).

**`.primary-link` / `.secondary-link` are identical *by design* in the hero** — two parallel
invitations, not a hierarchy. The one place they are a real hierarchy is `.final-actions`, which
has its own candle-gold rule. Do not "fix" the hero to match.

**`public/polityka-prywatnosci.html` is outside the Astro pipeline.** It carries its own
`@font-face`, preloads and tokens. Any font or asset change must touch it by hand — deleting the
old font files without it silently drops that page to a system font.

**`--sans` is declared in two files**: `styles/tokens.css` and `styles/landing/01-foundation.css`.
Changing one leaves the landing on the old face.

**WebGL hero: abandoned.** Do not re-pitch.

---

## 3. Micro-typography

Polish one-letter prepositions (`a i o u w z`, `we`, `ze`) must never end a line, and it is most
visible at display sizes. Two mechanisms, per `lib/typo.ts`:

- **Data strings** (YAML, `paths.ts`, tile labels, donation rows) → wrap at render: `{nbsp(value)}`.
- **Hand-written markup** → `&nbsp;` entity directly in the template.

Do not embed a literal U+00A0 in source; formatters eat it.

**Verification gotcha:** in Python, `\s` matches U+00A0, so a naive orphan-check regex reports the
*fixed* text as still broken. Match an explicit ordinary space (`[ \n\t]`) when auditing `dist/`.

The vault and the donation terms (`Regulamin`) are the one surface not yet swept — mostly legal
fine print, where orphan control matters least.

---

## 4. Open — worth doing next

- **Logo as SVG.** Unlocks a once-per-session draw-in of the mark in the preloader threshold,
  using the existing `.knot-draw` mechanism. Waiting on the file.
- **Coda caption.** A fermata over a whole rest already instructs "hold the silence"; the caption
  "Cisza brzmi dalej." restates it in words and is the fourth statement of the motif. Ending on the
  sign alone is the stronger close. Flagged in `CodaSection.astro`, awaiting a decision.
- **Vault + Regulamin copy** — has its own untouched series of negations ("Bez pośredników, bez
  zakładania konta.", "Bez prowizji.").
- **Open the first register entry by default.** The expanded programme is the best-designed thing
  on the page and it is hidden behind an 11px accordion label. Not done blind because
  `scripts/landing.ts` replaces the native `<details>` with an exclusive animated accordion.
- **IBM Plex Sans line-height pass.** Plex has different metrics from Inter; body copy density
  across all 13 pages wants a human look before it is called finished.

---

## 5. The motion language

The site has exactly two motion idioms: **ink being drawn** (`.knot-draw` — interludes, coda,
finalis, register rules) and **light passing** (gilding sweep, rite spotlight, manifest edge).
Anything added in one of those two will look native at any strength; anything outside them will
look bolted on however subtle it is. Coherence is the filter against showreel, not restraint —
which is why a strong page-turn is fine and a tasteful generic fade-up would not have been.
