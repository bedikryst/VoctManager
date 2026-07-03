/**
 * @file ScoreStandModal.tsx
 * @description The one "music stand": a full-screen score viewer with the
 * conductor/personal annotation layer already wired in. Every in-panel score
 * opens through this — the library accordion, the review cockpit's edition
 * list, and the practice cockpit — so annotations are the default everywhere and
 * the PdfViewerModal + useScoreAnnotator wiring lives in exactly one place.
 *
 * FSD: annotations is the feature every score surface already depends on, so it
 * owns this composite. The PDF byte source is INJECTED (`fetchBlob`) rather than
 * imported, so this stays free of any materials/archive dependency (no feature
 * cycle) and `shared/` stays domain-free.
 * @architecture Enterprise SaaS 2026
 * @module features/annotations/components/ScoreStandModal
 */

import React from "react";

import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";

import { useScoreAnnotator, type ScoreAnnotatorMode } from "../useScoreAnnotator";

export interface ScoreStandModalProps {
  readonly isOpen: boolean;
  /** Edition whose annotations to load; null keeps the stand empty. */
  readonly editionId: string | null;
  /** Streams the gated score PDF — injected so this stays domain-free. */
  readonly fetchBlob: (() => Promise<Blob>) | null;
  readonly title: string;
  readonly subtitle?: string;
  readonly fileName?: string;
  /**
   * conductor → managers draw the shared/conductor layers; personal →
   * choristers get their own private pencil layer over the read-only shared marks.
   */
  readonly mode: ScoreAnnotatorMode;
  /** Layer stacked under the annotation index — materials slots RehearsalDock here. */
  readonly extraOverlay?: React.ReactNode;
  /**
   * Whether this score may be exported (open/share/download). Forwarded to the
   * viewer; defaults to `true`. Pass the edition's server-computed `can_export`
   * so a protected score stays in-app-only for choristers.
   */
  readonly canExport?: boolean;
  readonly onClose: () => void;
}

export const ScoreStandModal = ({
  isOpen,
  editionId,
  fetchBlob,
  title,
  subtitle,
  fileName,
  mode,
  extraOverlay,
  canExport = true,
  onClose,
}: ScoreStandModalProps): React.JSX.Element => {
  const annotator = useScoreAnnotator({ editionId, mode });

  return (
    <PdfViewerModal
      isOpen={isOpen}
      title={title}
      subtitle={subtitle}
      fileName={fileName}
      fetchBlob={fetchBlob}
      docKey={editionId ?? undefined}
      toolbarSlot={annotator.toolbarSlot}
      renderPageOverlay={annotator.renderPageOverlay}
      overlaySlot={
        extraOverlay ? (
          <>
            {annotator.overlaySlot}
            {extraOverlay}
          </>
        ) : (
          annotator.overlaySlot
        )
      }
      onPageApiChange={annotator.onPageApiChange}
      canExport={canExport}
      onClose={onClose}
    />
  );
};
