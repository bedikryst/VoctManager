/**
 * @file documentLocale.ts
 * @description The locale of the document currently on screen, read off `<html lang>`.
 *
 *  WHY NOT A PROP, WHICH IS THE OBVIOUS ANSWER. Two of the three surfaces that need this are
 *  client islands mounted by `BaseLayout`, and one of them (`ScrollTopButton`) is
 *  `transition:persist`: the ClientRouter keeps that island's instance ALIVE across a page swap,
 *  so a locale handed to it as a prop freezes at whatever the first page loaded in this tab
 *  happened to be. A Polish landing, one navigation to `/en/kontakt`, and the button is still
 *  offering "wróć na początek strony" to an English reader — silently, because nothing about a
 *  stale prop is an error. The document element, by contrast, is rewritten by every swap.
 *
 *  The chrome's own delegated script has the same shape for a different reason: it binds ONCE per
 *  tab (`__voctChrome`) and outlives every document it acts on, so it must ask at the moment it
 *  acts rather than remember.
 *
 *  Falls back to Polish for the same reason `SiteFooter`'s `lang` prop does — an un-migrated or
 *  attribute-less document renders exactly as it did before.
 * @architecture Astro islands 2026
 * @module i18n/documentLocale
 */

import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

const KNOWN = new Set<string>(LOCALES);

/**
 * The current document's locale. `<html lang>` carries the locale's `htmlLang`, which for this
 * site's three locales is the locale itself; anything else — a region subtag, an empty attribute,
 * a document served outside Astro — reads as Polish.
 */
export function documentLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const lang = document.documentElement.lang.toLowerCase().split("-")[0];
  return KNOWN.has(lang) ? (lang as Locale) : DEFAULT_LOCALE;
}
