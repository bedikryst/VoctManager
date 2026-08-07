# Imagines — the image archive

Spec for making the ensemble's documentary photographs reachable. Six stages (0–5), ordered by
dependency, not by value: stage 0 is a refactor nothing visible depends on and everything after
it does.

Companion to `web-landing-guardrails.md` (the negative space) and `concert-detail-pages-spec.md`
(where the gallery currently lives).

Written 2026-08-07; stages 0–4 shipped the same day, stage 5 (§9) directly after them. §3 was
corrected against the YAML on that day (the counts it opened with were wrong — see the note there
before trusting any number in an earlier reading of this file), and §4's claim about which stages
need the packing module was corrected when stage 4 turned out not to. **§9 was inserted after the
fact, so the two sections that closed the file moved down a number** — cross-cutting constraints
are §10 and the open list is §11.

---

## 1. The defect

The request that started this was "the media should be more visible". The thing actually broken
is narrower and worse:

**The landing's register does not link to the concert pages.** `PathSection` renders each past
evening with a title, a place, a lead, an optional "Zobacz fragment" (video lightbox) and an
expandable programme — and no route to `/koncerty/[id]`, where that evening's photographs,
sung texts, roster and reflection live. The only landing→concert links are the two in the hero.

So the path to the photographs of *Aeternam* is: leave the register → nav → `/koncerty` → find
the station → open it → scroll past programme, texts and roster → gallery. The section that
describes the five evenings is a dead end pointing away from the richest content on the site.

Second defect, smaller: the gallery on a concert page is **static**. There is no way to see a
frame at full size. `VideoLightbox` exists; no image equivalent does.

Third: there is no collective surface. 42 photographs exist and no page holds them together.

## 2. Rejected — do not re-propose

**A `/galeria` thumbnail grid.** The reflex answer and the one that damages the site. These are
low-contrast chiaroscuro frames from a dark nave; at 240×160 they are black rectangles. The grid
fails them literally, before it fails them stylistically — and it makes a portfolio out of a site
that declines to be one (`PathSection.astro` header: *"No poster images — the rite doesn't market
itself by face"*).

**A fifth entry in the primary nav.** `SiteChrome`'s nav is four items plus WESPRZYJ, with the
concert ribbons hanging off KONCERTY, and it is deliberate and liked. `/obrazy` gets three
entrances instead (§7) and none of them is a nav slot. If it still reads as buried after stage 4
ships, that is a decision to take then, on evidence.

**Outlet or partner logotypes anywhere.** Settled 2026-08-07: names set in the site's own faces
carry the same information and stay inside the document.

## 3. What exists

| Evening | `concertId` | YAML entries | Files on disk |
|---|---|---|---|
| Kontemplacja Wcielenia | `wcielenie` | 9 | `kd-wcielenie-0…8` |
| Wołanie Gór | `wolanie-gor` | 6 | `kd-wolanie-0…5` |
| 9 Kart z Księgi Psalmów | `9-kart` | 15 | `kd-9-kart-0…14` |
| Hymn Poległym | `hymn-poleglym` | 4 | `kd-hymn-0…3` |
| Aeternam — Epitafium dla Gazy | `aeternam` | 9 | `kd-aeternam-0…8` |

**43 photographs in YAML, 43 files on disk, no orphan.** This paragraph previously claimed 42
and 43, and named `kd-aeternam-8` as declared nowhere and dropped by the build. That was simply
false: the entry is at `concerts.yaml:2110`, and `prune-orphan-assets.mjs` reported the same 62
pruned images before and after `/obrazy` shipped. Nothing needed asking the founder. Counting
`img: kd-` in the YAML against `ls src/assets/photos/kd-*` takes ten seconds and is the check
that should have preceded the claim.

Every entry carries `alt` and most carry `caption`. **Photographer credits are now a field**
(`gallery[].credit`, `content.config.ts`), not a substring: the eleven `9-kart` captions that
read `"… (fot. Kamila Grudzińska)"` were migrated in stage 3, so one convention exists rather
than two. Named so far: Kamila Grudzińska, Wojciech Przybył, Jakub Garbacz — eleven frames of
forty-three. Where a credit is absent both colophons say so; a list of three names with nothing
beside it is a claim those three took everything.

All five concerts have `hasPage: true`, so stage 1 has no ragged case. The sixth station (the
Bobola liturgy, `order: 6`) has no gallery, so it is absent from `/obrazy` without a special
case — and correctly, per the register rule in `web-landing-guardrails.md` §1.

---

## 4. Stage 0 — extract the layout algorithm

**Why first:** `pages/koncerty/[id].astro` lines ~80–109 compute the gallery's geometry inline.
Stage 3 needs it. Left where it is we get two copies and they drift on the first correction.

*This paragraph originally claimed stages 3 and 4 both needed it. Stage 4 does not, and the reason
is the band's whole form:* `layoutShots` chooses its own `perRow` from the set's mean aspect ratio,
so the band's five frames (three landscape, one 9:16 portrait, one square) would be packed 3 + 2 —
two rows, i.e. the grid §8 forbids. The band is one line of **uniform** panels, so the packing has
nothing to answer there. Stage 0 stands on stage 3 alone, which is enough: two copies drift as
readily as three.

Extract to `web/src/lib/galleryLayout.ts`:

```
layoutShots(shots: { ar: number }[], opts?: { width?; gap?; maxHeight? }) → { w, wMax }[]
```

Carry over verbatim, including the reasoning comments — they are the value:

- `perRow` from the set's **mean aspect ratio**: portraits four-up, landscapes three-up, except
  at exactly 2 or 4 where two-up beats stranding a shot.
- `shotH` ×0.99 slack so sub-pixel rounding cannot drop a full row's last shot onto its own line.
- `wMax` = 40% over ideal, capped by `maxHeight × ar`, so a lone portrait cannot grow into a tower.

Defaults stay the concert page's current values (`GALLERY_W = 1180`, `GALLERY_GAP = 40`,
`GALLERY_H_MAX = 640`) so this stage is **provably invisible**: same numbers in, same
`--ar` / `--w` / `--w-max` out.

