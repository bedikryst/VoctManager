/**
 * @file kolofon.ts
 * @description Everything about the colophon (/kolofon) except its words: the shape its Polish
 *  prose must have (zod, `.strict()`), the copy desk's key contract over that prose, and the page's
 *  chrome in all three locales.
 *
 *  A COLOPHON IS MOSTLY OTHER PEOPLE'S NAMES, which is what makes the accounting here unusual: the
 *  page prints four typefaces, six collaborators, six photographers, a board of three and a
 *  registry of numbers, and NONE of them is copy. What a language renders is the role beside a
 *  name, the material beside a label, and the four sentences the page is set by. Everything else is
 *  a name, a number, or Latin — `src/content/pages/kolofon.yaml` states the same division from the
 *  corpus's side, item by item.
 *
 *  WHY THE IMPRESSION LINE IS CHROME. "Złożono i odbito 4 września 2026" is a phrase that has to
 *  agree with a date computed at build, exactly as /obrazy's "48 fotografii" is a noun that has to
 *  agree with a computed number (§6x) — French demands the article before the date, Polish demands
 *  none, and nobody reviews that. A form the language requires is not a sentence waiting for
 *  review, so it takes `Record<Locale, …>` and the compiler asks for all three.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here (type-stripping, no build step), so that the key a translation is stored
 *  under and the key the page looks up are the same expression. Keep it free of `?raw`,
 *  `astro:assets` and anything else only a bundler can resolve.
 *
 *  Chrome carries no typography either — `lib/typo.ts` gives each locale its own at build.
 * @architecture Astro islands 2026
 * @module i18n/content/kolofon
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
const kolofonCopySchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    hero: z.object({ eyebrow: z.string(), title: z.string(), lede: z.string() }).strict(),
    sigillum: z.object({ eyebrow: z.string(), caption: z.string() }).strict(),
    regula: z
      .object({
        eyebrow: z.string(),
        lead: z.string(),
        items: z.array(z.object({ id: z.string(), text: z.string() }).strict()).min(1),
      })
      .strict(),
    constructio: z
      .object({
        eyebrow: z.string(),
        lead: z.string(),
        items: z
          .array(z.object({ id: z.string(), term: z.string(), value: z.string() }).strict())
          .min(1),
      })
      .strict(),
    typi: z
      .object({
        eyebrow: z.string(),
        items: z.array(z.object({ id: z.string(), meta: z.string() }).strict()).min(1),
        license: z.string(),
      })
      .strict(),
    imagines: z.object({ eyebrow: z.string(), lead: z.string() }).strict(),
    fundatio: z
      .object({
        eyebrow: z.string(),
        seatLabel: z.string(),
        boardLabel: z.string(),
        statuteLabel: z.string(),
        statuteLink: z.string(),
        policyLabel: z.string(),
      })
      .strict(),
    auctor: z.object({ eyebrow: z.string(), role: z.string() }).strict(),
    gratia: z
      .object({
        eyebrow: z.string(),
        lead: z.string(),
        items: z.array(z.object({ id: z.string(), role: z.string() }).strict()).min(1),
      })
      .strict(),
  })
  .strict();

export type KolofonCopy = z.infer<typeof kolofonCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/**
 * DECLARATION ORDER IS READING ORDER — the desk renders this page in the sequence a reader meets
 * it, hero to the closing thanks, because `order` is a counter over this list. Every rubric's
 * Latin tier is absent on purpose: it is the same word in every locale and never reaches the desk.
 */
