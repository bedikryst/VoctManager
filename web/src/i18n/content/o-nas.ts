/**
 * @file o-nas.ts
 * @description Everything about /o-nas except its words: the shape its Polish prose must have
 *  (zod, `.strict()`), the copy desk's key contract over that prose, and the page's chrome in all
 *  three locales.
 *
 *  THIS FILE USED TO BE THE MODEL AND WAS THE LAST PAGE TO FOLLOW IT. It held three locales of
 *  prose in TypeScript literals from before the desk existed, which made /o-nas the one page whose
 *  translations no editor could reach: `copy:apply` splices a YAML scalar and rewrites an overlay,
 *  and it can write a `.ts` file by no means at all. The prose now lives in
 *  `src/content/pages/o-nas.yaml` with its translations in `src/content/pages.{en,fr}.yaml`,
 *  falling back per field.
 *
 *  THE LINE IS NOT "PROSE VS LABEL" but whether COMPLETENESS CAN BE DEMANDED. An aria-label has to
 *  exist in every locale or the page is broken for somebody, and `Record<Locale, …>` makes the
 *  compiler say so — so the ten landmark names live here and adding a section without naming it
 *  cannot build. A paragraph is the opposite: it arrives one field at a time through review, and
 *  the English page has to stand with English chrome around Polish prose for as long as that
 *  takes. Reasoning in docs/web-copy-desk-2026-09.md §6r.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here (type-stripping, no build step), so that the key a translation is stored
 *  under and the key the page looks up are the same expression. Keep it free of `?raw`,
 *  `astro:assets` and anything else only a bundler can resolve.
 *
 *  Chrome carries no typography either — `lib/typo.ts` gives each locale its own at build.
 * @architecture Astro islands 2026
 * @module i18n/content/o-nas
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
const aboutCopySchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    hero: z
      .object({
        eyebrow: z.string(),
        title1: z.string(),
        title2Html: z.string(),
        lede: z.string(),
        scrollCue: z.string(),
      })
      .strict(),
    letter: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        leadHtml: z.string(),
        stanzas: z
          .array(z.object({ num: z.string(), label: z.string(), paraHtml: z.string() }).strict())
          .min(1),
        signatureMeta: z.string(),
        portraitAlt: z.string(),
        portraitCaption: z.string(),
      })
      .strict(),
    ensemble: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        lead: z.string(),
        p2: z.string(),
        p3Html: z.string(),
        collabLabel: z.string(),
        collabText: z.string(),
      })
      .strict(),
    plate: z.object({ quote: z.string() }).strict(),
    doings: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        lead: z.string(),
        cards: z
          .array(
            z
              .object({
                id: z.string(),
                title: z.string(),
                body: z.string(),
                cta: z.string().optional(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
    cantus: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        lead: z.string(),
        p2: z.string(),
        p3: z.string(),
        moreLink: z.string(),
      })
      .strict(),
    milestones: z
      .object({ eyebrow: z.string(), h2: z.string(), cardLink: z.string(), moreLink: z.string() })
      .strict(),
    foundation: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        lead: z.string(),
        p2Html: z.string(),
        goals: z.array(z.object({ id: z.string(), text: z.string() }).strict()).min(1),
        legalNote: z.string(),
        statuteLabel: z.string(),
      })
      .strict(),
    governance: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        intro: z.string(),
        roles: z.array(z.object({ id: z.string(), role: z.string() }).strict()).min(1),
      })
      .strict(),
    cta: z
      .object({
        h2: z.string(),
        lede: z.string(),
        write: z.string(),
        concerts: z.string(),
        support: z.string(),
      })
      .strict(),
  })
  .strict();

export type AboutCopy = z.infer<typeof aboutCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/**
 * DECLARATION ORDER IS READING ORDER — the desk renders this page in the sequence a reader meets
 * it, hero to coda, because `order` is a counter over this list. Re-ordering it re-orders the desk
 * and never changes a key.
 */
