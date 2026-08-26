/**
 * @file AnnotationToolbar.tsx
 * @description Markup toolbar, injected into the PDF viewer's floating control
 * pill: undo/redo, the tool set (pen · highlighter · note · stamp · eraser),
 * contextual stroke weight + ink colour, what draws (stylus or finger), the note
 * display mode, the musical stamp palette (one group at a time — the catalogue
 * outgrew a flat grid), the write layer, and the "how does this work" panel. In conductor mode the layer toggles between shared/private;
 * in personal mode every mark lands on the user's own private layer (a static
 * chip says so). Drawing tools appear once the page is rendered large enough to
 * write on (see useCanDraw); notes, stamps, eraser + browse stay on every screen.
 *
 * Collapsed, the bar is a trigger that NAMES the tool in hand — a rehearsal is
 * no place to discover that the pencil was armed all along. Whether it opens
 * collapsed is remembered per device, for the same reason.
 * @module features/annotations/components
 */

import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  CloudOff,
  Eraser,
  Hand,
  Highlighter,
  HelpCircle,
  Lock,
  MousePointer2,
  PenLine,
  PenTool,
  Redo2,
  SquarePen,
  Stamp,
  Trash2,
  Type,
  Undo2,
  Users,
  UserCog,
  ZoomIn,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { usePdfImmersive } from "@/shared/ui/composites/PdfViewer";

import {
  MARK_SCALE_MAX,
  MARK_SCALE_MIN,
  MARK_SCALE_STEP,
  type AnnotationTool,
  type AnnotationToolState,
  type StrokeSize,
} from "../lib/useAnnotationTools";
import { groupOfStamp, STAMP_GROUPS, stampsInGroup, StampGlyph } from "../lib/stamps";

interface AnnotationToolbarProps extends AnnotationToolState {
  /** conductor → shared/conductor layer toggle; personal → fixed private layer. */
  mode: "conductor" | "personal";
  canDraw: boolean;
  annotationCount: number;
  /** How many of the visible marks THIS user may wipe (gates the trash). */
  clearableCount: number;
  /**
   * Markup writes this device is still holding for the network. Shown, because
   * the alternative is a reader who has no way to tell "saved" from "saved
   * somewhere I cannot see" and stops trusting the pencil.
   */
  pendingCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
  onOpenGuide: () => void;
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
  // A speech bubble says "comment thread". This tool writes a WORD on paper.
  { id: "note", icon: Type, labelKey: "annotations.tools.note", fallback: "Note", drawOnly: false },
  { id: "stamp", icon: Stamp, labelKey: "annotations.tools.stamp", fallback: "Symbol", drawOnly: false },
  { id: "eraser", icon: Eraser, labelKey: "annotations.tools.eraser", fallback: "Erase", drawOnly: false },
];

const SIZES: ReadonlyArray<{ id: StrokeSize; dot: number; labelKey: string; fallback: string }> = [
  { id: "fine", dot: 5, labelKey: "annotations.size.fine", fallback: "Fine" },
  { id: "medium", dot: 8, labelKey: "annotations.size.medium", fallback: "Medium" },
  { id: "bold", dot: 12, labelKey: "annotations.size.bold", fallback: "Bold" },
];

/**
 * Continuous size control, shared by the note and stamp panels. The sample to
 * its left grows with the value, so the size is chosen by looking at a mark
 * rather than by decoding a number.
 */
const ScaleSlider = ({
  value,
  onChange,
  label,
  sample,
}: {
  value: number;
  onChange: (scale: number) => void;
  label: string;
  sample: React.ReactNode;
}): React.JSX.Element => (
  <div className="flex items-center gap-2">
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden text-ethereal-marble"
    >
      {sample}
    </span>
    <input
      type="range"
      min={MARK_SCALE_MIN}
      max={MARK_SCALE_MAX}
      step={MARK_SCALE_STEP}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={label}
      title={label}
      className="w-36 accent-ethereal-gold"
    />
  </div>
);

const EXPANDED_STORAGE_KEY = "voct.annotations.toolbar_open";

const readExpanded = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EXPANDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const pillButton =
  "flex h-9 w-9 items-center justify-center rounded-full text-ethereal-marble transition-colors";
