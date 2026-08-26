/**
 * @file noteCardPlacement.test.ts
 * @description Pins the one promise the composer makes: it never sits on the
 * spot it is annotating. The regression it guards is the original placement —
 * a fixed "below the anchor" plus a clamp against a guessed card height, which
 * near the foot of a page pulled the card back up over its own anchor.
 * @module features/annotations/lib/noteCardPlacement.test
 * @architecture Enterprise SaaS 2026
 */

import { describe, expect, it } from "vitest";

import { placeNoteCard } from "./noteCardPlacement";

const PAGE = { pageWidth: 600, pageHeight: 800 };
const CARD = { cardWidth: 240, cardHeight: 260 };

/** Does the card's box cover the anchor point? */
const covers = (
  placement: { left: number; top: number },
  anchor: { x: number; y: number },
  page = PAGE,
  card = CARD,
): boolean => {
  const anchorX = anchor.x * page.pageWidth;
  const anchorY = anchor.y * page.pageHeight;
  return (
    anchorX >= placement.left - card.cardWidth / 2 &&
    anchorX <= placement.left + card.cardWidth / 2 &&
    anchorY >= placement.top &&
    anchorY <= placement.top + card.cardHeight
  );
};

describe("placeNoteCard", () => {
  it("drops below the anchor when the page has room there", () => {
    const anchor = { x: 0.5, y: 0.2 };
    const placement = placeNoteCard({ anchor, ...PAGE, ...CARD, gapAbove: 20, gapBelow: 20 });

    expect(placement.side).toBe("below");
    expect(placement.top).toBe(0.2 * 800 + 20);
  });

  it("flips above the anchor rather than being clamped over it", () => {
    // Two thirds down a page: the card no longer fits underneath, and the old
    // clamp answered by sliding it up ONTO the bar being annotated.
    const anchor = { x: 0.5, y: 0.72 };
    const placement = placeNoteCard({ anchor, ...PAGE, ...CARD, gapAbove: 20, gapBelow: 20 });

    expect(placement.side).toBe("above");
    expect(covers(placement, anchor)).toBe(false);
  });

  it("keeps the anchor uncovered all the way down a page", () => {
    for (let step = 0; step <= 20; step += 1) {
      const anchor = { x: 0.5, y: step / 20 };
      const placement = placeNoteCard({ anchor, ...PAGE, ...CARD, gapAbove: 20, gapBelow: 20 });
      expect(covers(placement, anchor)).toBe(false);
    }
  });

  it("clears the mark drawn at the anchor, not just the point", () => {
    const anchor = { x: 0.5, y: 0.1 };
    const placement = placeNoteCard({ anchor, ...PAGE, ...CARD, gapAbove: 34, gapBelow: 34 });

    expect(placement.top - anchor.y * PAGE.pageHeight).toBe(34);
  });

  it("takes each side's own clearance — a pin hangs its text below itself", () => {
    const anchored = { ...PAGE, ...CARD, gapAbove: 24, gapBelow: 96 };

    const below = placeNoteCard({ anchor: { x: 0.5, y: 0.1 }, ...anchored });
    expect(below.top).toBe(0.1 * 800 + 96);

    const above = placeNoteCard({ anchor: { x: 0.5, y: 0.9 }, ...anchored });
    expect(above.side).toBe("above");
    expect(above.top).toBe(0.9 * 800 - 24 - 260);
  });

  it("stays inside the page box horizontally, and centres on a narrow page", () => {
    const atEdge = placeNoteCard({
      anchor: { x: 0.99, y: 0.1 },
      ...PAGE,
      ...CARD,
      gapAbove: 20,
      gapBelow: 20,
    });
    expect(atEdge.left).toBe(600 - 120);

    const narrow = placeNoteCard({
      anchor: { x: 0.9, y: 0.1 },
      pageWidth: 200,
      pageHeight: 800,
      ...CARD,
      gapAbove: 20,
      gapBelow: 20,
    });
    expect(narrow.left).toBe(100);
  });

  it("stays reachable on a page too short for either side to fit", () => {
    const page = { pageWidth: 600, pageHeight: 320 };
    const placement = placeNoteCard({
      anchor: { x: 0.5, y: 0.5 },
      ...page,
      ...CARD,
      gapAbove: 20,
      gapBelow: 20,
    });

    expect(placement.top).toBeGreaterThanOrEqual(8);
    expect(placement.top + CARD.cardHeight).toBeLessThanOrEqual(page.pageHeight - 8);
  });
});
