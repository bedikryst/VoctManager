/**
 * @file shapes.test.ts
 * @description Pins the promises the shape tool rests on: every straight edge
 * is a two-point path (the only kind both renderers draw straight), snapping is
 * judged in pixels on a page that is not square, and the direction of a drag
 * decides which side of the stave a slur or a bracket sits on.
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

  it("opens a crescendo at its end and a diminuendo at its start, from one closed point", () => {
    const [up, down] = buildShapePaths("cresc", [0.1, 0.5], [0.5, 0.5], W, H);
    expect(up).toHaveLength(2);
    expect(down).toHaveLength(2);
    expect(up[0]).toEqual(down[0]);
    expect(up[0][0]).toBeCloseTo(0.1, 6);
    expect(up[0][1]).toBeCloseTo(0.5, 6);
    expect(up[1][0]).toBeCloseTo(0.5, 6);
    expect(Math.abs(up[1][1] - down[1][1]) * H).toBeGreaterThan(5);

    const [left, right] = buildShapePaths("dim", [0.1, 0.5], [0.5, 0.5], W, H);
    expect(left[0]).toEqual(right[0]);
    expect(left[0][0]).toBeCloseTo(0.5, 6);
    expect(left[1][0]).toBeCloseTo(0.1, 6);
  });

  it("keeps a short hairpin narrower than its length", () => {
    const [up, down] = buildShapePaths("cresc", [0.1, 0.5], [0.1 + 20 / W, 0.5], W, H);
    expect(Math.abs(up[1][1] - down[1][1]) * H).toBeLessThan(20 * 0.35 + 1e-6);
  });

  it("bows a slur up when drawn left to right, and down when drawn right to left", () => {
    const [over] = buildShapePaths("slur", [0.1, 0.5], [0.5, 0.5], W, H);
    const [under] = buildShapePaths("slur", [0.5, 0.5], [0.1, 0.5], W, H);
    const middle = Math.floor(over.length / 2);
    expect(over[0][0]).toBeCloseTo(0.1, 6);
    expect(over[0][1]).toBeCloseTo(0.5, 6);
    expect(over[over.length - 1][0]).toBeCloseTo(0.5, 6);
    expect(over[middle][1]).toBeLessThan(0.5);
    expect(under[middle][1]).toBeGreaterThan(0.5);
  });

  it("hooks a bracket toward the music below when drawn left to right", () => {
    const paths = buildShapePaths("bracket", [0.1, 0.3], [0.5, 0.3], W, H);
    expect(paths).toHaveLength(3);
    for (const path of paths) expect(path).toHaveLength(2);
    const [hook, span, tail] = paths;
    expect(hook[1]).toEqual(span[0]);
    expect(span[1]).toEqual(tail[0]);
    expect(hook[0][1]).toBeGreaterThan(0.3);
    expect(tail[1][1]).toBeGreaterThan(0.3);
  });

  it("rules a nearly level hairpin level, like a line", () => {
    const [up, down] = buildShapePaths("cresc", [0.1, 0.5], [0.1 + 200 / W, 0.5 + 4 / H], W, H);
    expect((up[1][1] + down[1][1]) / 2).toBeCloseTo(0.5, 6);
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
