/**
 * @file koncerty.ts
 * @description Everything about the /koncerty index except its words: the shape its Polish prose
 *  must have (zod, `.strict()`), the copy desk's key contract over that prose, and the page's
 *  chrome in all three locales.
 *
 *  THE PAGE TALKS; THE CONCERTS TALK; THE CATALOGUE DOES NOT. Three sources meet on this route and
 *  the distinction is the whole reason it is legible. What the PAGE says — the hero, the four
 *  rules, the two section heads, the unwritten station, the closing invitation — is prose in
 *  `src/content/pages/koncerty.yaml`, on the desk, translated per field. What a CONCERT says is
 *  `concerts.yaml` read through the desk's overlay by concert key, exactly as /koncerty/[id] reads
 *  it. Era names are labels and live in `i18n/content/repertuar.ts`, because the landing prints
 *  them too. Chrome — landmarks, affordances, the numeral's prefix — is below.
 *
 *  WHY THE PROSE IS NOT HERE. The line is not "prose vs label" but whether COMPLETENESS CAN BE
 *  DEMANDED. An aria-label must exist in every locale or the page is broken for somebody, and
 *  `Record<Locale, …>` makes the compiler say so. A paragraph arrives one field at a time through
 *  review, and the English page has to stand with English chrome around Polish prose for as long
 *  as that takes. Reasoning in docs/web-copy-desk-2026-09.md §6r.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here (type-stripping, no build step), so that the key a translation is stored
 *  under and the key the page looks up are the same expression. Keep it free of `?raw`,
 *  `astro:assets` and anything else only a bundler can resolve.
 *
 *  Chrome carries no typography either — `lib/typo.ts` gives each locale its own at build.
 * @architecture Astro islands 2026
 * @module i18n/content/koncerty
 */

import { z } from "astro/zod";

import type { Locale } from "../config";
import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The prose, as a shape ─────────────────────────────────────────────────────────────────────

/**
 * `.strict()` throughout, and it is doing real work rather than tidiness: a hand-added `en:` beside
 * a Polish value would otherwise be dropped in silence by zod's default, and the translation would
 * simply never appear on the page. Translations belong in the overlay, and this is what says so.
 */
const koncertyCopySchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    intro: z
      .object({
        eyebrow: z.string(),
        title1: z.string(),
        title2Html: z.string(),
        lede: z.string(),
        noteHtml: z.string(),
        scrollCue: z.string(),
      })
      .strict(),
    next: z
      .object({ title: z.string(), meta: z.string(), essence: z.string(), cta: z.string() })
      .strict(),
    rites: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        ledeHtml: z.string(),
        items: z
          .array(z.object({ id: z.string(), title: z.string(), text: z.string() }).strict())
          .min(1),
      })
      .strict(),
    repertoire: z.object({ eyebrow: z.string(), h2: z.string(), lede: z.string() }).strict(),
    coda: z
      .object({
        h2: z.string(),
        lede: z.string(),
        contactLink: z.string(),
        aboutLink: z.string(),
        supportLink: z.string(),
      })
      .strict(),
  })
  .strict();

export type KoncertyCopy = z.infer<typeof koncertyCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/**
 * DECLARATION ORDER IS READING ORDER — the desk renders this page in the sequence a reader meets
 * it, hero to coda, because `order` is a counter over this list. Re-ordering it re-orders the desk
 * and never changes a key. The stations sit between the hero and the unwritten one on the page and
 * are absent here on purpose: they are the concerts' own words, on the desk under their own scope.
 */
