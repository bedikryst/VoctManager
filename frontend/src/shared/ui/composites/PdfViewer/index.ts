export { PdfViewer } from "./PdfViewer";
export { usePdfImmersive, usePdfCompactTriggers } from "./context";
export { usePdfToolRail } from "./toolRail";
/**
 * Where the viewer turns pages on a tap, and which way a swipe turns them.
 * Exported so an overlay that captures
 * touches of its own (an armed pen) can offer the same gesture in the same
 * places instead of inventing a second geography.
 */
export { resolveTapZone, type TapZone } from "./tapZone";
export { resolveSwipeTurn } from "./swipeTurn";
export type {
  PdfViewerProps,
  PdfViewerEvent,
  PdfPageGeometry,
  PdfPageApi,
  FitMode,
  PdfKeyScope,
  PdfToolLayout,
} from "./types";