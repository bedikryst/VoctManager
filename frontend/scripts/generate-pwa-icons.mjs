/**
 * @file generate-pwa-icons.mjs
 * @description Re-runnable generator for the installable-PWA raster set, rendered from the vector
 * masters in public/brand/:
 *   - voctmanager-mark.svg (ringed gold mark) on a radial "candlelight" backdrop (warm ink core →
 *     near-black edge) → icon-192, icon-512, icon-maskable-512, apple-touch-icon;
 *   - voctmanager-mark-compact.svg (the ringless drawing for small sizes) as a white silhouette on
 *     transparency → badge.png, which Android tints and shows as the notification's status-bar glyph;
 *   - favicon.svg and favicon-48.svg (ringless drawings on a rounded dark tile) → icon-32, icon-48,
 *     the small "any" icons desktop OSes use for shortcuts, taskbar and window icons, and icon-32
 *     doubles as the PNG favicon. Without them those surfaces downsample the ringed 192, where the
 *     ring dissolves into a sub-pixel haze;
 *   - public/logo_gold.png (the web's house-glyph raster, the desktop sidebar's mark on dark) with
 *     its alpha kept and its colour set to the panel ink → public/logo_ink.png, the mark on light,
 *     as the press kit's on-light mark is ink.
 * Outputs are committed to public/icons/ and public/; re-run only when a source changes:
 *   node scripts/generate-pwa-icons.mjs
 *
 * The masters are drawn on a 512 canvas with their horizontal edges on one pixel grid each: 192
 * (icon), 24 (compact), 32 (favicon), 48 (favicon-48). Each small drawing is rendered only at the
 * size it was corrected for, never above it. The maskable icon shrinks the mark so the ring sits
 * well inside Android's circular crop, not against it.
 *
 * Rasters that change under an unchanged name are addressed with a `?v=N` query in
 * public/manifest.webmanifest, index.html (apple-touch-icon) and src/sw.ts (notification icon and
 * badge): the OS and browser fetch them outside the service worker, through an HTTP cache that
 * nginx lets hold png for 30 days. Bump N in all three whenever these outputs change.
 *
 * EDGE below must stay in sync with public/manifest.webmanifest `background_color` so the icon
 * edge, splash and status bar read as one surface. An installed app keeps its old icon until it
 * is removed and re-added (iOS never refreshes a home-screen icon).
 * @module scripts/generate-pwa-icons
 */
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_DIR = resolve(root, "public/brand");
const OUT_DIR = resolve(root, "public/icons");

// Radial backdrop: warm ink core → cool near-black edge (= manifest background).
const CORE = "#241d16";
const MID = "#0e0b09";
const EDGE = "#060607";
// = --color-ethereal-ink of the light theme in src/app/styles/panel.css.
const INK = "#161412";

/** The master's drawing without its root <svg> element, ready to nest in a composition. */
async function masterBody(file) {
  const source = await readFile(resolve(BRAND_DIR, file), "utf8");
  const open = source.indexOf(">", source.indexOf("<svg")) + 1;
  return source.slice(open, source.lastIndexOf("</svg>")).replace(/<title>.*?<\/title>/su, "");
}

/** Rasterises a 512-unit composition directly at `size`, so nothing is resampled afterwards. */
function rasterise(body, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${body}</svg>`;
  return sharp(Buffer.from(svg)).png();
}

const mark = await masterBody("voctmanager-mark.svg");
const compact = await masterBody("voctmanager-mark-compact.svg");

/** Opaque icon: the mark at `scale` of its master placement, centred on the backdrop. */
async function renderIcon({ size, scale, file }) {
  const offset = 256 - 256 * scale;
  const body = `<defs><radialGradient id="backdrop" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="${CORE}"/>
      <stop offset="55%" stop-color="${MID}"/>
      <stop offset="100%" stop-color="${EDGE}"/>
    </radialGradient></defs>
    <rect width="512" height="512" fill="url(#backdrop)"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})">${mark}</g>`;
  await rasterise(body, size).removeAlpha().toFile(resolve(OUT_DIR, file));
  console.log(`  ✓ ${file} (${size}×${size}, mark ${Math.round(scale * 100)}%)`);
}

/**
 * Status-bar badge: a flat white silhouette on transparency. Android discards the colour and
 * tints the alpha, so only the shape matters. 72 px is the 24-dp badge at 3×, where the compact
 * master's pixel grid lands exactly.
 */
async function renderBadge({ size = 72, file = "badge.png" } = {}) {
  const body = compact.replaceAll(/fill="[^"]+"/gu, 'fill="#ffffff"');
  await rasterise(body, size).toFile(resolve(OUT_DIR, file));
  console.log(`  ✓ ${file} (${size}×${size}, white silhouette)`);
}

/** Small tile icon: the master already carries its rounded tile; the corners stay transparent. */
async function renderTile({ size, master }) {
  const file = `icon-${size}.png`;
  await rasterise(await masterBody(master), size).toFile(resolve(OUT_DIR, file));
  console.log(`  ✓ ${file} (${size}×${size}, ${master})`);
}

/**
 * Light-theme sidebar mark. It recolours the raster instead of rendering the house SVG: at 48 CSS px
 * the browser's vector rendering thins the hairline arm and axis, where the downsampled raster
 * holds them.
 */
async function renderInkLogo() {
  const source = resolve(root, "public/logo_gold.png");
  const { width, height } = await sharp(source).metadata();
  const alpha = await sharp(source).ensureAlpha().extractChannel("alpha").png().toBuffer();
  await sharp({ create: { width, height, channels: 3, background: INK } })
    .joinChannel(alpha)
    .png()
    .toFile(resolve(root, "public/logo_ink.png"));
  console.log(`  ✓ logo_ink.png (${width}×${height}, logo_gold.png in ink)`);
}

await mkdir(OUT_DIR, { recursive: true });
console.log("Masters", BRAND_DIR);

// "any" icons: the master as drawn; the ring fills about three quarters of the square.
await renderIcon({ size: 192, scale: 1, file: "icon-192.png" });
await renderIcon({ size: 512, scale: 1, file: "icon-512.png" });
// Maskable: shrink so the ring stays clear of Android's circular crop.
await renderIcon({ size: 512, scale: 0.82, file: "icon-maskable-512.png" });
// Apple touch icon: opaque already; iOS rounds the corners itself.
await renderIcon({ size: 180, scale: 1, file: "apple-touch-icon.png" });
// Small "any" icons, each from the drawing corrected for its size.
await renderTile({ size: 32, master: "favicon.svg" });
await renderTile({ size: 48, master: "favicon-48.svg" });

// Monochrome status-bar badge (referenced by sw.ts). Lives under icons/ so the .gitignore
// negation tracks & ships it.
await renderBadge();

await renderInkLogo();

console.log("Done → public/icons/, public/logo_ink.png");
