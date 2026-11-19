/**
 * @file useScorePane.ts
 * @description The width of the piece card's score pane, sized by the page
 * rather than by a fraction of the screen: as wide as the whole page needs to
 * fill the pane's height, never narrower than a legibility floor, and never
 * more than half of the width right of the rail, where the cap wins over the
 * floor. "Poszerz podgląd partytury" takes the half outright, and that choice
 * holds for the rest of the browser session.
 * @module features/archive/piece-card/useScorePane
 */

import { useCallback, useRef, useState } from "react";

import { viewerWidthForPage } from "@/shared/ui/composites/PdfViewer";

/** Narrowest page the pane sizes itself for, in CSS px. */
export const SCORE_PAGE_FLOOR_PX = 520;
/** A4 portrait (height / width) until the page reports its own. */
const INITIAL_PAGE_ASPECT = 1.414;
const WIDE_STORAGE_KEY = "voct.pieceCard.wideScore";

interface PaneBox {
  readonly width: number;
  readonly height: number;
}

export interface ScorePaneInput {
  /** Width of the panes together: everything right of the rail. */
  readonly contentWidth: number;
  /** Height of the pane, which is the viewer's whole height. */
  readonly contentHeight: number;
  /** Page height / width. */
  readonly pageAspect: number;
  readonly isWide: boolean;
}

export const scorePaneWidth = ({
  contentWidth,
  contentHeight,
  pageAspect,
  isWide,
}: ScorePaneInput): number => {
  const cap = Math.floor(contentWidth / 2);
  if (isWide) return cap;
  return Math.min(
    cap,
    viewerWidthForPage({
      viewerHeight: contentHeight,
      pageAspect,
      minPageWidth: SCORE_PAGE_FLOOR_PX,
    }),
  );
};

const readWide = (): boolean => {
  try {
    return window.sessionStorage.getItem(WIDE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export interface ScorePane {
  /** Attach to the element holding both panes; it is what gets measured. */
  readonly contentRef: (node: HTMLDivElement | null) => void;
  /** Null until the panes have been measured once. */
  readonly paneWidth: number | null;
  readonly isWide: boolean;
  readonly toggleWide: () => void;
  /** Hand to `PdfViewer`'s `onPageAspectChange`. */
  readonly onPageAspectChange: (aspect: number) => void;
}

export const useScorePane = (): ScorePane => {
  const [box, setBox] = useState<PaneBox | null>(null);
  const [pageAspect, setPageAspect] = useState(INITIAL_PAGE_ASPECT);
  const [isWide, setIsWide] = useState(readWide);
  const observerRef = useRef<ResizeObserver | null>(null);

  // A callback ref, so the first measurement lands in the commit that mounts
  // the panes and the first painted frame already has the pane at its width.
  const contentRef = useCallback((node: HTMLDivElement | null): void => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const measure = (): void => {
      const next = { width: node.clientWidth, height: node.clientHeight };
      setBox((current) =>
        current && current.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  const onPageAspectChange = useCallback((aspect: number): void => {
    setPageAspect((current) => (Math.abs(current - aspect) < 0.001 ? current : aspect));
  }, []);

  const toggleWide = useCallback((): void => {
    setIsWide((current) => {
      const next = !current;
      try {
        window.sessionStorage.setItem(WIDE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Storage refused (private mode): the choice holds for this page only.
      }
      return next;
    });
  }, []);

  const paneWidth = box
    ? scorePaneWidth({
        contentWidth: box.width,
        contentHeight: box.height,
        pageAspect,
        isWide,
      })
    : null;

  return { contentRef, paneWidth, isWide, toggleWide, onPageAspectChange };
};
