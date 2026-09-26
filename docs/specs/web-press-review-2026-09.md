# /press — review round 1: defects, media convenience, micro-design

**Status: audit done 2026-09-26, nothing built. R1 needs no decisions and goes before Ania's
preview (Stage 4 of `web-press-v2-2026-09.md`). R2 waits on the developer's four answers below.
R3 rides with Stage 4.**

Audited on the dev server, 1440×900 and 390×844, with the composer live. Desktop page ≈ 9 700 px,
phone ≈ 13 800 px. The base is sound: the structure follows the board, the composer works, the
bar reads well. What holds it back is alignment, a flat action hierarchy (≈ 60 identical boxed
buttons), and the few things an editor needs that are missing or sit at the wrong end of the page.

## A. Defects — fix regardless

- **A1. File rows do not share columns.** Each `.press-file` is its own grid with an `auto`
  actions track, so "PDF · 190 kB" sits 130 px left of the other rows' meta whenever a row has
  three actions. Make `.press-file-list` the grid and the rows `grid-template-columns: subgrid`.
- **A2. Photo tiles misalign across a row.** A caption that wraps pushes that tile's meta line
  down. Tile = `grid-row: span 3; grid-template-rows: subgrid` (picture, caption block, meta).
- **A3. Portrait orphan.** Five 4:5 photos in a four-column grid leave the violin alone on a
  second row. Five columns ≥ 1100 px; the count must fit the row at every breakpoint.
- **A4. Foundation ledger.**
  - Seven rows in a two-column grid leave the eighth cell showing the grid's `--line`
    background as a grey slab. Span the last odd row, or give the grid no background.
  - `dd.is-ledger span` also reaches the button's label, so ledger Kopiuj buttons are larger than
    the name and address ones. Scope the rule to the value span.
- **A5. Two different "Kopiuj tekst".** The concert card's button copies the fact block; the
  release row's copies the release. Card label: "Kopiuj informacje o koncercie".
- **A6. Touch targets.** Buttons are ≈ 28 px high and the checkbox 18 px. Keep the drawn size,
  grow the hit area to 44 px under `(pointer: coarse)`.
- **A7. Dev only:** the running dev server answers `/_image` with 500 `MissingSharp` (the
  concert poster is blank). `sharp` is installed; restart `npm run dev`.

## B. Convenience for media

- **B1. The head carries one of the three things an editor comes for.** Komplet is there; the
  press address sits ≈ 9 000 px lower, and the right half of the head is empty on desktop.
  - Right column: the press address with Kopiuj, then "W komplecie: informacja prasowa, program,
    biogramy, plakat, 11 zdjęć, grafiki, logo" and "Aktualizacja: 26 września 2026"
    (`index.generatedAt`). An editor wants to know a pack is current before quoting it.
  - Shorter head: at 1440×900 the first section's rubric starts at 855 px, against the spec's
    own intent ("see the first section without a scroll"). Target: the concert title visible.
- **B2. Per-photo "Kopiuj podpis".** Caption plus `fot. …`, the line an editor prints under the
  picture. Today they retype it from the tile.
- **B3. The concert card's three links repeat the head and the list directly below**
  (Informacja prasowa →, Zdjęcia →, Pobierz komplet ↓). Replace them with "Strona koncertu →";
  the title is the only link to it today, and nothing shows that it is one. The motive in Ania's
  mockup, reaching the files from the card, is met by the list that now sits under it.
- **B4. Download is the least-labelled action.** On every row and tile the most used action is a
  bare ↓ square while "Otwórz" gets a word. Primary = "Pobierz" with an icon; "Podgląd" and
  "Kopiuj" secondary (see C1).
- **B5. The logo tiles.** "Wzorzec wektorowy" and "Na jasne tło" render identically. Two tiles,
  one per ground, each offering its formats (jasne: SVG · PNG; ciemne: PNG).
- **B6. Biograms: the UI explains itself.** "Kopiowanie nie wymaga rozwijania: przycisk bierze
  czysty tekst…" describes the widget. Drop it. See R2 for the segmented control that removes
  the need.

