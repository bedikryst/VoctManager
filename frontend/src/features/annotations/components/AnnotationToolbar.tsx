/**
 * @file AnnotationToolbar.tsx
 * @description Markup toolbar, injected into the PDF viewer's top-left slot.
 * Three parts, each in its own glass:
 * - the tools: collapse · undo · redo │ browse · select · Rysuj · Wstaw ·
 *   eraser │ ⋯. "Rysuj" (pen, highlighter, shapes) and "Wstaw" (note, symbol,
 *   jump) are family slots (see ToolFamilySlot); the guide and "Usuń
 *   wszystkie" live behind ⋯, away from the end of the bar where a destructive
 *   button invited a mis-tap;
 * - the "who sees it" strip (AnnotationAudienceBar): the layer the NEXT mark
 *   goes to, "Powiadom chór", marks waiting for the network;
 * - the armed tool's options: its family's siblings first, then the shape in
 *   hand, what draws (stylus or finger), stroke weight, ink, voices, the note
 *   display mode, sizes, and the symbol palette (one group at a time).
 *
 * Orientation follows the screen, never the zoom (`usePdfToolRail`). On a
 * landscape tablet or larger the tools are a vertical rail in the left margin
 * under the strip, with the options opening to its right. Elsewhere they are a
 * row in the top letterbox with the strip under it and the options dropping
 * below; in personal mode the strip would hold nothing but "Moje", so that
 * chip heads the row instead. On the narrowest phones the row cannot hold
 * every slot, so collapse and redo move into ⋯ and what is left may wrap to a
 * second line — nothing hides behind a scroll. The options panel's rows wrap
 * for the same reason.
 *
 * Each tool's tooltip names the key that arms it (`TOOL_KEYS`), and the symbol
 * palette previews every symbol in the ink in hand, on a scrap of paper. A word
 * spans as many palette cells as its measured width needs.
 *
 * Collapsed, the bar is a trigger that NAMES the tool in hand — a rehearsal is
 * no place to discover that the pencil was armed all along. Whether it opens
 * collapsed is remembered per device, for the same reason. Where the page
 * reaches into the left margin, the trigger folds further to the tool's icon
 * so the name never lies across the start of a system.
 * @module features/annotations/components
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Circle,
  CloudOff,
  CornerDownRight,
  Eraser,
  Hand,
  Highlighter,
  HelpCircle,
  LassoSelect,
  MoreHorizontal,
  MoreVertical,
  MousePointer2,
  MoveUpRight,
  PenLine,
  PenTool,
  RectangleHorizontal,
  Redo2,
  Shapes,
  Slash,
  SquarePen,
  Stamp,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";
import { Caption } from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import {
  usePdfCompactTriggers,
  usePdfImmersive,
  usePdfToolRail,
} from "@/shared/ui/composites/PdfViewer";

import {
  DRAWING_TOOLS,
  MARK_SCALE_MAX,
  MARK_SCALE_MIN,
  MARK_SCALE_STEP,
  TOOL_KEYS,
  type AnnotationTool,
  type AnnotationToolState,
  type StrokeSize,
} from "../lib/useAnnotationTools";
import { readStored, writeStored } from "../lib/deviceStorage";
import {
  getStampDef,
  groupOfStamp,
  STAMP_GROUPS,
  stampPreviewSize,
  stampSampleSize,
  stampsInGroup,
  stampTextEm,
  StampGlyph,
  type StampDef,
  type StampGroupId,
} from "../lib/stamps";
import { SHAPE_KINDS, type ShapeKind } from "../lib/shapes";
import { useMeasuredWidth } from "../lib/useMeasuredWidth";
import { layerTakesVoices } from "../lib/voices";
import type { DelegateLayer, ScoreAnnotatorMode } from "../useScoreAnnotator";
import { AnnotationAudienceBar, PendingPill, PersonalLayerChip } from "./AnnotationAudienceBar";
import { MarkVoicePicker } from "./MarkVoicePicker";
import { NOTE_DISPLAY_MODES } from "./NoteCard";
import {
  DRAW_FAMILY,
  familyOf,
  INSERT_FAMILY,
  ToolFamilySlot,
  useFamilyMember,
} from "./ToolFamilySlot";
import {
  barChrome,
  glassChrome,
  panelChrome,
  pillButton,
  wrappingBarChrome,
} from "./toolbarChrome";

interface AnnotationToolbarProps extends AnnotationToolState {
  /**
   * conductor → choir/leader/private layer cycle; leader → own pencil and the
   * layers in `delegateLayers`, in turn; personal → fixed private layer.
   */
  mode: ScoreAnnotatorMode;
  delegateLayers: readonly DelegateLayer[];
  canDraw: boolean;
  annotationCount: number;
  /** How many of the visible marks THIS user may wipe (gates "Usuń wszystkie"). */
  clearableCount: number;
  /** Markup writes this device is still holding for the network. */
  pendingCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
  onOpenGuide: () => void;
  /** "Powiadom chór", when the stand was opened from a project its reader may tell. */
  notifySlot?: React.ReactNode;
}

