/**
 * @file useMeasuredWidth.ts
 * @description Live width of an element, for a layout that is decided in
 * pixels: the symbol palette spans a word across as many cells as its measured
 * width needs, and a cell is only known once the panel has laid out. The
 * fallback covers exactly one layout pass, before paint.
 * @module features/annotations/lib
 */

import { useLayoutEffect, useState, type RefObject } from "react";

export const useMeasuredWidth = (
  ref: RefObject<HTMLElement | null>,
  fallback: number,
): number => {
  const [measured, setMeasured] = useState(fallback);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (): void =>
      setMeasured((current) =>
        Math.abs(current - element.offsetWidth) < 1 ? current : element.offsetWidth,
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return measured;
};
