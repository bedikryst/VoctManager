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

**§12 is a remediation pass over stages 4 and 5, and it supersedes specific claims in §8 and §9.**
Those claims are left standing with a pointer rather than deleted, because the reasoning that
produced them is what makes the correction legible. Where §8 or §9 and §12 disagree, §12 is what
shipped.

**§13 is a second pass over the band alone, and it supersedes §12 on four points** — the plate's
measure, the panel exposure, the caption's content and the fourth evening's frame. Same rule:
where §12 and §13 disagree, §13 is what shipped.

**§14 is a third pass over the band, and it is the largest: the ground, the protocol and the
caption all changed.** It supersedes §8's night band, §12's numeral link, §13's caption row and
every claim in §5–§9 that the landing opens the frame. Where anything above and §14 disagree,
§14 is what shipped.

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

What the build and the first audit of it settled, none of it anticipated by the plan above.
**Four of these were corrected in §12 — the panel's aspect, the plate's bleed, the breakpoint
that follows from it, and the printed touch mark. Read them for the reasoning, not for the
current shape.**

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
real screen, which remains the only way this class of thing surfaces. (A third and a fourth came
the same way and are in §12: the viewfinder read as a fullscreen icon, and the halves' arrow was
speaking a vocabulary the cursor uses nowhere else.)

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

- **The band's first panel announces the evening with a photograph taken after it ended.**
  `kd-wcielenie-8`'s own `alt` says so — *"VoctEnsemble **po** Kontemplacji Wcielenia"* — and it is
  a posed group portrait: twelve singers facing the camera with roses. That is the same class of
  error `Path.frame` was built to prevent (§8: `gallery[0]` is a rehearsal frame for two evenings —
  "a fine archive entry and a poor announcement"), one door further along, and it is standing first
  in the line among four documentary frames. That gallery holds four frames captioned *podczas*:
  `-3`, `-4`, `-5`, `-6`. On a contact sheet at the band's own crop and grade, **`-6` is the pick** —
  it is the only frame in the whole line with a conductor's gesture in it, and it keeps the tree and
  the architecture. `-4` is the safe second. `-5` is the strongest photograph of the six and the
  wrong one here: it is a nave seen from the back rows, which is exactly panel III's shot, and two
  of five in the same register flattens the line.
- ~~**`hymn-poleglym` (panel IV) is the quietest panel and that is probably correct.**~~ —
  **measured, and it was not correct: `-2` shipped (§13).** The entry read "left as it is, on rhythm
  rather than on legibility", and the rhythm argument (III, IV and V would be three consecutive
  architectural wides) turned out to be answered by the photograph itself — `-2` is the line's only
  cool frame, so it separates two warm naves rather than repeating them. The legibility half was
  simply true and was decidable: 85% of `-0` sits under 6% luma at the band's own crop.
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

---

## 12. Remediation of stages 4 and 5 — SHIPPED

The band as it shipped read cheap on a real screen, and none of the reasons were the number of
effects. Six defects, in the order of how much each one cost.

**The five photographs had no shared tonality, and that was the largest of them by a distance.**
Read as a strip of luminance the line went bright-warm · dark · dark · dark · bright-cool: a
terracotta Christmas nave at one end and a blue-gold baroque altar at the other, both outside this
site's parchment/night/candle entirely, with three near-black frames between them. That is not a
line, it is two lamps with a hole in the middle, and the eye read the ends and skipped the centre.

The fix is the site's own grade, not a new one: `saturate(.74) contrast(1.06)` are the numbers the
hero, the rite and the ensemble already dim their photographs with, and applying them to the panels
pulls the pink and the blue back into the palette. Brightness is where the band differs, because
there the photograph is a ground and here it is the subject.

It also repaired the hover, which had been proving the opposite of its claim. `brightness(.74)` on
a frame already at 8% luminance does nothing, while the same value on the terracotta panel is
violent — so the gesture that exists to show the five are one object was visible on two of them.
Both endpoints are now the site's own two treatments of a photograph: a receding panel lands
exactly on the sacred dimming, the approached one comes up to the photograph itself. Ground and
picture, and the reader moves the boundary.

