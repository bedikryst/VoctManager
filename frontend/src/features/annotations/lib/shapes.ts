/**
 * @file shapes.ts
 * @description Geometry for the shape tool — oval, rectangle, line and arrow,
 * and the shapes a score is marked with: crescendo and diminuendo hairpins, a
 * slur or phrase arc, and a bracket. Each is drawn by one drag from corner to
 * corner (or end to end).
 *
 * A shape is stored as ordinary freehand ink (`FH`), not as a kind of its own:
 * the server validator, the print renderer, the eraser, the selection halo and
 * undo already understand strokes, so a shape needs nothing from any of them.
 * The payload carries the shape's name (`shape`) only so that a card can call a
 * hairpin a hairpin; the server keeps the name and print ignores it.
 *
 * What makes the result read as ruled rather than hand-drawn is how it is cut
 * into paths. Both renderers (the editor's `buildSmoothPath` and the print
 * mirror's `_smooth_path`) draw a two-point path as a straight segment and pass
 * a Catmull-Rom curve through anything longer, so:
 * - every straight edge is its OWN two-point path — a rectangle is four, an
 *   arrow and a bracket three, a hairpin two — and the round line caps meet at
 *   the corners;
 * - an oval and an arc are one path dense enough that the curve through it is
 *   the figure itself.
 *
 * The drag's direction says which side of the music a slur or a bracket is
 * on. Drawn left to right, as a phrase is read, the arc bows up and the
 * bracket's hooks point down, which is how both sit above a stave; drawn right
 * to left, both turn over and sit below it.
 *
 * Snapping happens in screen pixels, because the page is not square and a
 * normalized 45° is not a drawn 45°.
 * @module features/annotations/lib
 */

import type { NormPoint } from "../types/annotations.dto";

export type ShapeKind =
  | "ellipse"
  | "rect"
  | "line"
  | "arrow"
  | "cresc"
  | "dim"
  | "slur"
  | "bracket";

interface ShapeDef {
  kind: ShapeKind;
  /** The tool's name for it, in the shape picker. */
  labelKey: string;
  fallback: string;
  /** What a placed one is called on its card. */
  markKey: string;
  markFallback: string;
}

/** Picker order: the figures first, then the shapes a score is marked with. */
export const SHAPE_KINDS: ReadonlyArray<ShapeDef> = [
  {
    kind: "ellipse",
    labelKey: "annotations.shapes.ellipse",
    fallback: "Owal lub koło",
    markKey: "annotations.mark.kind.ellipse",
    markFallback: "Owal",
  },
  {
    kind: "rect",
    labelKey: "annotations.shapes.rect",
    fallback: "Prostokąt lub kwadrat",
    markKey: "annotations.mark.kind.rect",
    markFallback: "Prostokąt",
  },
  {
    kind: "line",
    labelKey: "annotations.shapes.line",
    fallback: "Linia",
    markKey: "annotations.mark.kind.line",
    markFallback: "Linia",
  },
  {
    kind: "arrow",
    labelKey: "annotations.shapes.arrow",
    fallback: "Strzałka",
    markKey: "annotations.mark.kind.arrow",
    markFallback: "Strzałka",
  },
  {
    kind: "cresc",
    labelKey: "annotations.shapes.cresc",
    fallback: "Widełki crescendo",
    markKey: "annotations.mark.kind.cresc",
    markFallback: "Crescendo",
  },
  {
    kind: "dim",
    labelKey: "annotations.shapes.dim",
    fallback: "Widełki diminuendo",
    markKey: "annotations.mark.kind.dim",
    markFallback: "Diminuendo",
  },
  {
    kind: "slur",
    labelKey: "annotations.shapes.slur",
    fallback: "Łuk frazy",
    markKey: "annotations.mark.kind.slur",
    markFallback: "Łuk",
  },
  {
    kind: "bracket",
    labelKey: "annotations.shapes.bracket",
    fallback: "Klamra",
    markKey: "annotations.mark.kind.bracket",
    markFallback: "Klamra",
  },
];

export const DEFAULT_SHAPE: ShapeKind = "ellipse";

