/**
 * @file politykaPrywatnosci.ts
 * @description Everything about the privacy policy except the policy itself: the shape the
 *  document must have (zod, `.strict()`), the copy desk's key contract over it, and the two chrome
 *  strings the document needs of its own.
 *
 *  A PEER OF THE DONATION TERMS, not a page of prose. Both are legal texts and both are reviewed
 *  against "does this still say what the Polish says" rather than "does this read well", so each
 *  is its own scope on the desk with its own stale count.
 *
 *  THE DOCUMENT'S NAME IS NOT IN THIS FILE AND NOT IN ITS YAML. Every page of the site prints it
 *  in the footer's index column from `UI.footer.privacy`, in three complete locales, and the page
 *  READS that one name for its `<h1>` and its `<title>`. The test that puts a string in a chrome
 *  table is whether completeness can be demanded of it (spec §6r), and a landmark label on thirty
 *  screens fails immediately if a locale is missing. The terms went the other way because their
 *  title is read only inside the island that already holds the document.
 *
 *  THE CONTENTS LIST IS DERIVED FROM THE SECTION TITLES, never written beside them — one section,
 *  one name, on the page that names it. Two of the twelve disagreed in the hand-authored HTML this
 *  file replaces, which is a name printed twice and therefore read twice (spec §6y).
 *
 *  NUMBERING IS TEXT, NOT LAYOUT, exactly as in the terms: § 10's closing paragraph points at
 *  „sekcja «Odbiorcy danych»" and every purpose in § 4 rests on a named letter of art. 6 ust. 1.
 *  So the paragraphs are NAMED fields, never a list the desk could reorder, and the `01`–`12`
 *  numerals are locale-neutral markup like every other rubric on this site.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite — the extractor reads the contract straight
 *  from here (type-stripping, no build step), so keep it free of `?raw`, `astro:assets` and
 *  anything else only a bundler can resolve.
 * @architecture Astro islands 2026
 * @module i18n/content/politykaPrywatnosci
 */

import { z } from "astro/zod";

import type { Locale } from "../config";
import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The document, as a shape ──────────────────────────────────────────────────────────────────

/** A bullet whose text carries no markup. */
const plainItem = z.object({ id: z.string(), text: z.string() }).strict();

/** A bullet opening with a bold lead — the shape most of this document's lists take. */
const markedItem = z.object({ id: z.string(), textHtml: z.string() }).strict();

/** `.strict()` throughout: a hand-added `en:` beside a Polish value fails the build rather than
    being dropped in silence. Translations belong in the overlay. */
