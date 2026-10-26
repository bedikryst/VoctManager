/**
 * @file documentViewerRoute.ts
 * @description Public contract of the deep-linkable document viewer route: the
 * descriptor, the display hint and the path builder. Kept in `shared/` so the
 * viewer shell (`PdfViewerModal`) and the features that open documents can link
 * to the route without importing upward into `pages/`. The page itself lives in
 * `pages/panel/DocumentViewerPage` and is loaded lazily by the router.
 * @module shared/lib/navigation/documentViewerRoute
 */

/**
 * Closed set of document types the viewer route knows how to resolve.
 * Adding a new type requires extending the resolver in
 * `pages/panel/DocumentViewerPage/index.tsx`.
 *
 * The concert-day sheet appears twice on purpose. `project-day-sheet` is the
 * *personal* one — the server reads the audience off the caller, so a manager
 * who is neither cast nor conducting is refused it. `project-day-card` is the
 * production shape a manager asks for explicitly. One type for both would make
 * every manager's deep link a 403.
 */
export type DocumentType =
  | "project-score"
  | "project-call-sheet"
  | "project-day-card"
  | "project-day-sheet"
  | "chorister-hub";

/**
 * Optional display payload forwarded via `location.state` for in-app navigations.
 * Lets the full-view page render the correct title immediately rather than
 * waiting on a metadata fetch. Absent state on a deep-link is handled by the
 * resolver's per-type fallback copy.
 */
export interface DocumentDisplayHint {
  title?: string;
  subtitle?: string;
  fileName?: string;
}

export interface DocumentDescriptor {
  type: DocumentType;
  id: string | number;
  hint?: DocumentDisplayHint;
}

/**
 * Type guard used by the page to validate `location.state` before consuming it.
 */
export const isDocumentDisplayHint = (
  value: unknown,
): value is DocumentDisplayHint => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const isOptionalString = (field: unknown): boolean =>
    field === undefined || typeof field === "string";

  return (
    isOptionalString(candidate.title) &&
    isOptionalString(candidate.subtitle) &&
    isOptionalString(candidate.fileName)
  );
};

const DOCUMENT_VIEWER_BASE = "/panel/documents";

export const buildDocumentViewerPath = (
  descriptor: Pick<DocumentDescriptor, "type" | "id">,
): string =>
  `${DOCUMENT_VIEWER_BASE}/${descriptor.type}/${encodeURIComponent(String(descriptor.id))}`;
