/**
 * @file useScoreAnnotator.tsx
 * @description One-call binding that turns an edition id + annotator mode into
 * the slots PdfViewer needs: a `toolbarSlot`, a `renderPageOverlay` (the drawing
 * surface), an `overlaySlot` (the annotation index, the guide, the live notice)
 * and an `onPageApiChange` handler. Two modes: `conductor` (managers — writes to
 * the shared/conductor layers, clear wipes both) and `personal` (choristers —
 * every mark lands on the user's own private layer; the conductor's shared
 * markings stay read-only). Owns tool state, the per-edition cache, optimistic
 * create/update/delete, undo/redo history and keyboard shortcuts — so callers
 * stay a few lines thin.
 *
 * While the stand is open it also watches for markings that arrived from
 * elsewhere — the conductor writing mid-rehearsal. They are drawn silently, and
 * announced by one dismissible line that offers the page, because a mark that
 * lands three pages away would otherwise never be found.
 * @module features/annotations
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  PdfPageApi,
  PdfPageGeometry,
} from "@/shared/ui/composites/PdfViewer";

import { AnnotationOverlay } from "./components/AnnotationOverlay";
import { AnnotationToolbar } from "./components/AnnotationToolbar";
import { AnnotationSidebar } from "./components/AnnotationSidebar";
import { AnnotationGuide } from "./components/AnnotationGuide";
import { IncomingMarksNotice } from "./components/IncomingMarksNotice";
import {
  useAnnotationMutations,
  useScoreAnnotations,
} from "./api/annotations.queries";
import { useAnnotationTools } from "./lib/useAnnotationTools";
import { useAnnotationHistory } from "./lib/useAnnotationHistory";
import { useCanDraw } from "./lib/useCanDraw";
import { bookPageFor, type ScoreBook } from "./lib/scoreBook";
import type {
  AnnotationPatch,
  NewAnnotation,
  ScoreAnnotation,
} from "./types/annotations.dto";

export type ScoreAnnotatorMode = "conductor" | "personal";

export interface UseScoreAnnotatorOptions {
  /**
   * Edition whose markings to load; null disables fetching (viewer closed).
   * Ignored in book mode, where the edition is whichever one the page in front
   * of the reader was bound from.
   */
  editionId: string | null;
  /**
   * conductor → managers: draw on the shared/conductor layers, clear wipes both.
   * personal  → choristers: write only their own private layer (server-scoped);
   *             the conductor's shared markings are visible but read-only.
   */
  mode: ScoreAnnotatorMode;
  /**
   * The concert binder's map. Present → the document on screen is the book, and
   * each page is one edition's page placed inside a rectangle. Writes still land
   * on the EDITION, which is what makes a mark drawn in the binder the same mark
   * when the piece is later opened on its own.
   */
  book?: ScoreBook | null;
}

export interface ScoreAnnotatorBindings {
  toolbarSlot: React.ReactNode;
  renderPageOverlay: (geometry: PdfPageGeometry) => React.ReactNode;
  overlaySlot: React.ReactNode;
  onPageApiChange: (api: PdfPageApi) => void;
  annotationCount: number;
  /** The live page handle, for chrome outside the annotator (a programme bar). */
  pageApi: PdfPageApi;
}

/** Tools that need a stylus/precision surface — coerced away on phones. */
const PRECISION_TOOLS = new Set(["pen", "highlighter"]);

/** A mark that arrived from someone else, and the page it is waiting on. */
interface IncomingMarks {
  count: number;
  page: number;
}

