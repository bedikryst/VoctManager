/**
 * @file AnnotationOverlay.tsx
 * @description The drawing surface stacked over a single rendered PDF page.
 * Renders highlighter + ink strokes, musical stamps, inline text and pinned
 * notes and — when editing is allowed — captures pen / highlighter / note /
 * stamp / eraser input and inline note editing. All coordinates are normalized
 * (0..1) to the page box so a marking holds its musical position across zoom
 * and devices. Input routing follows `fingerDraw`: on a stylus device the
 * finger PANS the score (manual scroll of the viewer viewport) and only
 * pen/mouse draw — palm rejection; on a device with no stylus the finger draws,
 * because reserving it for panning would leave the pencil unable to write at
 * all. Two fingers are never a stroke: a second touch abandons the line in
 * progress and hands the gesture to the viewer's pinch zoom. Note + stamp
 * placement is tap-detected so panning stays possible on touch.
 * Which existing marks may be erased/edited is decided by the `canModify`
 * predicate — a chorister touches only their personal layer.
 *
 * EVERY kind of marking answers to a tap, not only the notes: a stroke carries
 * an invisible hit band, a stamp and a note carry their own buttons, and the
 * tapped one opens the card that says who reads it. That card is anchored to
 * the marking (`MarkActionCard`, or `NoteCard` for words) — the question "who
 * sees this?" is asked about one spot of music, so it is answered there.
 * @module features/annotations/components
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Lock, Pin } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import {
  TAP_ZONE_FRACTION as PDF_TAP_ZONE_FRACTION,
  type PdfPageGeometry,
} from "@/shared/ui/composites/PdfViewer";

import { MarkActionCard } from "./MarkActionCard";
import { inlineFontSize, NoteCard } from "./NoteCard";
import {
  isComment,
  isFreehand,
  isHighlight,
  isStamp,
  type AnnotationLayer,
  type AnnotationPatch,
  type CommentPayload,
  type FreehandPayload,
  type NewAnnotation,
  type NoteDisplay,
  type NormPoint,
  type ScoreAnnotation,
  type StampPayload,
} from "../types/annotations.dto";
import {
  clampMarkScale,
  strokeFraction,
  type AnnotationTool,
  type LayerVisibility,
  type StrokeSize,
} from "../lib/useAnnotationTools";
import { isPrivateLayer, layerOf, type WriteLayer } from "../lib/layers";
import type { AnnotationInk } from "../lib/palette";
import { getStampDef, StampGlyph } from "../lib/stamps";
import { buildSmoothPath } from "../lib/smoothing";
import { pickRecentPhrases, QUICK_PHRASES } from "../lib/quickPhrases";

interface AnnotationOverlayProps {
  geometry: PdfPageGeometry;
  annotations: ScoreAnnotation[];
  visibleLayers: LayerVisibility;
  tool: AnnotationTool;
  color: string;
  size: StrokeSize;
  /** Size multiplier applied to newly placed text notes. */
  textScale: number;
  /** Size multiplier applied to newly placed musical stamps. */
  stampScale: number;
  noteDisplay: NoteDisplay;
  stamp: string;
  layer: AnnotationLayer;
  /** True → a bare finger draws; false → the finger pans and only a stylus draws. */
  fingerDraw: boolean;
  /**
   * Turn the score by one reader's turn. This surface swallows every touch
   * while a pen is armed, so without it a reader holding the pencil has no way
   * to move on at all — and in performance mode there is no bottom bar to fall
   * back to.
   */
  onTurnPage: (delta: 1 | -1) => void;
  canEdit: boolean;
  /** May THIS user erase / edit the given mark? (chorister → personal only). */
  canModify: (annotation: ScoreAnnotation) => boolean;
  /** Swatches this writer may use, for recolouring a mark already placed. */
  inks: readonly AnnotationInk[];
  /**
   * Reaches a placed mark may be moved BETWEEN. Empty for a chorister: their
   * mark has exactly one possible audience, so a ladder would name layers that
   * mean nothing to them. The overlay renders the control from this alone and
   * never learns what a "mode" is.
   */
  audiences: readonly WriteLayer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (annotation: Omit<NewAnnotation, "edition">) => void;
  onUpdate: (id: string, after: AnnotationPatch, before: AnnotationPatch) => void;
  onDelete: (id: string) => void;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const HIGHLIGHT_OPACITY = 0.42;
