/**
 * @file useAnnotationTools.ts
 * @description Local editor state for the annotation tools — held tool, ink
 * colour, stroke weight, note display mode, the selected musical stamp, the
 * target layer and which layers are visible. Deliberately component-local React
 * state (not a global store): it is ephemeral UI, scoped to one open score, and
 * dies with the viewer.
 *
 * Two things outlive the viewer, in localStorage, because a rehearsal gives you
 * a bar and a half to write something down: which tool was last in hand, and
 * whether the finger draws. Neither is server state — they describe this device.
 * @module features/annotations/lib
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AnnotationLayer, NoteDisplay } from "../types/annotations.dto";
import { DEFAULT_STAMP } from "./stamps";
import { defaultInk, inksFor, type AnnotationInk } from "./palette";
import { useStylusPresence, readStylusSeen } from "./useStylusPresence";

export type AnnotationTool =
  | "pointer"
  | "pen"
  | "highlighter"
  | "note"
  | "stamp"
  | "eraser";

/** Tools that put ink on the page under a moving pointer. */
export const DRAWING_TOOLS: ReadonlySet<AnnotationTool> = new Set<AnnotationTool>([
  "pen",
  "highlighter",
]);

const TOOL_STORAGE_KEY = "voct.annotations.tool";
const FINGER_DRAW_STORAGE_KEY = "voct.annotations.finger_draw";
const TEXT_SCALE_STORAGE_KEY = "voct.annotations.text_scale";
const STAMP_SCALE_STORAGE_KEY = "voct.annotations.stamp_scale";

const readStored = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private-mode / storage-disabled: the choice still holds for the session.
  }
};

const isAnnotationTool = (value: string | null): value is AnnotationTool =>
  value === "pointer" ||
  value === "pen" ||
  value === "highlighter" ||
  value === "note" ||
  value === "stamp" ||
  value === "eraser";

/**
 * Size multiplier for a placed mark (text note / musical stamp), 1 = base size.
 * Continuous rather than stepped: how big a word sits over a stave is a matter
 * of the hand writing it and the eyes reading it from a stand, and four fixed
 * steps left every mark slightly wrong. The range sits inside the server's own
 * clamp (0.4 – 4.0), which also accepts every legacy stepped value.
 */
export const MARK_SCALE_MIN = 0.7;
export const MARK_SCALE_MAX = 2.4;
export const MARK_SCALE_STEP = 0.05;
export const DEFAULT_MARK_SCALE = 1;

/** Coerce a stored/edited scale into the slider's range; garbage → base size. */
export const clampMarkScale = (scale: number | undefined): number => {
  if (scale == null || !Number.isFinite(scale)) return DEFAULT_MARK_SCALE;
  return Math.min(MARK_SCALE_MAX, Math.max(MARK_SCALE_MIN, scale));
};

/** A remembered mark size, kept in the slider's range. */
const usePersistedScale = (key: string): [number, (scale: number) => void] => {
  const [scale, setScale] = useState<number>(() => {
    const stored = readStored(key);
    return stored === null ? DEFAULT_MARK_SCALE : clampMarkScale(Number(stored));
  });
  const commit = useCallback(
    (next: number) => {
      const clamped = clampMarkScale(next);
      setScale(clamped);
      writeStored(key, String(clamped));
    },
    [key],
  );
  return [scale, commit];
};

/**
 * Who draws: the finger, or only a stylus. An explicit choice wins; otherwise
 * the device decides — a tablet that has never seen a pen would have no way to
 * draw at all if the finger were reserved for panning.
 */
const resolveFingerDraw = (stylusSeen: boolean): boolean => {
  const stored = readStored(FINGER_DRAW_STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return !stylusSeen;
};

/** Stroke weight presets for pen + highlighter. */
export type StrokeSize = "fine" | "medium" | "bold";


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
  /** True → a finger draws; false → only a stylus/mouse does, the finger pans. */
  fingerDraw: boolean;
  setFingerDraw: (fingerDraw: boolean) => void;
  /** Whether an active stylus has ever touched this device (drives the default). */
  stylusSeen: boolean;
  color: string;
  setColor: (color: string) => void;
  /** The swatches this writer may use — the conductor's cue ink is not among a
   *  chorister's. */
  inks: readonly AnnotationInk[];
  size: StrokeSize;
  setSize: (size: StrokeSize) => void;
  /** Size multiplier applied to the NEXT text note placed (see MARK_SCALE_*). */
  textScale: number;
  setTextScale: (scale: number) => void;
  /** Size multiplier applied to the NEXT musical stamp placed. */
  stampScale: number;
  setStampScale: (scale: number) => void;
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
  isManager = true,
): AnnotationToolState => {
  const stylusSeen = useStylusPresence();
  const [fingerDraw, setFingerDrawState] = useState<boolean>(() =>
    resolveFingerDraw(readStylusSeen()),
  );
  const [tool, setToolState] = useState<AnnotationTool>(() => {
    const stored = readStored(TOOL_STORAGE_KEY);
    // The eraser is never restored: a tool that deletes on contact has to be
    // picked up on purpose, every time.
    if (!isAnnotationTool(stored) || stored === "eraser") return "pointer";
    // A remembered pencil is a gift where the finger still pans and only the
    // stylus writes. Where the finger draws it would hijack the first scroll,
    // so that device always opens in browse — one tap from the pen either way.
    return DRAWING_TOOLS.has(stored) && resolveFingerDraw(readStylusSeen())
      ? "pointer"
      : stored;
  });

  const setTool = useCallback((next: AnnotationTool) => {
    setToolState(next);
    writeStored(TOOL_STORAGE_KEY, next);
  }, []);

  const setFingerDraw = useCallback((next: boolean) => {
    setFingerDrawState(next);
    writeStored(FINGER_DRAW_STORAGE_KEY, next ? "1" : "0");
  }, []);

  // The first stylus touch is the device answering the question for us — but
  // only while nobody has answered it by hand.
  useEffect(() => {
    if (!stylusSeen || readStored(FINGER_DRAW_STORAGE_KEY) !== null) return;
    setFingerDrawState(false);
  }, [stylusSeen]);

  const [color, setColor] = useState<string>(() => defaultInk(isManager));
  const inks = useMemo(() => inksFor(isManager), [isManager]);
  const [size, setSize] = useState<StrokeSize>("medium");
  // Remembered per device: a writer settles on a size that reads from their
  // stand and should not have to find it again on the next score.
  const [textScale, setTextScale] = usePersistedScale(TEXT_SCALE_STORAGE_KEY);
  const [stampScale, setStampScale] = usePersistedScale(STAMP_SCALE_STORAGE_KEY);
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
    fingerDraw,
    setFingerDraw,
    stylusSeen,
    color,
    setColor,
    inks,
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
