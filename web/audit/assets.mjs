// @ts-check
/**
 * @file assets.mjs
 * @description The one measurement in this audit that reads pixels rather than text: how many
 *  sRGB levels the light register's veil actually moves on each photograph.
 *
 *  The veil is `rgba(8, 8, 7, 0.58)`, so a source level L composites to `0.42·L + 0.58·8` and the
 *  delta the eye is offered is exactly `0.58·(L − 8)` — linear in how bright the photograph
 *  already is, which is why the guardrails say the alpha cannot be trusted and the delta has to be
 *  measured per asset. Reported at the bright end of the frame, because that is where a veil
 *  lifting is seen — see BRIGHT_PERCENTILE for how that end is chosen and what it agrees with.
 *
 *  WHAT IT CANNOT SEE, and the reason this is advisory and never an error: a host's own scrim.
 *  `.final-support` crushes its photograph under a 0.78–0.88 gradient before the veil arrives, and
 *  composing a CSS gradient (with its blend mode, its z-order and its stops) is not something a
 *  static reader can do honestly. This measures the ASSET. A host that spends the range itself is
 *  still a manual judgement — and the register is granted by ROLE, so a dark frame is a note about
 *  a photograph, never an instruction to move a component into another register.
 * @architecture Astro islands 2026
 * @module audit/assets
 */

import { createRequire } from "node:module";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** The veil, as `registers.css` declares it. */
const VEIL_ALPHA = 0.58;
const VEIL_INK = 8;

/**
 * The bright end of the frame, as a percentile of luma. The guardrails measured by hand "on one
 * mid-bright photo pixel at each section's lightest point", which is a statistic no whole-frame
 * average reproduces: p50 answers a different question and p100 is a specular highlight. p97 is
 * what agrees with the one host that can be mapped to a file — `.portrait` is `florent.jpg`, hand
 * measured at 82 levels, and p97 reports 75. Read this number as ~10% conservative, not as theirs.
 */
const BRIGHT_PERCENTILE = 0.97;

/** Below this many sRGB levels the lift is not findable on screen. The bar sits between the two
 *  hand measurements that bracket it: `.ensemble` at 27 does not clear (raising the alpha to
 *  ~0.78 is what it would take, which breaks a louder rule), the night nave `.litany` stands on
 *  (chor-spot) at 46 does. */
const VISIBLE_DELTA = 35;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

/**
 * @typedef {object} AssetMeasurement
 * @property {string} file
 * @property {number} bright     Luma at BRIGHT_PERCENTILE, 0–255.
 * @property {number} delta      sRGB levels the veil moves there.
 */

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walkImages(dir) {
  /** @type {string[]} */
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    // Retired originals kept beside the live set are not on any page.
    if (entry.isDirectory() && entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walkImages(full)));
    else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) found.push(full);
  }
  return found;
}

/**
 * The image is resampled to a thumbnail first — the statistic is a distribution property, and
 * decoding a 4000px original in full to compute it would put twenty seconds into every build for
 * a number that does not change.
 * @param {import("sharp")} sharp
 * @param {string} file
 */
async function measureFile(sharp, file) {
  const { data, info } = await sharp(file)
    .resize(160, 160, { fit: "inside", fastShrinkOnLoad: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  /** @type {number[]} */
  const luma = [];
  for (let offset = 0; offset + channels - 1 < data.length; offset += channels) {
    luma.push(0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]);
  }
  if (luma.length === 0) return null;
  luma.sort((a, b) => a - b);
  const bright = luma[Math.min(luma.length - 1, Math.floor(luma.length * BRIGHT_PERCENTILE))];
  return { bright, delta: VEIL_ALPHA * Math.max(0, bright - VEIL_INK) };
}

/**
 * Measure every photograph under `assetDir`, memoised on size and mtime so a build that changed
 * no image pays nothing.
 * @param {string} assetDir
 * @param {string} root
 * @param {string} cacheDir
 * @returns {Promise<{ measurements: AssetMeasurement[], skipped: string | null }>}
 */
export async function measureAssets(assetDir, root, cacheDir) {
  // Resolved through `createRequire` rather than a bare dynamic import: Astro bundles
  // `astro.config.mjs` to a temp module before running it, and a rewritten `import("sharp")`
  // resolves against the bundle instead of this directory — which silently skipped the whole
  // measurement inside a real build while the standalone CLI found it.
  /** @type {import("sharp")} */
  let sharp;
  try {
    sharp = createRequire(import.meta.url)("sharp");
  } catch (error) {
    return {
      measurements: [],
      skipped: `sharp did not load (${(error instanceof Error ? error.message : String(error)).split("\n")[0]}) — the veil measurement was skipped.`,
    };
  }

  // The cache key carries the statistic, so recalibrating BRIGHT_PERCENTILE invalidates it rather
  // than silently serving numbers computed under the old one.
  const cachePath = path.join(cacheDir, `veil-delta-p${Math.round(BRIGHT_PERCENTILE * 100)}.json`);
  /** @type {Record<string, { key: string, bright: number, delta: number }>} */
  const cache = await readFile(cachePath, "utf8").then(JSON.parse).catch(() => ({}));

  const files = await walkImages(assetDir);
  /** @type {AssetMeasurement[]} */
  const measurements = [];
  let dirty = false;

  for (const file of files) {
    const relative = path.relative(root, file).replace(/\\/g, "/");
    const stats = await stat(file);
    const key = `${stats.size}:${Math.round(stats.mtimeMs)}`;

    const cached = cache[relative];
    if (cached?.key === key) {
      measurements.push({ file: relative, bright: cached.bright, delta: cached.delta });
      continue;
    }

    const measured = await measureFile(sharp, file).catch(() => null);
    if (!measured) continue;
    cache[relative] = { key, ...measured };
    dirty = true;
    measurements.push({ file: relative, ...measured });
  }

  if (dirty) {
    await mkdir(cacheDir, { recursive: true }).catch(() => {});
    await writeFile(cachePath, JSON.stringify(cache), "utf8").catch(() => {});
  }
  return { measurements, skipped: null };
}

/**
 * R10 — photographs whose own darkness spends the veil before it starts.
 * @param {AssetMeasurement[]} measurements
 * @returns {import("./checks.mjs").Finding[]}
 */
export function checkVeilDelta(measurements) {
  const dark = measurements
    .filter((measurement) => measurement.delta < VISIBLE_DELTA)
    .sort((a, b) => a.delta - b.delta);
  if (dark.length === 0) return [];

  return [{
    id: "R10",
    level: "info",
    title: `${dark.length} of ${measurements.length} photographs move fewer than ${VISIBLE_DELTA} sRGB levels under the veil`,
    where: "src/assets/photos",
    detail: [
      ...dark.slice(0, 12).map((measurement) =>
        `${measurement.delta.toFixed(0).padStart(3)} levels  ·  bright luma ${measurement.bright.toFixed(0).padStart(3)}  ·  ${measurement.file}`),
      ...(dark.length > 12 ? [`… and ${dark.length - 12} more`] : []),
      "Measured on the ASSET. A host with a scrim of its own spends more of the range than this and is a manual judgement.",
    ],
    hint: "guardrails §5 — the register is granted by ROLE; a dark frame is a note about a photograph, not a reason to move a component.",
  }];
}
