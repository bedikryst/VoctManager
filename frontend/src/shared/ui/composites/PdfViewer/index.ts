export { PdfViewer } from "./PdfViewer";
export { usePdfImmersive, useClaimPdfTopRow, usePdfPageText } from "./context";
export { usePdfToolRail } from "./toolRail";
export { bandButton, bandIconButton, sheetButton } from "./bandChrome";
export { PdfSheetSection } from "./components/PdfSheet";
export { createDownloadAnchor } from "./utils";
/**
 * Where the viewer turns pages on a tap, and which way a swipe turns them.
 * Exported so an overlay that captures
 * touches of its own (an armed pen) can offer the same gesture in the same
 * places instead of inventing a second geography.
 */
export { resolveTapZone, type TapZone } from "./tapZone";
export { resolveSwipeTurn } from "./swipeTurn";
/** For a host that sizes the viewer around the page (`ground="desk"` panes). */
export { viewerWidthForPage } from "./fit";
export type {
  PdfViewerProps,
  PdfViewerEvent,
  PdfPageGeometry,
  PdfPageRegion,
  PdfPagePixels,
  PdfPageApi,
  FitMode,
  PdfKeyScope,
  PdfGround,
  PdfPageLabel,
  PdfToolLayout,
  PdfContentsEntry,
  PdfSheetTab,
} from "./types";