const ABOUT_CONTRACT: readonly CopyEntry[] = [
  // ── Metadane ──────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "meta.title",
    label: "Metadane · tytuł strony",
    note: "Read in a search result and a browser tab, not on the page. Keep the ensemble and the foundation in it.",
  },
  { kind: "field", path: "meta.description", label: "Metadane · opis strony" },

  // ── Hero ──────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "hero.eyebrow",
    label: "Hero · rubryka",
    note: "The vernacular of `De nobis`, which stands above it unchanged in every locale.",
  },
  {
    kind: "field",
    path: "hero.title1",
    label: "Hero · tytuł, wers 1",
    note: "The title is set as two lines and the break is compositional: split the sentence where the target language wants it, not where Polish did.",
  },
  {
    kind: "field",
    path: "hero.title2Html",
    label: "Hero · tytuł, wers 2",
    note: "The emphasised word takes the candle gold; it is the page's own subject, so the emphasis moves with the sense rather than staying on the last word.",
  },
  { kind: "field", path: "hero.lede", label: "Hero · lede" },
  { kind: "field", path: "hero.scrollCue", label: "Hero · zachęta" },

  // ── List założyciela ──────────────────────────────────────────────────────────────────────
  { kind: "field", path: "letter.eyebrow", label: "List · rubryka", note: "The vernacular of `Initium`." },
  { kind: "field", path: "letter.h2", label: "List · nagłówek" },
  {
    kind: "field",
    path: "letter.leadHtml",
    label: "List · zapowiedź",
    note: "Names the writer and stops. The four stanza rubrics under it are the letter's own contents page, so a lead that summarises them prints it twice.",
  },
  {
    kind: "list",
    path: "letter.stanzas",
    keyBy: "num",
    label: "Strofa",
    note: "VERBATIM FOUNDING TEXT — the Polish is quoted from Florent's own writing, not written for the site. It is here so a translation can be reviewed against it, never so the Polish can be rewritten. A rendering keeps the meditative register and follows the sentence.",
    fields: [
      { path: "label", label: "rubryka" },
      { path: "paraHtml", label: "strofa" },
    ],
  },
  {
    kind: "field",
    path: "letter.signatureMeta",
    label: "List · podpis",
    note: "Under the signature, which is the name itself and is structural. The year is when the letter was written — a fixed fact with no structured date behind it, so it stays inside the string.",
  },
  {
    kind: "field",
    path: "letter.portraitAlt",
    label: "List · opis portretu",
    note: "Alt text, read aloud rather than seen. Translate it: leaving it Polish on the English page is an accessibility regression, not a cosmetic one.",
  },
  { kind: "field", path: "letter.portraitCaption", label: "List · podpis portretu" },

  // ── Zespół ────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "ensemble.eyebrow", label: "Zespół · rubryka", note: "The vernacular of `Voces`." },
  { kind: "field", path: "ensemble.h2", label: "Zespół · nagłówek" },
  { kind: "field", path: "ensemble.lead", label: "Zespół · lead" },
  { kind: "field", path: "ensemble.p2", label: "Zespół · akapit 2" },
  {
    kind: "field",
    path: "ensemble.p3Html",
    label: "Zespół · akapit 3",
    note: "`voces`, `octo` and `ensemble` are the name's own etymology and stay themselves in every locale; only the glosses in brackets after them are translated.",
  },
  { kind: "field", path: "ensemble.collabLabel", label: "Zespół · etykieta współpracy" },
  {
    kind: "field",
    path: "ensemble.collabText",
    label: "Zespół · współpraca",
    note: "Every person and institution here is a proper name and stays itself. The ROLES beside them are what a language renders, and /kolofon publishes the same ones in its credits — keep the two saying one thing.",
  },

  // ── Tablica ───────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "plate.quote",
    label: "Tablica · cytat",
    note: "Set alone over a photograph at up to 64px, four words in Polish. A rendering that needs a subordinate clause is not this line.",
  },

  // ── Co robimy ─────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "doings.eyebrow", label: "Co robimy · rubryka", note: "The vernacular of `Operatio`." },
  { kind: "field", path: "doings.h2", label: "Co robimy · nagłówek" },
  {
    kind: "field",
    path: "doings.lead",
    label: "Co robimy · lead",
    note: "`Concerts Spirituels` is the French name of the historical form and stays itself. /koncerty italicises it and marks it `lang=\"fr\"`; this field is plain text and cannot, so it simply stands unmarked.",
  },
  {
    kind: "list",
    path: "doings.cards",
    keyBy: "id",
    label: "Karta",
    note: "Each card names a category and then one real occasion. The example is what keeps the block from reading as a services list — keep the named event, and name it as the rest of the site names it.",
    fields: [
      { path: "title", label: "nagłówek" },
      { path: "body", label: "opis" },
      { path: "cta", label: "odnośnik", note: "Keep the trailing arrow." },
    ],
  },

  // ── Co śpiewamy ───────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "cantus.eyebrow", label: "Co śpiewamy · rubryka", note: "The vernacular of `Cantus`." },
  { kind: "field", path: "cantus.h2", label: "Co śpiewamy · nagłówek" },
  { kind: "field", path: "cantus.lead", label: "Co śpiewamy · lead" },
  { kind: "field", path: "cantus.p2", label: "Co śpiewamy · akapit 2" },
  { kind: "field", path: "cantus.p3", label: "Co śpiewamy · akapit 3" },
  {
    kind: "field",
    path: "cantus.moreLink",
    label: "Co śpiewamy · odnośnik",
    note: "Seven centuries is the repertoire catalogue's span, and /koncerty prints the same count as its own rubric — one span, one number, both pages. Keep the trailing arrow.",
  },

  // ── Co już wybrzmiało ─────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "milestones.eyebrow",
    label: "Droga · rubryka",
    note: "The vernacular of `Via`. The rows under it are the concerts' own words and are on the desk under their own scopes.",
  },
  { kind: "field", path: "milestones.h2", label: "Droga · nagłówek" },
  {
    kind: "field",
    path: "milestones.cardLink",
    label: "Droga · odnośnik wiersza",
    note: "One control per row, five rows: it names the destination and the component appends the concert's own title visually hidden. Keep the trailing arrow.",
  },
  { kind: "field", path: "milestones.moreLink", label: "Droga · odnośnik", note: "Keep the trailing arrow." },

  // ── Fundacja ──────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "foundation.eyebrow",
    label: "Fundacja · rubryka",
    note: "The vernacular of `Fundatio` — the same rubric /kontakt and /kolofon carry, so one gloss serves all three and none of them may invent a second.",
  },
  { kind: "field", path: "foundation.h2", label: "Fundacja · nagłówek" },
  {
    kind: "field",
    path: "foundation.lead",
    label: "Fundacja · czym jest",
    note: "THE FULL ACCOUNT. /kontakt carries a two-sentence summary of the same fact (`page.kontakt.locus.mission`) — different registers for different surfaces, like `about.blurb` beside `essence`. They may read differently; they may never say different things.",
  },
  {
    kind: "field",
    path: "foundation.p2Html",
    label: "Fundacja · zakres statutowy",
    note: "The emphasised span is the statute's own field of activity, quoted from the founding document. Render it in the terms the jurisdiction uses, not word for word.",
  },
  {
    kind: "list",
    path: "foundation.goals",
    keyBy: "id",
    label: "Cel statutowy",
    note: "Category, colon, then what the Foundation may do inside it — a shape the statute itself uses and a rendering should keep. The component numbers them.",
    fields: [{ path: "text", label: "treść" }],
  },
  {
    kind: "field",
    path: "foundation.legalNote",
    label: "Fundacja · nota prawna",
    note: "The non-distribution clause, in the statute's own terms. /kontakt states the same fact in one clause; this is the full form.",
  },
  {
    kind: "field",
    path: "foundation.statuteLabel",
    label: "Fundacja · statut",
    note: "Names the same PDF the footer and /kolofon name; the three may read differently, they may not name two documents. The trailing arrow is part of the label.",
  },

  // ── Zarząd ────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "governance.eyebrow",
    label: "Zarząd · rubryka",
    note: "The vernacular of `Consilium`. The site already publishes this word — /kontakt's signature note and /kolofon's registry margin both name the board.",
  },
  { kind: "field", path: "governance.h2", label: "Zarząd · nagłówek" },
  { kind: "field", path: "governance.intro", label: "Zarząd · wprowadzenie" },
  {
    kind: "list",
    path: "governance.roles",
    keyBy: "id",
    label: "Rola",
    note: "A DOMAIN, NOT A JOB DESCRIPTION: a three-person board reads as an improvised org chart the moment its cards start listing duties. Two words each, and the middot is the site's own separator rather than punctuation to translate.",
    fields: [{ path: "role", label: "rola" }],
  },

  // ── Zaproszenie ───────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "cta.h2", label: "Zaproszenie · nagłówek" },
  { kind: "field", path: "cta.lede", label: "Zaproszenie · zdanie" },
  {
    kind: "field",
    path: "cta.write",
    label: "Zaproszenie · przycisk kontaktu",
    note: "Three buttons, and the chrome names two of the same destinations more briefly (`ui.ts` nav). Keep the register; do not copy the shorter labels.",
  },
  { kind: "field", path: "cta.concerts", label: "Zaproszenie · przycisk koncertów" },
  { kind: "field", path: "cta.support", label: "Zaproszenie · przycisk wsparcia" },
];

