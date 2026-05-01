/**
 * @file types.ts
 * @description Public type contract for the deep-linkable document viewer route.
 * Lives in its own module so callsite shells (e.g. PdfViewerModal) can import the
 * descriptor and path builder eagerly without pulling the heavyweight page chunk
 * into the main bundle. The page component lives in `./index.tsx` and is loaded
 * lazily by the router.
 * @architecture Enterprise SaaS 2026
 * @module pages/app/DocumentViewerPage/types
 */

/**
 * Closed set of document types the viewer route knows how to resolve.
 * Adding a new type requires extending the resolver in `./index.tsx`.
 */
export type DocumentType =
  | "project-score"
  | "project-call-sheet"
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

const DOCUMENT_VIEWER_BASE = "/documents";

export const buildDocumentViewerPath = (
  descriptor: Pick<DocumentDescriptor, "type" | "id">,
): string =>
  `${DOCUMENT_VIEWER_BASE}/${descriptor.type}/${encodeURIComponent(String(descriptor.id))}`;
