/**
 * @file galleryLayout.ts
 * @description Geometry for a documentary photo gallery hung by row HEIGHT rather than cut into
 *  columns. Every shot brings its true aspect (ImageMetadata reads the real pixels), so a row of
 *  portraits fits four where the same row takes only three landscapes, and a short last row
 *  centers instead of leaving a hole at the right. Returns the per-shot `w` / `wMax` that the
 *  flex line reads as `--w` / `--w-max`; the CSS contract is `flex: var(--ar) 1 var(--w)` with
 *  `max-width: var(--w-max)`, so grow and shrink both run ∝ aspect and every shot in a line
 *  settles at one height.
 *
 *  Shared by the concert detail page and the collective archive: one set of numbers, so a
 *  correction to the packing lands on both surfaces at once.
 * @architecture Astro islands 2026
 * @module lib/galleryLayout
 */

export interface GalleryLayoutOptions {
  /** Measure the row is hung in, in px. Defaults to the `.kd-wrap` width. */
  readonly width?: number;
  /** Gutter between shots — the gap's clamp CEILING, since the layout is computed for the
   *  widest case and the flex line reflows below it. */
  readonly gap?: number;
  /** Ceiling on row height, so a small set cannot balloon to fill the measure. */
  readonly maxHeight?: number;
}

const DEFAULTS = { width: 1180, gap: 40, maxHeight: 640 } as const;

/** A shot the caller has already resolved to a real aspect ratio (width / height). */
export interface Shot {
  readonly ar: number;
}

/** The layout answer for one shot: its ideal width, and how far a short row may inflate it. */
export interface ShotBox {
  readonly w: number;
  readonly wMax: number;
}

/**
 * Size a set of shots into height-hung rows. Input order is preserved; each result is the input
 * object plus `w` / `wMax`, so callers keep their own fields (alt, caption, ImageMetadata).
 */
export function layoutShots<T extends Shot>(
  shots: readonly T[],
  opts: GalleryLayoutOptions = {},
): (T & ShotBox)[] {
  if (shots.length === 0) return [];

  const width = opts.width ?? DEFAULTS.width;
  const gap = opts.gap ?? DEFAULTS.gap;
  const maxHeight = opts.maxHeight ?? DEFAULTS.maxHeight;

  // The set's dominant orientation decides the packing, not any single shot.
  const meanAr = shots.reduce((sum, s) => sum + s.ar, 0) / shots.length;

  // Landscapes read best three-up — except at 2 or 4, where a two-up row beats stranding a shot.
  const perRow =
    meanAr < 1
      ? Math.min(shots.length, 4)
      : shots.length === 2 || shots.length === 4
        ? 2
        : Math.min(shots.length, 3);

  // The height is chosen so the dominant orientation fills the measure exactly; maxHeight then
  // refuses to let a small set balloon — which is also what lands a lone landscape on a 960px
  // plate. ×0.99 leaves the flex line a few px of slack so sub-pixel rounding can't drop the
  // last shot of a full row onto a row of its own. flex-grow takes the slack straight back.
  const rowH = Math.min(
    Math.round(((width - (perRow - 1) * gap) / perRow / meanAr) * 0.99),
    maxHeight,
  );

  // `wMax` caps how far a short row may inflate its shots: 40% over the ideal, but never past
  // the height cap — otherwise a lone portrait would grow into a tower to fill the line it sits on.
  return shots.map((s) => {
    const w = Math.round(rowH * s.ar);
    return { ...s, w, wMax: Math.round(Math.min(w * 1.4, maxHeight * s.ar)) };
  });
}
