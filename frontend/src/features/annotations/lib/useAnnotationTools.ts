/**
 * @file useAnnotationTools.ts
 * @description Local editor state for the annotation tools — held tool, ink
 * colour, stroke weight, the shape in hand, note display mode, the selected
 * musical stamp, the target layer and which layers are visible. Component-local
 * React state (not a global store) except for the layer switches: it is
 * ephemeral UI, scoped to one open score, and dies with the viewer.
 *
 * What describes this device outlives the viewer (`deviceStorage`), because a
 * rehearsal gives you a bar and a half to write something down: the tool last in
 * hand and the shape it draws, the size of notes and stamps, whether the finger
 * draws, and which layers are shown. None of it is server state. The one value
 * every mounted stand reads live is which layers are shown (see
 * `hiddenLayers`); the rest is read as a stand mounts.
 * @module features/annotations/lib
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { AnnotationLayer, NoteDisplay } from "../types/annotations.dto";
import { readStored, writeStored } from "./deviceStorage";
import { DEFAULT_STAMP } from "./stamps";
import { DEFAULT_SHAPE, isShapeKind, type ShapeKind } from "./shapes";
import { defaultInk, inksFor, type AnnotationInk } from "./palette";
import { useStylusPresence, readStylusSeen } from "./useStylusPresence";

export type AnnotationTool =
  | "pointer"
  | "pen"
  | "highlighter"
  | "shape"
  | "note"
  | "stamp"
  | "eraser"
  | "select";

/** Tools that put ink on the page under a moving pointer. */
export const DRAWING_TOOLS: ReadonlySet<AnnotationTool> = new Set<AnnotationTool>([
  "pen",
  "highlighter",
  "shape",
]);

/**
 * Tools whose drag traces a line: the drawing tools, and the selection's loop.
 * Each owns every touch while armed, so the finger is routed the same way for
 * all of them.
 */
export const TRACING_TOOLS: ReadonlySet<AnnotationTool> = new Set<AnnotationTool>([
  ...DRAWING_TOOLS,
  "select",
]);

const TOOL_STORAGE_KEY = "voct.annotations.tool";
const FINGER_DRAW_STORAGE_KEY = "voct.annotations.finger_draw";
const TEXT_SCALE_STORAGE_KEY = "voct.annotations.text_scale";
const STAMP_SCALE_STORAGE_KEY = "voct.annotations.stamp_scale";
const SHAPE_STORAGE_KEY = "voct.annotations.shape";
/** The layers the reader HID, comma-separated: a layer that is new is shown. */
const HIDDEN_LAYERS_STORAGE_KEY = "voct.annotations.hidden_layers";

const ALL_LAYERS: readonly AnnotationLayer[] = ["shared", "conductor", "leader", "personal"];

/**
 * Which layers are hidden is one fact per device, not one per open score. A
 * songbook mounts a stand for every row, each holding its own tools, so a
 * switch flipped in one has to reach the others while they sit closed — or the
 * next score opens showing what the reader just hid. Held here, read through
 * `useSyncExternalStore`, and copied to storage for the next visit; with
 * storage unavailable the choice still holds for the session.
 */
let hiddenLayers: string | null = null;
const hiddenLayerListeners = new Set<() => void>();

const readHiddenLayers = (): string => {
  if (hiddenLayers === null) hiddenLayers = readStored(HIDDEN_LAYERS_STORAGE_KEY) ?? "";
  return hiddenLayers;
};

const subscribeHiddenLayers = (listener: () => void): (() => void) => {
  hiddenLayerListeners.add(listener);
  return () => {
    hiddenLayerListeners.delete(listener);
  };
};

const writeHiddenLayers = (next: string): void => {
  hiddenLayers = next;
  writeStored(HIDDEN_LAYERS_STORAGE_KEY, next);
  for (const listener of hiddenLayerListeners) listener();
};

const visibilityOf = (stored: string): LayerVisibility => {
  const hidden = new Set(stored.split(","));
  return {
    shared: !hidden.has("shared"),
    conductor: !hidden.has("conductor"),
    leader: !hidden.has("leader"),
    personal: !hidden.has("personal"),
  };
};

const isAnnotationTool = (value: string | null): value is AnnotationTool =>
  value === "pointer" ||
  value === "pen" ||
  value === "highlighter" ||
  value === "shape" ||
  value === "note" ||
  value === "stamp" ||
  value === "eraser" ||
  value === "select";

/**
 * Size multiplier for a placed mark (text note / musical stamp), 1 = base size.
 * Continuous rather than stepped: how big a word sits over a stave is a matter
 * of the hand writing it and the eyes reading it from a stand, and four fixed
 * steps left every mark slightly wrong. The range sits inside the server's own
 * clamp (0.4 – 4.0), which also accepts every legacy stepped value. The floor
 * sets a note below the size of the engraved lyrics, so a word fits between
 * two staves without covering either.
 */
export const MARK_SCALE_MIN = 0.5;
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
  /** Which shape the shape tool draws. Its line weight is the pen's `size`. */
  shape: ShapeKind;
  setShape: (shape: ShapeKind) => void;
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
    // The selection's loop owns the finger the same way.
    return TRACING_TOOLS.has(stored) && resolveFingerDraw(readStylusSeen())
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
  // Remembered with the tool itself: a restored shape tool that forgot WHICH
  // shape would draw an oval where the writer last ruled lines.
  const [shape, setShapeState] = useState<ShapeKind>(() => {
    const stored = readStored(SHAPE_STORAGE_KEY);
    return isShapeKind(stored) ? stored : DEFAULT_SHAPE;
  });
  const setShape = useCallback((next: ShapeKind) => {
    setShapeState(next);
    writeStored(SHAPE_STORAGE_KEY, next);
  }, []);
  const [noteDisplay, setNoteDisplay] = useState<NoteDisplay>("inline");
  const [stamp, setStamp] = useState<string>(DEFAULT_STAMP);
  const [layer, setLayer] = useState<AnnotationLayer>(initialLayer);
  // Remembered too: a conductor previewing what the choir sees, or a singer who
  // reads without their own pencil marks, set the page up once.
  const hidden = useSyncExternalStore(subscribeHiddenLayers, readHiddenLayers);
  const visibleLayers = useMemo(() => visibilityOf(hidden), [hidden]);

  const toggleLayerVisibility = useCallback((target: AnnotationLayer) => {
    const current = visibilityOf(readHiddenLayers());
    const next = { ...current, [target]: !current[target] };
    writeHiddenLayers(ALL_LAYERS.filter((layer) => !next[layer]).join(","));
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
    shape,
    setShape,
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
