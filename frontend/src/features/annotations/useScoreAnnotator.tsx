/**
 * @file useScoreAnnotator.tsx
 * @description One-call binding that turns an edition id + annotator mode into
 * the slots PdfViewer needs: a `toolbarSlot`, a `renderPageOverlay` (the drawing
 * surface), an `overlaySlot` (the annotation index, the live notice), a
 * `modalSlot` (the guide) and an `onPageApiChange` handler. Three modes: `conductor` (managers — write
 * to the choir, leader and private reaches, and may move a placed mark between
 * them), `leader` (a project leader whose grant opens a layer beside their
 * pencil — the choir's, the desk they share with the conductor, or both; the
 * next mark goes to one of them, and only their own rows are theirs to touch on
 * any) and `personal` (everyone else — every mark lands on the user's own
 * private layer; what the conductor wrote stays read-only). Owns tool state,
 * the per-edition cache, optimistic
 * create/update/delete, undo/redo history, keyboard shortcuts and the lifetime
 * of the selection — so callers stay a few lines thin.
 *
 * Every key reaches it through the viewer (`claimKey`), ahead of the viewer's
 * own shortcuts: the arrows that turn a page also nudge a selection, and the
 * selection has to win — except in performance mode, where they come from a
 * page-turn pedal.
 *
 * Selection and the active tool are bounded here rather than in the overlay,
 * because the reader can leave either one from outside the drawing surface:
 * they erase a mark, turn the page, or press Escape.
 *
 * It also keeps track of what is new to the reader, the conductor included:
 * marks someone else wrote for them since their last visit carry a halo and a
 * "Nowe" list in the drawer, and one dismissible line sums them up on open and
 * announces what arrives while the stand is open — the conductor writing
 * mid-rehearsal, or an assistant answering him — because a mark that lands
 * three pages away would otherwise never be found.
 *
 * Marks may be addressed to voices (`lib/voices`). A mark for another section
 * is never news to this reader, and under "Mój głos + tutti" it leaves their
 * page too. Their section is the one their seat on this music answers to, as
 * the server tells it; a reader with none is shown everything.
 *
 * For the conductor it carries the two gestures over the choir's marks as a
 * whole: the drawer puts an edition's marks aside and brings a set back (which
 * ends that edition's undo history), and a stand opened from a project tells its
 * choir about new marks from the toolbar — in the concert book from its title
 * page too, where there is nothing to draw on.
 *
 * The selection itself belongs to the page, but what it copies is held here,
 * per edition: it is pasted on another page of the same piece, and in the book
 * a walk through the next piece and back finds it still waiting.
 *
 * A jump link is placed with two taps, and the first is held here rather than
 * by a page, because the second lands where the D.S. leads, pages away. Every
 * reader follows a link with a tap, and the stand then offers the way back.
 * @module features/annotations
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";
import { isEditableTarget } from "@/shared/lib/dom/editableTarget";
import type {
  PdfPageApi,
  PdfPageGeometry,
} from "@/shared/ui/composites/PdfViewer";

import { AnnotationOverlay, type LinkStart } from "./components/AnnotationOverlay";
import { LinkStatusChip, type LinkStatus } from "./components/LinkStatusChip";
import { AnnotationToolbar, BareToolbar } from "./components/AnnotationToolbar";
import { ANNOTATION_DRAWER_ATTR, AnnotationSidebar } from "./components/AnnotationSidebar";
import { AnnotationGuide } from "./components/AnnotationGuide";
import { IncomingMarksNotice } from "./components/IncomingMarksNotice";
import { NotifyChoirButton } from "./components/NotifyChoirButton";
import {
  useAnnotationMutations,
  useMarkSeen,
  useScoreAnnotations,
} from "./api/annotations.queries";
import {
  DRAWING_TOOLS,
  TOOL_KEYS,
  useAnnotationTools,
  type AnnotationTool,
} from "./lib/useAnnotationTools";
import { useAnnotationHistory } from "./lib/useAnnotationHistory";
import { useCanDraw } from "./lib/useCanDraw";
import { useIncomingMarks } from "./lib/useIncomingMarks";
import { CARD_ATTR } from "./lib/useOverlayInput";
import { bookFocusY, bookPageFor, type ScoreBook } from "./lib/scoreBook";
import { layerOf, WRITE_LAYERS, type WriteLayer } from "./lib/layers";
import {
  canonicalVoices,
  isAddressedTo,
  layerTakesVoices,
  reachesSections,
  voicesAddressLayer,
} from "./lib/voices";
import type { MarkClipboard, MarkEdit, SelectionKeys } from "./lib/selection";
import {
  isComment,
  type AnnotationPatch,
  type LinkMark,
  type MarkDraft,
  type NormPoint,
  type ScoreAnnotation,
} from "./types/annotations.dto";

export type ScoreAnnotatorMode = "conductor" | "leader" | "personal";

/**
 * A layer a leader's grant opens beside their own pencil: the choir's
 * (`choir_marks`), or the desk they share with the conductor (`marks`).
 */
