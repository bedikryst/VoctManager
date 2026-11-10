/**
 * @file MarkLayer.tsx
 * @description The finished ink on one page: covers, highlighter and pen
 * strokes, the invisible bands that make a stroke touchable, and the gold washes
 * for what is new and what is selected.
 *
 * Covers ("Korektor") come first, straight on the page, so they hide the print
 * and never a mark: a singer's cover cannot hide the conductor's shared ink,
 * and hiding a layer brings the printed original back. A cover is invisible on
 * white paper, so while a tool that changes covers is in hand each one this
 * reader may change wears a dashed hairline (`outlined`). Its washes are drawn
 * with it, under the strokes, so a gold wash never tints ink lying over it.
 *
 * Memoised, and so is every stroke in it, because the page re-renders for
 * reasons that are not ink — a card opening, a note being dragged, a selection
 * changing — and a dense page holds hundreds of strokes. A stroke's smoothed
 * path is built once per payload and page size and then reused by the ink, its
 * hit band and both washes; the query cache keeps an unchanged row's payload
 * the same object across refetches, which is what the cache is keyed on.
 *
 * A selection being dragged is moved without a render: carried strokes are
 * translated by two CSS custom properties the overlay writes on its surface
 * (`CARRY_TRANSFORM`), and only the rows the drag picked up are carried, so a
 * moved mark stops being carried the moment its new position arrives.
 * @module features/annotations/components
 */

import React, { memo } from "react";

import type {
  CoverMark,
  FreehandPayload,
  ScoreAnnotation,
  StrokeMark,
} from "../types/annotations.dto";
import { coverRect } from "../lib/covers";
import { highlightOpacity } from "../lib/palette";
import { buildSmoothPath } from "../lib/smoothing";

/**
 * The invisible band that makes a stroke touchable. A hairline pen line has to
 * grow to something a thumb can find; a bold highlighter must NOT grow past its
 * own paint, because this band is also where text selection stops passing
 * through to the page under it.
 */
export const STROKE_HIT_MIN_WIDTH = 16;
const STROKE_HIT_MAX_WIDTH = 28;
/** How far the selection wash spreads beyond the ink it traces, each side. */
const SELECTION_HALO_PX = 5;
const SELECTION_HALO_OPACITY = 0.45;
/** The "new since your last visit" wash: wider than the selection, and fainter. */
const NEW_HALO_PX = 8;
const NEW_HALO_OPACITY = 0.22;
/** A cover without a paper tone of its own: the stand never tints the page. */
const PAPER_WHITE = "#ffffff";
/** The dashed hairline a cover wears while it can be changed. */
const COVER_OUTLINE_DASH = "4 3";

/** The two properties a selection drag writes on the overlay's surface. */
export const CARRY_X = "--carry-x";
export const CARRY_Y = "--carry-y";
/** The shift a carried mark is drawn with while its selection is dragged. */
export const CARRY_TRANSFORM = `translate(var(${CARRY_X}, 0px), var(${CARRY_Y}, 0px))`;

const pathCache = new WeakMap<FreehandPayload, { width: number; height: number; d: string }>();

/** A stroke's smoothed path at this page size, built once and reused. */
export const strokePath = (payload: FreehandPayload, width: number, height: number): string => {
  const cached = pathCache.get(payload);
  if (cached && cached.width === width && cached.height === height) return cached.d;
  const d = payload.paths.map((path) => buildSmoothPath(path, width, height)).join(" ");
  pathCache.set(payload, { width, height, d });
  return d;
};

/** The weight a stroke is drawn at: never thinner than a line the eye can find. */
export const strokeWidthPx = (mark: StrokeMark, width: number): number =>
  Math.max(mark.annotation_type === "HL" ? 4 : 1.5, mark.payload.width * width);

interface StrokeInkProps {
  mark: StrokeMark;
  d: string;
  weight: number;
  /** Offered a hit band: this reader may act on it, with a tool that acts on strokes. */
  touchable: boolean;
  erasing: boolean;
  carried: boolean;
  onActivate: (mark: ScoreAnnotation) => void;
  onErase: (mark: ScoreAnnotation) => void;
}

