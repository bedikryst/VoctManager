/**
 * @file kontakt.ts
 * @description Everything about /kontakt except its words: the shape its Polish prose must have
 *  (zod, `.strict()`), the copy desk's key contract over that prose, and the page's chrome in all
 *  three locales.
 *
 *  WHY THE PROSE IS NOT HERE, when `o-nas.ts` still holds three locales of it. The line is not
 *  "prose vs label" but whether COMPLETENESS CAN BE DEMANDED. An aria-label has to exist in every
 *  locale or the page is broken for somebody, and `Record<Locale, …>` makes the compiler say so —
 *  so chrome lives here, and adding a section without translating its landmark cannot build. A
 *  paragraph is the opposite: it arrives one field at a time through review, and the English page
 *  has to stand with English chrome around Polish prose for as long as that takes. So the prose
 *  lives in `src/content/pages/kontakt.yaml` (Polish, the desk's source) with its translations in
 *  `src/content/pages.{en,fr}.yaml`, falling back per field — and `copy:apply` writes both with
 *  the tools it already has. It is the same line `koncert.ts` draws between the page talking and
 *  the concert talking. Reasoning in docs/web-copy-desk-2026-09.md §6r.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here (type-stripping, no build step), so that the key a translation is stored
 *  under and the key the page looks up are the same expression. Keep it free of `?raw`,
 *  `astro:assets` and anything else only a bundler can resolve.
 *
 *  Chrome carries no typography either — `lib/typo.ts` gives each locale its own at build.
 * @architecture Astro islands 2026
 * @module i18n/content/kontakt
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
const contactCopySchema = z
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
    channels: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        introHtml: z.string(),
        items: z
          .array(
            z
              .object({
                id: z.string(),
                email: z.string().email(),
                role: z.string(),
                subject: z.string(),
                hint: z.string(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
    after: z.object({ languages: z.string(), pressHtml: z.string() }).strict(),
    voices: z
      .object({ label: z.string(), names: z.array(z.string()).min(1), note: z.string() })
      .strict(),
    locus: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        foundationLabel: z.string(),
        mission: z.string(),
        foundationLink: z.string(),
        addressLabel: z.string(),
        addressNote: z.string(),
      })
      .strict(),
    legal: z.object({ controllerLabel: z.string(), rodoHtml: z.string() }).strict(),
    coda: z
      .object({
        h2: z.string(),
        lede: z.string(),
        concertsLink: z.string(),
        supportLink: z.string(),
      })
      .strict(),
  })
  .strict();

export type ContactCopy = z.infer<typeof contactCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/**
 * DECLARATION ORDER IS READING ORDER — the desk renders this page in the sequence a reader meets
 * it, hero to coda, because `order` is a counter over this list. Re-ordering it re-orders the desk
 * and never changes a key.
 */
