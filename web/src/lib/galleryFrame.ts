/**
 * @file galleryFrame.ts
 * @description Full-size renditions for the photograph lightbox — the companion to
 *  `galleryLayout`, which sizes the same shots where they hang in the page. The grid's widest
 *  candidate is 1200px, which a full-screen frame outgrows on any laptop, so the frame asks for
 *  its own pair and hands them to `[data-image-open]` as a plain `src` + `srcset`.
 *
 *  Shared by the concert detail page and the /obrazy archive for the same reason the packing is:
 *  two callers asking for different widths would emit two sets of files for one photograph. The
 *  1200 candidate is deliberately the SAME transform the grid already requests, so Astro's asset
 *  pipeline dedupes it and each photograph costs one extra file rather than two.
 * @architecture Astro islands 2026
 * @module lib/galleryFrame
 */

import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";

/** The lightbox's largest candidate. Past this the file grows faster than the frame can use it —
 *  the room caps the photograph at 80svh, so a 2× display tops out around here. */
const FRAME_W = 1920;
/** The grid's own widest rendition, re-requested so the two share one emitted file. */
const GRID_W = 1200;

export interface FramedShot {
  /** Largest candidate, and the `src` fallback for a browser that ignores `srcset`. */
  readonly src: string;
  readonly srcset: string;
  readonly sizes: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Build the frame's renditions for one photograph. Never upscales: a small original returns its
 * own width, and a single-candidate `srcset` when both steps land on the same file.
 */
export async function framedShot(img: ImageMetadata): Promise<FramedShot> {
  const wide = Math.min(img.width, FRAME_W);
  const mid = Math.min(img.width, GRID_W);
  const [midImg, wideImg] = await Promise.all([
    getImage({ src: img, width: mid, format: "webp" }),
    getImage({ src: img, width: wide, format: "webp" }),
  ]);
  return {
    src: wideImg.src,
    srcset:
      mid === wide ? `${wideImg.src} ${wide}w` : `${midImg.src} ${mid}w, ${wideImg.src} ${wide}w`,
    // The frame is the viewport minus its padding, and the padding is a clamp — 100vw overstates
    // it by a few percent, which costs a rendition step at worst and never the reverse.
    sizes: "100vw",
    width: wide,
    height: Math.round((wide * img.height) / img.width),
  };
}