**The plate was bled and its head was not, so the band had three left edges** — rubric at the
gutter, plate at 0, exit at the gutter. Worse, the outer rule §8 claims frames the plate was
*never visible*: it was clipped by the window, so only the internal divisions read, and five
divided pictures with no frame around them are a filmstrip. The plate hangs from `--gutter` now.
It costs ~10% of panel width and buys the outer edge plus one shared measure.

Two consequences worth knowing. The breakpoint moved from 1000px to **1280px**, because the panel
is now `(100vw − 2 × 5vw) / 5` = 18vw rather than `100vw / 5`, and `sizes` states 18vw for the same
reason — the two still move together or not at all. And `data-spine-clear` **stays**: at 2vw from
the right edge the spine's ~68px inscription still overlaps the plate on any viewport under
~1960px, and under the breakpoint the rail runs to the edge outright.

**The panel is a SQUARE, not 4:5.** §8's arithmetic was right and its conclusion was one of two
available. Three of these five photographs are 3:2 and their horizontality *is* their subject — a
nave is wide — and 4:5 threw away 47% of it, so the band was showing the worst version of its best
frame. 1:1 keeps two thirds, drops ~134px of band height, and costs only the one 9:16 source. Five
across the ruled plate are ~346px at 1920 and ~230px at the breakpoint, both clear of the 240×160
at which §2 says these frames go black.

**Nothing under the panels said what they were.** §8's argument — the register names the evenings
200px below, printing the title twice makes a table of contents — is structurally right and was
experientially wrong: at the moment of looking the reader had five anonymous pictures. The **year**
is what the title is not. One short line, repeats nothing the eye is about to read, and turns five
pictures into a chronology, which is what a line of five evenings has to be legible as before the
register explains it. It rides inside the numeral's own register node, so the band's cadence stays
ten nodes rather than fifteen.

The caption band is also **ruled off** now, and each panel carries its own box, so the plate reads
as one scored object with an image row and a foot. Stating the border per panel rather than once on
the plate is what lets the rail reuse it unchanged.

**The band reproduced the exact defect §1 was written about.** The panel opened the frame; the only
road to the evening was inside that frame. So the strongest press on the section led to a bigger
photograph, and the concert page was two presses away. The **numeral is now the link** — it was
already there, already the register's own numbering, and a third control would have turned a plate
into a toolbar, which is the same reasoning that made the register's title and not a new button the
way into a concert page.

**The printed touch mark was a fullscreen icon, and so was the cursor's viewfinder.** §8 and §9
both call it a crop mark and the intent was right; the drawing was not. Brackets that *close* a
corner are the universal expand-to-fullscreen glyph and read as a stock control however finely they
are drawn. A printer's registration mark leaves the corner itself void and sets its two strokes back
from it. Both copies moved together — they have to stay one figure — and the printed one gained the
drop-shadow its cursor twin already had, for the reason §9 records: two of these five panels are lit
interiors and a hairline in mid gold has nothing to hold against them.

**A blur inside the printed mark was proposed and refused.** It is right on the cursor and wrong on
the panel, and the difference is size: the cursor's lens is 46px of a photograph the reader has not
committed to, while the printed mark spans the panel, and a `backdrop-filter` across it would
permanently blur the photograph the mark exists to announce.

**The cursor's viewfinder now holds ground glass.** A figure that only outlines is a shape on top of
a photograph; one that holds glass is an instrument held over it — and the press then means what it
looks like, because `blur(0)` on `.is-down` is exactly what opening the frame does.

**It cost a restructure, and the reason is a trap worth naming.** An element with a `filter` becomes
a **backdrop root**: any `backdrop-filter` inside it samples an empty backdrop and blurs nothing at
all. `.is-frame` carried its halo as an element-level `filter`, so the lens had to go on `::before`
with the ticks and their halo moving to `::after` and its own filter. `opacity: 1` on the state is
load-bearing for the same reason — the base cursor sits at 0.78, and that alone would have made a
backdrop root of it.

**The halves' arrow takes the video ring.** It shipped as a filled arrow floating under a soft
radial smudge, and against `.is-video` sitting one press away in the same archive it read as an
effect rather than as this cursor's vocabulary. It is the ring plus a shallow glass plate now — what
the site already says over a media surface the pointer can act on — with the arrow as the only thing
that differs, because the action does. The mirrored `scaleX` interpolation §9 argues for is
untouched; that part was working. The drop-shadow went with the smudge: a ring on 42% night carries
the glyph the way it carries ▶, and a shadow around a filled ring only dirties its edge.

