/**
 * @file press.ts
 * @description Everything about the press kit (/press) except its words: the shape its Polish
 *  prose must have (zod, `.strict()`), the copy desk's key contract over that prose, and the
 *  page's chrome in all three locales.
 *
 *  THE PAGE IS A TOOL, NOT AN ARGUMENT. Its reader has already been convinced and now has to
 *  produce a poster, a programme book and a press note before a deadline. So the contract below
 *  is short on purpose: what an organiser COPIES (three biograms), what they DOWNLOAD (the pack),
 *  what they must GET RIGHT (whom to credit, which legal entity signs), and where to look for
 *  everything the site already holds better elsewhere.
 *
 *  THREE THINGS ON THIS PAGE ARE NOT COPY AND MUST NOT DRIFT INTO IT:
 *
 *  - the registry numbers and the two accounts → `src/data/foundation.ts`. A number has no
 *    per-locale form at all, and it is printed by a Node script as well as by this page;
 *  - the counts in the fact tiles → read from the corpus at build (`cycleStations`, the
 *    `repertoire` collection), because a typed count rots the day a concert or a work lands;
 *  - the character measures beside each biogram → measured from the text itself
 *    (`lib/plainText`), for the same reason: "ok. 2000 znaków" was typed once and then the
 *    sentence under it changed.
 *
 *  A PUBLICATION'S OWN HEADLINE IS NEVER TRANSLATED. `press.items[].title` is what somebody else
 *  printed; our sentence about it (`context`) is ours and is on the desk. Same line the site
 *  draws around a quoted text everywhere else.
 *
 *  NOT YET IN `TRANSLATED_ROUTES`, deliberately. The page is on the desk so its Polish can be
 *  edited, but there are no `/en/press` and `/fr/press` routes and §2's two-iteration rule says
 *  why: translating prose that is being rewritten this week buys a translation of a draft.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here, so the key a translation is stored under and the key the page looks up are
 *  the same expression. Keep it free of `?raw`, `astro:assets` and anything a bundler must resolve.
 * @architecture Astro islands 2026
 * @module i18n/content/press
 */

import { z } from "astro/zod";

import type { Locale } from "../config";
import type { CopyEntry, PageCopySpec } from "./copySpec";
import type { CountForms } from "./obrazy";

// ── The prose, as a shape ─────────────────────────────────────────────────────────────────────

/**
 * `.strict()` throughout: a hand-added `en:` beside a Polish value would otherwise be dropped in
 * silence by zod's default and the translation would simply never appear. Translations belong in
 * the overlay, and this is what says so.
 */
const pressCopySchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    head: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        titleEm: z.string(),
        positioningHtml: z.string(),
        contactLede: z.string(),
      })
      .strict(),
    bio: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        lede: z.string(),
        shortHtml: z.string(),
        mediumHtml: z.string(),
        longHtml: z.string(),
      })
      .strict(),
    pack: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        ledeReady: z.string(),
        ledePending: z.string(),
        contentsIntro: z.string(),
        items: z.array(z.object({ id: z.string(), text: z.string() }).strict()),
        requestLabel: z.string(),
        downloadLabel: z.string(),
        photoUsage: z.string(),
        logoUsage: z.string(),
        moreHtml: z.string(),
      })
      .strict(),
    facts: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        items: z.array(
          z
            .object({ id: z.string(), value: z.string().optional(), label: z.string() })
            .strict(),
        ),
        officeNoteHtml: z.string(),
        legalLede: z.string(),
      })
      .strict(),
    collab: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        lede: z.string(),
        artistsTitle: z.string(),
        institutionsTitle: z.string(),
        mediaTitle: z.string(),
        artists: z.array(
          z
            .object({
              id: z.string(),
              role: z.string(),
              name: z.string(),
              entity: z.string(),
            })
            .strict(),
        ),
        institutions: z.array(z.object({ id: z.string(), name: z.string() }).strict()),
        media: z.array(z.object({ id: z.string(), name: z.string() }).strict()),
      })
      .strict(),
    press: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        lede: z.string(),
        items: z.array(
          z
            .object({
              id: z.string(),
              outlet: z.string(),
              kind: z.string(),
              title: z.string(),
              context: z.string(),
              href: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
    booking: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        ledeHtml: z.string(),
        allChannelsNote: z.string(),
      })
      .strict(),
  })
  .strict();

export type PressCopy = z.infer<typeof pressCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/**
 * DECLARATION ORDER IS READING ORDER — head to booking, because `order` is a counter over this
 * list.
 */
