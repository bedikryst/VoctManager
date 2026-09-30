/**
 * @file fundacja.ts
 * @description Everything about /fundacja except its words: the shape its Polish prose must have
 *  (zod, `.strict()`), the copy desk's key contract over that prose, and the page's chrome in all
 *  three locales. Same division as `kontakt.ts`: prose in `src/content/pages/fundacja.yaml` with
 *  per-field overlays, chrome here where a `Record<Locale, …>` makes the compiler demand every
 *  locale. The realisation module's labels are part of this page's prose and /mecenat reads them
 *  from here.
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

const supporterModule = {
  label: z.string(),
  quote: z.string(),
  body: z.string(),
};

const foundationCopySchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    hero: z
      .object({
        eyebrow: z.string(),
        title1: z.string(),
        title2Html: z.string(),
        lead: z.string(),
        supportLink: z.string(),
        mecenatLink: z.string(),
      })
      .strict(),
    index: z
      .object({
        label: z.string(),
        items: z
          .array(z.object({ id: z.string(), anchor: z.string(), label: z.string() }).strict())
          .length(5),
      })
      .strict(),
    realisation: z
      .object({
        leads: z.array(z.object({ id: z.string(), text: z.string() }).strict()).min(1),
        sheet: z
          .object({
            when: z.string(),
            where: z.string(),
            performers: z.string(),
            programme: z.string(),
            within: z.string(),
            admission: z.string(),
            budget: z.string(),
          })
          .strict(),
        festival: z.string(),
        admissionFree: z.string(),
        admissionPaid: z.string(),
        budgetAmount: z.string(),
        budgetAsOf: z.string(),
        budgetNote: z.string(),
        whoPaysAhead: z.string(),
        whoPaysPast: z.string(),
        account: z
          .object({
            heading: z.string(),
            total: z.string(),
            patrons: z.string(),
            donors: z.string(),
            partners: z.string(),
            grants: z.string(),
            own: z.string(),
            note: z.string(),
          })
          .strict(),
        concertLink: z.string(),
        supportLink: z.string(),
      })
      .strict(),
    record: z
      .object({
        h2: z.string(),
        body: z.string(),
        statProgrammes: z.string(),
        statConcerts: z.string(),
        statFree: z.string(),
        photoCaption: z.string(),
        allLink: z.string(),
      })
      .strict(),
    mission: z
      .object({
        motto: z.string(),
        body: z.string(),
        boardLabel: z.string(),
        president: z.string(),
        vicePresident: z.string(),
        aboutLink: z.string(),
      })
      .strict(),
    support: z
      .object({
        h2: z.string(),
        donation: z
          .object({
            ...supporterModule,
            scale: z.string(),
            promise: z.string(),
            vaultAction: z.string(),
            transferLink: z.string(),
          })
          .strict(),
        mecenat: z.object({ ...supporterModule, link: z.string() }).strict(),
        partnership: z
          .object({
            ...supporterModule,
            mailLink: z.string(),
            mailSubject: z.string(),
            pressLink: z.string(),
            bookingLink: z.string(),
            bookingSubject: z.string(),
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
        titleLabel: z.string(),
        standingOrderHint: z.string(),
        scope: z.string(),
        tax: z.string(),
      })
      .strict(),
    join: z
      .object({
        summary: z.string(),
        note: z.string(),
        supportConsentHtml: z.string(),
        successTitle: z.string(),
        successBody: z.string(),
      })
      .strict(),
    registry: z
      .object({
        h2: z.string(),
        name: z.string(),
        seat: z.string(),
        founded: z.string(),
        supervisionLabel: z.string(),
        supervision: z.string(),
        representationLabel: z.string(),
        representation: z.string(),
        relation: z.string(),
        goalsLabel: z.string(),
        documentsLabel: z.string(),
        statuteLink: z.string(),
        privacyLink: z.string(),
        termsLink: z.string(),
        pressLink: z.string(),
        reports: z.string(),
        socialLead: z.string(),
        contactLead: z.string(),
      })
      .strict(),
  })
  .strict();

export type FoundationCopy = z.infer<typeof foundationCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

const ARROW = "Keep the trailing arrow.";

/** DECLARATION ORDER IS READING ORDER — the desk renders the page hero to coda from this list. */
const FOUNDATION_CONTRACT: readonly CopyEntry[] = [
  // ── Metadane ──────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "meta.title",
    label: "Metadane · tytuł strony",
    note: "Read in a search result and a browser tab. Keep both names: the foundation first, the ensemble after.",
  },
  { kind: "field", path: "meta.description", label: "Metadane · opis strony" },

  // ── Hero ──────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "hero.eyebrow", label: "Hero · nazwa" },
  {
    kind: "field",
    path: "hero.title1",
    label: "Hero · tytuł, wers 1",
    note: "Two lines, and the break is compositional: split where the target language wants it.",
  },
  { kind: "field", path: "hero.title2Html", label: "Hero · tytuł, wers 2", note: "The `<em>` phrase is set in the page accent." },
  { kind: "field", path: "hero.lead", label: "Hero · lead" },
  { kind: "field", path: "hero.supportLink", label: "Hero · odnośnik do wsparcia" },
  { kind: "field", path: "hero.mecenatLink", label: "Hero · odnośnik do mecenatu" },

  // ── Spis ──────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "index.label", label: "Spis · etykieta" },
  {
    kind: "list",
    path: "index.items",
    keyBy: "id",
    label: "Sekcja",
    note: "Printed in the page index and as each section's own label on a phone.",
    fields: [{ path: "label", label: "nazwa" }],
  },

  // ── Realizacje ────────────────────────────────────────────────────────────────────────────
  {
    kind: "list",
    path: "realisation.leads",
    keyBy: "id",
    label: "Realizacja · lead",
    note: "Two sentences about the concert as the foundation's work. Title, date and place are printed from the corpus.",
    fields: [{ path: "text", label: "lead" }],
  },
  { kind: "field", path: "realisation.sheet.when", label: "Metryka · kiedy" },
  { kind: "field", path: "realisation.sheet.where", label: "Metryka · gdzie" },
  { kind: "field", path: "realisation.sheet.performers", label: "Metryka · wykonawcy" },
  { kind: "field", path: "realisation.sheet.programme", label: "Metryka · program" },
  { kind: "field", path: "realisation.sheet.within", label: "Metryka · w ramach" },
  { kind: "field", path: "realisation.sheet.admission", label: "Metryka · wstęp" },
  { kind: "field", path: "realisation.sheet.budget", label: "Metryka · budżet" },
  { kind: "field", path: "realisation.festival", label: "Metryka · festiwal", note: "`{name}` is the festival's own name. Keep the slot." },
  { kind: "field", path: "realisation.admissionFree", label: "Metryka · wstęp wolny", note: "The value beside the label, not a sentence." },
  { kind: "field", path: "realisation.admissionPaid", label: "Metryka · wstęp płatny" },
  {
    kind: "field",
    path: "realisation.budgetAmount",
    label: "Metryka · kwota budżetu",
    note: "`{amount}` is formatted per locale. The currency stays złoty; keep the approximation.",
  },
  { kind: "field", path: "realisation.budgetAsOf", label: "Metryka · data budżetu", note: "`{date}` is the day the board confirmed the amount." },
  { kind: "field", path: "realisation.budgetNote", label: "Realizacja · co obejmuje budżet" },
  { kind: "field", path: "realisation.whoPaysAhead", label: "Realizacja · kto płaci (przed koncertem)" },
  { kind: "field", path: "realisation.whoPaysPast", label: "Realizacja · kto płaci (po koncercie)" },
  { kind: "field", path: "realisation.account.heading", label: "Rozliczenie · nagłówek" },
  { kind: "field", path: "realisation.account.total", label: "Rozliczenie · koszt koncertu" },
  { kind: "field", path: "realisation.account.patrons", label: "Rozliczenie · mecenasi" },
  { kind: "field", path: "realisation.account.donors", label: "Rozliczenie · darczyńcy" },
  { kind: "field", path: "realisation.account.partners", label: "Rozliczenie · partnerzy" },
  { kind: "field", path: "realisation.account.grants", label: "Rozliczenie · granty" },
  { kind: "field", path: "realisation.account.own", label: "Rozliczenie · wkład własny" },
  { kind: "field", path: "realisation.account.note", label: "Rozliczenie · nota", note: "`{date}` is the date of the figures." },
  { kind: "field", path: "realisation.concertLink", label: "Realizacja · odnośnik do koncertu", note: ARROW },
  { kind: "field", path: "realisation.supportLink", label: "Realizacja · wsparcie koncertu" },

  // ── Doświadczenie ─────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "record.h2", label: "Doświadczenie · nagłówek" },
  { kind: "field", path: "record.body", label: "Doświadczenie · akapit" },
  {
    kind: "field",
    path: "record.statProgrammes",
    label: "Doświadczenie · liczba programów",
    note: "Follows a number counted from the corpus (5). Match the noun to it.",
  },
  { kind: "field", path: "record.statConcerts", label: "Doświadczenie · liczba koncertów", note: "Follows a number (8)." },
  { kind: "field", path: "record.statFree", label: "Doświadczenie · z wolnym wstępem", note: "Follows a number (7)." },
  { kind: "field", path: "record.photoCaption", label: "Doświadczenie · podpis zdjęcia" },
  { kind: "field", path: "record.allLink", label: "Doświadczenie · odnośnik do koncertów", note: ARROW },

  // ── Misja i ludzie ────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "mission.motto", label: "Misja · motto" },
  { kind: "field", path: "mission.body", label: "Misja · akapit" },
  { kind: "field", path: "mission.boardLabel", label: "Zarząd · etykieta" },
  { kind: "field", path: "mission.president", label: "Zarząd · prezes", note: "The KRS function, lower case." },
  {
    kind: "field",
    path: "mission.vicePresident",
    label: "Zarząd · wiceprezes",
    note: "One word printed under a woman's and a man's name alike. Where the language genders the person, name the office instead (FR « vice-présidence du conseil »).",
  },
  { kind: "field", path: "mission.aboutLink", label: "Zarząd · odnośnik do /o-nas", note: ARROW },

  // ── Wsparcie ──────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "support.h2", label: "Wsparcie · nagłówek" },
  { kind: "field", path: "support.donation.label", label: "Darowizna · nazwa" },
  { kind: "field", path: "support.donation.quote", label: "Darowizna · cytat", note: "A supporter's own words, with the locale's quotation marks." },
  { kind: "field", path: "support.donation.body", label: "Darowizna · akapit" },
  {
    kind: "field",
    path: "support.donation.scale",
    label: "Darowizna · skala budżetu",
    note: "`{people}` is computed (24), `{monthly}` is the example sum (100). Keep both slots.",
  },
  { kind: "field", path: "support.donation.promise", label: "Darowizna · rozliczenie" },
  { kind: "field", path: "support.donation.vaultAction", label: "Darowizna · wpłata online" },
  { kind: "field", path: "support.donation.transferLink", label: "Darowizna · dane do przelewu" },
  { kind: "field", path: "support.mecenat.label", label: "Mecenat · nazwa" },
  { kind: "field", path: "support.mecenat.quote", label: "Mecenat · cytat" },
  { kind: "field", path: "support.mecenat.body", label: "Mecenat · akapit" },
  { kind: "field", path: "support.mecenat.link", label: "Mecenat · odnośnik", note: ARROW },
  { kind: "field", path: "support.partnership.label", label: "Partnerstwo · nazwa" },
  { kind: "field", path: "support.partnership.quote", label: "Partnerstwo · cytat" },
  { kind: "field", path: "support.partnership.body", label: "Partnerstwo · akapit" },
  { kind: "field", path: "support.partnership.mailLink", label: "Partnerstwo · napisz" },
  {
    kind: "field",
    path: "support.partnership.mailSubject",
    label: "Partnerstwo · temat wiadomości",
    note: "Prefilled into the reader's mail client. Only the foundation's name stays.",
  },
  { kind: "field", path: "support.partnership.pressLink", label: "Partnerstwo · materiały dla mediów" },
  { kind: "field", path: "support.partnership.bookingLink", label: "Partnerstwo · zaproszenie zespołu" },
  { kind: "field", path: "support.partnership.bookingSubject", label: "Partnerstwo · temat zaproszenia" },

  // ── Przelew ───────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "transfer.h3", label: "Przelew · nagłówek" },
  { kind: "field", path: "transfer.recipientLabel", label: "Przelew · odbiorca" },
  { kind: "field", path: "transfer.accountLabel", label: "Przelew · numer konta" },
  { kind: "field", path: "transfer.eurLabel", label: "Przelew · konto w euro" },
  {
    kind: "field",
    path: "transfer.titleLabel",
    label: "Przelew · etykieta tytułu",
    note: "The label only. The transfer title itself stays Polish in every locale — it is what the foundation books the money under.",
  },
  { kind: "field", path: "transfer.standingOrderHint", label: "Przelew · zlecenie stałe" },
  { kind: "field", path: "transfer.scope", label: "Przelew · przeznaczenie darowizn" },
  {
    kind: "field",
    path: "transfer.tax",
    label: "Przelew · ulga podatkowa",
    note: "Not printed until the accountant confirms it. Polish tax law; translate, do not adapt.",
  },

  // ── Zgłoszenie ────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "join.summary", label: "Zgłoszenie · rozwijany nagłówek" },
  { kind: "field", path: "join.note", label: "Zgłoszenie · akapit" },
  {
    kind: "field",
    path: "join.supportConsentHtml",
    label: "Zgłoszenie · klauzula zgody",
    note: "A consent clause: name the three data points and the purpose exactly. The link's path is localized at render.",
  },
  { kind: "field", path: "join.successTitle", label: "Zgłoszenie · potwierdzenie, tytuł" },
  { kind: "field", path: "join.successBody", label: "Zgłoszenie · potwierdzenie, treść" },

  // ── Dane i dokumenty ──────────────────────────────────────────────────────────────────────
  { kind: "field", path: "registry.h2", label: "Dane · nagłówek" },
  { kind: "field", path: "registry.name", label: "Dane · nazwa" },
  { kind: "field", path: "registry.seat", label: "Dane · siedziba" },
  { kind: "field", path: "registry.founded", label: "Dane · data ustanowienia" },
  { kind: "field", path: "registry.supervisionLabel", label: "Dane · nadzór, etykieta" },
  { kind: "field", path: "registry.supervision", label: "Dane · nadzór" },
  { kind: "field", path: "registry.representationLabel", label: "Dane · reprezentacja, etykieta" },
  { kind: "field", path: "registry.representation", label: "Dane · reprezentacja", note: "Cites the statute; keep the paragraph number." },
  { kind: "field", path: "registry.relation", label: "Dane · zespół i fundacja" },
  { kind: "field", path: "registry.goalsLabel", label: "Dane · cele statutowe" },
  { kind: "field", path: "registry.documentsLabel", label: "Dokumenty · etykieta" },
  { kind: "field", path: "registry.statuteLink", label: "Dokumenty · statut" },
  { kind: "field", path: "registry.privacyLink", label: "Dokumenty · polityka prywatności" },
  { kind: "field", path: "registry.termsLink", label: "Dokumenty · regulamin darowizn" },
  { kind: "field", path: "registry.pressLink", label: "Dokumenty · materiały dla mediów" },
  { kind: "field", path: "registry.reports", label: "Dokumenty · sprawozdania", note: "`{year}` and `{approvalYear}` are computed. Keep both slots." },
  { kind: "field", path: "registry.socialLead", label: "Dane · media społecznościowe" },
  { kind: "field", path: "registry.contactLead", label: "Dane · kontakt", note: "Followed by the foundation's address as a link." },
];

