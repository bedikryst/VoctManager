/**
 * @file useDocumentLocale.ts
 * @description The current document's locale, for a React island, kept current across page swaps.
 *
 *  The subscription is the whole point and it is not defensive coding: a `transition:persist`
 *  island survives the swap that replaces `<html lang>` under it, so without the `astro:page-load`
 *  listener the first render's value would stand for the rest of the tab's life. A per-page island
 *  remounts anyway and simply reads the right value twice — which costs nothing and means every
 *  island on this site reaches its locale the same way.
 *
 *  `useState` + effect rather than `useSyncExternalStore`: the value is stable between navigations
 *  and there is no tearing to guard against, so the simpler hook is the honest one.
 * @architecture Astro islands 2026
 * @module islands/global/hooks/useDocumentLocale
 */

import { useEffect, useState } from "react";

import { documentLocale } from "../../../i18n/documentLocale";
import type { Locale } from "../../../i18n/config";

export function useDocumentLocale(): Locale {
  const [locale, setLocale] = useState<Locale>(documentLocale);

  useEffect(() => {
    const sync = (): void => setLocale(documentLocale());
    // The island may have hydrated before the swap that set this document's attribute finished.
    sync();
    document.addEventListener("astro:page-load", sync);
    return () => document.removeEventListener("astro:page-load", sync);
  }, []);

  return locale;
}
