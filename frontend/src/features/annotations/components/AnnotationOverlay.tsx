/**
 * @file AnnotationOverlay.tsx
 * @description The drawing surface stacked over a single rendered PDF page.
 * Renders highlighter + ink strokes, musical stamps, inline and boxed words and
 * pinned notes and — when editing is allowed — captures pen / highlighter / shape /
 * note / stamp / eraser / selection input and inline note editing. A shape is a
 * drag from corner to corner that lands as ordinary ink (see `lib/shapes`), so
 * from the moment it is placed it is a stroke like any other. All coordinates
 * are normalized (0..1) to the page box so a marking holds its musical position
 * across zoom and devices. Which pointer draws, pans or taps — palm rejection,
 * pinch, the edge-zone page turn — is decided in `lib/useOverlayInput`; this file
 * turns finished gestures into marks.
 * Which existing marks may be erased/edited is decided by the `canModify`
 * predicate — a chorister touches only their personal layer.
 *
 * Three layers draw the page: the finished strokes (`MarkLayer`, memoised and
 * untouched while a line is drawn), the line in progress (`LiveStrokeLayer`,
 * painted per frame outside React), and the placed marks and cards below.
 *
 * EVERY kind of marking answers to a tap, not only the notes: a stroke carries
 * an invisible hit band, a stamp and a note carry their own buttons, and the
 * tapped one opens the card that says who reads it. That card is anchored to
 * the marking (`MarkActionCard`, or `NoteCard` for words) — the question "who
 * sees this?" is asked about one spot of music, so it is answered there, and
 * so is "which voices is it for".
 *
 * With "Zaznacz" in hand, a loop drawn round the music selects the marks in it
 * that this reader may change, and a tap adds or removes one. The selection is
 * held by the page and dies with it. Its frame is dragged to move it, and its
 * card (`SelectionCard`) recolours, readdresses (to a layer or to voices),
 * duplicates, copies or deletes it; each of those is one step of the undo
 * history. The stand's keyboard
 * reaches it through `selectionKeys`: the arrows nudge it, written once the
 * keys rest, and Delete removes it.
 *
 * A pen's eraser end rubs out the marks it passes, whatever tool is in hand.
 * @module features/annotations/components
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ClipboardPaste, Lock, Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";
import type { PdfPageGeometry } from "@/shared/ui/composites/PdfViewer";
import { Text } from "@/shared/ui/primitives/typography";

import { LiveStrokeLayer, type LiveStrokeHandle } from "./LiveStrokeLayer";
import { MarkActionCard } from "./MarkActionCard";
import {
  CARRY_TRANSFORM,
  CARRY_X,
  CARRY_Y,
  HIGHLIGHT_OPACITY,
  MarkLayer,
  STROKE_HIT_MIN_WIDTH,
  strokeWidthPx,
} from "./MarkLayer";
import {
  BOX_MARK_CLASS,
  INLINE_MARK_BACKGROUND,
  INLINE_MARK_CLASS,
  inlineFontSize,
  isOnPageDisplay,
  NoteCard,
} from "./NoteCard";
import { SelectionCard, type PageFrame } from "./SelectionCard";
import {
  isComment,
  isStamp,
  isStroke,
  type AnnotationLayer,
  type AnnotationPatch,
  type CommentPayload,
  type MarkDraft,
  type NoteDisplay,
  type NormPoint,
  type ScoreAnnotation,
  type StampPayload,
  type StrokeMark,
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
import { buildShapePaths, type ShapeKind } from "../lib/shapes";
import { distanceToStroke, isInLoop, markBounds, strokeBounds } from "../lib/markBounds";
import {
  clampShift,
  copyDrafts,
  duplicateShift,
  shiftedContent,
  type MarkClipboard,
  type MarkEdit,
  type PageShift,
  type SelectionKeys,
} from "../lib/selection";
import { pickRecentPhrases, QUICK_PHRASES } from "../lib/quickPhrases";
import {
  canonicalVoices,
  layerTakesVoices,
  sameVoices,
  type VoiceSection,
} from "../lib/voices";
import {
  slopFor,
  surfaceModes,
  useOverlayInput,
  type TraceGesture,
} from "../lib/useOverlayInput";

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
  /** What the shape tool draws; its weight is the pen's `size`. */
  shape: ShapeKind;
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
  /**
   * Whether this writer addresses marks to voices (conductor and leader), so a
   * mark's card offers its voices. A chorister's pencil has one reader.
   */
  voicing: boolean;
  selectedId: string | null;
  /**
   * Marks new to this reader since their last visit. Each carries a soft gold
   * halo for as long as the stand is open — wider and fainter than the
   * selection's, so "new" and "this one" stay two different things.
   */
  newIds: ReadonlySet<string>;
  /** Marks copied from this edition and not yet pasted; null when there are none. */
  clipboard: MarkClipboard | null;
  onSelect: (id: string | null) => void;
  onCreate: (draft: MarkDraft) => void;
  /** Several new marks from one gesture; answers their ids. */
  onCreateMany: (drafts: readonly MarkDraft[]) => string[];
  onUpdate: (id: string, after: AnnotationPatch, before: AnnotationPatch) => void;
  /** Edits to several marks from one gesture. */
  onUpdateMany: (edits: readonly MarkEdit[]) => void;
  onDelete: (id: string) => void;
  /** Several marks thrown away by one gesture. */
  onDeleteMany: (marks: readonly ScoreAnnotation[]) => void;
  onCopy: (marks: readonly ScoreAnnotation[], page: number) => void;
  /**
   * Where this page puts its selection within reach of the stand's keyboard
   * while it holds one: Delete removes it, the arrows nudge it. The page that
   * selected last holds the keys.
   */
  selectionKeys: React.RefObject<SelectionKeys | null>;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const NO_IDS: ReadonlySet<string> = new Set();
