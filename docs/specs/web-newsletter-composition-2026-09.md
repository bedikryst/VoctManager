# Newsletter: composition, states and consent wording

Date: 2026-09-16, rounds 2 and 3 on 2026-09-17. Status: **Design settled; not implemented.** The
composition is the roof band of §2 with `(63)`, polished in round 3 (deeper sentence, art-directed
phone crop, the warmer exposure, the arrival). The one-axis `(36)` alternative of round 2 was
rendered and **set aside, not rejected** — the developer's call: `(36)` is inherently cold and its
blue cannot be removed without killing the frame, while `(63)` is already lit warm. Implementation
brief — build from this file, not from the audit. Predecessor: `web-newsletter-design-audit-2026-09.md` (findings
and priorities), `web-newsletter-leaf-implementation-2026-09.md` (what stands today).

Visual reference for this brief: the composition mock published for this session — desktop and phone
plates with the layered figure, every form state, the clause in three locales, and the frames that
were weighed. It renders the numbers in the tables below with the site's own self-hosted faces; where
mock and this file disagree, this file wins.

## The decision

**The page is one invitation, spoken from inside a photograph.** Not a headline row with a form
parked under it, and not a picture slotted into a column beside the text. The invitation — label,
display line, offer, address, clause, act — runs down a single reading column on the left, top to
bottom, at one measure. Beside it stands a plate cropped through the man conducting the evening, with
his reaching arm restored above the page, so the display line runs behind him. Under both: the one
concert actually ahead, on the reading axis, and the photograph's caption under the photograph. The
record of evenings closes the page as an index.

Four moves do most of the work, and they are inseparable:

1. **The clause becomes one short paragraph** (§1). Today five lines of 12.5 px fine print stand
   between the field and the button; that is what makes the ask read as a form rather than an
   invitation. Shortening it is what lets field → clause → act read as three steps.
2. **The name field goes** (§1). It is the clause's longest sentence and the form's second row. The
   greeting is asked once, after confirmation, where the flow already supports it.
3. **The action returns to the reading axis** (§2). Button at the left edge, under the clause, on the
   same vertical as the field — not at the outer right edge of the sheet.
4. **The photograph stops being a slot** (§3). A frame parked in a column has to be filled; a frame
   the type runs behind holds the page. It also means one image is enough — the page needs no second.

The dark ground stays, as the audit directed. This brief does not migrate the page to parchment and
does not touch `.ai/07_marketing_public_site.md`'s identity question; §6 keeps that conflict open and
names where it gets settled.

## 1. Copy and consent — site-wide, one commit

The clause is one wording taken by every placement (`NoticeSignup.astro`), so a change to it is a
change to `/koncerty`, `/kontakt`, the landing strip and `/newsletter` at once. **The name field
therefore leaves every placement in the same commit as the clause**: a form that keeps asking for a
name under a clause that no longer covers it would collect a field nobody was told about.

| Key | Now | New |
| --- | --- | --- |
| `nuntius.page.eyebrow` (pl) | `Zaproszenia` | `Zaproszenia na koncerty` |
| `koncerty.yaml notice.lede` (pl) | `Zostaw e-mail. Damy znać o naszych koncertach.` | `Przed każdym koncertem wyślemy Ci jeden krótki list — termin, miejsce i program.` |
| `nuntius.form.submit` (pl) | `Zapisz mnie` | `Chcę otrzymywać zaproszenia` |
| `nuntius.register.ahead` (pl) | `Najbliższy wieczór` | `Najbliższy koncert` |
| `nuntius.form.errorEmail` (pl) | `Podaj adres e-mail, na który mamy napisać.` | keep |
| `nuntius.form.nameLabel` / `namePlaceholder` | used by the form | used by `preferences` only |

`register.ahead` is a correctness fix, not a preference: the announced event starts at 13:30
(`concerts.yaml:2571`), so "wieczór" is false on the one entry the page actually prints.

English and French follow in the same commit: `The next concert` / `Le prochain concert`,
`Send me invitations` / `Je veux recevoir les invitations`, and for the lede, the overlay files
`content/pages.en.yaml` / `pages.fr.yaml` under `page.koncerty.notice.lede`.

### The clause, version 4.0

```
pl  Adres przetwarza Fundacja VoctFoundation, zgodnie z <a href="/polityka-prywatnosci">polityką prywatności</a>.

en  Your address is processed by the VoctFoundation, in accordance with our
    <a href="/en/polityka-prywatnosci">privacy policy</a>.

fr  Votre adresse est traitée par la Fondation VoctFoundation, conformément à notre
    <a href="/fr/polityka-prywatnosci">politique de confidentialité</a>.
```

**One line, and the earlier three-sentence draft in this brief was over-engineering.** The developer
is right that a foundation links its policy rather than reciting it, and the layered notice the EDPB
describes is exactly that. What has to stand on the screen is only what a link cannot carry: **who**
the address goes to, because consent to a named controller cannot be inferred from a link. Everything
else is already said better elsewhere on the page or in the letter itself:

