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

**§15 closes §14's tonal pass and supersedes §13 on the grade and the exposures.** It also
retires the measurement method §13 prescribed: the frame mean it asks for is the statistic that
produced the one wrong lift in the set. Where §13 and §15 disagree, §15 is what shipped.

**§17 rebuilds `/obrazy` and supersedes §7 on everything except the route, the entrances and the
JSON-LD.** Stage 3 shipped a page that arrived at the thumbnail grid §2 rejects, from the other
direction, and stood on the wrong ground for its whole life. §7 is left standing because the
reasoning that produced it is what makes the correction legible; where §7 and §17 disagree, §17 is
what shipped. §17 also changes the `gallery` schema, so it reaches the concert pages.

**§16 supersedes §13 and §14 on the band's line, and on nothing else.** The slot those passes
argued for stands; the sentence they put in it is rejected there, with the reasons, so it is not
re-proposed.

**§18 supersedes nothing. It closes one entry on §17's open list** — the ground defect is now a
build gate rather than a rule to remember. Read it only if you are editing the audit.

**§19 finishes §17 and supersedes it on the packing contract and the phone plate.** §17 shipped
the shape and left the two hardest measurements to a later pass; one of them turned out not to
work at all. It also retires `wMax` and the pixel basis from `lib/galleryLayout`, so it reaches
the concert pages. Where §17 and §19 disagree, §19 is what shipped.

**§20 closes two entries on §19's open list and corrects the second of them.** The head has an
index; the concert gallery's one-per-row breakpoint moved off 640, but to **960** rather than the
720 §19 proposed — that note did the arithmetic for the wrong page, and 720 would have left a
tablet at 213px. Where §19's open list and §20 disagree, §20 is what shipped. §20 also carries the
standing dark-frame items forward unchanged.

**§21 answers the position-indicator item §20 left open and supersedes nothing.** The orientation
question had three answers that did not know about each other; the tabula is the head's index
given back on the gesture that asks for it, on `/obrazy` and the three concert pages.

**§22 answers the two questions §9 wrote down and left, and supersedes §9 on both** — the counter
is arabic, and the two full-height halves are a POINTER's target that narrows to its own glyph
under a finger. It also corrects a claim §20 carried out of §11 and §21 repeated: the two landing
panel swaps were not unshipped, they were made on 2026-08-07 and 2026-08-10. Where §9 and §22
disagree, §22 is what shipped, and **§22's `Still open` is the current one** — it is swept against
§11, §19, §20 and §21 together.

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
than two. Where a credit is absent both colophons say so; a list of names with nothing beside it
is a claim those names took everything.

**Corrected 2026-08-10 — absence is a fact, not a gap, and a masthead is not a hand.** The founder
confirmed that a gallery entry naming nobody was shot by the ensemble itself, so `credit` names a
hand from OUTSIDE it and the surfaces print the rest as `archiwum zespołu` (`lib/photoCredit`)
rather than reporting an unrecorded author. Six hands now, in Via order: Tomasz Czajkowski,
Wojciech Przybył, Edyta Gonet, Jakub Garbacz, Kamila Grudzińska, Andrzej Płachetko.

A **third case** was found in the same pass and given its own field: `gallery[].source`, the outlet
a frame comes from where no individual photographer is on record. One entry uses it (PieninyInfo,
Wołanie Gór). It exists because "fot. PieninyInfo" hands a masthead an authorship nobody claimed —
sources are labelled `źródło:` and trail the hands, so a foot reads `Fot. archiwum zespołu ·
źródło: PieninyInfo`. Twenty of forty-seven frames now name somebody. The kolofon's `Imagines`
rubric is derived from both fields as of that date, hands and outlets in separate blocks.

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

