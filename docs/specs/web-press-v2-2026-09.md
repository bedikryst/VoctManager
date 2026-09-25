# /press v2 — the board's structure, our design

**Status: approved 2026-09-25. Stage 0 done (photos moved out of the tracked tree, this spec,
board-inputs). Stage 1 done 2026-09-25 (kit YAML with drafted copy, `lib/pressKit.ts`, the
generator). Stage 2 done 2026-09-26 (the page, `press.yaml`, `press.ts`, `data/social.ts`, the
lightbox, `lib/pressPack.ts` reading `index.json`); not yet seen in a browser. Copy not yet
approved by Ania. Next: Stage 3, the composer.** Supersedes `web-press-pack-2026-09.md` wherever
the two disagree; that file stays the record of how the pack generator and `foundation.ts` came to
exist.

Stage 2 departed from this spec in four places:
- **No checkboxes yet.** They arrive with the composer in Stage 3, together with the chrome labels
  that only the basket uses (Zaznacz wszystkie, Wybrano, Pobierz wybrane, Wyczyść). Rendering
  hidden inputs for a script that does not exist yet would be dead markup.
- **`kitHash` also covers the `press.yaml` fields the pack prints** (the short and long biograms,
  both usage texts), `FOUNDATION` and the mark (`PACK_COPY_FIELDS` in `lib/pressKit.ts`). The
  page's "Kopiuj tekst" on the release closes on the short biogram; without this, an edit to it
  would let the button and the PDF beside it disagree.
- **A kit may carry the designer's print poster**: `web/press-pack/posters/<concert-id>.pdf`
  (gitignored) is copied byte for byte to `<concert>/plakat-do-druku.pdf`, goes into komplet, and
  gets its own row. Optional: its absence is a note in the generator's output.
- **Rubrics are `.eyebrow.titulus`, not `.press-eyebrow`.** Outside the two-tier `:has(.lat)`
  rule, `.press-eyebrow` has no face in `base.css`. `press.items` (the publications list) is gone
  with the generator's `nagrania.txt`; the four URLs are in git history before this stage.

Stage 1 departed from this spec in three places, each for a reason:
- **The release quotes Florent's own programme note (§1 of the concert spec), not §9.** §9 was
  generated, not written, and the corpus rules it may not carry his name.
- **`kitHash` also covers the corpus rows of the kit's concerts**, because the PDFs print them;
  an edit to another evening does not change it.
- **The card's lede is `essence`, never `invitation`**: the invitation greets the creatures
  „jak rodzeństwo", the horizontal kinship the kit is barred from.

## Context

Ania Kaczka (board, 2026-09-25) wants `/press` simpler and more functional:
- the latest concert first;
- every file viewable in the browser before download (the LSO model);
- ready photos in feed formats;
- ready-to-paste copy for social media managers ("informacje sprawdzone, foty dopasowane").

The rider is **out** of `/press`: it is organiser information for before a collaboration starts,
not needed now. Sketches: `docs/specs/press/szkic akm VE press.jpg` (full page) and two WhatsApp
crops beside it. Design is ours.

Today's page (`web/src/components/pages/PressPage.astro`) has six blocks: head, three biograms,
pack tile, facts tiles, collaborators and booking. The pack has never been built: `manifest.yaml`
waits for a rider and photos. **The concert is 11.10.2026, so the copy and the page are
time-critical.**

## Settled decisions (developer, 2026-09-25)

- **The page has a composer**: checkboxes plus "Pobierz wybrane", with the ZIP built **in the
  browser**, store-only.
  - The backend was rejected. Its only ZIP path is the authenticated finance Celery task; reusing
    it would need a public unauthenticated endpoint, a second copy of the press files readable by
    Django, and would make the marketing site depend on the panel.
  - Progressive enhancement: without JS the checkboxes stay hidden, and the per-file links and the
    two prebuilt ZIPs remain.
  - When everything is selected, the composer serves the prebuilt komplet instead of building one.
- **Photo #10 (Florent) is 244×366, a thumbnail.** The developer is getting the original. The
  generator **skips** any photo whose crop has a short edge under 1080 px and names it in its
  output; the tile appears once the file is replaced.
- **A photo with no author is the ensemble's own archive**: credit `fot. VoctEnsemble`, matching
  Ania's `@VoctEnsemble` and the file names. This deliberately differs from the site's own
  `ownArchiveCredit` in `lib/photoCredit.ts` ("archiwum zespołu"): a press credit is the line an
  editor prints under the photo, so it names who to credit, not where the frame came from.
  - The **colour** violin square (`2024_05_29_21_12_IMG_01772-5.jpg`) joins the 4:5 set as a
    1488×1860 crop: good for social and web, not for print.
  - Its B&W twin (`IMG_0177-5`) is the same frame and is not used.
