/**
 * @file covers.test.ts
 * @description The cover's box as a drag makes it and as every rule reads it:
 * held on the page, never too thin to see or tap, taken by a loop round its
 * middle, and moved whole.
 *
 * A cover that slips off the page edge or folds to a sliver is a printed sign
 * that shows through again, which is the very thing the conductor drew it to
 * hide.
 * @module features/annotations/lib/covers.test
 */

import { describe, expect, it } from "vitest";

import { coverFromDrag, isOnCover } from "./covers";
import { isInLoop, markBounds } from "./markBounds";
import { clampShift, shiftedContent } from "./selection";
import type { CoverPayload, NormPoint, ScoreAnnotation } from "../types/annotations.dto";

const W = 800;
const H = 1100;

const cover = (payload: CoverPayload): ScoreAnnotation =>
  ({
    id: "cover",
    edition: "edition-1",
    page_number: 2,
    annotation_type: "CV",
    payload,
    color: "#1F2933",
    layer_name: "shared",
    created_by: "user-1",
    created_at: "2026-11-10T10:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
  }) as ScoreAnnotation;

describe("coverFromDrag", () => {
  it("draws nothing for a tap", () => {
    expect(coverFromDrag([0.5, 0.5], [0.501, 0.501], W, H)).toBeNull();
  });

  it("spans the two corners whichever way the hand went", () => {
    expect(coverFromDrag([0.4, 0.3], [0.2, 0.25], W, H)).toEqual({
      x: 0.2,
      y: 0.25,
      w: 0.2,
      h: 0.05,
    });
  });

  it("grows a drag along a line to a sliver that can be seen", () => {
    const made = coverFromDrag([0.2, 0.5], [0.4, 0.5], W, H);
    expect(made).not.toBeNull();
    expect((made?.h ?? 0) * H).toBeGreaterThanOrEqual(3.99);
    // Grown round the line, so it still covers what the hand went along.
    expect(made?.y).toBeLessThan(0.5);
    expect((made?.y ?? 0) + (made?.h ?? 0)).toBeGreaterThan(0.5);
  });

  it("keeps a sliver at the page edge on the page", () => {
    const made = coverFromDrag([0.2, 1], [0.4, 1], W, H);
    expect((made?.y ?? 0) + (made?.h ?? 0)).toBeLessThanOrEqual(1);
  });
});

describe("a cover among the other marks", () => {
  const paper = cover({ x: 0.2, y: 0.3, w: 0.1, h: 0.04 });

  it("answers a point on its paper, not beside it", () => {
    const payload = { x: 0.2, y: 0.3, w: 0.1, h: 0.04 };
    expect(isOnCover(payload, [0.25, 0.32])).toBe(true);
    expect(isOnCover(payload, [0.31, 0.32])).toBe(false);
  });

  it("reports its own box", () => {
    const bounds = markBounds(paper);
    expect(bounds?.minX).toBeCloseTo(0.2);
    expect(bounds?.maxX).toBeCloseTo(0.3);
    expect(bounds?.maxY).toBeCloseTo(0.34);
  });

  it("is taken by a loop round its middle", () => {
    const round: NormPoint[] = [
      [0.22, 0.31],
      [0.28, 0.31],
      [0.28, 0.33],
      [0.22, 0.33],
    ];
    const beside: NormPoint[] = [
      [0.4, 0.3],
      [0.5, 0.3],
      [0.5, 0.4],
      [0.4, 0.4],
    ];
    expect(isInLoop(paper, round)).toBe(true);
    expect(isInLoop(paper, beside)).toBe(false);
  });

  it("moves whole and stops at the page edge", () => {
    const shift = clampShift([paper], { dx: 0.9, dy: 0 });
    const moved = shiftedContent(paper, shift);
    expect(moved.annotation_type).toBe("CV");
    if (moved.annotation_type !== "CV") return;
    expect(moved.payload.w).toBe(0.1);
    expect(moved.payload.x + moved.payload.w).toBeCloseTo(1);
  });
});
