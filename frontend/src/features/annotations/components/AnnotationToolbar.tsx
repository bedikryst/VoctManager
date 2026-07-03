/**
 * @file AnnotationToolbar.tsx
 * @description Markup toolbar, injected into the PDF viewer's floating control
 * pill: undo/redo, the tool set (pen · highlighter · note · stamp · eraser),
 * contextual stroke weight + ink colour, the note display mode, the musical
 * stamp palette and the write layer. In conductor mode the layer toggles
 * between shared/private; in personal mode every mark lands on the user's own
 * private layer (a static chip says so). Drawing tools are gated to
 * tablet-width and up; notes, stamps, eraser + browse stay on every screen.
 * @module features/annotations/components
 */

import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  Eraser,
  Highlighter,
  Lock,
  MessageSquarePlus,
  MousePointer2,
  PenLine,
  Redo2,
  SquarePen,
  Stamp,
  TabletSmartphone,
  Trash2,
  Undo2,
  Users,
  UserCog,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { usePdfImmersive } from "@/shared/ui/composites/PdfViewer";

import {
  ANNOTATION_COLORS,
  MARK_SCALE_ORDER,
  type AnnotationTool,
  type AnnotationToolState,
  type MarkScale,
  type StrokeSize,
} from "../lib/useAnnotationTools";
import { STAMPS, StampGlyph } from "../lib/stamps";

interface AnnotationToolbarProps extends AnnotationToolState {
  /** conductor → shared/conductor layer toggle; personal → fixed private layer. */
  mode: "conductor" | "personal";
  canDraw: boolean;
  annotationCount: number;
  /** How many of the visible marks THIS user may wipe (gates the trash). */
  clearableCount: number;
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
  { id: "stamp", icon: Stamp, labelKey: "annotations.tools.stamp", fallback: "Symbol", drawOnly: false },
  { id: "eraser", icon: Eraser, labelKey: "annotations.tools.eraser", fallback: "Erase", drawOnly: false },
];

const SIZES: ReadonlyArray<{ id: StrokeSize; dot: number; labelKey: string; fallback: string }> = [
  { id: "fine", dot: 5, labelKey: "annotations.size.fine", fallback: "Fine" },
  { id: "medium", dot: 8, labelKey: "annotations.size.medium", fallback: "Medium" },
  { id: "bold", dot: 12, labelKey: "annotations.size.bold", fallback: "Bold" },
];

/** Growing-dot size steps for placed marks (text notes + stamps). */
const SCALE_DOTS: Record<MarkScale, number> = { s: 5, m: 8, l: 12, xl: 16 };

/** Row of size presets, shared by the note and stamp option panels. */
const ScaleRow = ({
  value,
  onChange,
  groupLabel,
}: {
  value: MarkScale;
  onChange: (scale: MarkScale) => void;
  groupLabel: string;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1" role="group" aria-label={groupLabel}>
      {MARK_SCALE_ORDER.map((step) => (
        <button
          key={step}
          type="button"
          onClick={() => onChange(step)}
          aria-label={t(`annotations.scale.${step}`, step)}
          aria-pressed={value === step}
          title={t(`annotations.scale.${step}`, step)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
            value === step ? "bg-white/20" : "hover:bg-white/10",
          )}
        >
          <span
            className="rounded-full bg-ethereal-marble"
            style={{ width: SCALE_DOTS[step], height: SCALE_DOTS[step] }}
          />
        </button>
      ))}
    </div>
  );
};

const pillButton =
  "flex h-9 w-9 items-center justify-center rounded-full text-ethereal-marble transition-colors";
const Divider = () => <div className="mx-1 h-4 w-px bg-white/15" aria-hidden="true" />;

// Self-contained chrome: the toolbar owns its glass pill (PdfViewer just gives
// it a top-left slot with a capped width), so collapsed = a clean trigger and
// expanded = a single-row bar, without a double-pill.
const barChrome =
  "pointer-events-auto flex items-center rounded-full border border-white/10 bg-ethereal-ink/70 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl";
// The active tool's contextual options drop DOWN into this panel (same glass,
// softer corners) instead of stretching the pill off the edge of a phone.
const panelChrome =
  "pointer-events-auto rounded-2xl border border-white/10 bg-ethereal-ink/70 p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl";

