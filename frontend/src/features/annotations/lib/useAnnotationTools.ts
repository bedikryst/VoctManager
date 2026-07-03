/**
 * @file useAnnotationTools.ts
 * @description Local editor state for the annotation tools — held tool, ink
 * colour, stroke weight, note display mode, the selected musical stamp, the
 * target layer and which layers are visible. Deliberately component-local React
 * state (not a global store): it is ephemeral UI, scoped to one open score, and
 * dies with the viewer.
 * @module features/annotations/lib
 */

import { useCallback, useState } from "react";

import type { AnnotationLayer, NoteDisplay } from "../types/annotations.dto";
import { DEFAULT_STAMP } from "./stamps";

export type AnnotationTool =
  | "pointer"
  | "pen"
  | "highlighter"
  | "note"
  | "stamp"
  | "eraser";

/** Stroke weight presets for pen + highlighter. */
export type StrokeSize = "fine" | "medium" | "bold";

/** Size presets for placed marks (text notes + musical stamps). */
export type MarkScale = "s" | "m" | "l" | "xl";

/** The four scale steps, ordered small → extra-large. */
export const MARK_SCALE_ORDER: ReadonlyArray<MarkScale> = ["s", "m", "l", "xl"];

/** Multiplier applied to a mark's base size for each preset (medium = 1×). */
export const MARK_SCALE_FACTORS: Record<MarkScale, number> = {
  s: 0.7,
  m: 1,
  l: 1.5,
  xl: 2.2,
};

/** Nearest preset for a stored numeric scale (legacy/edited marks). */
export const scaleToPreset = (scale: number | undefined): MarkScale => {
  if (scale == null) return "m";
  return MARK_SCALE_ORDER.reduce((best, step) =>
    Math.abs(MARK_SCALE_FACTORS[step] - scale) <
    Math.abs(MARK_SCALE_FACTORS[best] - scale)
      ? step
      : best,
  );
};

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
  textScale: MarkScale;
  setTextScale: (scale: MarkScale) => void;
  stampScale: MarkScale;
  setStampScale: (scale: MarkScale) => void;
  noteDisplay: NoteDisplay;
  setNoteDisplay: (display: NoteDisplay) => void;
  stamp: string;
  setStamp: (stamp: string) => void;
  layer: AnnotationLayer;
  setLayer: (layer: AnnotationLayer) => void;
  visibleLayers: LayerVisibility;
  toggleLayerVisibility: (layer: AnnotationLayer) => void;
}

export const useAnnotationTools = (
  initialLayer: AnnotationLayer = "shared",
): AnnotationToolState => {
  const [tool, setTool] = useState<AnnotationTool>("pointer");
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0]);
  const [size, setSize] = useState<StrokeSize>("medium");
  const [textScale, setTextScale] = useState<MarkScale>("m");
  const [stampScale, setStampScale] = useState<MarkScale>("m");
  const [noteDisplay, setNoteDisplay] = useState<NoteDisplay>("inline");
  const [stamp, setStamp] = useState<string>(DEFAULT_STAMP);
  const [layer, setLayer] = useState<AnnotationLayer>(initialLayer);
  const [visibleLayers, setVisibleLayers] = useState<LayerVisibility>({
    shared: true,
    conductor: true,
    personal: true,
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
    textScale,
    setTextScale,
    stampScale,
    setStampScale,
    noteDisplay,
    setNoteDisplay,
    stamp,
    setStamp,
    layer,
    setLayer,
    visibleLayers,
    toggleLayerVisibility,
  };
};