`[id].astro` then imports it. **Do not touch the CSS** — `.kd-gallery-grid` / `.kd-shot` stay
where they are in this stage; stage 3 decides whether they become shared.

Verification: `npm run build`, then diff the emitted inline `style` attributes on one concert page
against the pre-change build. Any difference is a bug in the extraction, not an improvement.

## 5. Stage 1 — the register title becomes a link

In `PathSection.astro`, `<h3 class="path-entry-title">{path.title}</h3>` becomes an anchor to
`/koncerty/${path.concertId}`.

- **The title, not a fourth control.** The entry already carries two controls ("Zobacz fragment",
  "Program koncertu"); a third would turn a memorium row into a toolbar. The title is the thing
  the reader already wants to press.
- The `.reveal` register stays on the element — it is ink either way.
- Affordance follows the site's existing link idiom (gold hairline on hover/focus). It must NOT
  read as a button. Check it against `.primary-link` and the footer links before inventing
  anything.
- The open card ("Szósty wieczór") has no page and keeps its plain `<h3>`. That asymmetry is
  correct: there is nothing to link to.
- Add a `plausible-event-name=path+concert` class so we can see whether this alone fixes the
  founder's complaint.

## 6. Stage 2 — the image lightbox — SHIPPED

`islands/landing/ImageLightbox.tsx` + `styles/image-lightbox.css` + `scripts/image-triggers.ts`.
Twin of `VideoLightbox.tsx`, same machinery, no new patterns:

- Opens on `voct:open-image` with `{ src, srcset?, alt, caption?, credit? }`.
- Closes on ✕ / Escape / backdrop / mobile back.
- **`OverlayFlag` in `lib/overlayHistory.ts` is a closed union** — add `"imageOpen"`. Without it
  the back button leaves the page instead of closing the overlay.
- `useBodyClass("image-open")` + `useFocusTrap`, mirroring the video path.
- Popstate listener **must** gate on `!isOverlayEntry("imageOpen")` — see the note in
  `overlayHistory.ts` on synthetic popstate.
- Emit `window.__voctImageReady` / `voct:image-ready` so static-DOM triggers can queue a click
  made before hydration, exactly as the video lightbox does.

Wiring on `/koncerty/[id]`: each `.kd-shot` becomes a trigger carrying its own data attributes.
The concert page is static Astro, so the trigger is a `<button>` with `data-image-open` and a
delegated script dispatches the event — same contract as `data-video-open`.