const ToolSeparator = () => (
  <Divider variant="solid-dark" orientation="vertical" className="mx-1 h-4" />
);

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
  fingerDraw,
  setFingerDraw,
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
  canDraw,
  annotationCount,
  clearableCount,
  pendingCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAll,
  onOpenGuide,
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
  const activeStampGroup = groupOfStamp(stamp);

  const isImmersive = usePdfImmersive();

  // Opens as a single clean trigger — the score is the star; markup is one tap
  // away. A reader who works with the bar open gets it back open next time:
  // re-opening it every score is a tax paid mid-rehearsal.
  const [expanded, setExpanded] = useState<boolean>(readExpanded);
  const changeExpanded = (next: boolean): void => {
    setExpanded(next);
    try {
      window.localStorage.setItem(EXPANDED_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Private-mode / storage-disabled: the bar still works for the session.
    }
  };
  // If it was opened then the viewer went immersive, clear the stage — without
  // recording it, so leaving performance mode restores the reader's own choice.
  useEffect(() => {
    if (isImmersive) setExpanded(false);
    else setExpanded(readExpanded());
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

  // The bar opens collapsed, so the waiting-to-sync sign has to survive here
  // too — this is the state a reader is actually in when they close the score
  // in a basement and wonder whether their pencil marks made it.
  const pendingPill = pendingCount > 0 && (
    <span
      title={t(
        "annotations.pending_hint",
        "Zapisane na tym urządzeniu. Wyślą się same, gdy wróci internet.",
      )}
      className="flex items-center gap-1 rounded-full bg-ethereal-gold/20 px-2 py-1 text-[10px] font-semibold text-ethereal-gold"
    >
      <CloudOff size={11} aria-hidden="true" />
      {pendingCount}
    </span>
  );

  if (!expanded) {
    // The armed tool names itself on the trigger: "Pióro" on the pill is the
    // difference between reaching for the stylus and hunting for an icon.
    const armed = visibleTools.find(({ id }) => id === tool && id !== "pointer");
    const TriggerIcon = armed?.icon ?? SquarePen;
    return (
      <button
        type="button"
        onClick={() => changeExpanded(true)}
        aria-label={t("annotations.open_tools", "Narzędzia adnotacji")}
        className={cn(
          barChrome,
          "h-11 gap-1.5 px-3.5 transition-colors hover:bg-ethereal-ink/85",
          armed ? "text-white ring-1 ring-ethereal-gold/60" : "text-ethereal-marble",
        )}
      >
        <TriggerIcon size={17} aria-hidden="true" />
        <span className="text-sm font-medium">
          {armed
            ? t(armed.labelKey, armed.fallback)
            : t("annotations.markup", "Adnotacje")}
        </span>
        {annotationCount > 0 && (
          <span className="ml-0.5 rounded-full bg-ethereal-gold/90 px-1.5 text-[10px] font-semibold text-ethereal-ink">
            {annotationCount}
          </span>
        )}
        {pendingPill}
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
          onClick={() => changeExpanded(false)}
          aria-label={t("annotations.collapse_tools", "Zwiń narzędzia")}
          title={t("annotations.collapse_tools", "Zwiń narzędzia")}
          className={cn(pillButton, "hover:bg-white/10")}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <ToolSeparator />
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

        <ToolSeparator />

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
          // The reason, spelled out: the pencil is one zoom — or one change of
          // fit — away, and a tooltip cannot be reached on the touch screens
          // this actually appears on.
          <span className="ml-1 flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-ethereal-marble/70">
            <ZoomIn size={12} aria-hidden="true" className="shrink-0" />
            <Eyebrow color="parchment-muted">
              {t("annotations.draw_needs_room", "Powiększ, by pisać")}
            </Eyebrow>
          </span>
        )}

        <ToolSeparator />
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

        {pendingPill && <span className="ml-1">{pendingPill}</span>}

        <ToolSeparator />
        <button
          type="button"
          onClick={onOpenGuide}
          aria-label={t("annotations.guide.open", "Jak działają adnotacje")}
          title={t("annotations.guide.open", "Jak działają adnotacje")}
          className={cn(pillButton, "hover:bg-white/10")}
        >
          <HelpCircle size={16} aria-hidden="true" />
        </button>

        {clearableCount > 0 && (
          <>
            <ToolSeparator />
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
          {/* What draws. Auto-set from the device (a stylus turns palm rejection
              on by itself), but always overridable — a reader whose "stylus"
              is a rubber-tipped stick reports as a finger and would otherwise
              be left with a pencil that draws nothing. */}
          {showSize && (
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={t("annotations.input.group", "Czym rysujesz")}
            >
              {([false, true] as const).map((asFinger) => (
                <button
                  key={String(asFinger)}
                  type="button"
                  onClick={() => setFingerDraw(asFinger)}
                  aria-pressed={fingerDraw === asFinger}
                  title={
                    asFinger
                      ? t("annotations.input.finger_hint", "Palec rysuje. Nuty przewijasz dwoma palcami.")
                      : t("annotations.input.stylus_hint", "Rysuje tylko rysik. Palcem przewijasz nuty.")
                  }
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                    fingerDraw === asFinger
                      ? "bg-white/20 text-white"
                      : "text-ethereal-marble hover:bg-white/10",
                  )}
                >
                  {asFinger ? (
                    <Hand size={14} aria-hidden="true" />
                  ) : (
                    <PenTool size={14} aria-hidden="true" />
                  )}
                  {asFinger
                    ? t("annotations.input.finger", "Palec")
                    : t("annotations.input.stylus", "Rysik")}
                </button>
              ))}
            </div>
          )}

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
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                {inks.map(({ value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setColor(value)}
                    aria-label={t("annotations.ink_color", "Kolor")}
                    aria-pressed={color === value}
                    title={t("annotations.ink_color", "Kolor")}
                    className={cn(
                      "h-6 w-6 rounded-full transition-transform hover:scale-110",
                      color === value
                        ? "ring-2 ring-white ring-offset-1 ring-offset-ethereal-ink"
                        : "ring-1 ring-white/30",
                    )}
                    style={{ backgroundColor: value }}
                  />
                ))}
              </div>
              {/* Said once, where the missing swatch is — the palette is short
                  enough that its absence would otherwise read as a bug. */}
              {mode === "personal" && (
                <Caption color="marble-muted">
                  {t(
                    "annotations.ink_reserved",
                    "Czerwony jest zarezerwowany dla dyrygenta.",
                  )}
                </Caption>
              )}
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
            <ScaleSlider
              value={textScale}
              onChange={setTextScale}
              label={t("annotations.scale.text", "Rozmiar tekstu")}
              sample={
                <span
                  className="font-semibold leading-none"
                  style={{ fontSize: 8 + textScale * 8 }}
                >
                  Aa
                </span>
              }
            />
          )}

          {showStampSize && (
            <ScaleSlider
              value={stampScale}
              onChange={setStampScale}
              label={t("annotations.scale.stamp", "Rozmiar symbolu")}
              sample={
                <StampGlyph symbol={stamp} color="#F4F1EA" size={10 + stampScale * 8} />
              }
            />
          )}

          {showStamps && (
            // Thirty symbols in one grid stopped fitting a phone, so the
            // palette shows ONE group at a time. The open group is derived from
            // the armed stamp rather than held separately — that way the symbol
            // in hand is always the one lit up on screen — and picking a group
            // arms its first symbol, so a tab is never a dead end.
            <div className="flex flex-col gap-1.5">
              <div
                className="no-scrollbar flex gap-1 overflow-x-auto"
                role="group"
                aria-label={t("annotations.stamp_groups.label", "Grupy symboli")}
              >
                {STAMP_GROUPS.map(({ group, labelKey, fallback }) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => {
                      const first = stampsInGroup(group)[0];
                      if (first) setStamp(first.id);
                    }}
                    aria-pressed={activeStampGroup === group}
                    className={cn(
                      "h-8 shrink-0 rounded-full px-2.5 text-xs font-medium transition-colors",
                      activeStampGroup === group
                        ? "bg-white/20 text-white"
                        : "text-ethereal-marble hover:bg-white/10",
                    )}
                  >
                    {t(labelKey, fallback)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1">
                {stampsInGroup(activeStampGroup).map((def) => (
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
                    <StampGlyph
                      symbol={def.id}
                      color="#F4F1EA"
                      size={def.kind === "text" ? 15 : 22}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
