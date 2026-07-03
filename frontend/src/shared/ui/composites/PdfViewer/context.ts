/**
 * @file context.ts
 * @description Broadcasts the viewer's immersive (performance) state to the slot
 * content stacked inside it. The slots stay plain `ReactNode` — they simply read
 * this context from their ancestor viewer when they care about the mode (e.g. the
 * annotation toolbar collapses itself for a clean stage). Defaults to `false` so
 * slots rendered outside a viewer read "not immersive".
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewer
 */

import { createContext, useContext } from "react";

const PdfImmersiveContext = createContext(false);

export const PdfImmersiveProvider = PdfImmersiveContext.Provider;

/** True while the surrounding PdfViewer is in immersive (performance) mode. */
export const usePdfImmersive = (): boolean => useContext(PdfImmersiveContext);
