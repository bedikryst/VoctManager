# Landing (`web/`) — settled decisions and landmines

Record of what has already been tried, decided or rejected on the public site, so it is not
re-proposed. Companion to `.ai/07_marketing_public_site.md` (rules) — this file is the
*negative* space: the things that look like good ideas and are not.

Last consolidated: 2026-08-01.

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
- **A month for 9 Kart.** Its `viaDate: "2024"` sits in a column of "sty 2024" / "jesień 2025" and
  looks like a proofreading slip. It is not: that concert has no `date:` because it was a three-city
  tour across the year, so it honestly has no month. The raggedness is typographic, not editorial —
  every surface derives from `concerts.yaml` and none of them invents. Leave the YAML alone.

### "No poster images" — what the rule covers, and what it does not

`PathSection.astro`'s header says *"No poster images — the rite doesn't market itself by face"*, and
the Imagines band (2026-08-07, movement II, between the film and the register) looks like a breach of
it. It is not, and the reading matters more than the instance because the sentence will be read again.

The rule is about **register entries**. A memorium row that carries a thumbnail beside its numeral
becomes a catalogue listing, and the register's whole claim is that it is typographic — five evenings
set as type, in order, with nothing sold. That is intact: the band is a **separate object standing
before** the register, so the register itself is still purely typographic, entry by entry.

What the rule was never about is photography on the landing, which the page is full of — the hero
bleed, ImageRite, the Director portrait, the Vox poster, the FinalSupport backdrop. A site that
declines to show its own documentary photographs is not restrained, it is hiding, and the founder's
complaint that started `docs/web-imagines-spec.md` was exactly that. So the test for anything similar
is not "is there a photograph here" but **"does a row of the register now carry a face?"**

Two constraints the band carries because of this, both load-bearing: it is a **line, never a grid**
(a sixth evening gains a sixth frame, not a second row — the moment it wraps it is the thumbnail wall
the spec's §2 rejects), and it prints **no titles**, only numerals, because the names are set in the
register 200px below and a band that repeats them is a table of contents for the list it stands on.

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
failure / QR), station glyphs, concert prologue. `public/voct-mark.svg` masks
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

**A full-bleed section must carry `data-spine-clear`.** The spine is `position: fixed` and stands
in the page's 5vw gutter, which every section grants it — except one that runs its CONTENT to the
viewport edge. The Imagines band shipped without the attribute and the spine printed `Vox memoriae`
across its fifth photograph from 1440px up, and its numeral and tick from 1201px. The attribute is
read by `MovementSpine.tsx` on the same viewport centre band it already uses for the active
movement, and the spine withdraws for as long as the section holds it. Withdrawing, not shifting:
the spine is orientation, the bled object is the page.

**`Vox memoriae` and `Sustinete nos` stay.** Both are grammatical. `Sustinete nos` is site-wide nav
vocabulary (`SiteChrome.astro`, `StickyHeader.tsx`), and `Vox` anchors `data-movement="vox"` plus
the VoxMoment eyebrow. Only movement I was actually broken Latin (a verb with no subject).

**The manifest carries NO stanza numerals, and that is the spine's doing.** I/II/III in the
manifest's left margin were capitalis, hairline-small and ink-muted — the same object
`MovementSpine` fixes at the right edge for the page's three actual movements, in the same face at
11–14px, and the two sat within ~25 pixels of one baseline. Two roman indices facing each other
across one screen, counting different things, with nothing telling them apart. Removing the
decorative one was also what freed the type to hang on the opening rule's left terminal. If a
future pass wants the theses enumerated, the question to answer first is what the spine is then
counting.

**The manifest's rule is a MEASURE, not a frame.** `.manifest-top` spans the full container and
for a long time nothing below it touched either end — every line was placed by a `margin-left`
against nothing, which is what made a deliberately rigid grid read as adrift. The composition now
lands on both terminals: the first thesis at the left one, the `.manifest-response` block flush to
the right one. Indents are PERCENTAGES of the container, never `vw`: above 1600px the container
stops growing while the viewport does not, so a vw indent keeps opening while the measure stands
still. Verified 0 → 1420 at both 1920px and 2560px.

