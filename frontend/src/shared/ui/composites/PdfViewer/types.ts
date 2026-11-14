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
  /**
   * The rendered page's own pixels inside a region — the document only, never
   * an overlay drawn over it — or null while the page is not on its canvas.
   * Read once per gesture, never per frame: it copies pixels off the GPU.
   */
  readPixels?: (region: PdfPageRegion) => PdfPagePixels | null;
}

/** A region of the page, as fractions (0..1) of its box from the top-left. */
export interface PdfPageRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pixels read off the page: RGBA, row by row, as a canvas holds them. */
export type PdfPagePixels = Pick<ImageData, "data" | "width" | "height">;

/**
 * How the page is sized against the viewport.
 * - `page` — the whole page on screen at once (a score on a stand).
 * - `width` — fill the width, read down; the page overflows and scrolls.
 * - `two-thirds` — two thirds of a page fill the screen, so the music renders
 *   half as large again; a page takes two stops, top and bottom, whose windows
 *   overlap by the middle third so a system across the middle is whole on one.
 * `auto` resolves between `page` and `two-thirds` from the actual geometry,
 * because the same device answers differently upright and on its side.
 */
export type FitMode = "auto" | "page" | "width" | "two-thirds";
export type ResolvedFitMode = Exclude<FitMode, "auto">;

/**
 * Where the top-left tool slot may lay its tools out. `rail` lets a landscape
 * screen of tablet size and up stack them down the page's left margin
 * (`usePdfToolRail`); `row` keeps them in the top letterbox everywhere.
 */
export type PdfToolLayout = "rail" | "row";

/**
 * Which keys the viewer answers. `window` takes every key wherever focus is,
 * as a full-screen viewer should. `viewer` is for a viewer embedded in a page
 * of other controls: besides Escape it answers only while focus is inside it
 * or on nothing at all.
 */
export type PdfKeyScope = "window" | "viewer";

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
   * a viewport width cannot give: the same tablet on its side renders a 615px
   * page fitted whole and a 922px one fitted to two thirds.
   */
  pageWidth: number | null;
}

/**
 * What is printed on one page, for a document whose printed numbering is not
 * its page order: a bound book opens on unnumbered front matter, so its file
 * page 16 is the printed page 14.
 */
export interface PdfPageLabel {
  /** The number printed on the page; null where nothing is printed. */
  folio: number | null;
  /** What to call a page without a number ("Strona tytułowa"). */
  name?: string;
}

/**
 * One line of the document's contents in the viewer's sheet, as the host names
 * it. A host that knows its document (a concert book and its programme) hands
 * these in; otherwise the sheet lists the PDF's own bookmarks.
 */
export interface PdfContentsEntry {
  key: string;
  title: string;
  /** A leading number, as the document numbers its parts (the programme's). */
  number?: string;
  /** A second line under the title (the composer). */
  detail?: string;
  /** The page it opens on; null for an entry the document does not hold. */
  page: number | null;
  /** The last page it covers, which marks it as the one being read. */
  lastPage?: number;
  /** A trailing note: the pages it spans, or why it has none. */
  note?: string;
  /** Nesting under the entry before it (a bookmark's level). */
  depth?: number;
}

/** A tab the host adds to the viewer's sheet beside its own (the marks). */
export interface PdfSheetTab {
  id: string;
  label: string;
  /** A count beside the label. */
  count?: number;
  content: ReactNode;
}

export interface PdfViewerProps {
  /** Initial file page, applied when the PDF opens. */
  initialPage?: number;
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
   * Layer stacked over the page area between the bands, not a single page —
   * transient notices ("new marks", a followed link). The container is
   * `pointer-events-none`; interactive content opts back in on its own surface.
   */
  overlaySlot?: ReactNode;
  /**
   * Layer stacked over the whole viewer and every piece of its chrome — both
   * bands and the tool slot — for a panel that must cover them (a guide that
   * dims the score). Same contract as `overlaySlot`: the container is
   * `pointer-events-none`.
   */
  modalSlot?: ReactNode;
  /**
   * The document's contents for the sheet, in the host's words. Replaces the
   * PDF's own bookmarks there.
   */
  contents?: readonly PdfContentsEntry[];
  /** The heading over `contents` in the sheet ("Program koncertu"). */
  contentsTitle?: string;
  /**
   * Where a page sits in the document, in the host's words ("2 · Locus iste"),
   * put before the page number on the bottom bar. Null for a page that sits in
   * no part of it.
   */
  describePage?: (page: number) => string | null;
  /**
   * The host's own section in the sheet's first tab, after the page controls:
   * the piece's starting pitches, a copy of the book to download.
   */
  sheetSection?: ReactNode;
  /** Further tabs of the sheet (the marks). */
  sheetTabs?: readonly PdfSheetTab[];
  /** The name of the sheet's first tab, shown once it has company. */
  mainTabLabel?: string;
  /** Receives the live page handle (current/total + goToPage) on every change. */
  onPageApiChange?: (api: PdfPageApi) => void;
  /**
   * Gives an overlay the first claim on a key, before the viewer's own
   * shortcuts. Return true when it consumed the key: a claimed Escape keeps
   * performance mode and a wrapping dialog open, a claimed arrow turns no page.
   * Escape is offered wherever focus is; every other key only when focus is
   * not in a field or a popover, which keep their keys, and within `keyScope`.
   */
  claimKey?: (event: KeyboardEvent) => boolean;
  /** Which keys the viewer answers — see `PdfKeyScope`. Defaults to `window`. */
  keyScope?: PdfKeyScope;
  /**
   * Whether the tool slot may become a rail. Only a host that gives the viewer
   * the whole screen passes `rail`: in a pane a third of a window wide, a rail
   * would sit over the clefs of a page that fills the pane. Defaults to `row`.
   */
  toolLayout?: PdfToolLayout;
  /**
   * The wrapping shell's own controls (a modal's close), placed at the end of
   * the top band's utility group. Shown while the document loads or fails as
   * well: a shell must stay closable when there is nothing to read.
   */
  utilitySlot?: ReactNode;
  /**
   * One label per page, in page order, when the printed numbers are not the
   * page order. The bottom bar, the sheet, the contents and the page chip
   * then speak printed numbers. Ignored unless it covers every page: numbers
   * that drift by one page send a reader to the wrong page.
   */
  pageLabels?: readonly PdfPageLabel[];
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
  /**
   * Fit the document requires in performance mode, whatever the reader's habit
   * — an edition that sets one system per page must be shown whole on the
   * stand, or every partial view cuts it. Outside performance mode the reader's
   * own fit holds, and this is never written into the stored habit.
   */
  preferredFit?: FitMode;
  className?: string;
}