### The backdrop root — the same trap twice, and the rule it generates

**An element that animates `opacity` is a BACKDROP ROOT, and `fill: both` makes that outlive the
animation.** The frame's room carried the entrance fade (`imageRoomIn` on `.image-lightbox`), so the
`backdrop-filter` one level down on `.image-lightbox-backdrop` sampled an empty backdrop and blurred
nothing at all. The dim worked, the blur did not, and the page stayed crisp behind a 0.9 ground.

**No inspection of computed style finds this.** After the animation settles, `getComputedStyle`
reports `opacity: 1` and the element carries no filter, no mask, no blend mode — the chain looks
clean. The only trace is `getAnimations()` returning `imageRoomIn:finished`. It was found by an A/B
in a real browser: open the frame, set `.image-lightbox { animation: none }` from the console, and
the page behind goes to haze in the same frame.

The fade moved onto the backdrop itself, and the other half of the rule is why that is safe: **an
element's OWN opacity does not cut it off from its backdrop — only an ancestor's does.** Verified
the same way (the animation re-applied to the backdrop element, blur intact).

This is the second instance of one trap in one pass: `.is-frame`'s viewfinder needed the same
restructure because its `filter: drop-shadow` was a backdrop root for the lens inside it. **The rule
for this codebase: nothing between a `backdrop-filter` and the page may animate or declare `opacity`,
`filter`, `mask` or `mix-blend-mode`** — and the check for it is a browser, never a stylesheet.

### The frame's room

Three defects, one of them a real bug.

- **The ✕ was drawn on the site nav.** It hangs 52px above a panel that the room centres, and on a
  1080p screen that put it at ~16px — physically over KONCERTY, which the 0.94 backdrop was letting
  through. The room reserves the button's own headroom now (`max(72px, 8vh)` on top alone), paid for
  by the image cap coming 80svh → 76svh.
