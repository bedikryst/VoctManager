/**
 * @file mecenat.ts
 * @description Everything about /mecenat except its words: the shape its Polish prose must have
 *  (zod, `.strict()`), the copy desk's key contract over that prose, and the page's chrome in all
 *  three locales. Prose in `src/content/pages/mecenat.yaml`; the realisation module's labels are
 *  /fundacja's and are read from `fundacja.ts`, not repeated here.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here. Keep it free of `?raw`, `astro:assets` and anything only a bundler resolves.
 * @architecture Astro islands 2026
 * @module i18n/content/mecenat
 */

import { z } from "astro/zod";

import type { Locale } from "../config";
import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The prose, as a shape ─────────────────────────────────────────────────────────────────────

const mecenatCopySchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    eyebrow: z.string(),
    h1: z.string(),
    idea: z.string(),
    realisation: z
      .object({
        rubricAhead: z.string(),
        rubricPast: z.string(),
        id: z.string(),
        lead: z.string(),
        areas: z.array(z.object({ id: z.string(), text: z.string() }).strict()).min(1),
      })
      .strict(),
    about: z.object({ h2: z.string(), body: z.string() }).strict(),
    presence: z.object({ h2: z.string(), body: z.string(), photoCaption: z.string() }).strict(),
    coda: z.string(),
    contact: z.object({ lead: z.string(), role: z.string(), mailSubject: z.string() }).strict(),
    proof: z.string(),
  })
  .strict();

export type MecenatCopy = z.infer<typeof mecenatCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/** DECLARATION ORDER IS READING ORDER — the desk renders the page top to bottom from this list. */
const MECENAT_CONTRACT: readonly CopyEntry[] = [
  { kind: "field", path: "meta.title", label: "Metadane · tytuł strony" },
  { kind: "field", path: "meta.description", label: "Metadane · opis strony" },
  { kind: "field", path: "eyebrow", label: "Nagłówek · rubryka" },
  {
    kind: "field",
    path: "h1",
    label: "Nagłówek · tytuł",
    note: "Anna Marcisz's sentence. The page addresses the reader formally throughout (Państwo / vous / you).",
  },
  { kind: "field", path: "idea", label: "Idea" },
  { kind: "field", path: "realisation.rubricAhead", label: "Realizacja · rubryka (przed koncertem)" },
  { kind: "field", path: "realisation.rubricPast", label: "Realizacja · rubryka (po koncercie)" },
  { kind: "field", path: "realisation.lead", label: "Realizacja · lead" },
  {
    kind: "list",
    path: "realisation.areas",
    keyBy: "id",
    label: "Obszar mecenatu",
    note: "Lower case: the list continues the sentence before it.",
    fields: [{ path: "text", label: "obszar" }],
  },
  { kind: "field", path: "about.h2", label: "O realizacji · nagłówek" },
  {
    kind: "field",
    path: "about.body",
    label: "O realizacji · akapit",
    note: "`{amount}` and `{date}` are computed. It ends on a colon: the areas follow as a list.",
  },
  { kind: "field", path: "presence.h2", label: "Obecność · nagłówek" },
  { kind: "field", path: "presence.body", label: "Obecność · akapit" },
  { kind: "field", path: "presence.photoCaption", label: "Obecność · podpis zdjęcia" },
  { kind: "field", path: "coda", label: "Koda", note: "Anna Marcisz's sentence, set in italic as a person's words." },
  { kind: "field", path: "contact.lead", label: "Kontakt · zaproszenie" },
  { kind: "field", path: "contact.role", label: "Kontakt · funkcja", note: "`{function}` is the KRS function as /fundacja words it." },
  { kind: "field", path: "contact.mailSubject", label: "Kontakt · temat wiadomości" },
  { kind: "field", path: "proof", label: "Odnośnik do strony fundacji", note: "Keep the trailing arrow." },
];

const MECENAT_NOT_COPY: Readonly<Record<string, string>> = {
  "realisation.id": "identity — the realisation this copy is written for (data/foundationSupport.ts)",
  "realisation.areas[].id": "identity — the desk's key part for this entry",
};

export const MECENAT_PAGE: PageCopySpec<MecenatCopy> = {
  id: "mecenat",
  label: "Mecenat",
  schema: mecenatCopySchema,
  contract: MECENAT_CONTRACT,
  notCopy: MECENAT_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

export interface MecenatChrome {
  /** The page's name in the breadcrumb trail, under the foundation. */
  readonly crumb: string;
  readonly realisationAria: string;
  readonly contactAria: string;
  readonly copy: string;
  readonly copied: string;
  /** Accessible name of the address's copy button. `{what}` is the address. */
  readonly copyAria: string;
}

export const MECENAT_CHROME: Record<Locale, MecenatChrome> = {
  pl: {
    crumb: "Mecenat",
    realisationAria: "Bieżąca realizacja",
    contactAria: "Kontakt w sprawie mecenatu",
    copy: "Kopiuj",
    copied: "Skopiowano",
    copyAria: "Skopiuj: {what}",
  },
  en: {
    crumb: "Patronage",
    realisationAria: "The current production",
    contactAria: "Contact about patronage",
    copy: "Copy",
    copied: "Copied",
    copyAria: "Copy: {what}",
  },
  fr: {
    crumb: "Mécénat",
    realisationAria: "La réalisation en cours",
    contactAria: "Contact pour le mécénat",
    copy: "Copier",
    copied: "Copié",
    copyAria: "Copier : {what}",
  },
};
