/**
 * @file press.ts
 * @description Everything about /press except its words: the shape its Polish prose must have
 *  (zod, `.strict()`), the copy desk's key contract over that prose, and the page's chrome in all
 *  three locales.
 *
 *  THE PAGE IS A COUNTER, NOT AN ARGUMENT. Its reader has already decided to write about the
 *  ensemble and now needs a text, a photograph and a poster before a deadline. So the prose below
 *  is short on purpose: a head, a rubric and a lede per section, the usage terms, the biograms.
 *
 *  FOUR THINGS ON THIS PAGE ARE NOT COPY HERE AND MUST NOT DRIFT INTO IT:
 *
 *  - the concert kit's texts (release, announcements, post, hashtags) → `src/content/press-kits/`,
 *    read through `lib/pressKit`, because the page's Kopiuj and the pack's files must write the
 *    same characters and the limits are measured on them;
 *  - the concert's facts → `concerts.yaml`, through `concertFacts`;
 *  - the registry numbers, the accounts and the addresses → `src/data/foundation.ts`, and the
 *    social handles → `src/data/social.ts`: a number or a handle has no per-locale form;
 *  - every size, count and dimension → measured at build, from the texts or from the pack's
 *    `index.json`.
 *
 *  NOT YET IN `TRANSLATED_ROUTES`, deliberately. The page is on the desk so its Polish can be
 *  edited, but there are no `/en/press` and `/fr/press` routes: translating prose that is being
 *  rewritten this week buys a translation of a draft.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor and the press-pack
 *  generator read it straight from here. Keep it free of `?raw`, `astro:assets` and anything a
 *  bundler must resolve, and keep every cross-module import `import type`.
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
        title: z.string(),
        titleEm: z.string(),
        lede: z.string(),
        downloadLabel: z.string(),
        requestLede: z.string(),
        requestLabel: z.string(),
        nav: z
          .object({
            latest: z.string(),
            photos: z.string(),
            social: z.string(),
            about: z.string(),
            contact: z.string(),
          })
          .strict(),
      })
      .strict(),
    latest: z
      .object({
        eyebrow: z.string(),
        filesEyebrow: z.string(),
        release: z.string(),
        announce: z.string(),
        announceShortSub: z.string(),
        announceLongSub: z.string(),
        programme: z.string(),
        programmeSub: z.string(),
        biograms: z.string(),
        poster: z.string(),
        posterPrint: z.string(),
        posterPrintSub: z.string(),
      })
      .strict(),
    photos: z
      .object({
        eyebrow: z.string(),
        lede: z.string(),
        landscape: z.string(),
        landscapeUse: z.string(),
        portrait: z.string(),
        portraitUse: z.string(),
        downloadAll: z.string(),
        usage: z.string(),
      })
      .strict(),
    social: z
      .object({
        eyebrow: z.string(),
        lede: z.string(),
        post: z.string(),
        postSub: z.string(),
        hashtags: z.string(),
        graphics: z.string(),
        graphic4x5: z.string(),
        graphic9x16: z.string(),
        graphic16x9: z.string(),
        tag: z.string(),
        tagLede: z.string(),
      })
      .strict(),
    about: z
      .object({
        eyebrow: z.string(),
        lede: z.string(),
        shortHtml: z.string(),
        mediumHtml: z.string(),
        longHtml: z.string(),
        logo: z.string(),
        logoUsage: z.string(),
      })
      .strict(),
    foundation: z.object({ eyebrow: z.string(), lede: z.string() }).strict(),
    contact: z
      .object({
        eyebrow: z.string(),
        lede: z.string(),
        broadcastTitle: z.string(),
        broadcastBody: z.string(),
        broadcastCta: z.string(),
      })
      .strict(),
  })
  .strict();

export type PressCopy = z.infer<typeof pressCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/**
 * DECLARATION ORDER IS READING ORDER — head to contact, because `order` is a counter over this
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
  { kind: "field", path: "meta.description", label: "Metadane · opis strony" },

  // ── Głowica ───────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "head.title",
    label: "Głowica · tytuł",
    note: "\"Press\" is the page's name in every locale, as it is on the sketch the board sent.",
  },
  {
    kind: "field",
    path: "head.titleEm",
    label: "Głowica · podtytuł",
    note: "Set in italic gold under the title: what the page holds, in the reader's own words.",
  },
  { kind: "field", path: "head.lede", label: "Głowica · lede" },
  {
    kind: "field",
    path: "head.downloadLabel",
    label: "Głowica · przycisk (pobierz komplet)",
    note: "The format and the size are printed after it from the pack's own index — never write them here.",
  },
  {
    kind: "field",
    path: "head.requestLede",
    label: "Głowica · lede (pliki niedostępne)",
    note: "Printed only on a host without the built pack. It must promise no date.",
  },
  { kind: "field", path: "head.requestLabel", label: "Głowica · przycisk (napisz)" },
  { kind: "field", path: "head.nav.latest", label: "Głowica · spis · najnowsze" },
  { kind: "field", path: "head.nav.photos", label: "Głowica · spis · zdjęcia" },
  { kind: "field", path: "head.nav.social", label: "Głowica · spis · social media" },
  { kind: "field", path: "head.nav.about", label: "Głowica · spis · o zespole" },
  { kind: "field", path: "head.nav.contact", label: "Głowica · spis · kontakt" },

  // ── Najnowsze ─────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "latest.eyebrow",
    label: "Najnowsze · rubryka",
    note: "Stands over the card of the soonest concert that has a press kit. The concert's facts under it come from the corpus.",
  },
  { kind: "field", path: "latest.filesEyebrow", label: "Najnowsze · rubryka materiałów" },
  {
    kind: "field",
    path: "latest.release",
    label: "Najnowsze · plik · informacja prasowa",
    note: "The release's own headline is printed under it, from the kit.",
  },
  {
    kind: "field",
    path: "latest.announce",
    label: "Najnowsze · plik · zapowiedź",
    note: "Named twice, once per measure; the measure (\"do 500 znaków\") and the measured length are printed beside it.",
  },
  { kind: "field", path: "latest.announceShortSub", label: "Najnowsze · zapowiedź krótka · opis" },
  { kind: "field", path: "latest.announceLongSub", label: "Najnowsze · zapowiedź długa · opis" },
  { kind: "field", path: "latest.programme", label: "Najnowsze · plik · program" },
  { kind: "field", path: "latest.programmeSub", label: "Najnowsze · program · opis" },
  {
    kind: "field",
    path: "latest.biograms",
    label: "Najnowsze · plik · biogramy",
    note: "The names under it are the biograms the PDF holds, read at build.",
  },
  { kind: "field", path: "latest.poster", label: "Najnowsze · plik · plakat" },
  { kind: "field", path: "latest.posterPrint", label: "Najnowsze · plik · plakat do druku" },
  { kind: "field", path: "latest.posterPrintSub", label: "Najnowsze · plakat do druku · opis" },

  // ── Zdjęcia ───────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "photos.eyebrow", label: "Zdjęcia · rubryka" },
  {
    kind: "field",
    path: "photos.lede",
    label: "Zdjęcia · lede (zasady w skrócie)",
    note: "The usage terms where the choice is made. It must agree with `photos.usage`, which is the full text in the pack; both are a legal statement the board approves.",
  },
  { kind: "field", path: "photos.landscape", label: "Zdjęcia · grupa pozioma" },
  { kind: "field", path: "photos.landscapeUse", label: "Zdjęcia · grupa pozioma · do czego" },
  { kind: "field", path: "photos.portrait", label: "Zdjęcia · grupa pionowa" },
  { kind: "field", path: "photos.portraitUse", label: "Zdjęcia · grupa pionowa · do czego" },
  { kind: "field", path: "photos.downloadAll", label: "Zdjęcia · przycisk (wszystkie)" },
  {
    kind: "field",
    path: "photos.usage",
    label: "Zdjęcia · zasady użycia (w paczce)",
    note: "Printed INSIDE the pack, in PRZECZYTAJ.txt above every photo's credit, never on the page. It is the permission an organiser acts on: it must allow cropping and scaling and stay specific about what is not allowed.",
  },

  // ── Social media ──────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "social.eyebrow", label: "Social media · rubryka" },
  { kind: "field", path: "social.lede", label: "Social media · lede" },
  { kind: "field", path: "social.post", label: "Social media · post · tytuł" },
  {
    kind: "field",
    path: "social.postSub",
    label: "Social media · post · opis",
    note: "The post itself is the kit's; `postText` appends the concert page's address, which is what this line promises.",
  },
  { kind: "field", path: "social.hashtags", label: "Social media · hashtagi · tytuł" },
  { kind: "field", path: "social.graphics", label: "Social media · grafiki · tytuł" },
  { kind: "field", path: "social.graphic4x5", label: "Social media · grafika 4:5 · do czego" },
  { kind: "field", path: "social.graphic9x16", label: "Social media · grafika 9:16 · do czego" },
  { kind: "field", path: "social.graphic16x9", label: "Social media · grafika 16:9 · do czego" },
  { kind: "field", path: "social.tag", label: "Social media · oznacz nas · tytuł" },
  { kind: "field", path: "social.tagLede", label: "Social media · oznacz nas · lede" },

  // ── O zespole ─────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "about.eyebrow", label: "O zespole · rubryka" },
  {
    kind: "field",
    path: "about.lede",
    label: "O zespole · lede",
    note: "Do not name a character count here: the page measures each text and prints the real number beside it.",
  },
  {
    kind: "field",
    path: "about.shortHtml",
    label: "O zespole · biogram krótki",
    note: "Around 300 characters — a note in a programme, or a line under a poster. A condensation of the full biogram below and never a source of new facts. The press release also closes on it.",
  },
  {
    kind: "field",
    path: "about.mediumHtml",
    label: "O zespole · biogram średni",
    note: "Around 1000 characters — an announcement or a press note. Same rule as the short one.",
  },
  {
    kind: "field",
    path: "about.longHtml",
    label: "O zespole · biogram pełny",
    note: "The ensemble's own text, verbatim. It is ONE field rather than five paragraphs on purpose: a reviewer translating paragraph three and leaving two in Polish would produce a mixed-language biogram that somebody then pastes into a programme book.",
  },
  { kind: "field", path: "about.logo", label: "O zespole · logotyp · tytuł" },
  {
    kind: "field",
    path: "about.logoUsage",
    label: "O zespole · zasady użycia logotypu",
    note: "On the page under the logo files, and in the pack beside them (logo/UZYCIE.txt).",
  },

  // ── Fundacja ──────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "foundation.eyebrow", label: "Fundacja · rubryka" },
  {
    kind: "field",
    path: "foundation.lede",
    label: "Fundacja · lede",
    note: "Stands over the registry and account rows, which come from `data/foundation.ts`.",
  },

  // ── Kontakt ───────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "contact.eyebrow", label: "Kontakt · rubryka" },
  {
    kind: "field",
    path: "contact.lede",
    label: "Kontakt · linia przed adresem",
    note: "The address itself is printed after this line from `data/foundation.ts` — never write it into the copy.",
  },
  { kind: "field", path: "contact.broadcastTitle", label: "Kontakt · radio i TV · tytuł" },
  { kind: "field", path: "contact.broadcastBody", label: "Kontakt · radio i TV · tekst" },
  { kind: "field", path: "contact.broadcastCta", label: "Kontakt · radio i TV · przycisk" },
];

/** Everything else in `press.yaml`, with the reason it is not text a reader is meant to read. */
const PRESS_NOT_COPY: Readonly<Record<string, string>> = {};

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
  readonly jumpAria: string;
  readonly latestAria: string;
  readonly photosAria: string;
  readonly socialAria: string;
  readonly aboutAria: string;
  readonly foundationAria: string;
  readonly contactAria: string;
  /**
   * The head's right column: the press address, what komplet holds and when it was cut. The list
   * is assembled from the pack's index, one `packItems` word per kind of file present, with the
   * photographs counted (`photos`), so it cannot promise a file the archive lacks.
   */
  readonly headMail: string;
  readonly packContents: string;
  readonly packUpdated: string;
  readonly packItems: {
    readonly release: string;
    readonly programme: string;
    readonly biograms: string;
    readonly poster: string;
    readonly graphics: string;
    readonly logo: string;
  };
  readonly photos: CountForms;
  /** The concert card's one link: the concert's own page on this site. */
  readonly concertPage: string;
  /**
   * What each biogram is FOR, printed as the measure's own name. The character count beside it is
   * measured, never written.
   */
  readonly bioShort: string;
  readonly bioMedium: string;
  readonly bioLong: string;
  /** "znak / znaki / znaków", so a measured count can be printed as a phrase. */
  readonly characters: CountForms;
  /** An announcement's measure: `{count}` is the counted limit, "do 500 znaków". */
  readonly upTo: string;
  /**
   * The copy-to-clipboard affordance: resting labels, and the one it flashes after a copy. Two
   * buttons that copy different texts never share a label: the concert card copies the facts, the
   * release row copies the release, a photograph copies its caption with the credit.
   */
  readonly copy: string;
  readonly copyText: string;
  readonly copyConcert: string;
  readonly copyCaption: string;
  readonly copied: string;
  /** Accessible name of a biogram's copy button. `{measure}` is the measure's own name above. */
  readonly copyAria: string;
  /** Accessible name of any other copy button. `{field}` is what it copies. */
  readonly copyFieldAria: string;
  /** Accessible name of a photograph's caption copy. `{file}` is the caption itself. */
  readonly copyCaptionAria: string;
  /**
   * A file's two ways out: seen in the browser (a tab for a PDF, the lightbox for a picture), and
   * saved to disk. `{file}` is the file's title.
   */
  readonly preview: string;
  readonly previewAria: string;
  readonly download: string;
  readonly downloadAria: string;
  /**
   * The two states of a text's disclosure. BOTH are rendered and CSS shows one, because a label
   * that changes with `[open]` cannot be a `content` string without leaving the locale behind.
   * Only the TEXT is behind this control: the copy button stays beside it, always.
   */
  readonly expand: string;
  readonly collapse: string;
  /** Size units. French writes "Mo", and the decimal separator follows the locale. */
  readonly units: { readonly kB: string; readonly MB: string };
  /**
   * The composer (scripts/press-basket.ts). A file's checkbox is named by `selectAria` with
   * `{file}` its title; each group's toggle shows `selectAll` and is named by `selectAllAria` with
   * `{group}` its heading, because five toggles reading the same two words are five identical
   * controls to a screen reader.
   */
  readonly selectAll: string;
  readonly selectAllAria: string;
  readonly selectAria: string;
  /** The bar's landmark name. */
  readonly basketAria: string;
  /** The bar's count: `{files}` is the counted noun below, "Wybrano 3 pliki". */
  readonly basketCount: string;
  readonly files: CountForms;
  readonly basketDownload: string;
  readonly basketClear: string;
  /** While the files arrive: `{percent}` is formatted by the locale ("35%", "35 %"). */
  readonly basketPreparing: string;
  readonly basketFailed: string;
  /** The logotype's tiles: two grounds, and the gold mark (dark grounds only, see the usage note). */
  readonly logoOnLight: string;
  readonly logoOnDark: string;
  readonly logoGold: string;
  /** The invoicing sheet's download, under the rows it repeats. */
  readonly invoiceFile: string;
  /** Labels of the invoicing block — a definition list, and a missing term is a broken row. */
  readonly legalName: string;
  readonly legalAddress: string;
  readonly legalAccountPln: string;
  readonly legalAccountEur: string;
  /**
   * Subject lines of the mails this page opens. They are chrome rather than copy because a
   * reader never sees them before sending: nobody reviews a `mailto:`, and one missing in French
   * would send an untitled mail rather than a French one.
   */
  readonly mailSubjectPack: string;
  readonly mailSubjectMedia: string;
  readonly mailSubjectBroadcast: string;
}

