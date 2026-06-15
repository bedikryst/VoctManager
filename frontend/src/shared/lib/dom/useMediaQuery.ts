/**
 * @file useMediaQuery.ts
 * @description Subscribe to a CSS media query from React. Used to branch UI by
 * input modality (e.g. a left drawer on a fine pointer vs a bottom sheet on
 * touch) — the JS mirror of the `fine-pointer:` CSS variant.
 * @module shared/lib/dom
 * @architecture Enterprise SaaS 2026
 */

import { useEffect, useState } from "react";

export const useMediaQuery = (query: string): boolean => {
  const getMatch = (): boolean =>
    typeof window !== "undefined" && window.matchMedia(query).matches;

  const [matches, setMatches] = useState<boolean>(getMatch);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQueryList = window.matchMedia(query);
    const handleChange = (): void => setMatches(mediaQueryList.matches);

    handleChange();
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
};

/** True on a mouse/trackpad (hover-capable, fine pointer); false on touch. */
export const useIsFinePointer = (): boolean =>
  useMediaQuery("(hover: hover) and (pointer: fine)");
