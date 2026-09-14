/**
 * The share card for an evening whose poster carries its facts.
 *
 * Open Graph wants ~1.91:1 and every concert poster in this archive is a standing A-sheet, so a
 * link to a concert page used to preview as the hero photograph — true to the page, and silent
 * about the date, the hour and the door. This mounts the poster WHOLE on a ground blurred out of
 * its own sky: at 630px tall the title, the byline, the dateline and the venue are all still
 * readable, which is the entire job of a link somebody forwards to a friend.
 *
 * Deliberately NOT a crop. Any landscape cut of this sheet loses either the title or the
 * dateline, and a share card that has dropped the date is a poster of nothing.
 *
 * The concert's own imagery does not come from here: `kd-stworzenie-hero-*` are photographs of
 * the church, prepared by `npm run photos:proxy` like every other station's (docs/
 * station-backgrounds.md). This file exists for the one surface a photograph cannot serve.
 *
 * Run: `node poster-art.cjs` from `web/`. Output lands in src/assets/photos/, which is gitignored
 * — upload it to the build host with the rest.
 */
const sharp = require("sharp");

const DIR = "src/assets/photos";
const POSTER = `${DIR}/poster-stworzenie.png`;
const CARD = { width: 1200, height: 630 };

(async () => {
  // The sheet at full card height, and a ground cover-cropped from the same file so the colour
  // beside the sheet is the sheet's own. Blur 28 is well past the point where the ring of work
  // titles is language; brightness 0.86 seats the sheet without darkening the card into a mood.
  const sheet = await sharp(POSTER).resize({ height: CARD.height }).toBuffer({ resolveWithObject: true });
  const ground = await sharp(POSTER)
    .resize({ ...CARD, fit: "cover", position: "top" })
    .blur(28)
    .modulate({ brightness: 0.86, saturation: 0.9 })
    .toBuffer();

  await sharp(ground)
    .composite([{ input: sheet.data, left: Math.round((CARD.width - sheet.info.width) / 2), top: 0 }])
    .webp({ quality: 86 })
    .toFile(`${DIR}/share-stworzenie.webp`);

  const m = await sharp(`${DIR}/share-stworzenie.webp`).metadata();
  console.log(`wrote ${DIR}/share-stworzenie.webp — ${m.width}x${m.height}`);
})();