export type DelegateLayer = "shared" | "leader";

/** Which stand a reader gets on one piece, and what their pencil reaches there. */
export interface ScoreStandAccess {
  mode: ScoreAnnotatorMode;
  delegateLayers: readonly DelegateLayer[];
}

const NO_DELEGATE_LAYERS: readonly DelegateLayer[] = [];

/**
 * The role decides first — a manager writes everywhere regardless of any
 * grant — and only then the per-piece facts the songbook carries
 * (`MaterialsPiece.may_mark_for_choir`, `may_mark_with_conductor`). Every mount
 * that opens a score for a non-manager goes through this so the three surfaces
 * (piece row, piece page, concert book) cannot disagree about one pencil.
 */
export const scoreStandAccessFor = ({
  isManager,
  mayMarkForChoir,
  mayMarkWithConductor,
}: {
  isManager: boolean;
  mayMarkForChoir: boolean;
  mayMarkWithConductor: boolean;
}): ScoreStandAccess => {
  if (isManager) return { mode: "conductor", delegateLayers: NO_DELEGATE_LAYERS };
  const delegateLayers: DelegateLayer[] = [];
  if (mayMarkForChoir) delegateLayers.push("shared");
  if (mayMarkWithConductor) delegateLayers.push("leader");
  return {
    mode: delegateLayers.length > 0 ? "leader" : "personal",
    delegateLayers,
  };
};

export interface UseScoreAnnotatorOptions {
  /**
   * Edition whose markings to load; null disables fetching (viewer closed).
   * Ignored in book mode, where the edition is whichever one the page in front
   * of the reader was bound from.
   */
  editionId: string | null;
  /**
   * conductor → managers: draw on the shared/leader/conductor layers, clear
   *             wipes all three.
   * leader    → a project leader whose grant opens `delegateLayers` on this
   *             piece: the next mark goes to their own pencil or to one of
   *             those (a choice, not a ladder), and on every layer only THEIR
   *             rows are theirs to move or erase — the conductor's marks stay
   *             his, his cues on the shared desk included.
   * personal  → everyone else: write only their own private layer
   *             (server-scoped); the conductor's shared markings are visible but
   *             read-only, and so are his leader cues for whoever was handed the
   *             evening. Running a rehearsal does NOT make this "conductor":
   *             a stand-in reads the conductor's hand, they do not write in it.
   */
  mode: ScoreAnnotatorMode;
  /** In `leader` mode, the layers the grant opens; ignored in the others. */
  delegateLayers?: readonly DelegateLayer[];
  /**
   * The concert binder's map. Present → the document on screen is the book, and
   * each page is one edition's page placed inside a rectangle. Writes still land
   * on the EDITION, which is what makes a mark drawn in the binder the same mark
   * when the piece is later opened on its own.
   */
  book?: ScoreBook | null;
  /**
   * False while no score is on screen: a stand that is closed, or a preview
   * pane this width does not mount. The marks stay loaded — a closing dialog
   * still draws them through its exit — but nothing polls for new ones and no
   * undo shortcut is bound. Defaults to true.
   */
  active?: boolean;
  /**
   * The project this stand was opened from, passed only when the reader may
   * tell its choir about new marks (a manager or the podium conductor). The
   * toolbar then carries "Powiadom chór" for it.
   */
  notifyProjectId?: string | null;
}

export interface ScoreAnnotatorBindings {
  toolbarSlot: React.ReactNode;
  renderPageOverlay: (geometry: PdfPageGeometry) => React.ReactNode;
  overlaySlot: React.ReactNode;
  /** The guide, which covers the viewer's chrome — see `PdfViewerProps.modalSlot`. */
  modalSlot: React.ReactNode;
  onPageApiChange: (api: PdfPageApi) => void;
  /** The annotator's first claim on a key — see `PdfViewerProps.claimKey`. */
  claimKey: (event: KeyboardEvent) => boolean;
  annotationCount: number;
  /** The live page handle, for chrome outside the annotator (a programme bar). */
  pageApi: PdfPageApi;
}

const TOOL_BY_KEY: ReadonlyMap<string, AnnotationTool> = new Map(
  (Object.entries(TOOL_KEYS) as [AnnotationTool, string][]).map(([tool, key]) => [key, tool]),
);

/** Which way each arrow key nudges a selection. */
const NUDGE_DIRECTIONS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
/** A nudge, in screen pixels: one for the fine adjustment, ten with Shift. */
const NUDGE_STEP_PX = 1;
const NUDGE_LONG_STEP_PX = 10;
/**
 * How near the first end of a link a second tap counts as a tap on it, in page
 * widths: about a fingertip on a phone held upright.
 */
const LINK_UNDO_REACH = 0.03;

