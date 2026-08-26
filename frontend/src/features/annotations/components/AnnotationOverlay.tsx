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
 * @module features/annotations/components
 */

import React, { useCallback, useRef, useState } from "react";
import { Lock, MessageSquare, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import {
  FIELD_TEXT_SCALE,
  fieldShellVariants,
} from "@/shared/ui/primitives/fieldShell";
import type { PdfPageGeometry } from "@/shared/ui/composites/PdfViewer";

import {
  isComment,
  isFreehand,
  isHighlight,
  isStamp,
  type AnnotationLayer,
  type AnnotationPatch,
  type CommentPayload,
  type NewAnnotation,
  type NoteDisplay,
  type NormPoint,
  type ScoreAnnotation,
  type StampPayload,
} from "../types/annotations.dto";
import {
  clampMarkScale,
  MARK_SCALE_MAX,
  MARK_SCALE_MIN,
  MARK_SCALE_STEP,
  strokeFraction,
  type AnnotationTool,
  type LayerVisibility,
  type StrokeSize,
} from "../lib/useAnnotationTools";
import { getStampDef, StampGlyph } from "../lib/stamps";
import { buildSmoothPath } from "../lib/smoothing";

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
  canEdit: boolean;
  /** May THIS user erase / edit the given mark? (chorister → personal only). */
  canModify: (annotation: ScoreAnnotation) => boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (annotation: Omit<NewAnnotation, "edition">) => void;
  onUpdate: (id: string, after: AnnotationPatch, before: AnnotationPatch) => void;
  onDelete: (id: string) => void;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const HIGHLIGHT_OPACITY = 0.42;
const ERASER_HIT_WIDTH = 16;
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

const inlineFontSize = (pageWidth: number): number =>
  Math.min(22, Math.max(11, pageWidth * 0.026));

const layerOf = (a: ScoreAnnotation): AnnotationLayer =>
  a.layer_name === "conductor"
    ? "conductor"
    : a.layer_name === "personal"
      ? "personal"
      : "shared";

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
  canEdit,
  canModify,
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

  // Finger-pan session while a pen tool is armed (stylus-first routing).
  const panRef = useRef<{
    pointerId: number;
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

  const pageAnnotations = annotations.filter(
    (a) => a.page_number === pageNumber && visibleLayers[layerOf(a)],
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
    [drawing, stroke, tool, size, stamping, placing, pendingNote, selectedId, stamp, stampScale, onCreate, onSelect, pageNumber, color, layer, toNorm],
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

  const renderStroke = (a: ScoreAnnotation & { payload: { paths: NormPoint[][]; width: number } }) => {
    const highlight = a.annotation_type === "HL";
    const d = a.payload.paths.map((p) => buildSmoothPath(p, width, height)).join(" ");
    const strokeWidthPx = Math.max(highlight ? 4 : 1.5, a.payload.width * width);
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
        {erasing && canModify(a) && (
          // Fat invisible hit path so a thin line is still easy to erase.
          <path
            d={d}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(strokeWidthPx, ERASER_HIT_WIDTH)}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "stroke", cursor: "pointer" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onDelete(a.id);
            }}
          />
        )}
      </g>
    );
  };

  const handleNoteClick = (a: ScoreAnnotation) => {
    if (erasing) {
      if (canModify(a)) onDelete(a.id);
      return;
    }
    if (arranging) onSelect(selectedId === a.id ? null : a.id);
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
        // Painted (auto) only while erasing so the fat hit paths below are
        // clickable; display-only otherwise so page text stays selectable.
        style={{ pointerEvents: erasing ? "auto" : "none" }}
      >
        {/* Highlighter first (under the ink), then opaque pen strokes. */}
        {pageAnnotations.filter(isHighlight).map(renderStroke)}
        {pageAnnotations.filter(isFreehand).map(renderStroke)}

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
        const draggable = arranging && canModify(a);
        const offset = dragOffset?.id === a.id ? dragOffset : null;
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
              pointerEvents: erasable || draggable ? "auto" : "none",
            }}
          >
            <button
              type="button"
              onClick={() => erasable && onDelete(a.id)}
              onPointerDown={(event) => beginMarkerDrag(event, a, payload)}
              onPointerMove={moveMarkerDrag}
              onPointerUp={endMarkerDrag}
              onPointerCancel={cancelMarkerDrag}
              aria-label={t(def.labelKey, def.fallback)}
              tabIndex={erasable ? 0 : -1}
              className={cn(
                "flex items-center justify-center rounded-md",
                erasable &&
                  "cursor-pointer ring-1 ring-transparent transition-shadow hover:ring-ethereal-crimson",
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
        const payload = a.payload as CommentPayload;
        const inline = payload.display === "inline";
        const isPrivate = layerOf(a) !== "shared";
        const modifiable = canModify(a);
        const draggable = arranging && modifiable;
        const offset = dragOffset?.id === a.id ? dragOffset : null;
        const left = payload.x * width;
        const top = payload.y * height;
        // Tap selects / opens the editor; a drag repositions the note and its
        // trailing click is swallowed so it doesn't also toggle selection.
        const onMarkerClick = () => {
          if (consumeSuppressedClick()) return;
          handleNoteClick(a);
        };
        const dragHandlers = {
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
                className={cn(
                  "relative rounded-md px-1.5 py-0.5 text-center font-semibold leading-snug shadow-sm ring-1 transition-shadow",
                  selectedId === a.id ? "ring-2" : "ring-black/10",
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
                    className="absolute -right-1 -top-1 rounded-full bg-white p-px text-ethereal-graphite shadow"
                    aria-hidden="true"
                  />
                )}
              </button>
            ) : (
              <button
                type="button"
                aria-label={payload.text}
                onClick={onMarkerClick}
                {...dragHandlers}
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md ring-2 transition-transform hover:scale-110",
                  selectedId === a.id ? "ring-white" : "ring-white/80",
                  draggable && "touch-none",
                )}
                style={{
                  backgroundColor: a.color,
                  cursor: draggable ? (offset ? "grabbing" : "grab") : undefined,
                }}
              >
                <MessageSquare size={14} aria-hidden="true" />
                {isPrivate && (
                  <Lock
                    size={9}
                    className="absolute -right-1 -top-1 rounded-full bg-white p-px text-ethereal-graphite shadow"
                    aria-hidden="true"
                  />
                )}
              </button>
            )}

            {/* Read-only preview popover for pin notes the user can't edit. */}
            {!modifiable && selectedId === a.id && !inline && (
              <div className="absolute left-1/2 top-9 z-10 w-48 -translate-x-1/2 rounded-nested border border-hairline-strong bg-white p-3 text-xs leading-relaxed text-ethereal-ink shadow-glass-ethereal">
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
          initialText=""
          initialDisplay={noteDisplay}
          initialScale={textScale}
          showDelete={false}
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
      {canEdit && arranging && !pendingNote &&
        (() => {
          const selected = pageAnnotations.find(
            (a) => a.id === selectedId && isComment(a) && canModify(a),
          );
          if (!selected) return null;
          const payload = selected.payload as CommentPayload;
          return (
            <NoteCard
              width={width}
              height={height}
              anchor={{ x: payload.x, y: payload.y }}
              initialText={payload.text}
              initialDisplay={payload.display === "inline" ? "inline" : "pin"}
              initialScale={clampMarkScale(payload.scale)}
              showDelete
              onSubmit={(text, display, scale) => {
                onUpdate(
                  selected.id,
                  { payload: { x: payload.x, y: payload.y, text, display, scale } },
                  { payload },
                );
                onSelect(null);
              }}
              onDelete={() => {
                onDelete(selected.id);
                onSelect(null);
              }}
              onCancel={() => onSelect(null)}
            />
          );
        })()}
    </div>
  );
};

