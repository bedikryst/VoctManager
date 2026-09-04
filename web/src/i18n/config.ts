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

/**
 * One string held per locale — the shape every translatable value in `concerts.yaml` takes
 * (`textGloss`, `inscriptioGloss`, `metaPlace`, `movements[].gloss`…).
 *
 * POLISH IS REQUIRED and the others are not, because Polish is the canonical source: a
 * translation exists only as the rendering of a Polish value, and a map without `pl` would be a
 * translation of nothing — nothing to fall back to on the Polish page, and nothing for the copy
 * desk to hash a translation against.
 */
export type LocalizedText = Partial<Record<Locale, string>> & { readonly pl: string };

/**
 * The value `locale` prints, falling back to Polish while a translation is still missing.
 *
 * MIND WHERE THE MAP CAME FROM. `concerts.yaml` has been Polish-only since stage C3 and its maps
 * carry `pl` alone, so calling this on one returns Polish in every locale — silently, on a page
 * that looks translated. A concert field's translation lives in the copy desk's per-locale overlay
 * and is read through `lib/copyOverlay`; this function is for maps that genuinely hold their own
 * locales.
 */
export function pickLocale(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.pl;
}

/**
 * The gloss to print beside a sung original, or `null` when there is nothing to print.
 *
 * A gloss is the sung text IN THE READER'S LANGUAGE, so it collapses into the original whenever
 * the two are the same language — thirteen of this corpus's forty-two sung texts are English
 * already, and one ("Stoi lód na Prośnie") is Polish. The slot is filled in every locale
 * regardless, because an empty one falls back to Polish and would print a Polish stanza under an
 * English original; it is the PAGE that decides not to say the same thing twice.
 *
 * `gloss` is the value THIS RENDER prints — the caller has already resolved it through the copy
 * desk's overlay. It is not a `LocalizedText` any more: since stage C3 a map in `concerts.yaml`
 * carries `pl` alone, so reading one here would have collapsed the English gloss against nothing
 * and printed the Polish under every foreign original.
 *
 * Compared on collapsed whitespace: the original and its gloss are hand-wrapped block scalars
 * written at different times, and a line break is not a difference in what was sung.
 */
export function glossFor(
  original: string | undefined,
  gloss: string | undefined,
): string | null {
  if (!gloss || !gloss.trim()) return null;
  const flatten = (text: string) => text.replace(/\s+/gu, " ").trim();
  return original && flatten(original) === flatten(gloss) ? null : gloss;
}

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
 *
 * THE CONCERT PAGES ARE THE ONE EXEMPTION, and they earned it by being a parameterized route
 * rather than a page. `src/pages/{en,fr}/koncerty/[id].astro` exist for the whole family and read
 * THIS SET in their own `getStaticPaths`, so adding an id emits the two foreign pages and lights
 * the links to them in the same build — there is no window in which one exists without the other,
 * and no ordering left to get wrong. Six concerts therefore become six entries, each flipped on
 * its own: a concert enters when its translation is reviewed, not when the section is.
 */
export const TRANSLATED_ROUTES: ReadonlySet<string> = new Set<string>([
  "/o-nas",
  "/kontakt",
  "/koncerty",
  "/obrazy",
  "/koncerty/wcielenie",
  "/koncerty/wolanie-gor",
  "/koncerty/9-kart",
  "/koncerty/hymn-poleglym",
  "/koncerty/aeternam",
]);

/**
 * Master visibility of the on-page language switcher. Temporarily OFF: the EN/FR pages still build
 * and stay reachable by direct URL (link-only preview while the translations are validated), the
 * hreflang graph and localized links stay intact — only the visible switcher chips are hidden on
 * desktop and mobile. Flip to `true` to surface the switcher again (no other change needed).
 */
export const LANG_SWITCHER_ENABLED = false;

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
