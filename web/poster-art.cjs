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
 * The recipe — the sheet at full card height on a ground blurred out of itself — is shared with the
 * press kit's social graphics (scripts/press-pack/graphics.mjs), so the two cannot drift apart.
 *
 * Run: `node poster-art.cjs` from `web/`. Output lands in src/assets/photos/, which is gitignored
 * — upload it to the build host with the rest.
 */
const sharp = require("sharp");

const DIR = "src/assets/photos";
const POSTER = `${DIR}/poster-stworzenie.png`;
const CARD = { width: 1200, height: 630 };

(async () => {
  const { posterOnGround } = await import("./scripts/press-pack/graphics.mjs");
  const card = await posterOnGround(POSTER, CARD);
  await card.webp({ quality: 86 }).toFile(`${DIR}/share-stworzenie.webp`);

  const m = await sharp(`${DIR}/share-stworzenie.webp`).metadata();
  console.log(`wrote ${DIR}/share-stworzenie.webp — ${m.width}x${m.height}`);
})();
