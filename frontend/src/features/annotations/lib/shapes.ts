/**
 * @file shapes.ts
 * @description Geometry for the shape tool — oval, rectangle, line and arrow,
 * each drawn by one drag from corner to corner (or end to end).
 *
 * A shape is stored as ordinary freehand ink (`FH`), not as a kind of its own:
 * the server validator, the print renderer, the eraser, the selection halo and
 * undo already understand strokes, so a shape needs nothing from any of them.
 * What makes the result read as ruled rather than hand-drawn is how it is cut
 * into paths. Both renderers (the editor's `buildSmoothPath` and the print
 * mirror's `_smooth_path`) draw a two-point path as a straight segment and pass
 * a Catmull-Rom curve through anything longer, so:
 * - every straight edge is its OWN two-point path — a rectangle is four, an
 *   arrow three — and the round line caps meet at the corners;
 * - an oval is one closed path dense enough that the curve through it is the
 *   ellipse itself.
 *
 * Snapping happens in screen pixels, because the page is not square and a
 * normalized 45° is not a drawn 45°.
 * @module features/annotations/lib
 */

import type { NormPoint } from "../types/annotations.dto";

export type ShapeKind = "ellipse" | "rect" | "line" | "arrow";

export const SHAPE_KINDS: ReadonlyArray<{
  kind: ShapeKind;
  labelKey: string;
  fallback: string;
}> = [
  { kind: "ellipse", labelKey: "annotations.shapes.ellipse", fallback: "Owal lub koło" },
  { kind: "rect", labelKey: "annotations.shapes.rect", fallback: "Prostokąt lub kwadrat" },
  { kind: "line", labelKey: "annotations.shapes.line", fallback: "Linia" },
  { kind: "arrow", labelKey: "annotations.shapes.arrow", fallback: "Strzałka" },
];

export const DEFAULT_SHAPE: ShapeKind = "ellipse";

export const isShapeKind = (value: string | null): value is ShapeKind =>
  value === "ellipse" || value === "rect" || value === "line" || value === "arrow";

/** A drag shorter than this (px) is a tap, and a tap draws nothing. */
export const SHAPE_MIN_DRAG_PX = 5;
/** A line within this many degrees of level or plumb is ruled level or plumb. */
const LINE_SNAP_DEG = 8;
/** A box whose sides differ by less than this share of the longer one is square. */
const SQUARE_SNAP_RATIO = 0.12;
/** Points around an oval — enough that no facet shows at any zoom. */
const ELLIPSE_SEGMENTS = 48;
/** Arrowhead: wing length as a share of page width, capped by the shaft. */
const ARROW_HEAD_FRACTION = 0.022;
const ARROW_HEAD_MAX_SHARE = 0.4;
const ARROW_HEAD_ANGLE = (26 * Math.PI) / 180;

type Px = readonly [number, number];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * The end point after snapping, in px. Lines rule themselves level or plumb
 * near those angles and stay free between them — a diagonal is exactly what
 * crossing a note out needs. Boxes become squares, and ovals circles, when the
 * drag is nearly square.
 */
const snapEnd = (kind: ShapeKind, from: Px, to: Px): Px => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (kind === "line" || kind === "arrow") {
    const angle = (Math.abs(Math.atan2(dy, dx)) * 180) / Math.PI;
    if (angle < LINE_SNAP_DEG || angle > 180 - LINE_SNAP_DEG) return [to[0], from[1]];
    if (Math.abs(angle - 90) < LINE_SNAP_DEG) return [from[0], to[1]];
    return to;
  }
  const w = Math.abs(dx);
  const h = Math.abs(dy);
  const longer = Math.max(w, h);
  if (longer === 0 || Math.abs(w - h) / longer >= SQUARE_SNAP_RATIO) return to;
  return [from[0] + Math.sign(dx || 1) * longer, from[1] + Math.sign(dy || 1) * longer];
};

/**
 * Stroke paths (normalized, ready for a `FreehandPayload`) for one shape drawn
 * from `from` to `to` on a page `width` × `height` px. Returns an empty list
 * for a drag too short to mean anything.
 */
export const buildShapePaths = (
  kind: ShapeKind,
  from: NormPoint,
  to: NormPoint,
  width: number,
  height: number,
): NormPoint[][] => {
  if (width <= 0 || height <= 0) return [];
  const a: Px = [from[0] * width, from[1] * height];
  const b = snapEnd(kind, a, [to[0] * width, to[1] * height]);
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < SHAPE_MIN_DRAG_PX) return [];

  const norm = ([x, y]: Px): NormPoint => [clamp01(x / width), clamp01(y / height)];
  const segment = (p: Px, q: Px): NormPoint[] => [norm(p), norm(q)];

  switch (kind) {
    case "line":
      return [segment(a, b)];
    case "arrow": {
      const shaft = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const head = Math.min(shaft * ARROW_HEAD_MAX_SHARE, width * ARROW_HEAD_FRACTION);
      const back = Math.atan2(a[1] - b[1], a[0] - b[0]);
      const wing = (turn: number): Px => [
        b[0] + head * Math.cos(back + turn),
        b[1] + head * Math.sin(back + turn),
      ];
      return [segment(a, b), segment(wing(ARROW_HEAD_ANGLE), b), segment(wing(-ARROW_HEAD_ANGLE), b)];
    }
    case "rect": {
      const topRight: Px = [b[0], a[1]];
      const bottomLeft: Px = [a[0], b[1]];
      return [
        segment(a, topRight),
        segment(topRight, b),
        segment(b, bottomLeft),
        segment(bottomLeft, a),
      ];
    }
    case "ellipse": {
      const cx = (a[0] + b[0]) / 2;
      const cy = (a[1] + b[1]) / 2;
      const rx = Math.abs(b[0] - a[0]) / 2;
      const ry = Math.abs(b[1] - a[1]) / 2;
      const ring: NormPoint[] = [];
      for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
        const theta = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
        ring.push(norm([cx + rx * Math.cos(theta), cy + ry * Math.sin(theta)]));
      }
      return [ring];
    }
  }
};
