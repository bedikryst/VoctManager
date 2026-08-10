// @ts-check
/**
 * @file downscale-photos.mjs
 * @description Rebuilds `src/assets/photos/` as build proxies of the camera originals kept in
 *  `src/assets/photos/.original-photos/`. Run it after dropping new originals into the archive.
 *
 *  WHY. Nothing in this site ever asks for a rendition wider than 2560 (`BleedImage`'s widest
 *  desktop rung), yet the archive holds 8256px frames up to 44 MB. Sharp re-reads the source
 *  once PER VARIANT, so every one of the ~6 renditions a photograph gets pays the full decode:
 *  measured 8.6s for six variants off a 44 MB original against 3.3s off a 2560 proxy. The same
 *  originals also inflate the Docker build context — `COPY web/ ./` carries them into a ~960 MB
 *  BuildKit record on every photo-changing build, which is what pushes the cache past the
 *  `GC_KEEP` budget in infra/docker-gc.sh and evicts the Astro image cache the next build needs.
 *
 *  THE CAPS, and why they are the numbers they are. Both are ceilings the page code states, so
 *  raising a ladder anywhere means raising the matching constant here or that rung silently
 *  disappears — `BleedImage`/`croppedShot` both FILTER candidates the source cannot supply.
 *    • WIDTH_CAP 2560     — `DESKTOP_WIDTHS` in components/BleedImage.astro.
 *    • MIN_SHORT_EDGE 960 — `croppedShot` cuts squares, so its ceiling is the SHORT edge
 *      (`Math.min(img.width, img.height * aspect)`), and `PANEL_WIDTHS` in ImaginesBand tops
 *      out at 960. A wide-and-shallow frame hits this before it hits the width cap.
 *  Everything else sits under both: framedShot 1920, the page-level `widths` ladders ≤ 1920.
 *
 *  Format follows what sharp DETECTS, never the extension — three files in this set are PNG
 *  under a `.jpg` name, and Astro likewise decides by content. Rewriting one as real JPEG would
 *  change the fallback rendition's format and, where the source has alpha, flatten it.
 *
 *  Astro auto-orients (`result.rotate()`, astro/dist/assets/services/sharp.js), so the proxy
 *  does too and stores the result upright; the EXIF tag is then dropped and Astro's own rotate
 *  becomes a no-op. Note this WOULD shift the ladders if an original ever carried a
 *  dimension-swapping orientation (5–8): `ImageMetadata` reports raw pixels, so the proxy's
 *  upright dimensions are the ones the ladder filters would then see. None in this set do.
 *
 *  Idempotent, and that is load-bearing rather than a nicety: re-encoding a proxy that was
 *  already correct yields different bytes, a different content hash, and therefore a cold
 *  re-encode of every one of that photograph's variants. A proxy already at the target
 *  geometry is left untouched.
 *
 *  Usage (from web/):  npm run photos:proxy  [-- --dry-run]
 * @architecture Astro islands 2026
 * @module build/downscale-photos
 */

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Full-size originals — the archive this script reads and never writes. */
const ARCHIVE = path.join(HERE, "src", "assets", "photos", ".original-photos");
/** What Astro globs (lib/photos.ts). Flat: subdirectories are not part of the glob. */
const PROXIES = path.join(HERE, "src", "assets", "photos");

const WIDTH_CAP = 2560;
const MIN_SHORT_EDGE = 960;

/** Sources Astro's glob accepts; anything else in the archive is not ours to touch. */
const SOURCE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const dryRun = process.argv.includes("--dry-run");

/** @param {number} bytes */
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Target WIDTH for one original — width alone, because sharp derives the height from it and a
 * separately rounded height would fight that by a pixel and make every run rewrite every file.
 * Scales to the width cap, then backs the scale off if that would starve the short edge below
 * what a square crop needs. Never enlarges.
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
function targetWidth(width, height) {
  const short = Math.min(width, height);
  // The floor only binds on a frame shallow enough that 2560 wide leaves under 960 of short
  // edge; the inner clamp keeps a source that is ALREADY shorter than the floor from being
  // enlarged to meet it. Taking the larger of the two scales satisfies both ceilings at once.
  const scale = Math.min(1, Math.max(WIDTH_CAP / width, Math.min(1, MIN_SHORT_EDGE / short)));
  return Math.round(width * scale);
}

/**
 * Encode to the format sharp detected in the source. Quality is deliberately high: this file is
 * an intermediate that Astro re-encodes to AVIF/WebP, and generation loss compounds.
 * @param {import("sharp").Sharp} pipeline
 * @param {string | undefined} format
 */
function encode(pipeline, format) {
  switch (format) {
    case "png":
      return pipeline.png({ compressionLevel: 9 });
    case "webp":
      return pipeline.webp({ quality: 92 });
    case "avif":
      return pipeline.avif({ quality: 80 });
    default:
      // 4:4:4 keeps chroma intact for the re-encode; subsampling here would be paid twice.
      return pipeline.jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true });
  }
}

async function main() {
  /** @type {string[]} */
  let entries;
  try {
    entries = await readdir(ARCHIVE);
  } catch {
    console.error(`[photos] No archive at ${ARCHIVE} — put the full-size originals there first.`);
    process.exitCode = 1;
    return;
  }

  const sources = entries.filter((f) => SOURCE_EXTENSIONS.has(path.extname(f).toLowerCase()));
  if (sources.length === 0) {
    console.error(`[photos] Archive holds no images.`);
    process.exitCode = 1;
    return;
  }

  await mkdir(PROXIES, { recursive: true });

  let written = 0;
  let skipped = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const name of sources.sort()) {
    const from = path.join(ARCHIVE, name);
    const to = path.join(PROXIES, name);

    const meta = await sharp(from).metadata();
    if (!meta.width || !meta.height) {
      console.warn(`  ! ${name} — unreadable dimensions, skipped`);
      continue;
    }
    if (meta.orientation && meta.orientation >= 5) {
      // See @file: rotating here changes the dimensions the ladder filters read.
      console.warn(`  ! ${name} — EXIF orientation ${meta.orientation} swaps width/height;`);
      console.warn(`    verify its ladders after this run.`);
    }

    const width = targetWidth(meta.width, meta.height);
    bytesBefore += (await stat(from)).size;

    const current = await sharp(to)
      .metadata()
      .catch(() => null);
    if (current && current.width === width) {
      skipped++;
      bytesAfter += (await stat(to)).size;
      continue;
    }

    const sizeNote =
      width === meta.width
        ? `${meta.width}x${meta.height} (already under the caps)`
        : `${meta.width}x${meta.height} -> ${width}x${Math.round((meta.height * width) / meta.width)}`;

    if (dryRun) {
      console.log(`  would write ${name}  ${sizeNote}`);
      written++;
      continue;
    }

    // Buffered rather than streamed to `to` so the report can state the bytes actually written.
    const out = await encode(
      sharp(from).rotate().resize({ width, withoutEnlargement: true }),
      meta.format,
    ).toBuffer();
    await writeFile(to, out);

    bytesAfter += out.length;
    written++;
    console.log(`  ${name}  ${sizeNote}  ${mb(out.length)}`);
  }

  console.log(
    `\n[photos] ${written} written, ${skipped} already current` +
      (dryRun ? " (dry run — nothing touched)" : ""),
  );
  if (!dryRun) console.log(`[photos] archive ${mb(bytesBefore)} -> proxies ${mb(bytesAfter)}`);
}

await main();