**Amended 2026-08-14 — a fourth entrance, inside the KONCERTY register.** "No nav slot" still
holds and should keep holding: the archive is not a fifth voice in the bar beside O NAS /
KONCERTY / KONTAKT / WESPRZYJ. What it now has is a subordinate line *inside* the section whose
photographs it holds, on both surfaces that index that section — `.registrum-all`, the closing
line of the desktop drop (`styles/registrum.css`), and `.via-all`, the closing entry of the
mobile card's Via (`styles/nave-menu.css`). Both are marked as NOT a sixth concert by what they
lack: no roman numeral, and on desktop no silk and no leader (a leader would run out to a tip
that does not exist, which the staircase's geometry forbids). The mobile row costs one `--vrow`
and the card's band divisor was recounted with it, 9.07 → 9.49; the scroll floor moves from ~588
to ~612px of usable height. The reason for reopening the decision is that the footer's Index
column is the only entrance a reader on `/o-nas` or `/kontakt` has, and the register is where
this site answers "what else is under here".

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

**It joined, 2026-09-04.** The archive is `/obrazy`, `/en/obrazy` and `/fr/obrazy` over one shared
`components/pages/ObrazyPage.astro`, its nine copy fields are on the copy desk and translated, and
the entrances above localize themselves — the footer's Index column and the register's closing line
now point a foreign reader at their own archive. Two things came with it: a venue's name is a label
this site publishes in three languages (`i18n/content/miejsca.ts`), which also fixed the Polish run
heads every foreign concert page had carried since its own fork; and the scale line's nouns decline
per locale. Recorded in docs/web-copy-desk-2026-09.md §6x. **"No nav slot" still holds** — nothing
about being translated makes the archive a fifth voice in the bar.

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
- ~~**Photographer credits for the thirty-two frames that name nobody.**~~ — **closed 2026-08-10**,
  and not by filling them in. The founder settled the provenance: an entry with no `credit` is the
  ensemble's own frame, so there was never a gap to close — only a wrong word for it. Four more
  hands were credited in the same pass and the surfaces now print `archiwum zespołu` for the rest
  (`lib/photoCredit`); `/obrazy`'s invitation to claim an uncredited photograph is gone with it.
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

It gains a line, set a grade under `.section-title`, because movement II would otherwise be three
titled sections in a row. The copy §13 chose — **"Tak wyglądała ta cisza."** — is superseded by
**§16**, which keeps every structural claim in this paragraph and rejects that sentence; the slot
itself is the part of §13 that stands.

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

**The band was the one section on this landing with no voice — again.** §13 shipped a line and it
was commented out afterwards, so the audit that started this pass found the exact state §13 had
diagnosed: a 10px rubric and a strip of pictures on a page where every other surface sets a line.
It is back, and this entry exists so that the next reader knows the slot is load-bearing rather
than decorative — if the copy is wrong the answer is different copy, never an empty head. (Which
is what §16 then did: the sentence was wrong, the slot was not.)

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

### Still open — the tonal pass — CLOSED IN §15

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

---

## 15. The tonal pass — SHIPPED

§14 left five questions and called them a calibration. Four were calibration. The first was not: the
band's largest tonal defect was not an exposure at all, and the statistic §13 prescribes for finding
it could not have found it.

### The shared grade was punching holes in the page

`contrast(1.06)` is a linear transfer with slope 1.06 and intercept −0.03, so every pixel under
**2.83% luma renders as literal #000**. These are chiaroscuro frames from dark naves. Measured at
the band's crop, the share of each panel the grade alone took to pure black:

| Panel | Evening | #000 in the source | #000 after the grade |
|---|---|---|---|
| I | Wcielenie | 4.5% | **14.2%** |
| II | Wołanie Gór | 0.5% | **42.2%** |
| III | 9 Kart | 0.0% | 0.8% |
| IV | Hymn Poległym | 2.1% | **23.3%** |
| V | Aeternam | 0.0% | **10.7%** |

Two fifths of panel II was being rendered at a value that is **not in this site's palette** — the
darkest token is `--night` (#100f0d). On the night ground of §8–§13 that was invisible arithmetic: a
#000 region beside `--night` is a 1.5% step, which is why nobody measured it across three passes.
On parchment each of those regions became the deepest mark the display can make sitting next to the
brightest, and that — not the exposures — is what made the dark panels read as holes rather than as
photographs.

`contrast` is dropped from all three of the band's states. Every surface that shares it (02, 03, 04)
pairs it with brightness 0.62–0.92, because it is there to make a **ground** recede and crushing a
ground's shadows is the point; §13's own sentence, *here the photograph is the SUBJECT*, decides
this the same way it decided the scrim. Removing it returns **13% of mean luma across the line and
costs no highlight anywhere** — every panel's clipped share went down or held. The punch it is
imagined to be adding is 6% of contrast on a photograph nothing is set over.

### The frame mean cannot tell a dark room from a dark subject

§13 prescribes "mean luma at the band's crop and grade", and that instrument reads panel II — a
close-up of two singers against a **black studio backdrop** — as the second-darkest frame in the
line and asks for a lift. Its subject was already the second *brightest*. What was dark was the
room, and 42% of the frame is room.

The statistic is now the mean of the panel's brightest 40% (`> p60`), which agrees with p90 to
within 0.02 on every panel and disagrees with the frame mean on exactly one — II. The line:

| Panel | frame mean | **lit-mean (>p60)** | shipped lift | derived lift |
|---|---|---|---|---|
| I | 0.188 | 0.376 | 0.90 | **0.97** |
| II | 0.126 | 0.285 | 1.08 | **1.09** |
| III | 0.132 | 0.243 | 1.06 | **1.16** |
| IV | 0.093 | 0.186 | 1.22 | **1.16** |
| V | 0.224 | 0.427 | — | **1.08** |

Each panel takes **40% of the distance to the geometric mean in log space, times 1.08** for the
parchment ground — partial, per §13, and it lands at a lit-line ratio of 1.92× against 2.08×
before. Two panels are deliberately off the arithmetic:

- **IV is capped at 1.16 where the derivation asks 1.29.** Past ~1.20 the blue wash filling the
  middle of that nave clips and the window flattens into one saturated field; the clipped share runs
  0.7% → 1.5% → 2.8% at 1.16 / 1.22 / 1.29 for 0.008 of mean each step. It stays the line's dark
  end, which is honest — it was the darkest evening. Same trade §13 refused when it changed that
  evening's photograph rather than lift it harder.
- **V is not damped back toward the middle**, which §13 settled (0.86 "only cost the gilt"). It
  takes the ground gain alone, so the equalisation runs upward from the dark end rather than
  downward from the bright one.

The ×1.08 is the whole of the parchment compensation, and deliberately small: removing the crush had
already opened the line by 13% in the right way — by returning shadow detail rather than by
multiplying what survived. ×1.15 was rendered and rejected; the naves go milky and the terracotta
pushes orange.

### The hover endpoints were right, and the reason to doubt them had the sign backwards

§14 expected the recession to have "more to prove on paper". It has less. A receding panel used to
darken toward a dark ground, spending most of the ratio on a difference the eye could not find;
against parchment the same ratio widens the gap to the surround, so **×0.66 reads as more recession
on paper than it did on night**. Shallower endpoints (×0.76 / ×1.10) were rendered side by side and
the plate stops reading as one object with one lamp on it. Both endpoints stand. The `contrast`
differential the three states carried (1.06 / 1.06 / 1.04) goes with the base grade's: two points of
contrast are invisible, and all it did was crush the shadows of the one panel the reader had asked
to look at.

### The readout was 2px out on both axes, by construction

`.imagines-name` compensated for `--score` on both axes, on the stated grounds that it "is
positioned against the plate's PADDING box". An absolutely positioned child hangs from its
ancestor's **padding edge** — the outer edge of the padding, which for a box with no border is the
border-box edge. The plate draws its ring as a `box-shadow` and has no border, so `left: 0` and
`top: 100%` already resolved to the plate's left and bottom. Spending the scoring back put the
readout 2px left of the head it hangs under and 2px below the reference it shares a baseline with —
the foot's one job undone in both directions. Measured constant at 1280 / 1440 / 1920 / 2560, so
construction rather than rounding; **now 0.0px at all four.**

The slot itself is fine and the `max-width: 62%` guard has never fired: the longest readout sets
391px, against 714px of room at the narrowest desktop and 980px at the measure. It stays for the
sixth evening that would be the first to need it.

### The rail's readout had no rhythm

Below the 420px cap the panel is 74vw and the readout no longer fits one row — but only for three of
five evenings, so the strip a reader carries sideways was **2 · 1 · 2 · 1 · 2** rows tall, and the
flex row hands the tallest caption's height to all five so the short ones sat over dead paper. The
wraps fell where the line ran out rather than where the sense breaks: `…· STYCZEŃ / MMXXIV` left the
year alone.

The date takes its own line now and the separator before it goes with it — name above, dateline
below, which is `.aether-inscription`'s figure. Every panel is **two rows at every width down to
360**, where the longest name (Aeternam, 244px) still clears the 266px panel. The boundary is
**567.98px**, which is the band's own: `clamp(238px, 74vw, 420px)` reaches the cap at 567.6px, the
same place `sizes` stops declaring 76vw. Above it all five fit one row and there is nothing to fix.
The date owns its mid-dot in the markup so the sheet has something to hide.

### The shadow is not too much, and "six times as wide" was never true

A `box-shadow` with a negative spread is **edge-local** — nothing about it scales with the box.
Sampled on the page at 1920, the paper under the plate and under the film darkens **21% at the edge
and is back within 1% of parchment 70px down**: the same pool under a plate 1580×318 as under a film
880×495, which is **1.8× the edge length**, not six. What that leaves is a pool worth 22% of the
plate's height against 14% of the film's, and at this weight the difference reads as the plate
sitting slightly closer to the page — which is what a contact strip should do. Unchanged.

### Still open

- **Panel II may still be a rehearsal frame** (§11), unchanged and for the same reason: that gallery
  needs another photograph from that night more than it needs a different choice. §15 adds one fact
  to the file on it — II is also the only frame in the line whose blacks are a **backdrop** rather
  than a building, which is what a rehearsal frame looks like when measured rather than looked at.
- **The numeral link redundancy** (§13), still waiting on what a press on a photograph should do.

### Weight

`astro check` 0 errors / 0 warnings, 15 pages, `prune-orphan-assets` **66/642** — the same figure
§12, §13 and §14 all closed on, because nothing here touches the crop or the ladder. Every number in
this section was measured with `sharp` at the panel's own crop (316×316, `fit: cover`, centre) or
sampled off the rendered page in Edge; the CSS filter chain was reproduced in sRGB and validated
against §13's published figures before any of it was used to decide anything.

---

## 16. The band's line — SHIPPED

One sentence, and everything structural about it — the slot, the grade under `.section-title`, the
couplet with the film, the ban on being about sound — is §13's and stands. Only the sentence
changed. The band now sets:

> Z tego głosu — **pamięć.**

**Why the old line failed, in the order a reader feels it.** "Tak wyglądała ta cisza." was written
as a couplet with the film, and as a couplet it closed a circle instead of a distich. Movement II
runs **silence → voice → memory**: `tacet.` is the silence, the film converts it ("Z tej ciszy —
głos."), and the band stands at the turn to the third term. Naming the silence there walks the
reader back two sections to a term the page has already spent — at the one point in the movement
where its own name, *Vox memoriae*, says what comes next.

Second, the line contradicted the object it was set over. These are photographs of evenings on
which people were singing, and the register 200px below says so in as many words ("Co już
zabrzmiało."). Everything else on this landing is literally true of what it stands on — "Światło
prowadzi słuchacza." over a lit nave, "Z tej ciszy — głos." over the film — so the band was the
one surface whose claim a reader could check against the picture and find false.

Third, it was the third spend of the site's most expensive word inside ~600px (`tacet.` → "Z tej
ciszy" → "ta cisza"). The hero owns "Z ciszy głos.", the film is a deliberate reprise; a third is
an echo of an echo. And "**ta** cisza" needed an antecedent carried across a video player, while
the past tense made the silence an episode where the rest of the site holds it to be the source
("z ciszy i kontemplacji", `EnsembleSection`).

**Why this one.** It is the film's own construction — same syntax, same dash, same gold `<em>` on
the last word — so the two are visibly one distich rather than two headings, which is what §13
asked for and did not get. Its terminus is the movement's third term, i.e. the vernacular of *Vox
memoriae*, arriving exactly where the movement turns; and it announces both halves of that turn at
once, the band being memory in images and the register memory in words. It touches sound only as
the thing it is leaving — the subject of the sentence is `pamięć`, so §13's "not about sound" rule
holds in substance, which is what that rule was protecting.

At `max-width: 22ch` the line breaks before the last word, so the gold `pamięć.` hangs on its own
row — the same figure the previous line had. Nothing in `14-imagines.css` changed.

### Rejected — do not re-propose

- **"Tak wyglądała ta cisza."** — the three defects above. If a line about silence is ever wanted
  in this band, it is the wrong movement for it: the silence belongs to `SilenceMoment` and the
  hero.
- **"Z tego głosu — obraz."** — the same construction ending on what the band literally is, and it
  pairs rubric to line the way the film does (*Vox* → głos, *Obrazy wieczorów* → obraz). It loses
  on measure: 21 characters fits inside 22ch, so the gold word stops hanging and the couplet
  flattens to one row. It also stops at this section, where `pamięć` carries into the register.
- **An empty head**, for the reason §14 already gives.

---

## 17. `/obrazy` rebuilt — the run becomes the unit — SHIPPED

The founder's reading: *"była robiona super na szybko i teraz to jest bardziej zepsuty szablon niż
strona"*. Measured against the emitted build that is exactly what it was, and one of the defects
behind it was not a design defect at all.

### The page rejected the grid in §2 and then produced one

**Forty of the forty-three photographs are 3:2.** `layoutShots` chooses `perRow` from the set's
mean aspect, so for this archive it resolved to three-up every time:

| Evening | n | rows | shot width |
|---|---|---|---|
| Wcielenie | 9 | **3+3+3** | 364px |
| 9 Kart | 15 | **3+3+3+3+3** | 363px |
| Aeternam | 9 | 3+2+2+2 | 272 / 408px |
| Wołanie Gór | 6 | 3+2+**1** | 352px |
| Hymn Poległym | 4 | 4 | **217 / 308px** |

Twenty-four of the forty-three sat in a literal uniform three-column grid, fifteen tiles deep. The
packing was not at fault: it was written for a set with variety, hung inside a longer document, and
here it was the whole page and the set had nothing for it to answer. Hymn's four portraits packed
4-up at 217px, which is §2's black rectangle to the pixel.

The short rows made it worse rather than better. `justify-content: center` plus `--w-max` floats
every remainder, so Wołanie ended on one 352px frame centred under three and Aeternam ran 3+2+2+2.
A grid with holes reads as breakage where either a grid or a free hang would not.

### Forty-three captions carried nine facts

Under 9 Kart the page printed *"Koncert 9 Kart w Bazylice NSPJ w Krakowie"* **six times
consecutively**. Hymn Poległym printed its own `<h2>` back at the reader four times. All of it in
10.5px letterspaced uppercase — the site's loudest small voice — under every single frame. This is
the caption row §14 removed from the band and called a card grid, at ten times the density.

**The repetition was a symptom: the data already had a structure the page did not print.** Each
evening divides into RUNS — the rehearsal, the night, and for 9 Kart one per city — and the YAML
encoded it all along, in `alt` strings and in adjacency. Ten runs across forty-three frames.

### The run is now the unit of the layout and of the text

`lib/galleryRuns.ts`, shared by `/obrazy` and the concert pages. `gallery[]` gains `moment`
(`rehearsal` | `concert`), `venue` and `date`; the forty-three prose captions are gone and
`caption` survives in the schema for the per-frame note none of them was. A run is drawn from
**adjacency, never by collecting matches** — two visits to one church a year apart are two runs and
must stay two — which is why the gallery's stored order is now a stated contract.

A rehearsal inherits **nothing**. Its room was never recorded, and handing it the concert's venue
would assert a place on no evidence; its inscription is the word `Próba` alone.

**Every run is a PLATE and a SHEET.** The run opens on one photograph at up to 904px with its place
and date printed once in the margin beside it, and the remainder hangs under it at the shared
packing. `--plate-w` is computed (`min(904, 700 × ar)`), so a portrait plate ends where the
photograph ends and its inscription stays against it instead of drifting across empty measure. The
emitted line: eight plates at 904, one at 700 (Mistrzejowice, square), one at 560 (Hymn, 4:5) —
against sheet rows at 245–570. That alternation is the whole rhythm; the ground never turns,
because §7's argument for one room still holds.

The thresholds are **ruled** instead. Each evening opens on a full-bleed hairline in its own
candle, drawn left→right by the LEAD register — the border is real for a no-JS or reduced-motion
reader and handed to the pseudo-rule only under the motion gate, and it is anchored to the
section's top, which is where the trigger fires. Five hairlines the design already had, none
invented to have something to animate.

A **rail** was added on `/koncerty`'s own contract (`data-via-num` / `-date` / `-step`, one
IntersectionObserver). This is the site's second-longest page and it was the only long one with no
position at all. And the head now states the archive's scale — `43 fotografie · 5 wieczorów ·
7 miejsc · 2024–2025` — **counted at build**, with Polish plurals computed, because a page that
states its own numbers wrongly is worse than one that states nothing.

### The ground was never applied, and the rule that generates

**`/obrazy` stood on parchment with every line of its copy set in `--paper` — text in the colour of
its own background — from the day it launched.**

```
<body class="page-obrazy">                            ← no cid
.page-obrazy[data-astro-cid-zuxexoyc]{background:…}   ← rule demands one
```

A page's scoped `<style>` appends `[data-astro-cid-…]` to every selector, and `<body>` is rendered
by **BaseLayout**, not by the page — so a bare `.page-obrazy` compiles to a rule that cannot match
anything. Nothing catches it: `astro check` sees valid CSS, the register audit reads the cascade it
owns rather than the ground, and the build is green. It survived several passes over this file.

Three pages had it — `obrazy`, `kolofon`, `koncerty/[id]` — and `/obrazy` inherited it from the
concert page it was built from, where the defect is invisible because every `.kd-band` paints its
own ground. `koncerty.astro` and `press.astro` had it right all along. The sibling rule two lines
below it in the same file was also right (`:global(body.page-obrazy.image-open)`), which is the
part worth remembering: the author wrapped the scroll-lock and not the ground.

**THE RULE: any rule reaching `<body>` or `<html>` from a page's scoped `<style>` needs
`:global()`.** It is now **R11 in the register audit** (§18), so the rule is enforced rather than
remembered.

### `plate:` — the one flag, and it was earned by measurement

The plate defaults to the run's first frame, which is right for nine of the ten because a run opens
where the evening did. Hymn's does not. Measured over all forty-three originals (sharp, resized to
300px, Rec.709 luma):

| Frame | mean | p90 |
|---|---|---|
| `kd-hymn-0` | **9** | **24** |
| `kd-hymn-1` | 13 | 35 |
| `kd-hymn-2` | 20 | 48 |
| `kd-hymn-3` | 42 | 64 |

`-0` led its run and stood 698px tall as a black rectangle — 94% of it under luma 40. `-3` is the
only frame of the four with tonal range left, so it carries `plate: true`. The lever is the same
one, for the same reason, as `Path.frame` on the band (§8), which is why it is a flag here and not
a reordering: the gallery's order is a claim about when the frames were taken and must stay true.

### 9 Kart was reordered into the order the tour ran

Rybnik 8 IX → Łódź 17 IX → Kraków 16 XI, which is the order `dates` already states and the order
`prologue` relies on when it calls Kraków *"trzeci wieczór tego programu, po Rybniku i Łodzi"*. It
previously opened in Kraków and closed with three "po koncercie" frames filed together, one per
city — so each city's own coda sat six lines from the evening it closed. Runs are drawn from
adjacency, so a frame out of order is a run out of place. This is an editorial change and the
easiest thing in the file to revert.

### Rejected — do not re-propose

- **Mirroring the plate's margin left/right per run or per evening.** The asymmetry it buys is
  real, and on ten runs it reads as a zigzag rather than as a page. Marginalia sit on one side of a
  codex. The rhythm is plate-against-sheet, which is a change of scale and not of side.
- **Fixing the tail rows by rewriting `layoutShots` into a per-row justified packer.** It is the
  right algorithm and the wrong moment: §11 kept the packing shared precisely so a correction lands
  on both surfaces at once, which means this one wants both pages open and the founder's eye on it,
  not a drive-by while the page above it is being rebuilt.
- **A hero photograph.** §7's argument is unchanged and now has a second half: the first plate
  arrives one screen down at 904px, which is the opening a hero would have been asked to fake.
- **Per-frame `ImageObject` in the graph.** Still §11's answer, still waiting on GSC numbers.

### Still open

- **The tail rows inflate.** Wcielenie's concert run and Niedzica both end 3+2, and the two-frame
  row grows to **508×339 against 367×245** above it — 38% taller, at 89% of the measure. That is
  `wMax = min(w × 1.4, maxHeight × ar)` doing what it was written to do on a set that no longer
  needs it. Pre-existing, shared with the concert pages, and the fix is the rejected item above.
- **Two frames in Aeternam's sheet are black rectangles** — `kd-aeternam-1` at mean 10 / p90 19,
  `kd-aeternam-4` at 20 / 39. Nothing in code answers this; an archive shows what exists, and
  `plate:` already keeps them out of the one slot where it would matter.
- **9 Kart's Kraków run opens on a photograph of the printed programme** (`kd-9-kart-0`, mean 145 —
  the brightest frame in the archive). At plate scale it reads as a document opening a documentary
  run, which is why it was left; if it reads as a leaflet instead, `plate:` is the lever.
- ~~**The `.page-…` / `data-astro-cid` check is not in the register audit.**~~ — **shipped, §18.**
- **On a phone the plate keeps its rank by full bleed** — it breaks the page's gutter and drops its
  border and shadow, because otherwise plate and sheet are the same width and the rhythm is gone on
  the case that matters most. Built and measured (no horizontal overflow) but **not yet looked at**.

### Weight

`astro check` 0 errors / 0 warnings across 110 files; 15 pages; register audit **956 nodes,
clean**; `prune-orphan-assets` **66/652** — ten more emitted images than before, which is exactly
one new rendition per plate, because the plate's top candidate is deliberately 1920, the same
transform `framedShot` already requests, and the two dedupe to one file.

Length at 1440×900: `/obrazy` **15 427px**, against `/koncerty/9-kart` 16 605, `/press` 18 358 and
`/o-nas` 14 192. The archive is mid-pack, not the outlier the plate scale suggested it would be.
Phone (390×844): 16 367px, no horizontal overflow, rail correctly absent.

---

## 18. The ground defect becomes a build gate — SHIPPED

§17 found `/obrazy`, `/kolofon` and `/koncerty/[id]` standing on a ground that had never been
applied, stated the rule, and left the enforcement open. It is **R11** now:
`checkScopedRootRules` in `audit/checks.mjs`, wired into the run in `audit/index.mjs`, five tests
in `audit.test.mjs`. An error, so the build stops.

**It decides by matching the emitted HTML, not by the grep §17 proposed.** The grep — selectors
carrying both `.page-` and `data-astro-cid` — finds the three pages that had the defect and
nothing else. R11 asks the question underneath it: *does this scoped compound address the document
root, and can it reach it?* A compound is taken as addressing the root when it names `html`/`body`
by tag, carries `:root`, or matches an emitted `<html>`/`<body>` once the scope attribute is
stripped off — that last case being the shape the defect actually shipped in, since the source
wrote only `.page-obrazy` and BaseLayout is what put the class on the body. If the compound as
emitted then matches no root on any page, the rule is dead and R11 says so.

Three things the wider question buys. It catches the defect written as `body { … }` or
`html.voct-motion .x { … }` inside a scoped block, which the grep does not see and which is the
same error one keystroke away. It catches an ancestor demand (`body[cid] .kol-line[cid]`), not
just a key compound. And it does **not** fire on a rule that reaches its element — a cid on the
root is absent from this build, not impossible, and a pattern check would have called that one
too. The exclusions are as deliberate: `*[cid]` covers the root the way it covers everything,
which is not the same as being aimed at it.

**Proof it fires.** Not the unit tests — those are in the file and are the usual kind. The
end-to-end one: `:global()` was taken back off `obrazy.astro`'s ground rule and the site rebuilt.
R11 reported `.page-obrazy[data-astro-cid-zuxexoyc]` against `<body.page-obrazy>`, named the two
declarations that never applied, and failed the build. That is the defect verbatim as §17 records
it, down to the cid.

**Weight.** 956 register nodes across 16 pages, clean; R11 adds no finding to the site as it
stands and cost nothing measurable (it tests scoped compounds against ~30 root elements, not
against every node). `dist-verify/` is now in `web/.gitignore`: it is the standing way to read a
finished build without disturbing the `dist/` the developer keeps serving, and it was one
`git add -A` away from putting a 500 MB build into the repo.

### Rejected — do not re-propose

- **The grep, as a script.** It is the right instinct and the wrong home: a second tool that reads
  the build would need its own root-finding, its own report and its own proof that it ran — all of
  which the audit already has, and R0 already fails the build when any of it reads nothing.
- **Warning instead of erroring.** Every rule this catches is invisible in review, green in
  `astro check`, and wrong for as long as nobody looks. That is the definition this audit uses for
  an error.

---

## 19. Finishing the rebuild — the packing stops growing — SHIPPED

An audit of the page as it stood, measured rather than read: the build in `dist-verify`, geometry
read out of Edge at 1440×900 and 390×844, and Rec.709 luma over all forty-eight originals through
sharp. §17's shape held up. Two of the things it left for later did not, and one of them had never
worked at all.

The archive is **48 photographs in 10 runs across 5 evenings** as of this pass, not the 43 §17
counted — the page has always counted them at build, but every comment in the file had the old
number typed into it, and one had 47. Those are gone; where a count is load-bearing in prose it
now says what the thing is instead of how many of it there are.

### The phone plate was never full-bleed. It was the sheet's width, off-axis.

§17 gave the plate a full-bleed on phones because otherwise plate and sheet come out the same
width and the rhythm is gone on the case that matters most. It recorded the result as "built and
measured (no horizontal overflow) but not yet looked at". Both halves of that are true and the
measurement was of the wrong thing.

```
viewport 390 · page gutter 28 · scrollWidth 390 (no overflow, correctly)
plate figure   0 → 334   (334 wide)
sheet figure  28 → 362   (334 wide)
```

The negative margins were doing nothing. `.im-shot--plate` carries `max-width: 100%` — from the
desktop rule and again from the sheet's own phone rule — so the box is over-constrained: the
browser keeps the width, drops the trailing margin, and the plate lands at **exactly the sheet's
width, shifted one gutter off the page's axis**. There is no overflow because there is nothing
overflowing. `max-width: none` in the ≤720 block is the whole fix; the plate now measures 0 → 390
at 390, 0 → 414 at 414, 0 → 720 at 720, with no overflow at any width tested (360 … 1920).

**The rule this generates: a negative margin under an inherited `max-width` is a no-op that looks
like a fix.** It is invisible in review, green in every gate, and the natural test for it — a
horizontal-overflow check — returns the answer that says it works.

### Nothing grows any more, and the basis is a share rather than a pixel

§17's open list had the tail rows inflating and rejected the fix as "the right algorithm and the
wrong moment". This is the moment: the page above it is no longer being rebuilt, and the change
turns out to be smaller than a justified packer.

`wMax` is gone. It let a short row inflate 40% to fill its line, which is right for a gallery with
variety hung inside a longer document and wrong for an archive that is 40 landscapes in 48 frames.
Measured at 1440, before → after:

| Run | rows before | rows after |
|---|---|---|
| Wcielenie · NSPJ | 3 @ 367×244, **2 @ 508×339** | 3 @ 364×242, 2 @ 363×242 |
| 9 Kart · Kraków | 3, 3, **1 @ 508×339** | 3, 3, **1 @ 363×242** |
| Hymn · Mariacka | 4 @ 387, **1 @ 650×436** | 4 @ 302, 1 @ 452×303 |
| Aeternam · Niedzica | 3 @ 367×245, **2 @ 508×339** | 3, 2 — all @ 242 |

A lone frame 38% taller than the two rows over it is not a remainder hung centred, it is the shape
a reader takes for a mistake.

**And the basis is now `--share`, a fraction of the measure, not `--w` in px.** This is the second
half of the same defect and it was not on anyone's list. A px basis freezes the geometry at 1180:
below that width a full row shrinks to fit while a short row, already fitting, stands at its full
size — so every laptop narrower than the measure got the tail-row defect back, at a smaller
amplitude, no matter what `wMax` said. The share scales with whatever container it lands in, and
the gap it was sized against scales with it (`3vw` against a measure that is itself ≈90vw), so the
row keeps its ~1% of slack at any width. The contract is now
`flex: 0 1 calc(var(--share) * 100%)` with the same `max-width`, stated in `lib/galleryLayout`'s
header, and `--ar` / `--w` / `--w-max` are off both pages' markup. `w` survives in the API for
`sizes`, which is a statement about the widest case and belongs in px.

**This lands on the concert pages too**, which is why §11 kept the packing shared.
`/koncerty/9-kart`'s Kraków run ended 3+3+**2 @ 508×339** by the old arithmetic and now ends
3+3+2, all at 363×242.

### The sheet's height now comes from the plate standing over it

The alternation §17 called "the whole design brief" was accidental. `layoutShots` sizes a row to
fill the measure, so the sheet's scale came from how many frames a run happened to have left over:

| Run | plate | sheet, before | ratio |
|---|---|---|---|
| Aeternam · Mistrzejowice | 700×700 | **570×570** | **81%** |
| Wcielenie · Próba | 904×602 | 570×380 | 63% |
| Hymn · Mariacka | 904×606 | 650×436 | 72% |
| 9 Kart · Kraków | 904×604 | 367×245 | 41% |

The same page ran a rhythm of 1:2.5 in one run and 1:1.2 in the next. `SHEET_SCALE = 0.5` in
`obrazy.astro` states it once: the sheet's `maxHeight` is half the plate's height, passed per run.
A **ceiling, not a target** — a long run still fills its measure and comes out well under it, so
Kraków's 242 is untouched while Mistrzejowice goes 570 → 350 under a 700px plate and Hymn's tail
goes 436 → 303. Every run now reads as one thing over another thing half its size.

### The plate's measure is clamped to the source

`min(904, 700 × ar)` never looked at `img.width`. `kd-wolanie-4` is a 900×615 scan and led a run:
it was handed a 904px slot and decoded at 903 — upscaled, with no rendition above it to reach for
on any 2× screen, so the one frame that run opens on was its softest. Clamped now (`slot 900 ·
decoded 900`). The sheet had always done this; the plate had not.

### Every evening is an anchor

`/obrazy` is 15 000px long and had no `id` on anything. Both roads into it from a concert page —
the gallery's foot and the exit under every lightbox frame — landed at the head, so a reader
coming from *Aeternam* had to find their own place before they could reach the evenings on either
side of the one they had just read. `id={e.id}` on `.im-evening` with `scroll-margin-top: 96px`
(measured: section top lands at 96 against a fixed chrome ≈84 tall, so the threshold hairline —
the thing that says which evening this is — clears the bar). `/koncerty/[id]` now links
`/obrazy#<id>` from both. The label stays "Obrazy wszystkich wieczorów": the destination is the
whole archive, the anchor is only where you enter it.

### The rail's breakpoint was a number nobody had done the arithmetic for

The markup said it hides below 980, the stylesheet said 1180, and neither is the width at which
the rail stops lying on the photographs. The rail's right edge stands at `max(16, 2vw) + 84`; the
column's left edge at `max(28, 5vw)` plus whatever centring survives once `.im-wrap` caps at 1180.
At 1280 that is **110 against 64 — 46px of numeral on the frame**. They clear at 1440 and not
before (measured: rail right 113, column 130). `@media (max-width: 1439px)`.

The cost is real: the rail is now absent on a 1366 laptop, which is a common width. The
alternative is a narrower rail that drops its date below 1440, and that is a design change rather
than a correction, so it is not in this pass.

### Weight

`astro check` 0 errors across 114 files. Register audit **964 nodes across 16 pages, clean**
(1 note, the standing R10 dark-frame list). `prune-orphan-assets` 72/609, unchanged. Full-scroll
transfer over 48 photographs: **1.55 MB at 1440, 2.27 MB at 390** — the page is not heavy and does
not need paging.

Length at 1440×900: `/obrazy` **15 792 → 14 960px**, the sheet cap paying for itself. Phone
(390×844) 17 743 → **18 136px**, which is the plate becoming full-bleed and is the point.

### Rejected — do not re-propose

- **A per-row justified packer.** Still the textbook answer and still not needed: removing the
  inflation and moving to a share does what it would do, in two declarations, without teaching
  `layoutShots` to compute rows the flex line is going to compute anyway.
- **Automated exposure lift for the dark frames.** §15 built the frame-mean method and retired it
  in the same pass, because the statistic cannot tell a dark room from a dark subject. Nothing
  here changes that.

### Still open

- **9 Kart's Kraków run is one lit document over seven dark frames.** Measured (mean / p90 at
  300px): the plate `kd-9-kart-0` is 145 — a photograph of the printed programme, the brightest
  frame in the archive — and the seven under it run 36, 27, 29, 36, 26, 47, 50. It is also the
  longest run on the page. The levers are the founder's, not the code's: re-export two or three
  with more lift from the originals, or give the run fewer frames at a larger scale. `plate:` on
  `kd-9-kart-8` (mean 104, the only other frame with range left) is the cheap half-measure.
- **Eight more frames sit under p90 60**, i.e. at the edge of legibility in the sheet:
  `kd-aeternam-1` (10/19), `kd-hymn-0` (9/25), `kd-hymn-5` (25/33), `kd-hymn-1` (13/35),
  `kd-aeternam-4` (20/38), `kd-hymn-2` (20/47), `kd-9-kart-5` (26/52), `kd-9-kart-3` (29/58).
  R10 already names two of them on the asset side. An archive shows what exists; this is the note,
  not a defect.
- **`/koncerty`'s own via-rail hides at 980 against a 1120 measure**, which is the same sum this
  section did for `/obrazy` and probably the same answer. Not touched here — that page was not
  what this pass was auditing, and its stations are a different geometry.
- **The concert gallery goes one-per-row at 640, and the band above it is small.** Measured at a
  700px viewport its Kraków run packs three-up at **194×130** — §2's black rectangle, on a tablet.
  Pre-existing and unchanged by this pass (the old px basis shrank to the same 196), and `/obrazy`
  already breaks at 720 rather than 640. Same one-line decision, different page.
- **The head still has no index.** The page states its scale (`48 fotografii · 5 wieczorów ·
  7 miejsc · 2024–2025`) and now has anchors to link into, but nothing at the top that uses them.
  Five evenings, numeral, count, link — in the `registrum` idiom the desktop nav already owns.
  This is the one item on the list that is a design decision rather than a correction.
- **The trigger markup is copied between the two galleries** — `<figure>` + `<button>` + twelve
  `data-image-*` attributes + `<Image>`, with the `widths` ladder and one `sizes` breakpoint
  differing. So is the resolve → runs → framed pipeline above it. A `PhotoFrame.astro` and a
  `lib/galleryModel.ts` would make the trigger contract one thing. Purely housekeeping, which is
  why it keeps losing to everything above it.

## 20. The head gets an index, and the gallery's floor turns out not to be a phone number — SHIPPED

Two items off §19's list. One was a design decision and went the way it was briefed; the other was
filed as a one-line change, and the measurement says the line §19 proposed would have fixed a third
of it.

### The index — a table of contents, not a toolbar

`/obrazy` states its scale and has an anchor on every evening, and until now nothing at the top
used either. It has five entries now, under the scale line, in the grammar the desktop registrum
already owns: a fixed numeral column so five titles align on one left edge, the Polish name, a
hairline LEADER ruled out to the count of frames, and the evening's Latin hanging indented under
the title as that entry's own colophon.

Two compositions were drawn before anything was written. The one not taken quoted the page's own
**threshold** five times — a full-measure hairline per evening in that evening's candle, with the
name standing on it — which is the more site-native reading and is width-agnostic, so it would not
have degraded on a phone. It lost on the brief: the leader is what makes a codex's index an index,
and five dyed full-measure rules stacked 48px apart in a head risk reading as a chart's legend,
which is the trap `registrum.css` names in its own history ("five flat colour fields in a chrome
whose site shows flat colour nowhere else"). The silks did not travel with the grammar and must
not be re-proposed here: a silk is an object slipping through the slot of a book block, and a page
has no slot. **What the register's dyes do on the chrome, the numeral does here** — the same place
every evening head on this page already puts its candle.

The Latin tier costs nothing to author: `base.css`'s two-tier rubric already turns a `.micro`
carrying a `.lat` into capitalis caps over a mono gloss, so `INCARNATIO · sty 2024` is one span and
a class. Its ink is quieted rather than left at candle, for the same reason the evening heads quiet
theirs — the numeral is already carrying this evening's light.

### The index does not fit above the fold, at any desktop size, and cannot be made to

Measured, because it looked close enough to try: the scale line ends at **617** and stays there
(the head's clamps are saturated from ~1250 up), and the index runs **669 → 1146**. That is 66px
short at 1920×1080, 246px at 1440×900, 378px at 1366×768. Fitting 1440×900 means cutting 246px;
collapsing every row to one line saves 170 and costs the Latin the brief asked for. **The phone is
the case that nearly fits** — 482 → 855 against 844 — because the desktop head is the taller one.

So the index is not a first-screen object. It sits in the gap between the head and the first plate,
which is the gap the reader crosses on their first scroll gesture. That is a fact about the page,
not a defect to keep re-attacking: the head's opening is the argument §17 made against a hero, and
trading it for five rows of navigation would be trading the page for its own signpost.

### An authored stagger is a claim about what enters together, and here it was false

The rows were first given `calc(0.27s + var(--i) * 0.09s)` — the natural reading of "five rows in
sequence". Measurement killed it: only the first two are inside the trigger line at load, and rows
III–V each cross it **alone**, later, on the reader's own scroll. A stagger authored for five
arrivals then spends its whole range on rows that have no one to be staggered against — it stops
being a cadence and becomes latency on a row you just reached. The base is the lede's own
`data-d="2"` now, so the worst lone arrival is 0.54s, inside the ~2.0s a choreography has before it
leaves the top of the screen.

**The rule this generates: before authoring a stagger, measure which of the nodes actually cross
the trigger in one callback.** `--i` is a claim about simultaneity, and nothing checks it.

Same class of defect, same block: the leader was drawing on `--rule-in` (0.85s), which is the clock
of a hairline spanning its block's whole measure. A leader is bound to a title at one end, and both
of the site's other index surfaces draw theirs in ~0.38s; on `--rule-in` the last row was still
drawing 1.57s after it was reached. 0.42s now.

### The anchor does not fight Lenis — and the probe that said it did was the thing that was wrong

`setupLenisAnchors()` lives in `scripts/landing.ts` and runs on the landing only, so the index is
the first thing on this site to click a `#hash` while Lenis owns the scroll; the entrances §19 built
from `/koncerty` are page LOADS and never exercised that path. It was expected to need the handler
extracted. It does not: cold click, click from mid-page, click upward, and the same anchor twice, in
both the Lenis and the reduced-motion path, all land at exactly `section top 96` — the
`scroll-margin-top` the anchors already carry.

**The intermittent failure that suggested otherwise was the probe.** Lenis keeps a virtual scroll
position and restores it on the next frame, so a bare `window.scrollTo(0, 0)` between test cases is
silently undone and the click that follows is measured from the wrong place — which reads as an
anchor that failed to travel, on some runs and not others. Reset through `window.__lenis` in any
probe on this site. `vm-shot/obrazy-anchor.cjs` carries the note.

### The concert gallery's breakpoint was 640, and the answer is 960, not the 720 §19 guessed

§19 filed this as "same one-line decision, different page" — `/obrazy` breaks at 720, so break here
at 720. Measured on 9 Kart's Kraków run, the site's densest, the defect does not end at 720:

| viewport | before | after |
|---|---|---|
| 640 | 576×385 | 576×385 |
| 660 | **183×122** | 594×397 |
| 720 | 199×133 | 648×433 |
| 768 | 213×142 | 691×461 |
| 860 | 238×159 | 774×517 |
| 959 | 262 | 863×576 |
| 961 | — | **266×178** |
| 1440 | 363×242 | 363×242 |

A 3.1× collapse across a 20px boundary, and the whole tablet band at or under the **240×160** at
which §2 says these frames stop being photographs. `720` would have recovered 660–720 and left an
iPad at 213.

**There is no two-up to fall back to, and that is why this is a breakpoint rather than a packing
change.** `--share` is computed once against the 1120 measure (§19), so how many frames stand in a
row is fixed at build and only their size tracks the viewport; the `flex-basis: 100%` override is
the only lever the layout has. Three-up first clears §2 with margin at **960** — 266 at 961, against
863 one-per-row at 959. `sizes` carries the same number, or a frame displayed at ~900 is handed the
file cut for the packed width.

And the reason it is not 720: **`/obrazy`'s rows are a SHEET standing under a plate**, already the
small half of a pair and never the only thing on the page. This gallery is the whole gallery. Two
pages, one packing module, two different floors — the same distinction §19 drew when it kept the
packing shared and let each page set its own `maxHeight`.

### Weight

`astro check` 0 errors across 114 files. Register audit **969 nodes across 16 pages, clean**
(964 plus the five index rows; 1 note, the standing R10 dark-frame list). Every §19 measurement
re-run and unchanged: zero horizontal overflow at 14 widths, the rail clearing at 1440, all three
anchors at 96, and every run's packing identical to §19's table. Length at 1440×900: `/obrazy`
14 960 → **15 489px**, phone 18 136 → **18 542px** — the index accounts for the whole difference on
both.

The index was checked in all three register states, because a leader that exists only under the
motion gate is a hairline nothing draws: gated it waits at `--half-ink` with the leader at zero, and
under reduced motion and with JS off all five stand drawn at full length.

### Rejected — do not re-propose

- **Silks, ribbons or any hanging assembly in the index.** The registrum's silks are objects
  passing through the slot of a book block; `/obrazy`'s head is a page and has no slot. The
  grammar travelled, the furniture did not.
- **Cutting the head so the index clears the fold.** Measured above: it cannot be made to clear
  1366×768 at all, and clearing 1440×900 costs the Latin. The head's opening is §17's argument
  against a hero.
- **Extracting `setupLenisAnchors` for this page.** Measured, four cases, both motion paths — the
  in-document anchor already lands correctly.

### Still open

**This list was swept against §11 as well as §19, and that is why it is longer than the pass that
produced it.** §11 is the stage-5 open list; §17, §19 and §20 each carried forward only the list
immediately above them, so four live items sat in §11 unread through three renumberings — two of
them decided and simply never shipped. **A "Still open" that only inherits from the previous pass
loses everything the pass before it did not touch.** Sweep every open list that has not been struck
through, not just the last one.

*Carried from §19 — photographic, the founder's call:*

- **9 Kart's Kraków run is one lit document over seven dark frames**, and **eight more frames sit
  under p90 60**. The levers: re-export with more lift, or `plate:` on `kd-9-kart-8`.
- **Hymn Poległym packs four-up, and its two portraits land at 155×274 on a 1440 desktop** (114×200
  at 961, the narrowest width where the packing is live). Not strictly §2's case — that number is a
  landscape 240×160 and these are taller with more area — but `kd-hymn-0` is on §19's dark list at
  9/25, so **the two darkest frames in the archive are also the two smallest on the page**. Found
  while sweeping every run for the breakpoint above; pre-existing, and unchanged by it (the same
  row was ~91×160 at 768 before). The levers are photographic, since §19 rejected both the per-row
  packer and the automated exposure lift.
- **The index's leaders are long** — 766px for "Kontemplacja Wcielenia", 891px for "Wołanie Gór" at
  1440. That is the missal idiom (the registrum's own are shorter only because its sleeve is 420px
  wide), and it was looked at and accepted. The lever, if it ever stops reading: one `max-width` on
  `.im-index` — 860 would give 446/571.
- **`/koncerty`'s own via-rail hides at 980 against a 1120 measure**, unchanged from §19 and still
  the same sum this section has now done twice.
- **The trigger markup is copied between the two galleries** — `PhotoFrame.astro` +
  `lib/galleryModel.ts`. Still housekeeping, still losing to everything above it. Note that the
  `sizes` breakpoint is now 960 here and 720 on `/obrazy`, so the extraction has one more per-page
  parameter than §19 recorded, not one fewer.

*`/obrazy` has no position indicator below 1440, and the head's index did not close that:*

- **The rail hides at 1439 and the index is a head element**, so between 1024 and 1439 — a 1366
  laptop is the common case — a reader four evenings deep into 15 500px has nothing telling them
  where they are. §19 measured the breakpoint correctly (the rail lies on the photographs below
  1440) and named the alternative in prose — a narrower rail that drops its date — then filed it as
  "a design change rather than a correction, so it is not in this pass". Neither §19's open list nor
  §20's first draft carried it, which is how it went missing.
  **This is now one question with three existing answers that do not know about each other**: the
  index (head, static, five entries), the rail (fixed, ≥1440, `aria-hidden` furniture) and the
  site-wide `ScrollTopButton` (past 1.5 viewports, "wróć w ciszę"). Anything summoned by scroll
  belongs in the same design conversation as those three — do not add a fourth in isolation.

*Carried from §11, never swept into §17/§19 — two of these are decided, not open:*

- **The landing band's first panel announces the evening with a photograph taken after it ended.**
  `kd-wcielenie-8` is a posed group portrait with roses and its own `alt` says *po* Kontemplacji;
  §11 already did the contact-sheet work and picked **`-6`**, the only frame in the line with a
  conductor's gesture (`-4` is the safe second, `-5` is the strongest photograph and the wrong one
  here — it repeats panel III's register). This is a decided one-line change in
  `data/landing/paths` that has simply never been made.
- **`kd-wolanie-3` may be a rehearsal standing as the band's second panel** — the same class of
  error, and this one is NOT decidable from the photograph. §11 left it alone because it is a claim
  about a day the founder was present for, and recorded that there is no clean replacement in that
  gallery. It needs another photograph from that night, not another choice.
- **The frame's protocol has two questions §9 explicitly did not settle**, and neither has been
  looked at since: whether the counter should stay **roman** now that a set runs to 48, and whether
  the two full-height click halves are the right target **on a phone**, given the swipe carries the
  same gesture and the halves were built for a cursor a phone does not have. This is the one open
  item that touches every frame on the page.
- **Per-frame `ImageObject` + `creditText` in the `/obrazy` graph** — decided *not* shipped (43
  nodes restating the visible colophon, against the GSC pass's rule that extra schema is proposed
  before it is added). Revisit only with Search Console numbers in hand.

---

## 21. The bar grows a second register — SHIPPED

§20's own open list ends with an instruction: the question "where am I in this document, and where
else may I go" already has **three answers that do not know about each other** — the head's index
(static, five entries, measured as unable to clear the fold), the rail (fixed, ≥1440,
`aria-hidden` furniture with `pointer-events: none`) and the site-wide `ScrollTopButton` — and
*"anything summoned by scroll belongs in the same design conversation as those three — do not add a
fourth in isolation."* This is that conversation, and the answer is not a fourth object: it is the
head's index, given back on the gesture that asks for it.

### Which pages, measured rather than assumed

The brief named the landing as the longest page. It is not, and the census changed the scope:

| | desktop 1440×900 | phone 390×844 | orientation device |
|---|---|---|---|
| `/press` | 18 210 | 21 710 | — |
| `/koncerty/wolanie-gor` | **16 373** | 17 181 | — |
| `/koncerty/aeternam` | 15 625 | **17 329** | — |
| `/obrazy` | 15 492 | **18 539** | `im-rail` ≥1440 |
| `/` | 15 274 | 12 502 | MovementSpine, fine pointer |
| `/o-nas` | 14 215 | 16 042 | — |
| `/koncerty` | 13 415 | 16 145 | `via-rail` ≥980 |

Three facts fall out. **The longest documents on the site are the concert pages**, and they were
the only long ones with no position of any kind and one `id` in the whole file. **The landing is
the shortest of the long pages on a phone** (art-direction cuts it), and it has a spine on desktop
— so it is the worst candidate, not the first. And **every orientation device on this site is
hidden below its own width**, while every phone document is 15–20% longer than its desktop twin, so
the phone had no position and no index anywhere. Shipped on `/obrazy` and the three concert pages;
`/o-nas` and `/press` are on the open list below.

### The first build was hung in open air, and the screenshots settled it in one look

It was drawn as a 420px column off the bar's left, on `--halo` alone, with the argument that a
ground blurring the document under a MOVING reader is a hijack rather than an invitation. Every
measurement passed — the gesture, the threshold, the rubric, the anchors, the boundary — and the
result was unusable: eight index rows printed straight over running programme text (*"Program
koncertu"* lying across *"Beati quorum via integra est"*) and over a lit nave photograph with half
the numerals gone.

`--halo` is a breath of shadow that holds thin text over a picture **when the hush is behind it**.
On bare content it holds nothing. And the premise was wrong anyway: at the moment this surface is
out the reader has stopped going forward and asked where to go, so they are not reading the text
under it. **A composition that needs a ground does not get to keep the composition and drop the
ground** — and no probe in the suite could have caught it, because every one of them was asking
whether the thing worked rather than whether it could be read.

### The bar deepens by a register

So the tabula is a BAND in the bar's own material, edge to edge, unrolling from the bar's line. Its
rows sit in the PAGE's measure — 1180, which is `.im-wrap` and `.kd-wrap` alike — so the index
rules to the same edges as the document it indexes, not to the bar's gutter.

**Opaque, and the bar goes opaque with it.** At 0.94 with a 20px blur the page still ghosted
through under the rows, which reads as dirt rather than as material, and the seam between the bar's
0.72 glass and the band's 0.94 drew a line across the middle of an object that is meant to be one.
Glass is right for a bar carrying five words over a photograph and wrong for a sheet carrying an
index that has to be read. While the band is out the bar takes the sheet's ground, drops its
backdrop blur and hands its hairline down, so the pair closes with exactly one rule.

Two mechanics are load-bearing and must not be "simplified":

- **It unrolls by LENGTH, never by transform** (`grid-template-rows: 0fr → 1fr` over an
  `overflow: hidden` sheet). `.chrome` is a fixed-position ancestor of `.nave`, and registrum.css
  states as trap (c) that the chrome root must stay transform/filter-free — a transform here makes
  the bar the containing block for the mobile overlay. Same physics as the nave card's vitta, for
  the reason that file already gives.
- **The bar's own `::after` overrides live in SiteChrome's scoped block, not in tabula.css.** Astro
  appends `[data-astro-cid-…]` to every compound, so `.chrome[data-tone="dark"].is-solid::after`
  lands at (0,4,0) and a global two-class override could never win. Each tone restates the whole
  set for the same reason.

### Giving it a ground changed which entrance rule it falls under

The first build entered from ZERO and cited the registrum's apparition exemption (guardrails §5
rule 1). With a sheet under them the rows are the **nave card's** case instead, by the card's own
stated test — *"its veil shuts FIRST, so every line stands in layout under an opaque parchment
before a single one darkens"* — so they enter from `--half-ink`, ground first, writing second. The
same object, the same law, a different answer, because the object changed. Ask which case a surface
is **after** you have decided what it stands on.

The gesture is measured as TRAVEL, not as the sign of a delta: an accumulator grows while the
reader keeps going one way and resets when they turn. Position comes from `lenis.scroll` (the float
— `window.scrollY` is rounded and stutters between integers on the tail of an ease, which is
exactly where a naive direction test flips sign) and direction from `lenis.direction`, both falling
back to the document where Lenis is not mounted. **Two thresholds, because intent does not convert
alike between input devices**: 180px on a wheel, 340 on a coarse pointer, where one lazy thumb
flick carries most of a screen on momentum alone. Verified: a 160px nudge summons nothing, a 450px
run does.

And the band **cannot appear unless a section holds the viewport**, which is what keeps it from
answering "where am I" over a head that is already answering it in print.

### §20's anchor finding held, and did not cover this

§20 measured four cases in both motion paths and concluded the plain in-document anchor lands on
its `scroll-margin-top` under Lenis. That stands — for rows reachable only from a page **at rest**.
This surface is the first on the site whose anchors are clicked MID-GESTURE by construction: the
reader has just run back up the page, Lenis is still animating, and it reasserts its virtual
position over the router's jump on the next frame. Measured on all four pages: the click read as
dead. Where Lenis owns the scroll the row now drives it directly, with `immediate` — the printed
index on the same page lands its five destinations as a cut, and two index surfaces pointing at the
same sections must not travel differently. The offset is read from the target's own
`scroll-margin-top` rather than restated in JS.

### Two smaller things that came with it

`--rubric`, `--silk-quiet` and `--halo` moved from `.registrum-drop` up onto `.chrome`. They were
always a map of the BAR'S FACE, not of the register, and a second surface hanging from the same
line needed the same three answers; a state map copied per surface is a map that drifts. Read it
the way `--chrome-candle` is read.

The concert page's indexed bands took ids and `.kd-band[id] { scroll-margin-top: 96px }`. That also
fixes `#program`, which has been linkable all along and until now landed under the fixed bar.

### Weight

`astro check` 0 errors across 159 files. Register audit **969 nodes, clean — the baseline exactly**,
which is the check that matters here: the tabula runs on its own clock like the register, so it
must add no register nodes. Gesture, rubric, ground, measure, overflow and anchor verified on all
four pages at 1440 and at 360/390/430/759/760 (`vm-shot/tabula-verify.cjs`,
`tabula-touch-reg.cjs`). Every §19/§20 measurement re-run and unchanged: the fold arithmetic
(617 / 669→1146 / 246 / 378 / 66), all three `/obrazy` anchors at 96 in both motion paths, the
rail clearing at 1440, the gallery breakpoint table at 961, and every run's packing. Band height
233–365px on desktop, 184–247 on a phone.

### Rejected — do not re-propose

- **A running head (żywa pagina) naming the current section in the bar.** It was the first
  recommendation and it was wrong: both pages already print that name at the head of every section
  — `/obrazy` rules a threshold in the evening's candle, a concert page prints `kd-section-label`
  on every band — so it restates what the document says and answers the question nobody is asking.
  The gap is "where else", not "where am I".
- **Summoning the concert REGISTER on the same gesture.** Cheapest by far (one class aliased to the
  `:hover` selectors) and wrong three ways: on `/obrazy` its five ribbons point OFF-page at the same
  five entities the page is made of, its hush blurs the whole nave because the reader nudged the
  wheel back, and two gates on one apparition puts the pointer and the gesture into a fight over
  one state machine with a 0.6s close grace in the middle.
- **A hanging column with no ground of its own.** Built, measured, unreadable — see above.
- **Silks, or a dye per row.** `/obrazy`'s printed index gives each numeral its evening's candle
  because a page can; five dyed numerals IN THE CHROME are five flat colour fields in a bar whose
  site shows flat colour nowhere else, which is the trap registrum.css names in its own history.
  One colour on this surface: the crimson on the row you are standing in.
- **The landing.** Longest-looking, weakest case: shortest of the long pages on a phone, and its
  MovementSpine already owns the desktop question. It would also cost a second implementation —
  the landing's bar is `StickyHeader.tsx`, which shares the stylesheets and not the script.

### Still open

- **`/o-nas` is 19 phone screens with ten sections and no device**, and qualifies on the numbers
  more strongly than the landing did. It is the obvious next page. The one cost the shipped pages
  do not have: it is translated, so its section names become copy in three locales.
- **`/press` is the longest document on the site** (21 710 on a phone) and has ten anchors already.
  It is a noindex EPK addressed to journalists, which is why it is below `/o-nas` and not above it.
- **The phone's card still indexes only the SITE.** The band answers the page, the "Antyfona"
  answers the site, and both are now reachable on a phone — but a reader who opens the card looking
  for the page they are on finds the Via instead. If that ever reads as a gap, the answer is a third
  register inside the card beside the Via, not a second overlay.
- **`/koncerty`'s own via-rail hides at 980 against a 1120 measure** — carried from §19 and §20,
  the same sum this file has now done three times.
- **The trigger markup is still copied between the two galleries** (`PhotoFrame.astro` +
  `lib/galleryModel.ts`), with `sizes` at 960 on the concert page and 720 on `/obrazy`.
- Everything photographic in §20's list is unchanged: 9 Kart's Kraków run, Hymn Poległym's two
  portraits, the two decided-but-unshipped landing panel swaps from §11.
---

## 22. The frame's protocol on a phone, and the counter stops being a name — SHIPPED

§9 shipped the frame with two questions written down and unanswered, and §11, §19, §20 and §21
each went past them. Both are answered here by measurement, and one turns out to have been
standing on a premise that is false on the very surface it describes. A third thing was found
while measuring the first, and it is the worst defect in this section: **a phone held sideways
had lost the frame's entire colophon** — counter, place, credit and the way out, all below the
window, in a room that scrolls nothing.

### What a tap actually did: the whole photograph

Measured through CDP touch events (`Input.dispatchTouchEvent`) at 390×844 and 414×896, because
only the real pipeline runs the gesture recogniser a synthetic `TouchEvent` skips.

| | before | after |
|---|---|---|
| photograph, 390 viewport | 366×243 | unchanged |
| each nav button | 183×243 | 72×243 |
| share of the frame's area | **100%** | 36.9% |
| hit-test, nine points over the frame | nine buttons | 3 prev · 3 image · 3 next |

Dead centre turned the frame forward; 2% in from the left edge turned it back. **No pixel of any
photograph in this archive could be touched without turning it** — on the one screen where the
picture is under the hand rather than under a pointer.

### The halves shrink to their glyph, and it is §9's own argument run backwards

§9 rejected a chevron at the edge because *the cursor promises an arrow across the whole half, and
a 40px target would make that promise a lie everywhere except at the edge*. Under a finger every
term of that argument is void: there is no cursor, so nothing is promised; the swipe already
carries the gesture; and the price of the full half is a photograph that cannot be looked at. So
the target shrinks to the band the chevron is ALREADY drawn in — `width: min(72px, 22%)` under
`@media (hover: none)` — and the glyph does not move, because the padding that places it is
untouched. **What changed is the target, not the drawing.**

The percentage is the half of that rule that matters: 72px would be most of a narrow portrait
frame. Worst case in the archive is frame 35, a 9:16 portrait rendered 323×574 on a 390 phone —
bands 71px, and **181px, 56% of its width, takes no press at all**.

The chevron's rest state goes 0.5 → 0.9. Nothing completes a rest state on a touch screen because
no hover ever arrives; a quiet glyph waiting to be lit is a pointer's grammar, and here the glyph
is the whole affordance.

### The swipe no longer double-fires, and §9's note is stale for this engine

§9 recorded that a swipe synthesises the half's click and turns the frame twice. Measured now: a
170px swipe fires **no click at all** and takes exactly one step, in both directions — Chromium
suppresses the click once the touch travels past its own tap slop, which is far under the 44px
this island calls a swipe. The two neighbouring gestures were checked in the same run and both are
honest: a 30px drag (over the slop, under the floor) does nothing whatever, and a 120px vertical
drag does nothing.

**The guard stays.** One engine is not the web, this harness holds no iOS Safari, and the whole
cost of keeping it is one boolean.

### The counter is arabic, and that is the site's rule rather than an exception to it

§9 left the counter roman on one sentence: *"one arabic numeral on a surface that has none would
cost more than the beat it saves."* **The premise is false, and this page is where it is falsest.**
Walked across all 48 captions: **41 of them print a date in arabic**, in the same capitalis at the
same 10.5px, one line under the counter — `KOŚCIÓŁ ŚW. BARTŁOMIEJA, NIEDZICA · 18 PAŹDZIERNIKA
2025`. The seven that do not are the rehearsal runs, which have no date to print.

And the rule this site actually keeps is not "every numeral is roman". `/obrazy`'s own index sets
both in ONE row — the evening's numeral in roman beside `9 fot.` in arabic — and every evening
head three screens down does it again. **Roman NAMES here (an evening, a plate, a register entry);
arabic COUNTS.** A position in a set of forty-eight is a count, and it was the last count on this
page still spelled as a name.

What the name cost, in the row's own type at 390: `XXXVIII / XLVIII` **102px → 43px**,
`XLVIII / XLVIII` 92 → 44. Fourteen of the forty-eight positions needed five glyphs or more, five
of them six or more.

### A phone held sideways had lost the whole colophon, and nothing was catching it

At 844×390 the caption's bottom landed at **405** and the exit's at **451**, against a 390px
window, in a room that scrolls nothing. The counter, the place, the credit and the way OUT were
simply gone — in the orientation a reader turns to precisely because these are landscape
photographs.

Why nothing caught it: §9's cap came down from 74 to 68svh inside `@media (max-width: 640px)`, and
a landscape phone is 844 or 896 wide. **A "phone" rule keyed on width does not describe a phone.**

The colophon moves BESIDE the frame rather than the frame shrinking to make room for it: the
reader turned the phone to make the photograph bigger, and answering that with a smaller
photograph answers the wrong question. The gate is `(min-width: 641px) and (max-height: 540px)` —
under 641 the portrait block already owns the layout, and no tablet in landscape is under 540
tall. After: the image stands **328px** (84svh, up from 296), caption at 31–115, exit at 131, the
✕ in the one corner of this layout that is always free, and nothing clipped at 844×390 or 896×414.

Two things the build settled:

- **The exit had to move INSIDE the `<figure>`.** A `<figcaption>` is only valid as its figure's
  first or last child, so the DOM is stage → foot → caption now and the eye's order is restored
  with `order` in the stylesheet. The reading order that falls out — photograph, road out, caption
  — is the way out being offered to a reader who cannot see the photograph, which is a gain rather
  than a cost.
- **`grid-template-rows: auto 1fr` is load-bearing.** The photograph spans both rows, and a
  spanning item hands its leftover height to the rows it crosses **in equal shares** — which
  floated the exit a third of the way down the column, away from the caption it belongs to. The
  symptom was a foot at y 196 under a caption that ended at 115.

### The two galleries' markup: counted, and it stays duplicated

There are **three** copies, not two: the plate is its own third copy inside `/obrazy`, which §19,
§20 and §21 all wrote down as "the two galleries".

A shared `PhotoFrame.astro` would take **12 props to emit 21 lines, of which 12 are one-to-one
forwarding**: figure class, media class, group, href, hrefLabel, the `framedShot` bundle, caption,
credit, the `widths` ladder (`[560, 904, 1920]` for the plate against `[560, 840, 1200]` for the
other two), the `<Image>` `width` formula (two of them), and the `sizes` string — **three** of
those, `720/860/plateW` on the plate, `720` on the sheet and `960` on the concert page — plus
`data-d` and `--share` for the two that hang in a packed row, and a `<figcaption>` for the one
that captions.

The pipeline is not shared either, and `lib/galleryModel.ts` would be thinner than §19 imagined:
the concert page is `galleryRuns → layoutShots() → framedShot` in four lines, while `/obrazy`
splits plate from sheet and computes the sheet's cap off the plate's own rendered height (§17's
entire brief) in eighteen. **One line is common.**

So the component is mostly configuration, and the duplicate stays — the same call §11 made about
the gallery CSS, for the same reason. The parameter count has GROWN since §19 filed the item, not
shrunk.

**What is genuinely at risk here is not the markup, and it is worth naming:** the eleven
`data-image-*` attribute NAMES are the contract with `image-triggers.ts`, `data-*` is untyped in
Astro, and a twelfth field on `ImageFrameItem` means three edits with nothing failing if one is
missed. The lever, if that ever bites, is not a component: a typed helper returning the attribute
OBJECT (`<button {...frameAttrs(…)}>`) fixes the contract without moving a single per-page
parameter. Not shipped — both pages were open in another pass while this one ran.

### Weight

`astro check` 0 errors across 159 files. Register audit **969 nodes, clean — the baseline
exactly**; this stage adds no register node, no rendition and no string.
`prune-orphan-assets` reads **72/609 before and after**, which is the figure that says nothing was
orphaned. The island loses its `roman()` (−20 lines). Every §19/§20 measurement re-run and
unchanged: zero horizontal overflow at fourteen widths, the rail clearing at 1440, all three
`/obrazy` anchors at 96, every run's packing identical. Desktop is untouched by construction and
was checked anyway — at 1440 the halves are still 50% of a 1028×684 frame. The concert surface
carries all of it: 390×844 and 844×390 on `/koncerty/9-kart`, bands at 72px, middle inert,
`3 / 16`, nothing clipped in either orientation.

Probes, all in `vm-shot/`: `obrazy-touch.cjs` (the hit-test and the gestures), `obrazy-counter.cjs`
(all 48 captions), `touch-landscape.cjs`, `touch-bands.cjs` (the band against every frame in the
set).

### The composition not taken

**The counter as the navigator** — the halves gone from the photograph entirely under a finger,
and `‹ 41 / 48 ›` standing under it with the arrows in the thumb's reach. It is a real folio idiom
and it collects the controls where the number they change already is. It lost on being a new
composition where a correction was available: the halves are §9's design, and what was wrong with
them on a phone was their WIDTH rather than their existence. Worth knowing if it is ever
re-proposed: the two buttons must stand OUTSIDE the `aria-live` figcaption, or a screen reader
announces "Poprzedni kadr, przycisk" on every frame the reader turns.

### Rejected — do not re-propose

- **A tap on the photograph closing the frame.** It is the idiom of several phone galleries, and
  it turns the one gesture a reader makes in order to LOOK into a dismissal. The backdrop is
  already ~70% of a portrait phone's screen and it closes.
- **Pinch-zoom inside the frame.** A gesture layer over a locked body, fighting the swipe for the
  same fingers, to magnify a rendition already chosen for that screen.
- **Deep links, or a history entry per frame.** §9's reasoning stands and the number is 48 now.
- **Deleting the swipe→click guard** on the strength of one engine measuring clean.

### Still open

**Swept against §11, §19, §20 and §21 — and against the FILES, which is where two of the four
items §20 rescued from §11 turned out to have been answered already.** §20's rule ("sweep every
open list that has not been struck through") is necessary and it is not sufficient: an item
reading *"a decided one-line change that has simply never been made"* is a claim about the
repository, and it survived two further passes because every reading checked the lists against
each other rather than against `paths.ts`. **Re-read the file an open item names before carrying
it forward.**

*Closed by this pass:*

- ~~**The two questions §9 did not settle.**~~ — both answered above: the counter is arabic on the
  rule the site already keeps, and the halves keep the whole half for a pointer while shrinking to
  their glyph for a finger.
- ~~**The landing band's first panel announces the evening with a photograph taken after it
  ended.**~~ — **already shipped, and had been for a week.** `paths.ts` has carried
  `frame: "kd-wcielenie-6"` since 2026-08-07, the built band renders it, and its `alt` reads
  *podczas*. §11's contact-sheet pick was made; only the open list did not know.
- ~~**`kd-wolanie-3` may be a rehearsal standing as the band's second panel.**~~ — **it no longer
  stands there:** `frame: "kd-wolanie-4"` since 2026-08-10, and all five panels now read *podczas*.
  This does not close the photographic question §11 raised about that gallery — `-4` is the frame
  §11 called "a wide shot whose subject at panel size is the projected logo", and it shipped anyway
  — but the ERROR §11 named is gone, and what is left is a preference between two frames, for the
  founder.

*Photographic, the founder's call — unchanged from §19/§20:*

- **9 Kart's Kraków run is one lit document over seven dark frames**, and eight more frames sit
  under p90 60. The levers: re-export with more lift, or `plate:` on `kd-9-kart-8`.
- **Hymn Poległym packs four-up and its two portraits land at 155×274 at 1440** (114×200 at 961),
  so the two darkest frames in the archive are also the two smallest on the page.
- **The band's second panel is now a judgement between two frames**, not the error §11 filed.

*Housekeeping and measurement, carried:*

- **The trigger markup is copied three ways** — counted in this section, left duplicated, with the
  contract's own risk named and the `frameAttrs` lever written down.
- **The index's leaders are long** (766px and 891px at 1440) — the missal idiom, looked at and
  accepted; the lever is one `max-width: 860` on `.im-index` if it ever stops reading.
- **`/koncerty`'s own via-rail hides at 980 against a 1120 measure** — carried from §19, §20 and
  §21; the same sum this file has now done four times.
- **Per-frame `ImageObject` + `creditText` in the `/obrazy` graph** — decided *not* shipped, 48
  nodes restating the visible colophon. Revisit only with Search Console numbers in hand.
- **The frame's own five strings are hardcoded Polish** — `Powiększone zdjęcie`, `Zamknij`,
  `Poprzedni kadr` / `Następny kadr` and the `Zobacz wieczór` fallback, in `ImageLightbox.tsx`.
  Nothing renders them in another language today (`TRANSLATED_ROUTES` is `{"/o-nas"}`, and
  `/o-nas` does not mount the frame), which is why this is a note rather than a defect — but the
  day `/koncerty` is translated they are five keys in `i18n/ui.ts` in three locales, and they will
  be found by a reader rather than by the build.
- **A landscape phone narrower than 641px still stacks** (568×320 and down): the portrait rules own
  it and its caption can clip. Not measured against a real device — the two-column gate can come
  down if one is ever in hand.

*Carried from §21, the tabula's own:*

- **`/o-nas` is 19 phone screens with ten sections and no device**, and it is translated, so its
  section names are copy in three locales.
- **`/press` is the longest document on the site** and already has ten anchors; a noindex EPK, so
  it sits below `/o-nas` rather than above it.
- **The phone's card still indexes only the SITE**, not the page the reader is standing on.
