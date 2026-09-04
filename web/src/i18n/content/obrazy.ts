/**
 * @file obrazy.ts
 * @description Everything about the image archive (/obrazy) except its words: the shape its Polish
 *  prose must have (zod, `.strict()`), the copy desk's key contract over that prose, the page's
 *  chrome in all three locales, and the declensions its counted line needs.
 *
 *  THE PAGE SAYS VERY LITTLE, WHICH IS THE POINT. Nine fields of prose stand around 48
 *  photographs; everything else a reader meets belongs to something that already owns it — an
 *  evening's title and its frames' alt text to `concerts.yaml` through the desk's overlay, a run's
 *  place to `i18n/content/miejsca.ts`, the credits to `lib/photoCredit`, the numbers to the build.
 *  `src/content/pages/obrazy.yaml` states the same division from the corpus's side.
 *
 *  WHY THE NOUNS OF THE COUNTED LINE ARE CHROME. "48 fotografii · 5 wieczorów · 6 miejsc" is
 *  computed, and a noun that must agree with a computed number is not a sentence anybody reviews —
 *  it is a form the language demands, and a form missing in French is a broken line rather than one
 *  waiting for review. Same test as a landmark (§6r), so the same shape: `Record<Locale, …>`.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here (type-stripping, no build step), so that the key a translation is stored
 *  under and the key the page looks up are the same expression. Keep it free of `?raw`,
 *  `astro:assets` and anything else only a bundler can resolve.
 *
 *  Chrome carries no typography either — `lib/typo.ts` gives each locale its own at build.
 * @architecture Astro islands 2026
 * @module i18n/content/obrazy
 */

import { z } from "astro/zod";

import type { Locale } from "../config";
import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The prose, as a shape ─────────────────────────────────────────────────────────────────────

/**
 * `.strict()` throughout: a hand-added `en:` beside a Polish value would otherwise be dropped in
 * silence by zod's default and the translation would simply never appear. Translations belong in
 * the overlay, and this is what says so.
 */
const obrazyCopySchema = z
  .object({
    meta: z
      .object({ title: z.string(), description: z.string(), galleryName: z.string() })
      .strict(),
    head: z.object({ eyebrow: z.string(), title: z.string(), lede: z.string() }).strict(),
    colophon: z.object({ eyebrow: z.string(), note: z.string(), back: z.string() }).strict(),
  })
  .strict();

export type ObrazyCopy = z.infer<typeof obrazyCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/**
 * DECLARATION ORDER IS READING ORDER — the desk renders this page in the sequence a reader meets
 * it, head to colophon, because `order` is a counter over this list. The evenings between the two
 * are absent here on purpose: they are the concerts' own words, on the desk under their own scope.
 */
const OBRAZY_CONTRACT: readonly CopyEntry[] = [
  // ── Metadane ──────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "meta.title",
    label: "Metadane · tytuł strony",
    note: "Read in a search result and a browser tab, not on the page.",
  },
  {
    kind: "field",
    path: "meta.description",
    label: "Metadane · opis strony",
    note: "It counts the evenings — \"z pięciu Koncertów Duchowych\" — and the page beside it counts them at build. The number will be wrong the day a sixth gallery lands, so a count-free rendering is better than a faithful translation of this one.",
  },
  {
    kind: "field",
    path: "meta.galleryName",
    label: "Metadane · nazwa galerii",
    note: "Structured data only (schema.org ImageGallery). The page title without the site's name after it.",
  },

  // ── Wejście ───────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "head.eyebrow",
    label: "Wejście · rubryka",
    note: "The vernacular of `Imagines`, which stands above it unchanged in every locale.",
  },
  {
    kind: "field",
    path: "head.title",
    label: "Wejście · tytuł",
    note: "One word, set at up to 132px, and the page's own name: it is also what the breadcrumb prints. `Obrazy` is what this site calls a concert of the cycle as well — the same word does both jobs in Polish, and a translation may need two.",
  },
  { kind: "field", path: "head.lede", label: "Wejście · lede" },

  // ── Kolofon ───────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "colophon.eyebrow",
    label: "Kolofon · rubryka",
    note: "The vernacular tier under the Latin `Photographi`, and not a translation of it: the Latin names the photographers, this names the photographs.",
  },
  {
    kind: "field",
    path: "colophon.note",
    label: "Kolofon · nota",
    note: "Stands under the list of names and qualifies it: most of this archive is the ensemble photographing itself. `lib/photoCredit` renders the same fact inside a run's own credit line, so keep the two saying one thing.",
  },
  { kind: "field", path: "colophon.back", label: "Kolofon · powrót" },
];

