/**
 * @file notFound.ts
 * @description Everything about the not-found page (`/404`) except its words: the shape its Polish
 *  prose must have (zod, `.strict()`), the copy desk's key contract over that prose, and the one
 *  chrome string the page needs of its own.
 *
 *  THE PAGE IS FOUR SENTENCES AND FOUR DOORS, and only the sentences are copy. The doors carry
 *  Latin rubrics (locale-neutral, in the markup) over vernacular names the chrome ALREADY prints —
 *  `UI[lang].footer.home`, `CONCERT[lang].meta.breadcrumb`, `UI[lang].nav.about`,
 *  `UI[lang].nav.contact`. Restating them here would be four more rows on the desk carrying names
 *  that already exist, and the first edit to either copy would leave a reader looking at two words
 *  for one destination on the same screen (spec §6y: a name printed twice is READ twice, never
 *  written twice). `NotFoundPage.astro` resolves them; nothing about them reaches the corpus.
 *
 *  THE PAGE ID IS `404`, which `KEY_PATTERN` accepts as a key part and which matches the route
 *  file the build emits. The desk therefore addresses this page as `page.404.head.lede`.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here (type-stripping, no build step), so that the key a translation is stored
 *  under and the key the page looks up are the same expression. Keep it free of `?raw`,
 *  `astro:assets` and anything else only a bundler can resolve.
 * @architecture Astro islands 2026
 * @module i18n/content/notFound
 */

import { z } from "astro/zod";

import type { Locale } from "../config";
import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The prose, as a shape ─────────────────────────────────────────────────────────────────────

/** `.strict()` throughout: a hand-added `en:` beside a Polish value fails the build rather than
    being dropped in silence. Translations belong in the overlay. */
const notFoundCopySchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    head: z.object({ title: z.string(), lede: z.string() }).strict(),
  })
  .strict();

export type NotFoundCopy = z.infer<typeof notFoundCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/** DECLARATION ORDER IS READING ORDER — `order` is a counter over this list. */
const NOT_FOUND_CONTRACT: readonly CopyEntry[] = [
  {
    kind: "field",
    path: "meta.title",
    label: "Metadane · tytuł strony",
    note: "Read in a browser tab and by a crawler, never on the page. It is the h1 with the site's name after it, and the two should keep saying the same thing.",
  },
  {
    kind: "field",
    path: "meta.description",
    label: "Metadane · opis strony",
    note: "The page is noindex, so this is not competing for a search result. It names the blank and lists the ways out.",
  },
  {
    kind: "field",
    path: "head.title",
    label: "Wejście · tytuł",
    note: "Set at up to 104px. The register is `vacat` — the bibliographic term for a leaf a book leaves blank — so it is a statement about the LEAF, never an apology to the reader and never a report of an error code.",
  },
  {
    kind: "field",
    path: "head.lede",
    label: "Wejście · lede",
    note: "Two clauses and a direction. The second sentence is the page's whole purpose: the reader is a few steps from the nave, not lost. \"Nawa\" is the nave of a church and the site's own word for its front — keep the architectural image if the language has one.",
  },
];

/** Everything else in `404.yaml`, with the reason it is not text a reader is meant to read. */
const NOT_FOUND_NOT_COPY: Readonly<Record<string, string>> = {};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const NOT_FOUND_PAGE: PageCopySpec<NotFoundCopy> = {
  id: "404",
  label: "404 · Vacat",
  schema: notFoundCopySchema,
  contract: NOT_FOUND_CONTRACT,
  notCopy: NOT_FOUND_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

export interface NotFoundChrome {
  /**
   * The landmark name on the list of ways out. It must not read as the site's index — the footer
   * under this very page already carries that one — so it names the MOVE rather than the set:
   * this is the way back, not a table of contents.
   */
  readonly waysAria: string;
}

export const NOT_FOUND_CHROME: Record<Locale, NotFoundChrome> = {
  pl: { waysAria: "Powrót" },
  en: { waysAria: "The way back" },
  fr: { waysAria: "Le retour" },
};