The scroll-lock rule in `[id].astro` (`body.page-koncert-detail.video-open`, near the top of the
page's `<style>` — the "714" in an earlier reading of this file was a stale line number) is scoped
to the video overlay; the image overlay got its own rule, not a widened one.

Three things the build settled that the plan above did not anticipate:

- **The media wrapper IS the button**, not an overlaid control. `.shot-open` (image-lightbox.css)
  is a pure reset — a button's default padding and border would put the photograph inside a box
  the flex line never budgeted for. Proven inert: all 43 emitted `--ar`/`--w`/`--w-max` triples
  are byte-identical before and after.
- **The hover affordance is the button's own `::after`, not a recolour of the photograph's
  border.** That border lives in each page's scoped stylesheet, so reaching it from a global sheet
  is a specificity tie decided by bundle order, and the affordance has to hold on both galleries.
- **`scripts/image-triggers.ts` ends in `export {}`.** A `.ts` file with no import or export is a
  *script* to TypeScript and its top-level names are global, so its `onClick` collided with
  `vault-triggers.ts`'s. `astro check` catches this; a plain build does not.

The frame's renditions come from `lib/galleryFrame.ts` (1200 + 1920 webp), extracted for the same
reason the packing was: two callers asking for different widths would emit two sets of files for
one photograph. The 1200 step is deliberately the grid's own top rendition, so the pipeline
dedupes it.

## 7. Stage 3 — `/obrazy` — SHIPPED

A dark page, chronological, built as a **sequence of evenings** — never a mosaic.

- Per evening: roman numeral + title + year as the series head, then that evening's shots through
  `layoutShots`. The page reads as five galleries in one document, in Via order, which is the same
  order the register and `/koncerty` use.
- Background `--night`, as `.kd-gallery` — parchment kills these frames.
- Every shot opens the stage-2 lightbox.
- **A photographer colophon at the foot.** Credits move out of the caption strings into their own
  block. This is the stage where `gallery[].credit` should become a real field in
  `content.config.ts` rather than a substring convention; migrate `9-kart`'s captions when it does.
- JSON-LD: an `ImageGallery`, and it is worth checking whether the frames should carry
  `ImageObject` with `creditText`. Optional, and subject to the same restraint as the rejected
  additions in the GSC remediation — propose, do not assume.

**Entrances (no nav slot), all three shipped:** the `Imagines` band on the landing (§8), the
footer's Index column, and a link at the foot of each concert page's gallery to the other evenings.

**The footer entrance moved, and the reason is a shelf.** The plan put it in the landing footer's
CORPUS stanza. That stanza's gloss is *dokumenty* and it holds two things: the foundation's
statute (a PDF) and the privacy policy. An image archive filed beside them reads as an
administrative record. `SiteFooter.astro`'s **Index** column is the right shelf, and it says so in
its own comment — the statute is kept out of it because "a PDF is not a page of this site", and
`/obrazy` plainly is one. The Index column also ships on **every** subpage, where the landing's
Corpus reaches only the landing, and the landing gets its own entrance in stage 4 regardless. The
label is translated in all three locales (`i18n/ui.ts` `footer.images`); the URL stays Polish,
which is exactly what `localizePath` does for an untranslated route.

**Weight — measured, not assumed** (build of 2026-08-07, sizes on disk):

| Page | HTML gzip | lazy images | full scroll @1200w | @560w |
|---|---|---|---|---|
| `/obrazy` | 19 KB | 43 | **3.4 MB** | 1.1 MB |
| `/o-nas` | 21 KB | 32 | 1.9 MB | 1.4 MB |
| `/koncerty/9-kart` | 27 KB | 20 | 1.6 MB | 0.6 MB |
| `/koncerty` | 25 KB | 19 | 1.7 MB | 1.6 MB |
| `/` | 25 KB | 19 | 0.8 MB | 0.5 MB |

So it *is* the heaviest page, by ~1.7× over the previous holder — and the phone case, which is the
one that matters, is 1.1 MB across 43 lazy images, below what `/koncerty` already loads eagerly at
the top of its own scroll. Its HTML is the lightest of the content pages (no programme text). The
lightbox pool is a further 7.3 MB on disk, but that is 43 independent on-demand fetches of ~170 KB,
never a page load.

`prune-orphan-assets` was the other open question and the answer is nothing: **62/611 pruned both
before and after**, because `/obrazy` consumes the originals through `<Image>` and `getImage`,
which emit fresh renditions — it never reads `.src` on an original, which is the thing that marks
one as needed.

Route: `/obrazy`. **No `TRANSLATED_ROUTES` entry** — that set holds `/o-nas` alone today, and
`localizePath` correctly returns the Polish URL for untranslated routes. It joins when it is
translated, not before.

## 8. Stage 4 — the `Imagines` band on the landing — SHIPPED

`components/landing/ImaginesBand.astro` + `styles/landing/14-imagines.css`.

**Placement:** movement II (`Vox memoriae`), between `VoxMoment` and `PathSection`.

The movement runs silence (`tacet.`) → voice (the film) → memory (the register). It is named
*memoriae* and visual memory is the one register it lacks. The band announces the register in
images; the register unfolds it in words.

**Form:** five frames, one per evening, one full-bleed dark band (the parchment→night→parchment
transition the page already performs), roman numeral under each, click → lightbox, and one exit
beneath: "Wszystkie obrazy" → `/obrazy`.

Five frames = five evenings = the numbering of the register directly below. That is what makes it
composition rather than an attachment. **It is not a grid and must never grow into one** — if a
sixth evening ships, the band gains a frame, not a second row.

**This reinterprets a written rule and the reinterpretation must be recorded.** "No poster images"
means *register entries* do not get thumbnails — the landing is otherwise full of photography
(hero, ImageRite, Director, the Vox poster, the FinalSupport backdrop). A separate band before the
register leaves the register itself purely typographic. The reasoning is now in
`web-landing-guardrails.md` §1 ("No poster images — what the rule covers, and what it does not"),
with the test it generates: not "is there a photograph here" but "does a row of the register now
carry a face?"

**Register:** the frames are LIT, not written — `.reveal-light`, as on the concert page. The
numerals are ink. Do not put both registers on one node. No `data-d` anywhere: the landing's
cadence is the shared onset queue, and the ten register nodes (five veils, then five numerals)
light across ~930ms of it, left to right.

What the build and the first audit of it settled, none of it anticipated by the plan above:

- **The panels are a CROP, and portrait, and that is arithmetic rather than taste.** Five frames
  across one measure are ~370px wide at 1920 and ~300 at the site's own 1580 — and 240×160 is
  precisely the size at which §2 says these photographs become black rectangles. Only height
  rescues them, so the panel is a uniform 4:5 box with `object-fit: cover`, which is the treatment
  every composed photograph on this site already takes; the whole frame is one press away in the
  lightbox. Hanging the five by their own aspects at one height was measured and is worse: their
  ratios run 1.50 · 1.50 · 1.50 · 0.56 · 1.00, so one line of five would stand 305px tall with the
  portrait reduced to a 172px strip.
- **`gallery[0]` does not represent an evening.** For two of the five it is a rehearsal frame
  ("Próba do…"), which is a fine archive entry and a poor announcement. `Path.frame`
  (`data/landing/paths.ts`) names the photograph that stands for an evening, by its `img` in that
  concert's own gallery so alt, caption and credit come with it; unset means `gallery[0]`, and a
  name that is not in that gallery fails the build rather than falling back silently.

  It is now set for **four** of the five, and the two that joined were found by looking at the
  built band rather than at the YAML — which is the only way this class of defect is ever found.
  `9-kart`'s `gallery[0]` is a photograph of the printed programme: a fine archive entry, not an
  evening, and the brightest panel of five on a night ground, so the eye reached the middle of the
  line before its beginning. `aeternam`'s is the widest frame of its set, an evenly lit hall from
  the back rows, which at 4:5 keeps neither the architecture nor the singers. The remaining
  `gallery[0]` is `hymn-poleglym`'s, and it is an evening. **The check is one contact sheet of
  4:5 centre-crops, not a reading of `alt` strings** — `sharp(...).resize(W, H, {fit:"cover"})`
  over the five names, which is ten lines and answers the only question the band asks.
- **The numbering is now one object.** `ROMAN` moved out of `PathSection.astro` into
  `data/landing/paths.ts` and both read it. "Five frames = the numbering of the register directly
  below" was two literals that happened to agree; it is a shared list now, which is what makes the
  claim structural.
- **Below the desktop measure the line LIES DOWN — it does not stand up.** This shipped as a
  vertical stack at full measure, in a 3:2 box, and it was wrong twice over. A column of five is
  the one shape the band says it never is; and it ran ~1500px on a phone, a second document
  standing between the film and the register in a movement whose whole form is three short
  breaths. It is a **rail** now: one screen, snapped, carried sideways — the same gesture the
  desktop eye makes across the same object.

  Two things make it work rather than merely exist. The panel is capped at 420px, or a tablet
  prints a 900px-tall photograph nothing can see whole. And the plate keeps its **gutter**, which
  is what leaves the next panel visibly cut at the right edge — that cut is the entire affordance,
  because nobody scrolls sideways on a page that gives no sign it can be.

  The crop does **not** relax on the rail, reversing this stage's original reasoning on purpose: a
  stacked photograph at full measure could afford 3:2 because it was the largest a phone ever
  printed one, and a 74vw rail panel cannot. Portrait is the only thing keeping these dark frames
  legible at that width, and it keeps the band one shape on every screen.

  The breakpoint is the 200px floor solved, and the arithmetic moved when the gutter went: with no
  gap the panel is exactly `100vw / 5`, so the floor is exactly **1000px**. It shipped at 980,
  which printed 192 × 240 panels — to the pixel the thumbnail §2 rejects the whole grid for being.
  `sizes` carries the same two boundaries; move them together or not at all.

  No `data-lenis-prevent` on the rail: Lenis is gated behind `(pointer: fine) and (hover: hover)`
  in BaseLayout, so on the touch devices the rail is built for it never runs. Reaching for the
  attribute anyway would be worse than dead config — the plain form suppresses the WHEEL too, and
  would break vertical scrolling over the band on every desktop.

- **No gutter between the panels; their own hairlines carry the division.** A gutter is a poster's
  answer and this site is a codex, which divides a plate by RULING it — the five become one object
  scored into five, which is what the band claims to be. The ruling is load-bearing, not
  decoration: four dark frames butted with no division at all dissolve into one panorama, and five
  churches read as one room, which is a small lie about five different evenings. So the state to
  avoid is zero gutter **and** no hairline. The panels touch, so `.imagines-frame + .imagines-frame
  img` drops its left border and the division stays 1px against 1px at the plate's outer edge.
- **`.path` drops its own top rule under the band** (`.imagines + .path`). The cut from night to
  parchment is the boundary; a `--line` hairline 1px below it is the restatement the interludes
  already refuse with `.aether-interlude + section`.

- **A full-bleed section takes the movement spine's floor out from under it.** `.movement-spine`
  is `position: fixed` in the page's 5vw gutter and clears every section that keeps one; this band
  has no gutter by design, so from 1201px the spine's gold printed itself on the fifth photograph,
  and from 1440px the whole `Vox memoriae` inscription did. The band marks itself
  **`data-spine-clear`** and the spine withdraws while it holds the viewport centre — the same
  centre band the active movement is already read from, one more observer in `MovementSpine.tsx`.
  Withdrawing is the right way round: the spine is orientation, the bled object is the page. **Any
  future full-bleed section on the landing carries this attribute or repeats the collision.**

- **`sizes` was overstated by a fifth.** It said `24vw` against a panel of 19.3vw, which on a 2×
  desktop put all five over the 840 candidate and pulled the 1200. No new files either way (the
  set is deduped), purely bytes on the wire.

- **The band's only affordance was a hover, and a phone never hovers.** `.shot-open:hover::after`
  is the whole signal that these are doors; without it five photographs under a rubric read as
  decoration standing on the register. Under `(hover: none)` the band prints the sign instead —
  four candle corner ticks, a crop mark, on the button's `::before` because `::after` is the hover
  edge. It is deliberately the same figure the pointer will take over these frames on a desktop.

- **The claim that the five read as one object needed proving, and light proves it.** Under
  `(hover: hover)` approaching any panel steps the other four back (`brightness(.74)`) and lifts
  the approached one a whisker (`1.06`). It is a change of LIGHT — this band's own register — and
  not a lift, a zoom or a shadow, all three of which `.shot-open` already rules out.

**Weight, measured** (build of 2026-08-07, same probe as §7): `/` gains 5 lazy images —
0.50 → 0.83 MB at 1200w, 0.44 → 0.56 MB at 560w, HTML 24.9 → 26.8 KB gzip. **No new files are
emitted at all**: the band requests the galleries' own `widths` (560/840/1200) and the lightbox's
renditions come from `lib/galleryFrame`, so the pipeline dedupes every one of them —
`prune-orphan-assets` reported the identical **62/611** before and after, off an identical total.

## 9. Stage 5 — the frame's protocol — SHIPPED

Four things one audit found, done as one change because they all extend the same
`[data-image-open]` detail and all land on the same three surfaces (the band, `/obrazy`,
`/koncerty/[id]`): arrow navigation through a set, a way out of the frame to its evening, an
opening that is instant rather than a dark room and a pop, and a cursor state for photographs.

The detail went from five fields to eleven, so it now lives in **`lib/imageFrame.ts`** — types and
the two event names, imported by both `scripts/image-triggers.ts` and `ImageLightbox.tsx`. Two
hand-kept copies of an eleven-field interface drift; two of five did not.

**A SET is always dispatched, never a lone frame.** One photograph is a one-item set, so the island
has exactly one shape to render and NO surface needed migrating: a trigger without
`data-image-group` publishes itself. Membership is that attribute, order is the document's own —
so ← and → move the way the page reads.

**The group's boundary is a different answer on each surface, and each one is the reading unit:**

| Surface | Group | Exit (`data-image-href`) |
|---|---|---|
| Imagines band | the band (5) | that evening's `/koncerty/[id]` |
| `/obrazy` | the whole document (43) | that frame's own evening |
| `/koncerty/[id]` | that evening's gallery | `/obrazy` |

`/obrazy` is one sequence in Via order and stopping the arrows at each evening's last frame would
contradict the document the reader is holding — the exit is what keeps the evening named once its
head has scrolled away. A concert page stops at its own gallery, because an arrow that walked on
into another concert would take the reader out of the page they are reading without saying so. And
the exit always leads OUT of where the reader already is, which is why the concert page's frames
point at the archive rather than at the page around them.

What the build settled, none of it anticipated by the plan:

- **The two halves of the photograph ARE the arrows.** The plan said chevrons at the panel's
  edges. The panel is `width: fit-content` and the room's padding is `max(16px, 4vw)` — 48px at a
  1200px viewport — so a control hung outside it like the ✕ is one narrow window away from being
  off-screen. And the cursor state below already promises an arrow across the whole half; a 40px
  target on an edge would make that promise a lie everywhere except at the edge. So the half is
  the button: transparent, full height, with one chevron drawn at its outer edge. Buttons rather
  than a click handler on the image, so the keyboard reaches them and a screen reader is told what
  they do.
- **A swipe fires the half's click as well.** Nothing scrolled, so the browser synthesises a click
  on lift-off and one gesture turned the frame twice. The gesture claims the press and the next
  `touchstart` hands it back. The touch handlers also moved from the panel to the STAGE, because a
  horizontal drag that lifted off over the exit link would otherwise both turn the frame *and*
  follow the link.
- **The caption row is now always in the DOM, empty or not.** A live region created by the change
  it is meant to announce announces nothing, so a conditional `<figcaption>` would have been silent
  on exactly the move it exists for. The `alt` is repeated into it as `sr-only` for the neighbouring
  reason: a screen reader does not re-read an `alt` that changed under it, so "IV / IX" alone would
  be the whole of what a reader who cannot see the photograph is told about the new one.
- **Walking the set pushes no history.** Forty-three entries for one visit to `/obrazy` would make
  the back button useless. The frame is one surface however many photographs pass through it, and
  back still closes it, once.
- **The phone cap came down from 74svh to 68svh.** The ✕ hangs BELOW everything the panel holds, so
  the exit row pushed it past the bottom edge on a landscape phone — and the room scrolls nothing,
  because `body.image-open` is locked, so anything past the edge is simply gone.
- **The blurred ground is `cover`, not `contain`.** The band hangs every frame at 4:5, so the
  thumbnail standing under the full rendition is frequently a CROP of it and its own ratio is not
  the one being reserved. It is a ground, not a preview — nothing in it needs to be true except the
  light. It is also over-scaled by 6%, because a blur samples past its own edge and would otherwise
  print a soft border inside the frame.
- **`currentSrc` is empty for a frame the visitor never scrolled to**, so a neighbour far down
  `/obrazy` opens without a ground and falls back to the room's own fade. That is the honest limit
  of the technique: it makes a dark room rare, not impossible. The hover preload of the 1920
  rendition covers the pointer case; on touch the press *is* the moment, and a second copy of bytes
  already in flight would be worse than nothing.
- **The counter is roman**, because every numeral on this site is — the register's entries, the
  series heads, the numerals under the band. It is the same numbering read from inside one of its
  frames. Worth knowing: on `/obrazy` it runs to **XLIII**, which is at the outer edge of what a
  counter is read at a glance. Left roman, because one arabic numeral on a surface that has none
  would cost more than the beat it saves.
- **The magnetic snap over these panels is gone by construction, not by a rule.** `.is-frame` sits
  above the interactive branch in the cursor's priority ladder, and the snap is applied only in the
  branches beneath it — so `snapEl` is null without a single `data-cursor="no-snap"` anywhere on
  the three surfaces. A `<button>` 370 × 462 was pulling the pointer 15% toward its own centre,
  which over a picture reads as the cursor being taken away from what it is pointing at.
- **`image-triggers.ts` no longer needs its `export {}`** — the contract import is what marks it a
  module now. If that import ever goes, the `export {}` has to come back, or `onClick` is a global
  again and collides with `vault-triggers.ts`'s (§6).

**Two cursor defects the build could not have found, and a browser did.** Both were reported off a
real screen, which remains the only way this class of thing surfaces:

- **The viewfinder was drawn inside a pill.** `.site-cursor` carries `border-radius: 999px`,
  backgrounds are clipped to the border box, and a circle cuts each corner tick down to the
  fragment that survives inside the curve — eight strokes became eight dots arranged on a ring.
  `border-radius: 0` on `.is-frame` is therefore load-bearing, and the same trap waits for any
  future state that draws in the element's corners.
- **A hairline glyph disappears into a photograph.** The first pass used the band's PRINTED mark
  verbatim — 1px of `--candle`. That mark is still, and the eye finds it at leisure; the cursor is
  moving over changing luminance, and mid gold at 1px is invisible on a lit nave and not much
  better on a dark one. Both states now draw at 2px in the lit gold the other glyphs use
  (`--glyph`, local to `.site-cursor`) under a double drop-shadow. Same figure as the printed mark,
  heavier weight; the difference is the medium, and it is deliberate.
- **Legibility over a highlight is the shadow's job, not a ground's** — and the viewfinder proved
  it by being given the wrong one first. A radial plate behind it is darkest at the CENTRE, which
  is the one place that figure has no ink and the reader is looking through it; the eight corner
  ticks sat outside the plate entirely. A drop-shadow follows the alpha of what is actually drawn,
  so each tick carries its own halo. The arrow keeps a radial ground precisely because its ink IS
  at the centre — the same test, opposite answer.
- **The halves' arrow is one mirrored shape, not two.** It reads as a solid arrow — shaft and head
  cut from one box by `clip-path` — because the site's cursor already speaks in filled shapes (▶,
  ↓) and an outlined chevron vanished into half the archive. Crossing the middle of the frame turns
  `scaleX(1)` into `scaleX(-1)`, which a browser interpolates through zero: the arrow folds shut
  and opens again facing the other way. Two mirrored border-triangles would have been simpler and
  cannot be interpolated between, which would have thrown away the one thing about the first
  version that was working.