**Gold cannot take the ink's half-light floor, anywhere on the site.** `--candle` is 2.10:1 on
parchment where ink is 16:1, so at `--half-ink` (0.44) a gold word rests at 1.29:1 — invisible.
"Odsłania." sat there for months while a fifteen-line comment above it defended the very law it
was breaking (nothing enters from nothing). Its mask floor is its own now (`--line-rest: 0.78`).
The general rule: any element given a half-light rest state in gold needs its floor recomputed for
the material, and the sweep across it will be a warming (≈1.60 → 1.85:1), never a reveal — that
smallness is the material's range, not a mistuning to chase.

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
and never asked the second question. When it comes up, restate the element's list together with the
ink's, using the register's tokens, at a specificity clearing both the register and `.is-settled` —
a node with a live hover transition is entitled to keep one after its entrance is spent.

**And check it the other way round too, because on a subpage the collision usually goes the other
way.** Astro scopes a page's own styles by appending `[data-astro-cid-…]` to **every compound**, so
a two-class page rule is emitted at (0,4,0) and outranks `html.voct-motion .reveal` (0,2,1) *and*
its `.is-in` (0,3,1). A page-local rule touching a register node's `opacity` or `transition` therefore
wins silently, and the register is what breaks. Both cases were live on `/koncerty` until the Etap 5
census: `.rep-row` replaced the ink with a private 16 px rise on a 0.5 s clock, and
`.station--memoriam .station-poster { opacity: .8 }` pinned the figure so the register was **inert**
— observed, flipped, settled, never moved. The fix for a resting dim is `filter: opacity()`, which
composes with the register instead of replacing it. None of this is visible in the source; measure
the emitted CSS, the same rule bundle order already earned.

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