/** Everything else in `fundacja.yaml`, with the reason it is not text a reader is meant to read. */
const FOUNDATION_NOT_COPY: Readonly<Record<string, string>> = {
  "index.items[].id": "identity — the desk's key part for this entry",
  "index.items[].anchor": "a fragment id, shared by every locale and by other pages' links",
  "realisation.leads[].id": "identity — the realisation's id in data/foundationSupport.ts",
};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const FUNDACJA_PAGE: PageCopySpec<FoundationCopy> = {
  id: "fundacja",
  label: "Fundacja",
  schema: foundationCopySchema,
  contract: FOUNDATION_CONTRACT,
  notCopy: FOUNDATION_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

/** The interest form's labels and refusals — complete in every locale, or the page is broken for
    somebody. Prose around the form (its summary, the consent, the receipt) is copy. */
export interface PatronFormChrome {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly submit: string;
  readonly sending: string;
  readonly errorRequired: string;
  readonly errorEmail: string;
  readonly errorConsent: string;
  /** Followed by the foundation's address as a link. */
  readonly errorNetwork: string;
  readonly noscript: string;
}

export interface FoundationChrome {
  /** Landmark names — they name the section rather than repeat its heading. */
  readonly indexAria: string;
  readonly realisationsAria: string;
  readonly recordAria: string;
  readonly missionAria: string;
  readonly supportAria: string;
  readonly transferAria: string;
  readonly registryAria: string;
  /** The copy-to-clipboard affordance, resting and flashed. */
  readonly copy: string;
  readonly copied: string;
  /** Accessible name of a copy button. `{what}` is the field's own label, already localized. */
  readonly copyAria: string;
  readonly form: PatronFormChrome;
}

export const FOUNDATION_CHROME: Record<Locale, FoundationChrome> = {
  pl: {
    indexAria: "Sekcje strony",
    realisationsAria: "Realizacje fundacji",
    recordAria: "Doświadczenie VoctEnsemble",
    missionAria: "Misja i zarząd",
    supportAria: "Wsparcie",
    transferAria: "Dane do przelewu",
    registryAria: "Dane i dokumenty fundacji",
    copy: "Kopiuj",
    copied: "Skopiowano",
    copyAria: "Skopiuj: {what}",
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
      noscript: "Formularz wymaga JavaScriptu. Możesz też po prostu napisać do fundacji.",
    },
  },
  en: {
    indexAria: "Sections of this page",
    realisationsAria: "The foundation's productions",
    recordAria: "VoctEnsemble's record",
    missionAria: "Mission and board",
    supportAria: "Support",
    transferAria: "Bank transfer details",
    registryAria: "The foundation's details and documents",
    copy: "Copy",
    copied: "Copied",
    copyAria: "Copy: {what}",
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
      noscript: "The form needs JavaScript. You can simply write to the foundation instead.",
    },
  },
  fr: {
    indexAria: "Sections de cette page",
    realisationsAria: "Les réalisations de la fondation",
    recordAria: "Le parcours de VoctEnsemble",
    missionAria: "Mission et conseil d'administration",
    supportAria: "Soutien",
    transferAria: "Coordonnées bancaires",
    registryAria: "Coordonnées et documents de la fondation",
    copy: "Copier",
    copied: "Copié",
    copyAria: "Copier : {what}",
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
      noscript: "Le formulaire nécessite JavaScript. Vous pouvez aussi écrire directement à la fondation.",
    },
  },
};
