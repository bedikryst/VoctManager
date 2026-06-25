/**
 * @file useAnnotationTools.ts
 * @description Local editor state for the annotation tools — held tool, ink
 * colour, stroke weight, note display mode, the target layer and which layers
 * are visible. Deliberately component-local React state (not a global store):
 * it is ephemeral UI, scoped to one open score, and dies with the viewer.
 * @module features/annotations/lib
 */

import { useCallback, useState } from "react";

import type { AnnotationLayer, NoteDisplay } from "../types/annotations.dto";

export type AnnotationTool =
  | "pointer"
  | "pen"
  | "highlighter"
  | "note"
  | "eraser";

/** Stroke weight presets for pen + highlighter. */
export type StrokeSize = "fine" | "medium" | "bold";

/** Ink palette — crimson cue, ledger blue, breath green, gilt accent, ink. */
export const ANNOTATION_COLORS = [
  "#DC2626",
  "#2563EB",
  "#15803D",
  "#B45309",
  "#1F2933",
] as const;

/** Per-tool stroke width as a fraction of page width (so it scales with zoom). */
const PEN_WIDTHS: Record<StrokeSize, number> = {
  fine: 0.0022,
  medium: 0.0038,
  bold: 0.0065,
};
const HIGHLIGHT_WIDTHS: Record<StrokeSize, number> = {
  fine: 0.013,
  medium: 0.021,
  bold: 0.032,
};

/** Resolve the stored stroke-width fraction for the active drawing tool + size. */
export const strokeFraction = (
  tool: "pen" | "highlighter",
  size: StrokeSize,
): number => (tool === "highlighter" ? HIGHLIGHT_WIDTHS : PEN_WIDTHS)[size];

export type LayerVisibility = Record<AnnotationLayer, boolean>;

export interface AnnotationToolState {
  tool: AnnotationTool;
  setTool: (tool: AnnotationTool) => void;
  color: string;
  setColor: (color: string) => void;
  size: StrokeSize;
  setSize: (size: StrokeSize) => void;
  noteDisplay: NoteDisplay;
  setNoteDisplay: (display: NoteDisplay) => void;
  layer: AnnotationLayer;
  setLayer: (layer: AnnotationLayer) => void;
  visibleLayers: LayerVisibility;
  toggleLayerVisibility: (layer: AnnotationLayer) => void;
}

export const useAnnotationTools = (): AnnotationToolState => {
  const [tool, setTool] = useState<AnnotationTool>("pointer");
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0]);
  const [size, setSize] = useState<StrokeSize>("medium");
  const [noteDisplay, setNoteDisplay] = useState<NoteDisplay>("inline");
  const [layer, setLayer] = useState<AnnotationLayer>("shared");
  const [visibleLayers, setVisibleLayers] = useState<LayerVisibility>({
    shared: true,
    conductor: true,
  });

  const toggleLayerVisibility = useCallback((target: AnnotationLayer) => {
    setVisibleLayers((current) => ({
      ...current,
      [target]: !current[target],
    }));
  }, []);

  return {
    tool,
    setTool,
    color,
    setColor,
    size,
    setSize,
    noteDisplay,
    setNoteDisplay,
    layer,
    setLayer,
    visibleLayers,
    toggleLayerVisibility,
  };
};
