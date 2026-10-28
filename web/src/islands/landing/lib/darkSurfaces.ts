/**
 * @file darkSurfaces.ts
 * @description The landing's dark grounds as one selector list, read by `closest()` on whatever a
 *  probe hits. The bar (StickyHeader) inverts its glass over them; the scroll rail (ScrollRail)
 *  sets each label plate on night over them, probing under the plate itself.
 *
 *  The footer is CONDITIONALLY one of them: it is printed on the ground of the canonical hour it is
 *  read in (`body[data-lumen]`, set by scripts/landing.ts), so at Completorium it is a night plate.
 *  Both probes run `closest()` live, so a plate that turns at 21:00 takes them with it.
 * @module islands/landing/lib/darkSurfaces
 */

export const DARK_SURFACES =
  ".litany, .ensemble, .director-dark, .final-support, .preloader, .vault, .regulamin, .gratitude, .failure, body[data-lumen='nox'] .site-footer";