export interface ToolDef {
  id: AnnotationTool;
  icon: typeof PenLine;
  labelKey: string;
  fallback: string;
}

const TOOL_DEF_BY_ID: Readonly<Record<AnnotationTool, ToolDef>> = {
  pointer: { id: "pointer", icon: MousePointer2, labelKey: "annotations.tools.pointer", fallback: "Przeglądaj" },
  select: { id: "select", icon: LassoSelect, labelKey: "annotations.tools.select", fallback: "Zaznacz" },
  pen: { id: "pen", icon: PenLine, labelKey: "annotations.tools.pen", fallback: "Pióro" },
  highlighter: { id: "highlighter", icon: Highlighter, labelKey: "annotations.tools.highlighter", fallback: "Zakreślacz" },
  shape: { id: "shape", icon: Shapes, labelKey: "annotations.tools.shape", fallback: "Kształty" },
  // A speech bubble says "comment thread". This tool writes a WORD on paper.
  note: { id: "note", icon: Type, labelKey: "annotations.tools.note", fallback: "Notatka" },
  stamp: { id: "stamp", icon: Stamp, labelKey: "annotations.tools.stamp", fallback: "Symbol" },
  link: { id: "link", icon: CornerDownRight, labelKey: "annotations.tools.link", fallback: "Skok" },
  eraser: { id: "eraser", icon: Eraser, labelKey: "annotations.tools.eraser", fallback: "Gumka" },
};

/** Every tool, in the order the bar and its families show them; the guide lists the keys from it. */
export const TOOL_DEFS: ReadonlyArray<ToolDef> = [
  TOOL_DEF_BY_ID.pointer,
  // Beside browse: both work with marks already on the page.
  TOOL_DEF_BY_ID.select,
  TOOL_DEF_BY_ID.pen,
  TOOL_DEF_BY_ID.highlighter,
  TOOL_DEF_BY_ID.shape,
  TOOL_DEF_BY_ID.note,
  TOOL_DEF_BY_ID.stamp,
  TOOL_DEF_BY_ID.link,
  TOOL_DEF_BY_ID.eraser,
];

type ShapeIcon = React.ComponentType<{ size?: number }>;

/** The icon set has no hairpin, slur or bracket; these are drawn on its grid. */
const drawnShapeIcon = (d: string): ShapeIcon => {
  const DrawnShapeIcon = ({ size = 24 }: { size?: number }): React.JSX.Element => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
  return DrawnShapeIcon;
};

/** The line is drawn slanted: it rules itself level or plumb only near those
 *  angles, and a free diagonal is how a note gets crossed out. */
