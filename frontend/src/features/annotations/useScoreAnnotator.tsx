/**
 * @file useScoreAnnotator.tsx
 * @description One-call binding that turns an edition id + annotator mode into
 * the slots PdfViewer needs: a `toolbarSlot`, a `renderPageOverlay` (the drawing
 * surface), an `overlaySlot` (the annotation index drawer) and an
 * `onPageApiChange` handler. Two modes: `conductor` (managers — writes to the
 * shared/conductor layers, clear wipes both) and `personal` (choristers — every
 * mark lands on the user's own private layer; the conductor's shared markings
 * stay read-only). Owns tool state, the per-edition cache, optimistic
 * create/update/delete, undo/redo history and keyboard shortcuts — so callers
 * stay a few lines thin.
 * @module features/annotations
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PdfPageApi,
  PdfPageGeometry,
} from "@/shared/ui/composites/PdfViewer";

import { AnnotationOverlay } from "./components/AnnotationOverlay";
import { AnnotationToolbar } from "./components/AnnotationToolbar";
import { AnnotationSidebar } from "./components/AnnotationSidebar";
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

export const useScoreAnnotator = ({
  editionId,
  mode,
}: UseScoreAnnotatorOptions): ScoreAnnotatorBindings => {
  const isConductor = mode === "conductor";
  const tools = useAnnotationTools(isConductor ? "shared" : "personal");
  const canDrawViewport = useCanDraw();
  const { data: annotations = [] } = useScoreAnnotations(editionId);

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

  const { create, update, remove, clear } = useAnnotationMutations(editionId, {
    isCleared,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    createAnnotation: (payload) => create.mutateAsync(payload),
    removeAnnotation: (id) => remove.mutateAsync(id),
    updateAnnotation: (id, patch) => update.mutateAsync({ id, patch }),
  });
  const { recordCreate, recordDelete, recordClear, recordUpdate, undo, redo } =
    history;

  // Reset transient editor state when a different score opens.
  useEffect(() => {
    setSelectedId(null);
  }, [editionId]);

  const handleCreate = useCallback(
    (partial: Omit<NewAnnotation, "edition">) => {
      if (!editionId) return;
      create
        .mutateAsync({ ...partial, edition: editionId })
        .then(recordCreate)
        .catch(() => {});
    },
    [create, editionId, recordCreate],
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
    <AnnotationSidebar
      annotations={annotations}
      currentPage={pageApi.currentPage}
      goToPage={pageApi.goToPage}
      visibleLayers={visibleLayers}
      toggleLayerVisibility={tools.toggleLayerVisibility}
      mode={mode}
      onSelectNote={handleSelectNote}
    />
  );

  return {
    toolbarSlot: editionId ? (
      <AnnotationToolbar
        {...tools}
        mode={mode}
        canDraw={canDraw}
        annotationCount={annotations.length}
        clearableCount={clearableCount}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={undo}
        onRedo={redo}
        onClearAll={handleClearAll}
      />
    ) : null,
    renderPageOverlay,
    overlaySlot,
    onPageApiChange,
    annotationCount: annotations.length,
  };
};
