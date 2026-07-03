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
  | { type: "immersive_change"; active: boolean }
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

/**
 * Imperative page handle surfaced to callers that render an `overlaySlot`
 * needing to drive navigation (e.g. an annotation index that jumps to the page
 * a comment lives on). Re-emitted whenever the page or page-count changes.
 */
export interface PdfPageApi {
  currentPage: number;
  numPages: number | null;
  goToPage: (page: number) => void;
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
  /**
   * Layer stacked over the WHOLE viewer (not a single page) — a collapsible
   * annotation index / page rail. The container is `pointer-events-none`;
   * interactive content opts back in on its own surface.
   */
  overlaySlot?: ReactNode;
  /** Receives the live page handle (current/total + goToPage) on every change. */
  onPageApiChange?: (api: PdfPageApi) => void;
  /**
   * When the wrapping shell floats its own control in the top-right corner
   * (e.g. a modal's close button), the utility pill drops one row so the two
   * never overlap. Only the non-immersive chrome is affected.
   */
  reserveTopRight?: boolean;
  /**
   * Whether the document may leave the app as a raw file. When `false` the
   * open-in-browser / share / download controls are hidden — the score is
   * read in-app only. Server-computed (licence × role); defaults to `true`
   * for public-domain and every non-score document. Immersive/reading
   * controls are never affected.
   */
  canExport?: boolean;
  className?: string;
}
