/**
 * @file regulaminDarowizn.ts
 * @description Everything about the donation terms except the terms themselves: the shape the
 *  document must have (zod, `.strict()`) and the copy desk's key contract over it.
 *
 *  IT HAS NO CHROME OF ITS OWN. The overlay that renders this document is part of the vault
 *  island, so its close button, its accept button and the two labels under it live in
 *  `VAULT_CHROME` (`i18n/content/skarbiec.ts`) with the rest of the island's affordances. One
 *  chrome table for one island.
 *
 *  A SEPARATE SCOPE FROM THE VAULT, deliberately. A legal text is reviewed against a different
 *  question than an invitation is — not "does this read well" but "does this still say what the
 *  Polish says" — and on the desk that difference is a row of its own, with its own stale count.
 *  The privacy policy joins it as a peer in the next stage.
 *
 *  NUMBERING IS TEXT, NOT LAYOUT, which is why every paragraph is a NAMED field and nothing here
 *  is a list the desk could reorder: § 3 ust. 4 cites "ust. 2", § 1 ust. 2 cites "§ 5 oraz § 6
 *  Statutu", § 1 ust. 4 cites "art. 890 § 1 zd. 2 Kodeksu cywilnego". The `§` numerals themselves
 *  are locale-neutral markup, like every other rubric on this site. The schema is spelled out
 *  section by section for the same reason — a helper that built these objects from a list of
 *  names would type a section as an index signature, and `s3.p9` would then compile.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite — keep it free of `?raw`, `astro:assets` and
 *  anything else only a bundler can resolve.
 * @architecture Astro islands 2026
 * @module i18n/content/regulaminDarowizn
 */

import { z } from "astro/zod";

import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The document, as a shape ──────────────────────────────────────────────────────────────────

/** `.strict()` throughout: a hand-added `en:` beside a Polish value fails the build rather than
    being dropped in silence. Translations belong in the overlay. */
