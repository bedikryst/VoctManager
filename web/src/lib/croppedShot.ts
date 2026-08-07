/**
 * @file croppedShot.ts
 * @description Build-time cover crop: renditions that are ALREADY the shape of the box they hang
 *  in, so `sizes` can state that box and be telling the truth.
 *
 *  The defect this exists for. `object-fit: cover` draws a photograph WIDER than its box whenever
 *  the box is proportionally taller than the photograph — a 3:2 frame filling a 4:5 panel is drawn
 *  1.875× the panel's width, and 47% of it is clipped away. The browser cannot see any of that: it
 *  picks a rendition from `sizes` alone, `sizes` states the panel, so the file it chooses is the
 *  one that then has to be scaled UP by exactly that factor. The Imagines band asked for 384px on
 *  a 2× desktop, was served the 840 candidate, and drew it across 1440 device pixels. Overstating
 *  `sizes` to compensate would restore the sharpness and pay for it in bytes nobody ever sees.
 *  Cropping at build fixes both ends: the file is the panel's shape, `sizes` is the panel's width,
 *  and the clipped 47% is never transferred at all.
 *
 *  Sharp performs the crop, and only when width AND height are both given — `fit`/`position` are
 *  dropped otherwise (astro/dist/assets/services/sharp.js). It also runs `withoutEnlargement`, so
 *  the ladder is clamped here to what the crop can actually supply: an unclamped candidate would
 *  come back smaller than the `w` descriptor written next to it and quietly lie to the browser,
 *  which is the same failure one level down.
 *
 *  NOT a replacement for `framedShot` (lib/galleryFrame). That one hands the lightbox the WHOLE
 *  photograph, uncropped, and the surfaces that crop a thumbnail ask for both at once.
 * @architecture Astro islands 2026
 * @module lib/croppedShot
 */

import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";

export interface CroppedShot {
  /** Widest rendition, and the `src` fallback for a browser that ignores `srcset`. */
  readonly src: string;
  readonly srcset: string;
  /** Intrinsic pixels of that widest rendition — the box's own ratio, not the photograph's. */
  readonly width: number;
  readonly height: number;
}

export interface CropOptions {
  /** The box's width ÷ height, e.g. `4 / 5`. Every rendition comes back at exactly this. */
  readonly aspect: number;
  /** Ladder of CSS-pixel widths — of the BOX, since that is now what `sizes` may state. */
  readonly widths: readonly number[];
  /**
   * Which part of the frame survives the crop: sharp's `position`, so a compass point
   * (`"top"`, `"left top"`), or a strategy (`"attention"` for the most salient region,
   * `"entropy"` for the busiest). Centre otherwise — the only honest default for a set nobody
   * has picked a subject point in, and the reason the strategies are opt-in is that on a dark
   * nave photograph `"attention"` reliably finds a spotlight rather than the singers.
   */
  readonly position?: string;
}

/**
 * Crop one photograph to a box's aspect at every width in the ladder. Never upscales: a source
 * whose crop cannot reach a candidate drops it, and one that cannot reach the smallest candidate
 * returns a single rendition at the largest crop it has.
 */
export async function croppedShot(
  img: ImageMetadata,
  { aspect, widths, position = "center" }: CropOptions,
): Promise<CroppedShot> {
  // The largest rectangle of this aspect that fits inside the photograph — the ceiling sharp
  // would silently enforce anyway, made explicit so the `w` descriptors stay true.
  const maxWidth = Math.min(img.width, Math.round(img.height * aspect));
  const ladder = [...widths].filter((w) => w <= maxWidth).sort((a, b) => a - b);
  if (ladder.length === 0) ladder.push(maxWidth);

  const built = await Promise.all(
    ladder.map((width) =>
      getImage({
        src: img,
        width,
        height: Math.round(width / aspect),
        fit: "cover",
        position,
        format: "webp",
      }),
    ),
  );

  const widest = ladder.length - 1;
  return {
    src: built[widest].src,
    srcset: built.map((b, i) => `${b.src} ${ladder[i]}w`).join(", "),
    width: ladder[widest],
    height: Math.round(ladder[widest] / aspect),
  };
}
