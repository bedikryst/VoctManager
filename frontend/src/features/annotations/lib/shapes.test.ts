/**
 * @file shapes.test.ts
 * @description Pins the two promises the shape tool rests on: every straight
 * edge is a two-point path (the only kind both renderers draw straight), and
 * snapping is judged in pixels on a page that is not square.
 * @module features/annotations/lib
 */

import { describe, expect, it } from "vitest";

import { buildShapePaths } from "./shapes";

// An A4-ish page: taller than wide, so a normalized square is not a drawn one.
const W = 600;
const H = 850;

describe("buildShapePaths", () => {
  it("draws nothing for a tap", () => {
    expect(buildShapePaths("rect", [0.5, 0.5], [0.501, 0.5], W, H)).toEqual([]);
  });

  it("cuts a rectangle into four straight edges that meet at the corners", () => {
    const paths = buildShapePaths("rect", [0.1, 0.1], [0.4, 0.3], W, H);
    expect(paths).toHaveLength(4);
    for (const path of paths) expect(path).toHaveLength(2);
    paths.forEach((path, i) => {
      const next = paths[(i + 1) % paths.length];
      expect(path[1]).toEqual(next[0]);
    });
  });

  it("closes an oval on its own first point", () => {
    const [ring] = buildShapePaths("ellipse", [0.2, 0.2], [0.6, 0.3], W, H);
    expect(ring.length).toBeGreaterThan(24);
    expect(ring[ring.length - 1][0]).toBeCloseTo(ring[0][0], 6);
    expect(ring[ring.length - 1][1]).toBeCloseTo(ring[0][1], 6);
  });

  it("rules a nearly level line level, in pixels", () => {
    // 4 px of rise over 200 px of run.
    const [line] = buildShapePaths("line", [0.1, 0.5], [0.1 + 200 / W, 0.5 + 4 / H], W, H);
    expect(line[1][1]).toBeCloseTo(0.5, 6);
  });

  it("leaves a diagonal free", () => {
    const [line] = buildShapePaths("line", [0.1, 0.1], [0.2, 0.2], W, H);
    expect(line[1][0]).toBeCloseTo(0.2, 6);
    expect(line[1][1]).toBeCloseTo(0.2, 6);
  });

  it("squares a nearly square box in pixels, not in page fractions", () => {
    // 120 px wide, 112 px tall: square on screen, far from square in fractions.
    const paths = buildShapePaths("rect", [0.1, 0.1], [0.1 + 120 / W, 0.1 + 112 / H], W, H);
    const [topLeft, topRight] = paths[0];
    const [, bottomRight] = paths[1];
    const widthPx = (topRight[0] - topLeft[0]) * W;
    const heightPx = (bottomRight[1] - topRight[1]) * H;
    expect(widthPx).toBeCloseTo(120, 3);
    expect(heightPx).toBeCloseTo(120, 3);
  });

  it("gives an arrow a shaft and two wings that all end at the tip", () => {
    const paths = buildShapePaths("arrow", [0.1, 0.1], [0.5, 0.4], W, H);
    expect(paths).toHaveLength(3);
    const tip = paths[0][1];
    for (const path of paths) {
      expect(path).toHaveLength(2);
      expect(path[1]).toEqual(tip);
    }
  });

  it("keeps every point on the page", () => {
    const paths = buildShapePaths("ellipse", [0.95, 0.95], [1, 1], W, H);
    for (const [x, y] of paths.flat()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });
});
