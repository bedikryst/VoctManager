/**
 * @file AnnotationOverlay.tsx
 * @description The drawing surface stacked over a single rendered PDF page.
 * Renders freehand strokes + pinned comments and, when editing is allowed,
 * captures pen/comment/eraser input. All coordinates are normalized (0..1) to
 * the page box so a marking holds its musical position across zoom and devices.
 * @module features/annotations/components
 */

import React, { useCallback, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import type { PdfPageGeometry } from "@/shared/ui/composites/PdfViewer";

import {
  isComment,
  isFreehand,
  type NewAnnotation,
  type NormPoint,
  type ScoreAnnotation,
} from "../types/annotations.dto";
import {
  PEN_STROKE_FRACTION,
  type AnnotationTool,
} from "../lib/useAnnotationTools";

interface AnnotationOverlayProps {
  geometry: PdfPageGeometry;
  annotations: ScoreAnnotation[];
  tool: AnnotationTool;
  color: string;
  layer: "shared" | "conductor";
  canEdit: boolean;
  onCreate: (annotation: Omit<NewAnnotation, "edition">) => void;
  onDelete: (id: string) => void;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const buildPath = (points: NormPoint[], width: number, height: number): string =>
  points
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"} ${(x * width).toFixed(2)} ${(y * height).toFixed(2)}`,
    )
    .join(" ");

export const AnnotationOverlay = ({
  geometry,
  annotations,
  tool,
  color,
  layer,
  canEdit,
  onCreate,
  onDelete,
}: AnnotationOverlayProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { width, height, pageNumber } = geometry;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [stroke, setStroke] = useState<NormPoint[] | null>(null);
  const [pendingComment, setPendingComment] = useState<{ x: number; y: number } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);

  const pageAnnotations = annotations.filter((a) => a.page_number === pageNumber);

  const toNorm = useCallback((clientX: number, clientY: number): NormPoint => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return [0, 0];
    return [
      clamp01((clientX - rect.left) / rect.width),
      clamp01((clientY - rect.top) / rect.height),
    ];
  }, []);

  const drawing = tool === "pen";
  const placing = tool === "comment";
  const surfaceInteractive = canEdit && (drawing || placing);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!canEdit) return;
      if (drawing) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setStroke([toNorm(event.clientX, event.clientY)]);
      } else if (placing) {
        const [x, y] = toNorm(event.clientX, event.clientY);
        setPendingComment({ x, y });
        setCommentDraft("");
      }
    },
    [canEdit, drawing, placing, toNorm],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!drawing || !stroke) return;
      const next = toNorm(event.clientX, event.clientY);
      const last = stroke[stroke.length - 1];
      // Skip jitter to keep payloads lean.
      if (Math.hypot(next[0] - last[0], next[1] - last[1]) < 0.003) return;
      setStroke([...stroke, next]);
    },
    [drawing, stroke, toNorm],
  );

  const handlePointerUp = useCallback(() => {
    if (!drawing || !stroke) return;
    if (stroke.length > 1) {
      onCreate({
        page_number: pageNumber,
        annotation_type: "FH",
        payload: { paths: [stroke], width: PEN_STROKE_FRACTION },
        color,
        layer_name: layer,
      });
    }
    setStroke(null);
  }, [drawing, stroke, onCreate, pageNumber, color, layer]);

  const commitComment = useCallback(() => {
    const text = commentDraft.trim();
    if (pendingComment && text) {
      onCreate({
        page_number: pageNumber,
        annotation_type: "CM",
        payload: { x: pendingComment.x, y: pendingComment.y, text },
        color,
        layer_name: layer,
      });
    }
    setPendingComment(null);
    setCommentDraft("");
  }, [commentDraft, pendingComment, onCreate, pageNumber, color, layer]);

  const pinsInteractive = tool === "pointer" || tool === "eraser";
  const erasing = canEdit && tool === "eraser";

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
        // Display-only, except in eraser mode where individual strokes become
        // click targets (paths set pointer-events:stroke below).
        style={{ pointerEvents: erasing ? "auto" : "none" }}
      >
        {pageAnnotations.filter(isFreehand).map((a) => (
          <path
            key={a.id}
            d={a.payload.paths.map((p) => buildPath(p, width, height)).join(" ")}
            fill="none"
            stroke={a.color}
            strokeWidth={Math.max(1.5, a.payload.width * width)}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              pointerEvents: canEdit && tool === "eraser" ? "stroke" : "none",
              cursor: canEdit && tool === "eraser" ? "pointer" : "default",
            }}
            onClick={() => {
              if (canEdit && tool === "eraser") onDelete(a.id);
            }}
          />
        ))}

        {stroke && stroke.length > 1 && (
          <path
            d={buildPath(stroke, width, height)}
            fill="none"
            stroke={color}
            strokeWidth={Math.max(1.5, PEN_STROKE_FRACTION * width)}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "none", opacity: 0.85 }}
          />
        )}
      </svg>

      {/* Comment pins — HTML for crisp text + easy wrapping. */}
      {pageAnnotations.filter(isComment).map((a) => {
        const isOpen = openCommentId === a.id;
        return (
          <div
            key={a.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: a.payload.x * width,
              top: a.payload.y * height,
              pointerEvents: pinsInteractive ? "auto" : "none",
            }}
          >
            <button
              type="button"
              aria-label={a.payload.text}
              onClick={() => {
                if (canEdit && tool === "eraser") {
                  onDelete(a.id);
                  return;
                }
                setOpenCommentId(isOpen ? null : a.id);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white/80 transition-transform hover:scale-110"
              style={{ backgroundColor: a.color }}
            >
              <MessageSquare size={14} aria-hidden="true" />
            </button>
            {isOpen && (
              <div className="absolute left-1/2 top-9 z-10 w-48 -translate-x-1/2 rounded-xl border border-ethereal-ink/10 bg-white p-3 text-xs leading-relaxed text-ethereal-ink shadow-glass-ethereal">
                {a.payload.text}
              </div>
            )}
          </div>
        );
      })}

      {/* Pending comment composer. */}
      {pendingComment && canEdit && (
        <div
          className="absolute z-20 w-56 -translate-x-1/2 rounded-xl border border-ethereal-ink/10 bg-white p-2.5 shadow-glass-ethereal"
          style={{
            left: Math.min(Math.max(pendingComment.x * width, 120), width - 120),
            top: Math.min(pendingComment.y * height + 16, height - 110),
            pointerEvents: "auto",
          }}
          // Stop the capture div from reading clicks inside the composer as a
          // request to drop another pin.
          onPointerDown={(event) => event.stopPropagation()}
        >
          <textarea
            autoFocus
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                commitComment();
              }
              if (event.key === "Escape") setPendingComment(null);
            }}
            rows={3}
            className="w-full resize-none rounded-lg border border-ethereal-ink/15 bg-ethereal-marble/40 p-2 text-xs text-ethereal-ink outline-none focus:border-ethereal-ink/40"
            placeholder={t("annotations.comment_placeholder", "Note for this spot…")}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingComment(null)}
              className="rounded-md p-1 text-ethereal-ink/50 hover:text-ethereal-ink"
              aria-label="cancel"
            >
              <X size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={commitComment}
              disabled={!commentDraft.trim()}
              className="rounded-md bg-ethereal-ink px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