**The mobile card's ribbon is DYE, and its material is DENSITY — never light.** The "Vitta"
(`styles/nave-menu.css`) is the one object on a flat parchment page that could be modelled, and three
field passes proved it must not be: registrum's cloth recipe at full strength read as brushed brass
(dark weft ribs are invisible over the desktop's night heroes and obvious on paper), the corrected
light-only weft read as a vinyl strap, and each fix only moved the wrongness. No highlight, no sheen,
no lit selvage — and nothing periodic across an 11px width, because at that scale a weave is stripes.
"It needs more material" will come back; the answer is dye density, in two layers and two units on
purpose. The weight ramp is px measured FROM THE TIP (it carries the object's meaning, so it must not
stretch — and on a strip shorter than its zones the negative stops clamp, which is what makes a short
ribbon read full-strength and an emerging one thin as it extends); the pools are percent (they carry
nothing, so stretching scatters them across the five ribbon lengths for free). Subtractive only:
anything that lifts toward paper is a highlight under another name. **And a stop anchored to the
HEAD may not share a gradient with stops anchored to the TIP** — the slot's shadow was a stop inside
the ramp, and on the landing's own row (a ~100px strip, shorter than both tip zones) the two
`calc(100% − …)` stops resolved negative, clamped up onto the cap's own position, and crushed the
whole modulation into a 14px band with a hard step under it. Head-anchored shading is its own layer.

**And the ribbon may not take a concert's accent, in any shape.** Re-dyeing it inside a concert's
station was rejected on contrast (2026-08-03); a *branch* — crimson stopping at KONCERTY, a second
ribbon in the concert's accent descending from there — was rejected the same day for a stronger
reason: crimson means WHERE YOU ARE in exactly one place, and a branch lands its point on a word you
are **not** on, which degrades the mark into a breadcrumb. Two strips in one 13px gutter is also more
weight, not less. The measurement under both: **the accent palette is a NIGHT palette.** Raw from
`concerts.yaml` onto `--paper` it runs 6.6:1 (crimson) · 4.6:1 (Hymn, 9 Kart) · 4.0:1 (Aeternam — and
a grey-brown that reads as a smudge, not a dye) · 2.8:1 (Wołanie) · 2.1:1 (Wcielenie's gold). Three
legible marks and two smudges is worse than one crimson. The accents belong where the ground is dark
enough to hold them, which is why the desktop register carries `--silk-quiet` as a counterweight and
the card carries none. What IS right in the instinct: colour belongs to the ROW, not to the ribbon —
five threads (what the book contains) against one ribbon (where the reader is).

**`aria-current="page"` is a claim about a URL, not a way to light a link up.** On
`/koncerty/wcielenie` the bar's KONCERTY link and the register's own ribbon both carried it, so a
screen reader announced "current page" twice at two different destinations. A section ancestor gets
its own hook (`data-section` in `SiteChrome.astro`, styled identically) and `aria-current` stays on
the exact match. The mobile card was already right and is the reference: its Koncerty voice takes
nothing on a concert page, because the Via row underneath is where the reader is.

**Two identical words are not a stutter until you have measured the gap.** An audit called the card's
two "Via"s (Koncerty's Latin incipit, and the Via register's label) a stutter "~40px apart" and wanted
one of them spent. They are ~130px apart at a 76px band, with the whole Kontakt entry between them and
in two different registers — right-aligned serif italic against left-aligned tracked capitalis. Nor
are they two roles: the incipit names the road and the register prints it three lines down, which is
how a missal introduces a section. The premise came from the DESKTOP, where the concert ribbons really
do hang under KONCERTY; on the card the Via is a closing section. `Via` is also declared nav
vocabulary (`i18n/ui.ts`: Introitus, De nobis, Via, Scribe nobis, Sustinete nos) — don't spend one to
fix a stutter that is not happening.

**The footer's solar day: built three times, cut. Do not build a fourth.** 2026-08-03, in one week:
a sun-altitude arc, then the same arc re-inked, then a 24-hour hairline (`.dies`) with the daylight
stretch written in gold and a punctum at now, on a real NOAA solar module. Each pass fixed the
previous pass's stated fault and each was still wrong, so the faults are worth keeping — but the
verdict is that **the footer is the wrong organ for any of them**, and the reasons are ordered
outermost-first because that is the order the next pass should test in.

*Wrong information class, which no drawing can fix.* Everything in this footer is either the
foundation's identity (KRS, board, statute, addresses) or its liturgical frame (hora canonica,
tempus) — and the frame is a brand claim: we live in the church year, that is what Concerts
Spirituels means. Sunrise and sunset over Kraków are neither. They are geodesy at a point: the
payload class of a weather widget, and rubrication does not change a fact's class. **The one bridge
that would have made the sun legitimate here is the one none of the three passes built**: the
canonical hours were originally *horae temporales*, the daylight divided into twelve stretching
divisions. If the sun rules the office, the crossings are the ruling of the page. All three passes
instead pricked the fixed clock hours from `horaeCanonicae.ts` (0/3/6/…/21) — modern equal hours —
so a solar span and a clock grid shared one axis with no relation between them. **If a fourth pass
is ever pitched, this is its entry price, not an enhancement.** Also checked and dead: moving the
figure to the concert pages so a sunset would mean "we begin after dark." Every concert in
`concerts.yaml` starts at 20:00; the datum is a constant, not a variable.

*Restatement, which survived every redraw.* The punctum's position IS the clock printed below it;
the nearest prick IS the hora printed below it. Only the two crossings were new — two numbers for
~470 lines. Pass one also printed the noon altitude, which was a third restatement and arithmetically
guaranteed: at a FIXED latitude noon altitude is `90 − LAT + declination` and day length is
`acos(f(declination))`, both strictly monotone in the same variable, so each determines the other
exactly (Kraków: 16.5°/7h40m in December, 63.4°/16h20m in June — there is no day that is high and
short). Removing the arc removed restatement three and left one and two standing, because they are
structural: a figure of the day drawn beside a clock and an hour name will always redraw them.

*And the defence that could not reach the reader.* The final pass argued in comments that a line
with a filled stretch and a dot is not a progress bar, because the ink does not start at the left
edge and the punctum is often outside it. Both true — and both legible **only to someone who returns
at another hour**. A visitor sees one instant; at 22:02 the gold dot stands past the right end of
the fill, which reads as a scrubber dragged past its buffer. **An argument that needs two visits is
not a defence of a first impression.**

Two findings from those passes that outlive the figure and belong in the general rules: **density
needs area** — separating two states on a 1px hairline by `--line` → `--line-strong` (~208 vs ~168
grey composited on `--paper`, forty levels apart) is *not findable on screen*; the "material is
density, never light" rule comes from the Vitta, which is 11px wide, and at 1px only length, hue and
position read. And **a caption under someone else's mark is a lie about position** — parking two
readings at the ends of the measure to make collision impossible put `5:12` under the prick meaning
midnight, which outranks tidiness.

**And the structural fix the three passes were really asking for: the footer is FOUR BANDS, not a
diptych.** The clock is not a heading a column can be named after — it is the moment the page is
being read, which is a *dateline*, and datelines sit on the rule at the head of a document. The
band is `IV · INSCRIPTIO FINALIS` left — rule — dateline right (instant · hora · tempus), which is
the head of a dated document; the register below takes the whole measure as four stanzas of one
rank — Fundatio ‖ Consilium ‖ Corpus ‖ Vox — each under its own ruled head in the shared
`· LATIN polski` form. **The asymmetry is deliberate and the two flanking rules must not come
back.** A first attempt kept the rule-flanked centred inscription and hung the dateline centred
underneath, and that made it the only centred object above a left-hanging register — it belonged to
nothing and floated. The rhyme with the interludes' I/II/III lives in `.aether-inscription` itself
(capitalis, the roman in italic serif, the two diamond fleurons), not in the rules, which were this
footer's own addition — that is what makes the asymmetry affordable. That is what the content had been all along: the old right-hand column
carried its own internal 2×2, so a two-column shell was holding three columns of content. **Do not
restore the diptych.** The void that kept inviting decoration was structural, and it cannot form
against a full-measure register. Four consequences worth keeping. The clock drops from 80px to
~28px — at 80 it out-shouted `VoctFoundation`, the actual subject of the footer — and its `wght`
breath goes with it, because at a third of the size a weight pulse reads as a wobble on a line that
already ticks seconds, and the seconds are the live signal. **A dateline is a stamp, so it gets one
voice and at most one accent**: the first version put seven type registers on one line (mono caps /
34px serif numerals / italic superscript / three italic sizes / two mono sizes) and was unreadable
as a unit; it now decrescendos strictly left to right, 28 → 18 → 15 → 11, and the place (`Kraków`)
is gone because the seat is set in full a hundred pixels below. **A column head may not be smaller
than the inscription that governs its band** — the stanza labels stayed at the 10px they wore as
sub-heads inside someone else's column and read as timid at top rank; they are 11.5px capitalis
now, matching `INSCRIPTIO FINALIS`, with the Polish gloss held at 10px so the two-voice contrast
survives. And **columns of one rank speak one voice**: Vox kept the sans it wore as a footnote strip
under the old Fundatio block, which beside three serif-italic columns read as a paste-in; it now
shares Corpus's exact rule, permanent hairline included, because without it four addresses beside
two underlined documents read as a list of nouns rather than links.

**The desktop ribbon hangs from the same margin as everything else.** It spent a while centred
between two rules, which made it a third axis in a footer whose head, register and colophon all
start at the left margin; it now mirrors the head band exactly — names left, one rule running out to
the right edge of the measure.

**And on the phone the footer is not a register at all. The fault was never the axis — it was
printing the archive twice.** Two passes argued about alignment: the ≤640 layer centred every block
(seven unequal blocks, each ragged on both sides — noise, not a plate), then hung them all from the
left (tidy, and still 1200px of directory). Both were answers to the wrong question. Folded into one
narrow column the register prints the board, NIP, REGON, the statute, four contact routes and four
typeface names — **and every one of those is already set, in a fuller form and under its own head,
on /kolofon and /kontakt, both of them linked from the footer itself.** No alignment settles a
restatement that long. So the phone prints what a last leaf prints: an IMPRESSIO — movement mark,
the moment of printing (clock · hora · gloss · tempus, stacked and decrescendo), the house with its
seat and KRS, one invitation, its documents, its presence, the fine print, and the house glyph the
page opened with at the threshold. One DOM, two compositions: the ≤640 layer decides which subset
prints, so there is no second tree and no duplicated link. Four things to keep. **A subset of the
markup, never a second tree** — a media query cannot desync, an island rendering a different tree
per viewport can. **Centring fails on blocks with internal structure, not on centring** — lists,
key/value rows and wrapping inline groups rag on both sides, single composed lines do not, and once
the plate is single lines the centred axis is correct (the Coda directly above it is centred, and a
colophon has been centred for five hundred years). **A separator must never be the last thing on a
row** — which is why the stacked impressio drops both its mid-dots rather than keeping one at a
break. And **hiding is what you do when you cannot cut**: a swipe rail or a disclosure widget in the
footer was considered and dropped, because the site's own Regula says it moves none of its text, and
because the content did not need to be hidden — it needed to not be there.

*One thing that pass shipped broken, and the class of failure is worth more than the fix:* the
`ACT I` comment above `.site-footer-head` was never closed, so the rule under it — the one that
centres the running head on the plate and drops the wide measure's 38px of air — was inside the
comment. **A CSS comment that swallows a rule is silent all the way down**: it parses, it builds,
`astro check` is clean, and the only symptom is a left-hung inscription on a centred plate with a
gap nobody ordered. Every other rule in the block worked, which is what made it read as a tuning
problem. Nothing in the toolchain looks for this; the cheap check is a scan for `{` occurring
inside a comment, which takes ten lines of node and finds it instantly.

**The footer's TONE, unlike its figure, is legitimate — and the reason is the difference between
a thing that is read and a thing you read through.** 2026-08-04 the plate took two full palettes:
parchment through the day, a night ground at Completorium and Matutinum. It looks like the fourth
pass the section above forbids and it is not, on three counts, each of which is also the entry
price for anything similar. *It asks nothing of the sun.* The assignment is a field on the hours
themselves (`lumen` in `horaeCanonicae.ts`) and it reads the glosses that were already there —
six of the eight claim the light, two claim the night — so it never leaves the frame the footer
is entitled to print. *It draws no second object.* The restatement verdict ("the punctum's
position IS the clock printed below it") is a rule about ATTENTION, not about information: two
things that both ask to be read spend the reader twice, and a ground asks for nothing. The
dateline saying `Completorium · noc się zamyka` over a night plate is a caption agreeing with its
page, not a second caption. *And it is the palette in which this footer's gold finally works* —
`--candle` measures 2.10:1 on parchment and 8.08:1 on the night ground, so the accent the plate is
built around stops being a whisper the moment the plate turns. The window is 21:00–03:00 Warsaw,
which is also when a post-concert phone actually opens this page.

Four things it had to carry, and each of them would have been silent:

- **The bottom iOS band.** `BaseLayout` read `--edge-foot` once at arm time, so a footer whose
  colour is no longer a constant for the life of the page ended in a parchment strip under a night
  plate. It reads both edge tokens inside the observer callback now. §3a still holds otherwise —
  one colour per page per band, and the TOP band is still frozen and still black.
- **The sticky chrome.** `DARK_SELECTORS` (`StickyHeader.tsx`) decides the brand's tint from
  `elementFromPoint` under the bar. The footer fills the screen when it is read, so the bar stands
  on it; without a conditional entry the wordmark was dark ink on a night ground. The entry is
  conditional (`body[data-lumen='nox'] .site-footer`) and the probe runs per frame, so a plate that
  turns at 21:00 takes the chrome with it.
- **Where the tone is applied from.** NOT the footer island: it hydrates `client:visible`, so a
  palette set on mount lands in front of the reader every time — the plate arrives parchment and
  turns under their eyes. A page's ground is not island state. `scripts/landing.ts` writes
  `<body data-lumen>` at module time and in `astro:after-swap`, the same contract the parallax
  controller keeps and for the same reason. Body rather than `<html>`, because `--edge-foot` is
  read off the body and because the swap replaces the body wholesale — the attribute leaves with
  the page instead of needing a gate.
- **One registered NUMBER, not eight registered colours.** An unregistered custom property does
  not interpolate, so a smooth turn needs `@property`. Registering all eight tokens means eight
  blocks and an eight-term `transition`; registering `--nox` as a single `<number>` and deriving
  every token through `color-mix` means one of each, and it puts the two palettes side by side in
  the source where they can be compared. It **must** inherit: the tokens themselves are
  unregistered, so descendants inherit a raw token stream with `var(--nox)` still inside it and
  resolve it in their own context — under `inherits: false` every descendant would read the
  initial value and the whole footer would stay in daylight.

Two measurements worth keeping. The night values were chosen to REPEAT the parchment's contrast
relations rather than to out-shout them: `--ink-soft` lands on 11.60:1 against 11.60:1, and the
hairlines on 1.43 and 2.16 against 1.40 and 2.15. And the day palette was quietly failing its own
rule — `--candle` carried the stanza heads (11.5px), the hora, every gold hover and the colophon's
focus ring at 2.10:1, while `--candle-ink` had existed for exactly that since the token was added.
Gold TEXT in the footer goes through `--candle-text` now (candle-ink on parchment, full candle at
night); marks, mid-dots, fleurons and rules keep `--candle`, where the minimum does not apply. The
dateline clock goes through it too, and the "large display gold" exemption in `tokens.css` does not
rescue it: 22–28px IS large text under WCAG, so the bar is 3:1 and full candle measures 2.10 on
parchment. That exemption was written about gold on a DARK ground, where the same paint is 8.08 —
which the night plate hands back, clock included.

**The landing's footer must not be given to the subpages, and the two are not "the same footer,
diverged".** Asked and answered 2026-08-04. Every page except `/` ends on `components/SiteFooter.astro`
— permanently on `--night`, three columns, zero JS — and swapping the landing's plate in fails on
three counts, each sufficient. *The numbering is a claim about a composition*: `IV · INSCRIPTIO
FINALIS` closes I · Lumen Christi, II · Vox memoriae, III · Sustinete nos, and on `/kontakt` there
is no I, II or III — a fourth movement without them falsifies the sequence exactly the way putting
the Bobola Mass in the register would falsify the roman numbering. *The subpages would lose their
site map*: that middle column is the only wayfinding at the foot of a subpage, and the landing
needs none because the page IS the navigation. *And the shared footer is the TRANSLATED one* —
`lang` selects twelve strings and localizes every route, `/en/o-nas` and `/fr/o-nas` are built
pages, while the landing's island is Polish in the markup; the swap would be a regression no
design win pays for. One more, for the palette specifically: **the night plate is information only
because the landing's default is parchment.** On a footer that is always dark, `--nox` has nothing
to say.

What WAS a real gap, and is closed instead: the statute PDF and the data-protection address stood
on the landing alone (the statute is the one file a grantor looks for, and the duty is the whole
site's); the three column heads were plain labels while the landing speaks the two-voice `· LATIN
gloss` rubric and this footer's own incipit line already speaks Latin — they are `· Fundatio` ·
`· Index` · `· Vox` now, with the existing glosses, and Latin needs no locale; and the footer had
no entrance at all on pages where every band above it inks or is ruled — it takes the ink register
per column (`data-d` 1·2·3 left to right, the incipit at 4) and the lead on `.foot-base`'s border,
which is **the only hairline this footer carries**. No cap rules were invented for the three
columns to have something to draw.

**A printer's device at the foot of that plate: built once, cut. Do not build a second.** The house
glyph was set under the imprint as a closing mark — first at the chrome's 17×40 footprint, which was
a speck under a subject set at 50px, then at 112px on the vector master, which is the smallest width
`base.css` allows the SVG (below it the V's thin arm falls under a pixel and blinks on scroll). The
size was never the fault. **A device closes a colophon in a BOOK because the house mark appears
nowhere else within sight; this page's chrome is sticky, so the same glyph stands at the top of the
very frame in which the footer is read** — and `VoctFoundation` is set 300px above it. That is the
solar figure's verdict again, in another organ: the mark IS the mark printed beside it. It was also
the only object on the page added purely to close something, against a register language whose own
rule is that no hairline was ever added to have something to animate. Tuning it was a dead end in
both directions: in ink it outweighs the wordmark and becomes a second monument, in stronger gold it
breaks the one-accent discipline the stamp above it had just been fixed to keep — the only value at
which it sat comfortably was the one at which it was barely there, which is the page telling you it
does not want the object. **The plate ends on the last line of the imprint, the way a book's
copyright page does.** If a foot mark is ever pitched again, the entry price is a reason it is not
the chrome glyph restated — a typographic fleuron rhyming with the two the plate's own inscription
already carries is the only candidate that has ever survived the question.

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

## 3a. The iOS edge bands — six dead ends, one lever

*Investigated end-to-end on device, 2026-08-01/02. Read this before touching `--edge-band`,
`--edge-foot`, `transitions.css`'s `html` background, or the observer in `BaseLayout.astro`.*

**The phenomenon.** iOS 26 Safari opens a band above (and below) a `position: fixed` header that
the page cannot paint into. Measured with a field probe: `documentElement.clientHeight` sits
~45px below the physical top while the document paints edge to edge, and `env(safe-area-inset-top)`
resolves to **0 even with `viewport-fit=cover` present** — Safari applies an obscured-content
inset of its own and every safe-area calc in the codebase quietly adds nothing. It is not a
landing-vs-subpage difference; the original diagnosis that it was one is wrong.

**What does not reach the band.** Each of these was built, deployed and looked at on a phone:

| Attempt | Result |
|---|---|
| `position: fixed` overhang on the bar | Paints nothing |
| A full-viewport `fixed` layer (the grain, forced opaque) | Stops at the band's lower edge |
| `position: sticky`, child overflowing upward | Clipped |
| `position: sticky` with a **negative `top`** (the box itself in the band) | Visible only before it sticks; clipped once in the band |
| `visualViewport.offsetTop` in JS | Always 0 — there is no offset to compensate with |
| `overflow-x: hidden` propagated to the viewport | No effect |
| `<meta name="theme-color">` | No effect while a sample is live; it is only the fallback |

**The one lever is the canvas** — `html`'s `background-color`, which Safari samples. `body`'s
colour slot appeared to work for a while and does not: both candidates were dark and the runs
could not tell them apart. The decisive test set the canvas green *before first paint* and
magenta *after*, which also exposed the useful asymmetry:

- **top band — frozen** at the canvas colour as of first paint;
- **bottom band — live**, follows the canvas afterwards.

So `--edge-band` (black, `transitions.css` puts it on `html`) is what the top band samples, and
`BaseLayout.astro` switches the canvas to `--edge-foot` (the page's own footer colour) **keyed on
the footer entering the viewport**. That trigger is not decoration: applying it at load loses a
race — even a deferred module script beats the top band's sample and tints it too. Keying on the
footer sidesteps the race, and by the time it fires the footer fills the screen anyway.

**Consequences to design around.** One colour per page per band. It cannot track the header's
tone, and it cannot be blurred. Black for the top, site-wide, because the sample is taken at load
and at load every page stands on a dark hero; matching it to the footer was tried and read as
wrong the instant the hero appeared.

**Still open.** Opening the nave makes Safari re-sample, and what it picks up is the body's
*rendered* surface — so the top band turns paper after a menu cycle and keeps it for the rest of
the page's life. Swapping the body's surface to black for the duration of `menu-open` was tried
and did **not** fix it. The body veil is not the source either (recolouring it showed through for
one frame, then Safari painted over it). Unsolved.

**And the shape question this started from:** the header is a full-bleed rectangle. The floating
pill was a response to live page content showing above the bar; with a solid band that reason is
gone. Do not re-propose the pill without re-reading this section, and do not fork the header by
platform.

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
(`styles/registers.css`) travels the variable-font weight axis 580 → 300 on the ink's own clock,
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
   **Its scope is a PAGE**, and that justification is the test: the node has to hold layout on a
   surface the reader is already looking at, so that the hole would be seen. A HOVER APPARITION is
   not one — the desktop registrum's drop is `visibility: hidden` at rest and the set does not exist
   until the pointer asks for it, so half-ink there opens no hole; it strands a half-lit index in
   mid-air, arriving before the silks it names and outliving them through the close grace. That was
   built, shipped and reported from the field (2026-08-03) and the index went back to entering from
   zero. The mobile nave card is the opposite case and keeps the law, because its veil shuts FIRST:
   every line stands in layout under an opaque parchment before a single one darkens. Ask whether a
   surface is a page or an apparition before granting it a register.
2. **Nothing travels.** Entering from an offset is slide-deck physics. Blur-up is worse: it is
   the 2026 signature of a generated page, which is why the hero lost it too.
3. **One node, one register — except ink+lead**, which is a single causal gesture (rule first,
   ink 180ms behind). A node carrying an authored choreography takes `.reveal-cue` and nothing
   else; stacking a register on top of a draw is exactly the compounded motion the manifest
   stanzas were freed from, and it is what the coda emblem was still doing until this pass.

**Light is the PHOTOGRAPHIC register, and it is granted by role.** Every photograph on the site
enters by having a veil of its own dark lift off it — 68 nodes, not the 4 the landing had until the
Etap 5 sweep, which had 60 subpage photographs *inking* instead while the register meant for them
sat unused. Before granting it to a new host, measure the delta the veil really produces there: the
scrim is a multiply by 0.42, so the delta is linear in how bright the photograph already is, and the
test is a minute with sharp. Six of the site's fifty assets are too dark to clear the bar and keep
the register anyway, because they are dark by photograph rather than by design — grading per asset
would put one component in two registers depending on which file it was handed. A host whose OWN
scrim has spent the range is the opposite case and does not get the register at all: `.final-support`
lost it, because under that section's 0.78–0.88 gradient the image sits at 26–41/255 before the veil
arrives, while the same photograph unscrimmed would have moved 32 levels. Two exclusions worth
naming, since a sweep by filename takes both: a **video player** already carries a veiled state of
its own (two veils on one node), and a **drawn sigil is not a photograph**.

Bound the veil to the IMAGE, not to the figure: `inset: 0` on a `<figure>` darkens the caption too,
and a caption is copy — it keeps the ink. So a photograph with a caption is two nodes, which is also
what the height rule wants.

**Controls stay out of every register.** A half-ink button is a button you are not sure you may
press. This was written as a rule in 1e and broken in five places until the Etap 5 sweep — container
nodes holding a glyph, a heading, copy *and* an actions row under one onset. When you find one, the
fix needs no wrapper: `data-d` sets `--reveal-delay` for a whole **subtree**, so the container
becomes the cadence carrier and its children take the registers — **the same `data-d` reads as one
utterance, a step reads as a sequence** — and the actions row simply takes none.

**A LEADER is not a rule, and "rule leads, ink follows" does not reach it.** The lead register was
granted to hairlines that are the *border of a block* — every one of them spans its measure and is
top-anchored, and the pairing law is about those. A leader runs from a word out to its incipit or its
tip, so it has **no length until both ends are set** (and under `.ink-press` the word's advance width
is still moving while it inks). It binds an entry; it does not rule one, so it follows its own entry's
ink. Both index surfaces are authored that way on purpose — `nave-menu.css`'s `.voice-lead` after
`.voice`, `registrum.css`'s `.ribbon-thread` after `.ribbon-line` — and an audit has already tried
once to "correct" both into an inversion they were not. Ask what an element *is* before applying a
rule about its category.

**Do not add a hairline in order to have something to rule.** Every ruled line on the page is a
border the layout already carried (`.manifest-top`, `.ensemble-facts`, `.ensemble-origin`'s gold
margin, `.path-register`, `.path-entry`, `.donation-list`, `.bank-card`, the director section's
centred gold rule). Inventing lines for the effect is the showreel move the register exists to
make unnecessary.

**Unison is the tell, not the effect.** N siblings flipped in one IntersectionObserver callback
enter as one block, and that is what makes a page look generated more than any choice of easing.
`setupReveal` therefore paces every entrance through one shared onset queue (220ms start-to-start),
the same "points of imitation" mechanism `setupManifestLight` uses for the stanzas. Anything new
that reveals in bulk goes through that queue.

**And the queue orders by GEOMETRY, because document order was only ever a proxy.** The promise is
"a fast scroll still enters top-down", and the implementation read DOM index — which is the same
thing right up until something re-sequences the layout. The landing's phone footer does exactly
that: its bands are re-ordered with flex `order` (`11-mobile.css`) so the record that prints last
stands third in the markup, and a fling to the bottom inked it two bands ahead of its turn. `hits()`
sorts on `entry.boundingClientRect.top` now — rounded into 4px buckets so siblings hanging from one
grid line tie, with document order as the stable tie-break, which is what still enters the desktop
register's four columns left to right. **Before reaching for `order` or `grid-row` on register nodes,
remember that every "document order" guarantee in this codebase silently became a claim about
layout.**

Coherence is the filter against showreel, not restraint — which is why a strong page-turn is fine
and a tasteful generic fade-up was not.

**A choreography's duration is a scroll DISTANCE, and it was never budgeted as one.** A node fires
when its top crosses 88% of the viewport and then keeps travelling: at an unhurried reading pace
(~400px/s through Lenis) 1s of choreography carries it ~400px, i.e. ~44% of a 900px screen. So the
budget is ~1.0s to finish in the reading zone and ~2.0s before it leaves the top. Ink (0.90s) and
lead (0.85s) fit; the interlude knot ran **3.20s** and its gilding sweep **4.10s** — one and a half
to two screens — so the page's own structural punctuation had never been watched finishing. Fixed
2026-08-01 by a single tempo factor per choreography (never per-stroke hand-tuning: the internal
rhythm is the composition, the total is only its tempo marking). Two exemptions, both because the
budget is a scroll DISTANCE and neither surface scrolls: the coda (the scroll ends under it), and the
mobile nave card, whose ~2.04s tail is deliberate — nothing on that card enters from zero, so it is
legible and tappable at 0.22s and the choreography is ornament over an already-usable page rather
than a gate in front of one. Its step between voices is set by the RATIO to its ink duration, not by
either number alone: onsets closer than ~0.12s fuse into one event, and a step much shorter than the
ink it fires keeps N lines burning at once, which is a wash and not a sequence.

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
