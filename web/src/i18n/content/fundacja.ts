/**
 * @file fundacja.ts
 * @description Everything about /fundacja except its words: the shape its Polish prose must have
 *  (zod, `.strict()`), the copy desk's key contract over that prose, and the page's chrome in all
 *  three locales. Same division as `kontakt.ts`: prose in `src/content/pages/fundacja.yaml` with
 *  per-field overlays, chrome here where a `Record<Locale, …>` makes the compiler demand every
 *  locale.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here. Keep it free of `?raw`, `astro:assets` and anything only a bundler resolves.
 *
 *  Chrome carries no typography — `lib/typo.ts` gives each locale its own at build.
 * @architecture Astro islands 2026
 * @module i18n/content/fundacja
 */

import { z } from "astro/zod";

import type { Locale } from "../config";
import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The prose, as a shape ─────────────────────────────────────────────────────────────────────

const termRow = z.object({ id: z.string(), term: z.string(), what: z.string() }).strict();

const foundationCopySchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    hero: z
      .object({
        eyebrow: z.string(),
        title1: z.string(),
        title2Html: z.string(),
        lede: z.string(),
        primary: z.string(),
        secondary: z.string(),
        indexLabel: z.string(),
        index: z
          .array(z.object({ id: z.string(), anchor: z.string(), label: z.string() }).strict())
          .min(1),
      })
      .strict(),
    costs: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        intro: z.string(),
        body: z.string(),
        itemsLabel: z.string(),
        items: z.array(termRow).min(1),
        current: z
          .object({
            labelAhead: z.string(),
            labelPast: z.string(),
            programLink: z.string(),
            note: z.string(),
          })
          .strict(),
      })
      .strict(),
    record: z
      .object({ eyebrow: z.string(), h2: z.string(), intro: z.string(), allLink: z.string() })
      .strict(),
    support: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        intro: z.string(),
        monthly: z
          .object({ label: z.string(), body: z.string(), amounts: z.string(), transferLink: z.string() })
          .strict(),
        once: z
          .object({
            label: z.string(),
            body: z.string(),
            vaultAction: z.string(),
            transferLink: z.string(),
          })
          .strict(),
      })
      .strict(),
    transfer: z
      .object({
        h3: z.string(),
        recipientLabel: z.string(),
        accountLabel: z.string(),
        eurLabel: z.string(),
        eurNote: z.string(),
        titleLabel: z.string(),
        standingOrderHint: z.string(),
        scope: z.string(),
      })
      .strict(),
    join: z
      .object({
        h3: z.string(),
        body: z.string(),
        consentHtml: z.string(),
        successTitle: z.string(),
        successBody: z.string(),
        contactLead: z.string(),
      })
      .strict(),
    partnership: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        intro: z.string(),
        rows: z.array(termRow).min(1),
        next: z.string(),
        thanks: z.string(),
        mailLabel: z.string(),
        mailSubject: z.string(),
        bookingLead: z.string(),
        bookingLink: z.string(),
        bookingSubject: z.string(),
      })
      .strict(),
    who: z
      .object({
        eyebrow: z.string(),
        h2: z.string(),
        relation: z.string(),
        boardLabel: z.string(),
        boardNote: z.string(),
        identityLabel: z.string(),
        documentsLabel: z.string(),
        statuteLink: z.string(),
        privacyLink: z.string(),
        termsLink: z.string(),
        help: z
          .object({
            label: z.string(),
            items: z.array(z.object({ id: z.string(), q: z.string(), a: z.string() }).strict()).min(1),
          })
          .strict(),
        contactLabel: z.string(),
      })
      .strict(),
  })
  .strict();