export const useScoreAnnotator = ({
  editionId,
  mode,
  book = null,
}: UseScoreAnnotatorOptions): ScoreAnnotatorBindings => {
  const isConductor = mode === "conductor";
  const tools = useAnnotationTools(
    isConductor ? "shared" : "personal",
    isConductor,
  );
  // Which of the VISIBLE marks this user may erase / edit. The server already
  // scopes reads (a chorister receives shared + own personal; a manager never
  // receives other users' personal), so layer membership is enough here.
  const canModify = useCallback(
    (a: ScoreAnnotation) => isConductor || a.layer_name === "personal",
    [isConductor],
  );

  // Clear mirrors the server rule: managers wipe shared+conductor (personal
  // layers survive), choristers wipe only their own personal marks.
  const isCleared = useCallback(
    (a: ScoreAnnotation) =>
      isConductor ? a.layer_name !== "personal" : a.layer_name === "personal",
    [isConductor],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
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

  const { annotations, pendingCount } = useScoreAnnotations(activeEditionId, {
    isCleared,
    // The stand is on screen exactly when an edition is loaded — which is also
    // the only time a singer can be looking at a page the conductor is writing on.
    live: !!activeEditionId,
  });

  const { create, update, remove, clear, draftAnnotation } =
    useAnnotationMutations(activeEditionId, { isCleared });

  // Freehand needs a page large enough for a stroke to mean something — which
  // the reader can reach by zooming or by switching the fit, on any device.
  // Notes, stamps, eraser and browse stay everywhere.
  const canDraw = useCanDraw({
    pageWidth: pageApi.pageWidth,
    stylusSeen: tools.stylusSeen,
  });

  const history = useAnnotationHistory({
    editionId: activeEditionId,
    // Undoing an erase writes a NEW mark rather than reviving the old key: the
    // server treats a known id as a replay and hands back the row it already
    // has — soft-deleted included — which is exactly what keeps a queued
    // create-then-erase from resurrecting itself, and exactly the wrong answer
    // here.
    createAnnotation: async (payload) => {
      const draft = draftAnnotation(payload);
      if (!draft) throw new Error("No edition open.");
      return create.mutateAsync(draft);
    },
    removeAnnotation: (id) => remove.mutateAsync(id),
    updateAnnotation: (id, patch) => update.mutateAsync({ id, patch }),
  });
  const { recordCreate, recordDelete, recordClear, recordUpdate, undo, redo } =
    history;

  // Reset transient editor state when a different score opens — in the binder
  // that is also a page turn into the next piece, which is right: a note
  // selected in the Kyrie is not a note selected in the Gloria.
  useEffect(() => {
    setSelectedId(null);
    setGuideOpen(false);
  }, [activeEditionId]);

  const handleCreate = useCallback(
    (partial: Omit<NewAnnotation, "edition">) => {
      const draft = draftAnnotation(partial);
      if (!draft) return;
      // Recorded from the DRAFT, not the server's reply: the id is minted here
      // and never changes, so undo works on a mark the network has not yet
      // heard of — which is the whole point of drawing in a basement.
      recordCreate(draft);
      create.mutate(draft);
    },
    [create, draftAnnotation, recordCreate],
  );

  const handleUpdate = useCallback(
    (id: string, after: AnnotationPatch, before: AnnotationPatch) => {
      update.mutateAsync({ id, patch: after }).catch(() => {});
      recordUpdate(id, before, after);
    },
    [update, recordUpdate],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const target = annotations.find((a) => a.id === id);
      remove.mutateAsync(id).catch(() => {});
      if (target) recordDelete(target);
    },
    [annotations, remove, recordDelete],
  );

  const clearableCount = useMemo(
    () => annotations.filter(isCleared).length,
    [annotations, isCleared],
  );

  const handleClearAll = useCallback(() => {
    if (!activeEditionId) return;
    // Snapshot only what the server will actually wipe, so undo never
    // duplicates marks that survived the clear.
    const snapshot = annotations.filter(isCleared);
    if (snapshot.length === 0) return;
    clear.mutateAsync().catch(() => {});
    recordClear(snapshot);
  }, [activeEditionId, annotations, clear, isCleared, recordClear]);

  const handleSelectNote = useCallback(
    (id: string) => {
      setSelectedId(id);
      // Drop into browse so the edit composer / read-only preview opens.
      tools.setTool("pointer");
    },
    [tools],
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

  const incoming = useIncomingMarks(annotations, activeEditionId, mode);

  const handleGoToIncoming = useCallback(() => {
    if (incoming.marks) pageApi.goToPage(displayPage(incoming.marks.page));
    incoming.dismiss();
  }, [displayPage, incoming, pageApi]);

  // Keyboard: undo / redo, ignoring text inputs. Only while a score is open —
  // otherwise a stray Ctrl+Z anywhere in the app would replay annotation
  // history against a closed viewer.
  useEffect(() => {
    if (!activeEditionId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeEditionId, undo, redo]);

  const {
    tool,
    color,
    size,
    textScale,
    stampScale,
    noteDisplay,
    stamp,
    layer,
    visibleLayers,
    fingerDraw,
  } = tools;

  // Coerce precision tools back to browse while the page is too small to write
  // on — a pen held over a thumbnail would only produce marks nobody can place.
  const effectiveTool = useMemo(() => {
    if (!canDraw && PRECISION_TOOLS.has(tool)) return "pointer" as const;
    return tool;
  }, [canDraw, tool]);

  // Read through a ref: the overlay only needs it at the moment a finger lifts,
  // and rebuilding the whole drawing surface every time the page number moves
  // would throw away a stroke in progress.
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
          noteDisplay={noteDisplay}
          stamp={stamp}
          layer={layer}
          fingerDraw={fingerDraw}
          canEdit
          canModify={canModify}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
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
      book,
      visibleLayers,
      effectiveTool,
      color,
      size,
      textScale,
      stampScale,
      noteDisplay,
      stamp,
      layer,
      fingerDraw,
      canModify,
      selectedId,
      turnPage,
      handleCreate,
      handleUpdate,
      handleDelete,
    ],
  );

  const onPageApiChange = useCallback((api: PdfPageApi) => setPageApi(api), []);

  const overlaySlot = (
    <>
      <AnnotationSidebar
        annotations={annotations}
        currentPage={pageApi.currentPage}
        goToPage={pageApi.goToPage}
        displayPage={displayPage}
        visibleLayers={visibleLayers}
        toggleLayerVisibility={tools.toggleLayerVisibility}
        mode={mode}
        onSelectNote={handleSelectNote}
      />
      <IncomingMarksNotice
        count={incoming.marks?.count ?? 0}
        page={displayPage(incoming.marks?.page ?? 1)}
        onGoToPage={handleGoToIncoming}
        onDismiss={incoming.dismiss}
      />
      <AnnotationGuide
        isOpen={guideOpen}
        mode={mode}
        onClose={() => setGuideOpen(false)}
      />
    </>
  );

  return {
    // No edition under the current page means no pencil: on the binder's title
    // page or a divider card there is nothing a mark could belong to, and a
    // toolbar offering to draw there would be offering to lose the drawing.
    toolbarSlot: activeEditionId ? (
      <AnnotationToolbar
        {...tools}
        mode={mode}
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
      />
    ) : null,
    renderPageOverlay,
    overlaySlot,
    onPageApiChange,
    annotationCount: annotations.length,
    pageApi,
  };
};

