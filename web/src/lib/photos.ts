/**
 * @file photos.ts
 * @description Extension-agnostic lookup for build-optimized images under src/assets/photos.
 *  Drop an original as `<name>.jpg|.jpeg|.png|.webp|.avif` and reference it by bare `<name>` —
 *  swapping the source extension never touches page code. Returns Astro `ImageMetadata` for
 *  use with <Image>, <Picture>, <BleedImage>, or getImage(). Eager glob = metadata only
 *  (dimensions/format), resolved at build time; the actual bytes are still optimized per use.
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
