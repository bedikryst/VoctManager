/**
 * @file galleryLayout.ts
 * @description Geometry for a documentary photo gallery hung by row HEIGHT rather than cut into
 *  columns. Every shot brings its true aspect (ImageMetadata reads the real pixels), so a row of
 *  portraits fits four where the same row takes only three landscapes, and a short last row
 *  centers instead of leaving a hole at the right.
 *
 *  THE CONTRACT — `flex: 0 1 calc(var(--share) * 100%)` with `max-width: calc(var(--share) *
 *  100%)`, from `--share` — so every shot holds the same fraction of the measure it was sized
 *  for and a line settles at one height whatever the measure turns out to be.
 *
 *  A SHARE RATHER THAN A PIXEL WIDTH, because the two are only the same at 1180. A px basis
 *  freezes the geometry at the design measure: below it a full row shrinks to fit while a short
 *  row, already fitting, stands at its full size — so the tail of a run comes out taller than the
 *  rows above it on every laptop narrower than the measure. The share scales with whatever
 *  container it lands in, and the gap it was sized against scales with it (`3vw` against a
 *  measure that is itself ~90vw), so the row keeps its 1% of slack at any width.
 *
 *  NOTHING GROWS. A short row is short — it hangs centred at the height of the rows above it,
 *  which is what a justified page does. The earlier contract let a tail inflate 40% to fill its
 *  line, and on a set with no variety left to answer (the archive is 40 landscapes in 48 frames)
 *  that reads as breakage rather than as rhythm: a lone frame 38% taller than the two rows over
 *  it is the shape a reader takes for a mistake.
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

/** The layout answer for one shot. */
export interface ShotBox {
  /** Width in px at the design measure. Not what the page lays out on — it is what `sizes` asks
   *  the browser for, which is a statement about the widest case and belongs in px. */
  readonly w: number;
  /** The same width as a fraction of the measure, which IS what the page lays out on. */
  readonly share: number;
}

/**
 * Size a set of shots into height-hung rows. Input order is preserved; each result is the input
 * object plus `w` / `share`, so callers keep their own fields (alt, caption, ImageMetadata).
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

  return shots.map((s) => {
    const w = Math.round(rowH * s.ar);
    return { ...s, w, share: Number((w / width).toFixed(5)) };
  });
}
