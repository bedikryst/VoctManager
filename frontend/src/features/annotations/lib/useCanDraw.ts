/**
 * @file useCanDraw.ts
 * @description Device gate for freehand authoring. Reading shared markings works
 * everywhere, but finger-drawing on a phone-sized score is poor — so pen /
 * highlighter are offered from tablet width (md, 768px) up, OR wherever a
 * precise pointer exists at all (stylus, mouse), which is what saves a small
 * tablet held in portrait from losing the pencil it is best at. Pinned/inline
 * notes stay available everywhere (see AnnotationToolbar).
 * @module features/annotations/lib
 */

import { useEffect, useState } from "react";

const DRAW_QUERIES = ["(min-width: 768px)", "(any-pointer: fine)"] as const;

const matchesAny = (): boolean =>
  DRAW_QUERIES.some((query) => window.matchMedia(query).matches);

export const useCanDraw = (): boolean => {
  const [canDraw, setCanDraw] = useState<boolean>(() =>
    typeof window === "undefined" ? true : matchesAny(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const lists = DRAW_QUERIES.map((query) => window.matchMedia(query));
    const onChange = () => setCanDraw(matchesAny());
    onChange();
    for (const list of lists) list.addEventListener("change", onChange);
    return () => {
      for (const list of lists) list.removeEventListener("change", onChange);
    };
  }, []);

  return canDraw;
};
