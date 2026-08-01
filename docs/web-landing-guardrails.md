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
pause is spatial — section height. General principle: a musical rest is measured time, but on a
page the reader holds the clock, so the only honest rest is space.

*Second landmine in the same section, fixed 2026-08-01:* what replaced the lock was a controller
that added `is-listening` **and** `is-settled` in one call at bind time. Both resolved to their
resting opacities immediately, so the 1.6s entrance played while the visitor was still six screens
up in the hero, and `tacet.` was simply already there on arrival — the page's best idea, spent off
screen. Two comments meanwhile described a mechanism that did not exist (`.reveal` nodes driving
it; the component had none). The section is a `.reveal-cue` now. **Anything whose whole point is a
moment must be triggered by arrival, not by bind** — and if a comment claims an observer drives
something, grep for the class before trusting it.

**The mark is a filled outline (`public/voct-mark.svg`), not centerline strokes — and a
centerline wireframe of the V is a DIFFERENT OBJECT.** A real vector exists since 2026-07
(the preloader rite masks it), but neither draw technique
survives contact with the letterform: tracing the outline path draws both edges of every hairline
like a plotter, and a hand-authored uniform-stroke skeleton of the full glyph was built, rendered
and rejected on sight — floating serifs, curlicue arm hooks, and the V-plus-stem gestalt reads as
a downward arrow / sigil, because the letter's identity lives in stroke modulation that a
wireframe cannot carry. The only parts that may be *drawn* are the parts that truly are lines:
the stem (a 13-unit rect) and the note ellipse, at their exact coordinates (inline SVG in
`Preloader.tsx`, same viewBox so the layers register). The V appears exclusively as the masked
fill, revealed by the rising light.

**The mark ships as two masters split by optical size, and the vector is NOT the one to reach
for at icon sizes.** `public/logo-mark.png` (186×456) masks everything below ~110px tall —
chrome brand-mark, `.brand-glyph`, `.brand-glyph-shape` (threshold / vault / gratitude /
failure / QR), nave colophon, station glyphs, concert prologue. `public/voct-mark.svg` masks
only what is bigger: the two 80×220 gold glyphs (`.coda-glyph`, `.cta-glyph`) and the
preloader rite. The reason is arithmetic, not taste: the V is calligraphic, and its thin right
arm measures ~11 of the 1000 viewBox units across, so at the 17×40 chrome footprint (scale
0.016) it is **0.19 CSS px** — the stem rect is 0.21px, the thick left arm 0.79px. Below one
device pixel the arm exists only as partial coverage, and a mask rasterised live re-resolves
on every repaint at whatever subpixel offset the layer lands on, so the arm blinks in and out
while scrolling (verified in Chrome, desktop, 2026-07-31). A raster master resolves once and
holds. Do not "fix" this by putting a `vector-effect="non-scaling-stroke"` floor on the paths:
a constant 1px ribbon rescues the 40px case but doubles the thin arm at 220px, flattening the
stroke modulation exactly where it is the point. If the mark is ever redrawn, BOTH masters
must be re-exported from the same source.

**Nothing outside React may hold a class on an island that does not hydrate cleanly.** The
landing footer's reveals were applied correctly and never appeared: `useLiturgicalClock` takes its
initial state during *render*, and on a statically built site that means the server HTML carries
the build-time clock while the client renders `now` — a guaranteed hydration mismatch on every
visit. React does not merely warn at that; it discards the server DOM for the island and
re-renders, so the shared IntersectionObserver was left holding elements that were no longer in
the document, and every class it set landed on a detached node. Nothing looked broken: the footer
simply sat at half-ink forever. The fix is `suppressHydrationWarning` on each clock-derived text
node plus a fresh snapshot on mount (so the kept build-time text is corrected within a frame, and
a no-JS visitor still gets a rendered clock face instead of the blank one a null initial state
would leave). Before putting `.reveal` — or any externally-driven class — on an island, check that
it renders the same thing on the server and on the first client pass. Two conditions, both
required: the `className` prop must be a **constant string** (React writes the attribute only when
the value changes, so a constant survives re-renders), and the island must **hydrate clean**.

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
`preloader-skip` at once, which is why it read as several processes racing. (`rite-brief` — the
remembered-choice cadence-only rite — is a fourth class under the same contract.) The fix, and the only
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

