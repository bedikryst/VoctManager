/**
 * @file useScoreAnnotator.tsx
 * @description One-call binding that turns an edition id + edit capability into
 * the two slots PdfViewerModal needs: a `toolbarSlot` (managers only) and a
 * `renderPageOverlay`. Owns tool state, the per-edition annotation cache and the
 * optimistic create/delete handlers, so callers stay three lines thin.
 * @module features/annotations
 */

import React, { useCallback } from "react";

import type { PdfPageGeometry } from "@/shared/ui/composites/PdfViewer";

import { AnnotationOverlay } from "./components/AnnotationOverlay";
import { AnnotationToolbar } from "./components/AnnotationToolbar";
import {
  useAnnotationMutations,
  useScoreAnnotations,
} from "./api/annotations.queries";
import { useAnnotationTools } from "./lib/useAnnotationTools";
import type { NewAnnotation } from "./types/annotations.dto";

export interface UseScoreAnnotatorOptions {
  /** Edition whose markings to load; null disables fetching (modal closed). */
  editionId: string | null;
  /** Managers may draw + erase; everyone else gets read-only shared markings. */
  canEdit: boolean;
}

export interface ScoreAnnotatorBindings {
  toolbarSlot: React.ReactNode;
  renderPageOverlay: (geometry: PdfPageGeometry) => React.ReactNode;
  annotationCount: number;
}

export const useScoreAnnotator = ({
  editionId,
  canEdit,
}: UseScoreAnnotatorOptions): ScoreAnnotatorBindings => {
  const tools = useAnnotationTools();
  const { data: annotations = [] } = useScoreAnnotations(editionId);
  const { create, remove, clear } = useAnnotationMutations(editionId);

  const handleCreate = useCallback(
    (partial: Omit<NewAnnotation, "edition">) => {
      if (!editionId) return;
      create.mutate({ ...partial, edition: editionId });
    },
    [create, editionId],
  );

  const handleDelete = useCallback(
    (id: string) => remove.mutate(id),
    [remove],
  );

  const handleClearAll = useCallback(() => {
    if (editionId) clear.mutate();
  }, [clear, editionId]);

  const { tool, color, layer } = tools;

  const renderPageOverlay = useCallback(
    (geometry: PdfPageGeometry) => (
      <AnnotationOverlay
        geometry={geometry}
        annotations={annotations}
        tool={canEdit ? tool : "pointer"}
        color={color}
        layer={layer}
        canEdit={canEdit}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />
    ),
    [annotations, canEdit, tool, color, layer, handleCreate, handleDelete],
  );

  return {
    toolbarSlot:
      canEdit && editionId ? (
        <AnnotationToolbar
          {...tools}
          annotationCount={annotations.length}
          onClearAll={handleClearAll}
        />
      ) : null,
    renderPageOverlay,
    annotationCount: annotations.length,
  };
};