const StrokeInk = memo(function StrokeInk({
  mark,
  d,
  weight,
  touchable,
  erasing,
  carried,
  onActivate,
  onErase,
}: StrokeInkProps): React.JSX.Element {
  const highlight = mark.annotation_type === "HL";
  return (
    <g style={carried ? { transform: CARRY_TRANSFORM } : undefined}>
      <path
        d={d}
        fill="none"
        stroke={mark.color}
        strokeWidth={weight}
        strokeLinecap={highlight ? "butt" : "round"}
        strokeLinejoin="round"
        style={{
          opacity: highlight ? highlightOpacity(mark.color) : 1,
          mixBlendMode: highlight ? "multiply" : "normal",
          pointerEvents: "none",
        }}
      />
      {touchable && (
        // Invisible band, wide enough to find with a thumb. It must stay a
        // <path> and never become a <button>: the viewer's pinch gate walks
        // `closest("button, …, [data-pdf-pinch-through]")` and honours the
        // attribute on whatever it lands on, so a button here would stop two
        // fingers zooming the score wherever ink had been drawn.
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.min(STROKE_HIT_MAX_WIDTH, Math.max(weight, STROKE_HIT_MIN_WIDTH))}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "stroke", cursor: "pointer" }}
          // Selection rides the CLICK: a touch that scrolled the viewport has
          // its click suppressed by the browser, so panning over ink is still
          // panning. Erasing stays on the press, where rubbing belongs.
          onClick={() => onActivate(mark)}
          onPointerDown={(e) => {
            if (!erasing) return;
            e.stopPropagation();
            // A touch (and a stylus) is IMPLICITLY captured to the element it
            // landed on, so every later `pointerenter` would be delivered
            // here and the rub below would only ever erase this one line.
            // Letting the capture go is what makes the gesture reach the rest
            // of the scribble.
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            onErase(mark);
          }}
          // Rubbing out a scribble is one gesture, not one tap per line.
          onPointerEnter={(e) => {
            if (!erasing || e.buttons === 0) return;
            onErase(mark);
          }}
        />
      )}
    </g>
  );
});

interface CoverPaperProps {
  mark: CoverMark;
  width: number;
  height: number;
  /** A tap on the paper opens the cover's card: browsing, and this reader may change it. */
  touchable: boolean;
  outlined: boolean;
  carried: boolean;
  onActivate: (mark: ScoreAnnotation) => void;
}

