/**
 * @file breadcrumb.ts
 * @description Single owner of the schema.org `BreadcrumbList` node. The site shows no visible
 *  breadcrumb bar and is not getting one — a concert page already states where it stands twice
 *  over (the Via rail, then `.kd-vianav` in the coda), and a chrome strip under the nave would
 *  be a third. This markup exists for the SEARCH RESULT alone, where the trail takes the place
 *  of the raw URL under the title.
 *
 *  The trail is AUTHORED, never derived from the page's `title`: every title here carries a
 *  "— VoctEnsemble" / "· VoctFoundation" suffix written for a browser tab, and a trail that
 *  repeats the brand at every level says nothing about the hierarchy. The page states its own
 *  crumb names; this module only prepends the home node and absolutizes.
 *
 *  HOME IS THE POLISH LANDING IN EVERY LOCALE, and deliberately so. Translation is opt-in per
 *  page (i18n/config TRANSLATED_ROUTES) and the landing is not translated, so `/en` and `/fr`
 *  do not exist as documents. The English /o-nas therefore already sends its brand link and its
 *  footer "Home" to `/` — the trail describing the same parent is the site as it is, not a
 *  claim about a page nobody wrote. The URL comes from `localizePath` rather than a literal, so
 *  the day a landing ships in a locale the trail follows the ledger without an edit here. The
 *  LABEL is translated all the same (`UI[lang].footer.home`), the same split the footer's own
 *  index already makes for /obrazy: a reader is told where the link goes in their language,
 *  even when what waits there is Polish.
 * @architecture Astro islands 2026
 * @module lib/breadcrumb
 */

import { localizePath, SITE, type Locale } from "../i18n/config";
import { UI } from "../i18n/ui";

/** One level of the trail. `path` is site-absolute ("/koncerty"), exactly as BaseLayout's own
    `path` prop — it is absolutized against SITE here, so no page hardcodes the host. */
export interface Crumb {
  readonly name: string;
  readonly path: string;
}

/** JSON-LD on its way to `JSON.stringify` — open-valued for the same reason `MusicEventNode` is
    (see lib/eventSchema): a hand-kept mirror of schema.org's shape would rot unchecked. */
export type BreadcrumbNode = Record<string, unknown>;

/**
 * Build the `BreadcrumbList` for `trail` — the page's full path below the home node, ending with
 * the page itself. Returns undefined for an empty trail: the landing's own trail is one node long
 * and a breadcrumb that says only "home" is not a hierarchy.
 *
 * Every item keeps its `item` URL, including the last. Google treats the leaf's URL as optional,
 * not as something to omit, and a uniform shape is one fewer special case at six call sites.
 */
export const breadcrumbList = (
  trail: readonly Crumb[],
  lang: Locale,
): BreadcrumbNode | undefined => {
  if (trail.length === 0) return undefined;
  const home: Crumb = { name: UI[lang].footer.home, path: localizePath("/", lang) };
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [home, ...trail].map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: new URL(crumb.path, SITE).href,
    })),
  };
};
