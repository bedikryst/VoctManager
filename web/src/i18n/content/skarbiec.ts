/**
 * @file skarbiec.ts
 * @description Everything about the donation vault except its prose: the shape that prose must
 *  have (zod, `.strict()`), the copy desk's key contract over it, and where its chrome went.
 *
 *  THE LINE BETWEEN THE TWO IS WHETHER COMPLETENESS CAN BE DEMANDED (spec §6r). An aria-label, a
 *  submit button and — the case this stage decided — a VALIDATION MESSAGE must exist in all three
 *  locales or somebody meets a broken surface at the worst possible moment: a French donor whose
 *  card was refused, reading a Polish sentence. `Record<Locale, …>` makes the compiler say so.
 *  A paragraph is the opposite: it arrives one field at a time through review, so it lives in
 *  `src/content/pages/skarbiec.yaml` and falls back to Polish per field until it is translated.
 *
 *  THE DONOR COUNT IS CHROME, AND FIXING IT IS WHY. `donors(n)` is a closed table walked by an
 *  arithmetic result, not copy awaiting review (§6x) — and Polish needs THREE forms where the
 *  vault printed two, so "2 darczyńców" has been ungrammatical on the live site. English and
 *  French need two each.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here (type-stripping, no build step), so that the key a translation is stored
 *  under and the key the island looks up are the same expression. Keep it free of `?raw`,
 *  `astro:assets` and anything else only a bundler can resolve.
 * @architecture Astro islands 2026
 * @module i18n/content/skarbiec
 */

import { z } from "astro/zod";

import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The prose, as a shape ─────────────────────────────────────────────────────────────────────

/** `.strict()` throughout: a hand-added `en:` beside a Polish value fails the build rather than
    being dropped in silence. Translations belong in the overlay. */
const vaultCopySchema = z
  .object({
    head: z.object({ kicker: z.string(), title: z.string() }).strict(),
    progress: z.object({ open: z.string(), awaiting: z.string() }).strict(),
    methods: z.object({ label: z.string() }).strict(),
    online: z
      .object({
        tag: z.string(),
        title: z.string(),
        note: z.string(),
        consentLead: z.string(),
        methodsNotePln: z.string(),
        methodsNoteEur: z.string(),
      })
      .strict(),
    zrzutka: z.object({ tag: z.string(), note: z.string() }).strict(),
    qr: z
      .object({
        tag: z.string(),
        title: z.string(),
        note: z.string(),
        hintHtml: z.string(),
        recurringLabel: z.string(),
        recurringNoteHtml: z.string(),
      })
      .strict(),
    mecenat: z
      .object({
        tag: z.string(),
        title: z.string(),
        note: z.string(),
        benefitsLabel: z.string(),
        benefit1: z.string(),
        benefit2: z.string(),
        benefit3: z.string(),
        benefit4: z.string(),
        howLabel: z.string(),
        howHtml: z.string(),
        talkLabel: z.string(),
        talkNote: z.string(),
        joinLabel: z.string(),
        consentHtml: z.string(),
        confirmGreeting: z.string(),
        confirmFallbackName: z.string(),
        confirmBody: z.string(),
        confirmContact: z.string(),
      })
      .strict(),
    result: z.object({ kicker: z.string() }).strict(),
    gratitude: z.object({ title1: z.string(), title2: z.string(), strap: z.string() }).strict(),
    failure: z.object({ title1: z.string(), title2: z.string(), strap: z.string() }).strict(),
  })
  .strict();

export type VaultCopy = z.infer<typeof vaultCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/** DECLARATION ORDER IS READING ORDER — `order` is a counter over this list, laid out in the
    sequence the sheet prints: head, rail, the three roads, the patronage panel, the two overlays
    a donor meets on the way back from the gateway. */