export const AnnotationToolbar = ({
  mode,
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
  canDraw,
  annotationCount,
  clearableCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAll,
}: AnnotationToolbarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const showInk =
    tool === "pen" || tool === "highlighter" || tool === "note" || tool === "stamp";
  const showSize = tool === "pen" || tool === "highlighter";
  const showNoteMode = tool === "note";
  const showStamps = tool === "stamp";
  // Text size only matters for on-score (inline) notes — mirror the note card.
  const showTextSize = tool === "note" && noteDisplay === "inline";
  const showStampSize = tool === "stamp";
  // Whether the active tool has any contextual options to drop below the pill.
  const hasPanel = showSize || showInk || showNoteMode || showStamps;

  const isImmersive = usePdfImmersive();

  // Always opens as a single clean trigger — the score is the star; markup is
  // one tap away. (Prevents the wide tool bar from crowding the top edge, and
  // keeps a clean stage in immersive.)
  const [expanded, setExpanded] = useState(false);
  // If it was opened then the viewer went immersive, clear the stage.
  useEffect(() => {
    if (isImmersive) setExpanded(false);
  }, [isImmersive]);

  // Two-tap confirm (avoids a modal-inside-the-PDF-modal); auto-resets so a
  // stray first tap never leaves the toolbar armed.
  const [confirmingClear, setConfirmingClear] = useState(false);
  useEffect(() => {
    if (!confirmingClear) return;
    const timer = window.setTimeout(() => setConfirmingClear(false), 3500);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  const visibleTools = TOOLS.filter((toolDef) => canDraw || !toolDef.drawOnly);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={t("annotations.open_tools", "Narzędzia adnotacji")}
        className={cn(
          barChrome,
          "h-11 gap-1.5 px-3.5 text-ethereal-marble transition-colors hover:bg-ethereal-ink/85",
        )}
      >
        <SquarePen size={17} aria-hidden="true" />
        <span className="text-sm font-medium">
          {t("annotations.markup", "Adnotacje")}
        </span>
        {annotationCount > 0 && (
          <span className="ml-0.5 rounded-full bg-ethereal-gold/90 px-1.5 text-[10px] font-semibold text-ethereal-ink">
            {annotationCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {/* Main pill — deliberately ONE row: collapse · undo/redo · tools · layer
          · trash. Contextual options never live here; they drop into the panel
          below so nothing runs off the edge of a phone. */}
      <div className={cn(barChrome, "no-scrollbar max-w-full gap-0.5 overflow-x-auto p-1.5")}>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label={t("annotations.collapse_tools", "Zwiń narzędzia")}
          title={t("annotations.collapse_tools", "Zwiń narzędzia")}
          className={cn(pillButton, "hover:bg-white/10")}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <Divider />
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

        <Divider />
        {mode === "conductor" ? (
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
        ) : (
          // Personal mode writes to one fixed layer — say so instead of offering
          // a toggle that could suggest the choir might see these marks.
          <span
            title={t("annotations.layer.personal_hint", "Widoczne tylko dla Ciebie")}
            className="flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-medium text-ethereal-marble"
          >
            <Lock size={12} aria-hidden="true" />
            <span className="hidden sm:inline">
              {t("annotations.layer.personal_short", "Moje")}
            </span>
          </span>
        )}

        {clearableCount > 0 && (
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

      {/* Contextual options for the active tool — drop DOWN, never sideways. */}
      {hasPanel && (
        <div
          className={cn(
            panelChrome,
            "no-scrollbar flex max-w-[calc(100vw-9rem)] flex-col gap-3 overflow-x-auto sm:max-w-[calc(100vw-13rem)]",
          )}
        >
          {showSize && (
            <div className="flex items-center gap-1">
              {SIZES.map(({ id, dot, labelKey, fallback }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSize(id)}
                  aria-label={t(labelKey, fallback)}
                  aria-pressed={size === id}
                  title={t(labelKey, fallback)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
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
          )}

          {showInk && (
            <div className="flex items-center gap-1.5">
              {ANNOTATION_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={t("annotations.ink_color", "Kolor")}
                  aria-pressed={color === swatch}
                  title={t("annotations.ink_color", "Kolor")}
                  className={cn(
                    "h-6 w-6 rounded-full transition-transform hover:scale-110",
                    color === swatch
                      ? "ring-2 ring-white ring-offset-1 ring-offset-ethereal-ink"
                      : "ring-1 ring-white/30",
                  )}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          )}

          {showNoteMode && (
            <div className="flex items-center gap-1">
              {(["inline", "pin"] as const).map((displayMode) => (
                <button
                  key={displayMode}
                  type="button"
                  onClick={() => setNoteDisplay(displayMode)}
                  aria-pressed={noteDisplay === displayMode}
                  className={cn(
                    "h-9 rounded-full px-3 text-xs font-medium transition-colors",
                    noteDisplay === displayMode
                      ? "bg-white/20 text-white"
                      : "text-ethereal-marble hover:bg-white/10",
                  )}
                >
                  {displayMode === "inline"
                    ? t("annotations.note.inline", "Na nucie")
                    : t("annotations.note.pin", "Pinezka")}
                </button>
              ))}
            </div>
          )}

          {showTextSize && (
            <ScaleRow
              value={textScale}
              onChange={setTextScale}
              groupLabel={t("annotations.scale.text", "Rozmiar tekstu")}
            />
          )}

          {showStampSize && (
            <ScaleRow
              value={stampScale}
              onChange={setStampScale}
              groupLabel={t("annotations.scale.stamp", "Rozmiar symbolu")}
            />
          )}

          {showStamps && (
            <div className="grid grid-cols-5 gap-1">
              {STAMPS.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => setStamp(def.id)}
                  aria-label={t(def.labelKey, def.fallback)}
                  aria-pressed={stamp === def.id}
                  title={t(def.labelKey, def.fallback)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-xl transition-colors",
                    stamp === def.id ? "bg-white/20" : "hover:bg-white/10",
                  )}
                >
                  <StampGlyph symbol={def.id} color="#F4F1EA" size={def.kind === "text" ? 15 : 22} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