const CoverPaper = memo(function CoverPaper({
  mark,
  width,
  height,
  touchable,
  outlined,
  carried,
  onActivate,
}: CoverPaperProps): React.JSX.Element {
  const box = coverRect(mark.payload, width, height);
  return (
    <g style={carried ? { transform: CARRY_TRANSFORM } : undefined}>
      {/* Hit on the fill, not an outline: the whole paper answers. It is the
          lowest thing on the page, so every mark above it takes a tap first. */}
      <rect
        x={box.left}
        y={box.top}
        width={box.width}
        height={box.height}
        fill={mark.payload.tone ?? PAPER_WHITE}
        style={{
          pointerEvents: touchable ? "fill" : "none",
          cursor: touchable ? "pointer" : undefined,
        }}
        onClick={touchable ? () => onActivate(mark) : undefined}
      />
      {outlined && (
        <rect
          x={box.left + 0.5}
          y={box.top + 0.5}
          width={Math.max(0, box.width - 1)}
          height={Math.max(0, box.height - 1)}
          fill="none"
          className="stroke-ethereal-graphite"
          strokeOpacity={0.7}
          strokeWidth={1}
          strokeDasharray={COVER_OUTLINE_DASH}
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
});

interface MarkLayerProps {
  /** The page's visible strokes, in stacking order. */
  strokes: readonly StrokeMark[];
  /** The page's visible covers, drawn under everything else. */
  covers: readonly CoverMark[];
  /** Page box, in rendered pixels. */
  width: number;
  height: number;
  /** The armed tool acts on strokes (browse, eraser); only then are bands offered. */
  interactive: boolean;
  /** Browsing: a tap on a cover this reader may change opens its card. */
  coversInteractive: boolean;
  /** A tool that changes covers is in hand: the changeable ones wear an outline. */
  coversOutlined: boolean;
  erasing: boolean;
  canModify: (mark: ScoreAnnotation) => boolean;
  /** Marks drawn as selected: the one card's mark, or the selection's. */
  selected: ReadonlySet<string>;
  /** Marks new to this reader since their last visit. */
  newIds: ReadonlySet<string>;
  /** The rows a selection drag picked up, by id; null while nothing is dragged. */
  carried: ReadonlyMap<string, ScoreAnnotation> | null;
  onActivate: (mark: ScoreAnnotation) => void;
  onErase: (mark: ScoreAnnotation) => void;
}

export const MarkLayer = memo(function MarkLayer({
  strokes,
  covers,
  width,
  height,
  interactive,
  coversInteractive,
  coversOutlined,
  erasing,
  canModify,
  selected,
  newIds,
  carried,
  onActivate,
  onErase,
}: MarkLayerProps): React.JSX.Element {
  const isCarried = (mark: ScoreAnnotation): boolean => carried?.get(mark.id) === mark;
  // Highlighter first (under the ink), then opaque pen strokes.
  const ordered = [
    ...strokes.filter((mark) => mark.annotation_type === "HL"),
    ...strokes.filter((mark) => mark.annotation_type === "FH"),
  ];

  /** A gold wash traced round a stroke. Drawn over the finished ink rather
   *  than under it: a highlighter composites with `multiply`, so a halo beneath
   *  one would be multiplied INTO the marker and read as a mark of its own. */
  const halo = (mark: StrokeMark, spread: number, opacity: number, key: string) => (
    <path
      key={`${key}-${mark.id}`}
      className="stroke-ethereal-gold"
      d={strokePath(mark.payload, width, height)}
      fill="none"
      strokeWidth={strokeWidthPx(mark, width) + spread * 2}
      strokeOpacity={opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        mixBlendMode: "normal",
        pointerEvents: "none",
        transform: isCarried(mark) ? CARRY_TRANSFORM : undefined,
      }}
    />
  );

  /** The same wash laid over a cover and past its edges, as a symbol's lies
   *  behind it. A band traced on the edge would swallow a small cover whole
   *  and leave a sliver of paper in the middle. */
  const coverHalo = (mark: CoverMark, spread: number, opacity: number, key: string) => {
    const box = coverRect(mark.payload, width, height);
    return (
      <rect
        key={`${key}-${mark.id}`}
        className="fill-ethereal-gold"
        x={box.left - spread}
        y={box.top - spread}
        width={box.width + spread * 2}
        height={box.height + spread * 2}
        rx={spread}
        fillOpacity={opacity}
        style={{
          pointerEvents: "none",
          transform: isCarried(mark) ? CARRY_TRANSFORM : undefined,
        }}
      />
    );
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0"
      // Never a hit target itself. `pointer-events: none` on an ancestor does
      // NOT stop a descendant that switches them back on, so the hit bands
      // opt in one at a time — the same arrangement the note markers use.
      // Leaving the root "auto" while an eraser was armed turned the whole page
      // rectangle into a target and swallowed text selection across all of it.
      style={{ pointerEvents: "none" }}
    >
      {covers.map((mark) => {
        const modifiable = canModify(mark);
        return (
          <CoverPaper
            key={mark.id}
            mark={mark}
            width={width}
            height={height}
            touchable={coversInteractive && modifiable}
            outlined={coversOutlined && modifiable}
            carried={isCarried(mark)}
            onActivate={onActivate}
          />
        );
      })}
      {newIds.size > 0 &&
        covers
          .filter((mark) => newIds.has(mark.id))
          .map((mark) => coverHalo(mark, NEW_HALO_PX, NEW_HALO_OPACITY, "new"))}
      {selected.size > 0 &&
        covers
          .filter((mark) => selected.has(mark.id))
          .map((mark) => coverHalo(mark, SELECTION_HALO_PX, SELECTION_HALO_OPACITY, "halo"))}

      {ordered.map((mark) => (
        <StrokeInk
          key={mark.id}
          mark={mark}
          d={strokePath(mark.payload, width, height)}
          weight={strokeWidthPx(mark, width)}
          // The band is offered only on marks this reader may act on, which is
          // also what bounds its cost: a chorister reading the conductor's
          // highlight over the lyrics keeps full text selection under it.
          touchable={interactive && canModify(mark)}
          erasing={erasing}
          carried={isCarried(mark)}
          onActivate={onActivate}
          onErase={onErase}
        />
      ))}

      {/* New marks, then the selection last of all, so both wash over finished
          ink and the selection reads over the newness. */}
      {newIds.size > 0 &&
        ordered
          .filter((mark) => newIds.has(mark.id))
          .map((mark) => halo(mark, NEW_HALO_PX, NEW_HALO_OPACITY, "new"))}
      {selected.size > 0 &&
        ordered
          .filter((mark) => selected.has(mark.id))
          .map((mark) => halo(mark, SELECTION_HALO_PX, SELECTION_HALO_OPACITY, "halo"))}
    </svg>
  );
});
