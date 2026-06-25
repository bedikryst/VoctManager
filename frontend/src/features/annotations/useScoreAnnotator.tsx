/**
 * @file useScoreAnnotator.tsx
 * @description One-call binding that turns an edition id + edit capability into
 * the slots PdfViewer needs: a `toolbarSlot` (managers only), a `renderPageOverlay`
 * (the drawing surface), an `overlaySlot` (the annotation index drawer) and an
 * `onPageApiChange` handler. Owns tool state, the per-edition cache, optimistic
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
} from "./types/annotations.dto";

export interface UseScoreAnnotatorOptions {
  /** Edition whose markings to load; null disables fetching (viewer closed). */
  editionId: string | null;
  /** Managers may draw + erase; everyone else gets read-only shared markings. */
  canEdit: boolean;
}

export interface ScoreAnnotatorBindings {
  toolbarSlot: React.ReactNode;
  renderPageOverlay: (geometry: PdfPageGeometry) => React.ReactNode;
  overlaySlot: React.ReactNode;
  onPageApiChange: (api: PdfPageApi) => void;
  annotationCount: number;
}

const DRAW_TOOLS = new Set(["pen", "highlighter", "eraser"]);

export const useScoreAnnotator = ({
  editionId,
  canEdit,
}: UseScoreAnnotatorOptions): ScoreAnnotatorBindings => {
  const tools = useAnnotationTools();
  const canDrawViewport = useCanDraw();
  const { data: annotations = [] } = useScoreAnnotations(editionId);
  const { create, update, remove, clear } = useAnnotationMutations(editionId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageApi, setPageApi] = useState<PdfPageApi>({
    currentPage: 1,
    numPages: null,
    goToPage: () => {},
  });

  // Drawing is offered only from tablet width up; notes + browse stay everywhere.
  const canDraw = canEdit && canDrawViewport;

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

  const handleClearAll = useCallback(() => {
    if (!editionId) return;
    const snapshot = [...annotations];
    clear.mutateAsync().catch(() => {});
    recordClear(snapshot);
  }, [annotations, clear, editionId, recordClear]);

  const handleSelectNote = useCallback(
    (id: string) => {
      setSelectedId(id);
      // Drop into browse so the edit composer (managers) / preview opens.
      if (canEdit) tools.setTool("pointer");
    },
    [canEdit, tools],
  );

  // Keyboard: undo / redo (managers only), ignoring text inputs.
  useEffect(() => {
    if (!canEdit) return;
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
  }, [canEdit, undo, redo]);

  const { tool, color, size, noteDisplay, layer, visibleLayers } = tools;

  // Coerce drawing tools back to browse on a phone-sized viewport.
  const effectiveTool = useMemo(() => {
    if (!canEdit) return "pointer" as const;
    if (!canDrawViewport && DRAW_TOOLS.has(tool)) return "pointer" as const;
    return tool;
  }, [canEdit, canDrawViewport, tool]);

  const renderPageOverlay = useCallback(
    (geometry: PdfPageGeometry) => (
      <AnnotationOverlay
        geometry={geometry}
        annotations={annotations}
        visibleLayers={visibleLayers}
        tool={effectiveTool}
        color={color}
        size={size}
        noteDisplay={noteDisplay}
        layer={layer}
        canEdit={canEdit}
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
      noteDisplay,
      layer,
      canEdit,
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
      canEdit={canEdit}
      onSelectNote={handleSelectNote}
    />
  );

  return {
    toolbarSlot:
      canEdit && editionId ? (
        <AnnotationToolbar
          {...tools}
          canDraw={canDraw}
          annotationCount={annotations.length}
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