/**
 * Marks that appeared while this stand was open and were not written here.
 *
 * Only the reader's side is watched. In conductor mode the shared layer IS the
 * user's own hand, so announcing it back to them would be noise; a chorister,
 * meanwhile, cannot write to `shared` at all, which makes "a shared mark I had
 * not seen" an exact synonym for "the conductor just wrote this".
 */
const useIncomingMarks = (
  annotations: readonly ScoreAnnotation[],
  editionId: string | null,
  mode: ScoreAnnotatorMode,
): { marks: IncomingMarks | null; dismiss: () => void } => {
  const watching = mode === "personal";
  const seen = useRef<Set<string> | null>(null);
  const [marks, setMarks] = useState<IncomingMarks | null>(null);

  // A different score is a different conversation — forget both the baseline
  // and anything still on screen from the last one.
  useEffect(() => {
    seen.current = null;
    setMarks(null);
  }, [editionId]);

  useEffect(() => {
    if (!watching || !editionId) return;
    const shared = annotations.filter((a) => a.layer_name === "shared");
    // The first list to arrive is the baseline, not news: everything already on
    // the page when the reader opened it is simply the score they asked for.
    if (seen.current === null) {
      seen.current = new Set(shared.map((a) => a.id));
      return;
    }
    const fresh = shared.filter((a) => !seen.current?.has(a.id));
    if (fresh.length === 0) return;
    for (const mark of fresh) seen.current.add(mark.id);
    setMarks({
      count: fresh.length,
      page: Math.min(...fresh.map((a) => a.page_number)),
    });
  }, [annotations, editionId, watching]);

  const dismiss = useCallback(() => setMarks(null), []);

  return { marks, dismiss };
};