- the **purpose** is the offer sentence directly above the field — "Przed każdym koncertem wyślemy Ci
  jeden krótki list — termin, miejsce i program";
- the **way out** is a link in every letter and is stated on the `confirmed` receipt, which is where a
  subscriber actually needs it;
- the **succession** — the list passing to whoever carries the ensemble on — moves to the policy's
  *Lista zaproszeń* section. The developer settled this on 2026-09-17: it is the board's own earlier
  preference (wariant B) being revised by him, not a legal constraint, and the policy is where a
  change of controller belongs. Update the comment block in `consent.py`, which currently records the
  opposite.

**No version bump: `NOTICE_CLAUSE_VERSION` stays `"3.0"`.** The developer settled this on
2026-09-17 — 3.0 was written in an uncommitted working tree and never reached production, so no
consent record anywhere was ever stamped against its text. A version exists to say WHICH wording a
subscriber saw; with no subscriber having seen 3.0, redefining 3.0 makes no history unreadable, while
bumping to 4.0 would invent a version nobody was ever shown. **Verify before committing**: no rows on
prod carry clause version 3.0 (2.0 is the last shipped wording). Rewrite the comment block in
`consent.py` accordingly — it currently argues for the opposite on both the bump and the succession
sentence.

The policy must carry, before this ships: purpose, retention, the withdrawal route, the seven-day
validity of the confirmation link, the data mailbox, and the succession clause.

### The greeting, after confirmation

`/nuntius` `confirmed` gains the greeting form that today only `?preferences=` reaches: title and
body unchanged, then one quiet line and the existing field.

```
pl  Chcesz, żebyśmy zwracali się do Ciebie po imieniu?   [ Imię ]  [ Zapisz imię ]
en  Would you like us to greet you by name?
fr  Souhaitez-vous que nous vous appelions par votre prénom ?
```

This is what keeps the optional name a product feature instead of a deleted one, and it asks at the
moment a person has just chosen to stay.

## 2. The leaf composition

**The room is the page's roof, and the sentence lies in its foot.** One photograph runs the full
width of the viewport at the top of the page; it arrives out of the page's own black and dissolves
downward into it. `Do zobaczenia.` is pulled up into that dissolve, where the listeners' heads are
pure silhouette — so the sentence sits at the eye level of somebody sitting in that room instead of
on a panel beside a picture. Everything functional stands below, on flat night.

There is no plate, no frame, no cutout and no rectangle anywhere on the page. Three earlier answers
were built and thrown away — a bordered plate in a right-hand column, a cropped column with the
conductor's arm cut out over the type, and a tight crop of four singers — and each failed the same
way: a photograph in a slot has to be filled, and a device forced onto a frame that cannot carry it
shows. The record of that is in `.agent/memory/project_web_newsletter_leaf_2026-09.md`; do not
re-propose them.

```
page measure          1120px, gutter max(28px, 5vw) — unchanged from the audited version
--band                52svh (≥ 821px) / 46svh, min 300px (phone)
.notice-room          position absolute; top 0; left 0; width 100%; height var(--band)
                      img: object-fit cover, object-position 50% 58% (phone 50% 62%)
  .veil, one element  TOP:  #080807 0% → .86 4% → .5 12% → .18 24% → 0 38%
                      FOOT: 0 48% → .26 70% → .66 86% → .93 96% → #080807 100%
.notice-head          position relative; z 4; padding-top clamp(26px, 3.4vh, 44px) — the running
                      head LIES ON the photograph, inside its top shadow
.notice-ask           margin-top: calc(var(--band) - 118px)     ← the display line enters the foot
                      ≥ 821px: calc(var(--band) - 176px)
                      ≥ 821px: grid-template-columns: minmax(0, 1fr) 38%; gap: 0 4%
invitation column     prose ≤ 34ch (offer), fields ≤ 430px, clause ≤ 76ch (one line at desktop)
aside (right column)  padding-top: 112px — its rubric lands on the offer's FIRST LINE
```

**The band is out of flow, pinned to y = 0.** In flow — the band as a block with the head above it
— the photograph starts on a line, and a line across the top of a page like this is the first thing
the eye finds. The earlier version's own comment claimed the room reached the page's top edge; the
markup never did it. Two consequences, both load-bearing:

- **Both dissolves start and end at FULL alpha.** A top fade opening at 0.82 leaves an 18% step
  against the page's black, and that step IS the "cut" line — no number of extra stops hides it
  while the first one is short of 1. Same at the foot: the last stop is `#080807 100%`, not 96%.
- **There is no head rule.** With the photograph at the top edge the rule has no edge left to
  state, and a gold hairline laid across a nave is the same defect one step lower. LEAD moves to
  the act's own hairline, which the layout already carried — that register exists for borders that
  are there, not for lines added in order to animate something.