const VAULT_CONTRACT: readonly CopyEntry[] = [
  {
    kind: "field",
    path: "head.kicker",
    label: "Głowa · rejestr",
    note: "The line above the title, in small caps. `MMXXVI` is the cycle's year in Roman numerals and stays itself. \"Skarbiec\" is the site's own word for this sheet — a treasury, not a donation form — so the register is a room, not a transaction.",
  },
  {
    kind: "field",
    path: "head.title",
    label: "Głowa · tytuł",
    note: "The sheet's heading and its accessible name. Two words, imperative, addressed to one person — never a plural appeal to an audience.",
  },
  {
    kind: "field",
    path: "progress.open",
    label: "Zbiórka · stan",
    note: "First half of the line under the campaign rail; the donor count or the note below follows it after a middle dot. It states that the collection is open, not how far along it is.",
  },
  {
    kind: "field",
    path: "progress.awaiting",
    label: "Zbiórka · zamiast liczby",
    note: "Printed in place of the donor count while nobody has given yet. \"Concerts Spirituels\" is the cycle's published name and stays itself in all three locales.",
  },
  {
    kind: "field",
    path: "methods.label",
    label: "Drogi · nagłówek",
    note: "Above the three cards. It names a choice between roads, not a list of payment options.",
  },
  {
    kind: "field",
    path: "online.tag",
    label: "Wpłata online · znacznik",
    note: "Two promises separated by a middle dot, read as one breath. Keep both halves short enough to sit on one line at 320px.",
  },
  { kind: "field", path: "online.title", label: "Wpłata online · tytuł" },
  {
    kind: "field",
    path: "online.note",
    label: "Wpłata online · opis",
    note: "\"Axepta BNP Paribas\" is the gateway's brand and stays itself. The two negations at the end are the card's whole argument: nothing stands between the donor and the foundation's account.",
  },
  {
    kind: "field",
    path: "online.consentLead",
    label: "Wpłata online · zgoda (początek zdania)",
    note: "The first half of the consent line; the document's own title follows it as a link and the full stop is set in the markup. It is one sentence broken at the link, so the fragment must end where a title can begin.",
  },
  {
    kind: "field",
    path: "online.methodsNotePln",
    label: "Wpłata online · metody w PLN",
    note: "What the donor's own bank will offer them once they are on the gateway. BLIK is a Polish instant-payment scheme and keeps its name.",
  },
  {
    kind: "field",
    path: "online.methodsNoteEur",
    label: "Wpłata online · metody w EUR",
    note: "Narrower than the PLN note on purpose, and the difference is a fact rather than a hedge: a euro donation cannot use BLIK or a Polish pay-by-link.",
  },
  { kind: "field", path: "zrzutka.tag", label: "Zrzutka · znacznik" },
  {
    kind: "field",
    path: "zrzutka.note",
    label: "Zrzutka · opis",
    note: "Zrzutka.pl is a Polish crowdfunding service; its name is in the markup and is not translated. The last sentence is the card's reason to exist — this road is the one where giving is joining.",
  },
  {
    kind: "field",
    path: "qr.tag",
    label: "Przelew · znacznik",
    note: "The one method that costs the foundation nothing at all, which is what the tag says.",
  },
  { kind: "field", path: "qr.title", label: "Przelew · tytuł" },
  { kind: "field", path: "qr.note", label: "Przelew · opis" },
  {
    kind: "field",
    path: "qr.hintHtml",
    label: "Przelew · wskazówka",
    note: "The quoted phrase is the label Polish banking apps print on that function. Name whatever the reader's own banks call it rather than translating the Polish words.",
  },
  { kind: "field", path: "qr.recurringLabel", label: "Przelew · wsparcie cykliczne (etykieta)" },
  {
    kind: "field",
    path: "qr.recurringNoteHtml",
    label: "Przelew · wsparcie cykliczne (opis)",
    note: "\"Zlecenie stałe\" is the banking term for a standing order — use the reader's own term, and the one their bank's menu actually shows. The paragraph's point is that the donor keeps control: no card is stored, and cancelling needs no contact with us.",
  },
  { kind: "field", path: "mecenat.tag", label: "Mecenat · znacznik" },
  { kind: "field", path: "mecenat.title", label: "Mecenat · tytuł" },
  {
    kind: "field",
    path: "mecenat.note",
    label: "Mecenat · zaproszenie",
    note: "The pitch. \"Mecenat\" is patronage in the old sense — a relationship, not a subscription tier — and the paragraph turns on that distinction in its first clause.",
  },
  { kind: "field", path: "mecenat.benefitsLabel", label: "Mecenat · co zapewniamy (etykieta)" },
  {
    kind: "field",
    path: "mecenat.benefit1",
    label: "Mecenat · co zapewniamy · 1",
    note: "Four promises in descending order of intimacy; this one is the most personal and stays first.",
  },
  { kind: "field", path: "mecenat.benefit2", label: "Mecenat · co zapewniamy · 2" },
  { kind: "field", path: "mecenat.benefit3", label: "Mecenat · co zapewniamy · 3" },
  {
    kind: "field",
    path: "mecenat.benefit4",
    label: "Mecenat · co zapewniamy · 4",
    note: "The practical one, and last for that reason. It describes a Polish tax deduction; a translation says what the document IS (a yearly statement of donations) rather than naming a foreign tax regime.",
  },
  { kind: "field", path: "mecenat.howLabel", label: "Mecenat · jak to działa (etykieta)" },
  {
    kind: "field",
    path: "mecenat.howHtml",
    label: "Mecenat · jak to działa",
    note: "Same standing-order vocabulary as the transfer card. The amounts are examples and stay in złoty — the account they would go to is a Polish one.",
  },
  { kind: "field", path: "mecenat.talkLabel", label: "Mecenat · rozmowa (etykieta)" },
  { kind: "field", path: "mecenat.talkNote", label: "Mecenat · rozmowa" },
  { kind: "field", path: "mecenat.joinLabel", label: "Mecenat · formularz (etykieta)" },
  {
    kind: "field",
    path: "mecenat.consentHtml",
    label: "Mecenat · zgoda na kontakt",
    note: "The lawful basis for keeping a patron's details (art. 6(1)(a) GDPR). The three data points are named on purpose — a consent that does not say what it covers covers nothing — so a translation names the same three.",
  },
  {
    kind: "field",
    path: "mecenat.confirmGreeting",
    label: "Mecenat · potwierdzenie · powitanie",
    note: "The patron's own first name follows this word, then an exclamation mark set in the markup. It is kept apart from the sentence for exactly that reason: a name must never sit inside a clause a translator might reorder.",
  },
  {
    kind: "field",
    path: "mecenat.confirmFallbackName",
    label: "Mecenat · potwierdzenie · gdy brak imienia",
    note: "Stands in the name's place when the form was sent with the field empty. It has to work as a vocative address on its own.",
  },
  { kind: "field", path: "mecenat.confirmBody", label: "Mecenat · potwierdzenie · treść" },
  {
    kind: "field",
    path: "mecenat.confirmContact",
    label: "Mecenat · potwierdzenie · kontakt",
    note: "An e-mail address follows this fragment as a link, and the full stop after it is set in the markup — so the sentence has to end pointing forward at an address.",
  },
  {
    kind: "field",
    path: "result.kicker",
    label: "Powrót z bramki · rejestr",
    note: "Printed above BOTH result overlays — the thank-you and the apology — because it is the same imprint under each. One row rather than two that can drift apart.",
  },
  {
    kind: "field",
    path: "gratitude.title1",
    label: "Podziękowanie · tytuł, wiersz 1",
    note: "Set as two lines and the break is compositional, not grammatical: a translation decides its own split rather than reproducing this one word for word.",
  },
  { kind: "field", path: "gratitude.title2", label: "Podziękowanie · tytuł, wiersz 2" },
  {
    kind: "field",
    path: "gratitude.strap",
    label: "Podziękowanie · zdanie",
    note: "The last thing a donor reads. It thanks and then turns outward to the music — never to the amount, and never to a next step.",
  },
  {
    kind: "field",
    path: "failure.title1",
    label: "Niepowodzenie · tytuł, wiersz 1",
    note: "Same two-line composition as the thank-you, and the same rule about the break. The register is an apology with a fact inside it: the money did not move.",
  },
  { kind: "field", path: "failure.title2", label: "Niepowodzenie · tytuł, wiersz 2" },
  {
    kind: "field",
    path: "failure.strap",
    label: "Niepowodzenie · zdanie",
    note: "Three clauses, and the middle one is the one that matters: nothing was charged. Keep it as its own sentence.",
  },
];

/** Everything else in `skarbiec.yaml`, with the reason it is not text a reader is meant to read. */
const VAULT_NOT_COPY: Readonly<Record<string, string>> = {};

/** What `lib/vaultCopy` needs to read the vault's prose, and the extractor to key it. */
export const SKARBIEC_PAGE: PageCopySpec<VaultCopy> = {
  id: "skarbiec",
  label: "Skarbiec · darowizny",
  schema: vaultCopySchema,
  contract: VAULT_CONTRACT,
  notCopy: VAULT_NOT_COPY,
};
