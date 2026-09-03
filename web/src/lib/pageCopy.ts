/**
 * @file pageCopy.ts
 * @description How a static page reads its own text: the Polish source in
 *  `src/content/pages/<page>.yaml`, validated against the page's schema, with every field the copy
 *  desk has translated substituted from the per-locale overlay.
 *
 *  FALLBACK IS PER FIELD, NOT PER PAGE — the rule the concert overlay already sets. A field with no
 *  translation prints its Polish beside fields that print English, so an English page can go up
 *  while its prose is still being reviewed. The alternative, waiting for a complete translation,
 *  shows nothing at all for months.
 *
 *  THE KEY IS NOT COMPUTED HERE. It comes from `i18n/content/copySpec`, which the desk's extractor
 *  imports as well, so the key a translation is stored under is the same expression as the key this
 *  lookup asks for. That is the whole reason the walk lives in a module with no bundler-only
 *  imports.
 *
 *  INTERNAL LINKS INSIDE PROSE ARE LOCALIZED AT RENDER. A translator writes `href="/press"` and
 *  never has to think about locale prefixes: every internal href in an `HTML` field goes through
 *  `localizePath`, which returns the Polish URL until that page has route files in this locale
 *  (i18n/config TRANSLATED_ROUTES). Nothing about a prefix is therefore stored in the copy, where
 *  it would go stale the day a page is translated.
 *
 *  BUILD-TIME ONLY. The sources are inlined by Vite as raw text and parsed per render of a page;
 *  the site is static, so no reader downloads them. Do not import this from a client island.
 * @architecture Astro islands 2026
 * @module lib/pageCopy
 */
import YAML from "yaml";

import { localizePath, type Locale } from "../i18n/config";
import { walkCopy, type PageCopySpec } from "../i18n/content/copySpec";
import { overlayValue } from "./copyOverlay";

/** Every page source, inlined at build. Eager because a page reads exactly one and the set is
    small; the glob is what keeps adding a page from touching this file. */
const SOURCES = import.meta.glob<string>("../content/pages/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});

function sourceOf(id: string): string {
  const path = `../content/pages/${id}.yaml`;
  const raw = SOURCES[path];
  if (raw === undefined) {
    throw new Error(`No copy source for page "${id}" — expected src/content/pages/${id}.yaml.`);
  }
  return raw;
}

/** Internal hrefs only: a path starting with `/`, captured apart from any query or fragment. */
const INTERNAL_HREF = /href="(\/[^"?#]*)([^"]*)"/g;

function localizeHrefs(html: string, locale: Locale): string {
  return html.replace(
    INTERNAL_HREF,
    (_match, path: string, rest: string) => `href="${localizePath(path, locale)}${rest}"`,
  );
}

/** Replace the string at a concrete location in the parsed document. */
function setAt(root: unknown, at: readonly (string | number)[], value: string): void {
  const last = at[at.length - 1];
  if (last === undefined) return;
  let node: unknown = root;
  for (const step of at.slice(0, -1)) {
    if (node === null || typeof node !== "object") return;
    node = (node as Record<string, unknown>)[String(step)];
  }
  if (node === null || typeof node !== "object") return;
  (node as Record<string, unknown>)[String(last)] = value;
}

/**
 * This page's copy in `locale` — the shape its schema describes, with translated fields in place.
 * The returned object is freshly parsed per call and is the caller's to read; nothing caches it,
 * because a static build renders each page once per locale.
 */
export function pageCopy<T>(spec: PageCopySpec<T>, locale: Locale): T {
  const data = spec.schema.parse(YAML.parse(sourceOf(spec.id)));
  for (const leaf of walkCopy(spec, data)) {
    const source = overlayValue(leaf.key, locale) ?? leaf.value;
    const next = leaf.kind === "HTML" ? localizeHrefs(source, locale) : source;
    if (next !== leaf.value) setAt(data, leaf.at, next);
  }
  return data;
}
