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
 * the evening, prepared by `npm run photos:proxy` like every other station's (docs/
 * station-backgrounds.md). This file exists for the one surface a photograph cannot serve: an
 * evening still ahead, where a link is an invitation.
 *
 * The recipe — the sheet at full card height on a ground blurred out of itself — is shared with the
 * press kit's social graphics (scripts/press-pack/graphics.mjs), so the two cannot drift apart.
 *
 * Run from `web/`: `node poster-art.cjs <poster> <share>` — the poster's file name in
 * src/assets/photos/ and the stem the card is written under, the one the evening's `share` names
 * (`node poster-art.cjs poster-stworzenie-poznan.jpg share-stworzenie-poznan`). Output lands in
 * src/assets/photos/, which is gitignored — upload it to the build host with the rest.
 */
const sharp = require("sharp");

const DIR = "src/assets/photos";
const CARD = { width: 1200, height: 630 };

const [poster, share] = process.argv.slice(2);
if (!poster || !share) {
  console.error("usage: node poster-art.cjs <poster file in src/assets/photos> <share stem>");
  process.exit(1);
}

(async () => {
  const { posterOnGround } = await import("./scripts/press-pack/graphics.mjs");
  const card = await posterOnGround(`${DIR}/${poster}`, CARD);
  const out = `${DIR}/${share}.webp`;
  await card.webp({ quality: 86 }).toFile(out);

  const m = await sharp(out).metadata();
  console.log(`wrote ${out} — ${m.width}x${m.height}`);
})();