export const PRESS_CHROME: Record<Locale, PressChrome> = {
  pl: {
    headAria: "Materiały dla mediów VoctEnsemble",
    jumpAria: "Spis sekcji",
    latestAria: "Najbliższy koncert",
    photosAria: "Zdjęcia prasowe",
    socialAria: "Materiały do mediów społecznościowych",
    aboutAria: "Biogramy i logotyp",
    foundationAria: "Dane fundacji",
    contactAria: "Kontakt dla mediów",
    headMail: "Adres dla mediów",
    packContents: "W komplecie",
    packUpdated: "Aktualizacja",
    packItems: {
      release: "informacja prasowa",
      programme: "program",
      biograms: "biogramy",
      poster: "plakat",
      graphics: "grafiki",
      logo: "logo",
    },
    photos: { one: "zdjęcie", few: "zdjęcia", many: "zdjęć" },
    concertPage: "Strona koncertu",
    bioShort: "Krótki",
    bioMedium: "Średni",
    bioLong: "Pełny",
    characters: { one: "znak", few: "znaki", many: "znaków" },
    upTo: "do {count}",
    copy: "Kopiuj",
    copyText: "Kopiuj tekst",
    copyConcert: "Kopiuj informacje o koncercie",
    copyCaption: "Kopiuj podpis",
    copied: "Skopiowano",
    copyAria: "Skopiuj biogram — {measure}",
    copyFieldAria: "Skopiuj: {field}",
    copyCaptionAria: "Skopiuj podpis zdjęcia: {file}",
    preview: "Podgląd",
    previewAria: "Podgląd: {file}",
    download: "Pobierz",
    downloadAria: "Pobierz: {file}",
    expand: "Pokaż tekst",
    collapse: "Zwiń",
    units: { kB: "kB", MB: "MB" },
    selectAll: "Zaznacz wszystkie",
    selectAllAria: "Zaznacz wszystkie: {group}",
    selectAria: "Wybierz: {file}",
    basketAria: "Wybrane materiały",
    basketCount: "Wybrano {files}",
    files: { one: "plik", few: "pliki", many: "plików" },
    basketDownload: "Pobierz wybrane",
    basketClear: "Wyczyść",
    basketPreparing: "Pobieranie… {percent}",
    basketFailed: "Nie udało się pobrać plików. Spróbuj jeszcze raz.",
    logoOnLight: "Na jasne tło",
    logoOnDark: "Na ciemne tło",
    logoGold: "Złoty, na ciemne tło",
    invoiceFile: "Dane do umowy i faktury jako plik",
    legalName: "Nazwa",
    legalAddress: "Adres",
    legalAccountPln: "Konto PLN",
    legalAccountEur: "Konto EUR",
    mailSubjectPack: "Materiały prasowe — VoctEnsemble",
    mailSubjectMedia: "Pytanie od mediów — VoctEnsemble",
    mailSubjectBroadcast: "Materiały dla radia i telewizji — VoctEnsemble",
  },
  en: {
    headAria: "VoctEnsemble press materials",
    jumpAria: "Sections",
    latestAria: "The next concert",
    photosAria: "Press photographs",
    socialAria: "Social media materials",
    aboutAria: "Biographies and logo",
    foundationAria: "The foundation's details",
    contactAria: "Media contact",
    headMail: "Press enquiries",
    packContents: "In the full pack",
    packUpdated: "Updated",
    packItems: {
      release: "press release",
      programme: "programme",
      biograms: "biographies",
      poster: "poster",
      graphics: "social media graphics",
      logo: "logo",
    },
    photos: { one: "photograph", many: "photographs" },
    concertPage: "Concert page",
    bioShort: "Short",
    bioMedium: "Medium",
    bioLong: "Full",
    characters: { one: "character", many: "characters" },
    upTo: "up to {count}",
    copy: "Copy",
    copyText: "Copy text",
    copyConcert: "Copy the concert details",
    copyCaption: "Copy caption",
    copied: "Copied",
    copyAria: "Copy the biography — {measure}",
    copyFieldAria: "Copy: {field}",
    copyCaptionAria: "Copy the photograph's caption: {file}",
    preview: "Preview",
    previewAria: "Preview: {file}",
    download: "Download",
    downloadAria: "Download: {file}",
    expand: "Show the text",
    collapse: "Hide",
    units: { kB: "kB", MB: "MB" },
    selectAll: "Select all",
    selectAllAria: "Select all: {group}",
    selectAria: "Select: {file}",
    basketAria: "Selected materials",
    basketCount: "{files} selected",
    files: { one: "file", many: "files" },
    basketDownload: "Download selected",
    basketClear: "Clear",
    basketPreparing: "Downloading… {percent}",
    basketFailed: "The files could not be downloaded. Please try again.",
    logoOnLight: "For light backgrounds",
    logoOnDark: "For dark backgrounds",
    logoGold: "Gold, for dark backgrounds",
    invoiceFile: "Contract and invoicing details as a file",
    legalName: "Name",
    legalAddress: "Address",
    legalAccountPln: "Account, PLN",
    legalAccountEur: "Account, EUR",
    mailSubjectPack: "Press materials — VoctEnsemble",
    mailSubjectMedia: "Media enquiry — VoctEnsemble",
    mailSubjectBroadcast: "Radio and television materials — VoctEnsemble",
  },
  fr: {
    headAria: "Espace presse VoctEnsemble",
    jumpAria: "Sections",
    latestAria: "Le prochain concert",
    photosAria: "Photographies de presse",
    socialAria: "Matériel pour les réseaux sociaux",
    aboutAria: "Biographies et logo",
    foundationAria: "Coordonnées de la fondation",
    contactAria: "Contact presse",
    headMail: "Contact presse",
    packContents: "Dans le dossier complet",
    packUpdated: "Mise à jour",
    packItems: {
      release: "communiqué de presse",
      programme: "programme",
      biograms: "biographies",
      poster: "affiche",
      graphics: "visuels pour les réseaux sociaux",
      logo: "logo",
    },
    photos: { one: "photographie", many: "photographies" },
    concertPage: "Page du concert",
    bioShort: "Courte",
    bioMedium: "Moyenne",
    bioLong: "Complète",
    characters: { one: "caractère", many: "caractères" },
    upTo: "jusqu'à {count}",
    copy: "Copier",
    copyText: "Copier le texte",
    copyConcert: "Copier les informations du concert",
    copyCaption: "Copier la légende",
    copied: "Copié",
    copyAria: "Copier la biographie — {measure}",
    copyFieldAria: "Copier : {field}",
    copyCaptionAria: "Copier la légende de la photographie : {file}",
    preview: "Aperçu",
    previewAria: "Aperçu : {file}",
    download: "Télécharger",
    downloadAria: "Télécharger : {file}",
    expand: "Afficher le texte",
    collapse: "Masquer",
    units: { kB: "ko", MB: "Mo" },
    selectAll: "Tout sélectionner",
    selectAllAria: "Tout sélectionner : {group}",
    selectAria: "Sélectionner : {file}",
    basketAria: "Documents sélectionnés",
    basketCount: "Sélection : {files}",
    files: { one: "fichier", many: "fichiers" },
    basketDownload: "Télécharger la sélection",
    basketClear: "Effacer",
    basketPreparing: "Téléchargement… {percent}",
    basketFailed: "Le téléchargement a échoué. Veuillez réessayer.",
    logoOnLight: "Sur fond clair",
    logoOnDark: "Sur fond sombre",
    logoGold: "Doré, sur fond sombre",
    invoiceFile: "Coordonnées de facturation en fichier",
    legalName: "Nom",
    legalAddress: "Adresse",
    legalAccountPln: "Compte, PLN",
    legalAccountEur: "Compte, EUR",
    mailSubjectPack: "Dossier de presse — VoctEnsemble",
    mailSubjectMedia: "Demande presse — VoctEnsemble",
    mailSubjectBroadcast: "Matériel radio et télévision — VoctEnsemble",
  },
};
