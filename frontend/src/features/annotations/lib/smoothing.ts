/**
 * @file smoothing.ts
 * @description Turns a sampled freehand polyline into a smooth SVG path via a
 * Catmull-Rom → cubic-Bézier conversion, so conductor ink reads like a hand on
 * paper rather than a jagged set of segments. Pure + allocation-light; called
 * for every rendered stroke and the live preview.
 * @module features/annotations/lib
 */

import type { NormPoint } from "../types/annotations.dto";

const fmt = (value: number): string => value.toFixed(2);

/**
 * Build a smoothed path `d` for a stroke. Points are normalized (0..1) and
 * scaled to the page box (width × height in CSS px). Falls back to straight
 * segments for 1–2 points, where smoothing is meaningless.
 */
export const buildSmoothPath = (
  points: NormPoint[],
  width: number,
  height: number,
): string => {
  if (points.length === 0) return "";
  const px = points.map(([x, y]) => [x * width, y * height] as const);

  if (px.length === 1) {
    // A lone tap — render a hairline dot so it is not invisible.
    const [x, y] = px[0];
    return `M ${fmt(x)} ${fmt(y)} l 0.1 0.1`;
  }
  if (px.length === 2) {
    return `M ${fmt(px[0][0])} ${fmt(px[0][1])} L ${fmt(px[1][0])} ${fmt(px[1][1])}`;
  }

  let d = `M ${fmt(px[0][0])} ${fmt(px[0][1])}`;
  for (let i = 0; i < px.length - 1; i++) {
    const p0 = px[i - 1] ?? px[i];
    const p1 = px[i];
    const p2 = px[i + 1];
    const p3 = px[i + 2] ?? p2;

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${fmt(cp1x)} ${fmt(cp1y)}, ${fmt(cp2x)} ${fmt(cp2y)}, ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
};
