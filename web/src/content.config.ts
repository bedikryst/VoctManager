/**
 * @file content.config.ts
 * @description Content collections for the public site — concert "stations" and the
 *  seven-century repertoire catalog as typed DATA (Zod-validated), not hard-coded markup.
 *  The team edits two YAML files (src/content/*.yaml); KoncertyPage renders from them.
 *  Image fields hold bare photo() names (no extension) resolved at build via src/assets.
 * @architecture Astro islands 2026
 * @module content.config
 */
import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";

const concerts = defineCollection({
  loader: file("src/content/concerts.yaml"),
  schema: z.object({
    order: z.number(),
    roman: z.string(),
    latin: z.string(),
    title: z.string(),
    /** Presentational one-line venue + date, e.g. "Bazylika NSPJ, Kraków · 20 stycznia 2024". */
    meta: z.string(),
    /** Venue name alone — feeds schema.org Place.name (meta is display-only). */
    venue: z.string().optional(),
    /** ISO date (YYYY-MM-DD) for schema.org startDate. Omitted when the date is vague
        (a season or bare year); JSON-LD then skips startDate rather than fabricate one. */
    date: z.string().optional(),
    /** Short via-rail date label (e.g. "sty 2024"). The via-rail fill % is computed
        from order in the page, not stored here. */
    viaDate: z.string(),
    /** /o-nas milestone editorial — the About page derives its "Via" list from this
        collection (single source of truth with /koncerty). All fields optional:
        place falls back to `venue`, blurb to `essence`; a missing img renders the
        milestone row text-only. */
    about: z
      .object({
        /** Short display place for the milestone row, e.g. "Kraków · Łódź". */
        place: z.string().optional(),
        /** One-sentence o-nas note (shorter register than `essence`). */
        blurb: z.string().optional(),
        /** photo() base name for the 3:2 milestone image. */
        img: z.string().optional(),
      })
      .optional(),
    accent: z.string(),
    essence: z.string(),
    facts: z.array(z.string()).default([]),
    variant: z.enum(["default", "memoriam", "liturgy"]).default("default"),
    reverse: z.boolean().default(false),
    /** Full-bleed background — photo() base name (expects -desktop / -mobile). */
    bg: z.string(),
    /** Framed poster — photo() base name. Absent for the liturgy plate. */
    poster: z.string().optional(),
    posterAlt: z.string().optional(),
    realizacja: z.string().optional(),
    spotify: z.string().url().optional(),
    links: z.array(z.object({ label: z.string(), href: z.string().url() })).default([]),
    /** When true, /koncerty/[id] generates a dedicated page for this entry. */
    hasPage: z.boolean().default(false),
    /** Florent-authored single reflection paragraph (concert page). */
    reflection: z.string().optional(),
    /** Author attribution for the reflection paragraph. */
    reflectionAttribution: z.string().optional(),
    /** Latin epigraph that opens the concert page (typically a biblical source). */
    inscriptio: z.string().optional(),
    /** Polish translation of inscriptio. */
    inscriptioPl: z.string().optional(),
    /** Biblical / source reference for the inscription (e.g. "Iz 11,1"). */
    inscriptioRef: z.string().optional(),
    /** Optional in-page pull-quote (composer or director on a single work). */
    pullQuote: z
      .object({
        text: z.string(),
        attribution: z.string(),
        about: z.string().optional(),
      })
      .optional(),
    program: z
      .array(
        z.object({
          composer: z.string(),
          /** Composer life-dates as a single string, e.g. "1942–2019". */
          years: z.string().optional(),
          work: z.string(),
          /** Year of composition. */
          year: z.string().optional(),
          /** Liturgical incipit / source verse in Latin (concert page only). */
          inscriptio: z.string().optional(),
          /** Polish translation of inscriptio. */
          inscriptioPl: z.string().optional(),
          inscriptioRef: z.string().optional(),
          bis: z.boolean().default(false),
        }),
      )
      .default([]),
  }),
});

const repertoire = defineCollection({
  loader: file("src/content/repertoire.yaml"),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    span: z.string(),
    entries: z.array(
      z.object({
        composer: z.string(),
        years: z.string().optional(),
        works: z.array(z.object({ title: z.string(), year: z.string().optional() })),
      }),
    ),
  }),
});

export const collections = { concerts, repertoire };