const SHAPE_ICONS: Record<ShapeKind, ShapeIcon> = {
  ellipse: Circle,
  rect: RectangleHorizontal,
  line: Slash,
  arrow: MoveUpRight,
  cresc: drawnShapeIcon("M21 6 L3 12 L21 18"),
  dim: drawnShapeIcon("M3 6 L21 12 L3 18"),
  slur: drawnShapeIcon("M3 16 Q12 4 21 16"),
  bracket: drawnShapeIcon("M3 15 L3 8 L21 8 L21 15"),
};

/** A tool's name with the key that arms it, for its tooltip. */
const withKey = (label: string, tool: AnnotationTool): string =>
  `${label} (${TOOL_KEYS[tool].toUpperCase()})`;

/** The symbol palette's grid: five cells across, `gap-1` between them. */
const STAMP_COLUMNS = 5;
const STAMP_GAP_PX = 4;
/** Paper either side of a word in its tile, so the ink never touches the edge. */
const STAMP_TILE_INSET_PX = 4;
/** The square a symbol's preview fits inside its 36 px tile. */
const STAMP_PREVIEW_BOX = 22;
/** Only until the grid is first measured — one layout pass, before paint. */
const STAMP_GRID_ESTIMATED_WIDTH = 200;
const COLUMN_SPANS = ["col-span-1", "col-span-2", "col-span-3", "col-span-4", "col-span-5"] as const;
/** The size sample's tile (h-9 w-9), less its paper inset. */
const SAMPLE_TILE_PX = 36 - 2 * STAMP_TILE_INSET_PX;

/** Room for a word in a tile `span` cells wide. */
const tileRoom = (span: number, cell: number): number =>
  span * cell + (span - 1) * STAMP_GAP_PX - 2 * STAMP_TILE_INSET_PX;

/**
 * How many cells a stamp's tile spans: one for a symbol, and for a word as many
 * as its measured width at preview size needs. A word wider than the whole row
 * takes the row and is set smaller to fit it.
 */
const stampTileSpan = (def: StampDef, cell: number): number => {
  if (def.kind !== "text") return 1;
  const width =
    stampTextEm(def.glyph) *
    stampPreviewSize(def, STAMP_PREVIEW_BOX, Number.POSITIVE_INFINITY);
  for (let span = 1; span < STAMP_COLUMNS; span++) {
    if (width <= tileRoom(span, cell)) return span;
  }
  return STAMP_COLUMNS;
};

const SIZES: ReadonlyArray<{ id: StrokeSize; dot: number; labelKey: string; fallback: string }> = [
  { id: "fine", dot: 5, labelKey: "annotations.size.fine", fallback: "Cienka" },
  { id: "medium", dot: 8, labelKey: "annotations.size.medium", fallback: "Średnia" },
  { id: "bold", dot: 12, labelKey: "annotations.size.bold", fallback: "Gruba" },
];

/**
 * Below Tailwind's `sm` the row cannot hold every slot even with the families
 * folded (360 px leaves it ~216 px), so collapse and redo move into ⋯ there.
 */
const NARROW_ROW_QUERY = "(max-width: 39.99rem)";

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
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden text-ink-on-inverse"
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

const readExpanded = (): boolean => readStored(EXPANDED_STORAGE_KEY) === "1";

/** Across the row, a short upright rule; down the rail, a short level one. */
const ToolSeparator = ({ rail }: { rail: boolean }): React.JSX.Element =>
  rail ? (
    <Divider variant="solid-dark" orientation="horizontal" className="my-1 w-4" />
  ) : (
    <Divider variant="solid-dark" orientation="vertical" className="mx-1 h-4" />
  );

/**
 * A scrap of the page under a symbol's preview, so the preview is drawn in the
 * ink it will be placed in. Pencil on the dark chrome would be invisible, and a
 * preview in some other colour is a preview of a different mark. White in both
 * themes, because the page is.
 */
const paperTile = "flex items-center justify-center rounded-lg bg-white/90";

/**
 * One group's symbols. A cell's width is only known once the panel has laid
 * out, and it differs between a phone, the rail's panel and a wide window, so
 * the grid measures itself and each word spans the cells it needs there.
 */