**A curtain must not part onto an unpainted hero either.** Same defect, cold-start flavour: the
preloader's brief rite (remembered choice) resolves on a fixed timeline and deliberately does not
wait for `load`, so on a cold cache it used to lift onto `#080807` and then snap the photo in.
`Preloader.tsx` therefore awaits `picture.bleed img`.decode() before parting, capped at 900ms —
and `BleedImage.astro` fades in any photo that was **still in flight** when its script ran. That
one-directional rule is load-bearing: an image that is already complete is never touched, because
hiding a painted hero for even a frame mid-navigation is the flash everything above went to
remove. Note that `astro dev` generates every optimized variant on demand (Sharp, per request),
so a first-load hero is seconds late there and only `npm run preview` shows the real timing.

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

**`--sans` and `--ease-slow` are each declared in two files**: `styles/tokens.css` and
`styles/landing/01-foundation.css`, both on `:root` with identical values, so which one wins is
bundle order. Changing one leaves the landing on the old face / the old curve. The register
easings (`--ease-ink`, `--ease-rule`, `--ease-light`) are deliberately in `tokens.css` **only** —
do not mirror them into the landing sheet for symmetry.

**Before putting `.reveal` on an element, check whether that element already declares a
`transition`.** There is exactly one `transition-property` slot per element, so the register does
not add to what is there — it **replaces** it, and the element's own hover or state transitions
stop easing and start snapping. Nothing errors; nothing looks wrong until someone hovers. This is
how `.path-entry-title` lost its weight-and-tracking hover for a month: Etap 1e moved the ink
onto it for a *geometric* reason (a tall node must be split so its parts arrive where the eye is)
and never asked the second question. `.rep-col li.rep-row` on `/koncerty` survived the same move
only by accident, because its selector happened to out-specify the register. When it comes up,
restate the element's list together with the ink's, using the register's tokens, at a specificity
clearing both the register and `.is-settled` — a node with a live hover transition is entitled to
keep one after its entrance is spent.

**A register can never be added with a bare `transition` declaration, and `@property` must be
registered exactly once.** Both were live at the same time and both fail silently. `transition`
is a *shorthand*: a node that carries two register dimensions (`.section-title` is the ink node
*and* the press node) gets the second declaration REPLACING the first, so the heading snaps to
full ink instead of inking — nothing errors, the page just loses a gesture. Declare the pair as
longhands (`transition-property: opacity, --wght` …), which also leaves `transition-delay` alone
so an ink+lead node keeps its 0.18 s. Two corollaries, both found the same day: a new register
rule almost always out-specifies the `.is-settled { transition: none }` releases (0,2,0), so it
must ship its own settled override or the transition never releases; and anything the register
hides or offsets must be declared **inside**
`html.voct-motion`, because `index.astro`'s no-motion gate neutralises `opacity` and `transform`
and nothing else — a weight, a mask position or a clip declared outside it strands every node at
its start value for a no-JS visitor. Separately, `--wght` was registered twice with different
`inherits` and `initial-value` (`tokens.css` and `landing/09-kinetic.css`), which made the
effective descriptors a function of bundle order; one registration, in the shared sheet, and
`inherits: false` is only safe while every reader sets the property on the element that reads it.

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

## 5. The motion language — three registers