const KONCERTY_CONTRACT: readonly CopyEntry[] = [
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
    note: "Deliberately count-free — a number here becomes a lie the day a seventh concert lands. It names two concerts: use the titles this site already publishes for them.",
  },

  // ── Wejście ───────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "intro.eyebrow",
    label: "Wejście · rubryka",
    note: "The vernacular of `Via`, which stands above it unchanged in every locale.",
  },
  {
    kind: "field",
    path: "intro.title1",
    label: "Wejście · tytuł, wers 1",
    note: "The title is set as two lines and the break is compositional: split the phrase where the target language wants it, not where Polish did. The second line carries the emphasis.",
  },
  { kind: "field", path: "intro.title2Html", label: "Wejście · tytuł, wers 2" },
  { kind: "field", path: "intro.lede", label: "Wejście · lede" },
  {
    kind: "field",
    path: "intro.noteHtml",
    label: "Wejście · nota",
    note: "`Concerts Spirituels` is a proper name and stays French in every locale — including French, where the `lang` attribute becomes redundant but harmless.",
  },
  { kind: "field", path: "intro.scrollCue", label: "Wejście · zachęta" },

  // ── Koncert bez daty ──────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "next.title",
    label: "Koncert bez daty · tytuł",
    note: "Stands where a concert's own title stands, under the Latin `Nondum`. It promises nothing: there is no such evening yet.",
  },
  { kind: "field", path: "next.meta", label: "Koncert bez daty · dateline" },
  { kind: "field", path: "next.essence", label: "Koncert bez daty · esencja" },
  {
    kind: "field",
    path: "next.cta",
    label: "Koncert bez daty · przycisk",
    note: "Keep the trailing arrow — the site draws it no other way.",
  },

  // ── Reguły wieczoru ───────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "rites.eyebrow",
    label: "Reguły · rubryka",
    note: "The vernacular of `Concert spirituel`, the French rubric standing above it.",
  },
  { kind: "field", path: "rites.h2", label: "Reguły · nagłówek" },
  { kind: "field", path: "rites.ledeHtml", label: "Reguły · wprowadzenie" },
  {
    kind: "list",
    path: "rites.items",
    keyBy: "id",
    label: "Reguła",
    fields: [
      { path: "title", label: "nazwa" },
      {
        path: "text",
        label: "opis",
        note: "Names real people. `o.` is the Jesuit honorific — `Fr` in English, `P.` in French — and the names themselves never change.",
      },
    ],
  },

  // ── Repertuar ─────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "repertoire.eyebrow",
    label: "Repertuar · rubryka",
    note: "The vernacular of `Repertorium`. Seven is the count of the catalogue's era spans — do not round it.",
  },
  { kind: "field", path: "repertoire.h2", label: "Repertuar · nagłówek" },
  { kind: "field", path: "repertoire.lede", label: "Repertuar · wprowadzenie" },

  // ── Koda ──────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "coda.h2", label: "Koda · nagłówek" },
  {
    kind: "field",
    path: "coda.lede",
    label: "Koda · zdanie",
    note: "Names seven buildings, most of which this site already renders in English and French elsewhere (the concert pages, /o-nas, /kontakt). Follow those renderings; a second name for one church reads as an error to the reader who follows the link.",
  },
  { kind: "field", path: "coda.contactLink", label: "Koda · przycisk kontaktu" },
  { kind: "field", path: "coda.aboutLink", label: "Koda · przycisk o zespole" },
  { kind: "field", path: "coda.supportLink", label: "Koda · przycisk wsparcia" },
];

/** Everything else in `koncerty.yaml`, with the reason it is not text a reader is meant to read. */
const KONCERTY_NOT_COPY: Readonly<Record<string, string>> = {
  "rites.items[].id": "identity — it is this rule's key part",
};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const KONCERTY_PAGE: PageCopySpec<KoncertyCopy> = {
  id: "koncerty",
  label: "Koncerty",
  schema: koncertyCopySchema,
  contract: KONCERTY_CONTRACT,
  notCopy: KONCERTY_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

export interface KoncertyChrome {
  /** Landmark names for the page's five bands. They are read instead of the heading, so they name
      the band rather than repeat its first line. The stations name themselves — each takes its
      own concert's title. */
  readonly introAria: string;
  readonly nextAria: string;
  readonly ritesAria: string;
  readonly repertoireAria: string;
  readonly codaAria: string;
  /** Accessible names for the two chip rows — a concert's programme facts, a liturgy's. */
  readonly factsAria: string;
  readonly liturgyFactsAria: string;
  /** The programme disclosure. Six of them stand on one page, so the concert's own title is
      appended visually hidden — a label would REPLACE the visible text and voice control matches
      on what is on screen. */
  readonly programSummary: string;
  /** Affordances on a station: its own page, and the recording. The play glyph is drawn by the
      markup, so it is not part of the label. */
  readonly openConcert: string;
  readonly spotify: string;
}

/**
 * The cycle's own name is NOT here. "Koncerty Duchowe" is "Spiritual Concerts" and "Concerts
 * Spirituels" wherever this site prints it (`koncert.ts`, `o-nas.ts`, the concert overlays), and
 * the word for one station — "Obraz" / "Image" — is `CONCERT[lang].hero.station`. Both are read
 * from there rather than restated here, so the index and the concert pages cannot drift into two
 * names for one thing.
 */
export const KONCERTY_CHROME: Record<Locale, KoncertyChrome> = {
  pl: {
    introAria: "Koncerty Duchowe",
    nextAria: "Następny Koncert Duchowy",
    ritesAria: "Reguły wieczoru",
    repertoireAria: "Repertuar VoctEnsemble",
    codaAria: "Zaproszenie",
    factsAria: "Cechy programu",
    liturgyFactsAria: "Cechy liturgii",
    programSummary: "Program koncertu",
    openConcert: "Otwórz stronę koncertu →",
    spotify: "Posłuchaj programu",
  },
  en: {
    introAria: "The Spiritual Concerts",
    nextAria: "The next Spiritual Concert",
    ritesAria: "The rules of the evening",
    repertoireAria: "VoctEnsemble's repertoire",
    codaAria: "An invitation",
    factsAria: "Programme details",
    liturgyFactsAria: "Liturgy details",
    programSummary: "The concert programme",
    openConcert: "Open the concert page →",
    spotify: "Listen to the programme",
  },
  fr: {
    introAria: "Les Concerts Spirituels",
    nextAria: "Le prochain Concert Spirituel",
    ritesAria: "Les règles de la soirée",
    repertoireAria: "Le répertoire de VoctEnsemble",
    codaAria: "Une invitation",
    factsAria: "Détails du programme",
    liturgyFactsAria: "Détails de la liturgie",
    programSummary: "Le programme du concert",
    openConcert: "Ouvrir la page du concert →",
    spotify: "Écouter le programme",
  },
};