/** Names a placed mark's wrapper by its id (`data-mark-id`), so a tap can be matched to it. */
const MARK_ID_ATTR = "data-mark-id";
/** Slack round a placed mark a selection tap still counts as on it. */
const PLACED_TAP_REACH_PX = 4;
/** Air between the selection's frame and the marks it holds. */
const FRAME_PAD_PX = 6;

/**
 * How long the arrow keys must rest before a nudge is written. A held key
 * repeats thirty times a second; each repeat writing every mark would be a
 * request per mark per repeat, and an undo step for each.
 */
const NUDGE_SETTLE_MS = 400;

/** A selection drag: the rows it picked up, and the shift it has reached. */
interface SelectionDrag {
  pointerId: number;
  startX: number;
  startY: number;
  slop: number;
  rows: readonly ScoreAnnotation[];
  moved: boolean;
  shift: PageShift;
}

/** Arrow-key nudges not yet written: the rows they move, how far, and the rest timer. */
interface SelectionNudge {
  rows: readonly ScoreAnnotation[];
  shift: PageShift;
  timer: number;
}

export const AnnotationOverlay = ({
  geometry,
  annotations,
  visibleLayers,
  tool,
  color,
  size,
  textScale,
  stampScale,
  shape,
  noteDisplay,
  stamp,
  layer,
  fingerDraw,
  onTurnPage,
  canEdit,
  canModify,
  inks,
  audiences,
  voicing,
  selectedId,
  newIds,
  clipboard,
  onSelect,
  onCreate,
  onCreateMany,
  onUpdate,
  onUpdateMany,
  onDelete,
  onDeleteMany,
  onCopy,
  selectionKeys,
}: AnnotationOverlayProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { width, height, pageNumber } = geometry;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<LiveStrokeHandle | null>(null);
  const [pendingNote, setPendingNote] = useState<{ x: number; y: number } | null>(null);
  // A composer opened under one tool closes when the tool changes: an anchor
  // left open under the pen would take the next tap on the page as its own.
  useEffect(() => () => setPendingNote(null), [tool]);

  const pageAnnotations = useMemo(
    () =>
      annotations.filter(
        (a) => a.page_number === pageNumber && visibleLayers[layerOf(a)],
      ),
    [annotations, pageNumber, visibleLayers],
  );
  const pageStrokes = useMemo(() => pageAnnotations.filter(isStroke), [pageAnnotations]);

  // A shape's "stroke" holds two points only — where the drag began and where
  // it is now — and the figure is rebuilt from them on every move.
  const { drawing, shaping, selecting, placing, stamping, erasing, browsing } =
    surfaceModes(tool, canEdit);
  const tracing = drawing || selecting;
  const surfaceInteractive = tracing || placing || stamping;
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

  // --- The selection ("Zaznacz") ----------------------------------------------
  // Ids, not rows: a mark edited by the selection's own card is a new row, and
  // it stays selected. Only marks this reader may change are ever in it.
  const [picked, setPicked] = useState<ReadonlySet<string>>(NO_IDS);
  useEffect(() => () => setPicked(NO_IDS), [tool]);
  const selection = useMemo(
    () =>
      selecting ? pageAnnotations.filter((a) => picked.has(a.id) && canModify(a)) : [],
    [canModify, pageAnnotations, picked, selecting],
  );
  const selectionIds = useMemo(() => new Set(selection.map((a) => a.id)), [selection]);
  const singleId = useMemo(
    () => (selectedId === null ? NO_IDS : new Set([selectedId])),
    [selectedId],
  );
  /** What is drawn as selected: the selection's marks, or the one card's mark. */
  const highlighted = selecting ? selectionIds : singleId;

  /**
   * The rows a selection drag picked up. A carried row is drawn shifted by the
   * surface's carry properties; it stops being carried the moment the moved
   * row replaces it, so the mark never flicks back to where it was.
   */
  const [carried, setCarried] = useState<ReadonlyMap<string, ScoreAnnotation> | null>(null);
  const selectionDragRef = useRef<SelectionDrag | null>(null);
  const nudgeRef = useRef<SelectionNudge | null>(null);
  const isCarried = (a: ScoreAnnotation): boolean => carried?.get(a.id) === a;

  const setCarry = (dx: number, dy: number): void => {
    const style = surfaceRef.current?.style;
    style?.setProperty(CARRY_X, `${dx}px`);
    style?.setProperty(CARRY_Y, `${dy}px`);
  };

  // Once no row is still the one the drag picked up, the drag is over for good:
  // a refused move puts back the very row it started from, and that row must
  // then be drawn where it is, not where the hand left it. A keyboard nudge
  // carries the rows the same way.
  useLayoutEffect(() => {
    if (!carried || selectionDragRef.current || nudgeRef.current) return;
    const current = new Map(pageAnnotations.map((a) => [a.id, a]));
    for (const [id, row] of carried) {
      if (current.get(id) === row) return;
    }
    setCarried(null);
  }, [carried, pageAnnotations]);

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
      ? pageAnnotations.filter(isComment).find((a) => a.id === selectedId && canModify(a))
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
   * Per mark here. A selection can be readdressed too, but its card refuses
   * when the loop has taken private remarks alongside marks for others (see
   * `SelectionCard`): a loop round a passage must not be the gesture that
   * hands those remarks to one of the singers.
   */
  const moveMarkLayer = (a: ScoreAnnotation, next: WriteLayer): void => {
    onUpdate(a.id, { layer_name: next }, { layer_name: a.layer_name });
  };

  /** The voice row of a mark's card: offered to a writer who addresses voices,
   *  on a mark whose layer has singing readers. */
  const voicesFor = (a: ScoreAnnotation) =>
    voicing && layerTakesVoices(a.layer_name)
      ? {
          current: canonicalVoices(a.voices),
          onChange: (next: VoiceSection[]) => {
            if (sameVoices(next, a.voices)) return;
            onUpdate(a.id, { voices: next }, { voices: canonicalVoices(a.voices) });
          },
        }
      : null;

  /**
   * A symbol's size while its slider is held, drawn on the page but not yet
   * written. Release commits it as one edit — one request and one undo step —
   * where every tick of the slider used to be both. After the commit the draft
   * holds the size until the mark itself changes (the optimistic patch, or a
   * rollback), so the symbol never flicks back to its old size in between.
   */
  const [scaleDraft, setScaleDraft] = useState<{
    id: string;
    scale: number;
    /** The mark as it stood when the draft was written; null while held. */
    committed: ScoreAnnotation | null;
  } | null>(null);
  if (
    scaleDraft &&
    (actionMark?.id !== scaleDraft.id ||
      (scaleDraft.committed !== null && actionMark !== scaleDraft.committed))
  ) {
    setScaleDraft(null);
  }

  const commitScale = (): void => {
    if (!scaleDraft || scaleDraft.committed || !actionMark || !isStamp(actionMark)) {
      return;
    }
    const current = actionMark.payload;
    if (clampMarkScale(current.scale) === scaleDraft.scale) {
      setScaleDraft(null);
      return;
    }
    onUpdate(
      actionMark.id,
      { payload: { ...current, scale: scaleDraft.scale } },
      { payload: { ...current } },
    );
    setScaleDraft({ ...scaleDraft, committed: actionMark });
  };

  const toNorm = (clientX: number, clientY: number): NormPoint => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return [0, 0];
    return [
      clamp01((clientX - rect.left) / rect.width),
      clamp01((clientY - rect.top) / rect.height),
    ];
  };

  /**
   * The mark this reader may change under a tap, topmost first: a placed mark
   * (measured on screen, where its glyph or words actually sit), then the pen
   * stroke nearest the point, then the highlighter.
   */
  const markAt = ([x, y]: NormPoint): ScoreAnnotation | undefined => {
    const candidates = pageAnnotations.filter((a) => canModify(a));
    const byId = new Map(candidates.map((a) => [a.id, a]));
    const surface = surfaceRef.current;
    if (surface) {
      const box = surface.getBoundingClientRect();
      const cx = box.left + x * box.width;
      const cy = box.top + y * box.height;
      const placed = Array.from(surface.querySelectorAll<HTMLElement>(`[${MARK_ID_ATTR}]`))
        .reverse()
        .find((element) => {
          if (!byId.has(element.getAttribute(MARK_ID_ATTR) ?? "")) return false;
          const r = element.getBoundingClientRect();
          return (
            cx >= r.left - PLACED_TAP_REACH_PX &&
            cx <= r.right + PLACED_TAP_REACH_PX &&
            cy >= r.top - PLACED_TAP_REACH_PX &&
            cy <= r.bottom + PLACED_TAP_REACH_PX
          );
        });
      const hit = placed ? byId.get(placed.getAttribute(MARK_ID_ATTR) ?? "") : undefined;
      if (hit) return hit;
    }
    let best: { mark: StrokeMark; distance: number; pen: boolean } | null = null;
    for (const mark of candidates) {
      if (!isStroke(mark)) continue;
      const distance = distanceToStroke(mark.payload.paths, [x, y], width, height);
      const reach = Math.max(strokeWidthPx(mark, width), STROKE_HIT_MIN_WIDTH) / 2;
      if (distance > reach) continue;
      const pen = mark.annotation_type === "FH";
      if (!best || (pen && !best.pen) || (pen === best.pen && distance < best.distance)) {
        best = { mark, distance, pen };
      }
    }
    return best?.mark;
  };

  /** A tap with "Zaznacz": add the mark under it, or take it out; blank paper clears. */
  const toggleAt = (point: NormPoint): void => {
    const hit = markAt(point);
    setPicked((current) => {
      if (!hit) return NO_IDS;
      const next = new Set(current);
      if (next.has(hit.id)) next.delete(hit.id);
      else next.add(hit.id);
      return next;
    });
  };

  /** A finished drag with a drawing tool becomes ink — or a shape, as ink. */
  const commitStroke = (points: NormPoint[], { tapped }: TraceGesture): void => {
    if (selecting) {
      if (tapped) {
        toggleAt(points[0]);
        return;
      }
      setPicked(
        new Set(
          pageAnnotations
            .filter((a) => canModify(a) && isInLoop(a, points))
            .map((a) => a.id),
        ),
      );
      return;
    }
    if (points.length < 2) return;
    if (shaping) {
      const paths = buildShapePaths(shape, points[0], points[1], width, height);
      if (paths.length === 0) return;
      onCreate({
        page_number: pageNumber,
        annotation_type: "FH",
        payload: { paths, width: strokeFraction("pen", size), shape },
        color,
        layer_name: layer,
      });
      return;
    }
    const isHl = tool === "highlighter";
    onCreate({
      page_number: pageNumber,
      annotation_type: isHl ? "HL" : "FH",
      payload: {
        paths: [points],
        width: strokeFraction(isHl ? "highlighter" : "pen", size),
      },
      color,
      layer_name: layer,
    });
  };

  /** A tap on blank paper with a note or a stamp in hand. */
  const placeAt = ([x, y]: NormPoint): void => {
    // An open composer (or a selected mark) owns the next tap on the page: it
    // closes, nothing is placed. Placing on that same tap would drop a mark
    // under the card the writer was still using.
    if (pendingNote || selectedId) {
      setPendingNote(null);
      onSelect(null);
      return;
    }
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
  };

  const previewStroke = useCallback(
    (points: readonly NormPoint[] | null) => liveRef.current?.draw(points),
    [],
  );

  /**
   * The pen's eraser end rubbing over the page: every mark it passes that this
   * reader may change goes, once, whatever tool is in hand. Remembered per rub,
   * because the mark is still on the page until the erase renders, and an undo
   * brings back the very same id.
   */
  const rubbedRef = useRef<Set<string>>(new Set());
  const rubAt = (point: NormPoint, { first }: { first: boolean }): void => {
    if (first) rubbedRef.current = new Set();
    const hit = markAt(point);
    if (!hit || rubbedRef.current.has(hit.id)) return;
    rubbedRef.current.add(hit.id);
    onDelete(hit.id);
  };

  const { surfaceHandlers } = useOverlayInput({
    surfaceRef,
    tool,
    canEdit,
    fingerDraw,
    onStroke: commitStroke,
    onPreview: previewStroke,
    onTap: placeAt,
    onErase: rubAt,
    onTurnPage,
  });

  // --- The selection's frame: drag to move, tap to add or remove ---------------
  const [frame, setFrame] = useState<PageFrame | null>(null);
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (selection.length === 0 || !surface) {
      setFrame(null);
      return;
    }
    const box = surface.getBoundingClientRect();
    // The surface may be drawn scaled (the viewer's live zoom preview); the
    // frame is placed in the page's own pixels.
    const sx = box.width > 0 ? width / box.width : 1;
    const sy = box.height > 0 ? height / box.height : 1;
    const placedById = new Map(
      Array.from(surface.querySelectorAll<HTMLElement>(`[${MARK_ID_ATTR}]`), (element) => [
        element.getAttribute(MARK_ID_ATTR) ?? "",
        element,
      ]),
    );
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    const grow = (l: number, t: number, r: number, b: number) => {
      left = Math.min(left, l);
      top = Math.min(top, t);
      right = Math.max(right, r);
      bottom = Math.max(bottom, b);
    };
    for (const mark of selection) {
      if (isStroke(mark)) {
        const bounds = strokeBounds(mark.payload.paths);
        if (!bounds) continue;
        const half = strokeWidthPx(mark, width) / 2;
        grow(
          bounds.minX * width - half,
          bounds.minY * height - half,
          bounds.maxX * width + half,
          bounds.maxY * height + half,
        );
        continue;
      }
      const element = placedById.get(mark.id);
      if (element) {
        const r = element.getBoundingClientRect();
        grow(
          (r.left - box.left) * sx,
          (r.top - box.top) * sy,
          (r.right - box.left) * sx,
          (r.bottom - box.top) * sy,
        );
        continue;
      }
      const bounds = markBounds(mark);
      if (bounds) {
        grow(bounds.minX * width, bounds.minY * height, bounds.maxX * width, bounds.maxY * height);
      }
    }
    if (left === Infinity) {
      setFrame(null);
      return;
    }
    const frameLeft = Math.max(0, left - FRAME_PAD_PX);
    const frameTop = Math.max(0, top - FRAME_PAD_PX);
    setFrame({
      left: frameLeft,
      top: frameTop,
      width: Math.min(width, right + FRAME_PAD_PX) - frameLeft,
      height: Math.min(height, bottom + FRAME_PAD_PX) - frameTop,
    });
  }, [height, selection, width]);
  const frameCarried = carried !== null && selection.some(isCarried);

  const cancelSelectionDrag = (): void => {
    selectionDragRef.current = null;
    setCarried(null);
    setCarry(0, 0);
  };

  /** Write a move of these rows as one step: one request per mark, one undo. */
  const writeMove = (rows: readonly ScoreAnnotation[], shift: PageShift): void => {
    onUpdateMany(
      rows.map((a) => ({
        id: a.id,
        before: { payload: a.payload },
        after: { payload: shiftedContent(a, shift).payload },
      })),
    );
  };

  /** Write the nudge the arrow keys have built up. The rows stay carried until
   *  their moved selves arrive, as after a drag. */
  const settleNudge = (): void => {
    const nudge = nudgeRef.current;
    if (!nudge) return;
    nudgeRef.current = null;
    window.clearTimeout(nudge.timer);
    if (nudge.shift.dx === 0 && nudge.shift.dy === 0) {
      cancelSelectionDrag();
      return;
    }
    writeMove(nudge.rows, nudge.shift);
  };

  /** An arrow key: carry the selection a step, and write it once the keys rest. */
  const nudgeSelection = (dxPx: number, dyPx: number): void => {
    if (selection.length === 0 || selectionDragRef.current || width <= 0 || height <= 0) return;
    let nudge = nudgeRef.current;
    if (!nudge) {
      nudge = { rows: selection, shift: { dx: 0, dy: 0 }, timer: 0 };
      nudgeRef.current = nudge;
      setCarry(0, 0);
      setCarried(new Map(selection.map((a) => [a.id, a])));
    }
    window.clearTimeout(nudge.timer);
    nudge.shift = clampShift(nudge.rows, {
      dx: nudge.shift.dx + dxPx / width,
      dy: nudge.shift.dy + dyPx / height,
    });
    setCarry(nudge.shift.dx * width, nudge.shift.dy * height);
    nudge.timer = window.setTimeout(() => keyActions.current.settleNudge(), NUDGE_SETTLE_MS);
  };

  /** Delete or Backspace: a nudge still waiting is dropped with the marks. */
  const removeSelection = (): void => {
    const nudge = nudgeRef.current;
    if (nudge) {
      nudgeRef.current = null;
      window.clearTimeout(nudge.timer);
      cancelSelectionDrag();
    }
    deleteSelection();
  };

  // The keys reach this page's selection through a handle that never changes
  // and reads the newest of these when a key lands.
  const keyActions = useRef({ settleNudge, nudgeSelection, removeSelection });
  keyActions.current = { settleNudge, nudgeSelection, removeSelection };
  const hasSelection = selection.length > 0;
  useEffect(() => {
    if (!hasSelection) return;
    const handle: SelectionKeys = {
      remove: () => keyActions.current.removeSelection(),
      nudge: (dx, dy) => keyActions.current.nudgeSelection(dx, dy),
    };
    selectionKeys.current = handle;
    return () => {
      if (selectionKeys.current === handle) selectionKeys.current = null;
    };
  }, [hasSelection, selectionKeys]);
  // A nudge still settling when the page goes is written, not lost.
  useEffect(() => {
    const actions = keyActions;
    return () => actions.current.settleNudge();
  }, []);

  const beginSelectionDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    // Never the start of a loop, whatever happens next.
    event.stopPropagation();
    if (event.button !== 0) return;
    if (nudgeRef.current) {
      // The keys moved it last: write that first, and let this press go.
      settleNudge();
      return;
    }
    if (selectionDragRef.current) {
      // A second pointer: a pinch is starting, not a drag.
      cancelSelectionDrag();
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setCarry(0, 0);
    selectionDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      slop: slopFor(event.pointerType),
      rows: selection,
      moved: false,
      shift: { dx: 0, dy: 0 },
    };
    setCarried(new Map(selection.map((a) => [a.id, a])));
  };

  const moveSelectionDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = selectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) <= drag.slop) return;
    drag.moved = true;
    drag.shift = clampShift(drag.rows, { dx: dx / box.width, dy: dy / box.height });
    setCarry(drag.shift.dx * width, drag.shift.dy * height);
  };

  const endSelectionDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = selectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    selectionDragRef.current = null;
    if (!drag.moved) {
      cancelSelectionDrag();
      toggleAt(toNorm(event.clientX, event.clientY));
      return;
    }
    if (drag.shift.dx === 0 && drag.shift.dy === 0) {
      cancelSelectionDrag();
      return;
    }
    // The rows stay carried until their moved selves arrive.
    writeMove(drag.rows, drag.shift);
  };

  const recolorSelection = (next: string): void => {
    onUpdateMany(
      selection
        .filter((a) => a.color.toLowerCase() !== next.toLowerCase())
        .map((a) => ({ id: a.id, before: { color: a.color }, after: { color: next } })),
    );
  };

  const readdressSelection = (next: WriteLayer): void => {
    onUpdateMany(
      selection
        .filter((a) => a.layer_name !== next)
        .map((a) => ({
          id: a.id,
          before: { layer_name: a.layer_name },
          after: { layer_name: next },
        })),
    );
  };

  // Only the marks whose layer has singing readers take voices; a private
  // remark caught in the same loop keeps none.
  const voicedSelection = voicing
    ? selection.filter((a) => layerTakesVoices(a.layer_name))
    : [];
  const readdressSelectionVoices = (next: VoiceSection[]): void => {
    onUpdateMany(
      voicedSelection
        .filter((a) => !sameVoices(a.voices, next))
        .map((a) => ({
          id: a.id,
          before: { voices: canonicalVoices(a.voices) },
          after: { voices: next },
        })),
    );
  };
  const selectionVoices = (() => {
    const [first, ...rest] = voicedSelection;
    if (!first) return null;
    return rest.every((a) => sameVoices(a.voices, first.voices))
      ? canonicalVoices(first.voices)
      : null;
  })();

  const duplicateSelection = (): void => {
    const shift = duplicateShift(selection, width, height);
    setPicked(new Set(onCreateMany(copyDrafts(selection, pageNumber, shift, inks))));
  };

  const copySelection = (): void => {
    onCopy(selection, pageNumber);
    toast.success(
      t(
        "annotations.selection.copied",
        "Skopiowane. Otwórz inną stronę tego utworu i wklej je narzędziem Zaznacz.",
      ),
      { id: "annotation-selection-copied" },
    );
  };

  const deleteSelection = (): void => {
    onDeleteMany(selection);
    setPicked(NO_IDS);
  };

  /** Copies land where they were on their own page; on that same page, a step off. */
  const pasteHere = (): void => {
    if (!clipboard) return;
    const shift =
      clipboard.page === pageNumber
        ? duplicateShift(clipboard.marks, width, height)
        : { dx: 0, dy: 0 };
    setPicked(new Set(onCreateMany(copyDrafts(clipboard.marks, pageNumber, shift, inks))));
  };

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

  /** A tap on any existing mark: rub it out, or open the card about it. */
  const handleMarkActivate = (a: ScoreAnnotation) => {
    if (erasing) {
      if (canModify(a)) onDelete(a.id);
      return;
    }
    onSelect(selectedId === a.id ? null : a.id);
  };

  // The memoised stroke layer is handed callbacks that never change, which
  // read the newest of these when a stroke is touched.
  const strokeActions = useRef({ handleMarkActivate, canModify, onDelete });
  strokeActions.current = { handleMarkActivate, canModify, onDelete };
  const activateStroke = useCallback(
    (a: ScoreAnnotation) => strokeActions.current.handleMarkActivate(a),
    [],
  );
  const eraseStroke = useCallback((a: ScoreAnnotation) => {
    const { canModify: mayModify, onDelete: erase } = strokeActions.current;
    if (mayModify(a)) erase(a.id);
  }, []);

  /** The same wash behind a placed mark (a stamp, a note), past its box. The
   *  marker's wrapper is translated, so it is a stacking context of its own and
   *  `-z-10` puts the wash under the mark without leaving the page. */
  const markerHalo = (a: ScoreAnnotation, rounded: string) =>
    newIds.has(a.id) && (
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -inset-2 -z-10 bg-ethereal-gold/25",
          rounded,
        )}
      />
    );

  /** Where a placed mark is drawn: on its anchor, moved by a drag in progress. */
  const markerTransform = (a: ScoreAnnotation, offset: { dx: number; dy: number } | null) =>
    offset
      ? `translate(-50%, -50%) translate(${offset.dx}px, ${offset.dy}px)`
      : isCarried(a)
        ? `translate(-50%, -50%) ${CARRY_TRANSFORM}`
        : "translate(-50%, -50%)";

  const liveLook = selecting ? "loop" : tool === "highlighter" ? "highlight" : "ink";
  const liveWidth = drawing
    ? Math.max(
        tool === "highlighter" ? 4 : 1.5,
        strokeFraction(tool === "highlighter" ? "highlighter" : "pen", size) * width,
      )
    : 1.5;
  const showPaste =
    selecting && clipboard !== null && clipboard.marks.length > 0 && selection.length === 0;

  return (
    // Drawing capture lives on this HTML div (not the SVG): an <svg> with
    // pointer-events:auto only fires on PAINTED areas, so pointerdown on the
    // blank score never started a stroke. The div captures the whole page box.
    <div
      ref={surfaceRef}
      className={cn(
        "absolute inset-0",
        tracing && "cursor-crosshair",
        (placing || stamping) && "cursor-copy",
      )}
      style={{
        width,
        height,
        pointerEvents: surfaceInteractive ? "auto" : "none",
        // Tracing tools own every touch (finger pan is re-implemented manually);
        // tap-to-place tools leave panning to the browser. The eraser's surface
        // stays click-through, but touch-action reaches the hit bands inside
        // it, so rubbing over ink erases instead of scrolling the score.
        touchAction:
          tracing || erasing ? "none" : surfaceInteractive ? "pan-x pan-y" : undefined,
      }}
      {...surfaceHandlers}
    >
      <MarkLayer
        strokes={pageStrokes}
        width={width}
        height={height}
        interactive={strokesInteractive}
        erasing={erasing}
        canModify={canModify}
        selected={highlighted}
        newIds={newIds}
        carried={carried}
        onActivate={activateStroke}
        onErase={eraseStroke}
      />

      {tracing && (
        <LiveStrokeLayer
          ref={liveRef}
          width={width}
          height={height}
          look={liveLook}
          color={color}
          strokeWidth={liveWidth}
          shape={shaping ? shape : null}
          highlightOpacity={HIGHLIGHT_OPACITY}
        />
      )}

      {/* Musical stamps — pure display until the eraser targets an erasable one,
          or browse mode lets the owner drag it. */}
      {pageAnnotations.filter(isStamp).map((a) => {
        const payload = a.payload;
        const def = getStampDef(payload.symbol);
        if (!def) return null;
        const erasable = erasing && canModify(a);
        const modifiable = canModify(a);
        const draggable = arranging && modifiable;
        const offset = dragOffset?.id === a.id ? dragOffset : null;
        const selected = highlighted.has(a.id);
        const scale = scaleDraft?.id === a.id ? scaleDraft.scale : payload.scale;
        return (
          <div
            key={a.id}
            data-annotation-mark
            data-mark-id={a.id}
            className="absolute"
            style={{
              left: payload.x * width,
              top: payload.y * height,
              transform: markerTransform(a, offset),
              pointerEvents: marksInteractive && modifiable ? "auto" : "none",
            }}
          >
            {markerHalo(a, "rounded-xl")}
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
                size={def.sizeFraction * width * clampMarkScale(scale)}
              />
            </button>
          </div>
        );
      })}

      {/* Notes: inline text drawn on the page, or clickable pins. */}
      {pageAnnotations.filter(isComment).map((a) => {
        if (a.id === editingNote?.id) return null;
        const payload = a.payload;
        const inline = isOnPageDisplay(payload.display);
        const boxed = payload.display === "box";
        const isPrivate = isPrivateLayer(a);
        const modifiable = canModify(a);
        const draggable = arranging && modifiable;
        const offset = dragOffset?.id === a.id ? dragOffset : null;
        const selected = highlighted.has(a.id);
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
            data-mark-id={a.id}
            className="absolute"
            style={{
              left,
              top,
              transform: markerTransform(a, offset),
              pointerEvents: marksInteractive ? "auto" : "none",
              maxWidth: inline ? width * 0.5 : undefined,
            }}
          >
            {markerHalo(a, inline ? "rounded-xl" : "rounded-full")}
            {inline ? (
              <button
                type="button"
                onClick={onMarkerClick}
                {...dragHandlers}
                aria-label={payload.text}
                aria-pressed={selected}
                className={cn(
                  boxed ? BOX_MARK_CLASS : INLINE_MARK_CLASS,
                  "relative transition-shadow",
                  // The ring colour is named, never left to default: this
                  // button sets `color` to the note's own ink below, and
                  // Tailwind's default ring is `currentColor` — so an unnamed
                  // ring would outline the mark in its own colour.
                  selected ? "ring-2 ring-ethereal-gold" : !boxed && "ring-black/10",
                  erasing && modifiable && "cursor-pointer hover:ring-ethereal-crimson",
                  draggable && "touch-none",
                )}
                style={{
                  color: a.color,
                  backgroundColor: INLINE_MARK_BACKGROUND,
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
                aria-pressed={selected}
                onClick={onMarkerClick}
                {...dragHandlers}
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md ring-2 transition-transform hover:scale-110",
                  // Gold is the panel's "this is the one", and the pin's
                  // resting rim is a light hairline against the page — the two
                  // have to differ in HUE, because a difference in opacity
                  // alone is a selection state nobody can see.
                  selected ? "ring-ethereal-gold" : "ring-white/80",
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

      {/* The selection's frame: the handle that moves it. A press inside it is
          a drag or a tap on a mark, never the start of a new loop. */}
      {selecting && frame && (
        <div
          aria-hidden="true"
          data-annotation-mark
          className="absolute touch-none rounded-sm border border-dashed border-ethereal-gold"
          style={{
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
            pointerEvents: "auto",
            cursor: frameCarried ? "grabbing" : "move",
            transform: frameCarried ? CARRY_TRANSFORM : undefined,
          }}
          onPointerDown={beginSelectionDrag}
          onPointerMove={moveSelectionDrag}
          onPointerUp={endSelectionDrag}
          onPointerCancel={cancelSelectionDrag}
        />
      )}

      {selecting && frame && !frameCarried && selection.length > 0 && (
        <SelectionCard
          marks={selection}
          frame={frame}
          width={width}
          height={height}
          inks={inks}
          audiences={audiences}
          onChangeLayer={readdressSelection}
          voices={
            voicedSelection.length > 0
              ? { current: selectionVoices, onChange: readdressSelectionVoices }
              : null
          }
          onChangeColor={recolorSelection}
          onDuplicate={duplicateSelection}
          onCopy={copySelection}
          onDelete={deleteSelection}
          onClose={() => setPicked(NO_IDS)}
        />
      )}

      {/* Marks copied from another page wait here, on any page of the piece. */}
      {showPaste && (
        <div
          data-annotation-mark
          className="absolute left-1/2 top-3 z-20 -translate-x-1/2"
          style={{ pointerEvents: "auto" }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={pasteHere}
            className="flex items-center gap-1.5 rounded-full border border-hairline-strong bg-ethereal-marble px-3 py-1.5 text-ethereal-ink shadow-glass-ethereal transition-colors hover:text-ethereal-gold"
          >
            <ClipboardPaste size={15} aria-hidden="true" />
            <Text as="span" size="sm" color="inherit">
              {t("annotations.selection.paste", {
                n: clipboard.marks.length,
                defaultValue: "Wklej ({{n}})",
              })}
            </Text>
          </button>
        </div>
      )}

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
          const payload = editingNote.payload;
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
              initialDisplay={
                payload.display === "inline" || payload.display === "box" ? payload.display : "pin"
              }
              initialScale={clampMarkScale(payload.scale)}
              showDelete
              audience={{
                current: layerOf(editingNote),
                options: audiences,
                onChange: (next) => moveMarkLayer(editingNote, next),
              }}
              voices={voicesFor(editingNote)}
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
          voices={voicesFor(actionMark)}
          onChangeColor={(next) =>
            onUpdate(actionMark.id, { color: next }, { color: actionMark.color })
          }
          previewScale={scaleDraft?.id === actionMark.id ? scaleDraft.scale : null}
          onPreviewScale={(next) =>
            setScaleDraft({ id: actionMark.id, scale: next, committed: null })
          }
          onCommitScale={commitScale}
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
