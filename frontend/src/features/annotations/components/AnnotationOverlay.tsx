/**
 * @file AnnotationOverlay.tsx
 * @description The drawing surface stacked over a single rendered PDF page.
 * Renders highlighter + ink strokes, inline text and pinned notes and — when
 * editing is allowed — captures pen / highlighter / note / eraser input and
 * inline note editing. All coordinates are normalized (0..1) to the page box so
 * a marking holds its musical position across zoom and devices.
 * @module features/annotations/components
 */

import React, { useCallback, useRef, useState } from "react";
import { Lock, MessageSquare, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import type { PdfPageGeometry } from "@/shared/ui/composites/PdfViewer";

import {
  isComment,
  isFreehand,
  isHighlight,
  type AnnotationPatch,
  type CommentPayload,
  type NewAnnotation,
  type NoteDisplay,
  type NormPoint,
  type ScoreAnnotation,
} from "../types/annotations.dto";
import {
  strokeFraction,
  type AnnotationTool,
  type LayerVisibility,
  type StrokeSize,
} from "../lib/useAnnotationTools";
import { buildSmoothPath } from "../lib/smoothing";

interface AnnotationOverlayProps {
  geometry: PdfPageGeometry;
  annotations: ScoreAnnotation[];
  visibleLayers: LayerVisibility;
  tool: AnnotationTool;
  color: string;
  size: StrokeSize;
  noteDisplay: NoteDisplay;
  layer: "shared" | "conductor";
  canEdit: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (annotation: Omit<NewAnnotation, "edition">) => void;
  onUpdate: (id: string, after: AnnotationPatch, before: AnnotationPatch) => void;
  onDelete: (id: string) => void;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const HIGHLIGHT_OPACITY = 0.42;
const ERASER_HIT_WIDTH = 16;

const inlineFontSize = (pageWidth: number): number =>
  Math.min(22, Math.max(11, pageWidth * 0.026));

export const AnnotationOverlay = ({
  geometry,
  annotations,
  visibleLayers,
  tool,
  color,
  size,
  noteDisplay,
  layer,
  canEdit,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
}: AnnotationOverlayProps): React.JSX.Element => {
  const { width, height, pageNumber } = geometry;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [stroke, setStroke] = useState<NormPoint[] | null>(null);
  const [pendingNote, setPendingNote] = useState<{ x: number; y: number } | null>(null);

  const pageAnnotations = annotations.filter(
    (a) =>
      a.page_number === pageNumber &&
      visibleLayers[a.layer_name === "conductor" ? "conductor" : "shared"],
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
  const erasing = canEdit && tool === "eraser";
  const browsing = tool === "pointer";
  const surfaceInteractive = drawing || placing;
  const marksInteractive = browsing || erasing;

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (drawing) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setStroke([toNorm(event.clientX, event.clientY)]);
      } else if (placing) {
        const [x, y] = toNorm(event.clientX, event.clientY);
        onSelect(null);
        setPendingNote({ x, y });
      }
    },
    [drawing, placing, toNorm, onSelect],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!drawing || !stroke) return;
      const next = toNorm(event.clientX, event.clientY);
      const last = stroke[stroke.length - 1];
      // Skip sub-threshold jitter to keep payloads lean.
      if (Math.hypot(next[0] - last[0], next[1] - last[1]) < 0.0025) return;
      setStroke([...stroke, next]);
    },
    [drawing, stroke, toNorm],
  );

  const handlePointerUp = useCallback(() => {
    if (!drawing || !stroke) return;
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
  }, [drawing, stroke, tool, size, onCreate, pageNumber, color, layer]);

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
        {erasing && (
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
      onDelete(a.id);
      return;
    }
    if (browsing) onSelect(selectedId === a.id ? null : a.id);
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
        placing && "cursor-copy",
      )}
      style={{
        width,
        height,
        pointerEvents: surfaceInteractive ? "auto" : "none",
        touchAction: surfaceInteractive ? "none" : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
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

      {/* Notes: inline text drawn on the page, or clickable pins. */}
      {pageAnnotations.filter(isComment).map((a) => {
        const payload = a.payload as CommentPayload;
        const inline = payload.display === "inline";
        const isPrivate = a.layer_name === "conductor";
        const left = payload.x * width;
        const top = payload.y * height;
        return (
          <div
            key={a.id}
            className="absolute"
            style={{
              left,
              top,
              transform: "translate(-50%, -50%)",
              pointerEvents: marksInteractive ? "auto" : "none",
              maxWidth: inline ? width * 0.5 : undefined,
            }}
          >
            {inline ? (
              <button
                type="button"
                onClick={() => handleNoteClick(a)}
                aria-label={payload.text}
                className={cn(
                  "relative rounded-md px-1.5 py-0.5 text-center font-semibold leading-snug shadow-sm ring-1 transition-shadow",
                  selectedId === a.id ? "ring-2" : "ring-black/10",
                  erasing && "cursor-pointer hover:ring-ethereal-crimson",
                )}
                style={{
                  color: a.color,
                  backgroundColor: "rgba(255,255,255,0.82)",
                  fontSize: inlineFontSize(width),
                  cursor: erasing ? "pointer" : browsing ? "text" : "default",
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
                onClick={() => handleNoteClick(a)}
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md ring-2 transition-transform hover:scale-110",
                  selectedId === a.id ? "ring-white" : "ring-white/80",
                )}
                style={{ backgroundColor: a.color }}
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

            {/* Read-only preview popover for pin notes in browse mode. */}
            {!canEdit && selectedId === a.id && !inline && (
              <div className="absolute left-1/2 top-9 z-10 w-48 -translate-x-1/2 rounded-xl border border-ethereal-ink/10 bg-white p-3 text-xs leading-relaxed text-ethereal-ink shadow-glass-ethereal">
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
          showDelete={false}
          onSubmit={(text, display) => {
            onCreate({
              page_number: pageNumber,
              annotation_type: "CM",
              payload: { x: pendingNote.x, y: pendingNote.y, text, display },
              color,
              layer_name: layer,
            });
            setPendingNote(null);
          }}
          onCancel={() => setPendingNote(null)}
        />
      )}

      {/* Edit composer for a selected note. */}
      {canEdit && browsing &&
        (() => {
          const selected = pageAnnotations.find(
            (a) => a.id === selectedId && isComment(a),
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
              showDelete
              onSubmit={(text, display) => {
                onUpdate(
                  selected.id,
                  { payload: { x: payload.x, y: payload.y, text, display } },
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
  showDelete: boolean;
  onSubmit: (text: string, display: NoteDisplay) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const NoteCard = ({
  width,
  height,
  anchor,
  initialText,
  initialDisplay,
  showDelete,
  onSubmit,
  onCancel,
  onDelete,
}: NoteCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const [display, setDisplay] = useState<NoteDisplay>(initialDisplay);

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed) onSubmit(trimmed, display);
  };

  return (
    <div
      className="absolute z-20 w-60 -translate-x-1/2 rounded-xl border border-ethereal-ink/10 bg-white p-2.5 shadow-glass-ethereal"
      style={{
        left: Math.min(Math.max(anchor.x * width, 130), width - 130),
        top: Math.min(anchor.y * height + 16, height - 150),
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
        className="w-full resize-none rounded-lg border border-ethereal-ink/15 bg-ethereal-marble/40 p-2 text-xs text-ethereal-ink outline-none focus:border-ethereal-ink/40"
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
