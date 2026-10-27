/**
 * @file LiveStrokeLayer.tsx
 * @description The line in progress, drawn outside React. The input hook hands
 * every sample to `draw`, and the path's `d` is written once per animation
 * frame, straight onto the element: a pen reports several times a frame, and a
 * render per sample was a render of the whole page per sample.
 *
 * What the line looks like (tool, ink, weight, the shape in hand) is ordinary
 * props, which change between strokes and never during one. The path's `d` is
 * never a prop, so a render of this layer cannot paint over the frame loop.
 *
 * A finished line is cleared on the next frame rather than at once: by then
 * the mark that replaces it has been drawn by the page, and the reader never
 * sees the gap between the two.
 * @module features/annotations/components
 */

import React, { useCallback, useEffect, useImperativeHandle, useRef } from "react";

import type { NormPoint } from "../types/annotations.dto";
import { buildSmoothPath } from "../lib/smoothing";
import { buildShapePaths, type ShapeKind } from "../lib/shapes";

export interface LiveStrokeHandle {
  /** The line as it stands now, or null once it has ended. */
  draw: (points: readonly NormPoint[] | null) => void;
}

/** How the line in progress is drawn: ink, a marker, or a selection's loop. */
export type LiveStrokeLook = "ink" | "highlight" | "loop";

interface LiveStrokeLayerProps {
  ref: React.Ref<LiveStrokeHandle>;
  /** Page box, in rendered pixels. */
  width: number;
  height: number;
  look: LiveStrokeLook;
  color: string;
  /** Line weight, in rendered pixels. */
  strokeWidth: number;
  /** Set while the shape tool is armed: the line is that figure, corner to corner. */
  shape: ShapeKind | null;
  highlightOpacity: number;
}

interface Geometry {
  width: number;
  height: number;
  look: LiveStrokeLook;
  shape: ShapeKind | null;
}

const livePath = (points: readonly NormPoint[], { width, height, look, shape }: Geometry): string => {
  if (points.length < 2) return "";
  if (shape) {
    return buildShapePaths(shape, points[0], points[points.length - 1], width, height)
      .map((path) => buildSmoothPath(path, width, height))
      .join(" ");
  }
  const d = buildSmoothPath(points, width, height);
  return look === "loop" ? `${d} Z` : d;
};

export const LiveStrokeLayer = ({
  ref,
  width,
  height,
  look,
  color,
  strokeWidth,
  shape,
  highlightOpacity,
}: LiveStrokeLayerProps): React.JSX.Element => {
  const pathRef = useRef<SVGPathElement | null>(null);
  const pending = useRef<readonly NormPoint[] | null>(null);
  const frame = useRef<number | null>(null);
  // Read when the frame paints: the page may be resized between two samples.
  const geometry = useRef<Geometry>({ width, height, look, shape });
  geometry.current = { width, height, look, shape };

  const paint = useCallback(() => {
    frame.current = null;
    const points = pending.current;
    pathRef.current?.setAttribute("d", points ? livePath(points, geometry.current) : "");
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      draw: (points) => {
        pending.current = points;
        if (frame.current === null) frame.current = window.requestAnimationFrame(paint);
      },
    }),
    [paint],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    },
    [],
  );

  const loop = look === "loop";
  const highlight = look === "highlight";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0"
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        className={loop ? "fill-ethereal-gold/10 stroke-ethereal-gold" : undefined}
        fill={loop ? undefined : "none"}
        stroke={loop ? undefined : color}
        strokeWidth={loop ? 1.5 : strokeWidth}
        strokeDasharray={loop ? "6 4" : undefined}
        strokeLinecap={highlight ? "butt" : "round"}
        strokeLinejoin="round"
        style={{
          opacity: highlight ? highlightOpacity : loop ? 1 : 0.85,
          mixBlendMode: highlight ? "multiply" : "normal",
        }}
      />
    </svg>
  );
};