## C. Micro-design

- **C1. One action hierarchy instead of one box.** Every action is the same 1 px grey mono-caps
  box, so nothing leads.
  - Primary "Pobierz": the only boxed action, ink border, sans 13 px, drawn icon.
  - Secondary "Podgląd", "Kopiuj": icon plus word, no box, ink-soft; hover ink with an underline.
  - Mono caps stay for figures only (format, size, dimensions, counts) and "Zaznacz wszystkie".
- **C2. Drawn icons, not font arrows.** ↓ → ↗ come from the serif and sit on different baselines
  inside mono boxes. One inline-SVG set (download, open, copy, check), 16 px, 1.25 stroke,
  `currentColor`. On copy the icon becomes a check; the word already becomes "Skopiowano"
  (`copy-fields.ts` reads `data-copied`).
- **C3. Eleven white squares over the photographs.** Tile checkboxes show on hover, on focus, and
  on every tile once anything is ticked (`main.is-picking`, set by `press-basket.ts`); always
  under `(hover: none)`. A tile's hover gets a quiet veil with "Podgląd".
- **C4. Vertical rhythm for a tool, not a landing.** `.press-section` pads 128 px top and bottom
  and every rubric opens a further gap. About −30 %, which also shortens the phone page.
- **C5. Empty right halves.** Head, O zespole (bios capped at 820 px above a full-width logo
  grid) and Kontakt (card capped at 760 px) all leave ≈ 40 % blank at 1440. O zespole goes two
  columns on desktop: bios 7/12, logo 5/12. Kontakt gets the broadcast block beside the card.

## Stages

- **R1 — before Ania's preview, no decisions needed:** A1–A6, B1–B6, C1–C4.
  - `web/src/components/pages/PressPage.astro`: markup and CSS.
  - `web/src/i18n/content/press.ts`: new labels in PL, EN and FR (Pobierz, Podgląd,
    Kopiuj podpis, Kopiuj informacje o koncercie, W komplecie, Aktualizacja).
  - `web/src/scripts/press-basket.ts`: the `is-picking` class.
  - `web/src/scripts/copy-fields.ts`: the icon swap on success, if C2's check lives there.
  - `web/src/lib/pressPack.ts`: `generatedAt` exposed to the page.
- **R2 — after the answers below:** sticky index, phone photo rows, the foundation's weight, the
  biogram control, C5.
- **R3 — with Stage 4:**
  - PDF first-page thumbnails in the file rows in place of the generic icons (the generator
    already drives Edge for the PDFs).
  - Biograms for Florent and Radu Ropotan. The release names both and `biogramy.pdf` holds only
    the ensemble: an editor writing about the concert has no text on either. Content from Ania.
  - A logo lockup with the name (mark + "VoctEnsemble"). The bare mark is unreadable to an editor
    who does not know the ensemble. Asset from the designer.

## Decisions for the developer (R2)

1. **Sticky section index.** The head's index becomes a slim bar under the site header once the
   head scrolls away, with the current section marked. Recommended on desktop and tablet only:
   on a phone the header, the index and the basket bar would take ≈ 180 px of chrome.
2. **Photos on a phone.** Each ratio group a horizontal scroll-snap row with the next tile
   peeking, instead of eleven stacked tiles (≈ −3 000 px). Recommended. Against it: a row hides
   what it does not show.
3. **The foundation's weight.** KRS, NIP and two bank accounts serve organisers, not editors.
   Recommended: one disclosure, "Dane do umów i faktur", with the ledger and the .txt inside.
4. **Biograms as one card.** Krótki · Średni · Pełny as a segmented control; the character count
   and the one Kopiuj follow the chosen length. Recommended.

## Verification

`npm run build` (it runs the register audit), then 1440×900 and 390×844 in the browser: rows and
tiles aligned, no grey cell, one boxed action per file, copy confirmations, the bar over the
composer.
