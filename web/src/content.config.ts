/**
 * @file content.config.ts
 * @description Content collections for the public site — concert "stations" and the
 *  five-century repertoire catalog as typed DATA (Zod-validated), not hard-coded markup.
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
    meta: z.string(),
    viaDate: z.string(),
    viaStep: z.string(),
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
    program: z
      .array(
        z.object({
          composer: z.string(),
          work: z.string(),
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
