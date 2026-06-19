/**
 * @file useAnnotationTools.ts
 * @description Local editor state for the annotation tools — which tool is held,
 * the ink colour, and the target layer. Deliberately component-local React state
 * (not a global store): it is ephemeral UI, scoped to one open score, and dies
 * with the viewer. No Zustand needed here.
 * @module features/annotations/lib
 */

import { useState } from "react";

import type { AnnotationLayer } from "../types/annotations.dto";

export type AnnotationTool = "pointer" | "pen" | "comment" | "eraser";

/** Ink palette — crimson cue, ledger blue, breath green, gilt accent. */
export const ANNOTATION_COLORS = [
  "#DC2626",
  "#2563EB",
  "#15803D",
  "#B45309",
] as const;

/** Freehand stroke width as a fraction of page width (scales with zoom). */
export const PEN_STROKE_FRACTION = 0.004;

export interface AnnotationToolState {
  tool: AnnotationTool;
  setTool: (tool: AnnotationTool) => void;
  color: string;
  setColor: (color: string) => void;
  layer: AnnotationLayer;
  setLayer: (layer: AnnotationLayer) => void;
}

export const useAnnotationTools = (): AnnotationToolState => {
  const [tool, setTool] = useState<AnnotationTool>("pointer");
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0]);
  const [layer, setLayer] = useState<AnnotationLayer>("shared");

  return { tool, setTool, color, setColor, layer, setLayer };
};