Rewritten 2026-08-01, because the previous version of this section ("exactly two idioms: ink
being drawn and light passing") was *prescriptively* right and *descriptively* false. It did not
account for the Ken Burns drift, the parallax, the variable-font breath or the interlude flames —
none of which are ink or light — and, more damagingly, it did not account for the thing that was
actually carrying **26 of the landing's 30 entrances**: a generic `translateY(42px) scale(0.985)`
fade-up. The authored moments (manifest sweep, knot draw, coda score) were islands in it.

The site has **three materials**, and each one arrives in its own way. Every entrance belongs to
exactly one register. All of it lives in `styles/registers.css`, which `BaseLayout` loads on
every page, and is fired by one controller, `scripts/reveal.ts`, which the landing and
`BaseLayout` both call. **One trigger class, `.is-in`** — `.is-visible` is a different thing
entirely (React islands with their own visibility state) and must never be read as a register
trigger. The one page-level choice is the CADENCE: the landing passes `queue`, because its
siblings are generated in bulk and would otherwise enter in unison; every other page passes
`authored`, because it staggers its own nodes with `data-d` and a queue on top would delay them
twice.

| Register | Class | Material | Behaviour |
|---|---|---|---|
| **Ink** | `.reveal` | copy, headings | half-ink → full ink, **in place** |
| **Lead** | `.reveal-rule`, `-v` | hairlines the design already has | ruled left→right / top→down |
| **Light** | `.reveal-light` | photography | a veil of the section's own dark lifts |
| *(cue)* | `.reveal-cue` | — | no appearance; triggers authored choreography |

Ink has a **second dimension**, opt-in per element and not a fourth register: `.ink-press`
(`styles/registers.css`) travels the variable-font weight axis 600 → 300 on the ink's own clock,
so a heading's stroke settles as its ink darkens — a nib, which is what a heading is written
with. It never fires alone and never lands on body copy. Its one hard constraint: the element's
`font-weight` must equal `--wght-rest` (`styles/tokens.css`, with `--wght-press`), because under
motion the axis overrides `font-weight` outright and any gap between them is invisible until
motion is turned off. `/press` broke exactly that rule for months — its own keyframes ended at
380 while every rule declared 300 — which is how the constraint earned its place here. Note what
sharing the ink's clock implies: the press put a **high-acuity** channel (stem width, advance
widths, reflow) on a curve chosen for a low-acuity one (opacity from 0.44). That is what
`--ease-ink` is for.

**A register needs a trigger, and a page that runs no reveals cannot be given one by CSS.**
`.ink-press` and the two other registers all read a trigger class an observer puts on the node
or an ancestor. A page with no `.reveal` anywhere — `/press` today — would strand a press on its
opening weight forever. Check the page has a controller before authoring a register onto it.

Plus one **ambient** layer that is not an entrance at all and is governed by nothing here: Ken
Burns, parallax, the flames' breathing, the knot's audio/scroll intensity, the footer clock's
9 s presence pulse, and the hero's weight breath. That last one is the only weight on the page
still scrubbed against scroll, and deliberately so — it is keyed to the *threshold*, a moment the
visitor crosses once and leaves behind, so a reversible value that tracks position is the honest
reading. The **editorial** headings were on that same loop until 2026-08 and that was a defect,
not ambience: an entrance is not a position, and scrolling back up thickened a heading the page
had already finished writing. Anything that is triggered by *arrival* belongs to a register and
must be one-shot. The five subpages that ran the same defect from a scroll timeline took
`.ink-press` in 2026-08; there is one press on the site now and no scroll-driven weight left
outside the hero.

Three rules that generate the rest:

