// @ts-check
/**
 * @file prune-orphan-assets.mjs
 * @description Build integration that deletes the untouched camera originals Astro emits
 *  into `dist/_astro/` but no page ever links.
 *
 *  `src/lib/photos.ts` builds its name → ImageMetadata registry with an EAGER
 *  `import.meta.glob` over `src/assets/photos/*`. That puts every original in the module
 *  graph, so Vite emits each one as a build asset — it cannot know the file will only ever
 *  be handed to `<Picture>`, which generates its own optimized variants under different
 *  names. The sources therefore ship alongside the variants, unreferenced: ~92 MB of 2560px
 *  proxies baked into the nginx image and publicly fetchable, while the pages themselves
 *  correctly serve the WebP renditions. It was ~513 MB before those proxies replaced the
 *  camera originals (web/downscale-photos.mjs) — smaller now, still nothing anyone requests.
 *
 *  Deleting them here rather than in a separate step matters for the droplet: the whole
 *  build runs inside ONE Docker `RUN`, so files created and removed within it never reach
 *  the layer. The image, the BuildKit cache record, and the build context all stay clean.
 *
 *  Conservative by construction — an asset survives if its filename appears anywhere in any
 *  text output (HTML, JS, CSS, JSON, XML, SVG). Hashed names make a false match effectively
 *  impossible, and the failure that matters is deleting something still in use, so ambiguity
 *  always resolves to "keep". `src/pages/koncerty.astro` relies on this: its pre-blurred
 *  station backdrops are used through `.src` and are found in the inline `--bg` style.
 *
 *  Scope is limited to raster images directly under `_astro/`. Scripts, styles and video are
 *  referenced directly and would be kept anyway, so including them would add risk and reclaim
 *  nothing.
 * @architecture Astro islands 2026
 * @module build/prune-orphan-assets
 */

import { readdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Emitted originals worth reclaiming. Video and code are always referenced — see @file. */
const PRUNABLE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

/** Outputs that can carry an asset reference. Anything else cannot mention a filename. */
const REFERENCING_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".xml",
  ".txt",
  ".svg",
  ".webmanifest",
]);

/**
 * @param {string} dir
 * @returns {Promise<string[]>} absolute paths of every file below `dir`
 */
async function walk(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

/** @param {number} bytes */
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** @returns {import("astro").AstroIntegration} */
export function pruneOrphanAssets() {
  return {
    name: "voct:prune-orphan-assets",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const assetDir = path.join(outDir, "_astro");

        /** @type {string[]} */
        let assetFiles;
        try {
          assetFiles = await walk(assetDir);
        } catch {
          logger.info("no _astro/ directory — nothing to prune");
          return;
        }

        const files = await walk(outDir);
        const referencingFiles = files.filter((f) =>
          REFERENCING_EXTENSIONS.has(path.extname(f).toLowerCase()),
        );

        // An empty corpus would mark every asset as unreferenced and wipe the build. That can
        // only mean the walk went wrong, so refuse to delete instead of trusting the result.
        if (referencingFiles.length === 0) {
          logger.warn("found no HTML/JS/CSS output to scan — skipping prune (nothing deleted)");
          return;
        }

        const corpus = (
          await Promise.all(referencingFiles.map((f) => readFile(f, "utf8")))
        ).join("\n");

        const candidates = assetFiles.filter((f) =>
          PRUNABLE_EXTENSIONS.has(path.extname(f).toLowerCase()),
        );
        const orphans = candidates.filter((f) => !corpus.includes(path.basename(f)));

        let reclaimed = 0;
        for (const orphan of orphans) {
          reclaimed += (await stat(orphan)).size;
          await unlink(orphan);
        }

        if (orphans.length === 0) {
          logger.info(`kept all ${candidates.length} emitted images — every one is referenced`);
          return;
        }
        logger.info(
          `pruned ${orphans.length}/${candidates.length} emitted images never referenced by a page (${mb(reclaimed)} reclaimed)`,
        );
      },
    },
  };
}
