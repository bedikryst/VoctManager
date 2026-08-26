/**
 * @file noteCardPlacement.ts
 * @description Where the note composer sits over a rendered score page. The
 * card is a lens on ONE spot of the music, so the rule it answers to is: the
 * anchor — and the mark being drawn on it — stays visible, whatever else has to
 * give. Coordinates are page-box pixels (the same box the marks normalize
 * against), with `left` naming the card's CENTRE, since the card carries
 * `-translate-x-1/2`.
 *
 * Geometry beats preference here: a fixed side plus a clamp against a guessed
 * card height is what put the composer ON the bar it was annotating — near the
 * foot of a page the clamp pulled the card back up over its own anchor.
 * @module features/annotations/lib
 * @architecture Enterprise SaaS 2026
 */

export interface NoteCardPlacementInput {
  /** Tap point, normalized 0..1 against the page box. */
  anchor: { x: number; y: number };
  pageWidth: number;
  pageHeight: number;
  /** Measured card box — never an estimate, or the clamp lies again. */
  cardWidth: number;
  cardHeight: number;
  /**
   * How far the editable mark's own ink reaches above and below the anchor,
   * plus air. The two differ because the mark is not always centred on its
   * anchor: a pin sits ON it and hangs its text underneath, so the card may
   * come much closer from above than from below.
   */
  gapAbove: number;
  gapBelow: number;
}

export interface NoteCardPlacement {
  left: number;
  top: number;
  side: "above" | "below";
}

/** Page-box breathing room the card keeps at the top and bottom edges. */
const EDGE_MARGIN = 8;

export const placeNoteCard = ({
  anchor,
  pageWidth,
  pageHeight,
  cardWidth,
  cardHeight,
  gapAbove,
  gapBelow,
}: NoteCardPlacementInput): NoteCardPlacement => {
  const anchorX = anchor.x * pageWidth;
  const anchorY = anchor.y * pageHeight;

  // A card wider than the page cannot be kept inside it — the min/max bounds
  // cross and shove it off-screen — so it just sits centred there.
  const half = cardWidth / 2;
  const left =
    pageWidth <= cardWidth
      ? pageWidth / 2
      : Math.min(Math.max(anchorX, half), pageWidth - half);

  const belowTop = anchorY + gapBelow;
  const aboveTop = anchorY - gapAbove - cardHeight;
  const fitsBelow = belowTop + cardHeight <= pageHeight - EDGE_MARGIN;
  const fitsAbove = aboveTop >= EDGE_MARGIN;

  if (fitsBelow) return { left, top: belowTop, side: "below" };
  if (fitsAbove) return { left, top: aboveTop, side: "above" };

  // Neither side holds the whole card: a page rendered small enough that the
  // composer is a sizeable share of it. Take the roomier side and stay inside
  // the page box — a card hanging off the paper is a card whose OK button the
  // writer cannot reach, which is worse than a bar half-covered for the few
  // seconds a note takes to type.
  const top = anchorY * 2 >= pageHeight ? aboveTop : belowTop;
  const lowest = Math.max(EDGE_MARGIN, pageHeight - EDGE_MARGIN - cardHeight);
  return {
    left,
    top: Math.min(Math.max(top, EDGE_MARGIN), lowest),
    side: anchorY * 2 >= pageHeight ? "above" : "below",
  };
};
