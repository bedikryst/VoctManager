/**
 * @file AnnotationToolbar.tsx
 * @description Conductor markup toolbar, injected into the PDF viewer's floating
 * control pill: undo/redo, the tool set (pen · highlighter · note · eraser),
 * contextual stroke weight + ink colour, the note display mode and the
 * shared/private write layer. Drawing tools are gated to tablet-width and up;
 * notes + browse stay available on every screen.
 * @module features/annotations/components
 */

import React, { useEffect, useState } from "react";
import {
  Check,
  Eraser,
  Highlighter,
  MessageSquarePlus,
  MousePointer2,
  PenLine,
  Redo2,
  TabletSmartphone,
  Trash2,
  Undo2,
  Users,
  UserCog,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";

import {
  ANNOTATION_COLORS,
  type AnnotationTool,
  type AnnotationToolState,
  type StrokeSize,
} from "../lib/useAnnotationTools";

interface AnnotationToolbarProps extends AnnotationToolState {
  canDraw: boolean;
  annotationCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
}

interface ToolDef {
  id: AnnotationTool;
  icon: typeof PenLine;
  labelKey: string;
  fallback: string;
  drawOnly: boolean;
}

const TOOLS: ReadonlyArray<ToolDef> = [
  { id: "pointer", icon: MousePointer2, labelKey: "annotations.tools.pointer", fallback: "Browse", drawOnly: false },
  { id: "pen", icon: PenLine, labelKey: "annotations.tools.pen", fallback: "Pen", drawOnly: true },
  { id: "highlighter", icon: Highlighter, labelKey: "annotations.tools.highlighter", fallback: "Highlighter", drawOnly: true },
  { id: "note", icon: MessageSquarePlus, labelKey: "annotations.tools.note", fallback: "Note", drawOnly: false },
  { id: "eraser", icon: Eraser, labelKey: "annotations.tools.eraser", fallback: "Erase", drawOnly: true },
];

const SIZES: ReadonlyArray<{ id: StrokeSize; dot: number; labelKey: string; fallback: string }> = [
  { id: "fine", dot: 5, labelKey: "annotations.size.fine", fallback: "Fine" },
  { id: "medium", dot: 8, labelKey: "annotations.size.medium", fallback: "Medium" },
  { id: "bold", dot: 12, labelKey: "annotations.size.bold", fallback: "Bold" },
];

const pillButton =
  "flex h-9 w-9 items-center justify-center rounded-full text-ethereal-marble transition-colors";
const Divider = () => <div className="mx-1 h-4 w-px bg-white/15" aria-hidden="true" />;

export const AnnotationToolbar = ({
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
  canDraw,
  annotationCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAll,
}: AnnotationToolbarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const showInk = tool === "pen" || tool === "highlighter" || tool === "note";
  const showSize = tool === "pen" || tool === "highlighter";
  const showNoteMode = tool === "note";

  // Two-tap confirm (avoids a modal-inside-the-PDF-modal); auto-resets so a
  // stray first tap never leaves the toolbar armed.
  const [confirmingClear, setConfirmingClear] = useState(false);
  useEffect(() => {
    if (!confirmingClear) return;
    const timer = window.setTimeout(() => setConfirmingClear(false), 3500);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  const visibleTools = TOOLS.filter((toolDef) => canDraw || !toolDef.drawOnly);

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label={t("annotations.undo", "Cofnij")}
        title={t("annotations.undo", "Cofnij")}
        className={cn(pillButton, "hover:bg-white/10 disabled:opacity-30")}
      >
        <Undo2 size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label={t("annotations.redo", "Ponów")}
        title={t("annotations.redo", "Ponów")}
        className={cn(pillButton, "hover:bg-white/10 disabled:opacity-30")}
      >
        <Redo2 size={16} aria-hidden="true" />
      </button>

      <Divider />

      {visibleTools.map(({ id, icon: Icon, labelKey, fallback }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTool(id)}
          aria-label={t(labelKey, fallback)}
          aria-pressed={tool === id}
          title={t(labelKey, fallback)}
          className={cn(
            pillButton,
            tool === id ? "bg-white/20 text-white" : "hover:bg-white/10",
          )}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}

      {!canDraw && (
        <span
          className="ml-1 flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[10px] text-ethereal-marble/70"
          title={t("annotations.draw_on_tablet", "Rysowanie dostępne na tablecie")}
        >
          <TabletSmartphone size={12} aria-hidden="true" />
        </span>
      )}

      {showSize && (
        <>
          <Divider />
          <div className="flex items-center gap-0.5">
            {SIZES.map(({ id, dot, labelKey, fallback }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSize(id)}
                aria-label={t(labelKey, fallback)}
                aria-pressed={size === id}
                title={t(labelKey, fallback)}
                className={cn(
                  "flex h-9 w-7 items-center justify-center rounded-full transition-colors",
                  size === id ? "bg-white/20" : "hover:bg-white/10",
                )}
              >
                <span
                  className="rounded-full bg-ethereal-marble"
                  style={{ width: dot, height: dot }}
                />
              </button>
            ))}
          </div>
        </>
      )}

      {showInk && (
        <>
          <Divider />
          <div className="flex items-center gap-1 px-0.5">
            {ANNOTATION_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={t("annotations.ink_color", "Kolor")}
                title={t("annotations.ink_color", "Kolor")}
                className={cn(
                  "h-5 w-5 rounded-full transition-transform hover:scale-110",
                  color === swatch
                    ? "ring-2 ring-white ring-offset-1 ring-offset-ethereal-ink"
                    : "ring-1 ring-white/30",
                )}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </>
      )}

      {showNoteMode && (
        <>
          <Divider />
          <div className="flex items-center gap-0.5">
            {(["inline", "pin"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setNoteDisplay(mode)}
                aria-pressed={noteDisplay === mode}
                className={cn(
                  "h-9 rounded-full px-2.5 text-xs font-medium transition-colors",
                  noteDisplay === mode
                    ? "bg-white/20 text-white"
                    : "text-ethereal-marble hover:bg-white/10",
                )}
              >
                {mode === "inline"
                  ? t("annotations.note.inline", "Na nucie")
                  : t("annotations.note.pin", "Pinezka")}
              </button>
            ))}
          </div>
        </>
      )}

      <Divider />
      <button
        type="button"
        onClick={() => setLayer(layer === "shared" ? "conductor" : "shared")}
        aria-label={
          layer === "shared"
            ? t("annotations.layer.shared", "Visible to choir")
            : t("annotations.layer.private", "Private")
        }
        title={
          layer === "shared"
            ? t("annotations.layer.shared", "Visible to choir")
            : t("annotations.layer.private", "Private")
        }
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
          layer === "shared"
            ? "bg-emerald-500/20 text-emerald-200"
            : "bg-white/10 text-ethereal-marble",
        )}
      >
        {layer === "shared" ? (
          <Users size={14} aria-hidden="true" />
        ) : (
          <UserCog size={14} aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {layer === "shared"
            ? t("annotations.layer.shared_short", "Choir")
            : t("annotations.layer.private_short", "Private")}
        </span>
      </button>

      {annotationCount > 0 && (
        <>
          <Divider />
          {confirmingClear ? (
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setConfirmingClear(false);
              }}
              className="flex h-9 items-center gap-1.5 rounded-full bg-ethereal-crimson/90 px-3 text-xs font-medium text-white transition-colors hover:bg-ethereal-crimson"
            >
              <Check size={14} aria-hidden="true" />
              <span>{t("annotations.clear_confirm", "Na pewno?")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              aria-label={t("annotations.clear_all", "Usuń wszystkie adnotacje")}
              title={t("annotations.clear_all", "Usuń wszystkie adnotacje")}
              className={cn(pillButton, "hover:bg-ethereal-crimson/30 hover:text-white")}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