- **Only VoctEnsemble has social accounts.** "Oznacz nas" lists the ensemble's FB, IG and YT.
  No @VoctFoundation.

## Design decisions (ours)

- **Two photo formats: 16:9 (01–06) and 4:5 (07, 08, 09, violin, later 10).** Ania's chat asked
  for 4:5, the feed format; the sketch's "9:16" label is stories, and that format goes to the
  poster graphics instead.
- **One file per photo, cropped to exactly the ratio shown**, long edge ≤ 5000 px, JPEG q92.
  What you see is what you download.
  - The crop uses a per-photo `focus`, set by looking at each frame.
  - The ICC profile is kept; EXIF `Artist` and `Copyright` carry the credit.
  - **All other metadata, GPS included, is stripped.**
- **Rubrics are plain Polish, no Latin glosses**: Najnowsze · Zdjęcia prasowe · Social media ·
  O zespole · Fundacja · Kontakt dla mediów. On a surface a stranger meets first, the simplest
  word beats the site's idiom.
- **Usage terms sit under the photos heading**, where the choice is made, not at the page foot.
  The full text goes in `PRZECZYTAJ.txt`.
- **The concert kit shows only while its concert is upcoming** (build-time date, the
  `upcomingStation` convention). The deploy after 11.10 hides it.
- **Cut from the page:** facts tiles (Tabula), collaborators (Socii), booking (Invitatio), rider.
  **Kept:** the three biograms with Kopiuj, and the foundation's legal rows with copy.

## Page, top to bottom

`PressPage.astro`, dark head, then `tone-light`, as today.

1. **Head.**
   - "Press" / "Materiały dla mediów", and one line: "Wybierz pliki albo pobierz całość jednym
     kliknięciem."
   - Primary button: **Pobierz komplet ↓ (ZIP · size)**.
   - Jump nav: Najnowsze · Zdjęcia · Social media · O zespole · Kontakt.
2. **`#najnowsze`: the concert card, laid out as in Ania's mockup.**
   - Left column:
     - the poster, which opens in `ImageLightbox`;
     - the forces tag;
     - links: Informacja prasowa → · Zdjęcia → · Pobierz komplet ↓.
   - Right column:
     - title, then the dateline (day, date — time);
     - venue and address;
     - festival and "wstęp wolny";
     - lede;
     - composers in italic;
     - **Kopiuj**: copies this fact block plus the concert URL as plain text.
   - Under the card, the **materials rows**, each: checkbox · icon · title and subtitle · format
     and size · actions.

     | Row | Format | Actions |
     |---|---|---|
     | Informacja prasowa | PDF | Otwórz (new tab), Kopiuj tekst, ↓ |
     | Zapowiedź · do 500 znaków | TXT | Pokaż (inline disclosure), Kopiuj, ↓ |
     | Zapowiedź · do 1500 znaków | TXT | Pokaż (inline disclosure), Kopiuj, ↓ |
     | Program koncertu | PDF | Otwórz, ↓ |
     | Biogramy | PDF | Otwórz, ↓ |
     | Plakat | JPG | Otwórz (lightbox), ↓ |

     Biogramy covers VoctEnsemble, Florent, guests and VoctFoundation, but only those with a
     text on record.
3. **`#zdjecia`: press photos.**
   - Lede: the usage terms, in one or two sentences.
   - Two groups: "Poziome 16:9 — strony, Facebook, YouTube" and "Pionowe 4:5 — Instagram, druk".
   - Each tile:
     - a checkbox;
     - the thumbnail, which opens the 2400 px preview in the lightbox (`[data-image-open]`,
       `data-image-group` per ratio);
     - caption;
     - `fot. X`;
     - `W×H · MB`;
     - ↓.
   - "Zaznacz wszystkie" per section. Foot: **Pobierz wszystkie zdjęcia ↓ (ZIP · size)**.
4. **`#social`.**
   - The post, text shown, with Kopiuj.
   - Hashtags as chips, with Kopiuj.
   - Grafiki: the poster mounted on its own blurred ground at **4:5 1080×1350, 9:16 1080×1920
     and 16:9 1920×1080**. Each has a thumbnail, a checkbox and ↓.
   - Oznacz nas: the FB, IG and YT handles, each linked, each with Kopiuj.
5. **`#o-zespole`.**
   - The existing three biograms with Kopiuj.
   - The logo (SVG plus two PNGs, which the generator already makes), with a checkbox and ↓.
6. **`#fundacja`.** One paragraph plus the existing `LEGAL_ROWS` with copy.
7. **`#kontakt`.**
   - Press address: `FOUNDATION.mail.press`.
   - Block: "Materiały dla radia i telewizji — Nagrania emisyjne, B-roll i dodatkowe materiały
     udostępniamy bezpośrednio redakcjom. Napisz →" (mailto with a subject).
   - A named person and phone appear only once the board supplies them. No placeholder.