**The offsets are MEASURED, not chosen**, and the probe is the arbiter: at `--band - 214px` the
desktop sentence crossed the singers' lit folders at 3.1:1, and the phone at `- 165px` crossed the
lectern at 2.8:1. The values above put it over the silhouette band, where the photograph is already
its own shadow: worst pixel 9.6:1 at 1440, 9.9:1 at 1920, 5.9:1 on the phone, median 17.4:1.

**Shoot 1920 as well as 1440.** A full-bleed band is a 4:1 slice at 1920 and a 3:1 slice at 1440 —
a composition that holds at one can be cut at the other, and 1920 is the developer's own window.

**The desktop asset is cut to the BAND's aspect (~3.8:1), not the frame's.** Delivered at the
frame's 1.5:1, a 4:1 band discards half the crop and the slice that survives has no foot — which is
what made the photograph look cut off at the bottom rather than dying into the night. The span to
cut from `(63)` is **frame-y 0.345 → 0.74, full width**: the crucifix and pillars above the heads,
the ensemble, and **the top of the audience silhouettes at the lower edge**. The photograph's own
darkness is then what the foot fade finishes, not what it has to manufacture.

Both fades are **overlays in the ground's own colour**, not `mask-image`: the ground is a known flat
`--dark`, so there is no browser to be unlucky with and no mask-composite support to check. The one
thing that must hold: no horizontal or vertical edge of the photograph may ever be findable.

Everything above must be visible at 1440×900 without scrolling, button included — that is what the
44svh field and the negative margin are tuned against. Verify it, do not assume it (§3, harness).

| Element | Now | New |
| --- | --- | --- |
| runhead (Cinzel caps, `--candle`) | 11.5 px / .18em | 12 px / .16em |
| `Do zobaczenia.` (Cormorant 300) | `clamp(46px, 6.6vw, 112px)` | `clamp(46px, 6.4vw, 92px)`, lh .97 |
| offer (Plex Sans 400) | 17 px, α .64 | 18 px / 1.62, α .78, ≤ 34ch |
| field label (Plex Mono 400 caps) | 11 px / .1em | 13 px / .09em, α .62 |
| address value (Plex Sans 300) | `clamp(18px, 1.7vw, 25px)` | `clamp(20px, 1.6vw, 24px)`, full paper |
| field underline | α .26 → **2.08:1** | α .42 → **3.9:1** |
| placeholder | α .48 → 4.53:1 | α .52 → **5.3:1** |
| clause | 12.5 px / 1.74, α .58 | 14.5 px / 1.72, α .70, measure = the column's |
| button (Cinzel 600 caps) | 10 px / .2em, right edge | 13.5 px / .14em, 56 px tall, **left edge**; below 560 px it drops to 12 px / .08em with `white-space: nowrap`, because the label broke in two on a 330 px thumb target and the words stay |
| runhead second tier | always printed | hidden below 560 px — `Nuntius · Zaproszenia` alone; the full line fills a phone's width and stops reading as a running head |
| field error | mono 10.5 px, under the act | sans 13.5 px, **under its own field** |
| rubric | α .50 | 12 px / .14em, α .58 |
| ahead numeral | α .42 → 3.70:1 | Cinzel 13 px, α .55 → **6.0:1** |
| record numeral | α .38 → 3.21:1 | Cinzel 13 px, α .55 → **6.0:1** |
| record title (Cormorant) | 21 px | 21 px, α .92 — primary in its row |
| runhead, first term | — | `VoctEnsemble` links to `/`. This page carries no navigation, so the running head's first term is the site itself rather than a label |
| clause link | inline | `white-space: nowrap` — a link is one word to the reader even when it is two, and must never be where the line breaks |
| ahead entry, programme | — | the sentence is UPRIGHT serif so the work's title can be the italic in it; set the whole line italic and the one mark carrying meaning disappears |
| offer, clause, programme | — | `text-wrap: pretty` — no orphans in a three-line measure |

Ratios are nominal, computed on `--paper` over `--dark` with alpha compositing; verify the two
gradient washes once in the browser.