1. **Nothing enters from `opacity: 0`.** Copy waits at `--half-ink` (0.44 — the same alpha the
   manifest's half-light mask already used, so the whole site half-lights at one strength) and is
   inked to full when reached. A page that opens holes and fills them in is what a fast scroll
   exposes, and *that emptiness* is what reads as machine-made — not the movement. The veil obeys
   the same law: 0.58, never opaque, so the photograph is always legible underneath.
2. **Nothing travels.** Entering from an offset is slide-deck physics. Blur-up is worse: it is
   the 2026 signature of a generated page, which is why the hero lost it too.
3. **One node, one register — except ink+lead**, which is a single causal gesture (rule first,
   ink 180ms behind). A node carrying an authored choreography takes `.reveal-cue` and nothing
   else; stacking a register on top of a draw is exactly the compounded motion the manifest
   stanzas were freed from, and it is what the coda emblem was still doing until this pass.

**Do not add a hairline in order to have something to rule.** Every ruled line on the page is a
border the layout already carried (`.manifest-top`, `.ensemble-facts`, `.ensemble-origin`'s gold
margin, `.path-register`, `.path-entry`, `.donation-list`, `.bank-card`, the director section's
centred gold rule). Inventing lines for the effect is the showreel move the register exists to
make unnecessary.

**Unison is the tell, not the effect.** N siblings flipped in one IntersectionObserver callback
enter as one block, and that is what makes a page look generated more than any choice of easing.
`setupReveal` therefore paces every entrance through one shared onset queue (220ms start-to-start,
document order), the same "points of imitation" mechanism `setupManifestLight` uses for the
stanzas. Anything new that reveals in bulk goes through that queue.

Coherence is the filter against showreel, not restraint — which is why a strong page-turn is fine
and a tasteful generic fade-up was not.

**A choreography's duration is a scroll DISTANCE, and it was never budgeted as one.** A node fires
when its top crosses 88% of the viewport and then keeps travelling: at an unhurried reading pace
(~400px/s through Lenis) 1s of choreography carries it ~400px, i.e. ~44% of a 900px screen. So the
budget is ~1.0s to finish in the reading zone and ~2.0s before it leaves the top. Ink (0.90s) and
lead (0.85s) fit; the interlude knot ran **3.20s** and its gilding sweep **4.10s** — one and a half
to two screens — so the page's own structural punctuation had never been watched finishing. Fixed
2026-08-01 by a single tempo factor per choreography (never per-stroke hand-tuning: the internal
rhythm is the composition, the total is only its tempo marking). The coda is the one exemption —
the scroll ends under it.

**A register's node is judged by its HEIGHT before anything else.** The trigger reads a node's
top, so a tall node inks its lower half off-screen — and the question "is this one utterance?" is
editorial, while the defect is geometric. `.rite-quote` was cleared on the editorial question and
was wrong: 84px mark + 46px margin + a heading wrapping to two lines is 350px, so it fired on the
mark while the inscription sat at 102% vh. Ask the height question first. The same rule sets the
light register's `--veil-delay`: a section-scale veil fires a full viewport before its photograph
is worth looking at, `.portrait` does not, so the delay is authored per host and is **not** a
second trigger line (that reorders neighbours — Etap 1b). And whatever any register's total
becomes, it must clear `SETTLE_FALLBACK_MS` in `scripts/landing.ts` — `is-settled` strips the
transition, so that timer is a hard ceiling on every choreography, silently cutting off anything
longer.

**A veil cannot out-darken a scrim that already spent the range.** `rgba(8,8,7,0.58)` is a
multiply by 0.42 over whatever the host left. Measured on one mid-bright photo pixel at each
section's lightest point: `.portrait` moves 82 sRGB levels (unscrimmed, brightness 0.92),
`.image-rite` 46, `.ensemble` 27, `.final-support` 19→10 under its own 0.78–0.88 gradient — which
is exactly the order in which they can be seen. Do not answer this by deepening `--veil-ink`:
clearing threshold on `.ensemble` needs ~0.78, which leaves the photograph at 18/255 and breaks
rule 1 to rescue a register whose whole promise is rule 1. Timing is the lever that does not lie.

**Each register owns its easing, and the measure is not the duration.** Read a curve by *at what
fraction of the clock 82% of the travel is spent* — past that the remainder is under the eye's
threshold and the nominal duration describes nothing. `--ease-slow` spends 82% in 28% of the
clock, so on it the 1.8s veil was a 0.5s event and the 0.9s ink a 0.25s one. Three tokens now
(`styles/tokens.css`): `--ease-ink`, `--ease-rule` (symmetric — a hand along a straightedge starts,
travels evenly, stops), `--ease-light` (holds, floods, eases to nothing). Two traps: a register
easing must be a **literal curve, never `var(--ease-slow)`** — an alias is a synonym, not a seam,
and `--ease-slow` carries ~40 unrelated declarations; and `--ease-light` must **not** be simplified
to a plain ease-in, which ends at maximum velocity, so the veil's last shadow vanishes at full
speed and reads as a switch being thrown.

*Second, independent defect in the same place, same date:* the trigger fires on an element's *top*
while a lead rule is drawn at its *border*, so bottom-ruled nodes like `.path-entry` (280–420px
tall) drew their hairline at 120–135% vh — off-screen, every entry, every time. **Every rule is
top-anchored now**, which is also the truer reading: a scribe rules the line, then writes on it.
`.manifest-top` is the sole exception (short enough to stay inside budget). Do not "fix" a rule
back onto a bottom border, and do not give the lead register its own trigger line to compensate
for anything — two trigger lines invert the order of neighbouring nodes (a wrapper's rule would
draw *after* the rows it opens). One trigger line for every register is a correctness requirement.

Remediation is sequenced in `docs/web-reveal-remediation.md` — read that before retuning any
timing here, and note its `Rejected` section (left→right on body copy, and line-by-line reveals)
before proposing either.