const StampPalette = ({
  group,
  stamp,
  color,
  onPick,
}: {
  group: StampGroupId;
  stamp: string;
  color: string;
  onPick: (symbol: string) => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const gridWidth = useMeasuredWidth(gridRef, STAMP_GRID_ESTIMATED_WIDTH);
  const cell = (gridWidth - (STAMP_COLUMNS - 1) * STAMP_GAP_PX) / STAMP_COLUMNS;

  return (
    <div ref={gridRef} className="grid grid-cols-5 gap-1">
      {stampsInGroup(group).map((def) => {
        const span = stampTileSpan(def, cell);
        return (
          <button
            key={def.id}
            type="button"
            onClick={() => onPick(def.id)}
            aria-label={t(def.labelKey, def.fallback)}
            aria-pressed={stamp === def.id}
            title={t(def.labelKey, def.fallback)}
            className={cn(
              paperTile,
              "h-9 transition-shadow",
              COLUMN_SPANS[span - 1],
              stamp === def.id
                ? "ring-2 ring-ethereal-gold"
                : "hover:ring-1 hover:ring-ethereal-gold/60",
            )}
          >
            <StampGlyph
              symbol={def.id}
              color={color}
              size={stampPreviewSize(def, STAMP_PREVIEW_BOX, tileRoom(span, cell))}
            />
          </button>
        );
      })}
    </div>
  );
};

/**
 * The same pill with no pencil in it, for a page that belongs to no edition —
 * the concert book's title page and contents, where the book opens. What the
 * project offers as a whole ("Powiadom chór") still has its place there.
 */
export const BareToolbar = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => <div className={cn(barChrome, "p-1.5")}>{children}</div>;

export const AnnotationToolbar = ({
  mode,
  delegateLayers,
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
  shape,
  setShape,
  noteDisplay,
  setNoteDisplay,
  stamp,
  setStamp,
  layer,
  setLayer,
  voices,
  setVoices,
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
  notifySlot,
}: AnnotationToolbarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const isRail = usePdfToolRail();
  const isNarrow = useMediaQuery(NARROW_ROW_QUERY);
  const foldIntoMenu = !isRail && isNarrow;

  // A drawing tool held over a page too small to write on is not in hand: the
  // annotator coerces it to browse, and the bar has to say the same.
  const armedTool: AnnotationTool = !canDraw && DRAWING_TOOLS.has(tool) ? "pointer" : tool;
  const drawMember = useFamilyMember(DRAW_FAMILY, armedTool);
  const insertMember = useFamilyMember(INSERT_FAMILY, armedTool);
  const armedFamily = familyOf(armedTool);

  const showInk =
    armedTool === "pen" ||
    armedTool === "highlighter" ||
    armedTool === "shape" ||
    armedTool === "note" ||
    armedTool === "stamp" ||
    armedTool === "link";
  const showSize = armedTool === "pen" || armedTool === "highlighter" || armedTool === "shape";
  const showShapes = armedTool === "shape";
  const showNoteMode = armedTool === "note";
  const showStamps = armedTool === "stamp";
  // Text size only matters for words on the page (inline or boxed) — mirror the
  // note card.
  const showTextSize = armedTool === "note" && noteDisplay !== "pin";
  const showStampSize = armedTool === "stamp";
  // Every family member has options, if only its siblings; the single slots have none.
  const hasPanel = armedFamily !== null;
  // Voices address the next mark wherever its layer has readers who sing.
  const showVoices = showInk && mode !== "personal" && layerTakesVoices(layer);
  const activeStampGroup = groupOfStamp(stamp);
  const armedStamp = getStampDef(stamp);
  /** The size sample grows with the slider, inside its 36 px tile. */
  const stampSampleBox = 10 + stampScale * 8;

  const isImmersive = usePdfImmersive();
  const compactTrigger = usePdfCompactTriggers();

  // Opens as a single clean trigger — the score is the star; markup is one tap
  // away. A reader who works with the bar open gets it back open next time:
  // re-opening it every score is a tax paid mid-rehearsal.
  const [expanded, setExpanded] = useState<boolean>(readExpanded);
  const changeExpanded = (next: boolean): void => {
    setExpanded(next);
    writeStored(EXPANDED_STORAGE_KEY, next ? "1" : "0");
  };
  // If it was opened then the viewer went immersive, clear the stage — without
  // recording it, so leaving performance mode restores the reader's own choice.
  useEffect(() => {
    if (isImmersive) setExpanded(false);
    else setExpanded(readExpanded());
  }, [isImmersive]);

  // The guide takes focus as it opens. The closing menu would hand focus back to
  // ⋯ a moment later, and a Space meant for the guide would reopen the menu
  // over it; every other way out of the menu returns focus to ⋯ as usual.
  const guideChosenRef = useRef(false);

  // Two-tap confirm (avoids a modal-inside-the-PDF-modal); auto-resets so a
  // stray first tap never leaves the menu armed.
  const [confirmingClear, setConfirmingClear] = useState(false);
  useEffect(() => {
    if (!confirmingClear) return;
    const timer = window.setTimeout(() => setConfirmingClear(false), 3500);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  if (!expanded) {
    // The armed tool names itself on the trigger: "Pióro" on the pill is the
    // difference between reaching for the stylus and hunting for an icon.
    const armed = armedTool !== "pointer" ? TOOL_DEF_BY_ID[armedTool] : undefined;
    const TriggerIcon = armed?.icon ?? SquarePen;
    const triggerLabel = armed
      ? t(armed.labelKey, armed.fallback)
      : t("annotations.markup", "Adnotacje");
    // A screen reader hears the button's name, not the label drawn on it, so
    // the name has to carry the armed tool too.
    const triggerName = armed
      ? t("annotations.open_tools_armed", {
          tool: triggerLabel,
          defaultValue: "Narzędzia adnotacji: {{tool}}",
        })
      : t("annotations.open_tools", "Narzędzia adnotacji");

    if (compactTrigger) {
      // Folded beside a page that leaves no margin: the icon and the gold ring
      // still say which tool is armed, the label moves to the tooltip, and one
      // corner badge keeps the more urgent signal — marks waiting to sync
      // outrank the mark count.
      return (
        <button
          type="button"
          onClick={() => changeExpanded(true)}
          aria-label={triggerName}
          title={triggerLabel}
          className={cn(
            barChrome,
            "relative h-11 w-11 justify-center text-ink-on-inverse transition-colors hover:bg-surface-inverse/85",
            armed && "ring-1 ring-ethereal-gold/60",
          )}
        >
          <TriggerIcon size={17} aria-hidden="true" />
          {pendingCount > 0 ? (
            <span
              title={t(
                "annotations.pending_hint",
                "Zapisane na tym urządzeniu. Wyślą się same, gdy wróci internet.",
              )}
              className="absolute -right-1 -top-1 flex items-center gap-0.5 rounded-full bg-surface-inverse px-1.5 py-0.5 text-[10px] font-semibold text-ethereal-gold ring-1 ring-ethereal-gold/40"
            >
              <CloudOff size={10} aria-hidden="true" />
              {pendingCount}
            </span>
          ) : (
            annotationCount > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-ethereal-gold/90 px-1.5 text-[10px] font-semibold text-surface-inverse">
                {annotationCount}
              </span>
            )
          )}
        </button>
      );
    }

    // The bar opens collapsed, so the waiting-to-sync sign has to survive here
    // too — this is the state a reader is actually in when they close the score
    // in a basement and wonder whether their pencil marks made it.
    return (
      <button
        type="button"
        onClick={() => changeExpanded(true)}
        aria-label={triggerName}
        className={cn(
          barChrome,
          "h-11 gap-1.5 px-3.5 text-ink-on-inverse transition-colors hover:bg-surface-inverse/85",
          armed && "ring-1 ring-ethereal-gold/60",
        )}
      >
        <TriggerIcon size={17} aria-hidden="true" />
        <span className="text-sm font-medium">{triggerLabel}</span>
        {annotationCount > 0 && (
          <span className="ml-0.5 rounded-full bg-ethereal-gold/90 px-1.5 text-[10px] font-semibold text-surface-inverse">
            {annotationCount}
          </span>
        )}
        <PendingPill count={pendingCount} />
      </button>
    );
  }

  // In personal mode the strip would hold nothing but "Moje" (and the sync
  // sign), so a row does without it and carries the chip at its head. The
  // rail keeps the strip: there the chip has no row to sit in.
  const audienceInRow = !isRail && mode === "personal" && !notifySlot;

  const singleSlot = (id: AnnotationTool): React.JSX.Element => {
    const { icon: Icon, labelKey, fallback } = TOOL_DEF_BY_ID[id];
    const label = t(labelKey, fallback);
    return (
      <button
        type="button"
        onClick={() => setTool(id)}
        aria-label={label}
        aria-pressed={armedTool === id}
        aria-keyshortcuts={TOOL_KEYS[id].toUpperCase()}
        title={withKey(label, id)}
        className={cn(
          pillButton,
          armedTool === id ? "bg-ink-on-inverse/20" : "hover:bg-ink-on-inverse/10",
        )}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
    );
  };

  const collapseButton = (
    <button
      type="button"
      onClick={() => changeExpanded(false)}
      aria-label={t("annotations.collapse_tools", "Zwiń narzędzia")}
      title={t("annotations.collapse_tools", "Zwiń narzędzia")}
      className={cn(pillButton, "hover:bg-ink-on-inverse/10")}
    >
      <ChevronLeft size={16} aria-hidden="true" />
    </button>
  );

  const redoButton = (
    <button
      type="button"
      onClick={onRedo}
      disabled={!canRedo}
      aria-label={t("annotations.redo", "Ponów")}
      title={t("annotations.redo", "Ponów")}
      className={cn(pillButton, "hover:bg-ink-on-inverse/10 disabled:opacity-30")}
    >
      <Redo2 size={16} aria-hidden="true" />
    </button>
  );

  const MoreIcon = isRail ? MoreVertical : MoreHorizontal;
  const moreMenu = (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setConfirmingClear(false);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("annotations.more", "Więcej")}
          title={t("annotations.more", "Więcej")}
          className={cn(
            pillButton,
            "hover:bg-ink-on-inverse/10 data-[state=open]:bg-ink-on-inverse/20",
          )}
        >
          <MoreIcon size={16} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isRail ? "right" : "bottom"}
        align="start"
        onCloseAutoFocus={(event) => {
          if (!guideChosenRef.current) return;
          guideChosenRef.current = false;
          event.preventDefault();
        }}
      >
        {foldIntoMenu && (
          <>
            <DropdownMenuItem icon={<Redo2 size={14} />} onSelect={onRedo} disabled={!canRedo}>
              {t("annotations.redo", "Ponów")}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<ChevronLeft size={14} />}
              onSelect={() => changeExpanded(false)}
            >
              {t("annotations.collapse_tools", "Zwiń narzędzia")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          icon={<HelpCircle size={14} />}
          onSelect={() => {
            guideChosenRef.current = true;
            onOpenGuide();
          }}
        >
          {t("annotations.guide.open", "Jak działają adnotacje")}
        </DropdownMenuItem>
        {clearableCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={confirmingClear ? <Check size={14} /> : <Trash2 size={14} />}
              destructive
              onSelect={(event) => {
                // The first tap only arms it, and the menu stays open for the
                // second.
                if (!confirmingClear) {
                  event.preventDefault();
                  setConfirmingClear(true);
                  return;
                }
                setConfirmingClear(false);
                onClearAll();
              }}
            >
              {confirmingClear
                ? t("annotations.clear_confirm", "Na pewno?")
                : t("annotations.clear_all", "Usuń wszystkie adnotacje")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const toolBar = (
    <div
      className={
        isRail
          ? cn(
              glassChrome,
              "no-scrollbar flex max-h-full shrink-0 flex-col items-center gap-0.5 overflow-y-auto rounded-full p-1.5",
            )
          : cn(wrappingBarChrome, "max-w-full gap-0.5 p-1.5")
      }
    >
      {audienceInRow && (
        <>
          <PersonalLayerChip compact />
          <PendingPill count={pendingCount} />
        </>
      )}
      {!foldIntoMenu && collapseButton}
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label={t("annotations.undo", "Cofnij")}
        title={t("annotations.undo", "Cofnij")}
        className={cn(pillButton, "hover:bg-ink-on-inverse/10 disabled:opacity-30")}
      >
        <Undo2 size={16} aria-hidden="true" />
      </button>
      {!foldIntoMenu && redoButton}

      <ToolSeparator rail={isRail} />

      {singleSlot("pointer")}
      {singleSlot("select")}
      <ToolFamilySlot
        family={DRAW_FAMILY}
        member={TOOL_DEF_BY_ID[drawMember]}
        armed={armedTool}
        onArm={setTool}
        available={canDraw}
      />
      <ToolFamilySlot
        family={INSERT_FAMILY}
        member={TOOL_DEF_BY_ID[insertMember]}
        armed={armedTool}
        onArm={setTool}
      />
      {singleSlot("eraser")}

      <ToolSeparator rail={isRail} />

      {moreMenu}
    </div>
  );

  const audienceBar = (
    <AnnotationAudienceBar
      mode={mode}
      delegateLayers={delegateLayers}
      layer={layer}
      setLayer={setLayer}
      voices={voices}
      pendingCount={pendingCount}
      notifySlot={notifySlot}
    />
  );

  const optionsPanel = hasPanel && (
    <div
      className={cn(
        panelChrome,
        "no-scrollbar flex flex-col gap-3",
        isRail ? "max-h-full max-w-xs overflow-y-auto" : "max-w-full",
      )}
    >
      {/* The armed family's members, so a sibling is one tap from the one in
          hand; the slot on the bar then wears whichever was armed last. */}
      {armedFamily && (
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t(armedFamily.labelKey, armedFamily.fallback)}
        >
          {armedFamily.members.map((id) => {
            const { icon: Icon, labelKey, fallback } = TOOL_DEF_BY_ID[id];
            const label = t(labelKey, fallback);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                aria-label={label}
                aria-pressed={armedTool === id}
                aria-keyshortcuts={TOOL_KEYS[id].toUpperCase()}
                title={withKey(label, id)}
                className={cn(
                  pillButton,
                  armedTool === id ? "bg-ink-on-inverse/20" : "hover:bg-ink-on-inverse/10",
                )}
              >
                <Icon size={16} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {/* Which figure the next drag draws — the choice the tool exists for,
          so it comes straight after the family. Circle and square are not
          separate buttons: an oval or a box dragged nearly square snaps to one. */}
      {showShapes && (
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label={t("annotations.shapes.label", "Kształt")}
        >
          {SHAPE_KINDS.map(({ kind, labelKey, fallback }) => {
            const Icon = SHAPE_ICONS[kind];
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setShape(kind)}
                aria-label={t(labelKey, fallback)}
                aria-pressed={shape === kind}
                title={t(labelKey, fallback)}
                className={cn(
                  pillButton,
                  shape === kind ? "bg-ink-on-inverse/20" : "hover:bg-ink-on-inverse/10",
                )}
              >
                <Icon size={16} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

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
                "text-ink-on-inverse",
                fingerDraw === asFinger
                  ? "bg-ink-on-inverse/20"
                  : "hover:bg-ink-on-inverse/10",
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
                size === id
                  ? "bg-ink-on-inverse/20"
                  : "hover:bg-ink-on-inverse/10",
              )}
            >
              <span
                className="rounded-full bg-ink-on-inverse"
                style={{ width: dot, height: dot }}
              />
            </button>
          ))}
        </div>
      )}

      {showInk && (
        <div className="flex flex-col gap-1.5">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t("annotations.ink_color", "Kolor")}
          >
            {inks.map(({ value, nameKey, fallback, dark }) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                aria-label={t(nameKey, fallback)}
                aria-pressed={color === value}
                title={t(nameKey, fallback)}
                className={cn(
                  "h-6 w-6 rounded-full transition-transform hover:scale-110",
                  color === value
                    ? "ring-2 ring-ink-on-inverse ring-offset-1 ring-offset-surface-inverse"
                    : // Pencil on the dark chrome is a hole without an edge.
                      dark
                      ? "ring-1 ring-ink-on-inverse/70"
                      : "ring-1 ring-ink-on-inverse/30",
                )}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
          {/* Said once, where the missing swatch is — the palette is short
              enough that its absence would otherwise read as a bug. */}
          {mode !== "conductor" && (
            <Caption color="ink-on-inverse-muted">
              {t(
                "annotations.ink_reserved",
                "Czerwony jest zarezerwowany dla dyrygenta.",
              )}
            </Caption>
          )}
        </div>
      )}

      {showVoices && (
        <MarkVoicePicker current={voices} onChange={setVoices} surface="chrome" />
      )}

      {showNoteMode && (
        <div className="flex flex-wrap items-center gap-1">
          {NOTE_DISPLAY_MODES.map(({ mode: displayMode, labelKey, fallback }) => (
            <button
              key={displayMode}
              type="button"
              onClick={() => setNoteDisplay(displayMode)}
              aria-pressed={noteDisplay === displayMode}
              className={cn(
                "h-9 rounded-full px-3 text-xs font-medium transition-colors",
                "text-ink-on-inverse",
                noteDisplay === displayMode
                  ? "bg-ink-on-inverse/20"
                  : "hover:bg-ink-on-inverse/10",
              )}
            >
              {t(labelKey, fallback)}
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
            armedStamp && (
              <span className={cn(paperTile, "h-9 w-9 overflow-hidden")}>
                <StampGlyph
                  symbol={stamp}
                  color={color}
                  size={stampSampleSize(armedStamp, stampSampleBox, SAMPLE_TILE_PX)}
                />
              </span>
            )
          }
        />
      )}

      {showStamps && (
        // Thirty symbols in one grid stopped fitting a phone, so the
        // palette shows ONE group at a time. The open group is derived from
        // the armed stamp rather than held separately — that way the symbol
        // in hand is always the one lit up on screen — and picking a group
        // arms its first symbol, so a tab is never a dead end. The groups
        // wrap: a tab scrolled out of a phone's panel is a group nobody finds.
        <div className="flex flex-col gap-1.5">
          <div
            className="flex flex-wrap gap-1"
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
                  "text-ink-on-inverse",
                  activeStampGroup === group
                    ? "bg-ink-on-inverse/20"
                    : "hover:bg-ink-on-inverse/10",
                )}
              >
                {t(labelKey, fallback)}
              </button>
            ))}
          </div>
          <StampPalette
            group={activeStampGroup}
            stamp={stamp}
            color={color}
            onPick={setStamp}
          />
        </div>
      )}
    </div>
  );

  if (isRail) {
    // The strip heads the margin; the rail runs down under it and stops where
    // the viewer's slot stops (above the Kamerton), and the options open to
    // the rail's right, still in the margin.
    return (
      <div className="flex h-full flex-col items-start gap-2">
        {audienceBar}
        <div className="flex min-h-0 flex-1 items-start gap-2">
          {toolBar}
          {optionsPanel}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {toolBar}
      {!audienceInRow && audienceBar}
      {optionsPanel}
    </div>
  );
};
