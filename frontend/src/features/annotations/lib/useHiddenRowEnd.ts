/**
 * @file useHiddenRowEnd.ts
 * @description Whether a sideways-scrolling row has content past its right
 * edge, so the row can fade there while it does. A row cut cleanly between
 * two buttons reads as complete, and the tools beyond the cut (the eraser,
 * ⋯) are never found.
 * @module features/annotations/lib
 */

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export const useHiddenRowEnd = <T extends HTMLElement>(): readonly [
  (node: T | null) => void,
  boolean,
] => {
  const [node, setNode] = useState<T | null>(null);
  const [isHidden, setIsHidden] = useState(false);

  const measure = useCallback((): void => {
    if (!node) {
      setIsHidden(false);
      return;
    }
    const next = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
    setIsHidden((current) => (current === next ? current : next));
  }, [node]);

  // The row's content changes with the tool in hand (a pending-sync sign, a
  // family slot), which resizes nothing the observer below watches. Three
  // layout reads per render of the bar cover it.
  useLayoutEffect(measure);

  useEffect(() => {
    if (!node) return;
    node.addEventListener("scroll", measure, { passive: true });
    if (typeof ResizeObserver === "undefined") {
      return () => node.removeEventListener("scroll", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [node, measure]);

  return [setNode, isHidden] as const;
};