8. **Basket bar.**
   - Fixed at the bottom; appears once at least one item is selected.
   - Reads: "Wybrano N · X MB · [Pobierz wybrane ↓] [Wyczyść]".
   - This bar is Ania's "CTA pobierz wybrane materiały".

Page CSS sets only the ground and the layout. It never restates the rubric atom from `base.css`:
a page rule silently beats `base.css`.

## Data sources

- **New `web/src/content/press-kits/<concert-id>.yaml`** (tracked, PL-only):
  - `concert`: an id in `concerts.yaml`;
  - `forces`: "12 głosów · skrzypce · organy" (the corpus has no voice count);
  - `release {title, lead, body[], quote?}`;
  - `announce {short, long}`;
  - `social {post, hashtags[]}`;
  - `guests[] {name, role, bio}`.
- **New `web/src/lib/pressKit.ts`**: zod schema and loader.
  - **`announce.short` ≤ 500 and `announce.long` ≤ 1500 characters, measured on the exact
    string Kopiuj writes.** The build fails over either.
  - Imported by both the generator (bare Node) and Astro, so Node type-stripping rules apply:
    explicit `.ts` extensions, and `import type` between content modules.
  - "Najnowsze" is the kit whose concert is the soonest upcoming one.
  - Concert facts are read from `concerts.yaml` through the existing helpers, never copied into
    the kit: title, date, venue, address, festival, admission, lede (`essence` / `invitation`),
    composers, poster.
- **`web/press-pack/manifest.yaml`, reshaped:**
  - `photos[] {id, source, ratio: "16:9"|"4:5", focus: [x,y], caption, credit}`;
  - `rider`, `month` and `programmes` are dropped, and the header comment is rewritten to the new
    truth;
  - the "NOT ELIGIBLE" note (Płachetko) stays.
- **Press originals live in `web/press-pack/photos/`** (gitignored, ≈90 MB, never committed).
  The sketches stay in `docs/specs/press/`.
- **New `web/src/data/social.ts`**: `SOCIAL {facebook, instagram, youtube}: {url, handle}`. Six
  hardcoded sites switch to it: `SiteFooter.astro`, `islands/landing/SiteFooter.tsx`, and the
  `sameAs` arrays in the Press, Landing, About and Contact pages.

## Generator

`web/scripts/press-pack.mjs`, with helpers split into `web/scripts/press-pack/`. Output goes to
`web/public/press/`, which is gitignored and uploaded to the build host by hand:

- Photos:
  - `zdjecia/<id>.jpg`: the hi-res crop;
  - `zdjecia/podglad/<id>.jpg`: 2400 px, q85;
  - `zdjecia/miniatury/<id>-{640,1280}.webp`.
- Concert kit, under `<concert>/`:
  - `informacja-prasowa.pdf`, `program.pdf`, `biogramy.pdf`;
  - `zapowiedz-500.txt`, `zapowiedz-1500.txt`, `post.txt`, `hashtagi.txt`;
  - `plakat.jpg`;
  - `grafika-{4x5,9x16,16x9}.jpg` plus thumbnails.
- Also:
  - `logo/*`;
  - `PRZECZYTAJ.txt`: usage terms, every photo credit, contact;
  - `dane-do-faktury.txt`.
- Two ZIPs, **komplet** and **zdjęcia**, via `scripts/zip.mjs`: media `store`, text `deflate`,
  text files UTF-8 with BOM and CRLF.
- **`index.json`**: every file with its path, bytes and dims; caption and credit for photos;
  `kitHash`, a hash of the kit YAML plus the manifest.

How it is built:

- **PDFs:** `playwright-core` (devDependency) drives **system Edge**, via
  `chromium.launch({channel: "msedge"})`, overridable by `PRESS_PDF_CHANNEL`. No browser download,
  same approach as the `vm-shot` harness.
  - Templates live in `scripts/press-pack/pdf/`: A4, site fonts from `web/public` over `file://`,
    the mark in the header, the press contact and page number in the footer.
  - The PDF text is real, selectable text.
- **Poster graphics:** the recipe in `web/poster-art.cjs` (the sheet on its own ground, blur 28)
  moves into a shared helper that both use.
- **Refuses, naming what is missing**, when:
  - the kit or its concert is missing;
  - a photo has no credit or no source file;
  - a photo is in `.held-no-consent`.
- **Only warns and skips** when a photo crop is under 1080 px on its short edge (Florent #10
  today) or an archive is over 50 MB.

## What the page reads

`web/src/lib/pressPack.ts`, rewritten:

- It reads `public/press/index.json` and checks that every listed file exists.
- **If `kitHash` does not match the current kit and manifest, the build fails** with: "run
  `npm run press:pack` and upload `public/press/`".
