/**
 * @file useBodyClass.ts
 * @description Toggles a class on `document.body` while the host component is mounted.
 * Multiple consumers can share the same class without races (a refcount keeps it
 * applied until every mount unwinds).
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useBodyClass
 */

import { useEffect } from "react";

const REFCOUNTS = new Map<string, number>();

export function useBodyClass(className: string | null | undefined): void {
  useEffect(() => {
    if (!className) return;
    const next = (REFCOUNTS.get(className) ?? 0) + 1;
    REFCOUNTS.set(className, next);
    document.body.classList.add(className);
    return () => {
      const remaining = (REFCOUNTS.get(className) ?? 1) - 1;
      if (remaining <= 0) {
        REFCOUNTS.delete(className);
        document.body.classList.remove(className);
      } else {
        REFCOUNTS.set(className, remaining);
      }
    };
  }, [className]);
}
