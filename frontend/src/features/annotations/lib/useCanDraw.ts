/**
 * @file useCanDraw.ts
 * @description May this reader put freehand ink on the page? Decided from the
 * PAGE, not from the device: what governs whether a stroke lands where it was
 * meant is how large the music is actually rendered, and one phone shows a
 * 311px page upright and a 622px one on its side in half-page fit. A precise
 * pointer — stylus or mouse — settles it outright, because precision is the
 * only thing being measured here. Pinned/inline notes, stamps and the eraser
 * stay available everywhere (see AnnotationToolbar).
 * @module features/annotations/lib
 */

import { useEffect, useState } from "react";

/**
 * Rendered page width (CSS px, zoom included) below which a fingertip covers
 * too much of a stave for the mark to mean anything. An A4 at this width is
 * roughly half life size — the point where a written word still reads back from
 * a stand.
 */
export const DRAW_MIN_PAGE_WIDTH = 520;

/** A stylus or mouse is precision by itself, whatever the page measures. */
const PRECISE_POINTER_QUERY = "(any-pointer: fine)";
/** Stand-in until the first page box is measured. */
const TABLET_WIDTH_QUERY = "(min-width: 768px)";

interface UseCanDrawArgs {
  /** Live rendered page width from the viewer; null before the first measure. */
  pageWidth?: number | null;
  /** Whether an active stylus has ever touched this device. */
  stylusSeen?: boolean;
}

const matches = (query: string): boolean =>
  typeof window === "undefined" ? true : window.matchMedia(query).matches;

const useMediaQuery = (query: string): boolean => {
  const [isMatch, setIsMatch] = useState<boolean>(() => matches(query));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const list = window.matchMedia(query);
    const onChange = () => setIsMatch(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return isMatch;
};

export const useCanDraw = ({
  pageWidth = null,
  stylusSeen = false,
}: UseCanDrawArgs = {}): boolean => {
  const hasPrecisePointer = useMediaQuery(PRECISE_POINTER_QUERY);
  const isTabletWidth = useMediaQuery(TABLET_WIDTH_QUERY);

  if (stylusSeen || hasPrecisePointer) return true;
  return pageWidth === null ? isTabletWidth : pageWidth >= DRAW_MIN_PAGE_WIDTH;
};
