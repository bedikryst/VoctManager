/**
 * @file generate-pwa-icons.mjs
 * @description One-off (re-runnable) generator for the installable-PWA icon set.
 * Trims the transparent gold line-art wordmark and centres it on a subtle radial
 * "candlelight" backdrop (warm ink core → near-black edge) — the depth that keeps
 * the icon from reading as a flat-black 2000s tile. Fill ratios are tuned for
 * contrast and for Android's circular maskable crop (the gold ring must sit
 * inside the safe zone). Outputs are committed to public/icons; re-run only when
 * the brand mark changes:
 *   node scripts/generate-pwa-icons.mjs
 *
 * EDGE below must stay in sync with public/manifest.webmanifest `background_color`
 * so the icon edge, splash and status bar read as one surface.
 * @module scripts/generate-pwa-icons
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(root, "public/logo_biale.png"); // transparent gold line-art
const OUT_DIR = resolve(root, "public/icons");

// Radial backdrop: warm ink core → cool near-black edge (= manifest background).
const CORE = "#241d16";
const MID = "#0e0b09";
const EDGE = "#060607";

/** Opaque radial-glow square of `size`, centred slightly high like the mark. */
async function glowBackground(size) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <radialGradient id="g" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stop-color="${CORE}"/>
          <stop offset="55%" stop-color="${MID}"/>
          <stop offset="100%" stop-color="${EDGE}"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#g)"/>
    </svg>`,
  );
  return sharp(svg).png().toBuffer();
}

/** Centre the trimmed mark at `fill` of the square on the radial backdrop. */
async function render({ size, fill, file }) {
  const inner = Math.round(size * fill);
  const [bg, mark] = await Promise.all([
    glowBackground(size),
    sharp(SOURCE)
      .trim()
      .resize(inner, inner, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer(),
  ]);

  await sharp(bg)
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(resolve(OUT_DIR, file));
  console.log(`  ✓ ${file} (${size}×${size}, mark ${Math.round(fill * 100)}%)`);
}

await mkdir(OUT_DIR, { recursive: true });
console.log("Source", SOURCE);

// "any" icons: the haloed mark near-fills with a hair of breathing room.
await render({ size: 192, fill: 0.74, file: "icon-192.png" });
await render({ size: 512, fill: 0.74, file: "icon-512.png" });
// Maskable: shrink so the gold ring stays inside Android's circular safe zone.
await render({ size: 512, fill: 0.6, file: "icon-maskable-512.png" });
// Apple touch icon: the backdrop is already opaque, so no flatten needed.
await render({ size: 180, fill: 0.72, file: "apple-touch-icon.png" });

console.log("Done → public/icons/");