**Weight, measured** (build of 2026-08-07, same probe as §7/§8). HTML gzip is unmoved — `/` 26.8 KB,
`/obrazy` 19.2 KB, `/koncerty/9-kart` 27.1 KB — because the new attributes are the same eight
strings repeated per frame and gzip eats them. The island is **4.7 KB raw / 1.9 KB gzip** in total.
**This stage emits no files at all:** the frame asks for renditions `lib/galleryFrame` already makes
and the hover preload asks the browser for one of them, so the build taken with every part of stage
5 in place reported the identical **62/611** — the same number §7 and §8 both closed on. The 43 and
15 emitted `--ar`/`--w`/`--w-max` triples are untouched; nothing here reaches the packing.

*A later build in the same working tree reads 62/624, and it is worth knowing why before that
number is read as a regression here: the total moved when `lib/croppedShot` landed alongside this
stage and gave the band's five panels renditions already cut to 4:5. That is a different piece of
work with its own reasoning in its own file header. **Pruned stayed at 62 across both**, which is
the figure that actually says nothing was orphaned.*

---

## 10. Cross-cutting constraints

- Photographs are **documentary**. Captions state place and date; they never editorialise. The
  existing `alt` texts are descriptive and correct — keep them.
- Consent scope: singer names are cleared for **concert pages only** (`content.config.ts`,
  `roster`). An archive page must not caption faces with names.
