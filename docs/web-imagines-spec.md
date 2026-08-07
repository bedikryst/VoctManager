# Imagines — the image archive

Spec for making the ensemble's documentary photographs reachable. Four stages, ordered by
dependency, not by value: stage 0 is a refactor nothing visible depends on and everything after
it does.

Companion to `web-landing-guardrails.md` (the negative space) and `concert-detail-pages-spec.md`
(where the gallery currently lives).

Written 2026-08-07; all four stages shipped the same day. §3 was corrected against the YAML on
that day (the counts it opened with were wrong — see the note there before trusting any number in
an earlier reading of this file), and §4's claim about which stages need the packing module was
corrected when stage 4 turned out not to.

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

Five things the build settled that the plan above did not anticipate:

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
  name that is not in that gallery fails the build rather than falling back silently. Set for
  `wcielenie` and `wolanie-gor` only.
- **The numbering is now one object.** `ROMAN` moved out of `PathSection.astro` into
  `data/landing/paths.ts` and both read it. "Five frames = the numbering of the register directly
  below" was two literals that happened to agree; it is a shared list now, which is what makes the
  claim structural.
- **On the phone the line stands up, and the crop relaxes with it.** Below 980px five across stops
  being photographs, so the plate stacks at full measure — the largest a photograph is ever printed
  there — in a 3:2 box, which is the frame three of these five were actually shot in.
- **`.path` drops its own top rule under the band** (`.imagines + .path`). The cut from night to
  parchment is the boundary; a `--line` hairline 1px below it is the restatement the interludes
  already refuse with `.aether-interlude + section`.

**Weight, measured** (build of 2026-08-07, same probe as §7): `/` gains 5 lazy images —
0.50 → 0.83 MB at 1200w, 0.44 → 0.56 MB at 560w, HTML 24.9 → 26.8 KB gzip. **No new files are
emitted at all**: the band requests the galleries' own `widths` (560/840/1200) and the lightbox's
renditions come from `lib/galleryFrame`, so the pipeline dedupes every one of them —
`prune-orphan-assets` reported the identical **62/611** before and after, off an identical total.

---

## 9. Cross-cutting constraints

- Photographs are **documentary**. Captions state place and date; they never editorialise. The
  existing `alt` texts are descriptive and correct — keep them.
- Consent scope: singer names are cleared for **concert pages only** (`content.config.ts`,
  `roster`). An archive page must not caption faces with names.
- The landing's motion registers are `ink` / `lead` / `light` — every new entrance belongs to
  exactly one. Nothing here introduces a fourth.
- Any new user-facing string is Polish-primary and must read natively.

## 10. Open

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
- **The band's five crops, on a screen.** Every panel is centre-cropped to 4:5 from an original
  nobody has picked a subject point in, and three of the five are 3:2 landscapes losing half their
  width. The levers, in order: the evening's `frame` in `data/landing/paths.ts` (a different
  photograph), then `object-position` in `14-imagines.css` (a different part of the same one).
  Neither is a design question — it is one look at the band and at most two strings.
- Whether the `/obrazy` graph should carry per-frame `ImageObject` + `creditText`. **Not shipped**
  — 43 nodes to restate what the visible colophon says, against the GSC pass's standing rule that
  extra schema is proposed before it is added. Revisit with Search Console numbers if image search
  ever becomes a real channel.
