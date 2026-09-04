/**
 * @file vaultCopy.ts
 * @description The donation vault's words, resolved for one locale and made ready to hand to a
 *  client island.
 *
 *  WHY THE VAULT NEEDS ITS OWN RESOLVER WHEN EVERY OTHER PAGE JUST CALLS `pageCopy`. Two things
 *  the build does for a page's markup, it deliberately does NOT do inside an island, and both of
 *  them have to be done here instead:
 *
 *  1. TYPOGRAPHY. `lib/typoHtml` copies `<astro-island>` subtrees through byte for byte, because
 *     rewriting text React is about to hydrate desynchronises the server and client renders. Plain
 *     text is covered — the island runs the same rules in-render (`islands/landing/lib/Typo`) — but
 *     an `HTML` field is injected through `dangerouslySetInnerHTML`, where `Typo` sees no string
 *     leaf to pin. So the French narrow no-break spaces are put in HERE, at build, on the string
 *     that will be injected. Without this, French prose inside the vault would be the one place on
 *     the site that never met `lib/typo`.
 *  2. LINK TARGETS. Every link in this copy is read in an overlay standing above a half-filled
 *     donation form, so following one in place costs the reader what they had typed. The `target`
 *     is added at render rather than written into the content file — the same seam `pageCopy`
 *     already occupies for `localizePath`, and the reason `kontakt.yaml` carries a bare `<a href>`
 *     with no presentation on it. It also keeps `target`/`rel` off the desk's whitelist, where an
 *     editor's first proposal on the field would have stripped them in silence (spec §7).
 *
 *  THE CHROME IS NOT HERE. Affordances, form labels and validation messages are a typed triple the
 *  island imports directly (`i18n/content/skarbiecChrome`) — they carry functions (a plural, an
 *  interpolated amount) and a function cannot survive being serialized into an island's props.
 *
 *  BUILD-TIME ONLY, like the two modules it stands on. `components/VaultMount.astro` is its one
 *  caller and hands the result to the island as a prop.
 * @architecture Astro islands 2026
 * @module lib/vaultCopy
 */

import type { Locale } from "../i18n/config";
import { REGULAMIN_PAGE, type TermsCopy } from "../i18n/content/regulaminDarowizn";
import { SKARBIEC_PAGE, type VaultCopy } from "../i18n/content/skarbiec";
import { pageCopy } from "./pageCopy";
import { typographyHtml } from "./typoHtml";

/** Everything the island renders that came out of a content file. */
export interface VaultCopyBundle {
  readonly vault: VaultCopy;
  readonly terms: TermsCopy;
}

/** `<a>` with an href, captured so the tag can be reopened with two attributes added. */
const ANCHOR = /<a\s+([^>]*?)>/g;
const HREF = /href="([^"]*)"/;

/**
 * Give every link that navigates away a new tab. `mailto:` is left alone — it hands off to a mail
 * client and never replaces the document — and so is a link that already carries a `target`, so
 * this stays idempotent if a future field arrives with one.
 */
function externalizeLinks(html: string): string {
  return html.replace(ANCHOR, (match, attrs: string) => {
    if (/\starget=/.test(` ${attrs}`)) return match;
    const href = HREF.exec(attrs)?.[1] ?? "";
    if (href.startsWith("mailto:")) return match;
    return `<a ${attrs} target="_blank" rel="noopener">`;
  });
}

const htmlPass = (html: string, locale: Locale): string =>
  externalizeLinks(typographyHtml(html, locale));

/** The vault's prose and its terms in `locale`, with translated fields in place. */
export function vaultCopy(locale: Locale): VaultCopyBundle {
  return {
    vault: pageCopy(SKARBIEC_PAGE, locale, htmlPass),
    terms: pageCopy(REGULAMIN_PAGE, locale, htmlPass),
  };
}