/**
 * The invisible band that makes a stroke touchable. A hairline pen line has to
 * grow to something a thumb can find; a bold highlighter must NOT grow past its
 * own paint, because this band is also where text selection stops passing
 * through to the page under it.
 */
const STROKE_HIT_MIN_WIDTH = 16;
const STROKE_HIT_MAX_WIDTH = 28;
/** How far the selection wash spreads beyond the ink it traces, each side. */
const SELECTION_HALO_PX = 5;
/** Pointer drift beyond this many px stops being a tap and becomes a drag/pan. */
const MOUSE_SLOP_PX = 6;
/**
 * A finger is not a mouse. A tap on a tablet wanders ten-odd pixels before it
 * lifts, and reading that wander as a drag is what made tapping a note nudge it
 * instead of opening it — the single biggest reason the text tool felt stiff.
 */
const TOUCH_SLOP_PX = 14;

const slopFor = (pointerType: string): number =>
  pointerType === "mouse" ? MOUSE_SLOP_PX : TOUCH_SLOP_PX;

/** Marks the wrappers around placed marks, so the surface below never treats a
 *  press on an existing mark as a request to place a new one. */
const MARK_ATTR = "data-annotation-mark";

/** Ink and highlighter share a payload and every rule below that draws one. */
const isStrokeMark = (
  a: ScoreAnnotation,
): a is ScoreAnnotation & { payload: FreehandPayload } =>
  isFreehand(a) || isHighlight(a);

