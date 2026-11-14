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
 * The book's own navigation speaks the conductor's words: the bottom bar names
 * the piece by its programme number with the printed page ("2 · Locus iste ·
 * s. 1"), and the sheet's Program tab lists the whole running order — each
 * piece with the printed pages it spans, and the items the book holds no pages
 * for marked as such. Its running order is the production's, never editable
 * here: what comes next on a stage is data the whole choir shares. The host
 * adds the current piece's own section (its starting pitches) and a copy of the
 * book to download.
 *
 * A hand-uploaded book has no map and therefore no pencil and no programme.
 * That is not an error state and gets no warning: the reader is handed the
 * book they always had, with its own bookmarks as contents.
 *
 * FSD: the map and the PDF bytes are INJECTED, so this composite stays free of
 * any projects/materials import (no feature cycle).
 * @module features/annotations/components/ScoreBookModal
 */

import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { PdfContentsEntry, PdfPageApi, PdfPageLabel } from "@/shared/ui/composites/PdfViewer";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";

import {
  useScoreAnnotator,
  type DelegateLayer,
  type ScoreAnnotatorMode,
} from "../useScoreAnnotator";
import { itemAtPage, itemPageSpan, type ScoreBook } from "../lib/scoreBook";

export interface ScoreBookModalProps {
  readonly isOpen: boolean;
  /**
   * The binder's map. Null (or an empty one) → no pencil and no programme;
   * the viewer is the plain reader it was before.
   */
  readonly book: ScoreBook | null;
  /** Streams the binder — injected so this stays domain-free. */
  readonly fetchBlob: (() => Promise<Blob>) | null;
  /** Cache identity of the BYTES — see `PdfViewerProps.docKey`. */
  readonly docKey?: string;
  readonly initialPage?: number;
  readonly onPageChange?: (page: number) => void;
  readonly title: string;
  readonly subtitle?: string;
  readonly fileName?: string;
  readonly mode: ScoreAnnotatorMode;
  /** In `leader` mode, the layers the grant opens on every piece of the book. */
  readonly delegateLayers?: readonly DelegateLayer[];
  /**
   * Whether the binder may leave the app; false → in-app only. Honoured only
   * for a book with no map: with the pencil in it, the file on screen is the
   * clean book, and `downloadSection` hands out a copy instead (see below).
   */
  readonly canExport?: boolean;
  /** The book's project, when the reader may tell its choir about new marks. */
  readonly notifyProjectId?: string | null;
  /**
   * The sheet section for the piece the reader stands in, by its programme
   * number (its starting pitches). Nothing on a page outside every piece.
   */
  readonly pieceSection?: (order: number) => React.ReactNode;
  /** The sheet section that hands out a copy of the book, for a mapped book. */
  readonly downloadSection?: React.ReactNode;
  readonly onClose: () => void;
}

export const ScoreBookModal = ({
  isOpen,
  book,
  fetchBlob,
  docKey,
  initialPage,
  onPageChange,
  title,
  subtitle,
  fileName,
  mode,
  delegateLayers,
  canExport = true,
  notifyProjectId = null,
  pieceSection,
  downloadSection,
  onClose,
}: ScoreBookModalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const mapped = book && book.frames.size > 0 ? book : null;
  // The conductor calls the printed page, so the stand counts in it. Only the
  // title page gets a name of its own; every other unnumbered page is just
  // that, and the viewer says so.
  const bookLabels = book?.labels;
  const pageLabels = useMemo<PdfPageLabel[] | undefined>(
    () =>
      bookLabels && bookLabels.length > 0
        ? bookLabels.map((label) => ({
            folio: label.folio,
            name:
              label.kind === "title"
                ? t("score_book.title_page", "Strona tytułowa")
                : undefined,
          }))
        : undefined,
    [bookLabels, t],
  );
  const annotator = useScoreAnnotator({
    // Every edition in the binder takes its turn; which one is in play is the
    // page in front of the reader, so there is no single id to name here.
    editionId: null,
    mode,
    delegateLayers,
    book: isOpen ? mapped : null,
    notifyProjectId,
  });
  const { onPageApiChange: updateAnnotatorPage } = annotator;
  const handlePageApiChange = useCallback((api: PdfPageApi) => {
    if (mapped) updateAnnotatorPage(api);
    if (api.numPages !== null) onPageChange?.(api.currentPage);
  }, [mapped, onPageChange, updateAnnotatorPage]);

  // The running order, with the pages each piece spans; what the book holds no
  // pages for keeps its place in the order and says why it cannot be opened.
  const contents = useMemo<PdfContentsEntry[] | undefined>(() => {
    if (!mapped) return undefined;
    const bound = mapped.items.map((item) => {
      const span = itemPageSpan(mapped, item);
      const pages = span
        ? span.from === span.to
          ? t("pdf_viewer.outline_page", "s. {{page}}", { page: span.from })
          : t("score_book.page_range", "s. {{from}}–{{to}}", { from: span.from, to: span.to })
        : null;
      const note = [item.is_encore ? t("score_book.encore", "Bis") : null, pages]
        .filter((part): part is string => part !== null)
        .join(" · ");
      return {
        order: item.order,
        entry: {
          key: item.id,
          number: String(item.order),
          title: item.title,
          detail: item.composer || undefined,
          page: item.first_page,
          lastPage: item.last_page,
          note: note || undefined,
        },
      };
    });
    const outside = mapped.unbound.map((item) => ({
      order: item.order,
      entry: {
        key: item.id,
        number: String(item.order),
        title: item.title,
        detail: item.composer || undefined,
        page: null,
        note: t("score_book.not_in_book", "poza książką"),
      },
    }));
    return [...bound, ...outside]
      .sort((a, b) => a.order - b.order)
      .map(({ entry }) => entry);
  }, [mapped, t]);

  const describePage = useCallback(
    (page: number): string | null => {
      if (!mapped) return null;
      const item = itemAtPage(mapped, page);
      return item ? `${item.order} · ${item.title}` : null;
    },
    [mapped],
  );

  const currentItem = mapped ? itemAtPage(mapped, annotator.pageApi.currentPage) : null;
  const sheetSection = mapped ? (
    <>
      {currentItem && pieceSection?.(currentItem.order)}
      {downloadSection}
    </>
  ) : undefined;

  return (
    <PdfViewerModal
      isOpen={isOpen}
      title={title}
      subtitle={subtitle}
      fileName={fileName}
      fetchBlob={fetchBlob}
      docKey={docKey}
      initialPage={initialPage}
      toolbarSlot={mapped ? annotator.toolbarSlot : undefined}
      renderPageOverlay={mapped ? annotator.renderPageOverlay : undefined}
      overlaySlot={mapped ? annotator.overlaySlot : undefined}
      modalSlot={mapped ? annotator.modalSlot : undefined}
      sheetTabs={mapped ? annotator.sheetTabs : undefined}
      onPageApiChange={handlePageApiChange}
      claimKey={mapped ? annotator.claimKey : undefined}
      toolLayout="rail"
      pageLabels={pageLabels}
      contents={contents}
      contentsTitle={t("score_book.programme", "Program koncertu")}
      describePage={mapped ? describePage : undefined}
      sheetSection={sheetSection}
      mainTabLabel={t("score_book.programme_tab", "Program")}
      // With a map, the file on screen is the clean book and every mark is
      // drawn live over it, so handing that file out would hand out a book
      // with none of them. The host's download section composes a copy with
      // the marks asked for instead.
      canExport={canExport && !mapped}
      fitScope="score"
      onClose={onClose}
    />
  );
};
