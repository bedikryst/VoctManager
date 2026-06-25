/**
 * @file useCanDraw.ts
 * @description Viewport gate for freehand authoring. Reading shared markings
 * works on every device, but finger-drawing on a phone-sized score is poor — so
 * pen / highlighter / eraser are offered only from tablet width (md, 768px) up.
 * Pinned/inline notes stay available everywhere (see AnnotationToolbar).
 * @module features/annotations/lib
 */

import { useEffect, useState } from "react";

const DRAW_VIEWPORT_QUERY = "(min-width: 768px)";

export const useCanDraw = (): boolean => {
  const [wideEnough, setWideEnough] = useState<boolean>(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia(DRAW_VIEWPORT_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(DRAW_VIEWPORT_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setWideEnough(event.matches);
    setWideEnough(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return wideEnough;
};
