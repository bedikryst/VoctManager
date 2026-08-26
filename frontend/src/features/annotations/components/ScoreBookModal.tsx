/**
 * @file ScoreBookModal.tsx
 * @description The concert binder on a stand — one book, with the pencil in it.
 *
 * Until now the choir had two half-answers: the binder opened in a plain viewer
 * (continuity, a table of contents, no way to write) and a single edition opened
 * in `ScoreStandModal` (a pencil, no sense of the concert). This is both, and it
 * is possible because the build recorded where every edition page landed on its
 * A4 sheet. Marks are drawn inside that rectangle and written against the
 * EDITION, so a note made here is the same note when the piece is opened on its
 * own — there is one set of markings, not a binder's set and a piece's set.
 *
 * A hand-uploaded book has no map and therefore no pencil. That is not an error
 * state and gets no warning: the reader is handed the book they always had.
 *
 * FSD: the map and the PDF bytes are INJECTED, so this composite stays free of
 * any projects/materials import (no feature cycle).
 * @architecture Enterprise SaaS 2026
 * @module features/annotations/components/ScoreBookModal
 */

import React from "react";

import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";

import { useScoreAnnotator, type ScoreAnnotatorMode } from "../useScoreAnnotator";
import type { ScoreBook } from "../lib/scoreBook";
import { ScoreProgramBar } from "./ScoreProgramBar";

export interface ScoreBookModalProps {
  readonly isOpen: boolean;
  /**
   * The binder's map. Null (or an empty one) → no pencil and no programme bar;
   * the viewer is the plain reader it was before.
   */
  readonly book: ScoreBook | null;
  /** Streams the binder — injected so this stays domain-free. */
  readonly fetchBlob: (() => Promise<Blob>) | null;
  /** Cache identity of the BYTES — see `PdfViewerProps.docKey`. */
  readonly docKey?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly fileName?: string;
  readonly mode: ScoreAnnotatorMode;
  /** Whether the binder may leave the app; false → in-app only. */
  readonly canExport?: boolean;
  readonly onClose: () => void;
}

export const ScoreBookModal = ({
  isOpen,
  book,
  fetchBlob,
  docKey,
  title,
  subtitle,
  fileName,
  mode,
  canExport = true,
  onClose,
}: ScoreBookModalProps): React.JSX.Element => {
  const hasMap = !!book && book.frames.size > 0;
  const annotator = useScoreAnnotator({
    // Every edition in the binder takes its turn; which one is in play is the
    // page in front of the reader, so there is no single id to name here.
    editionId: null,
    mode,
    book: isOpen && hasMap ? book : null,
  });

  return (
    <PdfViewerModal
      isOpen={isOpen}
      title={title}
      subtitle={subtitle}
      fileName={fileName}
      fetchBlob={fetchBlob}
      docKey={docKey}
      toolbarSlot={hasMap ? annotator.toolbarSlot : undefined}
      renderPageOverlay={hasMap ? annotator.renderPageOverlay : undefined}
      overlaySlot={
        hasMap ? (
          <>
            {annotator.overlaySlot}
            <ScoreProgramBar
              book={book as ScoreBook}
              currentPage={annotator.pageApi.currentPage}
              goToPage={annotator.pageApi.goToPage}
            />
          </>
        ) : undefined
      }
      onPageApiChange={hasMap ? annotator.onPageApiChange : undefined}
      canExport={canExport}
      fitScope="score"
      onClose={onClose}
    />
  );
};