export type FoundationCopy = z.infer<typeof foundationCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/** DECLARATION ORDER IS READING ORDER — the desk renders the page hero to coda from this list. */
const FOUNDATION_CONTRACT: readonly CopyEntry[] = [
  // ── Metadane ──────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "meta.title",
    label: "Metadane · tytuł strony",
    note: "Read in a search result and a browser tab. Keep both names in it: the ensemble and the foundation.",
  },
  { kind: "field", path: "meta.description", label: "Metadane · opis strony" },

  // ── Hero ──────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "hero.eyebrow",
    label: "Hero · rubryka",
    note: "The vernacular of `Fundatio`, which stands above it unchanged in every locale.",
  },
  {
    kind: "field",
    path: "hero.title1",
    label: "Hero · tytuł, wers 1",
    note: "Two lines, and the break is compositional: split where the target language wants it.",
  },
  { kind: "field", path: "hero.title2Html", label: "Hero · tytuł, wers 2" },
  { kind: "field", path: "hero.lede", label: "Hero · lede" },
  { kind: "field", path: "hero.primary", label: "Hero · działanie główne" },
  { kind: "field", path: "hero.secondary", label: "Hero · działanie dla firm" },
  { kind: "field", path: "hero.indexLabel", label: "Hero · etykieta spisu" },
  {
    kind: "list",
    path: "hero.index",
    keyBy: "id",
    label: "Spis sekcji",
    fields: [{ path: "label", label: "etykieta" }],
  },

  // ── Koszty ────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "costs.eyebrow", label: "Koszty · rubryka", note: "The vernacular of `Impensae`." },
  { kind: "field", path: "costs.h2", label: "Koszty · nagłówek" },
  { kind: "field", path: "costs.intro", label: "Koszty · wprowadzenie" },
  { kind: "field", path: "costs.body", label: "Koszty · akapit" },
  { kind: "field", path: "costs.itemsLabel", label: "Koszty · etykieta listy" },
  {
    kind: "list",
    path: "costs.items",
    keyBy: "id",
    label: "Pozycja kosztu",
    fields: [
      { path: "term", label: "nazwa" },
      { path: "what", label: "co umożliwia" },
    ],
  },
  {
    kind: "field",
    path: "costs.current.labelAhead",
    label: "Bieżąca praca · etykieta (przed koncertem)",
    note: "Printed while the chosen concert is still ahead. The concert's own facts come from the corpus.",
  },
  {
    kind: "field",
    path: "costs.current.labelPast",
    label: "Bieżąca praca · etykieta (po koncercie)",
    note: "Printed after the evening — same concert, past tense. The page never picks a newer one by itself.",
  },
  { kind: "field", path: "costs.current.programLink", label: "Bieżąca praca · odnośnik", note: "Keep the trailing arrow." },
  { kind: "field", path: "costs.current.note", label: "Bieżąca praca · nota" },

  // ── Dorobek ───────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "record.eyebrow", label: "Dorobek · rubryka", note: "The vernacular of `Opera`." },
  { kind: "field", path: "record.h2", label: "Dorobek · nagłówek" },
  { kind: "field", path: "record.intro", label: "Dorobek · wprowadzenie" },
  { kind: "field", path: "record.allLink", label: "Dorobek · odnośnik do koncertów", note: "Keep the trailing arrow." },

  // ── Wsparcie ──────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "support.eyebrow", label: "Wsparcie · rubryka", note: "The vernacular of `Auxilium`." },
  { kind: "field", path: "support.h2", label: "Wsparcie · nagłówek" },
  { kind: "field", path: "support.intro", label: "Wsparcie · wprowadzenie" },
  { kind: "field", path: "support.monthly.label", label: "Co miesiąc · etykieta" },
  { kind: "field", path: "support.monthly.body", label: "Co miesiąc · akapit" },
  {
    kind: "field",
    path: "support.monthly.amounts",
    label: "Co miesiąc · przykłady kwot",
    note: "`{amounts}` is the one slot: the example sums, formatted per locale at render. Keep it.",
  },
  { kind: "field", path: "support.monthly.transferLink", label: "Co miesiąc · odnośnik do przelewu" },
  { kind: "field", path: "support.once.label", label: "Jednorazowo · etykieta" },
  { kind: "field", path: "support.once.body", label: "Jednorazowo · akapit" },
  { kind: "field", path: "support.once.vaultAction", label: "Jednorazowo · przycisk wpłaty online" },
  { kind: "field", path: "support.once.transferLink", label: "Jednorazowo · odnośnik do przelewu" },

  // ── Przelew ───────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "transfer.h3", label: "Przelew · nagłówek" },
  { kind: "field", path: "transfer.recipientLabel", label: "Przelew · etykieta odbiorcy" },
  { kind: "field", path: "transfer.accountLabel", label: "Przelew · etykieta konta" },
  { kind: "field", path: "transfer.eurLabel", label: "Przelew · etykieta konta EUR" },
  { kind: "field", path: "transfer.eurNote", label: "Przelew · nota do konta EUR" },
  {
    kind: "field",
    path: "transfer.titleLabel",
    label: "Przelew · etykieta tytułu",
    note: "The label only. The transfer title itself stays Polish in every locale — it is what the foundation books the money under.",
  },
  { kind: "field", path: "transfer.standingOrderHint", label: "Przelew · podpowiedź o zleceniu stałym" },
  { kind: "field", path: "transfer.scope", label: "Przelew · przeznaczenie darowizn" },

  // ── Zgłoszenie ────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "join.h3", label: "Zgłoszenie · nagłówek" },
  { kind: "field", path: "join.body", label: "Zgłoszenie · akapit" },
  {
    kind: "field",
    path: "join.consentHtml",
    label: "Zgłoszenie · klauzula zgody",
    note: "A consent clause: name the three data points and the purpose exactly. The link's path is localized at render.",
  },
  { kind: "field", path: "join.successTitle", label: "Zgłoszenie · potwierdzenie, tytuł" },
  { kind: "field", path: "join.successBody", label: "Zgłoszenie · potwierdzenie, treść" },
  {
    kind: "field",
    path: "join.contactLead",
    label: "Zgłoszenie · przed adresem",
    note: "The patronage address follows as a link, so the fragment has to end pointing at it.",
  },

  // ── Partnerstwo ───────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "partnership.eyebrow", label: "Partnerstwo · rubryka", note: "The vernacular of `Societas`." },
  { kind: "field", path: "partnership.h2", label: "Partnerstwo · nagłówek" },
  { kind: "field", path: "partnership.intro", label: "Partnerstwo · wprowadzenie" },
  {
    kind: "list",
    path: "partnership.rows",
    keyBy: "id",
    label: "Forma współpracy",
    fields: [
      { path: "term", label: "nazwa" },
      { path: "what", label: "o czym można rozmawiać" },
    ],
  },
  { kind: "field", path: "partnership.next", label: "Partnerstwo · następny krok" },
  { kind: "field", path: "partnership.thanks", label: "Partnerstwo · podziękowania" },
  { kind: "field", path: "partnership.mailLabel", label: "Partnerstwo · etykieta adresu" },
  {
    kind: "field",
    path: "partnership.mailSubject",
    label: "Partnerstwo · temat wiadomości",
    note: "Prefilled into the reader's mail client. Only the foundation's name stays.",
  },
  { kind: "field", path: "partnership.bookingLead", label: "Partnerstwo · pytanie o zaproszenie" },
  { kind: "field", path: "partnership.bookingLink", label: "Partnerstwo · odnośnik do adresu koncertowego", note: "Keep the trailing arrow." },
  { kind: "field", path: "partnership.bookingSubject", label: "Partnerstwo · temat zaproszenia" },

  // ── Fundacja i dokumenty ──────────────────────────────────────────────────────────────────
  { kind: "field", path: "who.eyebrow", label: "Fundacja · rubryka", note: "The vernacular of `Fundatio`." },
  { kind: "field", path: "who.h2", label: "Fundacja · nagłówek" },
  { kind: "field", path: "who.relation", label: "Fundacja · relacja zespół–fundacja" },
  { kind: "field", path: "who.boardLabel", label: "Fundacja · etykieta zarządu" },
  { kind: "field", path: "who.boardNote", label: "Fundacja · nota o zarządzie" },
  { kind: "field", path: "who.identityLabel", label: "Fundacja · etykieta danych" },
  { kind: "field", path: "who.documentsLabel", label: "Fundacja · etykieta dokumentów" },
  { kind: "field", path: "who.statuteLink", label: "Dokumenty · statut" },
  { kind: "field", path: "who.privacyLink", label: "Dokumenty · polityka prywatności" },
  { kind: "field", path: "who.termsLink", label: "Dokumenty · regulamin darowizn" },
  { kind: "field", path: "who.help.label", label: "Pomoc · etykieta" },
  {
    kind: "list",
    path: "who.help.items",
    keyBy: "id",
    label: "Pytanie",
    fields: [
      { path: "q", label: "pytanie" },
      { path: "a", label: "odpowiedź" },
    ],
  },
  { kind: "field", path: "who.contactLabel", label: "Fundacja · etykieta kontaktu" },
];

