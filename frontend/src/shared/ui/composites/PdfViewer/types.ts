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
 * How the page is sized against the viewport.
 * - `page` — the whole page on screen at once (a score on a stand).
 * - `width` — fill the width, read down; the page overflows and scrolls.
 * - `half` — half a page fills the screen, so the music renders at nearly
 *   double the size; a turn advances by a half.
 * `auto` resolves between `page` and `half` from the actual geometry, because
 * the same device answers differently upright and on its side.
 */
export type FitMode = "auto" | "page" | "width" | "half";
export type ResolvedFitMode = Exclude<FitMode, "auto">;

/**
 * Imperative page handle surfaced to callers that render an `overlaySlot`
 * needing to drive navigation (e.g. an annotation index that jumps to the page
 * a comment lives on). Re-emitted whenever the page or page-count changes.
 */
export interface PdfPageApi {
  currentPage: number;
  numPages: number | null;
  /**
   * Open a page. `focusY` (0..1 from the page's top, the same frame markings
   * are stored in) parks the scroll on that spot instead of the page's top —
   * without it a jump to a mark in the unseen half of a page lands above it.
   */
  goToPage: (page: number, focusY?: number) => void;
  /**
   * One reader's turn, which is a screenful wherever the page overflows and a
   * page where it does not. Surfaced because an overlay that owns every touch
   * (an armed pen) would otherwise leave the reader with no way to turn at all.
   */
  turnPage: (delta: 1 | -1) => void;
  /**
   * Rendered width of the page in CSS pixels, zoom included — null until the
   * first page box is measured (only measured for callers that draw an
   * overlay). It is the honest answer to "is there room to write here", which
   * a viewport width cannot give: the same phone renders a 311px page upright
   * and a 622px one on its side.
   */
  pageWidth: number | null;
}

export interface PdfViewerProps {
  fetchBlob: (() => Promise<Blob>) | null;
  /**
   * Cache identity of the BYTES, not of the record they belong to. The blob is
   * held at `staleTime: Infinity`, so a key that survives a change of content —
   * `score-<projectId>` for a file the generator overwrites under the same name —
   * serves the previous document for the rest of the session. Carry a version
   * (`build_version`, `updated_at`) in the key, or set `volatile`.
   */
  docKey?: string | number;
  /**
   * The document is assembled by the server on request (a call sheet, a day
   * sheet) and nothing on the client says whether the output moved. Re-renders
   * it on every open instead of trusting the key. Window-focus refetch stays off
   * either way — nobody wants a book re-downloaded because they alt-tabbed.
   */
  volatile?: boolean;
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
  /**
   * Which reading habit the remembered fit belongs to. A score is read off a
   * stand at arm's length, where a whole system has to be visible at once; a
   * call sheet is read in the hand. Carrying one choice into the other is how a
   * singer opens the day sheet and finds it halved. Free-form, so a surface
   * with its own reading posture can claim a bucket of its own.
   */
  fitScope?: string;
  className?: string;
}