const KOLOFON_CONTRACT: readonly CopyEntry[] = [
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
    note: "Five nouns naming the page's five subjects. It is a list, not a sentence — keep it one.",
  },

  // ── Wejście ───────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "hero.eyebrow",
    label: "Wejście · rubryka",
    note: "The vernacular of `Colophon`, which stands above it unchanged in every locale. It names what the page is a seal OF, and the word for the craft is the site's own: this is a printing house's vocabulary, not a software one.",
  },
  {
    kind: "field",
    path: "hero.title",
    label: "Wejście · tytuł",
    note: "One word and its full stop, set at up to 120px. `Colophon` is the word in all three languages; what changes is nothing, which is itself the answer.",
  },
  {
    kind: "field",
    path: "hero.lede",
    label: "Wejście · definicja",
    note: "A dictionary definition of the word above it, in the printer's register. It names three things a colophon records — place, time, who published — and the page's last two lines answer all three; do not anticipate them here.",
  },

  // ── Pieczęć ───────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "sigillum.eyebrow",
    label: "Pieczęć · rubryka",
    note: "The vernacular of `Sigillum`.",
  },
  {
    kind: "field",
    path: "sigillum.caption",
    label: "Pieczęć · podpis",
    note: "Three clauses under a seal drawn for this visit alone. Every one of them has to stay true of the mechanism: the same seal while the tab is open, a different one on the next visit, and nothing kept afterwards. Lower case throughout — it is a caption, not a sentence.",
  },

  // ── Reguła ────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "regula.eyebrow",
    label: "Reguła · rubryka",
    note: "The vernacular of `Regula`.",
  },
  { kind: "field", path: "regula.lead", label: "Reguła · wprowadzenie" },
  {
    kind: "list",
    path: "regula.items",
    keyBy: "id",
    label: "Reguła",
    fields: [
      {
        path: "text",
        label: "zdanie",
        note: "An inscription, not a sentence of prose: one clause, plain present tense, no subordinate clause and no gloss. The page demonstrates each of these rather than explaining it, so a translation that adds a word of explanation breaks the block's only rule.",
      },
    ],
  },

  // ── Konstrukcja ───────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "constructio.eyebrow",
    label: "Konstrukcja · rubryka",
    note: "The vernacular of `Constructio`.",
  },
  { kind: "field", path: "constructio.lead", label: "Konstrukcja · wprowadzenie" },
  {
    kind: "list",
    path: "constructio.items",
    keyBy: "id",
    label: "Konstrukcja",
    fields: [
      {
        path: "term",
        label: "termin",
        note: "The label in the margin. Product names (Astro, Lenis, Plausible, AVIF, WebP, AV1, Zod) are names and stay themselves in every locale.",
      },
      {
        path: "value",
        label: "opis",
        note: "The material beside the label, read as one line with it. The list carries exactly ONE negation (\"bez cookies\") on purpose — a second turns an inventory of what the page is made of into a list of what it refuses.",
      },
    ],
  },

  // ── Kroje pisma ───────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "typi.eyebrow",
    label: "Kroje pisma · rubryka",
    note: "The vernacular of `Typi`.",
  },
  {
    kind: "list",
    path: "typi.items",
    keyBy: "id",
    label: "Krój",
    fields: [
      {
        path: "meta",
        label: "nota",
        note: "Designer · classification · the job the face does here. The designers' names and the foundry stay themselves; the classification is typographic vocabulary and takes each language's own term (\"garaldowa antykwa\" is a garalde, \"kapitała inskrypcyjna\" an inscriptional capital).",
      },
    ],
  },
  {
    kind: "field",
    path: "typi.license",
    label: "Kroje pisma · licencja",
    note: "The licence's name is a proper name and stays English in every locale; `woff2` is a file format.",
  },

  // ── Fotografie ────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "imagines.eyebrow",
    label: "Fotografie · rubryka",
    note: "The vernacular of `Imagines`. /obrazy's colophon glosses the same Latin under `page.obrazy.colophon.eyebrow` — one rubric, one gloss, because both stand over one archive.",
  },
  {
    kind: "field",
    path: "imagines.lead",
    label: "Fotografie · wprowadzenie",
    note: "Qualifies the list of names under it, which would otherwise read as a claim over every photograph on the site. `lib/photoCredit` and /obrazy's colophon state the same fact — take the wording they already publish for the ensemble's own archive.",
  },

  // ── Fundacja ──────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "fundatio.eyebrow",
    label: "Fundacja · rubryka",
    note: "The vernacular of `Fundatio`.",
  },
  { kind: "field", path: "fundatio.seatLabel", label: "Fundacja · etykieta siedziby" },
  { kind: "field", path: "fundatio.boardLabel", label: "Fundacja · etykieta zarządu" },
  { kind: "field", path: "fundatio.statuteLabel", label: "Fundacja · etykieta statutu" },
  {
    kind: "field",
    path: "fundatio.statuteLink",
    label: "Fundacja · odnośnik do statutu",
    note: "The visible name of the founding document. The footer names the same file more briefly (`ui.ts` footer.statute) — the two may read differently, they may not name two documents. The `↗` and the note about the new window are the page's own and are not part of this string.",
  },
  { kind: "field", path: "fundatio.policyLabel", label: "Fundacja · etykieta polityki" },

  // ── Autor ─────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "auctor.eyebrow",
    label: "Autor · rubryka",
    note: "The vernacular of `Auctor`. This rubric signs the CRAFT where `Fundatio` signs the publisher, which is the distinction the whole block exists to draw.",
  },
  {
    kind: "field",
    path: "auctor.role",
    label: "Autor · rola",
    note: "Two words under a name set at up to 60px, in the credit register the concert pages use for `credits[].role`. No verb.",
  },

  // ── Podziękowania ─────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "gratia.eyebrow",
    label: "Podziękowania · rubryka",
    note: "The vernacular of `Gratiarum actio`.",
  },
  {
    kind: "field",
    path: "gratia.lead",
    label: "Podziękowania · wprowadzenie",
    note: "Polish names both genders of the makers explicitly (\"twórczynie i twórcy\"), which English and French say in one word — render the inclusiveness the way the language does it, do not double the noun to match the Polish shape.",
  },
  {
    kind: "list",
    path: "gratia.items",
    keyBy: "id",
    label: "Podziękowanie",
    fields: [
      {
        path: "role",
        label: "rola i okazja",
        note: "A function, then the evening it was performed for. The site already publishes both halves: the roles as `concert.*.credits[].role` and `concert.*.realizacja` (lighting design, organ, violin, the recording studio), the evenings as `concert.*.title`. Take those renderings — a collaborator credited here under a name this site gives a different evening reads as a second concert.",
      },
    ],
  },
];