const privacyCopySchema = z
  .object({
    /** Structural: printed under the title and matched by the newest history entry. */
    version: z.string(),
    /** ISO date. Formatted per locale at render, never carried inside a translated sentence. */
    effectiveFrom: z.string(),
    meta: z.object({ description: z.string() }).strict(),
    head: z
      .object({ kicker: z.string(), ledeHtml: z.string(), tocLabel: z.string() })
      .strict(),
    /** The register and the mailbox, rendered into the cards § 1 and § 2 print. */
    foundation: z
      .object({
        name: z.string(),
        address: z.string(),
        registry: z.string(),
        email: z.string(),
      })
      .strict(),
    s1: z.object({ title: z.string(), p1Html: z.string(), p2: z.string() }).strict(),
    s2: z
      .object({ title: z.string(), p1: z.string(), cardNote: z.string(), p2: z.string() })
      .strict(),
    s3: z
      .object({
        title: z.string(),
        visitors: z
          .object({
            title: z.string(),
            p1: z.string(),
            items: z.array(plainItem),
            p2: z.string(),
          })
          .strict(),
        donors: z.object({ title: z.string(), p1: z.string() }).strict(),
        gateway: z
          .object({
            title: z.string(),
            p1Html: z.string(),
            items: z.array(markedItem),
            p2Html: z.string(),
          })
          .strict(),
        zrzutka: z.object({ title: z.string(), p1Html: z.string() }).strict(),
        transfer: z.object({ title: z.string(), p1: z.string() }).strict(),
        patronage: z.object({ title: z.string(), p1Html: z.string() }).strict(),
        email: z.object({ title: z.string(), p1: z.string() }).strict(),
        audio: z.object({ title: z.string(), p1Html: z.string() }).strict(),
      })
      .strict(),
    s4: z
      .object({ title: z.string(), p1: z.string(), items: z.array(markedItem) })
      .strict(),
    s5: z
      .object({
        title: z.string(),
        p1: z.string(),
        /** One list printed twice: the badge row above the paragraphs, and the paragraphs. */
        items: z.array(
          z.object({ id: z.string(), badge: z.string(), textHtml: z.string() }).strict(),
        ),
      })
      .strict(),
    s6: z
      .object({ title: z.string(), p1: z.string(), p2: z.string(), p3: z.string() })
      .strict(),
    s7: z.object({ title: z.string(), items: z.array(markedItem) }).strict(),
    s8: z
      .object({
        title: z.string(),
        p1: z.string(),
        items: z.array(markedItem),
        p2Html: z.string(),
      })
      .strict(),
    s9: z
      .object({
        title: z.string(),
        p1Html: z.string(),
        items: z.array(markedItem),
        p2Html: z.string(),
      })
      .strict(),
    s10: z
      .object({
        title: z.string(),
        own: z.object({ title: z.string(), p1Html: z.string() }).strict(),
        storage: z
          .object({
            title: z.string(),
            p1: z.string(),
            items: z.array(
              z
                .object({
                  id: z.string(),
                  storageKey: z.string(),
                  store: z.string(),
                  note: z.string(),
                })
                .strict(),
            ),
          })
          .strict(),
        gateway: z
          .object({
            title: z.string(),
            p1Html: z.string(),
            items: z.array(plainItem),
            p2Html: z.string(),
          })
          .strict(),
      })
      .strict(),
    s11: z.object({ title: z.string(), items: z.array(markedItem) }).strict(),
    s12: z
      .object({ title: z.string(), p1: z.string(), p2: z.string(), p3Html: z.string() })
      .strict(),
    history: z
      .object({
        label: z.string(),
        entries: z.array(
          z
            .object({
              id: z.string(),
              version: z.string(),
              date: z.string(),
              note: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export type PrivacyCopy = z.infer<typeof privacyCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/** DECLARATION ORDER IS READING ORDER — `order` is a counter over this list, and it follows the
    document from its head through the twelve sections to the version history at its foot. */
const PRIVACY_CONTRACT: readonly CopyEntry[] = [
  {
    kind: "field",
    path: "meta.description",
    label: "Metadane · opis strony",
    note: "Read in a browser tab and by a crawler, never on the page. The document is noindex, so this is not competing for a search result — it says what the page is to somebody who has it open in one of nine tabs.",
  },

  { kind: "field", path: "head.kicker", label: "Głowa · rejestr" },
  {
    kind: "field",
    path: "head.ledeHtml",
    label: "Głowa · wprowadzenie",
    note: "The way in, and the substance of the page: three negations — no marketing cookies, no analytics profiling, no automated decisions — followed by what the reader is about to be told. Keep all three; each of them is a factual claim this foundation is making about itself.",
  },
  {
    kind: "field",
    path: "head.tocLabel",
    label: "Głowa · etykieta spisu",
    note: "The heading over the contents list. The list's own entries are the twelve section titles and are never written here.",
  },

  { kind: "field", path: "s1.title", label: "01 · tytuł" },
  {
    kind: "field",
    path: "s1.p1Html",
    label: "01 · akapit 1",
    note: "It ends with a colon and the register card follows it. The foundation's name, address and its three registry numbers are structural and are not translated.",
  },
  {
    kind: "field",
    path: "s1.p2",
    label: "01 · akapit 2",
    note: "„Cele statutowe” is the term the statute and the donation terms both use — print whatever rendering those two already print, and never a fresh one.",
  },

  { kind: "field", path: "s2.title", label: "02 · tytuł" },
  { kind: "field", path: "s2.p1", label: "02 · akapit 1" },
  {
    kind: "field",
    path: "s2.cardNote",
    label: "02 · karta · druga linia",
    note: "The line under the mailbox in the contact card. The address itself is structural.",
  },
  {
    kind: "field",
    path: "s2.p2",
    label: "02 · akapit 2",
    note: "`art. 37 RODO` is an address inside the regulation: name the regulation in the reader's own language and leave the article number alone. The sentence says the appointment was CONSIDERED and is not required — never that it was overlooked.",
  },

  { kind: "field", path: "s3.title", label: "03 · tytuł" },

  { kind: "field", path: "s3.visitors.title", label: "03 · odwiedzający · tytuł" },
  { kind: "field", path: "s3.visitors.p1", label: "03 · odwiedzający · akapit 1" },
  {
    kind: "list",
    path: "s3.visitors.items",
    keyBy: "id",
    label: "03 · odwiedzający",
    fields: [{ path: "text", label: "pozycja" }],
    note: "Four technical fields of an HTTP request. Each line ends in a comma except the last, because the four together are one sentence.",
  },
  { kind: "field", path: "s3.visitors.p2", label: "03 · odwiedzający · akapit 2" },

  { kind: "field", path: "s3.donors.title", label: "03 · darczyńcy · tytuł" },
  { kind: "field", path: "s3.donors.p1", label: "03 · darczyńcy · akapit" },

  {
    kind: "field",
    path: "s3.gateway.title",
    label: "03 · bramka · tytuł",
    note: "BLIK is a Polish payment scheme and Apple Pay / Google Pay are brands; they keep their names. Only „szybkie przelewy” and „karty” are words.",
  },
  { kind: "field", path: "s3.gateway.p1Html", label: "03 · bramka · akapit 1" },
  {
    kind: "list",
    path: "s3.gateway.items",
    keyBy: "id",
    label: "03 · bramka",
    fields: [{ path: "textHtml", label: "pozycja" }],
    note: "The two halves of the redirect model, in order: what our server sends, and where the reader then types their payment data.",
  },
  {
    kind: "field",
    path: "s3.gateway.p2Html",
    label: "03 · bramka · akapit 2",
    note: "The load-bearing assurance of the whole document — full payment data never reaches this foundation's servers, and what does stay is enumerated. Translate the enumeration exactly; PCI DSS is a standard's name and stays itself.",
  },

  { kind: "field", path: "s3.zrzutka.title", label: "03 · Zrzutka · tytuł" },
  { kind: "field", path: "s3.zrzutka.p1Html", label: "03 · Zrzutka · akapit" },

  { kind: "field", path: "s3.transfer.title", label: "03 · przelew · tytuł" },
  {
    kind: "field",
    path: "s3.transfer.p1",
    label: "03 · przelew · akapit",
    note: "The clause about storing no card data and no debit mandate is a factual assurance about how the foundation works, not a flourish — the donation terms make the same one, in the same words. Keep it.",
  },

  {
    kind: "field",
    path: "s3.patronage.title",
    label: "03 · mecenat · tytuł",
    note: "„Mecenat” is the name of the vault's own section; call it whatever the vault calls it in this language.",
  },
  { kind: "field", path: "s3.patronage.p1Html", label: "03 · mecenat · akapit" },

  { kind: "field", path: "s3.email.title", label: "03 · korespondencja · tytuł" },
  { kind: "field", path: "s3.email.p1", label: "03 · korespondencja · akapit" },

  {
    kind: "field",
    path: "s3.audio.title",
    label: "03 · audio · tytuł",
    note: "`localStorage` is the browser API's name and stays in English in every locale.",
  },
  {
    kind: "field",
    path: "s3.audio.p1Html",
    label: "03 · audio · akapit",
    note: "„Wejdź z głosem” / „Wejdź w ciszę” are the two doors of the landing's entrance gate — name them exactly as the gate prints them in this language. The storage key inside `<code>` is an identifier and is never translated.",
  },

  { kind: "field", path: "s4.title", label: "04 · tytuł" },
  { kind: "field", path: "s4.p1", label: "04 · akapit 1" },
  {
    kind: "list",
    path: "s4.items",
    keyBy: "id",
    label: "04 · podstawa",
    fields: [{ path: "textHtml", label: "pozycja" }],
    note: "Six purposes, each opening with the purpose in bold and closing with the article that licenses it. Every `art. 6 ust. 1 lit. …` is an address inside the GDPR: name the regulation in the reader's language, never renumber a citation, and never move a purpose onto a different letter — the letter IS the legal basis.",
  },

  { kind: "field", path: "s5.title", label: "05 · tytuł" },
  { kind: "field", path: "s5.p1", label: "05 · akapit 1" },
  {
    kind: "list",
    path: "s5.items",
    keyBy: "id",
    label: "05 · odbiorca",
    fields: [
      {
        path: "badge",
        label: "znacznik",
        note: "The short form printed in the row of chips above the paragraphs. Three of the five are company names and stay themselves; only the two descriptions are words.",
      },
      { path: "textHtml", label: "akapit" },
    ],
    note: "Five recipients, named twice on one screen — as a chip and as a paragraph — so each carries both its forms and the two can never fall out of step. The company names, their registered addresses and the linked policies stay exactly as they are.",
  },

  {
    kind: "field",
    path: "s6.title",
    label: "06 · tytuł",
    note: "The heading abbreviates what the first paragraph writes out in full, and the contents list reads this same line — so the abbreviation is the section's one name.",
  },
  { kind: "field", path: "s6.p1", label: "06 · akapit 1" },
  {
    kind: "field",
    path: "s6.p2",
    label: "06 · akapit 2",
    note: "Standardowe Klauzule Umowne are the GDPR's Standard Contractual Clauses — a named instrument with an official rendering in every EU language, and its abbreviation follows the language.",
  },
  { kind: "field", path: "s6.p3", label: "06 · akapit 3" },

  { kind: "field", path: "s7.title", label: "07 · tytuł" },
  {
    kind: "list",
    path: "s7.items",
    keyBy: "id",
    label: "07 · okres",
    fields: [{ path: "textHtml", label: "pozycja" }],
    note: "Five retention periods. Every number is a duration this foundation may be held to — 12 months, 5 years, 3 years, 3 hours — and `art. 74 ustawy o rachunkowości` is an address inside the Polish Accounting Act. Name the act in the reader's language; leave the article and the periods alone.",
  },

  { kind: "field", path: "s8.title", label: "08 · tytuł" },
  { kind: "field", path: "s8.p1", label: "08 · akapit 1" },
  {
    kind: "list",
    path: "s8.items",
    keyBy: "id",
    label: "08 · prawo",
    fields: [{ path: "textHtml", label: "pozycja" }],
    note: "Seven rights, each named by the GDPR itself. Every jurisdiction's own translation of the regulation has an official rendering for each name — use it rather than inventing one, and keep the article numbers where they are. The supervisory authority is Poland's because the administrator is established in Poland; its name and address stay as they are.",
  },
  { kind: "field", path: "s8.p2Html", label: "08 · akapit 2" },

  { kind: "field", path: "s9.title", label: "09 · tytuł" },
  { kind: "field", path: "s9.p1Html", label: "09 · akapit 1" },
  {
    kind: "list",
    path: "s9.items",
    keyBy: "id",
    label: "09 · cecha",
    fields: [{ path: "textHtml", label: "pozycja" }],
    note: "Three claims about the analytics tool, each opening with a bold lead that ends in a colon.",
  },
  {
    kind: "field",
    path: "s9.p2Html",
    label: "09 · akapit 2",
    note: "The linked document is Plausible's own and exists in English only, so the sentence around it translates and the title is named as what it is.",
  },

  { kind: "field", path: "s10.title", label: "10 · tytuł" },
  { kind: "field", path: "s10.own.title", label: "10 · własne cookies · tytuł" },
  { kind: "field", path: "s10.own.p1Html", label: "10 · własne cookies · akapit" },
  { kind: "field", path: "s10.storage.title", label: "10 · pamięć przeglądarki · tytuł" },
  {
    kind: "field",
    path: "s10.storage.p1",
    label: "10 · pamięć przeglądarki · akapit",
    note: "„Ściśle niezbędne” is the ePrivacy directive's own term of art (recital 30) and every language has its official rendering — it is what licenses these entries without consent, so it is not a phrase to paraphrase. `localStorage` and `sessionStorage` are API names and stay in English.",
  },
  {
    kind: "list",
    path: "s10.storage.items",
    keyBy: "id",
    label: "10 · wpis",
    fields: [{ path: "note", label: "opis" }],
    note: "Three browser-storage entries. The key itself and the store it lives in are identifiers rendered beside this sentence and are never translated; only what the entry is FOR is copy.",
  },
  { kind: "field", path: "s10.gateway.title", label: "10 · skrypty bramki · tytuł" },
  {
    kind: "field",
    path: "s10.gateway.p1Html",
    label: "10 · skrypty bramki · akapit 1",
    note: "„Wesprzyj” is the nav's own support button — name it exactly as the chrome prints it in this language (`UI.nav.support`).",
  },
  {
    kind: "list",
    path: "s10.gateway.items",
    keyBy: "id",
    label: "10 · skrypty bramki",
    fields: [{ path: "text", label: "pozycja" }],
    note: "Four purposes the operator's own scripts serve. 3-D Secure, Strong Customer Authentication and PSD2 SCA are standards' names and stay themselves.",
  },
  {
    kind: "field",
    path: "s10.gateway.p2Html",
    label: "10 · skrypty bramki · akapit 2",
    note: "The point of the section: none of this runs on voctensemble.com. „Odbiorcy danych” names § 5 above, so it has to read exactly what § 5's own title becomes in this language.",
  },

  { kind: "field", path: "s11.title", label: "11 · tytuł" },
  {
    kind: "list",
    path: "s11.items",
    keyBy: "id",
    label: "11 · środek",
    fields: [{ path: "textHtml", label: "pozycja" }],
    note: "Five measures. HTTPS, TLS 1.3, HSTS and PCI DSS are standards' names and stay themselves.",
  },

  { kind: "field", path: "s12.title", label: "12 · tytuł" },
  { kind: "field", path: "s12.p1", label: "12 · akapit 1" },
  {
    kind: "field",
    path: "s12.p2",
    label: "12 · akapit 2",
    note: "ADDED IN VERSION 1.2, and it is the clause that makes the English and French versions safe to publish at all: the reader is told, inside the document itself, that the Polish version is the binding one. Translate it exactly — this paragraph is the reason the other two versions are informational. It is the twin of § 5 ust. 3 of the donation terms and should read as its twin.",
  },
  { kind: "field", path: "history.label", label: "Historia zmian · etykieta" },
  {
    kind: "list",
    path: "history.entries",
    keyBy: "id",
    label: "Historia zmian",
    fields: [
      {
        path: "note",
        label: "opis zmiany",
        note: "What that version changed. The version number and its date are composed from structural fields at render, so no date is ever carried inside this sentence.",
      },
    ],
  },
  { kind: "field", path: "s12.p3Html", label: "12 · akapit 3" },
];

/** Everything else in `polityka-prywatnosci.yaml`, with the reason it is not text a reader reads. */
const PRIVACY_NOT_COPY: Readonly<Record<string, string>> = {
  version: "The document's version number. A figure, not a phrase.",
  effectiveFrom:
    "An ISO date, formatted per locale by `lib/dates`. A date written into prose drifts from the field it was copied from — this project's most repeated trap.",
  "foundation.name": "The foundation's registered name. The same in every language.",
  "foundation.address": "A postal address in Kraków. It is a place, not a phrase.",
  "foundation.registry": "Three Polish registry numbers. Figures.",
  "foundation.email": "A mailbox. `@` and `.` are not legal inside a key part either.",
  "s3.visitors.items[].id":
    "The key the desk addresses a bullet by. An identity an editor is about to translate is not an identity.",
  "s3.gateway.items[].id": "As above.",
  "s4.items[].id": "As above.",
  "s5.items[].id": "As above.",
  "s7.items[].id": "As above.",
  "s8.items[].id": "As above.",
  "s9.items[].id": "As above.",
  "s10.storage.items[].id": "As above.",
  "s10.storage.items[].storageKey":
    "A browser-storage key, printed as code. An identifier the site writes and reads — translating it would describe a key that does not exist.",
  "s10.storage.items[].store":
    "`localStorage` or `sessionStorage` — the browser API's own name, in English everywhere.",
  "s10.gateway.items[].id": "As above.",
  "s11.items[].id": "As above.",
  "history.entries[].id":
    "The key the desk addresses an entry by. It is the version with its dot replaced, because a dot is not legal inside a key part.",
  "history.entries[].version": "A version number, the same in every language.",
  "history.entries[].date": "An ISO date, formatted per locale beside the version.",
};

/** What `lib/pageCopy` needs to read this document, and the extractor to key it. */
export const PRIVACY_PAGE: PageCopySpec<PrivacyCopy> = {
  id: "polityka-prywatnosci",
  label: "Polityka prywatności",
  schema: privacyCopySchema,
  contract: PRIVACY_CONTRACT,
  notCopy: PRIVACY_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

export interface PrivacyChrome {
  /**
   * The way out, top right. It is the same move the footer's link makes, so it names the SITE
   * rather than a page — a reader on a legal leaf is returning to the site, not to a section.
   */
  readonly back: string;
  /**
   * The line under the title: which version this is and when it started to apply. A function
   * because the version is a figure and the date is formatted from an ISO value per locale — the
   * one shape that keeps a Polish date out of a translated sentence.
   */
  readonly stamp: (version: string, date: string) => string;
}

export const PRIVACY_CHROME: Record<Locale, PrivacyChrome> = {
  pl: {
    back: "← powrót",
    stamp: (version, date) => `Wersja ${version} · obowiązuje od ${date}`,
  },
  en: {
    back: "← back",
    stamp: (version, date) => `Version ${version} · in force since ${date}`,
  },
  fr: {
    back: "← retour",
    stamp: (version, date) => `Version ${version} · en vigueur depuis le ${date}`,
  },
};