const PRESS_CONTRACT: readonly CopyEntry[] = [
  // ── Metadane ──────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "meta.title",
    label: "Metadane · tytuł strony",
    note: "Read in a browser tab and in a mail preview. The page is noindex, so it never appears in a search result — its only traffic is a link we send.",
  },
  {
    kind: "field",
    path: "meta.description",
    label: "Metadane · opis strony",
  },

  // ── Głowica ───────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "head.eyebrow",
    label: "Głowica · rubryka",
    note: "The vernacular of `Acta`, which stands above it unchanged in every locale.",
  },
  {
    kind: "field",
    path: "head.title",
    label: "Głowica · nazwa",
    note: "The ensemble's name. It is here rather than in the markup only because the line beside it is, and it is the same string in every locale.",
  },
  {
    kind: "field",
    path: "head.titleEm",
    label: "Głowica · cykl",
    note: "Set in italic gold under the name: the cycle, not a subtitle. `Koncerty Duchowe` is the site's own name for it and has a settled rendering in each locale — see the translation glossary.",
  },
  {
    kind: "field",
    path: "head.positioningHtml",
    label: "Głowica · pozycjonowanie",
    note: "One sentence, and the only one on the page whose job is to say what the ensemble IS. Everything persuasive lives on the landing.",
  },
  {
    kind: "field",
    path: "head.contactLede",
    label: "Głowica · linia kontaktu",
    note: "The address itself is printed after this sentence from `data/foundation.ts` — never write it into the copy.",
  },

  // ── Biogram ───────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "bio.eyebrow", label: "Biogram · rubryka" },
  { kind: "field", path: "bio.h2", label: "Biogram · tytuł" },
  {
    kind: "field",
    path: "bio.lede",
    label: "Biogram · lede",
    note: "Do not name a character count here: the page measures each text and prints the real number beside it.",
  },
  {
    kind: "field",
    path: "bio.shortHtml",
    label: "Biogram · krótki",
    note: "Around 300 characters — a note in a programme, or a line under a poster. A condensation of the full biogram below and never a source of new facts. Keep it near that measure in every locale: the page prints the real count.",
  },
  {
    kind: "field",
    path: "bio.mediumHtml",
    label: "Biogram · średni",
    note: "Around 1000 characters — an announcement or a press note. Same rule as the short one.",
  },
  {
    kind: "field",
    path: "bio.longHtml",
    label: "Biogram · pełny",
    note: "The ensemble's own text, verbatim, and the one legitimately brochure-voiced artifact on this site. It is ONE field rather than five paragraphs on purpose: a reviewer translating paragraph three and leaving two in Polish would produce a mixed-language biogram that somebody then pastes into a programme book.",
  },

  // ── Pakiet ────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "pack.eyebrow", label: "Pakiet · rubryka" },
  { kind: "field", path: "pack.h2", label: "Pakiet · tytuł" },
  {
    kind: "field",
    path: "pack.ledeReady",
    label: "Pakiet · lede (pakiet jest)",
    note: "Printed only when the archive actually exists in public/press/. The page decides by looking at the directory, so this text can never stand over a dead link.",
  },
  {
    kind: "field",
    path: "pack.ledePending",
    label: "Pakiet · lede (pakiet w składaniu)",
    note: "The other half of the same switch. It must promise no date — what it waits for comes from the ensemble.",
  },
  { kind: "field", path: "pack.contentsIntro", label: "Pakiet · wstęp do spisu" },
  {
    kind: "list",
    path: "pack.items",
    keyBy: "id",
    label: "Pakiet · pozycja",
    note: "What is in the archive, listed in both states — when it does not exist yet, this is what an organiser knows to ask for by mail.",
    fields: [{ path: "text", label: "opis" }],
  },
  { kind: "field", path: "pack.requestLabel", label: "Pakiet · przycisk (napisz)" },
  { kind: "field", path: "pack.downloadLabel", label: "Pakiet · przycisk (pobierz)" },
  {
    kind: "field",
    path: "pack.photoUsage",
    label: "Pakiet · zasady użycia zdjęć",
    note: "Printed INSIDE the archive, never on the page — `scripts/press-pack.mjs` writes it into the pack's own readme beside credits.txt. It is the permission an organiser acts on, so it must stay specific about what is allowed and what is not.",
  },
  {
    kind: "field",
    path: "pack.logoUsage",
    label: "Pakiet · zasady użycia logotypu",
    note: "Also inside the archive only, beside the logo files.",
  },
  {
    kind: "field",
    path: "pack.moreHtml",
    label: "Pakiet · gdzie jest reszta",
    note: "Three links out to what the site already holds in full. Write the hrefs as bare Polish paths — `lib/pageCopy` points them at this locale's URL for each page.",
  },

  // ── Dane ──────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "facts.eyebrow", label: "Dane · rubryka" },
  { kind: "field", path: "facts.h2", label: "Dane · tytuł" },
  {
    kind: "list",
    path: "facts.items",
    keyBy: "id",
    label: "Dane · kafel",
    note: "Two of these tiles have no `value`: their number is counted from the corpus at build. Their label therefore stands beside a NUMBER, and in Polish it must read correctly beside five or more — the cycle has six stations and only grows.",
    fields: [
      { path: "value", label: "liczba" },
      { path: "label", label: "podpis" },
    ],
  },
  {
    kind: "field",
    path: "facts.officeNoteHtml",
    label: "Dane · nota o oprawach",
    note: "The one thing the deleted liturgy section said that somebody books on. It says what the music IS when it serves a rite, and never what it costs — that is a question for the board before it is a page (Etap 4).",
  },
  { kind: "field", path: "facts.legalLede", label: "Dane · wstęp do danych do faktury" },

  // ── Współpraca ────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "collab.eyebrow", label: "Współpraca · rubryka" },
  { kind: "field", path: "collab.h2", label: "Współpraca · tytuł" },
  { kind: "field", path: "collab.lede", label: "Współpraca · lede" },
  { kind: "field", path: "collab.artistsTitle", label: "Współpraca · nagłówek artystów" },
  { kind: "field", path: "collab.institutionsTitle", label: "Współpraca · nagłówek instytucji" },
  { kind: "field", path: "collab.mediaTitle", label: "Współpraca · nagłówek patronów" },
  {
    kind: "list",
    path: "collab.artists",
    keyBy: "id",
    label: "Współpraca · artysta",
    note: "Only the ROLE is copy. The person and the studio beside it are proper names.",
    fields: [{ path: "role", label: "rola" }],
  },

  // ── Pisali o nas ──────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "press.eyebrow", label: "Pisali o nas · rubryka" },
  { kind: "field", path: "press.h2", label: "Pisali o nas · tytuł" },
  { kind: "field", path: "press.lede", label: "Pisali o nas · lede" },
  {
    kind: "list",
    path: "press.items",
    keyBy: "id",
    label: "Pisali o nas · pozycja",
    note: "The outlet and the headline are somebody else's words and are not here. `kind` and `context` are ours.",
    fields: [
      { path: "kind", label: "rodzaj" },
      { path: "context", label: "opis" },
    ],
  },

  // ── Zaproszenie ───────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "booking.eyebrow", label: "Zaproszenie · rubryka" },
  { kind: "field", path: "booking.h2", label: "Zaproszenie · tytuł" },
  { kind: "field", path: "booking.ledeHtml", label: "Zaproszenie · lede" },
  {
    kind: "field",
    path: "booking.allChannelsNote",
    label: "Zaproszenie · nota o pozostałych adresach",
    note: "This page prints ONE address. The rest are on /kontakt, and this is the sentence that sends the reader there.",
  },
];