/** Everything else in `fundacja.yaml`, with the reason it is not text a reader is meant to read. */
const FOUNDATION_NOT_COPY: Readonly<Record<string, string>> = {
  "hero.index[].id": "identity — the desk's key part for this entry",
  "hero.index[].anchor": "a fragment id, shared by every locale and by the /mecenat redirect",
  "costs.items[].id": "identity — the desk's key part for this entry",
  "partnership.rows[].id": "identity — the desk's key part for this entry",
  "who.help.items[].id": "identity — the desk's key part for this entry",
};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const FUNDACJA_PAGE: PageCopySpec<FoundationCopy> = {
  id: "fundacja",
  label: "Fundacja i wsparcie",
  schema: foundationCopySchema,
  contract: FOUNDATION_CONTRACT,
  notCopy: FOUNDATION_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

/** The interest form's labels and refusals — complete in every locale, or the page is broken for
    somebody. Prose around the form (its heading, the consent, the receipt) is copy. */
export interface PatronFormChrome {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly submit: string;
  readonly sending: string;
  readonly errorRequired: string;
  readonly errorEmail: string;
  readonly errorConsent: string;
  /** Followed by the patronage address as a link. */
  readonly errorNetwork: string;
  readonly noscript: string;
}

export interface FoundationChrome {
  /** Landmark names — they name the section rather than repeat its heading. */
  readonly heroAria: string;
  readonly indexAria: string;
  readonly costsAria: string;
  readonly recordAria: string;
  readonly supportAria: string;
  readonly transferAria: string;
  readonly partnershipAria: string;
  readonly whoAria: string;
  /** The copy-to-clipboard affordance, resting and flashed. */
  readonly copy: string;
  readonly copied: string;
  /** Accessible name of a copy button. `{what}` is the field's own label, already localized. */
  readonly copyAria: string;
  /** Admission, as the corpus states it. */
  readonly admissionFree: string;
  readonly admissionPaid: string;
  readonly form: PatronFormChrome;
}

export const FOUNDATION_CHROME: Record<Locale, FoundationChrome> = {
  pl: {
    heroAria: "Fundacja i wsparcie",
    indexAria: "Sekcje strony",
    costsAria: "Na co idą środki",
    recordAria: "Dorobek zespołu",
    supportAria: "Wsparcie indywidualne",
    transferAria: "Dane do przelewu",
    partnershipAria: "Firmy i instytucje",
    whoAria: "Fundacja i dokumenty",
    copy: "Kopiuj",
    copied: "Skopiowano",
    copyAria: "Skopiuj: {what}",
    admissionFree: "wstęp wolny",
    admissionPaid: "bilety",
    form: {
      firstName: "Imię",
      lastName: "Nazwisko",
      email: "Adres e-mail",
      submit: "Wyślij zgłoszenie",
      sending: "Wysyłanie…",
      errorRequired: "Uzupełnij imię, nazwisko i adres e-mail.",
      errorEmail: "Sprawdź adres e-mail.",
      errorConsent: "Potrzebujemy Twojej zgody, żeby się odezwać.",
      errorNetwork: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie albo napisz na",
      noscript: "Formularz wymaga JavaScriptu. Możesz też po prostu napisać na adres patronatu.",
    },
  },
  en: {
    heroAria: "Foundation and support",
    indexAria: "Sections of this page",
    costsAria: "What the money goes to",
    recordAria: "The ensemble's record",
    supportAria: "Individual support",
    transferAria: "Bank transfer details",
    partnershipAria: "Companies and institutions",
    whoAria: "The foundation and its documents",
    copy: "Copy",
    copied: "Copied",
    copyAria: "Copy: {what}",
    admissionFree: "free admission",
    admissionPaid: "ticketed",
    form: {
      firstName: "First name",
      lastName: "Last name",
      email: "E-mail address",
      submit: "Send",
      sending: "Sending…",
      errorRequired: "Please fill in your first name, last name and e-mail address.",
      errorEmail: "Please check the e-mail address.",
      errorConsent: "We need your consent to get in touch.",
      errorNetwork: "The form could not be sent. Try again, or write to",
      noscript: "The form needs JavaScript. You can simply write to the patronage address instead.",
    },
  },
  fr: {
    heroAria: "Fondation et soutien",
    indexAria: "Sections de cette page",
    costsAria: "À quoi servent les fonds",
    recordAria: "Le parcours de l'ensemble",
    supportAria: "Soutien individuel",
    transferAria: "Coordonnées bancaires",
    partnershipAria: "Entreprises et institutions",
    whoAria: "La fondation et ses documents",
    copy: "Copier",
    copied: "Copié",
    copyAria: "Copier : {what}",
    admissionFree: "entrée libre",
    admissionPaid: "billetterie",
    form: {
      firstName: "Prénom",
      lastName: "Nom",
      email: "Adresse e-mail",
      submit: "Envoyer",
      sending: "Envoi…",
      errorRequired: "Merci d'indiquer votre prénom, votre nom et votre adresse e-mail.",
      errorEmail: "Merci de vérifier l'adresse e-mail.",
      errorConsent: "Nous avons besoin de votre accord pour vous recontacter.",
      errorNetwork: "Le formulaire n'a pas pu être envoyé. Réessayez, ou écrivez à",
      noscript: "Le formulaire nécessite JavaScript. Vous pouvez aussi écrire directement à l'adresse du mécénat.",
    },
  },
};
