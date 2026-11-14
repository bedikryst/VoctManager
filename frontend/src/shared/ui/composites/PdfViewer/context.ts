/**
 * @file context.ts
 * @description Broadcasts viewer state to the slot content stacked inside it.
 * The slots stay plain `ReactNode` — they simply read these contexts from their
 * ancestor viewer when they care: the immersive (performance) state, so the
 * annotation toolbar collapses itself for a clean stage, whether the page
 * leaves room beside it for a labelled floating trigger, and whether the host
 * lets the tool slot become a rail. The first two default to `false` and the
 * layout to `row`, so slots rendered outside a viewer read "not immersive",
 * keep their labels and lay out as a row. One seam runs the other way: the
 * tool slot may claim the top row (`useClaimPdfTopRow`), which outside a
 * viewer claims nothing.
 * @module shared/ui/composites/PdfViewer
 */

import { createContext, useContext, useLayoutEffect } from "react";

import type { PdfToolLayout } from "./types";

const PdfImmersiveContext = createContext(false);

export const PdfImmersiveProvider = PdfImmersiveContext.Provider;

/** True while the surrounding PdfViewer is in immersive (performance) mode. */
export const usePdfImmersive = (): boolean => useContext(PdfImmersiveContext);

const PdfCompactTriggersContext = createContext(false);

export const PdfCompactTriggersProvider = PdfCompactTriggersContext.Provider;

/**
 * True when the page reaches into the left margin where floating triggers sit
 * (fit to width, zoom, a narrow window). A trigger then folds to its icon: a
 * label lying there would cover the start of every system — clef, key, voice
 * names.
 */
export const usePdfCompactTriggers = (): boolean => useContext(PdfCompactTriggersContext);

const PdfToolLayoutContext = createContext<PdfToolLayout>("row");

export const PdfToolLayoutProvider = PdfToolLayoutContext.Provider;

/** The tool layout the host allows — see `PdfViewerProps.toolLayout`. */
export const usePdfToolLayout = (): PdfToolLayout => useContext(PdfToolLayoutContext);

const PdfTopRowClaimContext = createContext<(claimed: boolean) => void>(() => undefined);

export const PdfTopRowClaimProvider = PdfTopRowClaimContext.Provider;

/**
 * Lets the tool slot take the whole top row while `claimed`: an open markup
 * bar is a mode, and the utility pill (performance mode, close) steps aside
 * until the reader leaves it. Released on unmount. A layout effect, so the
 * pill never paints one frame over a bar that has already opened.
 */
export const useClaimPdfTopRow = (claimed: boolean): void => {
  const claim = useContext(PdfTopRowClaimContext);
  useLayoutEffect(() => {
    claim(claimed);
    return () => claim(false);
  }, [claim, claimed]);
};
