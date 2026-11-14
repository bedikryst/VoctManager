/**
 * @file context.ts
 * @description Broadcasts viewer state to the slot content stacked inside it.
 * The slots stay plain `ReactNode` — they simply read these contexts from their
 * ancestor viewer when they care: the immersive (performance) state, so the
 * annotation toolbar can clear the stage, whether the host lets the tool slot
 * become a rail, and how the viewer words a page number, so a list of marks
 * in the sheet says the page the reader will see on the bar. Outside a viewer
 * they read "not immersive", a row, and the plain page number. One seam runs
 * the other way: the tool slot may claim the top row (`useClaimPdfTopRow`),
 * which outside a viewer claims nothing.
 * @module shared/ui/composites/PdfViewer
 */

import { createContext, useContext, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";

import { folioText } from "./pageLabels";
import type { PdfToolLayout } from "./types";

const PdfImmersiveContext = createContext(false);

export const PdfImmersiveProvider = PdfImmersiveContext.Provider;

/** True while the surrounding PdfViewer is in immersive (performance) mode. */
export const usePdfImmersive = (): boolean => useContext(PdfImmersiveContext);

const PdfToolLayoutContext = createContext<PdfToolLayout>("row");

export const PdfToolLayoutProvider = PdfToolLayoutContext.Provider;

/** The tool layout the host allows — see `PdfViewerProps.toolLayout`. */
export const usePdfToolLayout = (): PdfToolLayout => useContext(PdfToolLayoutContext);

const PdfTopRowClaimContext = createContext<(claimed: boolean) => void>(() => undefined);

export const PdfTopRowClaimProvider = PdfTopRowClaimContext.Provider;

/**
 * Lets the tool slot take the whole top row while `claimed`: an open markup
 * bar is a mode, and the utility controls (performance mode, close) step aside
 * until the reader leaves it. Released on unmount. A layout effect, so the
 * controls never paint one frame under a bar that has already opened.
 */
export const useClaimPdfTopRow = (claimed: boolean): void => {
  const claim = useContext(PdfTopRowClaimContext);
  useLayoutEffect(() => {
    claim(claimed);
    return () => claim(false);
  }, [claim, claimed]);
};

const PdfPageTextContext = createContext<((page: number) => string) | null>(null);

export const PdfPageTextProvider = PdfPageTextContext.Provider;

/**
 * A document page as the viewer's own controls word it: the printed number
 * where the document has them ("s. 14"), the page's name where it prints none.
 */
export const usePdfPageText = (): ((page: number) => string) => {
  const { t } = useTranslation();
  return useContext(PdfPageTextContext) ?? ((page: number) => folioText(t, page));
};