export const useScoreAnnotator = ({
  editionId,
  mode,
  delegateLayers = NO_DELEGATE_LAYERS,
  book = null,
  active = true,
  notifyProjectId = null,
}: UseScoreAnnotatorOptions): ScoreAnnotatorBindings => {
  const isConductor = mode === "conductor";
  const isLeader = mode === "leader";
  // Two flags rather than the caller's list, so a list rebuilt on every render
  // of the page that opened the stand does not rebuild every callback below.
  const writesShared = isLeader && delegateLayers.includes("shared");
  const writesLeader = isLeader && delegateLayers.includes("leader");
  const reach = useMemo<readonly DelegateLayer[]>(
    () => [
      ...(writesShared ? (["shared"] as const) : []),
      ...(writesLeader ? (["leader"] as const) : []),
    ],
    [writesLeader, writesShared],
  );
  const { user } = useAuth();
  // Normalised once: the wire's `created_by` is the user's UUID as a string.
  const userId = user ? String(user.id) : null;
  const tools = useAnnotationTools(
    isConductor ? "shared" : "personal",
    isConductor,
  );
  const activeTool = tools.tool;
  const setTool = tools.setTool;
  /** The page that selected last puts its selection here (see `SelectionKeys`). */
  const selectionKeysRef = useRef<SelectionKeys | null>(null);
  // Every change of tool, from the bar, a key or Escape. A nudge still
  // settling is written first, for the reason `undo` gives.
  const setActiveTool = useCallback(
    (next: AnnotationTool) => {
      selectionKeysRef.current?.flush();
      setTool(next);
    },
    [setTool],
  );
  // Which of the VISIBLE marks this user may erase / edit. The server already
  // scopes reads (a chorister receives shared + own personal; a manager never
  // receives other users' personal), so layer membership is enough — except
  // for a leader, whose marks on the choir's layer and on the shared desk sit
  // beside the conductor's: there the row's author is the only thing that
  // tells the two hands apart, which is exactly the rule the server applies to
  // their writes.
  const canModify = useCallback(
    (a: ScoreAnnotation) => {
      if (isConductor) return true;
      if (a.layer_name === "personal") return true;
      if (a.created_by !== userId) return false;
      return (
        (writesShared && a.layer_name === "shared") ||
        (writesLeader && a.layer_name === "leader")
      );
    },
    [isConductor, userId, writesLeader, writesShared],
  );

  // Clear mirrors the server rule: managers wipe every layer that is not
  // somebody's personal — the leader layer included, the assistant's answers
  // with it — while everyone else wipes only their own marks: the pencil
  // layer, plus (for a leader) what they themselves put on the layers their
  // grant opens.
  const isCleared = useCallback(
    (a: ScoreAnnotation) =>
      isConductor ? a.layer_name !== "personal" : canModify(a),
    [canModify, isConductor],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [linkStart, setLinkStart] = useState<LinkStart | null>(null);
  // The first end of a link belongs to the tool: put it down, and the half
  // placed link goes with it.
  useEffect(() => {
    if (activeTool !== "link") setLinkStart(null);
  }, [activeTool]);
  /** Where the last followed link was tapped, as the document open numbers it. */
  const [returnTo, setReturnTo] = useState<{ page: number; y: number } | null>(null);
  // A closed stand stays mounted; the way back belongs to the visit it was made in.
  useEffect(() => {
    if (!active) setReturnTo(null);
  }, [active]);
  const [pageApi, setPageApi] = useState<PdfPageApi>({
    currentPage: 1,
    numPages: null,
    goToPage: () => {},
    turnPage: () => {},
    pageWidth: null,
  });

  /**
   * Whose markings are in play. A single edition answers this once; the binder
   * answers it per page, because the reader turning from the Kyrie to the
   * Gloria has walked from one publisher's engraving into another's. Front
   * matter — title page, table of contents, a divider card — belongs to no
   * edition, and there the stand is simply a reader with no pencil.
   */
  const activeEditionId = book
    ? (book.frames.get(pageApi.currentPage)?.edition ?? null)
    : editionId;

  // The next mark's voices belong to one piece on one open stand: closing the
  // stand, or turning into the next piece of the book, starts again at tutti.
  const setNextVoices = tools.setVoices;
  useEffect(() => {
    setNextVoices([]);
  }, [active, activeEditionId, setNextVoices]);

  const {
    annotations: allAnnotations,
    pendingCount,
    isLoaded,
    isSettled,
    seenAt,
    readerSections,
  } = useScoreAnnotations(activeEditionId, {
    isCleared,
    // Only a score on screen can show a mark the conductor is writing now.
    live: active && !!activeEditionId,
  });

  // "Mój głos + tutti": the marks for other sections leave the page, the
  // drawer and the clear alike, so what the reader acts on is what they see.
  // A reader whose seat names no section has nothing to filter by.
  const filteringVoices = tools.voiceFilter === "mine" && readerSections !== "";
  const annotations = useMemo(
    () =>
      filteringVoices
        ? allAnnotations.filter((a) => isAddressedTo(a, readerSections, userId))
        : allAnnotations,
    [allAnnotations, filteringVoices, readerSections, userId],
  );
  // What "Odłóż uwagi" would take: every layer but the personal pencil, whatever
  // the reader has hidden or filtered.
  const setAsideCount = useMemo(
    () => allAnnotations.filter((a) => layerOf(a) !== "personal").length,
    [allAnnotations],
  );
  // Whether the filter has anything to do on this edition: a voice on a leader
  // cue is a label, and filters nothing.
  const hasVoicedMarks = useMemo(
    () =>
      allAnnotations.some(
        (a) => voicesAddressLayer(a.layer_name) && canonicalVoices(a.voices).length > 0,
      ),
    [allAnnotations],
  );
  // What is news to this reader is what reaches their voice, whether or not
  // they chose to see the rest.
  const addressedToReader = useMemo(
    () => allAnnotations.filter((a) => reachesSections(a, readerSections)),
    [allAnnotations, readerSections],
  );

  const {
    createMark,
    updateMark,
    eraseMark,
    clearMarks,
    reviveMarks,
    draftAnnotation,
  } = useAnnotationMutations(activeEditionId, { authorId: userId });

  // Freehand needs a page large enough for a stroke to mean something — which
  // the reader can reach by zooming or by switching the fit, on any device.
  // Notes, stamps, eraser and browse stay everywhere.
  const canDraw = useCanDraw({
    pageWidth: pageApi.pageWidth,
    stylusSeen: tools.stylusSeen,
  });

  // Coerce precision tools back to browse while the page is too small to write
  // on — a pen held over a thumbnail would only produce marks nobody can place.
  const effectiveTool = useMemo(() => {
    if (!canDraw && DRAWING_TOOLS.has(activeTool)) return "pointer" as const;
    return activeTool;
  }, [activeTool, canDraw]);

  // Every gesture goes through the history, so each step holds the write it
  // made and an undo can act on what that write came to.
  const history = useAnnotationHistory({
    editionId: activeEditionId,
    createMark,
    updateMark,
    eraseMark,
    clearMarks,
    reviveMarks,
  });
  const {
    undo: undoStep,
    redo: redoStep,
    create: recordCreate,
    update: recordUpdate,
    erase: recordErase,
    clear: recordClear,
    group: recordGroup,
    reset: resetHistory,
  } = history;

  /**
   * Undo and redo write a nudge still settling first (`SelectionKeys.flush`),
   * so it is a step of its own beneath them. Written after them, it would land
   * late: an undo would take back the step before the nudge, and the nudge,
   * holding rows read before the undo, would write to a mark the undo had just
   * removed and empty the redo stack.
   */
  const undo = useCallback(() => {
    selectionKeysRef.current?.flush();
    undoStep();
  }, [undoStep]);
  const redo = useCallback(() => {
    selectionKeysRef.current?.flush();
    redoStep();
  }, [redoStep]);

  // Reset transient editor state when a different score opens — in the binder
  // that is also a page turn into the next piece, which is right: a note
  // selected in the Kyrie is not a note selected in the Gloria.
  // A link half placed in one piece cannot lead into another, either.
  useEffect(() => {
    setSelectedId(null);
    setGuideOpen(false);
    setLinkStart(null);
  }, [activeEditionId]);

  // The page's callbacks keep one identity while the marks change under them:
  // the erase reads the list when it runs, not when it was made.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  // Read when a mark lands, so the page's callback keeps its identity while the
  // writer picks voices.
  const nextVoicesRef = useRef(tools.voices);
  nextVoicesRef.current = tools.voices;

  const handleCreate = useCallback(
    (partial: MarkDraft): string | null => {
      const voices = nextVoicesRef.current;
      const addressed =
        mode !== "personal" && voices.length > 0 && layerTakesVoices(partial.layer_name)
          ? { ...partial, voices: [...voices] }
          : partial;
      const draft = draftAnnotation(addressed);
      if (!draft) return null;
      // Recorded from the DRAFT, not the server's reply: the id is minted here
      // and never changes, so undo works on a mark the network has not yet
      // heard of — which is the whole point of drawing in a basement.
      recordCreate(draft);
      return draft.id;
    },
    [draftAnnotation, mode, recordCreate],
  );

  const handleCreateMany = useCallback(
    (partials: readonly MarkDraft[]): string[] => {
      const drafts = partials.flatMap((partial) => {
        const draft = draftAnnotation(partial);
        return draft ? [draft] : [];
      });
      recordGroup(drafts.map((annotation) => ({ kind: "create", annotation })));
      return drafts.map((draft) => draft.id);
    },
    [draftAnnotation, recordGroup],
  );

  const handleUpdate = useCallback(
    (id: string, after: AnnotationPatch, before: AnnotationPatch) => {
      recordUpdate(id, before, after);
    },
    [recordUpdate],
  );

  const handleUpdateMany = useCallback(
    (edits: readonly MarkEdit[]) => {
      recordGroup(edits.map(({ id, before, after }) => ({ kind: "update", id, before, after })));
    },
    [recordGroup],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const target = annotationsRef.current.find((a) => a.id === id);
      if (target) recordErase(target);
      // Wherever the erase came from — the card, the eraser, an undo — a mark
      // that is gone cannot stay selected, or its card outlives it.
      setSelectedId((current) => (current === id ? null : current));
    },
    [recordErase],
  );

  // One request that names exactly these marks, undone as themselves — the
  // same write the trash makes, bounded to the selection.
  const handleDeleteMany = useCallback(
    (marks: readonly ScoreAnnotation[]) => {
      recordClear(marks);
      setSelectedId((current) => (marks.some((a) => a.id === current) ? null : current));
    },
    [recordClear],
  );

  const [clipboard, setClipboard] = useState<MarkClipboard | null>(null);
  const handleCopy = useCallback(
    (marks: readonly ScoreAnnotation[], page: number) => {
      if (!activeEditionId || marks.length === 0) return;
      setClipboard({ editionId: activeEditionId, page, marks });
    },
    [activeEditionId],
  );
  // Marks are pasted into the piece they were copied from, and nowhere else.
  const editionClipboard = clipboard?.editionId === activeEditionId ? clipboard : null;

  const clearableCount = useMemo(
    () => annotations.filter(isCleared).length,
    [annotations, isCleared],
  );

  const handleClearAll = useCallback(() => {
    if (!activeEditionId) return;
    // The clear names exactly what the page shows as clearable — queued marks
    // included — so a late replay cannot take a mark drawn after it, and undo
    // brings back exactly these.
    recordClear(annotations.filter(isCleared));
  }, [activeEditionId, annotations, isCleared, recordClear]);

  /**
   * Selecting from a REMOTE surface — the index in the drawer — where the
   * reader has just travelled to a mark and browse is what they meant. A
   * selection made on the page itself deliberately does NOT drop the tool:
   * taking the pencil out of a writer's hand mid-run is the stiffness the
   * `arranging` rule was written to avoid.
   */
  const handleSelectMark = useCallback(
    (id: string) => {
      setSelectedId(id);
      setActiveTool("pointer");
    },
    [setActiveTool],
  );

  /**
   * The reaches a placed mark may be moved BETWEEN, for this reader.
   *
   * Empty in personal mode: a chorister's mark has exactly one possible
   * audience, so offering a ladder there would name layers that mean nothing to
   * them. Empty for a leader too: the ladder is a ladder of AUDIENCES, and
   * their own pencil is not one — a mark that landed on the wrong side of the
   * toolbar's toggle is erased and drawn again, not promoted. The overlay
   * renders the control from this list alone, which is what keeps it free of
   * any notion of "mode".
   */
  const audiences = useMemo<readonly WriteLayer[]>(
    () => (isConductor ? WRITE_LAYERS : []),
    [isConductor],
  );

  /**
   * Escape leaves annotation mode before performance mode or a wrapping dialog
   * see it — and so does the system back gesture, which the score's dialog
   * routes through here. The guide is the topmost layer and closes first.
   *
   * The key is claimed whole, even from inside a note's composer. Putting the
   * note tool down closes a new note's composer (the overlay resets it with the
   * tool) and dropping the selection closes an edited one, so there is nothing
   * left for the composer's own handler to do; letting the key travel on would
   * hand it to the dialog, which closes the score.
   *
   * The drawer's search field is the exception: the reader is talking to the
   * field, not to the pen or the selection. The key goes on to the viewer,
   * which takes the field's focus away and keeps the score open.
   *
   * A pen held while the page is too small to write on is shown as browse,
   * and Escape reads it as browse: the first Escape is the one the reader
   * sees, never one spent on a tool the bar does not show.
   */
  const claimEscape = useCallback(
    (event: KeyboardEvent): boolean => {
      if (guideOpen) {
        event.preventDefault();
        event.stopPropagation();
        setGuideOpen(false);
        return true;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest(`[${ANNOTATION_DRAWER_ATTR}]`) && isEditableTarget(target)) {
        return false;
      }
      if (selectedId === null && effectiveTool === "pointer") return false;
      if (selectedId !== null) setSelectedId(null);
      if (activeTool !== "pointer") setActiveTool("pointer");
      event.preventDefault();
      event.stopPropagation();
      return true;
    },
    [activeTool, effectiveTool, guideOpen, selectedId, setActiveTool],
  );

  /**
   * Every key the viewer offers, before its own shortcuts take it. Besides
   * Escape, only while a score is on screen — otherwise a stray Ctrl+Z anywhere
   * in the app would replay annotation history against a closed viewer. The
   * viewer offers no key typed into a field, so nothing here asks again.
   *
   * While the guide is open it takes every key: nothing behind it turns a page,
   * moves or deletes a mark, or arms a tool. Escape closes it. The rest are
   * claimed without `preventDefault`, so they still scroll the guide and Tab
   * still moves through it.
   *
   * - Ctrl/⌘+Z undoes; Ctrl/⌘+Shift+Z and Ctrl/⌘+Y redo.
   * - Delete or Backspace removes the selection, or the one mark whose card is
   *   open. A note is left out: its card is a composer, and a Backspace there
   *   that missed the words would throw the note away.
   * - The arrows nudge a selection a pixel, ten with Shift; with nothing
   *   selected, and always in performance mode (where a page-turn pedal sends
   *   them), they stay the viewer's page turns.
   * - One letter arms each tool (`TOOL_KEYS`). A pen tool on a page too small
   *   to write on is not armed: the toolbar holds its slot dimmed there too.
   *   Nor is any tool while a card beside a mark holds focus (`CARD_ATTR`).
   */
  const claimKey = useCallback(
    (event: KeyboardEvent): boolean => {
      if (event.key === "Escape") return claimEscape(event);
      if (guideOpen) return true;
      if (!active || !activeEditionId) return false;
      if (event.ctrlKey || event.metaKey) {
        if (event.altKey) return false;
        const key = event.key.toLowerCase();
        if (key === "z" && !event.shiftKey) {
          event.preventDefault();
          undo();
          return true;
        }
        if ((key === "z" && event.shiftKey) || key === "y") {
          event.preventDefault();
          redo();
          return true;
        }
        return false;
      }
      if (event.altKey) return false;
      const selection = selectionKeysRef.current;
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selection) {
          event.preventDefault();
          selection.remove();
          return true;
        }
        const target = annotationsRef.current.find((a) => a.id === selectedId);
        if (!target || isComment(target) || !canModify(target)) return false;
        event.preventDefault();
        handleDelete(target.id);
        return true;
      }
      const direction = NUDGE_DIRECTIONS[event.key];
      if (direction) {
        if (!selection) return false;
        const step = event.shiftKey ? NUDGE_LONG_STEP_PX : NUDGE_STEP_PX;
        if (!selection.nudge(direction[0] * step, direction[1] * step)) return false;
        event.preventDefault();
        return true;
      }
      if (event.shiftKey || event.repeat) return false;
      if (event.target instanceof Element && event.target.closest(`[${CARD_ATTR}]`)) {
        return false;
      }
      const next = TOOL_BY_KEY.get(event.key.toLowerCase());
      if (!next || (!canDraw && DRAWING_TOOLS.has(next))) return false;
      event.preventDefault();
      setActiveTool(next);
      return true;
    },
    [
      active,
      activeEditionId,
      canDraw,
      canModify,
      claimEscape,
      guideOpen,
      handleDelete,
      redo,
      selectedId,
      setActiveTool,
      undo,
    ],
  );

  /**
   * The page a marking is ON, in the document actually open. A mark records the
   * edition's page and nothing else, so in the binder every offer to go to one
   * — the index, the "the conductor just wrote this" notice — has to be
   * translated, and its page number has to be RELABELLED too: telling a singer
   * looking at book page 37 that their note is on page 2 is worse than saying
   * nothing.
   */
  const displayPage = useCallback(
    (sourcePage: number): number => {
      if (!book || !activeEditionId) return sourcePage;
      return (
        bookPageFor(book, activeEditionId, sourcePage, pageApi.currentPage) ??
        sourcePage
      );
    },
    [activeEditionId, book, pageApi.currentPage],
  );

  /**
   * The page a link leads to, in the document open, or null when the book does
   * not bind it: the item was trimmed or its PDF replaced since the link was
   * placed. Read as a book page, the edition's own number would land in
   * another piece, so such a link cannot be followed.
   */
  const linkTargetPage = useCallback(
    (sourcePage: number): number | null => {
      if (!book || !activeEditionId) return sourcePage;
      return bookPageFor(book, activeEditionId, sourcePage, pageApi.currentPage);
    },
    [activeEditionId, book, pageApi.currentPage],
  );

  /** A mark's own height on the page on screen — see `bookFocusY`. */
  const displayFocusY = useCallback(
    (sourcePage: number, y: number): number => {
      if (!book || !activeEditionId) return y;
      const page = bookPageFor(book, activeEditionId, sourcePage, pageApi.currentPage);
      return page === null ? y : bookFocusY(book, page, y);
    },
    [activeEditionId, book, pageApi.currentPage],
  );

  /**
   * A selection is a selection of something ON SCREEN: the card is anchored to
   * the page box, so a mark left selected on a page the reader has turned away
   * from would hold an invisible card and a live delete button. Written as a
   * predicate rather than a page-change reflex because the index JUMPS to the
   * mark's page while selecting it — "is it here" is order-safe, "did the page
   * move" is not.
   */
  useEffect(() => {
    if (!selectedId) return;
    const target = annotations.find((a) => a.id === selectedId);
    if (target && displayPage(target.page_number) !== pageApi.currentPage) {
      setSelectedId(null);
    }
  }, [annotations, displayPage, pageApi.currentPage, selectedId]);

  /**
   * Whether this reader is actually being handed cues for an evening they are
   * running. Their presence IS the permission — the server sends the layer to
   * nobody else — so it is also the only honest trigger for explaining it.
   */
  const hasLeaderMarks = useMemo(
    () => allAnnotations.some((a) => layerOf(a) === "leader"),
    [allAnnotations],
  );

  const markSeen = useMarkSeen();
  const incoming = useIncomingMarks({
    annotations: addressedToReader,
    isLoaded,
    isSettled,
    editionId: activeEditionId,
    // A closed stand is a reader who left: the hook sends their pointer then.
    // The conductor is a reader too: of an assistant's answer on the leader's
    // layer, and of what a delegate wrote for the choir.
    watching: active,
    userId,
    visibleLayers: tools.visibleLayers,
    seenAt,
    onSeen: markSeen,
  });
  const newIds = useMemo(
    () => new Set(incoming.newMarks.map((mark) => mark.id)),
    [incoming.newMarks],
  );

  const handleGoToIncoming = useCallback(() => {
    const first = incoming.notice?.pages[0];
    if (first !== undefined) pageApi.goToPage(displayPage(first));
    incoming.dismiss();
  }, [displayPage, incoming, pageApi]);

  // Read through refs by the page's link callbacks: both move with every page
  // turn, and the pages need not be drawn again for it.
  const pageApiRef = useRef(pageApi);
  pageApiRef.current = pageApi;
  const displayRef = useRef({ displayPage, displayFocusY, linkTargetPage });
  displayRef.current = { displayPage, displayFocusY, linkTargetPage };
  const linkPage = useCallback(
    (page: number) => displayRef.current.linkTargetPage(page),
    [],
  );

  /**
   * A tap with the link tool. The first sets where the link sits; the second,
   * on any page of the same piece, where it leads, and writes it. A second tap
   * back on the first end puts the link down unplaced.
   */
  const handleLinkTap = useCallback(
    (page: number, [x, y]: NormPoint) => {
      if (!linkStart) {
        setLinkStart({ page, x, y });
        return;
      }
      setLinkStart(null);
      if (page === linkStart.page && Math.hypot(x - linkStart.x, y - linkStart.y) < LINK_UNDO_REACH) {
        return;
      }
      handleCreate({
        page_number: linkStart.page,
        annotation_type: "LK",
        payload: { x: linkStart.x, y: linkStart.y, target_page: page, target_y: y },
        color: tools.color,
        layer_name: tools.layer,
      });
    },
    [handleCreate, linkStart, tools.color, tools.layer],
  );

  const handleFollowLink = useCallback((mark: LinkMark) => {
    const {
      displayPage: pageOf,
      displayFocusY: focusOf,
      linkTargetPage: targetOf,
    } = displayRef.current;
    const target = targetOf(mark.payload.target_page);
    if (target === null) return;
    setReturnTo({
      page: pageOf(mark.page_number),
      y: focusOf(mark.page_number, mark.payload.y),
    });
    pageApiRef.current.goToPage(
      target,
      focusOf(mark.payload.target_page, mark.payload.target_y),
    );
  }, []);

  const handleReturn = useCallback(() => {
    if (returnTo) pageApiRef.current.goToPage(returnTo.page, returnTo.y);
    setReturnTo(null);
  }, [returnTo]);

  const linkStatus: LinkStatus | null =
    activeTool === "link" && activeEditionId
      ? { kind: "placing", step: linkStart ? "to" : "from" }
      : returnTo
        ? { kind: "return", page: returnTo.page }
        : null;

  const dismissLinkStatus = useCallback(() => {
    if (activeTool === "link") {
      if (linkStart) setLinkStart(null);
      else setActiveTool("pointer");
      return;
    }
    setReturnTo(null);
  }, [activeTool, linkStart, setActiveTool]);

  const {
    color,
    size,
    textScale,
    stampScale,
    shape,
    noteDisplay,
    stamp,
    layer,
    visibleLayers,
    fingerDraw,
  } = tools;

  // Read through a ref: the overlay only needs it at the moment a finger lifts,
  // and the page handle is replaced whenever the page or its width moves — a
  // new callback each time for a surface that has not changed.
  const turnPageRef = useRef(pageApi.turnPage);
  turnPageRef.current = pageApi.turnPage;
  const turnPage = useCallback((delta: 1 | -1) => turnPageRef.current(delta), []);

  const renderPageOverlay = useCallback(
    (geometry: PdfPageGeometry) => {
      // In the binder the drawing surface is not the page — it is the rectangle
      // the edition's page was placed in. Inset to that box and the overlay's
      // own 0..1 normalization is once again the EDITION's frame, which is the
      // frame every stored mark was measured in. No mark is transformed;
      // the surface is simply put where the music is.
      const frame = book ? book.frames.get(geometry.pageNumber) : null;
      if (book && !frame) return null; // front matter, a divider card: nothing to write on
      // A page turn moves the page before the new edition's marks have arrived.
      // Drawing the old piece's marks on the new piece's page for that one beat
      // would put ink on the wrong bar.
      if (frame && frame.edition !== activeEditionId) return null;

      const [left, top, width, height] = frame?.box ?? [0, 0, 1, 1];
      const surface = (
        <AnnotationOverlay
          // One surface per page: a line half-drawn or a note half-written when
          // the page turns is dropped with the page, never carried onto the
          // next one. The viewer stays out of it — it renders whatever this
          // returns, keyed or not.
          key={geometry.pageNumber}
          geometry={{
            pageNumber: frame?.src_page ?? geometry.pageNumber,
            width: geometry.width * width,
            height: geometry.height * height,
            scale: geometry.scale,
          }}
          annotations={annotations}
          visibleLayers={visibleLayers}
          tool={effectiveTool}
          onTurnPage={turnPage}
          color={color}
          size={size}
          textScale={textScale}
          stampScale={stampScale}
          shape={shape}
          noteDisplay={noteDisplay}
          stamp={stamp}
          layer={layer}
          fingerDraw={fingerDraw}
          canEdit
          canModify={canModify}
          inks={tools.inks}
          audiences={audiences}
          voicing={mode !== "personal"}
          selectedId={selectedId}
          newIds={newIds}
          clipboard={editionClipboard}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          onCreateMany={handleCreateMany}
          onUpdate={handleUpdate}
          onUpdateMany={handleUpdateMany}
          onDelete={handleDelete}
          onDeleteMany={handleDeleteMany}
          onCopy={handleCopy}
          selectionKeys={selectionKeysRef}
          linkStart={linkStart}
          onLinkTap={handleLinkTap}
          onFollowLink={handleFollowLink}
          displayPage={linkPage}
        />
      );
      if (!frame) return surface;
      return (
        <div
          className="absolute"
          style={{
            left: `${left * 100}%`,
            top: `${top * 100}%`,
            width: `${width * 100}%`,
            height: `${height * 100}%`,
          }}
        >
          {surface}
        </div>
      );
    },
    [
      activeEditionId,
      annotations,
      audiences,
      mode,
      book,
      tools.inks,
      visibleLayers,
      effectiveTool,
      color,
      size,
      textScale,
      stampScale,
      shape,
      noteDisplay,
      stamp,
      layer,
      fingerDraw,
      canModify,
      selectedId,
      newIds,
      editionClipboard,
      turnPage,
      handleCreate,
      handleCreateMany,
      handleUpdate,
      handleUpdateMany,
      handleDelete,
      handleDeleteMany,
      handleCopy,
      linkStart,
      handleLinkTap,
      handleFollowLink,
      linkPage,
    ],
  );

  const onPageApiChange = useCallback((api: PdfPageApi) => setPageApi(api), []);

  const overlaySlot = (
    <>
      <AnnotationSidebar
        annotations={annotations}
        newMarks={incoming.newMarks}
        currentPage={pageApi.currentPage}
        goToPage={pageApi.goToPage}
        displayPage={displayPage}
        linkTargetPage={linkTargetPage}
        displayFocusY={displayFocusY}
        visibleLayers={visibleLayers}
        toggleLayerVisibility={tools.toggleLayerVisibility}
        voiceFilter={readerSections !== "" && hasVoicedMarks ? tools.voiceFilter : null}
        onVoiceFilterChange={tools.setVoiceFilter}
        mode={mode}
        writesLeader={writesLeader}
        onSelectMark={handleSelectMark}
        editionId={activeEditionId}
        setAsideCount={setAsideCount}
        onMarksReplaced={resetHistory}
      />
      <IncomingMarksNotice
        count={incoming.notice?.count ?? 0}
        pages={(incoming.notice?.pages ?? []).map(displayPage)}
        kind={incoming.notice?.kind ?? "live"}
        lifted={!!book}
        onGoToPage={handleGoToIncoming}
        onDismiss={incoming.dismiss}
      />
      <LinkStatusChip
        status={linkStatus}
        lifted={!!book}
        onReturn={handleReturn}
        onDismiss={dismissLinkStatus}
      />
    </>
  );

  const modalSlot = (
    <AnnotationGuide
      isOpen={guideOpen}
      mode={mode}
      delegateLayers={reach}
      hasLeaderMarks={hasLeaderMarks}
      stylusSeen={tools.stylusSeen}
      onClose={() => setGuideOpen(false)}
    />
  );

  const notifySlot =
    notifyProjectId && active ? (
      <NotifyChoirButton projectId={notifyProjectId} surface="chrome" />
    ) : undefined;

  return {
    // No edition under the current page means no pencil: on the binder's title
    // page or a divider card there is nothing a mark could belong to, and a
    // toolbar offering to draw there would be offering to lose the drawing.
    // The project's own button stays, since the book opens on exactly such a page.
    toolbarSlot: activeEditionId ? (
      <AnnotationToolbar
        {...tools}
        setTool={setActiveTool}
        mode={mode}
        delegateLayers={reach}
        canDraw={canDraw}
        annotationCount={annotations.length}
        clearableCount={clearableCount}
        pendingCount={pendingCount}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={undo}
        onRedo={redo}
        onClearAll={handleClearAll}
        onOpenGuide={() => setGuideOpen(true)}
        notifySlot={notifySlot}
      />
    ) : notifySlot ? (
      <BareToolbar>{notifySlot}</BareToolbar>
    ) : null,
    renderPageOverlay,
    overlaySlot,
    modalSlot,
    onPageApiChange,
    claimKey,
    annotationCount: annotations.length,
    pageApi,
  };
};