- The landing's motion registers are `ink` / `lead` / `light` — every new entrance belongs to
  exactly one. Nothing here introduces a fourth.
- Any new user-facing string is Polish-primary and must read natively.
- **A cropped thumbnail is cropped at BUILD, never by `object-fit` alone** (`lib/croppedShot`).
  `cover` draws a photograph wider than its box whenever the box is proportionally taller — a 3:2
  frame in the band's 4:5 panel is drawn 1.875× the panel's width — and the browser cannot see
  that: it chooses a rendition from `sizes`, `sizes` states the panel, so the file it picks is the
  one it then has to scale up by that same factor. The band shipped that way and was soft on every
  screen (840 candidate drawn across 1440 device pixels at 2×). Overstating `sizes` fixes the
  sharpness and pays for it in bytes nobody sees; cropping at build fixes both, because the clipped
  47% is never transferred. This is *not* an argument for hand-cut thumbnail files — those would
  break the one-photograph-one-set rule these three surfaces are built on, and the lightbox would
  still need the whole frame beside them.

## 11. Open

- ~~`kd-aeternam-8`~~ — void. It was never missing; see §3.
- ~~Whether the concert page's `.kd-gallery` CSS becomes shared with `/obrazy`~~ — **stays
  duplicated**, decided in stage 3 with both pages open. What actually drifts is the packing, and
  that already lives in one module (`lib/galleryLayout`, with the CSS contract stated in its
  header and re-stated in both pages' comments). What is *not* shared is four declarations. The
  rest of each gallery — ground, borders, caption grade, the band it sits in — is its page's own
  tone, and sharing would have meant renaming classes on a working page to save nothing.
- **Photographer credits for the thirty-two frames that name nobody.** Both colophons now state
  the gap in Polish rather than passing over it, and `/obrazy` invites a correction. Filling it is
  an editorial task, not a code one: add `credit:` beside the entry in `concerts.yaml` and both
  surfaces pick it up.
- ~~**The band's five crops, on a screen.**~~ — **looked at, and closed.** Two of the five were
  answered at the first lever (`frame`, §8); the second lever was not needed on any panel — centre
  holds for all five. The crop's *framing* was never the problem: the choice of photograph was.
  Its *resolution* was, separately and on every screen, and that is the §10 rule — the second lever
  is consequently no longer `object-position` but `framePosition` on the evening in
  `data/landing/paths`, because by the time a panel reaches the browser it is already 4:5 and has
  no overflow left to shift.

- ~~**`kd-aeternam-3`'s caption may name the wrong church.**~~ — **corrected.** It read
  *"w Mistrzejowicach"* over a baroque gilt altar; Mistrzejowice is the modernist church its
  neighbours 0–2 plainly show, and 4–8 are plainly the same baroque interior as this one. Moved
  into the Niedzica run as well, so the archive still reads as two venues in order rather than
  one frame sitting in the wrong city. The band closes on it.

- **`kd-wolanie-3` may be a rehearsal, and it is the band's second panel.** Everyone in the two
  frames that are certainly the concert (`-4`, `-5`) is in black; in `-3` they are not, there is
  no `VE` projection behind them, and four voices are visible rather than twelve. Left alone,
  because "rehearsal or concert" is a claim about a day the founder was present for and the
  photograph does not settle it. If it IS a rehearsal the band is announcing that evening with
  exactly what `Path.frame` exists to prevent — **and there is no clean replacement**: `-4` is a
  wide shot whose subject at panel size is the projected logo, `-5` is a posed group portrait, and
  a team photograph among four documentary frames breaks the line more visibly than either. That
  gallery needs another photograph from that night more than it needs a different choice.
- ~~**Stage 5 — the frame's protocol.**~~ — **shipped, §9.** All four parts landed on all three
  surfaces in one change, as the entry argued they had to. What it did NOT settle, and what the
  next reading of the frame should look at: whether the counter should stay roman where a set runs
  to forty-three, and whether the two full-height halves are the right target on a phone now that
  the swipe carries the same gesture — the halves exist for the cursor, and a phone has none.

- Whether the `/obrazy` graph should carry per-frame `ImageObject` + `creditText`. **Not shipped**
  — 43 nodes to restate what the visible colophon says, against the GSC pass's standing rule that
  extra schema is proposed before it is added. Revisit with Search Console numbers if image search
  ever becomes a real channel.
