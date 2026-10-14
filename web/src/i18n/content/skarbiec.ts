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
 * @module i18n/content/skarbiec
 */

import { z } from "astro/zod";

import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The prose, as a shape ─────────────────────────────────────────────────────────────────────

/** `.strict()` throughout: a hand-added `en:` beside a Polish value fails the build rather than
    being dropped in silence. Translations belong in the overlay. */
const vaultCopySchema = z
  .object({
    head: z.object({ kicker: z.string(), title: z.string(), lede: z.string() }).strict(),
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
        noteTouch: z.string(),
        hintHtml: z.string(),
        recurringLabel: z.string(),
        recurringNoteHtml: z.string(),
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
    sequence the sheet prints: head and its reason, rail, the online form, the two other ways of
    giving, the two overlays a donor meets on the way back from the gateway. */
const VAULT_CONTRACT: readonly CopyEntry[] = [
  {
    kind: "field",
    path: "head.kicker",
    label: "Głowa · rejestr",
    note: "The line above the title, in small caps. \"Skarbiec\" is the site's own word for this sheet — a treasury, not a donation form — so the register is a room, not a transaction. It must sit on one line in a phone's head column, about 210px at 11px spaced capitals: two short words, no year.",
  },
  {
    kind: "field",
    path: "head.title",
    label: "Głowa · tytuł",
    note: "The sheet's heading and its accessible name. Imperative, addressed to one person — never a plural appeal to an audience. It names the cycle by the name the site publishes in that language (\"Koncerty Duchowe\", the Spiritual Concerts, les Concerts Spirituels).",
  },
  {
    kind: "field",
    path: "head.lede",
    label: "Głowa · po co",
    note: "The one place in the sheet that says what a gift pays for; most readers open it from a page that never made the case. Plain words, two short sentences: what the money pays, then what the audience gets from it. Free admission is stated without a hedge: one concert was ticketed as an exception and no more are planned.",
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
    note: "Printed in place of the donor count while nobody has given yet. The cycle's name as the site publishes it in that language.",
  },
  {
    kind: "field",
    path: "methods.label",
    label: "Inne sposoby · nagłówek",
    note: "Under the online form, above Zrzutka and the bank transfer. The form is the sheet's main road; this labels the two alternatives for a reader who would rather pay another way.",
  },
  {
    kind: "field",
    path: "online.tag",
    label: "Wpłata online · znacznik",
    note: "What the donor can pay with, at a glance; the note under the form gives the full list per currency. BLIK keeps its name. Short enough to sit on one line at 320px.",
  },
  { kind: "field", path: "online.title", label: "Wpłata online · tytuł" },
  {
    kind: "field",
    path: "online.note",
    label: "Wpłata online · opis",
    note: "\"Axepta BNP Paribas\" is the gateway's brand and stays itself. Who handles the payment, where the money lands, and that no account is needed. A gateway is an intermediary, so the sentence never promises \"no intermediaries\".",
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
  {
    kind: "field",
    path: "zrzutka.tag",
    label: "Zrzutka · znacznik",
    note: "What this road adds over the online form above it: the gift can repeat every month.",
  },
  {
    kind: "field",
    path: "zrzutka.note",
    label: "Zrzutka · opis",
    note: "Zrzutka.pl is a Polish crowdfunding service; its name is in the markup and is not translated. The payment methods only — the tag above already says what this road adds.",
  },
  {
    kind: "field",
    path: "qr.tag",
    label: "Przelew · znacznik",
    note: "The one method that costs the foundation nothing at all, which is what the tag says.",
  },
  { kind: "field", path: "qr.title", label: "Przelew · tytuł" },
  {
    kind: "field",
    path: "qr.note",
    label: "Przelew · opis przy kodzie (komputer)",
    note: "Printed only on a computer, where the code beside it can be scanned with a phone.",
  },
  {
    kind: "field",
    path: "qr.noteTouch",
    label: "Przelew · opis bez kodu (telefon)",
    note: "Printed instead of the note above on a phone or tablet, which cannot scan the code it shows, so the code is hidden there. The account number and the transfer title follow it as copy buttons.",
  },
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
    note: "\"Zlecenie stałe\" is the banking term for a standing order — use the reader's own term, and the one their bank's menu actually shows. One practical sentence about these details, no link: the sheet's closing line (chrome, outside the desk) is the road to /fundacja#wsparcie, where the offer is set out.",
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
    note: "The last thing a donor reads. Plain thanks that names what was supported — no pathos, never the amount, and no promise of an e-mail the foundation does not send.",
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