/** Everything else in `kolofon.yaml`, with the reason it is not text a reader is meant to read. */
const KOLOFON_NOT_COPY: Readonly<Record<string, string>> = {
  "regula.items[].id": "identity — it is this line's key part",
  "constructio.items[].id": "identity — it is this row's key part",
  "typi.items[].id": "identity — the key part, and the face's own CSS modifier",
  "gratia.items[].id": "identity — it is this credit's key part",
};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const KOLOFON_PAGE: PageCopySpec<KolofonCopy> = {
  id: "kolofon",
  label: "Kolofon",
  schema: kolofonCopySchema,
  contract: KOLOFON_CONTRACT,
  notCopy: KOLOFON_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

export interface KolofonChrome {
  /** Accessible name of the drawn seal, which is an image with no alt text of its own. */
  readonly sigilAria: string;
  /**
   * The impression line, up to but not including the date: "Złożono i odbito" + " 4 września 2026".
   * A prefix rather than a template because the date is formatted by `lib/dates` and the only
   * thing a language adds around it is its own grammar — French an article, Polish and English
   * none.
   */
  readonly impressio: string;
  /**
   * What labels an OUTLET in the `Imagines` list, where every other row opens on a person. It is
   * the same word `lib/photoCredit` uses for a frame's own source line, punctuated for a different
   * position — that one opens a clause and takes a colon, this one is a tag in a role column.
   */
  readonly sourceRole: string;
  /** The verb phrase on a photographer's name, which is a button opening her frames. The count
      stands in the role line beside it, so it is deliberately not repeated here. */
  readonly openFrame: string;
  readonly openFrames: string;
  /**
   * Said in words because the `↗` beside it is decorative and hidden from assistive tech. The
   * footer states the same fact inside its own complete `aria-label` (`ui.ts` footer.statuteAria)
   * and says "tab" where this says "window"; the divergence is the corpus's, not this file's.
   */
  readonly newWindow: string;
}

/**
 * The page's own name is NOT here: `UI[lang].footer.colophon` is what the footer's Index column
 * calls this page, and a reader must land on the page they pressed. The h1 carries the copy desk's
 * `hero.title` with its full stop, which is the one place the two differ.
 */
export const KOLOFON_CHROME: Record<Locale, KolofonChrome> = {
  pl: {
    sigilAria: "Pieczęć Twojej wizyty",
    impressio: "Złożono i odbito",
    sourceRole: "źródło",
    openFrame: "otwórz fotografię",
    openFrames: "otwórz fotografie",
    newWindow: ", otwiera się w nowym oknie",
  },
  en: {
    sigilAria: "The seal of your visit",
    impressio: "Set and struck",
    sourceRole: "source",
    openFrame: "open the photograph",
    openFrames: "open the photographs",
    newWindow: ", opens in a new window",
  },
  fr: {
    sigilAria: "Le sceau de votre visite",
    impressio: "Composé et imprimé le",
    sourceRole: "source",
    openFrame: "ouvrir la photographie",
    openFrames: "ouvrir les photographies",
    newWindow: ", s'ouvre dans une nouvelle fenêtre",
  },
};