const CONTACT_CONTRACT: readonly CopyEntry[] = [
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
    note: "The vernacular of `Scribe nobis`, which stands above it unchanged in every locale.",
  },
  {
    kind: "field",
    path: "hero.title1",
    label: "Hero · tytuł, wers 1",
    note: "The title is set as two lines and the break is compositional: split the sentence where the target language wants it, not where Polish did.",
  },
  { kind: "field", path: "hero.title2Html", label: "Hero · tytuł, wers 2" },
  { kind: "field", path: "hero.lede", label: "Hero · lede" },
  { kind: "field", path: "hero.scrollCue", label: "Hero · zachęta" },

  // ── Kanały ────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "channels.eyebrow", label: "Kanały · rubryka", note: "The vernacular of `Tres ianuae`." },
  { kind: "field", path: "channels.h2", label: "Kanały · nagłówek" },
  { kind: "field", path: "channels.introHtml", label: "Kanały · wprowadzenie" },
  {
    kind: "list",
    path: "channels.items",
    keyBy: "id",
    label: "Kanał",
    fields: [
      { path: "role", label: "rola" },
      {
        path: "subject",
        label: "temat wiadomości",
        note: "Prefilled into the reader's mail client, so it arrives in the language they wrote in. Only the ensemble's name stays.",
      },
      { path: "hint", label: "podpowiedź" },
    ],
  },

  // ── Po kanałach ───────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "after.languages", label: "Po kanałach · języki" },
  {
    kind: "field",
    path: "after.pressHtml",
    label: "Po kanałach · materiały prasowe",
    note: "The trailing arrow is part of the markup — keep it; the site draws it no other way. The link's own path is localized at render.",
  },

  // ── Podpis ────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "voices.label", label: "Podpis · etykieta" },
  { kind: "field", path: "voices.note", label: "Podpis · nota" },

  // ── Fundacja ──────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "locus.eyebrow", label: "Fundacja · rubryka", note: "The vernacular of `Fundatio`." },
  { kind: "field", path: "locus.h2", label: "Fundacja · nagłówek" },
  { kind: "field", path: "locus.foundationLabel", label: "Fundacja · etykieta kolumny" },
  { kind: "field", path: "locus.mission", label: "Fundacja · czym jest" },
  { kind: "field", path: "locus.foundationLink", label: "Fundacja · odnośnik", note: "Keep the trailing arrow." },
  { kind: "field", path: "locus.addressLabel", label: "Adres · etykieta kolumny" },
  { kind: "field", path: "locus.addressNote", label: "Adres · nota" },

  // ── Nota prawna ───────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "legal.controllerLabel", label: "RODO · etykieta administratora" },
  {
    kind: "field",
    path: "legal.rodoHtml",
    label: "RODO · nota",
    note: "The citation is locale-dependent: art. 6 ust. 1 lit. f RODO is Art. 6(1)(f) GDPR and art. 6, § 1, f) RGPD. Translate it; never transliterate.",
  },

  // ── Koda ──────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "coda.h2", label: "Koda · nagłówek" },
  { kind: "field", path: "coda.lede", label: "Koda · zdanie" },
  { kind: "field", path: "coda.concertsLink", label: "Koda · odnośnik do koncertów", note: "Keep the trailing arrow." },
  { kind: "field", path: "coda.supportLink", label: "Koda · odnośnik do wsparcia", note: "Keep the trailing arrow." },
];

/** Everything else in `kontakt.yaml`, with the reason it is not text a reader is meant to read. */
const CONTACT_NOT_COPY: Readonly<Record<string, string>> = {
  "channels.items[].id": "identity — it is this channel's key part",
  "channels.items[].email": "an address, printed unchanged in every locale",
  "voices.names[]": "the board's names — a person's name is never translated",
};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const KONTAKT_PAGE: PageCopySpec<ContactCopy> = {
  id: "kontakt",
  label: "Kontakt",
  schema: contactCopySchema,
  contract: CONTACT_CONTRACT,
  notCopy: CONTACT_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

export interface ContactChrome {
  /** Landmark names for the four sections. They are read instead of the heading, so they name the
      section rather than repeat its first line. */
  readonly heroAria: string;
  readonly channelsAria: string;
  readonly locusAria: string;
  readonly codaAria: string;
  /** The copy-to-clipboard affordance: its resting label, and the one it flashes after a copy.
      A bare `mailto:` is a real desktop failure with no mail client configured — this is the
      escape hatch, so both states have to be readable in the reader's own language. */
  readonly copy: string;
  readonly copied: string;
  /** Accessible name of that button. `{email}` is replaced with the address — the only slot, and
      it takes no grammatical case in any of the three languages. */
  readonly copyAria: string;
}

export const CONTACT_CHROME: Record<Locale, ContactChrome> = {
  pl: {
    heroAria: "Kontakt",
    channelsAria: "Kanały kontaktu",
    locusAria: "Fundacja i dane",
    codaAria: "Do usłyszenia",
    copy: "Kopiuj",
    copied: "Skopiowano",
    copyAria: "Skopiuj adres {email}",
  },
  en: {
    heroAria: "Contact",
    channelsAria: "Contact channels",
    locusAria: "The foundation and its details",
    codaAria: "Until next time",
    copy: "Copy",
    copied: "Copied",
    copyAria: "Copy the address {email}",
  },
  fr: {
    heroAria: "Contact",
    channelsAria: "Canaux de contact",
    locusAria: "La fondation et ses informations",
    codaAria: "À bientôt",
    copy: "Copier",
    copied: "Copié",
    copyAria: "Copier l'adresse {email}",
  },
};