**The aside** (the right column of `.notice-ask`, no rule of its own on desktop). The rubric and the
ahead entry — `VI · Laudes` on one line (Cinzel numeral + Cormorant italic), title at
`clamp(24px, 2vw, 29px)`, place and `venueNote` on one line, `11 października 2026 · 13:30–14:30` in
mono with lining numerals, and a text link to the concert page. Below it, held off by a clear step:
the photograph's own two-line caption in Plex Mono 11.5 px (α .5) — `9 Kart z Księgi Psalmów ·
Bazylika NSPJ, Kraków` / `listopad 2024 · ` + the credit through `frameCredit()`, which for this
frame prints `fot. Kamila Grudzińska`. Without that step the credit reads as the announced concert's
own metadata. **The ahead entry gives up the shared `--roman-col` gutter** — its numeral sits inline
beside the Latin; the reserved numeral column survives only in the record below, where a column of
numerals actually runs. Below 821 px the aside follows the act under its own hairline.

Why the aside is there at all: with the room bleeding across the top and the invitation held to a
430 px column, the page's lower right is otherwise a void. The concert ahead is the one thing that
belongs in it — it is the answer to the address just given.

**The record.** Three tracks: `var(--roman-col) minmax(0, 1fr) auto`. Title and Latin in the middle
track, place and moment grouped as one right-hand cluster capped at 22ch. No leader rules at any
width: the leader existed to join a title to metadata at the far edge, and the metadata is no longer
at the far edge. A programme with several performances (`concerts.yaml:1111`, `:2141`) states their
COUNT where a single evening states its venue — `trzy wieczory · wrz–lis 2024` — because its three
venues do not fit a 22ch cluster and the concert page lists them anyway. Under the last entry, one
factual line: `Pięć programów, osiem wieczorów — od stycznia 2024.` Both numbers are derived, the
second from the effective dates of §5. **Neither is a sending cadence**: a row is a programme, and
the record is evidence of the ensemble's work rather than a count of letters.

The register holds cycle stations only (`cycle: false` excludes the Boboli liturgy), so today the
ahead entry is numeral VI and the record carries five rows.

**Phone (≤ 820 px) is the same composition, not a folded desktop:** the room still bleeds the full
width as the page's roof and still dissolves at its foot; the sentence still lies in that dissolve.
Then, one column: offer 17 px → label + field (value 19 px; never below 16 px, or iOS zooms the page
on focus) → clause → act rule + full-width button → hairline → rubric + ahead entry, **without**
`about.blurb` → the record. The extended preview never precedes the field.

The room at this width is a **different crop of the same frame, art-directed** — **frame-x 2→46,
frame-y 26→90**, LEFT of the conductor: five singers facing the camera over a listener's silhouette
and the lectern, with dark pillars above for the running head. Swapped by a `<picture>` `source` at
820 px. Do not scale the desktop crop down (at 390 px it becomes a strip of torsos), and do not
centre the phone crop on the conductor: rendered, x 22→76 fills a phone with a man's back, which is
the "portrait of a performer" defect §3 opens with. The left crop also measures brighter — mean
sRGB 27.2 against 20.1 — because it is the part of the frame where faces are lit from the front.

A trap that cost a round here: a render without `<meta name="viewport" content="width=device-width">`
lays out at 980 px and scales down, so a phone shot shows the desktop layout in miniature and looks
like a squeezed desktop. `BaseLayout` carries the meta; any standalone harness file must too.

**The warmer exposure.** One dial, `--warmth`, cross-fading a second baked copy of the same frame
laid over the first: no mask, no blend mode, no browser `filter`. Every intermediate value is the
average of two plausible exposures of one photograph, which is the whole reason **the grade is a
whisper** — `saturation 1.04, brightness 1.035, channel gain [1.075, 1.005, 0.93]` in sharp. A
strong grade makes the midpoint a third thing that is neither exposure (a candle tint's 55% blend
rendered as grey mud), and a hard channel gain turns a blue-hazed frame green. `(63)` is already lit
warm, so at rest **`--warmth: 0` — the frame as shot. Nothing warms on load**: a page that arrives
already graded is a filter, not a room, and the whole gesture is the movement. It is spent in answer
to the reader — `body:has(.act:hover)`, `body:has(input:focus)`,
`body:has(input:not(:placeholder-shown))` at 0.62, and `body.committed` at 1 over 1.9 s: the room
warming because somebody has just said they are coming. The typing trigger is the one that persists,
because the reader has not finished.

**Be honest about the size of it.** Rendered at 0 / 0.3 / 0.55 / 0.8 / 1 and compared full-size,
even 0 → 1 is a whisper: skin and hair warm, the altar linen goes creamier, the shadows open a
fraction. The 0.62 steps are at the edge of perceptible and a cursor crossing the act for 200 ms
cannot show a 1.9 s gesture at all. **If only one trigger survives, keep `committed`** — and let
hover and focus be answered by the things that can answer in 200 ms: the field's underline going
candle, and the candle of the button itself lifting. A glow pooled on the ground under the button
answers nothing; the act is not a lamp, and light spilling around it is decoration wearing the
costume of feedback.

**How dark this page actually is**, since "gloomy" is a measurable claim before it is a taste one:
86% of the first screen sits below sRGB 24 on desktop (mean 21.8), 83% on the phone (mean 27.2).
It is a near-black screen and it is meant to be. What keeps `(63)` solemn rather than grim is that
its faces are lit from the FRONT with mouths open in song, and that the altar linen, the crucifix
and the sanctuary lamp are legible warm accents — crush the architecture into black and the same
frame turns into faces floating in a void. The live risk at these numbers is therefore not gloom but
**monotony**: one tonal register for the page's whole length. That is the second movement's job
(§2, `Where this still has room` 4), not a gradient's.

**Motion.** The diagonal leaf departure goes — it was drawn for a sheet of paper that no longer
exists. The exchange is opacity plus `translateY(6px)`, 260 ms, inside the frozen `.notice-stage`
box; the `min-height` freeze and the walk-down in `settleBand` stay as they are. No text waits for a
reveal.

**Fallbacks that must be built, not assumed.**

- *No announced concert* (`register.ahead` undefined): the aside keeps the photograph's caption and
  drops the rubric with it. No rubric standing over nothing.
- *No photograph cleared for the page*: the room goes and the page opens on the gold rule, the
  running head and the display line on flat night, with the invitation at its own measure and the
  ahead entry beside it. It must still read as a page — that is the fallback, not a decorative
  waveform. What may NOT happen is the photograph coming back as a bordered block in a column: that
  slot is the thing three discarded versions proved wrong.
- *Neither*: the invitation stands alone at its measure; the record carries the page.

### Second round, 2026-09-17: the one axis

Rendered: `C:\Users\kryst\vm-shot\newsletter-v2\c-axis.html`, shot with `newsletter-study.cjs`
(below). **SET ASIDE on 2026-09-17, kept for the reasoning.** The roof band of §2 is the
composition. Do not revive this without a frame that is warm to begin with — everything here is
true of the geometry and false of nothing except the photograph's temperature. What transferred to
§2 and is now load-bearing there: the arrival, dissolves belonging to the field's own box, the
baked second exposure, and the measured negative margins. **Never split photographs across
breakpoints** (`(63)` desktop, `(36)` phone was weighed and dropped): two frames from two moments
are two promises, two captions and two `alt` texts — art direction is two crops of ONE frame.

`(36)` cannot be married to the composition in §2, and the attempt is what produced the answer:
a vertical frame beside a left reading column with a right-hand aside has to become a panel, which
is the slot three discarded versions already died on. **The frame's own composition is symmetrical
— a shaft down the middle, four singers in a row at its foot — so the page takes that axis.** The
invitation stands in the shaft; the four lit scores are the page's foot; nothing else is on the
screen at either width. It is one composition rather than a desktop folded down, which is what §2
asked for and did not get.

```
.nave                 min-height 100svh; overflow clip; justify-items center
.field (≥ 821px)      left 50%; width min(62vw, 880px); translateX(-50%)
                      img object-fit cover, object-position 50% 59%  — the scores land on the
                      page's foot and the shaft enters from above the screen
