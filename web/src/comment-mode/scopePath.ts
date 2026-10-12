/**
 * @file scopePath.ts
 * @description The map between a copy-desk scope and the site page the comment mode reads it on,
 *  in both directions. `copy:sync` sends `scopePath` with every row, so the desk's "open this page
 *  in comment mode" link reads a path the site computed; the comment mode runs `pathScope` on the
 *  page it is on, to rank that page's own fields first and to list them under "Pozostałe teksty".
 *
 *  THE SITE OWNS THIS MAP because only the site knows the facts in it. `page.<id>` is a YAML file
 *  name, not a URL: the landing is `landing.yaml` and lives at the root. A concert has a page only
 *  when `hasPage` says so, and Bobola has none. The legal pages are zero-JavaScript by design
 *  (`LegalDocShell`), so the mode never loads there and their scopes map to no path. The 404 page
 *  prints at whatever URL was requested, and the vault is an overlay mounted on most pages, so
 *  neither has a route of its own.
 *
 *  Paths are the canonical Polish ones. The mode switches language itself, through `localizePath`.
 *
 *  Plain erasable TypeScript importing only `.ts` siblings: `web/copydesk/*.mjs` imports this
 *  module with bare `node`, which strips the types and resolves nothing a bundler would.
 * @architecture Astro islands 2026
 * @module comment-mode/scopePath
 */

import { DEFAULT_LOCALE, LOCALES } from "../i18n/config.ts";

/** Page scopes read on the route named after their YAML file. */
const ROUTED_PAGES: ReadonlySet<string> = new Set([
  "o-nas",
  "kontakt",
  "fundacja",
  "mecenat",
  "koncerty",
  "obrazy",
  "kolofon",
  "press",
]);

/** The landing's YAML id; its route is the site's root. */
const LANDING = "landing";

/** The 404 page's scope, owned by whatever URL it was served at. */
const NOT_FOUND_SCOPE = "page.404";

/** The concert family's route prefix, `/koncerty/<id>`. */
const CONCERTS = "koncerty";

/**
 * The Polish path the comment mode opens `scope` on, or `""` when it has none. `hasPage` is the
 * concert's own flag from `concerts.yaml`; a page scope ignores it.
 */
export function scopePath(scope: string, { hasPage = false }: { hasPage?: boolean } = {}): string {
  const [namespace, id, ...rest] = scope.split(".");
  if (!id || rest.length > 0) return "";
  if (namespace === "concert") return hasPage ? `/${CONCERTS}/${id}` : "";
  if (namespace !== "page") return "";
  if (id === LANDING) return "/";
  return ROUTED_PAGES.has(id) ? `/${id}` : "";
}

/**
 * The scope whose fields the page at `pathname` owns, or `null` when it owns none. `notFound` is
 * true on the 404 page (`body.page-404`), which owns `page.404` at any URL.
 */
export function pathScope(
  pathname: string,
  { notFound = false }: { notFound?: boolean } = {},
): string | null {
  if (notFound) return NOT_FOUND_SCOPE;
  const base = basePath(pathname);
  if (base === "/") return `page.${LANDING}`;

  const parts = base.slice(1).split("/");
  if (parts.length === 2 && parts[0] === CONCERTS && parts[1]) return `concert.${parts[1]}`;
  if (parts.length === 1 && ROUTED_PAGES.has(parts[0])) return `page.${parts[0]}`;
  return null;
}

/**
 * The canonical Polish path behind a served URL: no `.html` (the build emits `build.format:
 * "file"`), no trailing slash, no `/en` or `/fr` prefix. The bar's language switch localizes it.
 */
export function basePath(pathname: string): string {
  const path =
    pathname
      .replace(/\.html$/u, "")
      .replace(/\/index$/u, "/")
      .replace(/\/+$/u, "") || "/";

  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (path === `/${locale}`) return "/";
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
  }
  return path;
}
