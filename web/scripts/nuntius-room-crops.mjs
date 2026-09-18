/**
 * @file nuntius-room-crops.mjs
 * @description Cuts the three windows of the room the notice list stands in — one frame, three
 *  boxes — into `src/assets/photos/`. Run it when the frame changes or a crop needs re-deriving:
 *
 *      node scripts/nuntius-room-crops.mjs
 *
 *  ONE FRAME, THREE WINDOWS, AND THE FOOT IS WHAT IS COMPOSED. The plate's box on `/newsletter` is
 *  an accident of the window (1.10:1 at 901x900, 2.41:1 at 1920x900), so the picture is consumed
 *  with `object-position: 100% 100%`: the bottom and right edges are the composed ones and a
 *  shorter or narrower box gives up ceiling and the far end of the row. That only works if the
 *  bottom edge of each cut already lands on a dark line. Row luminance of the frame, mean over
 *  x 0-0.70, 0-255:
 *
 *    y 0.27        the red sanctuary LED, blown to 255,0,0 — every window starts below it
 *    y 0.41-0.59   the singers: faces, folders, the conductor's back        mean 26 -> 65
 *    y 0.62-0.68   dark dresses and the listeners' silhouettes              mean 13, max 69
 *    y 0.71-0.86   the brass lectern, blown to 255 at y 0.78                mean 15, max 158
 *    y 0.89-1.00   floor, dead black                                        mean 7, max 12
 *
 *  So a plate may end on exactly two lines: 0.68, above the lectern, and 0.885, below it. Anything
 *  else guillotines something lit — which is what the first cut did, across five lit dresses at
 *  1920x900 and through the lectern's base at 1920x1080.
 *
 *  The frame and its cuts live under `src/assets/photos/`, which is gitignored: photographs are
 *  collaborator-owned and travel to the host out of band. This script is the record of HOW the
 *  cuts were made, so they can be remade wherever the frame is.
 * @architecture Astro islands 2026
 * @module scripts/nuntius-room-crops
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const PHOTOS = path.join(here, "..", "src", "assets", "photos");
const SRC = path.join(PHOTOS, "new", "VE_9Kart_Krk (K.Grudzińska)  (63).jpg");

/** The frame's own pixels — the windows below are fractions of these. */
const W = 5631;
const H = 3754;

const WINDOWS = [
  /* Ends BELOW the lectern, in the floor shadow, and carries the vault. Serves plate boxes
     between about 1.1:1 and 1.95:1 — every desktop with height in it, and the tablet. */
  { name: "nuntius-room-spread", x0: 0, x1: 0.66, y0: 0.285, y1: 0.885, deliver: 2560 },
  /* Ends ABOVE the lectern, in the dresses, and carries less vault. Serves boxes wider than
     about 1.95:1 — a short desktop window, a phone held sideways, a desktop at 200% zoom. */
  { name: "nuntius-room-wide", x0: 0, x1: 0.66, y0: 0.285, y1: 0.68, deliver: 2560 },
  /* The phone held upright, and it is cut to the LEFT of the conductor: centred on him the box
     fills with his back, and the left side is also the lit one (mean sRGB 27.2 against 20.1),
     because the faces there are lit from the front. */
  { name: "nuntius-room-phone", x0: 0.02, x1: 0.46, y0: 0.26, y1: 0.9, deliver: 1100 },
];

for (const w of WINDOWS) {
  const region = {
    left: Math.round(w.x0 * W),
    top: Math.round(w.y0 * H),
    width: Math.round((w.x1 - w.x0) * W),
    height: Math.round((w.y1 - w.y0) * H),
  };

  await sharp(SRC)
    .extract(region)
    .resize({ width: w.deliver })
    .webp({ quality: 82 })
    .toFile(path.join(PHOTOS, `${w.name}.webp`));

  const ratio = (region.width / region.height).toFixed(3);
  console.log(`${w.name}: ${region.width}x${region.height} -> ${w.deliver}px  ${ratio}:1`);
}
