const sharp = require("sharp");
const { mkdirSync } = require("node:fs");

const SRC = "src/assets/photos";
const OUT = "src/assets/photos";
mkdirSync(OUT, { recursive: true });

// `src` is the station's CANONICAL original — the same file /o-nas shows as the milestone and
// concerts.yaml names in `heroImg`. This used to read `${name}-desktop.webp`: a byte-identical
// copy of that original (and, despite the .webp extension, actually a JPEG), kept only so this
// script had something to read. The heroes now read the canonical file directly, so the copies
// are dead weight — delete them from every build host's photos/ seed (nothing is in git).
//
// HEADS-UP — re-running this will NOT reproduce the committed washes. Those were generated in
// May from the earlier, portrait-ish station crops (900x970, 800x1032); the station sources were
// later replaced with the landscape /o-nas frames (900x600 once resized), which is what the
// detail heroes already show. So the cards are washed from an older crop than their own hero.
// Regenerating realigns them — a visual change to /koncerty, deliberate, not a no-op.
//
// brightness/saturation multiply the source; memoriam (hymn, aeternam) go darker + desaturated.
const jobs = [
  { name: "st-wcielenie-bg", src: "o-nas-wcielenie.jpg", brightness: 0.46, saturation: 0.95 },
  { name: "st-wolanie-bg", src: "o-nas-wolanie-gor.jpg", brightness: 0.46, saturation: 0.95 },
  { name: "st-9-kart-bg", src: "o-nas-9-kart.jpg", brightness: 0.46, saturation: 0.95 },
  { name: "st-hymn-bg", src: "o-nas-ukraina.jpg", brightness: 0.38, saturation: 0.72 }, // memoriam
  { name: "st-aeternam-bg", src: "o-nas-epitafium.jpg", brightness: 0.38, saturation: 0.72 }, // memoriam
  // The liturgy plate has no /o-nas twin (its milestone is a different photograph), so it keeps
  // its own source — a real 1920x1080 webp, not one of the duplicated camera originals.
  { name: "st-liturgia-bg", src: "st-liturgia-bg-desktop.webp", brightness: 0.46, saturation: 0.95 },
];

(async () => {
  for (const { name, src, brightness, saturation } of jobs) {
    await sharp(`${SRC}/${src}`)
      .resize({ width: 900, withoutEnlargement: true }) // blur hides detail → small is fine
      .blur(14) // Gaussian sigma; the heavy wash
      .modulate({ brightness, saturation }) // bake the old CSS darkening
      .webp({ quality: 78 })
      .toFile(`${OUT}/${name}.webp`);
    console.log(`wrote ${OUT}/${name}.webp`);
  }
})();
