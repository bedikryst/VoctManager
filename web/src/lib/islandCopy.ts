/**
 * @file islandCopy.ts
 * @description Preparing a fragment of HTML prose for injection into a client island — the three
 *  passes the build runs over ordinary page markup and deliberately does NOT run inside an
 *  `<astro-island>`.
 *
 *  WHY AN ISLAND IS DIFFERENT. `lib/typoHtml` copies island subtrees through byte for byte, because
 *  rewriting text React is about to hydrate desynchronises the server and client renders — React
 *  answers a mismatch by discarding the server HTML. Plain text inside an island is covered by the
 *  island running the same rules in-render (`islands/landing/lib/Typo`), but a string injected
 *  through `dangerouslySetInnerHTML` has no string leaf for `Typo` to find. So it is typeset here,
 *  at build, before it is handed over.
 *
 *  A link inside such a fragment needs two more things, for reasons the vault stated first:
 *  its target has to be this locale's URL, and following it must not cost the reader what they had
 *  typed into the form standing beside it.
 * @architecture Astro islands 2026
 * @module lib/islandCopy
 */

import type { Locale } from "../i18n/config";
import { localizeCopyHrefs } from "./pageCopy";
import { typographyHtml } from "./typoHtml";

/** `<a>` with an href, captured so the tag can be reopened with two attributes added. */
const ANCHOR = /<a\s+([^>]*?)>/g;
const HREF = /href="([^"]*)"/;

/**
 * Give every link that navigates away a new tab. `mailto:` is left alone — it hands off to a mail
 * client and never replaces the document — and so is a link that already carries a `target`, so
 * this stays idempotent if a future field arrives with one.
 */
export function externalizeLinks(html: string): string {
  return html.replace(ANCHOR, (match, attrs: string) => {
    if (/\starget=/.test(` ${attrs}`)) return match;
    const href = HREF.exec(attrs)?.[1] ?? "";
    if (href.startsWith("mailto:")) return match;
    return `<a ${attrs} target="_blank" rel="noopener">`;
  });
}

/**
 * A CHROME string on its way into an island: localized links, typeset, and safe to follow from
 * beside a half-filled form. Copy fields take the same passes through `pageCopy`'s `HtmlPass`
 * seam, which has already localized their hrefs by the time it runs — this is the entry point for
 * prose that never went through a page file.
 */
export function chromeHtmlForIsland(html: string, locale: Locale): string {
  return externalizeLinks(typographyHtml(localizeCopyHrefs(html, locale), locale));
}