interface NoteCardProps {
  width: number;
  height: number;
  anchor: { x: number; y: number };
  initialText: string;
  initialDisplay: NoteDisplay;
  /** Starting font-size multiplier (1 = medium). */
  initialScale: number;
  showDelete: boolean;
  onSubmit: (text: string, display: NoteDisplay, scale: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const NoteCard = ({
  width,
  height,
  anchor,
  initialText,
  initialDisplay,
  initialScale,
  showDelete,
  onSubmit,
  onCancel,
  onDelete,
}: NoteCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const [display, setDisplay] = useState<NoteDisplay>(initialDisplay);
  const [scale, setScale] = useState<number>(() => clampMarkScale(initialScale));

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed) onSubmit(trimmed, display, scale);
  };

  return (
    <div
      className="absolute z-20 w-60 -translate-x-1/2 rounded-nested border border-hairline-strong bg-white p-2.5 shadow-glass-ethereal"
      style={{
        // The 240px-wide card (±120 half) can't be kept inside a narrower page
        // — the min/max bounds cross and shove it off-screen — so just centre it
        // there. Same guard on the vertical clamp for short pages.
        left:
          width <= 240
            ? width / 2
            : Math.min(Math.max(anchor.x * width, 120), width - 120),
        top: Math.max(8, Math.min(anchor.y * height + 16, height - 150)),
        pointerEvents: "auto",
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <textarea
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape") onCancel();
        }}
        rows={2}
        className={cn(
          fieldShellVariants({ variant: "solid" }),
          "resize-none p-2",
          FIELD_TEXT_SCALE.xs,
        )}
        placeholder={t("annotations.comment_placeholder", "Note for this spot…")}
      />

      {/* Inline vs pin display picker. */}
      <div className="mt-2 flex items-center gap-1">
        {(["inline", "pin"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setDisplay(mode)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              display === mode
                ? "bg-ethereal-ink text-white"
                : "bg-ethereal-marble/60 text-ethereal-graphite hover:bg-ethereal-marble",
            )}
          >
            {mode === "inline"
              ? t("annotations.note.inline", "Na nucie")
              : t("annotations.note.pin", "Pinezka")}
          </button>
        ))}
      </div>

      {/* Text size — only meaningful for on-score (inline) text. The sample
          above the slider is drawn at the size the mark will actually have on
          this page, so the choice is made by eye and not by trying four
          presets against a stave. */}
      {display === "inline" && (
        <div className="mt-2">
          <div className="flex h-9 items-center justify-center overflow-hidden rounded-md bg-ethereal-marble/40 px-2">
            <span
              aria-hidden="true"
              className="truncate font-semibold leading-none text-ethereal-ink"
              style={{ fontSize: inlineFontSize(width) * scale }}
            >
              {text.trim() || "Aa"}
            </span>
          </div>
          <input
            type="range"
            min={MARK_SCALE_MIN}
            max={MARK_SCALE_MAX}
            step={MARK_SCALE_STEP}
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
            aria-label={t("annotations.scale.text", "Rozmiar tekstu")}
            className="mt-1.5 w-full accent-ethereal-ink"
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {showDelete && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1 text-ethereal-graphite hover:text-ethereal-crimson"
            aria-label={t("annotations.note.delete", "Usuń notatkę")}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-ethereal-ink/50 hover:text-ethereal-ink"
            aria-label={t("common.actions.cancel", "Anuluj")}
          >
            <X size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            className="rounded-md bg-ethereal-ink px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            {t("common.ok", "OK")}
          </button>
        </div>
      </div>
    </div>
  );
};