export const AnnotationOverlay = ({
  geometry,
  annotations,
  visibleLayers,
  tool,
  color,
  size,
  textScale,
  stampScale,
  noteDisplay,
  stamp,
  layer,
  fingerDraw,
  onTurnPage,
  canEdit,
  canModify,
  inks,
  audiences,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
}: AnnotationOverlayProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { width, height, pageNumber } = geometry;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [stroke, setStroke] = useState<NormPoint[] | null>(null);
  const [pendingNote, setPendingNote] = useState<{ x: number; y: number } | null>(null);

  // Finger-pan session while a pen tool is armed (stylus-first routing). The
  // start point rides along so a pan that never moved can still be read as the
  // tap it was — see `handlePointerUp`.
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    viewport: HTMLElement;
  } | null>(null);
  // Tap candidate for note/stamp placement (placement happens on pointerUP so
  // a drag can still pan the score instead of dropping a mark).
  const tapRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    slop: number;
    moved: boolean;
  } | null>(null);
  // The pointer currently laying down ink, so a second finger can abandon it.
  const strokePointerRef = useRef<number | null>(null);

  const releaseStroke = useCallback((element: Element, pointerId: number) => {
    strokePointerRef.current = null;
    setStroke(null);
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  }, []);

  // Memoised because a stroke in progress re-renders this component on every
  // sampled point, and the list below is walked five more times per render.
  const pageAnnotations = useMemo(
    () =>
      annotations.filter(
        (a) => a.page_number === pageNumber && visibleLayers[layerOf(a)],
      ),
    [annotations, pageNumber, visibleLayers],
  );

  const toNorm = useCallback((clientX: number, clientY: number): NormPoint => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return [0, 0];
    return [
      clamp01((clientX - rect.left) / rect.width),
      clamp01((clientY - rect.top) / rect.height),
    ];
  }, []);

  const drawing = canEdit && (tool === "pen" || tool === "highlighter");
  const placing = canEdit && tool === "note";
  const stamping = canEdit && tool === "stamp";
  const erasing = canEdit && tool === "eraser";
  const browsing = tool === "pointer";
  const surfaceInteractive = drawing || placing || stamping;
  /**
   * Modes in which an EXISTING mark answers to a touch — tap to open, drag to
   * move. The note tool belongs here: with the pencil for words in hand, a tap
   * on a note you just wrote plainly means "fix that one", and dropping a
   * second note on top of the first is never what was asked for.
   */
  const arranging = browsing || placing || stamping;
  const marksInteractive = arranging || erasing;
  /**
   * Modes in which a STROKE answers to a touch. Narrower than `arranging` on
   * purpose: a stroke has no anchor of its own, so while a placement tool is
   * armed a tap on one can only mean "put a mark here" — and writing a word over
   * a highlighted bar is the commonest gesture there is.
   */
  const strokesInteractive = browsing || erasing;

  // Words this writer would otherwise type again tonight: their own short notes
  // on this edition (newest first), then the standing presets. The history is
  // derived from marks already in memory — no request, and it narrows itself to
  // the music in hand.
  const quickPhrases = useMemo(() => {
    const presets = QUICK_PHRASES.map((phrase) => t(phrase.key, phrase.fallback));
    const own = annotations
      .filter(isComment)
      .filter((a) => canModify(a))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((a) => a.payload.text);
    return [...pickRecentPhrases(own, presets), ...presets];
  }, [annotations, canModify, t]);

  // The note whose composer is open. It is taken OFF the page while it is being
  // written, because the card draws the same note live at the same anchor — two
  // copies of one comment on one spot is the reader seeing double.
  const editingNote =
    canEdit && arranging && !pendingNote
      ? pageAnnotations.find(
          (a) => a.id === selectedId && isComment(a) && canModify(a),
        )
      : undefined;

  // The mark whose action card is open. Notes are excluded because a selected
  // note opens the composer above, which carries the same audience row — one
  // mark never gets two cards.
  const actionMark =
    canEdit && arranging && !pendingNote
      ? pageAnnotations.find(
          (a) => a.id === selectedId && !isComment(a) && canModify(a),
        )
      : undefined;

  /**
   * Move one mark to another audience, after it was made.
   *
   * The conductor rarely knows a fortnight ahead who will take an evening, so
   * the cues a stand-in needs are usually already on his private layer by the
   * time somebody is asked. Without this the first delegation means redrawing
   * the page; with it, it means a tap per cue.
   *
   * Per mark and never in bulk: the private layer is where he writes about the
   * singers, and "move everything" would be the one gesture that hands those
   * remarks to one of them.
   */
  const moveMarkLayer = (a: ScoreAnnotation, next: WriteLayer): void => {
    onUpdate(a.id, { layer_name: next }, { layer_name: a.layer_name });
  };

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (drawing) {
        // A second pointer means a pinch is starting, not a line: drop the
        // stroke so the viewer's zoom gesture takes the page cleanly.
        const active = strokePointerRef.current;
        if (active !== null && active !== event.pointerId) {
          releaseStroke(event.currentTarget, active);
          return;
        }
        if (event.pointerType === "touch" && !fingerDraw) {
          // Palm rejection: the finger pans (manually scrolling the viewer
          // viewport, since touch-action is "none" here) — only the stylus draws.
          const viewport =
            surfaceRef.current?.closest<HTMLElement>("[data-pdf-viewport]");
          if (viewport) {
            event.currentTarget.setPointerCapture(event.pointerId);
            panRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              lastX: event.clientX,
              lastY: event.clientY,
              viewport,
            };
          }
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        strokePointerRef.current = event.pointerId;
        setStroke([toNorm(event.clientX, event.clientY)]);
      } else if (placing || stamping) {
        // A press that started on an existing mark belongs to that mark.
        if ((event.target as Element | null)?.closest?.(`[${MARK_ATTR}]`)) return;
        tapRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          slop: slopFor(event.pointerType),
          moved: false,
        };
      }
    },
    [drawing, fingerDraw, placing, releaseStroke, stamping, toNorm],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pan = panRef.current;
      if (pan && pan.pointerId === event.pointerId) {
        pan.viewport.scrollLeft -= event.clientX - pan.lastX;
        pan.viewport.scrollTop -= event.clientY - pan.lastY;
        pan.lastX = event.clientX;
        pan.lastY = event.clientY;
        return;
      }
      const tap = tapRef.current;
      if (tap && tap.pointerId === event.pointerId) {
        if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > tap.slop) {
          tap.moved = true;
        }
        return;
      }
      if (!drawing || !stroke) return;
      if (strokePointerRef.current !== event.pointerId) return;
      const next = toNorm(event.clientX, event.clientY);
      const last = stroke[stroke.length - 1];
      // Skip sub-threshold jitter to keep payloads lean.
      if (Math.hypot(next[0] - last[0], next[1] - last[1]) < 0.0025) return;
      setStroke([...stroke, next]);
    },
    [drawing, stroke, toNorm],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pan = panRef.current;
      if (pan && pan.pointerId === event.pointerId) {
        panRef.current = null;
        // A finger that pressed and lifted without travelling did not pan — it
        // tapped. In the edge zones that is the score's page turn, which this
        // surface would otherwise swallow whole (it is gesture-exempt, so the
        // viewer never sees the touch), leaving a reader with the pencil in
        // hand stranded on one page.
        const travelled = Math.hypot(
          event.clientX - pan.startX,
          event.clientY - pan.startY,
        );
        if (travelled <= TOUCH_SLOP_PX) {
          const rect = pan.viewport.getBoundingClientRect();
          const relX = (event.clientX - rect.left) / Math.max(rect.width, 1);
          if (relX <= PDF_TAP_ZONE_FRACTION) onTurnPage(-1);
          else if (relX >= 1 - PDF_TAP_ZONE_FRACTION) onTurnPage(1);
        }
        return;
      }
      const tap = tapRef.current;
      if (tap && tap.pointerId === event.pointerId) {
        tapRef.current = null;
        if (!tap.moved) {
          // An open composer (or a selected mark) owns the next tap on the
          // page: it closes, nothing is placed. Placing on that same tap would
          // drop a mark under the card the writer was still using.
          if (pendingNote || selectedId) {
            setPendingNote(null);
            onSelect(null);
            return;
          }
          const [x, y] = toNorm(event.clientX, event.clientY);
          if (stamping) {
            onCreate({
              page_number: pageNumber,
              annotation_type: "ST",
              payload: { x, y, symbol: stamp, scale: stampScale },
              color,
              layer_name: layer,
            });
          } else if (placing) {
            onSelect(null);
            setPendingNote({ x, y });
          }
        }
        return;
      }
      if (!drawing || !stroke) return;
      if (strokePointerRef.current !== event.pointerId) return;
      strokePointerRef.current = null;
      if (stroke.length > 1) {
        const isHl = tool === "highlighter";
        onCreate({
          page_number: pageNumber,
          annotation_type: isHl ? "HL" : "FH",
          payload: {
            paths: [stroke],
            width: strokeFraction(isHl ? "highlighter" : "pen", size),
          },
          color,
          layer_name: layer,
        });
      }
      setStroke(null);
    },
    [drawing, stroke, tool, size, stamping, placing, pendingNote, selectedId, stamp, stampScale, onCreate, onSelect, onTurnPage, pageNumber, color, layer, toNorm],
  );

  const handlePointerCancel = useCallback(() => {
    panRef.current = null;
    tapRef.current = null;
    strokePointerRef.current = null;
    setStroke(null);
  }, []);

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // A note/stamp tap candidate that slides off the page is CANCELLED, not
    // dropped at the edge (which is what routing this to pointerUp did). End a
    // stray finger-pan too. A drawing stroke uses pointer capture, so
    // pointerleave never fires mid-stroke — its commit is left untouched.
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      panRef.current = null;
      return;
    }
    const tap = tapRef.current;
    if (tap && tap.pointerId === event.pointerId) {
      tapRef.current = null;
    }
  }, []);

  // --- Reposition an existing stamp / note (browse mode, own marks only) -----
  // A press within TAP_SLOP_PX stays a tap (select / open the note editor, run
  // by the marker's own click); a larger move drags it. The live offset is a
  // transform only (no mutation); on release it becomes normalized coords and
  // feeds the same before/after onUpdate that powers undo/redo.
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    slop: number;
    payload: StampPayload | CommentPayload;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ id: string; dx: number; dy: number } | null>(null);
  // Set when a drag crosses the slop, so the click that follows pointerup is
  // swallowed instead of also toggling selection.
  const suppressClickRef = useRef(false);

  const beginMarkerDrag = useCallback(
    (
      event: React.PointerEvent<HTMLButtonElement>,
      annotation: ScoreAnnotation,
      payload: StampPayload | CommentPayload,
    ) => {
      // Reset on every marker press (incl. read-only ones) so a stale suppress
      // from an earlier drag can never swallow the next tap.
      suppressClickRef.current = false;
      if (!arranging || !canModify(annotation) || event.button > 0) return;
      event.stopPropagation();
      dragRef.current = {
        id: annotation.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        slop: slopFor(event.pointerType),
        payload,
      };
      setDragOffset({ id: annotation.id, dx: 0, dy: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [arranging, canModify],
  );

  const moveMarkerDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > drag.slop) suppressClickRef.current = true;
    setDragOffset({ id: drag.id, dx, dy });
  }, []);

  const endMarkerDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDragOffset(null);
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) <= drag.slop) return; // a tap — leave it to the click
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const x = clamp01(drag.payload.x + dx / rect.width);
      const y = clamp01(drag.payload.y + dy / rect.height);
      onUpdate(
        drag.id,
        { payload: { ...drag.payload, x, y } },
        { payload: { ...drag.payload } },
      );
    },
    [onUpdate],
  );

  const cancelMarkerDrag = useCallback(() => {
    suppressClickRef.current = false;
    dragRef.current = null;
    setDragOffset(null);
  }, []);

  const consumeSuppressedClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  const livePreviewWidth = drawing
    ? strokeFraction(tool === "highlighter" ? "highlighter" : "pen", size) * width
    : 0;

  /** A tap on any existing mark: rub it out, or open the card about it. */
  const handleMarkActivate = (a: ScoreAnnotation) => {
    if (erasing) {
      if (canModify(a)) onDelete(a.id);
      return;
    }
    onSelect(selectedId === a.id ? null : a.id);
  };

  const renderStroke = (a: ScoreAnnotation & { payload: { paths: NormPoint[][]; width: number } }) => {
    const highlight = a.annotation_type === "HL";
    const d = a.payload.paths.map((p) => buildSmoothPath(p, width, height)).join(" ");
    const strokeWidthPx = Math.max(highlight ? 4 : 1.5, a.payload.width * width);
    // The hit band is offered only on marks this reader may act on, which is
    // also what bounds its cost: a chorister reading the conductor's highlight
    // over the lyrics keeps full text selection under it.
    const touchable = strokesInteractive && canModify(a);
    return (
      <g key={a.id}>
        <path
          d={d}
          fill="none"
          stroke={a.color}
          strokeWidth={strokeWidthPx}
          strokeLinecap={highlight ? "butt" : "round"}
          strokeLinejoin="round"
          style={{
            opacity: highlight ? HIGHLIGHT_OPACITY : 1,
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
            strokeWidth={Math.min(
              STROKE_HIT_MAX_WIDTH,
              Math.max(strokeWidthPx, STROKE_HIT_MIN_WIDTH),
            )}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "stroke", cursor: "pointer" }}
            // Selection rides the CLICK: a touch that scrolled the viewport has
            // its click suppressed by the browser, so panning over ink is still
            // panning. Erasing stays on the press, where rubbing belongs.
            onClick={() => handleMarkActivate(a)}
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
              onDelete(a.id);
            }}
            // Rubbing out a scribble is one gesture, not one tap per line.
            onPointerEnter={(e) => {
              if (!erasing || e.buttons === 0) return;
              onDelete(a.id);
            }}
          />
        )}
      </g>
    );
  };

  /** The wash that says "this one". Drawn over the finished ink rather than
   *  under it: a highlighter composites with `multiply`, so a halo beneath one
   *  would be multiplied INTO the marker and read as a mark of its own. */
  const renderSelectionHalo = (
    a: ScoreAnnotation & { payload: { paths: NormPoint[][]; width: number } },
  ) => {
    const highlight = a.annotation_type === "HL";
    const d = a.payload.paths.map((p) => buildSmoothPath(p, width, height)).join(" ");
    const strokeWidthPx = Math.max(highlight ? 4 : 1.5, a.payload.width * width);
    return (
      <path
        key={`halo-${a.id}`}
        className="stroke-ethereal-gold"
        d={d}
        fill="none"
        strokeWidth={strokeWidthPx + SELECTION_HALO_PX * 2}
        strokeOpacity={0.45}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ mixBlendMode: "normal", pointerEvents: "none" }}
      />
    );
  };

  return (
    // Drawing capture lives on this HTML div (not the SVG): an <svg> with
    // pointer-events:auto only fires on PAINTED areas, so pointerdown on the
    // blank score never started a stroke. The div captures the whole page box.
    <div
      ref={surfaceRef}
      className={cn(
        "absolute inset-0",
        drawing && "cursor-crosshair",
        (placing || stamping) && "cursor-copy",
      )}
      style={{
        width,
        height,
        pointerEvents: surfaceInteractive ? "auto" : "none",
        // Pen tools own every touch (finger pan is re-implemented manually);
        // tap-to-place tools leave panning to the browser.
        touchAction: drawing ? "none" : surfaceInteractive ? "pan-x pan-y" : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0"
        // Never a hit target itself. `pointer-events: none` on an ancestor does
        // NOT stop a descendant that switches them back on, so the hit bands
        // below opt in one at a time — the same arrangement the note markers
        // already use inside this surface. Leaving the root "auto" while an
        // eraser was armed turned the whole page rectangle into a target and
        // swallowed text selection across all of it.
        style={{ pointerEvents: "none" }}
      >
        {/* Highlighter first (under the ink), then opaque pen strokes. */}
        {pageAnnotations.filter(isHighlight).map(renderStroke)}
        {pageAnnotations.filter(isFreehand).map(renderStroke)}

        {/* Selection last of all, so it washes over finished ink. */}
        {selectedId !== null &&
          pageAnnotations
            .filter((a) => a.id === selectedId)
            .filter(isStrokeMark)
            .map(renderSelectionHalo)}

        {stroke && stroke.length > 1 && (
          <path
            d={buildSmoothPath(stroke, width, height)}
            fill="none"
            stroke={color}
            strokeWidth={Math.max(tool === "highlighter" ? 4 : 1.5, livePreviewWidth)}
            strokeLinecap={tool === "highlighter" ? "butt" : "round"}
            strokeLinejoin="round"
            style={{
              pointerEvents: "none",
              opacity: tool === "highlighter" ? HIGHLIGHT_OPACITY : 0.85,
              mixBlendMode: tool === "highlighter" ? "multiply" : "normal",
            }}
          />
        )}
      </svg>

      {/* Musical stamps — pure display until the eraser targets an erasable one,
          or browse mode lets the owner drag it. */}
      {pageAnnotations.filter(isStamp).map((a) => {
        const payload = a.payload as StampPayload;
        const def = getStampDef(payload.symbol);
        if (!def) return null;
        const erasable = erasing && canModify(a);
        const modifiable = canModify(a);
        const draggable = arranging && modifiable;
        const offset = dragOffset?.id === a.id ? dragOffset : null;
        const selected = selectedId === a.id;
        return (
          <div
            key={a.id}
            data-annotation-mark
            className="absolute"
            style={{
              left: payload.x * width,
              top: payload.y * height,
              transform: offset
                ? `translate(-50%, -50%) translate(${offset.dx}px, ${offset.dy}px)`
                : "translate(-50%, -50%)",
              pointerEvents: marksInteractive && modifiable ? "auto" : "none",
            }}
          >
            <button
              type="button"
              // The viewer's pinch gate stops at the nearest button and reads
              // this attribute there; without it, two fingers landing on a
              // symbol cannot zoom the score.
              data-pdf-pinch-through
              onClick={() => {
                if (consumeSuppressedClick()) return;
                handleMarkActivate(a);
              }}
              onPointerDown={(event) => beginMarkerDrag(event, a, payload)}
              onPointerMove={moveMarkerDrag}
              onPointerUp={endMarkerDrag}
              onPointerCancel={cancelMarkerDrag}
              aria-label={t(def.labelKey, def.fallback)}
              aria-pressed={selected}
              tabIndex={marksInteractive && modifiable ? 0 : -1}
              className={cn(
                "flex items-center justify-center rounded-md transition-shadow",
                selected && "bg-ethereal-gold/15 ring-2 ring-ethereal-gold",
                erasable && !selected &&
                  "cursor-pointer ring-1 ring-transparent hover:ring-ethereal-crimson",
                draggable && "touch-none",
              )}
              style={draggable ? { cursor: offset ? "grabbing" : "grab" } : undefined}
            >
              <StampGlyph
                symbol={payload.symbol}
                color={a.color}
                size={def.sizeFraction * width * clampMarkScale(payload.scale)}
              />
            </button>
          </div>
        );
      })}

      {/* Notes: inline text drawn on the page, or clickable pins. */}
      {pageAnnotations.filter(isComment).map((a) => {
        if (a.id === editingNote?.id) return null;
        const payload = a.payload as CommentPayload;
        const inline = payload.display === "inline";
        const isPrivate = isPrivateLayer(a);
        const modifiable = canModify(a);
        const draggable = arranging && modifiable;
        const offset = dragOffset?.id === a.id ? dragOffset : null;
        const left = payload.x * width;
        const top = payload.y * height;
        // Tap selects / opens the editor; a drag repositions the note and its
        // trailing click is swallowed so it doesn't also toggle selection.
        const onMarkerClick = () => {
          if (consumeSuppressedClick()) return;
          handleMarkActivate(a);
        };
        const dragHandlers = {
          // Same pinch gate as the stamps: the attribute has to sit on the
          // button, because that is where `closest()` stops looking.
          "data-pdf-pinch-through": true,
          onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) =>
            beginMarkerDrag(event, a, payload),
          onPointerMove: moveMarkerDrag,
          onPointerUp: endMarkerDrag,
          onPointerCancel: cancelMarkerDrag,
        };
        return (
          <div
            key={a.id}
            data-annotation-mark
            className="absolute"
            style={{
              left,
              top,
              transform: offset
                ? `translate(-50%, -50%) translate(${offset.dx}px, ${offset.dy}px)`
                : "translate(-50%, -50%)",
              pointerEvents: marksInteractive ? "auto" : "none",
              maxWidth: inline ? width * 0.5 : undefined,
            }}
          >
            {inline ? (
              <button
                type="button"
                onClick={onMarkerClick}
                {...dragHandlers}
                aria-label={payload.text}
                aria-pressed={selectedId === a.id}
                className={cn(
                  "relative rounded-md px-1.5 py-0.5 text-center font-semibold leading-snug shadow-sm ring-1 transition-shadow",
                  // The ring colour is named, never left to default: this
                  // button sets `color` to the note's own ink below, and
                  // Tailwind's default ring is `currentColor` — so an unnamed
                  // ring would outline the mark in its own colour.
                  selectedId === a.id ? "ring-2 ring-ethereal-gold" : "ring-black/10",
                  erasing && modifiable && "cursor-pointer hover:ring-ethereal-crimson",
                  draggable && "touch-none",
                )}
                style={{
                  color: a.color,
                  backgroundColor: "rgba(255,255,255,0.82)",
                  fontSize: inlineFontSize(width) * clampMarkScale(payload.scale),
                  cursor: draggable
                    ? offset
                      ? "grabbing"
                      : "grab"
                    : erasing
                      ? modifiable
                        ? "pointer"
                        : "default"
                      : arranging
                        ? "text"
                        : "default",
                }}
              >
                {payload.text}
                {isPrivate && (
                  <Lock
                    size={9}
                    // The badge sits ON the mark, which sits on paper — and the
                    // page is white in both themes. Its glyph therefore holds
                    // its darkness instead of riding the ladder.
                    className="absolute -right-1 -top-1 rounded-full bg-white p-px text-surface-inverse/70 shadow"
                    aria-hidden="true"
                  />
                )}
              </button>
            ) : (
              <button
                type="button"
                aria-label={payload.text}
                aria-pressed={selectedId === a.id}
                onClick={onMarkerClick}
                {...dragHandlers}
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md ring-2 transition-transform hover:scale-110",
                  // Gold is the panel's "this is the one", and the pin's
                  // resting rim is a light hairline against the page — the two
                  // have to differ in HUE, because a difference in opacity
                  // alone is a selection state nobody can see.
                  selectedId === a.id ? "ring-ethereal-gold" : "ring-white/80",
                  draggable && "touch-none",
                )}
                style={{
                  backgroundColor: a.color,
                  cursor: draggable ? (offset ? "grabbing" : "grab") : undefined,
                }}
              >
                <Pin size={14} aria-hidden="true" />
                {isPrivate && (
                  <Lock
                    size={9}
                    // The badge sits ON the mark, which sits on paper — and the
                    // page is white in both themes. Its glyph therefore holds
                    // its darkness instead of riding the ladder.
                    className="absolute -right-1 -top-1 rounded-full bg-white p-px text-surface-inverse/70 shadow"
                    aria-hidden="true"
                  />
                )}
              </button>
            )}

            {/* Read-only preview popover for pin notes the user can't edit. */}
            {!modifiable && selectedId === a.id && !inline && (
              <div className="absolute left-1/2 top-9 z-10 w-48 -translate-x-1/2 rounded-nested border border-hairline-strong bg-ethereal-marble p-3 text-xs leading-relaxed text-ethereal-ink shadow-glass-ethereal">
                {payload.text}
              </div>
            )}
          </div>
        );
      })}

      {/* Pending new-note composer. */}
      {pendingNote && canEdit && (
        <NoteCard
          width={width}
          height={height}
          anchor={pendingNote}
          color={color}
          phrases={quickPhrases}
          initialText=""
          initialDisplay={noteDisplay}
          initialScale={textScale}
          showDelete={false}
          // A note that does not exist yet takes its reach from the toolbar's
          // write pill; asking again here would be asking twice in one gesture.
          audience={null}
          onSubmit={(text, display, scale) => {
            onCreate({
              page_number: pageNumber,
              annotation_type: "CM",
              payload: { x: pendingNote.x, y: pendingNote.y, text, display, scale },
              color,
              layer_name: layer,
            });
            setPendingNote(null);
          }}
          onCancel={() => setPendingNote(null)}
        />
      )}

      {/* Edit composer for a selected note the user is allowed to modify. */}
      {editingNote &&
        (() => {
          const payload = editingNote.payload as CommentPayload;
          return (
            <NoteCard
              // Selecting another note while this one is open must hand the
              // card a fresh draft, not the previous note's words.
              key={editingNote.id}
              width={width}
              height={height}
              anchor={{ x: payload.x, y: payload.y }}
              color={editingNote.color}
              phrases={quickPhrases}
              initialText={payload.text}
              initialDisplay={payload.display === "inline" ? "inline" : "pin"}
              initialScale={clampMarkScale(payload.scale)}
              showDelete
              audience={{
                current: layerOf(editingNote),
                options: audiences,
                onChange: (next) => moveMarkLayer(editingNote, next),
              }}
              onSubmit={(text, display, scale) => {
                onUpdate(
                  editingNote.id,
                  { payload: { x: payload.x, y: payload.y, text, display, scale } },
                  { payload },
                );
                onSelect(null);
              }}
              onDelete={() => {
                onDelete(editingNote.id);
                onSelect(null);
              }}
              onCancel={() => onSelect(null)}
            />
          );
        })()}

      {/* Ink, highlight or symbol: the same conversation, in its own card —
          a note is already having it inside its composer above. */}
      {actionMark && (
        <MarkActionCard
          key={actionMark.id}
          annotation={actionMark}
          width={width}
          height={height}
          inks={inks}
          audiences={audiences}
          onChangeLayer={(next) => moveMarkLayer(actionMark, next)}
          onChangeColor={(next) =>
            onUpdate(actionMark.id, { color: next }, { color: actionMark.color })
          }
          onChangeScale={(next) => {
            if (!isStamp(actionMark)) return;
            const current = actionMark.payload as StampPayload;
            onUpdate(
              actionMark.id,
              { payload: { ...current, scale: next } },
              { payload: { ...current } },
            );
          }}
          onDelete={() => {
            onDelete(actionMark.id);
            onSelect(null);
          }}
          onClose={() => onSelect(null)}
        />
      )}
    </div>
  );
};