/** Everything else in `obrazy.yaml`, with the reason it is not text a reader is meant to read. */
const OBRAZY_NOT_COPY: Readonly<Record<string, string>> = {};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const OBRAZY_PAGE: PageCopySpec<ObrazyCopy> = {
  id: "obrazy",
  label: "Obrazy",
  schema: obrazyCopySchema,
  contract: OBRAZY_CONTRACT,
  notCopy: OBRAZY_NOT_COPY,
};

// ── The counted line ──────────────────────────────────────────────────────────────────────────

/**
 * A noun in the forms a counted number can demand of it. `few` is Slavic: Polish declines 2–4
 * (and 22–24, and not 12–14) differently from 5 and up, which is exactly the distinction that
 * would otherwise leave "48 fotografia" on the page. English and French need two forms and omit
 * it.
 */
export interface CountForms {
  readonly one: string;
  readonly few?: string;
  readonly many: string;
}

/**
 * `n` with its noun in the right form for `locale`.
 *
 * French takes the singular at 0 as well as at 1 — a distinction this page cannot currently reach
 * (it counts things it is printing) but which costs one comparison to get right.
 */
export function counted(n: number, forms: CountForms, locale: Locale): string {
  if (locale === "pl") {
    const unit = n % 10;
    const pair = n % 100;
    if (n === 1) return `${n} ${forms.one}`;
    if (unit >= 2 && unit <= 4 && (pair < 12 || pair > 14)) return `${n} ${forms.few ?? forms.many}`;
    return `${n} ${forms.many}`;
  }
  const singular = locale === "fr" ? n < 2 : n === 1;
  return `${n} ${singular ? forms.one : forms.many}`;
}

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

export interface ObrazyChrome {
  /** The head's table of contents — the one steering device this page has above the fold. */
  readonly indexAria: string;
  /** The three nouns of the scale line, declined. The years' span beside them is a date. */
  readonly photographs: CountForms;
  readonly evenings: CountForms;
  readonly places: CountForms;
  /**
   * The frame count as the index and every evening head print it: spelled out at one, abbreviated
   * above it. The two surfaces share this on purpose — a reader meeting "9 fotografii" in the
   * index and "9 fot." three screens down would be reading two labels for one number.
   */
  readonly figure: CountForms;
}

export const OBRAZY_CHROME: Record<Locale, ObrazyChrome> = {
  pl: {
    indexAria: "Spis wieczorów",
    photographs: { one: "fotografia", few: "fotografie", many: "fotografii" },
    evenings: { one: "wieczór", few: "wieczory", many: "wieczorów" },
    places: { one: "miejsce", few: "miejsca", many: "miejsc" },
    figure: { one: "fotografia", many: "fot." },
  },
  en: {
    indexAria: "The evenings",
    photographs: { one: "photograph", many: "photographs" },
    evenings: { one: "evening", many: "evenings" },
    places: { one: "place", many: "places" },
    figure: { one: "photograph", many: "photos" },
  },
  fr: {
    indexAria: "Les soirées",
    photographs: { one: "photographie", many: "photographies" },
    evenings: { one: "soirée", many: "soirées" },
    places: { one: "lieu", many: "lieux" },
    figure: { one: "photographie", many: "photos" },
  },
};
