/**
 * @file context.ts
 * @description Broadcasts viewer state to the slot content stacked inside it.
 * The slots stay plain `ReactNode` — they simply read these contexts from their
 * ancestor viewer when they care: the immersive (performance) state, so the
 * annotation toolbar collapses itself for a clean stage, and whether the page
 * leaves room beside it for a labelled floating trigger. Both default to
 * `false`, so slots rendered outside a viewer read "not immersive" and keep
 * their labels.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewer
 */

import { createContext, useContext } from "react";

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
