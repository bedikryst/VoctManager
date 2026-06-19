import { ReactNode } from "react";

export type LoadErrorReason = "permission_denied" | "network" | "parse" | "unknown";

export type BlobFetchError = {
  response?: {
    status?: number;
  };
  message?: string;
};

export type PdfViewerEvent =
  | { type: "open"; docKey?: string | number }
  | { type: "load_success"; numPages: number }
  | { type: "load_error"; reason: LoadErrorReason; message?: string }
  | { type: "page_change"; from: number; to: number }
  | { type: "zoom_change"; from: number; to: number }
  | { type: "download"; fileName: string; succeeded: boolean }
  | { type: "share"; fileName: string; succeeded: boolean; cancelled: boolean }
  | { type: "open_in_browser" }
  | { type: "retry" };

/**
 * Geometry of the currently-rendered page, in CSS pixels, handed to
 * `renderPageOverlay` so a caller can position an absolutely-stacked layer
 * (annotations, highlights) over the page and map normalized 0..1 coordinates
 * to pixels. Re-emitted on page change and zoom.
 */
export interface PdfPageGeometry {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
}

export interface PdfViewerProps {
  fetchBlob: (() => Promise<Blob>) | null;
  docKey?: string | number;
  title: string;
  subtitle?: string;
  fileName?: string;
  onEvent?: (event: PdfViewerEvent) => void;
  toolbarSlot?: ReactNode;
  /**
   * Optional layer rendered absolutely over the rendered page (e.g. a score
   * annotation canvas). Receives live page geometry; the returned node fills
   * the page box. The container is `pointer-events-none` — interactive overlay
   * content must opt back in on its own surface.
   */
  renderPageOverlay?: (geometry: PdfPageGeometry) => ReactNode;
  className?: string;
}