.field (≤ 820px)      inset auto 0 0; height 88svh — the frame's own proportion, bled off the
                      foot. Covering the viewport slices the outer two singers in half: the
                      torn-face defect, reached from the other side.
type column           max-width 620px (phone, left) / 760px (desktop, centred)
```

Four findings that cost a render each:

- **Every dissolve belongs to the FIELD's box, never to the section.** Measured on the section, the
  top fade is already spent where a phone's field begins, and the photograph's top edge becomes
  findable behind the offer. That is acceptance 2a failing on a detail no flat proof shows.
- **Alignment is not composition.** Centred on the axis reads well at 1440; on a 390 px phone it
  breaks a three-line offer and hangs the clause's full stop. The reading column stays left below
  821 px, and the composition is unchanged by that.
- **The type needs no help from the ground.** Measured under the rendered pixels (the harness's
  `[data-probe]`), the display line clears 9.4:1 at its worst pixel on desktop and 14.2:1 on the
  phone; the offer and the clause never fall below 8.9:1.
- **What this composition costs: the aside.** There is no room for the concert ahead on the first
  screen, so it becomes the second movement with the programme and the photograph's credit. "No
  footer, nothing" cannot be literal for the whole page — a photograph on this site carries its
  date and its photographer — but it can be literal for the first screen, which is the developer's
  point.

## 3. The photograph

**What it has to mean, before anything else.** The page promises a letter before each concert and
says "Do zobaczenia." The photograph has to be the answer to that sentence: **the room, from the seat
the letter invites you to.** A portrait of a performer fails it — a reader who does not know who he
is learns nothing, and a back turned to the camera in a slot beside a form means nothing at all. That
was the first three attempts' real defect, not their matte quality.

All candidates are from one evening — 9 Kart z Księgi Psalmów, Bazylika NSPJ in Kraków, 2024-11-16,
fot. Kamila Grudzińska (that evening's credit is already on record at `concerts.yaml:1177`).

**Standing: `(63)`** — eleven singers across a dark nave, the conductor's back in the axis, the
crucifix and the sanctuary lamp as the only warm accents, and **the listeners' heads along the foot
in pure silhouette**. It is what the rendered composition uses: the whole ensemble, women included;
the foreground silhouettes are the depth three discarded versions tried to invent with a cutout; the
darkness at top and foot is where the running head and the display line live; nobody in the audience
is identifiable. Crops: desktop frame-x 0→100, frame-y 20→90; phone frame-x 22→76, frame-y 22→82.

**Test first: `(36)`** — 3582 × 5373, vertical. An immense blue-hazed nave, and at its foot four
singers lit only by their own scores: four glowing open books and the faces above them, everything
else dissolving. Checked at both sizes the page would use (390 × 371 and 790 × 620) and it holds at
both — at phone size the four lit scores read instantly. **This is the strongest frame in the library
for this page's sentence**, because its subject is exactly what the letters are about: people singing
out of light in a dark room. Two conditions, and they are why it is not simply declared the choice:

- **It is vertical, so it cannot be the roof band.** A 3.6:1 band throws away the vastness that is
  its whole power. **Rendered (2026-09-17): a tall field bleeding right and dissolving leftward
  does not work either** — it leaves the page's lower left dead and the singers stranded in a
  quadrant. The frame will not sit beside a column; it only works when the page adopts its axis
  (§2, second round).
- **It is cold, and the cold is the point.** Rendered: the page's one warm thing is the invitation,
  and blue and gold do not fight once the warmth sits where the frame already put it — on the four
  scores. **Warming the whole nave is worse than the room it replaces**: graded warm end to end it
  reads brown, the shaft disappears and the depth that is this photograph's argument goes with it.
  The mechanism is therefore a graded second exposure of the same frame (`nave-warm.webp`, a
  candle tint in sharp — a channel-gain white balance turns this frame GREEN, because its haze
  carries as much green as blue) revealed through two masks: the core over the scores, always; a
  wider one over the lower third only when the reader commits. A browser `filter` is the wrong
  tool — it repaints a 2 MP layer per frame and cannot be art-directed.

**`(4)` — no, not as this page's image.** The developer proposed it and the rights read is right:
the foreground is silhouette, nobody prominent is lit and sharp, and the two semi-readable faces in
the left third crop away. But it shows **the audience waiting, with no music in the frame**: a
stranger cannot tell whether this is a concert, a Mass or a lecture, so the type would have to do all
the naming and the picture drops from evidence to atmosphere. It is a good photograph — use it on
`/koncerty` or at the foot of the record, where the page has already said what it is.

### The brief, if a better frame is to be found

MUST: shot from a listener's position, camera in or behind the pews · at least a third of the frame
dark, on one side or at the top — that is where the type goes · one light source doing the work ·
the ensemble small enough to read as an event rather than a portrait · **something in the foreground
between camera and singers** — heads, a balustrade, pew backs; that is what seats the reader ·
horizontal, ≥ 2500 px · from a concert that is in `concerts.yaml`, so venue, date and photographer
can be printed.

MUST NOT: recognisable, lit audience faces · technical kit as a subject (stands, cables, monitors,
an operator) · burnt-in credit · flat, evenly-lit documentation · **empty seats** — an empty church
argues against the invitation.

**Rights (art. 81 pr. aut.).** A person's image may be disseminated without consent where they are
only a *detail of a larger whole* — an assembly, a public event. Silhouettes, backs and out-of-focus
masses are therefore clean, and they are also the better picture. A sharp, lit, centred listener's
face needs that person's consent: frame `(120)` — the man looking up into the light — is exactly that
case, and must not be published without asking him. `(15)` carries identifiable faces along its
bottom edge and is usable only cropped to the shaft above them.

**Held, not rejected:** `(66)`, a lone musician under one small spotlight — the batch's best pure
atmosphere, but a back bent over a stand says solitude, which is the wrong sentence under "see you
there". Keep it for a page that needs a ground rather than an event.

Rejected: `(65)` (quiet, no foreground), `(91)` (busy), `(119)` (a bow is an ending), `(131)`
(curtain-call keepsake), `(107)`/`(39)` (no ensemble, or architecture alone). From the older library:
`kd-9-kart-4` (the beam frame — genuinely strong, and the runner-up: singers in a shaft with the
audience at the right; it lost because a few of those faces are lit and readable); `kd-hymn-0` (the
first pass's choice — chosen for its palette, saying nothing this page needs, and the men alone);
`kd-hymn-4` (burnt-in credit); `kd-wcielenie-1/2` (bright white rooms against the night);
`chor-nawa-*` and `florent.jpg` (already spent elsewhere on the site — `florent.jpg` twice, on the
landing's director section and `/o-nas`).

**Before it ships.** The eleven files in `web/src/assets/photos/new/` are 2–7 MB camera originals:
they belong in `.original-photos/` under the corpus's `kd-9-kart-*` naming, then
`npm run photos:proxy`, then gallery rows carrying `credit: "Kamila Grudzińska"`. Watch the name-core
collision the proxy script has (`.agent/memory/reference_photos_proxy_extension_collision.md`), and
remember `widths` must always travel with `width` (`lib/photos.ts`).

### Look at it. Every time.

The one process rule this stage produced, and the reason three versions were bad: **nothing about
this page may be judged without rendering it.** A flat proof composed with the wrong font hid a torn
fragment of a singer's face beside the headline for a whole round.

`C:\Users\kryst\vm-shot\newsletter-hero.cjs` screenshots a local file at 1440×900 and 390×844 through
system Edge (Playwright, no browser download). `node newsletter-hero.cjs <abs path to html> <out
dir>`. The harness needs the page's fonts and images beside it; the working copy of this study is in
the session scratchpad under `render/`. For the real page, `npm --prefix web run dev` serves
`/newsletter` on 4321 and the same script points at it.

**`newsletter-study.cjs` is the one to use now** — same two viewports, plus what opinion cannot
give: `node newsletter-study.cjs <abs html> <out dir> <tag> [--frames]`. It captures the arrival at
0 / 200 / 450 / 800 / 1600 ms, and for every `[data-probe]` element it hides that element's text,
screenshots the box, ranks every pixel and prints the contrast of `--paper` against the MEDIAN, the
p95 and the worst ground under it. `Q=warm` passes a query string through so a state can be shot
without a second copy of the study. Two traps it cost a round each to find: the settled shot has to
wait past the whole arrival (3.4 s — a shot taken mid-flight reads as a dim, washed design, not a
measurement error), and a study that holds its arrival must expose `window.__arrive()` under
`?hold`.

### Where this still has room

The developer's verdict on the rendered composition (2026-09-17) was that the idea is right but more
can be got out of it. Six places where the juice is, in the order I would spend it:

1. **The first 800 ms** — answered, rendered. The site's LIGHT register cannot carry this page:
   `registers.css` warns that a 0.58 dark scrim moves single-digit sRGB levels over a night frame,
   and it names the six frames that fail the bar. `(36)` is one of them. **So the arrival is not a
   veil lifting but the light itself descending**: one gradient bloom, no image layer, travelling
   `translateY(-30%) → 0` while it brightens, peaking at ~500 ms, and only then the room's own
   exposure (0.42 s delay, 1.3 s) under it, and the warmth on the scores last (0.95 s). LEAD rules
   the head, INK walks the invitation down the shaft on `--d` 0.1 → 0.72 s, nothing the reader is
   reading ever moves. A fade-in bloom does NOT read as light arriving — the descent is the whole
   difference, and both versions are in the frame captures.
2. **How deep the sentence lies in the room** — dissolved as a question. In the one-axis
   composition the sentence is not under the picture at all; it stands in the shaft, and the
   measurement (9.4:1 worst pixel) is what replaces the judgement.
3. **The programme, not just the date.** Still the strongest unspent fact. One work title under
   the ahead entry, now in the second movement.
4. **The record as the page's second movement.** Unbuilt, and it is now load-bearing rather than
   optional: the one-axis first screen pushes the concert ahead, the programme and the credit
   below the fold, so the second movement is where the page's length lives.
5. **One warm mark, tied to the room** — answered: the warmth IS the room's, a graded second
   exposure masked to the four scores, and the gold button belongs to that family rather than
   coinciding with it (§3).
6. **The dissolve keyed to the light** — answered, and cheaply: the arrival's bloom settles at 0.13
   *above* the veil instead of under it, so the shaft's throat is re-lit through the dissolve that
   darkens everything beside it. The bright band survives further up the page than the shadows do,
   and the arrival's own gesture stays useful instead of being spent in one second.

## 4. Form states and the defects they close

Every state below is the same `.notice-stage` box. States are in the mock.

| State | What it shows | Closes |
| --- | --- | --- |
| empty | as §2 | audit P1 hierarchy |
| focus | candle underline, doubled shadow (keep) | — |
| invalid address (client) | error in sans 13.5 px **under the field**, `aria-describedby` on the input, `aria-invalid`, focus back to the field; the button untouched | `NoticeForm.tsx:469` / `:387` |
| sending | button reads `Wysyłamy…`, `aria-busy`, disabled at α .55 but still legible; fields stay editable | — |
| receipt | `Sprawdź skrzynkę.` + body + **the address actually submitted** + `Popraw adres` + spam/7-day hint + closed recovery disclosure | `:203` / `:511` / `:289` |
| receipt, recovery open | resend button, then two separate lines: the acknowledgement (`role="status"`, persists) and the availability countdown (plain text, not a live region) | `:295` / `:537` |
| send failure | `Nie udało się wysłać…` beside the button on the act's own axis; every entered value preserved; button back at rest | — |
| timeout | same shape and same message; the request gets an explicit `AbortController` timeout (12 s) in `api/notices.ts` | `api/notices.ts:107` |
| no announced concert / no frame | §2 fallbacks | audit P2 |

Required beyond the states:

- **Capture the submitted address.** `submittedEmail` set immediately before the POST; the receipt
  and `onResend` read it, never live field state. A slow response plus an edited field must not make
  the receipt lie.
- **Field constraints**: `maxLength` 254 on the address, matching `outreach/serializers.py:47`.
- **`cursor: text` inside form fields**, against `cursor.css:17`'s site-wide suppression. The
  decorative cursor is judged separately; a text field is not the place for it.
- **`/nuntius` `error` keeps an act.** `NuntiusIsland.tsx:225` currently drops the reader into a
  state whose only action lives in the states it came from. Retry in context, with the two ways back
  beside it — never "open the mail again".
- Keep what already works: real labels, `autocomplete="email"`, full-width mobile action, focus
  moving into the receipt, reduced-motion handling, and the distinction between *request accepted*
  and *subscription confirmed*.

## 5. The register's correctness

`lib/noticeRegister.ts` currently picks one future programme (`:135`) and files **every** other
programme as past (`:143`), and it ignores performance-level `dates[]`.

- An entry's effective date is the earliest of its own `date` and its `dates[].date` that is ≥ today;
  with none ahead, the latest past one. `9-kart` and `aeternam` both carry `dates[]`.
- `ahead` = the earliest entry whose effective date is ≥ today.
- `record` = only entries whose effective date is < today, plus dateless ones. A future programme
  never appears in the record.
- Additional future entries render under the ahead entry in the same style, one line each, and the
  rubric switches to a plural key (`aheadMany`: `Najbliższe koncerty` / `The next concerts` /
  `Les prochains concerts`).

`NewsletterPage.astro:67` settles the day at build time; the existing post-event deployment
obligation stands and is not solved here.

## 6. Out of scope, and where it goes

- **The band and the strip** (`/koncerty`, `/kontakt`, landing footer) keep their geometry. They do
  inherit the new clause, the new lede, the new CTA and the loss of the name field — that coupling is
  §1 and is not optional. Their own 11 px labels and 12.5 px clause are the same readability defect
  and get their own stage; do not change their layout in this pass.
- **Ground treatment.** `.ai/07_marketing_public_site.md` names light parchment as the site's
  identity while this page uses night. The audit left it open and so does this brief: night stays.
  Settle it in the design-system file, not in a newsletter commit.
- **Measurement.** None proposed. No trackers.

## 7. Acceptance

1. A stranger can say what arrives and find the action without decoding NUNTIUS or reading the index.
2. Display line, offer, field, clause and button read as one column; the page still works with no
   plate and with no announced concert.
2a. Rendered, not assumed: at 1440×900 the whole invitation including the button is above the fold;
   no edge of the photograph is findable at any width; and the display line stays legible where it
   lies in the dissolve (sample the pixels under it rather than trusting the gradient).
3. At 390 px the extended preview never precedes the field; 320 px reflow and 200 % zoom keep every
   word and control.
4. Functional text at the §2 sizes; underline ≥ 3:1, every word ≥ 4.5:1, action ≥ 44 px; keyboard and
   a screen reader walked through the recovery path.
5. Submission, slow response with an edited field, correction, resend, API failure, timeout,
   confirmation and unsubscribe all keep the right address and always offer a next action.
6. The photograph's caption is dated and carries Kamila Grudzińska; nobody in the audience is
   identifiable; no row in the register and no line on the page implies a letter count or a future
   performance.
7. The clause is the one-line wording in all three locales, `NOTICE_CLAUSE_VERSION` is still `3.0`
   (verified: no production consent was ever stamped 3.0), the name field is gone from every
   placement, and the policy carries the succession clause — all in one commit.

## 8. Files

`web/src/styles/notice.css` · `web/src/components/NoticeSignup.astro` ·
`web/src/components/NoticeRecord.astro` · `web/src/components/pages/NewsletterPage.astro` ·
`web/src/islands/landing/NoticeForm.tsx` · `web/src/islands/landing/NuntiusIsland.tsx` ·
`web/src/islands/landing/api/notices.ts` · `web/src/i18n/content/nuntius.ts` ·
`web/src/content/pages/koncerty.yaml` · `web/src/content/pages.en.yaml` ·
`web/src/content/pages.fr.yaml` · `web/src/content/pages/polityka-prywatnosci.yaml` ·
`web/src/lib/noticeRegister.ts` · `web/src/styles/cursor.css` ·
`backend/outreach/consent.py`

Assets: `web/src/assets/photos/.original-photos/` (the six 9 Kart originals, renamed) ·
`web/src/assets/photos/` (proxies, via `npm run photos:proxy`) · the cutout, alpha intact ·
`web/src/content/concerts.yaml` (gallery rows with the photographer).

Verification: `npm run typecheck` and `npm run build` in `web/`; `ruff` and `mypy` on
`backend/outreach`. The developer judges the UI in his own browser.