const termsCopySchema = z
  .object({
    /** Structural: read by the overlay's footer and matched by the newest history entry. */
    version: z.string(),
    /** ISO date. Formatted per locale at render, never carried inside a translated sentence. */
    effectiveFrom: z.string(),
    head: z.object({ kicker: z.string(), title: z.string(), lede: z.string() }).strict(),
    s1: z
      .object({
        title: z.string(),
        p1Html: z.string(),
        p2Html: z.string(),
        p3: z.string(),
        p4: z.string(),
      })
      .strict(),
    s2: z
      .object({
        title: z.string(),
        p1: z.string(),
        p2: z.string(),
        p3: z.string(),
        p4: z.string(),
        p5: z.string(),
        p6: z.string(),
      })
      .strict(),
    s3: z
      .object({
        title: z.string(),
        p1: z.string(),
        p2Html: z.string(),
        p3: z.string(),
        p4: z.string(),
        p5: z.string(),
      })
      .strict(),
    s4: z.object({ title: z.string(), p1: z.string(), p2Html: z.string() }).strict(),
    s5: z
      .object({ title: z.string(), p1: z.string(), p2: z.string(), p3: z.string() })
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

export type TermsCopy = z.infer<typeof termsCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/** DECLARATION ORDER IS READING ORDER — `order` is a counter over this list, and it follows the
    document from its head to its version history. */
const TERMS_CONTRACT: readonly CopyEntry[] = [
  { kind: "field", path: "head.kicker", label: "Głowa · rejestr" },
  {
    kind: "field",
    path: "head.title",
    label: "Głowa · tytuł",
    note: "The document's own title, and the ONE name the site calls it by: the consent line beside the give-form's checkbox and the link in the vault's footer both read it from here. Two wordings for one document on one screen is the defect this replaces.",
  },
  {
    kind: "field",
    path: "head.lede",
    label: "Głowa · wprowadzenie",
    note: "One sentence naming what the document governs. It stands outside the numbered text and creates no obligations — it is the reader's way in.",
  },

  { kind: "field", path: "s1.title", label: "§ 1 · tytuł" },
  {
    kind: "field",
    path: "s1.p1Html",
    label: "§ 1 · ust. 1",
    note: "The foundation's register — KRS, NIP, REGON, the seat — is written out because a party to an agreement must be identifiable from the agreement. Every number and the address stay as they are; only the words around them are translated. „Fundacją” is the defined term the rest of the document leans on, so whatever it becomes has to be used consistently below.",
  },
  {
    kind: "field",
    path: "s1.p2Html",
    label: "§ 1 · ust. 2",
    note: "The link goes to the foundation's statute, which is a Polish-language PDF in every locale: name it in the reader's language and leave the citation `§ 5 oraz § 6` alone. The long list is the statutory purposes taken verbatim from that document.",
  },
  { kind: "field", path: "s1.p3", label: "§ 1 · ust. 3" },
  {
    kind: "field",
    path: "s1.p4",
    label: "§ 1 · ust. 4",
    note: "`art. 890 § 1 zd. 2 Kodeksu cywilnego` is an address inside the Polish civil code: name the code in the reader's language and never renumber the citation. The rule it states is the one that makes a donation binding on payment rather than on a signature.",
  },

  { kind: "field", path: "s2.title", label: "§ 2 · tytuł" },
  { kind: "field", path: "s2.p1", label: "§ 2 · ust. 1" },
  {
    kind: "field",
    path: "s2.p2",
    label: "§ 2 · ust. 2",
    note: "Two companies and their registered seats. The names, the legal form (S.A.) and the cities stay as they are; only the sentence around them is translated.",
  },
  {
    kind: "field",
    path: "s2.p3",
    label: "§ 2 · ust. 3",
    note: "BLIK and Pay-By-Link are Polish payment schemes and keep their names; Visa, Mastercard, Apple Pay and Google Pay are brands.",
  },
  {
    kind: "field",
    path: "s2.p4",
    label: "§ 2 · ust. 4",
    note: "The standing order and Zrzutka.pl in one paragraph. The clause about storing no card data and no debit mandate is a factual assurance about how the foundation works, not a flourish — keep it.",
  },
  { kind: "field", path: "s2.p5", label: "§ 2 · ust. 5" },
  {
    kind: "field",
    path: "s2.p6",
    label: "§ 2 · ust. 6",
    note: "The moment the agreement is concluded. It has to name an ACT — clicking the button and paying — never an intention.",
  },

  { kind: "field", path: "s3.title", label: "§ 3 · tytuł" },
  { kind: "field", path: "s3.p1", label: "§ 3 · ust. 1" },
  {
    kind: "field",
    path: "s3.p2Html",
    label: "§ 3 · ust. 2",
    note: "The address that ust. 4 below refers back to.",
  },
  {
    kind: "field",
    path: "s3.p3",
    label: "§ 3 · ust. 3",
    note: "A deadline in days. The number is not a figure of speech.",
  },
  {
    kind: "field",
    path: "s3.p4",
    label: "§ 3 · ust. 4",
    note: "\"adres wskazany w ust. 2\" points at the paragraph two above. Keep the reference, and keep it pointing at the second paragraph of THIS section.",
  },
  { kind: "field", path: "s3.p5", label: "§ 3 · ust. 5" },

  { kind: "field", path: "s4.title", label: "§ 4 · tytuł" },
  { kind: "field", path: "s4.p1", label: "§ 4 · ust. 1" },
  {
    kind: "field",
    path: "s4.p2Html",
    label: "§ 4 · ust. 2",
    note: "RODO is the Polish name for the GDPR — use whatever the reader's own jurisdiction calls the same regulation. The link points at the site's privacy policy.",
  },

  { kind: "field", path: "s5.title", label: "§ 5 · tytuł" },
  { kind: "field", path: "s5.p1", label: "§ 5 · ust. 1" },
  { kind: "field", path: "s5.p2", label: "§ 5 · ust. 2" },
  {
    kind: "field",
    path: "s5.p3",
    label: "§ 5 · ust. 3",
    note: "ADDED IN VERSION 1.2, and it is the clause that makes the English and French versions safe to publish at all: the reader is told, inside the document they are accepting, that the Polish version is the binding one. Translate it exactly — this paragraph is the reason the other two versions are informational.",
  },

  { kind: "field", path: "history.label", label: "Historia wersji · etykieta" },
  {
    kind: "list",
    path: "history.entries",
    keyBy: "id",
    label: "Historia wersji",
    fields: [
      {
        path: "note",
        label: "opis zmiany",
        note: "What that version changed. The version number and its date are composed from structural fields at render, so no date is ever carried inside this sentence.",
      },
    ],
  },
];

/** Everything else in `regulamin-darowizn.yaml`, with the reason it is not text a reader reads. */
const TERMS_NOT_COPY: Readonly<Record<string, string>> = {
  version: "The document's version number. A figure, not a phrase.",
  effectiveFrom:
    "An ISO date, formatted per locale by `lib/dates`. A date written into prose drifts from the field it was copied from — this project's most repeated trap.",
  "history.entries[].id":
    "The key the desk addresses an entry by. An identity an editor is about to translate is not an identity.",
  "history.entries[].version": "A version number, the same in every language.",
  "history.entries[].date": "An ISO date, formatted per locale beside the version.",
};

/** What `lib/vaultCopy` needs to read the terms, and the extractor to key them. */
export const REGULAMIN_PAGE: PageCopySpec<TermsCopy> = {
  id: "regulamin-darowizn",
  label: "Regulamin darowizn",
  schema: termsCopySchema,
  contract: TERMS_CONTRACT,
  notCopy: TERMS_NOT_COPY,
};