- If there is no index, the texts still render from YAML and the download controls fall back to
  the "Napisz po materiały" mailto.
- Every `href` carries `?v=<hash>`, so a replaced ZIP is never served from cache.

## Composer

- **`web/src/lib/zipStore.ts`**, pure: a CRC32 table, local and central headers, the UTF-8 flag,
  store only, no ZIP64. It mirrors `scripts/zip.mjs`.
- **`web/src/scripts/press-basket.ts`**, a plain inline script in the pattern of `copy-fields.ts`
  (keeping the `export {}` guard):
  - reveals the checkboxes and drives the bar, with sizes from `data-bytes`;
  - fetches the selected files one at a time;
  - always adds `PRZECZYTAJ.txt` and mirrors komplet's folder layout;
  - downloads through a Blob URL;
  - serves komplet instead when everything is selected.
- **Lightbox:** the existing `islands/landing/ImageLightbox.tsx`, mounted as `ConcertPage` and
  `ObrazyPage` mount it, wired through `scripts/image-triggers.ts`.

## Copy

Drafted by us, approved by Ania before deploy.

- **Kit texts for Pochwała Stworzenia:**
  - the release: ~2500–3500 characters, with a quote from Florent taken from §9 of the concert
    spec;
  - the ≤ 500 and ≤ 1500 character announcements;
  - the post;
  - the hashtags. Proposal: #VoctEnsemble #PochwałaStworzenia #FenomenCzłowieka #KoncertDuchowy
    #MuzykaChóralna #ArvoPärt #Warszawa. Check the festival's own tag.
- **Sources:** `concerts.yaml` (`essence`, `invitation`, `programLede`, festival) and
  `docs/specs/koncert-pochwala-stworzenia-2026-10.md` §9, §10 and §15.
- **Binding constraints from that spec:**
  - the vertical relation only (the human as God's image), never "człowiek bratem stworzeń";
  - no Staff translation of the Canticle before 2028;
  - **the bis is never mentioned**;
  - nothing about the order of the Pärt episodes;
  - the Stetit Angelus / Wszystkich Świętych fact is spent once.
- **Page copy in `press.yaml`:** head, section ledes, usage terms, the radio/TV block.
  - Ania's README text is rewritten into clean Polish, and it **explicitly allows cropping and
    scaling**. Her wording forbade any modification, which would forbid the crops social managers
    always make.
  - This is a legal statement: she approves it.
- **`PRESS_CHROME`** gets new labels in **pl, en and fr**: Otwórz, Pobierz, Pokaż, Kopiuj tekst,
  Zaznacz wszystkie, Wybrano, Pobierz wybrane, Wyczyść, sizes. The page stays out of
  `TRANSLATED_ROUTES`.

## Files

- **Edit:**
  - `web/src/components/pages/PressPage.astro`;
  - `web/src/content/pages/press.yaml`;
  - `web/src/i18n/content/press.ts` (schema, `PRESS_CONTRACT`, `PRESS_NOT_COPY`, `PRESS_CHROME`);
  - `web/src/lib/pressPack.ts`;
  - `web/scripts/press-pack.mjs`;
  - `web/press-pack/manifest.yaml`;
  - `web/poster-art.cjs`;
  - `web/package.json`;
  - the six social call sites.
- **New:**
  - `web/src/content/press-kits/pochwala-stworzenia.yaml`;
  - `web/src/lib/pressKit.ts`;
  - `web/src/lib/zipStore.ts`;
  - `web/src/scripts/press-basket.ts`;
  - `web/src/data/social.ts`;
  - `web/scripts/press-pack/{photos,pdf,graphics}.mjs` plus the PDF templates.
- **Docs, when the page ships:** move `web-press-pack-2026-09.md` to `docs/archive/` with a
  Status line pointing here.

## Stages

1. Kit YAML with drafted copy, and the generator: crops, graphics, PDFs, ZIPs, index. Run
   `npm run press:pack`, look at every crop, adjust the focus values.
2. The page, `press.yaml` and `press.ts`; the social SSOT; the lightbox.
3. The composer: `zipStore`, `press-basket`.
4. Send Ania the PDFs and a local preview. Apply her corrections, then deploy.

## Verification

Once per stage, in `web/`:

- `npm run press:pack`. **Round-trip both ZIPs through `Expand-Archive`**, and a ZIP built by
  `zipStore.ts` under Node the same way. Open every PDF, view the crops.
- `npm run test:copydesk` (the press contract keys change) and `npm run build`.
- The developer checks `/press` in his own browser: `npm run dev` in `web/`, then
  `http://localhost:4321/press`, on desktop and at phone width.
- **Prod**, from the laptop: upload `web/public/press/` to the build host's `web/public/press/`,
  then deploy the site. Without the upload the build fails on `kitHash`, which is the intent. The
  deploy after 11.10 hides the kit.
