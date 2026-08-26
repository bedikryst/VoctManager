export { PdfViewer } from "./PdfViewer";
export { usePdfImmersive } from "./context";
/**
 * Where the viewer turns pages on a tap. Exported so an overlay that captures
 * touches of its own (an armed pen) can offer the same gesture in the same
 * places instead of inventing a second geography.
 */
export { TAP_ZONE_FRACTION } from "./constants";
export type {
  PdfViewerProps,
  PdfViewerEvent,
  PdfPageGeometry,
  PdfPageApi,
} from "./types";