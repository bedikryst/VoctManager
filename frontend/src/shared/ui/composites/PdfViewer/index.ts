export { PdfViewer } from "./PdfViewer";
export { usePdfImmersive } from "./context";
/**
 * Where the viewer turns pages on a tap. Exported so an overlay that captures
 * touches of its own (an armed pen) can offer the same gesture in the same
 * places instead of inventing a second geography.
 */
export { resolveTapZone, type TapZone } from "./tapZone";
export type {
  PdfViewerProps,
  PdfViewerEvent,
  PdfPageGeometry,
  PdfPageApi,
  FitMode,
} from "./types";