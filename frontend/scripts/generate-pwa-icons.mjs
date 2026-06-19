/**
 * @file generate-pwa-icons.mjs
 * @description One-off (re-runnable) generator for the installable-PWA icon set.
 * Trims the transparent gold line-art wordmark and centres it on the Ethereal
 * "ink" backdrop at fill ratios tuned for contrast and for Android's circular
 * maskable crop (the gold ring must sit inside the safe zone). Outputs are
 * committed to public/icons; re-run only when the brand mark changes:
 *   node scripts/generate-pwa-icons.mjs
 *
 * BG below must stay in sync with public/manifest.webmanifest `background_color`
 * so the icon, splash and status bar read as one surface.
 * @module scripts/generate-pwa-icons
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(root, "public/logo_biale.png"); // transparent gold line-art
const OUT_DIR = resolve(root, "public/icons");

// Ethereal ink — matches manifest background_color (#060607).
const BG = { r: 0x06, g: 0x06, b: 0x07, alpha: 1 };

/** Centre the trimmed mark at `fill` of the square on an opaque ink canvas. */
async function render({ size, fill, file, flatten }) {
  const inner = Math.round(size * fill);
  const mark = await sharp(SOURCE)
    .trim()
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  let canvas = sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  }).composite([{ input: mark, gravity: "centre" }]);

  if (flatten) canvas = canvas.flatten({ background: BG });

  await canvas.png().toFile(resolve(OUT_DIR, file));
  console.log(`  ✓ ${file} (${size}×${size}, mark ${Math.round(fill * 100)}%)`);
}

await mkdir(OUT_DIR, { recursive: true });
console.log("Source", SOURCE);

// "any" icons: mark near-full with a hair of breathing room.
await render({ size: 192, fill: 0.8, file: "icon-192.png" });
await render({ size: 512, fill: 0.8, file: "icon-512.png" });
// Maskable: shrink so the gold ring stays inside Android's circular safe zone.
await render({ size: 512, fill: 0.62, file: "icon-maskable-512.png" });
// Apple touch icon: opaque (iOS rounds the corners itself).
await render({ size: 180, fill: 0.78, file: "apple-touch-icon.png", flatten: true });

console.log("Done → public/icons/");