const SHAPE_INDEX = new Map(SHAPE_KINDS.map((def) => [def.kind, def]));

export const isShapeKind = (value: unknown): value is ShapeKind =>
  typeof value === "string" && SHAPE_INDEX.has(value as ShapeKind);

export const getShapeDef = (kind: ShapeKind): ShapeDef | undefined => SHAPE_INDEX.get(kind);

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
/**
 * A hairpin's open end, as a share of page width: about two staff spaces of an
 * A4 choral score. A short hairpin is held narrower than that, or it reads as a
 * wedge rather than a swell.
 */
const HAIRPIN_OPENING_FRACTION = 0.016;
const HAIRPIN_OPENING_MAX_SHARE = 0.35;
/** How far an arc rises over its chord: a share of the chord, held to a ceiling. */
const SLUR_RISE_SHARE = 0.2;
const SLUR_RISE_MAX_FRACTION = 0.03;
/** Points along an arc. */
const SLUR_SEGMENTS = 24;
/** A bracket's hook, as a share of page width, capped by the span. */
const BRACKET_HOOK_FRACTION = 0.012;
const BRACKET_HOOK_MAX_SHARE = 0.4;

/** Shapes that run from one end to the other, and so rule themselves like a line. */
const RULED_SHAPES: ReadonlySet<ShapeKind> = new Set<ShapeKind>([
  "line",
  "arrow",
  "cresc",
  "dim",
  "slur",
  "bracket",
]);

type Px = readonly [number, number];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * The end point after snapping, in px. Ruled shapes level or plumb themselves
 * near those angles and stay free between them — a diagonal is exactly what
 * crossing a note out needs. Boxes become squares, and ovals circles, when the
 * drag is nearly square.
 */
const snapEnd = (kind: ShapeKind, from: Px, to: Px): Px => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (RULED_SHAPES.has(kind)) {
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
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < SHAPE_MIN_DRAG_PX) return [];

  const norm = ([x, y]: Px): NormPoint => [clamp01(x / width), clamp01(y / height)];
  const segment = (p: Px, q: Px): NormPoint[] => [norm(p), norm(q)];
  // The side to the left of travel: above the line for a left-to-right drag.
  const left: Px = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
  const off = (p: Px, distance: number): Px => [
    p[0] + left[0] * distance,
    p[1] + left[1] * distance,
  ];

  switch (kind) {
    case "line":
      return [segment(a, b)];
    case "arrow": {
      const head = Math.min(length * ARROW_HEAD_MAX_SHARE, width * ARROW_HEAD_FRACTION);
      const back = Math.atan2(a[1] - b[1], a[0] - b[0]);
      const wing = (turn: number): Px => [
        b[0] + head * Math.cos(back + turn),
        b[1] + head * Math.sin(back + turn),
      ];
      return [segment(a, b), segment(wing(ARROW_HEAD_ANGLE), b), segment(wing(-ARROW_HEAD_ANGLE), b)];
    }
    case "cresc":
    case "dim": {
      const half =
        Math.min(width * HAIRPIN_OPENING_FRACTION, length * HAIRPIN_OPENING_MAX_SHARE) / 2;
      // Both legs start at the closed end, so the point is one cap, not two.
      const [closed, open] = kind === "cresc" ? [a, b] : [b, a];
      return [segment(closed, off(open, half)), segment(closed, off(open, -half))];
    }
    case "slur": {
      const rise = Math.min(length * SLUR_RISE_SHARE, width * SLUR_RISE_MAX_FRACTION);
      const arc: NormPoint[] = [];
      for (let i = 0; i <= SLUR_SEGMENTS; i++) {
        const t = i / SLUR_SEGMENTS;
        const along: Px = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        arc.push(norm(off(along, rise * 4 * t * (1 - t))));
      }
      return [arc];
    }
    case "bracket": {
      const hook = Math.min(width * BRACKET_HOOK_FRACTION, length * BRACKET_HOOK_MAX_SHARE);
      return [segment(off(a, -hook), a), segment(a, b), segment(b, off(b, -hook))];
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