/** Everything else in `press.yaml`, with the reason it is not text a reader is meant to read. */
const PRESS_NOT_COPY: Readonly<Record<string, string>> = {
  "pack.items[].id": "identity — it is this item's key part",
  "facts.items[].id": "identity — it is this tile's key part, and what the build matches a counted number to",
  "collab.artists[].id": "identity — it is this collaborator's key part",
  "collab.artists[].name": "a person's name — never translated",
  "collab.artists[].entity": "a studio's or a company's registered name",
  "collab.institutions[].id": "identity — it is this partner's key part",
  "collab.institutions[].name": "an institution's own name, printed unchanged in every locale",
  "collab.media[].id": "identity — it is this patron's key part",
  "collab.media[].name": "a title's own name, printed unchanged in every locale",
  "press.items[].id": "identity — it is this publication's key part",
  "press.items[].outlet": "the publisher's own name",
  "press.items[].title":
    "somebody else's headline, quoted. Translating it would put words in a publication's mouth and break the link between the card and the page it opens",
  "press.items[].href": "a URL",
};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const PRESS_PAGE: PageCopySpec<PressCopy> = {
  id: "press",
  label: "Press kit",
  schema: pressCopySchema,
  contract: PRESS_CONTRACT,
  notCopy: PRESS_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

/**
 * `CountForms` comes from the image archive's module, which is where this site first needed a
 * noun that agrees with a computed number; `counted` itself is imported by the PAGE from the same
 * place, as /kolofon already does.
 *
 * It is deliberately NOT re-exported from here. This file is loaded by plain Node (the desk's
 * extractor), and a value re-export is a real runtime resolution — Node would demand the `.ts`
 * extension that the rest of the site's imports do not carry. Every cross-module import in a
 * content module is therefore `import type`, which type-stripping erases before Node ever sees a
 * specifier. Breaking that rule fails the extractor, not the build, so it fails late.
 */
export interface PressChrome {
  /** Landmark names. They are read instead of the heading, so they name the section. */
  readonly headAria: string;
  readonly bioAria: string;
  readonly packAria: string;
  readonly factsAria: string;
  readonly collabAria: string;
  readonly pressAria: string;
  readonly bookingAria: string;
  /**
   * What each biogram is FOR, printed as the measure's own name. The character count beside it is
   * measured, never written.
   */
  readonly bioShort: string;
  readonly bioMedium: string;
  readonly bioLong: string;
  /** "znak / znaki / znaków", so the measured count can be printed as a sentence. */
  readonly characters: CountForms;
  /** The copy-to-clipboard affordance: resting label, and the one it flashes after a copy. */
  readonly copy: string;
  readonly copied: string;
  /** Accessible name of that button. `{measure}` is replaced with the measure's own name above. */
  readonly copyAria: string;
  /** Labels of the invoicing block — a definition list, and a missing term is a broken row. */
  readonly legalName: string;
  readonly legalAddress: string;
  readonly legalAccountPln: string;
  readonly legalAccountEur: string;
  /** Accessible name of the copy button beside one of those values. `{field}` is its label. */
  readonly copyFieldAria: string;
  /** Where the one printed address sends a reader for the others. */
  readonly allChannels: string;
  /**
   * Subject lines of the two mails this page opens. They are chrome rather than copy because a
   * reader never sees them before sending: nobody reviews a `mailto:`, and one missing in French
   * would send an untitled mail rather than a French one.
   */
  readonly mailSubjectBooking: string;
  readonly mailSubjectPack: string;
  /** Appended to a link that opens somebody else's site, for a reader who cannot see the arrow. */
  readonly externalAria: string;
}

export const PRESS_CHROME: Record<Locale, PressChrome> = {
  pl: {
    headAria: "Press kit VoctEnsemble",
    bioAria: "Biogram do skopiowania",
    packAria: "Pakiet prasowy",
    factsAria: "Dane zespołu i fundacji",
    collabAria: "Współpracownicy i partnerzy",
    pressAria: "Publikacje o zespole",
    bookingAria: "Zaproszenie i kontakt",
    bioShort: "Krótki",
    bioMedium: "Średni",
    bioLong: "Pełny",
    characters: { one: "znak", few: "znaki", many: "znaków" },
    copy: "Kopiuj",
    copied: "Skopiowano",
    copyAria: "Skopiuj biogram — {measure}",
    legalName: "Nazwa",
    legalAddress: "Adres",
    legalAccountPln: "Konto PLN",
    legalAccountEur: "Konto EUR",
    copyFieldAria: "Skopiuj: {field}",
    allChannels: "Wszystkie kanały kontaktu",
    mailSubjectBooking: "Zaproszenie — VoctEnsemble",
    mailSubjectPack: "Materiały prasowe — VoctEnsemble",
    externalAria: "otwiera się w nowej karcie",
  },
  en: {
    headAria: "VoctEnsemble press kit",
    bioAria: "Biography, ready to copy",
    packAria: "Press pack",
    factsAria: "The ensemble and the foundation",
    collabAria: "Collaborators and partners",
    pressAria: "Published coverage",
    bookingAria: "Invitations and contact",
    bioShort: "Short",
    bioMedium: "Medium",
    bioLong: "Full",
    characters: { one: "character", many: "characters" },
    copy: "Copy",
    copied: "Copied",
    copyAria: "Copy the biography — {measure}",
    legalName: "Name",
    legalAddress: "Address",
    legalAccountPln: "Account, PLN",
    legalAccountEur: "Account, EUR",
    copyFieldAria: "Copy: {field}",
    allChannels: "All contact channels",
    mailSubjectBooking: "An invitation — VoctEnsemble",
    mailSubjectPack: "Press materials — VoctEnsemble",
    externalAria: "opens in a new tab",
  },
  fr: {
    headAria: "Dossier de presse VoctEnsemble",
    bioAria: "Biographie, prête à copier",
    packAria: "Dossier de presse",
    factsAria: "L'ensemble et la fondation",
    collabAria: "Collaborateurs et partenaires",
    pressAria: "Ils ont parlé de nous",
    bookingAria: "Invitations et contact",
    bioShort: "Courte",
    bioMedium: "Moyenne",
    bioLong: "Complète",
    characters: { one: "caractère", many: "caractères" },
    copy: "Copier",
    copied: "Copié",
    copyAria: "Copier la biographie — {measure}",
    legalName: "Nom",
    legalAddress: "Adresse",
    legalAccountPln: "Compte, PLN",
    legalAccountEur: "Compte, EUR",
    copyFieldAria: "Copier : {field}",
    allChannels: "Tous les canaux de contact",
    mailSubjectBooking: "Une invitation — VoctEnsemble",
    mailSubjectPack: "Dossier de presse — VoctEnsemble",
    externalAria: "s'ouvre dans un nouvel onglet",
  },
};
