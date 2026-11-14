/**
 * @file pageLabels.ts
 * @description The page numbers a reader says aloud, where they are not the
 * file's page order. A bound book opens on unnumbered front matter, so its
 * file page 16 is the printed page 14, and a singer told "strona 14" who goes
 * to page 14 of the file lands two pages early. The host hands the viewer one
 * label per page (`PdfViewerProps.pageLabels`); this answers both directions
 * and words a page the same way in every control that names one.
 * @module shared/ui/composites/PdfViewer
 */

import type { TFunction } from "i18next";

import type { PdfPageLabel } from "./types";

export interface PageLabelling {
  /** The number printed on a 1-based page, or null where none is printed. */
  folioOf: (page: number) => number | null;
  /** The first page carrying a printed number, or null when none does. */
  pageOf: (folio: number) => number | null;
  /** The host's name for a page without a number, when it gave one. */
  nameOf: (page: number) => string | null;
  /** The highest printed number, which bounds what can be typed. */
  lastFolio: number;
}

/**
 * Null whenever the labels cannot be trusted page for page: absent, not yet
 * matched against a loaded document, of another length than the document, or
 * carrying no number at all. The reader then gets the file's page order.
 */
export const resolvePageLabelling = (
  labels: readonly PdfPageLabel[] | undefined,
  numPages: number | null,
): PageLabelling | null => {
  if (!labels || numPages === null || labels.length !== numPages) return null;
  const pageByFolio = new Map<number, number>();
  let lastFolio = 0;
  labels.forEach((label, index) => {
    if (label.folio === null) return;
    if (!pageByFolio.has(label.folio)) pageByFolio.set(label.folio, index + 1);
    lastFolio = Math.max(lastFolio, label.folio);
  });
  if (pageByFolio.size === 0) return null;
  return {
    folioOf: (page) => labels[page - 1]?.folio ?? null,
    pageOf: (folio) => pageByFolio.get(folio) ?? null,
    nameOf: (page) => labels[page - 1]?.name ?? null,
    lastFolio,
  };
};

/** "s. 14" — the form the printed contents and the book's own cards use. */
export const folioText = (t: TFunction, folio: number | string): string =>
  t("pdf_viewer.outline_page", "s. {{page}}", { page: folio });

/**
 * A page as a sentence names it: its printed number, or what the page is
 * ("Strona tytułowa"), or that it carries no number.
 */
export const pageLabelText = (
  t: TFunction,
  labelling: PageLabelling,
  page: number,
): string => {
  const folio = labelling.folioOf(page);
  if (folio !== null) return folioText(t, folio);
  return labelling.nameOf(page) ?? t("pdf_viewer.page_unnumbered", "bez numeru");
};