/** Everything else in `o-nas.yaml`, with the reason it is not text a reader is meant to read. */
const ABOUT_NOT_COPY: Readonly<Record<string, string>> = {
  "letter.stanzas[].num": "a Roman numeral — the stanza's number, the same in every language, and its key part",
  "doings.cards[].id": "identity — it is this card's key part",
  "foundation.goals[].id": "identity — it is this goal's key part",
  "governance.roles[].id":
    "identity — it is this role's key part, and the component pairs the portrait to it",
};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const ABOUT_PAGE: PageCopySpec<AboutCopy> = {
  id: "o-nas",
  label: "O nas",
  schema: aboutCopySchema,
  contract: ABOUT_CONTRACT,
  notCopy: ABOUT_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

export interface AboutChrome {
  /** Landmark names for the ten sections. They are read instead of the heading, so they name the
      section rather than repeat its first line. */
  readonly heroAria: string;
  readonly letterAria: string;
  readonly ensembleAria: string;
  readonly plateAria: string;
  readonly doingsAria: string;
  readonly cantusAria: string;
  readonly milestonesAria: string;
  readonly foundationAria: string;
  readonly governanceAria: string;
  readonly ctaAria: string;
  /** The statutory-purposes list, which sits INSIDE the foundation section and needs a name of its
      own: sharing the section's would give a screen reader two things called the same thing on one
      screen, with no way to tell which one was just entered. */
  readonly goalsAria: string;
}

export const ABOUT_CHROME: Record<Locale, AboutChrome> = {
  pl: {
    heroAria: "O nas",
    letterAria: "List Florenta",
    ensembleAria: "Kim jesteśmy",
    plateAria: "Idea",
    doingsAria: "Co robimy",
    cantusAria: "Co śpiewamy",
    milestonesAria: "Droga koncertów",
    foundationAria: "Fundacja VoctFoundation",
    governanceAria: "Zarząd fundacji",
    ctaAria: "Zaproszenie do kontaktu",
    goalsAria: "Cele statutowe",
  },
  en: {
    heroAria: "About us",
    letterAria: "Florent's letter",
    ensembleAria: "Who we are",
    plateAria: "Idea",
    doingsAria: "What we do",
    cantusAria: "What we sing",
    milestonesAria: "The path of the concerts",
    foundationAria: "The VoctFoundation",
    governanceAria: "The foundation's board",
    ctaAria: "An invitation to get in touch",
    goalsAria: "Statutory purposes",
  },
  fr: {
    heroAria: "À propos",
    letterAria: "La lettre de Florent",
    ensembleAria: "Qui nous sommes",
    plateAria: "Idée",
    doingsAria: "Ce que nous faisons",
    cantusAria: "Ce que nous chantons",
    milestonesAria: "Le chemin des concerts",
    foundationAria: "La Fondation VoctFoundation",
    governanceAria: "Le conseil de la fondation",
    ctaAria: "Une invitation à nous contacter",
    goalsAria: "Buts statutaires",
  },
};
