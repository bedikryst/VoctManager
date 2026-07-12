const sharp = require("sharp");
const { mkdirSync } = require("node:fs");

const SRC = "src/assets/photos";
const OUT = "public/stations";
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
