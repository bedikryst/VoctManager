/**
 * @file config.ts
 * @description Locale registry + path helpers for the public site's i18n. Polish is the
 *  un-prefixed default; English and French are served under `/en/*` and `/fr/*`. Translation
 *  is opt-in PER PAGE: a base path only becomes locale-prefixable once it is listed in
 *  `TRANSLATED_ROUTES`. Until then `localizePath` deliberately returns the Polish URL for every
 *  locale, so a link on a translated page (e.g. the English /o-nas) that points at a not-yet-
 *  translated page (/koncerty) lands on the real Polish page instead of a 404 in an empty
 *  locale folder. Grow `TRANSLATED_ROUTES` as each page is translated — that single set is the
 *  switch that lights a page up in the nav, the language switcher and the hreflang graph.
 * @architecture Astro islands 2026
 * @module i18n/config
 */

export const LOCALES = ["pl", "en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

/** Canonical origin — the single owner of the production URL for build-time absolute links
 *  (canonical, og:url, hreflang, JSON-LD @id). Mirrors astro.config `site`; import this rather
 *  than re-hardcoding the host in every page component. */
export const SITE = "https://voctensemble.com";

/** Polish is canonical (source of truth) and un-prefixed — see astro.config i18n. */
export const DEFAULT_LOCALE: Locale = "pl";

export interface LocaleMeta {
  /** Switcher chip label. */
  readonly short: string;
  /** Full endonym for menus / aria. */
  readonly name: string;
  /** `<html lang>` value. */
  readonly htmlLang: string;
  /** Open Graph locale tag (xx_XX). */
  readonly ogLocale: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  pl: { short: "PL", name: "Polski", htmlLang: "pl", ogLocale: "pl_PL" },
  en: { short: "EN", name: "English", htmlLang: "en", ogLocale: "en_GB" },
  fr: { short: "FR", name: "Français", htmlLang: "fr", ogLocale: "fr_FR" },
};

/**
 * Base paths (Polish, un-prefixed) that exist in every locale. This is the lazy-translation
 * ledger: append a base path here the moment its `/en` and `/fr` route files ship, and the
 * whole i18n surface (localized links, the language switcher's option set, hreflang alternates)
 * turns on for it automatically. Keep entries as the canonical Polish path with no trailing
 * slash and no locale prefix.
 *
 * ORDERING CONTRACT (a manual invariant — nothing enforces it): add a path here ONLY after both
 * `src/pages/en/<page>.astro` and `src/pages/fr/<page>.astro` exist. Flip the switch first and
 * every localized link to this page (nav, footer, the switcher) immediately starts pointing at
 * `/en/<page>` and `/fr/<page>`, which 404 until those route files ship.
 */
export const TRANSLATED_ROUTES: ReadonlySet<string> = new Set<string>(["/o-nas"]);

/** True when `basePath` has real route files in every locale (safe to prefix / offer in the switcher). */
export function isTranslated(basePath: string): boolean {
  return TRANSLATED_ROUTES.has(basePath);
}

/**
 * URL for `basePath` in `locale`. Polish (default) and any not-yet-translated path return the
 * bare Polish URL; a translated path in a non-default locale gets the `/en` or `/fr` prefix.
 * `basePath` must be the canonical Polish path (leading slash, no locale prefix).
 */
export function localizePath(basePath: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return basePath;
  if (!isTranslated(basePath)) return basePath;
  return basePath === "/" ? `/${locale}` : `/${locale}${basePath}`;
}

/** Locales in which `basePath` actually exists — always includes Polish. */
export function availableLocales(basePath: string): Locale[] {
  return isTranslated(basePath) ? [...LOCALES] : [DEFAULT_LOCALE];
}

/**
 * hreflang alternates for a translated base path (absolute URLs), plus the `x-default` → Polish
 * entry. Returns an empty array for a path that lives only in Polish (no alternate graph needed).
 */
export function hreflangAlternates(
  basePath: string,
  site: string,
): { hreflang: string; href: string }[] {
  if (!isTranslated(basePath)) return [];
  const alts = LOCALES.map((loc) => ({
    hreflang: LOCALE_META[loc].htmlLang,
    href: new URL(localizePath(basePath, loc), site).href,
  }));
  alts.push({ hreflang: "x-default", href: new URL(basePath, site).href });
  return alts;
}

/** Everything a page component needs to wire one locale from its single canonical base path.
 *  Collapses the four call sites a page would otherwise repeat (localizePath for the self URL,
 *  hreflangAlternates, availableLocales, and the switcher's `current`) into one — pass the base
 *  path once so they can never drift out of sync. `path` is this render's own URL (→ BaseLayout
 *  `path` + SiteChrome `current`); `alternates` feeds the hreflang graph; `available` gates the
 *  language switcher. */
export function pageI18n(
  basePath: string,
  lang: Locale,
): {
  path: string;
  alternates: { hreflang: string; href: string }[];
  available: Locale[];
} {
  return {
    path: localizePath(basePath, lang),
    alternates: hreflangAlternates(basePath, SITE),
    available: availableLocales(basePath),
  };
}