- **The page was ghosting through the backdrop.** At 0.94 flat the chrome nav and the band's own
  rubric were legible under it, and the frame read as a modal panel over a document rather than as a
  room the document had been left for. It takes the vault's veil verbatim — `blur(20px)
  saturate(.9)` over `rgba(8,8,7,.9)`, with the `@supports` fallback closing the ground to 0.985
  where the filter is unavailable, since there is nothing left to keep depth with. **This shipped
  once without working at all** — see the backdrop-root section above for why, and do not touch the
  room's animation without re-reading it.
- **The photograph had no edge.** `0 60px 140px -50px rgba(0,0,0,.95)` is a black glow on a
  near-black room: dead code in practice, and half this archive dissolved into the room at its own
  border. One hairline of paper at 10% says where the photograph ends, drawn as a spread
  `box-shadow` rather than a border so it stays out of the box the height cap and the absolute
  thumbnail are both measured against.

### Weight

Build of 2026-08-07 after the pass: 15 pages, `astro check` 0 errors, and every image URL referenced
across the built pages resolves on disk after pruning. The band's ladder went
`[384, 640, 840, 1080]` → `[360, 600, 760, 960]` — the same four rungs, re-aimed at the new panel
regimes — so it emits the same **20 files** it did before, at square rather than portrait, and the
square is the cheaper shape at every rung:

| Rung | Serves | All five panels |
|---|---|---|
| 360w | the whole 1× line (1280 → 1920) | **72 kB** |
| 600w | 2× laptop line, 2× phone rail | 145 kB |
| 760w | 2× 1920 line | 198 kB |
| 960w | 3× phone, 2× tablet at the cap | 282 kB |

Against the 4:5 band's 840 rung at ~63 kB a panel (§8), the common 2× desktop case is 198 kB where
it was ~315. **The one device the ladder deliberately does not reach is a 3× tablet holding the
420px cap** (1260px needed, 960 served, stretched 31%): cheaper than a fifth rung emitted for all
five evenings to serve it.

*Do not read `prune-orphan-assets`' totals as a regression signal across a change like this one.*
The emitted count moved 611 → 624 → 642 over stages 5 and 12 and the pruned count 62 → 66, and the
figure is stable for a given source state (two consecutive builds of this one report the identical
66/642) but not comparable across them. The check that means something is the one above: no
referenced URL missing after the prune.

---

## 13. Second remediation of the band — SHIPPED

§12 closed on "the band as it shipped read cheap on a real screen, and none of the reasons were the
number of effects". That was right and it was not finished. Five more defects, and the first two are
the ones a reader actually feels.

**The band was the one section on this landing that said nothing.** Every other surface sets a line —
the manifest, the film ("Z tej ciszy — głos."), the register ("Co już zabrzmiało."), and even
`ImageRiteSection`, which is a full-bleed photograph with nothing else in it and still carries
"Światło prowadzi słuchacza." The band had a 10px rubric and a strip of pictures, which is what a
component looks like, not a movement of the rite. §8 defended the *shape* of the head and that was
read as defending its *contents*.

It now sets **"Tak wyglądała ta cisza."** — a couplet with the film directly above it (the same
silence, seen rather than heard), and deliberately not about sound, which the register owns. Set a
grade under `.section-title`, because movement II would otherwise be three titled sections in a row.

**The plate was wider than the page.** It hung from `--gutter` after §12, which fixed its three left
edges and left it the only content block on the landing not keeping `min(1580px, 100%)`. At a 1920
window that is 1728px against the register's 1580, starting 74px further left; at 2560 the band is
half again as wide as anything else on the site. So the widest and darkest object on the landing was
a row of photographs standing on the register it indexes — a hierarchy inversion, and visible as a
rubric that does not line up with the "Z drogi" label 200px below it.

The precedent was one section away: `.path` bleeds its ground and hangs `.section-grid` at the
measure. The band does the same now, through one `.imagines-inner` box. Four consequences worth
knowing:

- The panel is **316px** where the gutter gave it 346 — 9% of width for one shared left edge.
- `sizes` gains a fourth regime, because the plate stops growing at the measure:
  `(max-width: 567px) 76vw, (max-width: 1279px) 420px, (max-width: 1755px) 18vw, 316px`. 1756px is
  where 90vw first exceeds 1580, so the boundary is continuous rather than a step. The 1280px rail
  breakpoint is untouched — below the measure the plate is still 90vw and the panel still 18vw.
- The ladder is re-aimed to **[360, 480, 640, 960]** for the new regimes (480 now serves both the 1×
  tablet cap and a 2× line at 1280; 640 the 2× line at the measure and the 2× phone rail). Four rungs
  in and four out, so the band emits the same 20 files.
- The rail's breakout needs `width: auto` beside the negative margins. With the measure still
  declared, a fixed-width box shifted left by one gutter leaves dead space on the right and the plate
  hugs the left edge — the trap `11-mobile.css` already records for the director's portrait.

**The panels wore a scrim and nothing was set over them.** A gradient to 50% black across the lower
half of every frame shipped in stage 4 to give the caption something to hang from; §12 ruled the
caption off, so it had been hanging from a hairline ever since and the gradient stayed on as a habit
— darkening the two lit naves by half at exactly the place their altars are. Every other full-bleed
photograph on this landing wears one **because words are set over it**. Nothing is set over these:
here the photograph is the subject, which is the sentence §12 wrote and then did not follow.

**One brightness cannot govern five buildings, and §12's claim to have fixed the tonal line was half
true.** `saturate`/`contrast` did pull the terracotta and the blue-gold back into the palette.
Exposure they could not touch. Measured at the band's own crop the line ran:

| Panel | Evening | mean luma | share under 6% |
|---|---|---|---|
| I | Wcielenie | 0.19 | 34% |
| II | Wołanie Gór | 0.13 | 61% |
| III | 9 Kart | 0.13 | 36% |
| IV | Hymn Poległym | **0.035** | **85%** |
| V | Aeternam | 0.22 | 28% |

So the fourth panel was a black rectangle — precisely what §2 rejects the whole thumbnail grid for —
standing in the middle of the line, and `brightness(.88)` was making every one of them darker still.
Exposure is **per evening** now (`frameLift` in `data/landing/paths`, applied as `--panel-lift`), the
shared base is **1**, and both hover endpoints **multiply** by the panel's own lift instead of
stating flat values — otherwise the gesture that exists to prove the five are one object is a
fraction of a stop on the darkest panel and violent on the brightest, which is the defect §12 fixed
once and this would have reintroduced.

The values are a **partial** correction toward the line's middle, not a normalisation: flattening
five naves to one luminance costs the chiaroscuro that is the reason to show these photographs at
all. Re-derive them from a contact sheet at the panel's crop and grade — ten lines of `sharp`,
`.resize(316, 316, { fit: "cover" })` then luma percentiles. It is the same check §8 prescribes for
choosing a frame, and the only one that answers this question either.

**Panel IV needed a different photograph, not a correction.** No lift saves a frame at 0.035 mean —
reaching the line's middle is ×3.7, which blows the few lit pixels and amplifies the noise. Of the
evening's four, **`kd-hymn-2` shipped**: the nave in blue light, the only one that reads at the
panel's width, and the line's only cool frame, so it separates two warm naves instead of repeating
them — which retires §11's rhythm objection. `kd-hymn-3` measures brightest of the four and 0% black
and is **rejected**: it is the audience seen from the back with a face in the foreground, outside the
consent scope, which covers singers.

**The caption printed a year that was not a chronology.** §12 introduced it to turn five anonymous
pictures into a sequence, and the register's year cannot do that job — three of five panels read
MMXXIV, so the line carried two values for five evenings. It prints the **photograph's own night**
now (`frameDate`): styczeń · czerwiec · listopad MMXXIV, luty · październik MMXXV. For a programme
that toured this is deliberately not the date the register gives — the register dates the programme,
the band dates the evening it is showing, and each of these five frames is identifiable to one night
from its own caption.

Numeral and date sit on **one row**, which is `.aether-inscription`'s figure (I · Lumen Christi) at a
smaller grade — the shape this site already uses to name a movement, borrowed to name an evening.
Stacked, the pair spent ~82px of the plate's height, a fifth of it, on one 10px line of type.

### Still open after this pass

- **The numeral link is now the band's third road to the same page.** §12 added it because "the band
  reproduces the exact defect §1 was written about" — but stage 1 had already made the register's
  title a link, so the concert page is reachable from the register directly below, from this numeral,
  and from the frame's own exit. That redundancy is what makes the caption band exist at all. Left
  standing because it belongs to a larger open question — what a press on a photograph should do —
  and the answer to that decides this one.
- **Panel II may still be a rehearsal frame** (§11) and is now the line's only close-up among four
  architectural frames. Unchanged, and for the same reason: that gallery needs another photograph
  from that night more than it needs a different choice.

### Weight

Build after the pass: 15 pages, `astro check` 0 errors, `prune-orphan-assets` **66/642** — the
identical figure §12 closed on, because the ladder kept its four rungs and one panel's four
renditions were exchanged for another's. All **576** image URLs referenced across the built pages
resolve on disk after the prune, which is the check that means something here.

---

## 14. Third pass — the band stops being a component — SHIPPED

The founder's reading, on a real screen: *"wygląda jak doklejone do już istniejącej strony, a nie
jako jej integralna część"* — and *"trochę szablonowo/generatywnie"*. Both are structural, and none
of the five defects behind them was a matter of taste.

**The band was the one section on this landing with no voice — again.** §13 shipped
"Tak wyglądała ta cisza." and it was commented out afterwards, so the audit that started this pass
found the exact state §13 had diagnosed: a 10px rubric and a strip of pictures on a page where
every other surface sets a line. It is back, and this entry exists so that the next reader knows
the slot is load-bearing rather than decorative — if the copy is wrong the answer is different
copy, never an empty head.

**A room change performed by an object, not by a threshold.** Movement II ran paper (silence) →
paper (the film) → **night (the band)** → paper (the register). On this landing the ground turns
at the interludes and nowhere else, so a section that blacks out for its own length reads as a
widget dropped into a movement. The plate stands on **parchment** now, ringed by one hairline and
lifted by `.vplayer-stage`'s own shadow, which is the second half of the fix: the film 200px above
is a dark box on this same paper, so the two are now visibly the same kind of object — a window,
and the contact strip under it.

The scoring changed with the ground. Cell divisions were 1px rules of paper-at-15% on night; on
paper they are **2px of the page itself**, with the same 2px inside the ring. A codex divides a
plate by scoring it, and on paper the score is the paper. What must still not happen is the
poster's answer — a real gutter, which turns one scored object into five floating cards.

**Five permanent captions under five cells is a card grid, and it printed the register's own index
directly over the register.** The caption band is gone. In its place:

- the **plate number** is printed on the frame, gold with a halo, the way an engraving carries one
  — so the tie to the register's numbering survives without a label row;
- the **name is a readout**. Each frame owns its evening's name and positions it into the plate's
  foot, printed only while that frame is approached (`:hover` / `:focus-within`). **No script** —
  the figcaption hangs from `.imagines-plate` and every state is CSS. The plate reads as an
  instrument with one reading slot rather than as five labelled tiles.

The foot is now **the film's foot**: readout at the left, reference at the right, both in the mono
voice at 10px — exactly where the player above prints its caption and its clock. `.primary-link`'s
arrow and rule are what made a row of photographs read as a shelf of cards with a "see all" under
it; the road to `/obrazy` is a printed reference now, not a call to action.

**A PANEL IS A DOOR.** The photograph opened the frame, the numeral went to the evening, the foot
went to the archive, and the register's own title went to the same evening 200px below — four
roads to five pages, and the strongest press on the section answered with a bigger picture. The
whole panel is a link to `/koncerty/[id]`. Three consequences, all shipped together because the
protocol is not separable:

- **The landing mounts no image lightbox at all** — not the island, not `styles/image-lightbox.css`,
  not `scripts/image-triggers.ts`. The frame belongs where a reader has already declared they want
  to look at photographs (`/obrazy`, the concert galleries). The group table in §9 loses its first
  row.
- **The printed registration mark is gone**, and so is the cursor's viewfinder over these panels
  (no `[data-image-open]` left to trigger it). Both said *expand*; the panel means *enter*. The
  touch affordance is the readout, which on the rail sits statically under its own panel and names
  where the press leads.
- **`data-cursor="no-snap"` on the plate is now load-bearing.** The magnetic snap used to be off
  here by construction, because the cursor's frame state sits above the branch that applies it.
  An ordinary link 316px square pulls the pointer 15% toward its own centre.

**The square stays, and the arithmetic that says so is worth keeping.** The audit proposed hanging
the five by their own aspects (the site's own gallery language, `layoutShots`) on the grounds that
§8's rejection was measured on a set that no longer exists — true: the line ran 1.50 · 1.50 · 1.50
· **0.56** · 1.00 then and measures **1.50 · 1.50 · 1.50 · 0.80 · 1.50** now, so the "lone 9:16
becomes a 172px strip" objection is void. It is still the wrong move, because five cells across a
fixed measure stand `measure / Σ aspect` tall: Σ = 6.80 native against 5.00 square, i.e. a line
**232px** tall at the measure and **190px** on a laptop, with the portrait 152px wide. Every
variation of shape is paid for in the one dimension §2 is about. **Tile-ness was never the crop —
it was the caption row, the CTA, the missing voice and the blackout.**

### Still open — the tonal pass

Everything here is structure. The band has **not** been calibrated for its new ground, and none of
it should be tuned from a stylesheet:

- **`frameLift` was derived on night** (0.90 · 1.08 · 1.06 · 1.22 · —). Simultaneous contrast runs
  the other way on paper: the same panel reads darker beside parchment than beside `--night`, so
  the line probably wants more lift overall and a different spread. Re-derive from a contact sheet
  at the panel's crop **and the new ground**, per §13.
- **The hover endpoints (×0.66 / ×1.16) were chosen against a dark surround.** The recession has
  more to prove on paper and the lift has less.
- **The plate's ring and shadow** are `.vplayer-stage`'s values verbatim, on a box six times as
  wide. That is the right starting point and not necessarily the right number.
- **The readout's slot** is reserved by `--foot-lead` on both boxes. Worth one look at 1280 and at
  2560, where the foot's two ends are furthest apart.
- **Panel II may still be a rehearsal frame** (§11), unchanged and for the same reason.

### Weight

Build after the pass: 15 pages, `astro check` 0 errors, `prune-orphan-assets` **66/642** — the
identical figure §12 and §13 both closed on, because the panel ladder is untouched. The landing
sheds the lightbox island, its stylesheet and its delegate outright.
