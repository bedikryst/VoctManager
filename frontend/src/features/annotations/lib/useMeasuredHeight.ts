/**
 * @file useMeasuredHeight.ts
 * @description Live height of an element, so the card-placement maths never
 * runs on a guess.
 *
 * Both cards anchored to a marking need this and neither may estimate: the
 * placement rule is "stay off the music", and a card clamped against a guessed
 * height is what once put the note composer on the bar it was annotating. The
 * fallback covers exactly one layout pass, before paint.
 * @module features/annotations/lib
 */

import { useLayoutEffect, useState, type RefObject } from "react";

export const useMeasuredHeight = (
  ref: RefObject<HTMLElement | null>,
  fallback: number,
): number => {
  const [measured, setMeasured] = useState(fallback);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (): void =>
      setMeasured((current) =>
        Math.abs(current - element.offsetHeight) < 1 ? current : element.offsetHeight,
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return measured;
};
