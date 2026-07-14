# Station backgrounds — pre-blurred, pre-darkened (`/koncerty`)

The `/koncerty` stations use a full-bleed blurred photo behind each concert. **The blur and the
darkening are baked into the file offline** — the page applies NO `filter` at runtime (a live
`blur()` on six full-bleed layers was expensive/janky). This doc is the recipe to (re)generate or
hand-edit those files.

## Where the files live & how they're named

- Folder: **`web/src/assets/photos/`** (imported through Astro's asset pipeline, then emitted as
  content-hashed `/_astro/*` URLs).
- Filename = the concert's **`bg`** value in `web/src/content/concerts.yaml`, plus `.webp`:

  | Concert | `bg` in YAML | Output file | Source photo (`web/src/assets/photos/`) | Darkness |
  |---|---|---|---|---|
  | Kontemplacja Wcielenia | `st-wcielenie-bg` | `st-wcielenie-bg.webp` | `st-wcielenie-bg-desktop.webp` | normal |
  | Wołanie Gór | `st-wolanie-bg` | `st-wolanie-bg.webp` | `st-wolanie-bg-desktop.webp` | normal |
  | 9 Kart z Księgi Psalmów | `st-9-kart-bg` | `st-9-kart-bg.webp` | `st-9-kart-bg-desktop.webp` | normal |
  | Hymn Poległym | `st-hymn-bg` | `st-hymn-bg.webp` | `st-hymn-bg-desktop.webp` | **memoriam (darker)** |
  | Aeternam | `st-aeternam-bg` | `st-aeternam-bg.webp` | `st-aeternam-bg-desktop.webp` | **memoriam (darker)** |
  | Uroczystość św. A. Boboli | `st-liturgia-bg` | `st-liturgia-bg.webp` | `st-liturgia-bg-desktop.webp` | normal |

The code that consumes them: `web/src/pages/koncerty.astro` — `bgSrc: photo(c.data.bg).src`
(so **the output name must match the `bg` field exactly**; a new concert with a new `bg` needs a new
file in `src/assets/photos`). The station layers already darken further on top via the `.station::before` radial veil,
so the baked image only needs to get *most* of the way dark.

**When you add a NEW concert:** create `st-<slug>-bg-desktop.webp` in `src/assets/photos` (the sharp
source), then generate `web/src/assets/photos/st-<slug>-bg.webp` with the recipe below.

---

## Option A — regenerate all six with one script (fastest)

The current files were produced with `sharp` (already a dependency). Run `node blur-stations.cjs`
from `web/`. Re-run whenever a source photo changes.

```js
const sharp = require("sharp");
const { mkdirSync } = require("node:fs");

const SRC = "src/assets/photos";
const OUT = "src/assets/photos";
mkdirSync(OUT, { recursive: true });

// brightness/saturation multiply the source; memoriam (hymn, aeternam) go darker + desaturated.
const jobs = [
  { name: "st-wcielenie-bg", brightness: 0.46, saturation: 0.95 },
  { name: "st-wolanie-bg", brightness: 0.46, saturation: 0.95 },
  { name: "st-9-kart-bg", brightness: 0.46, saturation: 0.95 },
  { name: "st-hymn-bg", brightness: 0.38, saturation: 0.72 }, // memoriam
  { name: "st-aeternam-bg", brightness: 0.38, saturation: 0.72 }, // memoriam
  { name: "st-liturgia-bg", brightness: 0.46, saturation: 0.95 },
];

(async () => {
  for (const { name, brightness, saturation } of jobs) {
    await sharp(`${SRC}/${name}-desktop.webp`)
      .resize({ width: 900, withoutEnlargement: true }) // blur hides detail → small is fine
      .blur(14) // Gaussian sigma; the heavy wash
      .modulate({ brightness, saturation }) // bake the old CSS darkening
      .webp({ quality: 78 })
      .toFile(`${OUT}/${name}.webp`);
    console.log(`wrote ${OUT}/${name}.webp`);
  }
})();
```

Output is tiny (~2–3 KB each, ~24 KB total) because a heavy blur compresses to almost nothing.

---

## Option B — hand-edit one file in Photopea (photopea.com, free)

Use this when you want art control over a specific station (reframe, hand-tune the darkness).

1. **Open** the source: `web/src/assets/photos/st-<name>-bg-desktop.webp`.
2. **Shrink it** (blur destroys detail, so a big canvas is wasted bytes): `Image → Image Size` →
   set **Width ≈ 900 px** (keep aspect ratio). If a station is very tall/portrait that's fine —
   the page uses `background-size: cover`, any aspect works.
3. **Blur:** `Filter → Blur → Gaussian Blur` → **radius ≈ 25–30 px** (at ~900 px wide). It should
   become an abstract wash of colour with no readable subject. Scale the radius with the width —
   e.g. ~50 px if you kept the image ~1600 px wide.
4. **Darken + desaturate** so white text stays readable over it:
   - Normal stations: `Image → Adjustments → Hue/Saturation` → **Lightness ≈ −45**, **Saturation ≈ −5**.
   - Memoriam (Hymn Poległym, Aeternam): darker + greyer → **Lightness ≈ −60**, **Saturation ≈ −40**.
   - (Equivalent to the script's `brightness 0.46 / 0.30` and `saturation 0.95 / 0.62`.)
5. **Export:** `File → Export as → WEBP` → **Quality ≈ 0.68**. Save as the **output filename** from
   the table (e.g. `st-hymn-bg.webp`, NOT the `-desktop` source name).
6. **Drop it into** `web/src/assets/photos/`, overwriting the old one.

## Verify

`cd web && npm run build`, then open `/koncerty`. Each station should show a soft dark colour-wash
behind the text with no visible blur "work" on scroll. The two memoriam concerts read noticeably
darker and greyer than the rest. If a background is missing, the filename doesn't match the concert's
`bg` field.
