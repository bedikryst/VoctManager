/**
 * @file usePdfOutline.ts
 * @description Reads the loaded document's PDF outline (bookmarks) and resolves
 * each entry to a 1-based page number — the seam that turns the concert
 * score-book's per-piece bookmarks into in-viewer "jump to piece" navigation.
 * Resolution is async and generation-guarded, so a document swapped mid-flight
 * never publishes a stale outline. Documents without an outline yield an empty
 * list and cost one rejected promise at most.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface PdfOutlineEntry {
  title: string;
  page: number;
  /** 0 = top-level bookmark, 1 = nested (deeper levels are flattened to 1). */
  depth: number;
}

interface RawOutlineNode {
  title: string;
  dest?: unknown;
  items?: RawOutlineNode[];
}

/**
 * Structural slice of pdf.js's PDFDocumentProxy — method syntax keeps the
 * interface bivariant so the real proxy satisfies it without casts.
 */
export interface OutlineCapableDocument {
  numPages: number;
  getOutline?(): Promise<RawOutlineNode[] | null>;
  getDestination?(id: string): Promise<unknown[] | null>;
  getPageIndex?(ref: unknown): Promise<number>;
}

const MAX_OUTLINE_DEPTH = 1;
const MAX_OUTLINE_ENTRIES = 200;

export const usePdfOutline = (
  resetKey: string | null,
): {
  outline: PdfOutlineEntry[];
  loadOutline: (pdf: OutlineCapableDocument) => void;
} => {
  const [outline, setOutline] = useState<PdfOutlineEntry[]>([]);
  const generationRef = useRef(0);

  // New document → drop the previous document's outline immediately.
  useEffect(() => {
    generationRef.current += 1;
    setOutline([]);
  }, [resetKey]);

  const loadOutline = useCallback((pdf: OutlineCapableDocument) => {
    if (
      typeof pdf.getOutline !== "function" ||
      typeof pdf.getDestination !== "function" ||
      typeof pdf.getPageIndex !== "function"
    ) {
      return;
    }
    const generation = ++generationRef.current;

    const resolve = async (): Promise<void> => {
      const raw = await pdf.getOutline?.();
      if (!raw || raw.length === 0) return;

      const entries: PdfOutlineEntry[] = [];
      const walk = async (nodes: RawOutlineNode[], depth: number): Promise<void> => {
        for (const node of nodes) {
          if (entries.length >= MAX_OUTLINE_ENTRIES) return;
          let dest = node.dest;
          if (typeof dest === "string") {
            dest = await pdf.getDestination?.(dest);
          }
          const ref = Array.isArray(dest) ? dest[0] : null;
          if (node.title && ref != null) {
            try {
              const pageIndex = await pdf.getPageIndex?.(ref);
              if (typeof pageIndex === "number") {
                entries.push({ title: node.title, page: pageIndex + 1, depth });
              }
            } catch {
              // Unresolvable destination — skip the entry, keep the rest.
            }
          }
          if (node.items?.length) {
            await walk(node.items, Math.min(depth + 1, MAX_OUTLINE_DEPTH));
          }
        }
      };
      await walk(raw, 0);

      if (generation === generationRef.current && entries.length > 0) {
        setOutline(entries);
      }
    };

    resolve().catch(() => {
      // Malformed outline — behave as if the document had none.
    });
  }, []);

  return { outline, loadOutline };
};
