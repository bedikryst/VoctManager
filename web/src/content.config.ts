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
    /** The founder's own name for the programme, shown on the detail page instead of a
        bare work count (e.g. "Dziesięć spojrzeń — i bis"). Falls back to the label alone. */
    programLede: z.string().optional(),
    /** The dramaturgy of the evening — why THIS order. A short unsigned editorial lede that
        opens the programme ("kolejność jest częścią kompozycji"), grounded in the sequence
        itself, never in an invented quote. Rendered above the work list. */
    programArc: z.string().optional(),
    /** The threshold of the evening — a short scene-setting beat rendered as a dark band right
        after the hero (place, hour, the rite of entry). Draws the reader across the doorway into
        the experience before the reflection. Grounded, never staged detail we can't attest. */
    prologue: z.string().optional(),
    /** Movements of the programme — the salvation-history acts the work-list is grouped into.
        Each program item names its movement `id`; the page emits an act header (Latin · Polish
        + one guiding line) whenever the movement changes. Empty ⇒ a flat list (back-compatible). */
    movements: z
      .array(
        z.object({
          id: z.string(),
          lat: z.string(),
          pl: z.string(),
          line: z.string().optional(),
          /** A full-bleed dark scripture beat rendered BEFORE this act — the night nave
              returning mid-reading at a dramatic hinge. Use sparingly (earned pivots only). */
          interlude: z
            .object({ lat: z.string(), pl: z.string().optional(), ref: z.string().optional() })
            .optional(),
        }),
      )
      .default([]),
    /** Self-hosted concert film (selected fragments), rendered in the shared custom player.
        `src` is consumed by the controlled player; `poster` is a photo() base name
        (falls back to the hero bg). */
    video: z
      .object({ src: z.string(), caption: z.string().optional(), poster: z.string().optional() })
      .optional(),
    /** Named "obsada" credits for the detail page — role → person (conductor, the Jesuit
        who gives the opening word, light direction…). Rendered as a quiet colophon block. */
    credits: z.array(z.object({ role: z.string(), name: z.string() })).default([]),
    /** Multi-city tour dates. When present the detail page shows a "Wykonania" itinerary and
        JSON-LD emits one MusicEvent per date; single-date concerts keep using `date`/`venue`. */
    dates: z
      .array(
        z.object({
          date: z.string(), // ISO YYYY-MM-DD
          venue: z.string(), // full venue + city
          time: z.string().optional(), // e.g. "20:00"
        }),
      )
      .default([]),
    /** Documentary photographs from the evening (detail page gallery). Each `img` is a bare
        photo() base name; missing files are skipped at build (photoOptional), so a slot can be
        declared before the image is uploaded. */
    gallery: z
      .array(z.object({ img: z.string(), alt: z.string().optional(), caption: z.string().optional() }))
      .default([]),
    /** Florent-authored single reflection paragraph (concert page). */
    reflection: z.string().optional(),
    /** Author attribution for the reflection paragraph. */
    reflectionAttribution: z.string().optional(),
    /** OUR editorial bridge paragraph — rendered UNSIGNED, beneath the signed `reflection`.
        Never place editorial prose under `reflectionAttribution` (see concert-pages spec §1). */
    reflectionNote: z.string().optional(),
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
          /** Movement `id` this work belongs to (see concert-level `movements`). Consecutive
              items sharing an id sit under one act header. */
          movement: z.string().optional(),
          /** Vocal scoring as printed in the score, e.g. "a 8", "a12: SAATBB + SAATBB". */
          voicing: z.string().optional(),
          /** Duration as printed, e.g. "10′". */
          duration: z.string().optional(),
          /** Source / curatorial note for the work — one or two sentences on where it comes
              from and why it sits here (drawn from the ensemble's own programme book, factual,
              never a fabricated quote). Rendered as a quiet programme-book gloss. */
          note: z.string().optional(),
          /** Sung text in the original language (Latin / German / English…), verbatim. Store
              as a YAML block scalar to preserve line breaks. */
          text: z.string().optional(),
          /** Polish translation of `text`. */
          textPl: z.string().optional(),
          /** A clasp/refrain label rendered as a slim hairline row AFTER this item — used for
              "9 Kart", where Miserere returns between the psalms (e.g. "Miserere — część II"). */
          clasp: z.string().optional(),
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
