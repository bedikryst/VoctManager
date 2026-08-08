/**
 * @file photos.ts
 * @description Extension-agnostic lookup for build-optimized images under src/assets/photos.
 *  Drop an original as `<name>.jpg|.jpeg|.png|.webp|.avif` and reference it by bare `<name>` —
 *  swapping the source extension never touches page code. Returns Astro `ImageMetadata` for
 *  use with <Image>, <Picture>, <BleedImage>, or getImage(). Eager glob = metadata only
 *  (dimensions/format), resolved at build time; the actual bytes are still optimized per use.
 *
 *  CONSTRAINT: eager also means every original joins the module graph, so Vite emits each one
 *  as a build asset — it cannot know the file will only ever reach <Picture>, which writes its
 *  own renditions under different names. Left alone that ships the untouched camera JPEGs
 *  (~490 MB) next to the variants. `prune-orphan-assets.mjs` deletes the unreferenced ones at
 *  the end of the build; anything reached through `.src` stays, because the URL lands in the
 *  page output. Keep it that way — reading `.src` is what marks an original as really needed.
 *
 *  CONSTRAINT: <Image>/<Picture> given `widths` must ALSO be given `width`, set to the top of
 *  that ladder. `widths` builds the srcset only; the base transform behind the `<img src>`
 *  fallback takes its size from `width`, and with none passed Astro falls back to the source's
 *  intrinsic dimensions (astro/dist/assets/services/service.js, `getTargetDimensions`). An
 *  8256px camera frame then ships a full-resolution rendition nobody with `srcset` support ever
 *  fetches — invisible on screen, and 98 of the 133 MB this build once emitted. Naming the top
 *  candidate makes the fallback the SAME file as the widest srcset entry, so it costs nothing.
 *  Clamp it to `img.width` wherever the source is not curated — the archive holds squares and
 *  small scans. Sharp runs `withoutEnlargement`, so an over-large `width` never upscales, but
 *  the transform is still RECORDED at the number asked for: the ladder gets clamped to the
 *  source and the fallback does not, and the two then hash apart into twin files of identical
 *  pixels. Asking for `Math.min(img.width, top)` is asking for the file that already exists.
 * @architecture Astro islands 2026
 * @module lib/photos
 */
import type { ImageMetadata } from "astro";

const modules = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/photos/*.{jpg,jpeg,png,webp,avif}",
  { eager: true },
);

const byName = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(modules)) {
  const base = path.split("/").pop()!.replace(/\.[^.]+$/, "");
  byName.set(base, mod.default);
}

/** Resolve a photo by bare name (no extension). Throws at build if it is missing. */
export function photo(name: string): ImageMetadata {
  const img = byName.get(name);
  if (!img) {
    const available = [...byName.keys()].sort().join(", ");
    throw new Error(
      `[photos] No image "${name}" in src/assets/photos. Available: ${available || "(none)"}`,
    );
  }
  return img;
}

/**
 * Non-throwing variant of {@link photo}: returns the image if present, else `undefined`.
 * Use for optional art — e.g. board portraits that only render once the file is uploaded —
 * so a missing asset renders nothing instead of breaking the build.
 */
export function photoOptional(name: string): ImageMetadata | undefined {
  return byName.get(name);
}

/**
 * Resolve an art-directed full-bleed pair from a base name. `desktop` is `<base>-desktop`
 * (falling back to `<base>`); `mobile` is `<base>-mobile` (falling back to desktop). Tolerates
 * a missing mobile crop so a desktop-only upload still builds.
 */
export function bleedPair(base: string): { desktop: ImageMetadata; mobile: ImageMetadata } {
  const desktop = byName.get(`${base}-desktop`) ?? byName.get(base);
  if (!desktop) {
    const available = [...byName.keys()].sort().join(", ");
    throw new Error(
      `[photos] No image "${base}-desktop" (or "${base}") in src/assets/photos. Available: ${available || "(none)"}`,
    );
  }
  const mobile = byName.get(`${base}-mobile`) ?? desktop;
  return { desktop, mobile };
}
