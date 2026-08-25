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
import type {
  AnnotationPatch,
  NewAnnotation,
  ScoreAnnotation,
} from "./types/annotations.dto";

export type ScoreAnnotatorMode = "conductor" | "personal";

export interface UseScoreAnnotatorOptions {
  /** Edition whose markings to load; null disables fetching (viewer closed). */
  editionId: string | null;
  /**
   * conductor → managers: draw on the shared/conductor layers, clear wipes both.
   * personal  → choristers: write only their own private layer (server-scoped);
   *             the conductor's shared markings are visible but read-only.
   */
  mode: ScoreAnnotatorMode;
}

export interface ScoreAnnotatorBindings {
  toolbarSlot: React.ReactNode;
  renderPageOverlay: (geometry: PdfPageGeometry) => React.ReactNode;
  overlaySlot: React.ReactNode;
  onPageApiChange: (api: PdfPageApi) => void;
  annotationCount: number;
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
}: UseScoreAnnotatorOptions): ScoreAnnotatorBindings => {
  const isConductor = mode === "conductor";
  const tools = useAnnotationTools(
    isConductor ? "shared" : "personal",
    isConductor,
  );
  const canDrawViewport = useCanDraw();

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

  const { annotations, pendingCount } = useScoreAnnotations(editionId, {
    isCleared,
    // The stand is on screen exactly when an edition is loaded — which is also
    // the only time a singer can be looking at a page the conductor is writing on.
    live: !!editionId,
  });

  const { create, update, remove, clear, draftAnnotation } =
    useAnnotationMutations(editionId, { isCleared });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [pageApi, setPageApi] = useState<PdfPageApi>({
    currentPage: 1,
    numPages: null,
    goToPage: () => {},
  });

  // Freehand drawing is offered only from tablet width up; notes, stamps,
  // eraser + browse stay everywhere.
  const canDraw = canDrawViewport;

  const history = useAnnotationHistory({
    editionId,
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

  // Reset transient editor state when a different score opens.
  useEffect(() => {
    setSelectedId(null);
    setGuideOpen(false);
  }, [editionId]);

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
    if (!editionId) return;
    // Snapshot only what the server will actually wipe, so undo never
    // duplicates marks that survived the clear.
    const snapshot = annotations.filter(isCleared);
    if (snapshot.length === 0) return;
    clear.mutateAsync().catch(() => {});
    recordClear(snapshot);
  }, [annotations, clear, editionId, isCleared, recordClear]);

  const handleSelectNote = useCallback(
    (id: string) => {
      setSelectedId(id);
      // Drop into browse so the edit composer / read-only preview opens.
      tools.setTool("pointer");
    },
    [tools],
  );

  const incoming = useIncomingMarks(annotations, editionId, mode);

  const handleGoToIncoming = useCallback(() => {
    if (incoming.marks) pageApi.goToPage(incoming.marks.page);
    incoming.dismiss();
  }, [incoming, pageApi]);

  // Keyboard: undo / redo, ignoring text inputs. Only while a score is open —
  // otherwise a stray Ctrl+Z anywhere in the app would replay annotation
  // history against a closed viewer.
  useEffect(() => {
    if (!editionId) return;
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
  }, [editionId, undo, redo]);

  const { tool, color, size, textScale, stampScale, noteDisplay, stamp, layer, visibleLayers } =
    tools;

  // Coerce precision tools back to browse on a phone-sized viewport.
  const effectiveTool = useMemo(() => {
    if (!canDrawViewport && PRECISION_TOOLS.has(tool)) return "pointer" as const;
    return tool;
  }, [canDrawViewport, tool]);

  const renderPageOverlay = useCallback(
    (geometry: PdfPageGeometry) => (
      <AnnotationOverlay
        geometry={geometry}
        annotations={annotations}
        visibleLayers={visibleLayers}
        tool={effectiveTool}
        color={color}
        size={size}
        textScale={textScale}
        stampScale={stampScale}
        noteDisplay={noteDisplay}
        stamp={stamp}
        layer={layer}
        canEdit
        canModify={canModify}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    ),
    [
      annotations,
      visibleLayers,
      effectiveTool,
      color,
      size,
      textScale,
      stampScale,
      noteDisplay,
      stamp,
      layer,
      canModify,
      selectedId,
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
        visibleLayers={visibleLayers}
        toggleLayerVisibility={tools.toggleLayerVisibility}
        mode={mode}
        onSelectNote={handleSelectNote}
      />
      <IncomingMarksNotice
        count={incoming.marks?.count ?? 0}
        page={incoming.marks?.page ?? 1}
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
    toolbarSlot: editionId ? (
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
