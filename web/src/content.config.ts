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
import { SCRIPTURE_BOOKS } from "./lib/scriptureRef";

/**
 * The vernacular of a foreign original — the slot `textPl` and `inscriptioPl` used to fill.
 *
 * THE SUFFIX THIS REPLACED MEANT TWO THINGS. `textPl` was never "the Polish variant of `text`" in
 * the i18n sense — it was the vernacular of a foreign original, and on the English page that slot
 * has to hold English. Adding `textEn` beside it would have put a locale and a piece of content
 * behind one suffix, with nothing to tell a later reader which `Pl` was which.
 *
 * IT IS POLISH-ONLY AND `.strict()` SAYS SO. Since stage C3 this file holds no translations at all
 * — `en` and `fr` live in `concerts.{en,fr}.yaml` under the copy desk's keys (lib/copyOverlay), so
 * that the one operation which rewrites this file by hand never has to open a map to add a locale.
 * Strict rather than stripped, because zod's default would drop a hand-added `en:` in silence and
 * the value would simply never appear on the page.
 */
const localized = z.object({ pl: z.string() }).strict();

/**
 * A citation under an incipit, stored structurally because every visible part of "Iz 11, 1" is a
 * language choice — see lib/scriptureRef, which owns the book abbreviations and the marks. Carries
 * a chapter-and-verse `scripture` list, a named `source` (an antiphon, an introit, a prayer — not
 * every incipit comes from a numbered verse), or both; an empty reference would print nothing at
 * all, so at least one is required.
 */
const scriptureRef = z
  .object({
    scripture: z
      .array(
        z.object({
          book: z.enum(SCRIPTURE_BOOKS),
          chapter: z.string(),
          /** Septuagint/Vulgate numbering, printed in parentheses ("Ps 98 (97)"). */
          chapterAlt: z.string().optional(),
          /** Verse groups: one entry per contiguous run ("Ps 84, 2–4. 7" is `["2–4", "7"]`),
              because the mark BETWEEN two groups is the one Polish sets as a full stop and
              English as a comma. */
          verses: z.array(z.string()).optional(),
        }),
      )
      .optional(),
    source: localized.optional(),
  })
  .refine((r) => (r.scripture?.length ?? 0) > 0 || r.source !== undefined, {
    message: "A reference needs a `scripture` citation, a named `source`, or both.",
  });

/**
 * A venue line ends with the place it stood in, and the landing's ledger reads that tail as a
 * proper name: everything after the last comma, printed as-is beside the count of evenings
 * (EnsembleSection's WHERE tile). So the tail must look like a place — an initial capital, then
 * letters, spaces, dots and hyphens ("Kraków", "Nowy Sącz", "Bielsko-Biała"). It is the street
 * and the building detail this rejects: "Bazylika NSPJ, ul. Kopernika 26, Kraków" is the order
 * the tile needs, and the same address written the other way round puts "ul. Kopernika 26" on
 * the landing under a numeral, silently and in a register that reads as a town.
 */
const PLACE_TAIL = /^\p{Lu}[\p{L}\s.-]*$/u;

const placeTail = (venue: string): string => venue.split(",").at(-1)?.trim() ?? "";

const concerts = defineCollection({
  loader: file("src/content/concerts.yaml"),
  schema: z.object({
    order: z.number(),
    roman: z.string(),
    latin: z.string(),
    title: z.string(),
    /** The place half of the presentational dateline ("Bazylika NSPJ, Kraków"), per locale. The
        date half is NOT stored: it is formatted from `date` (or, where the day is vague, from
        `dateLabel`) so that translating the line cannot carry a Polish date into English, and
        cannot drift from the structured value it restates. */
    metaPlace: localized,
    /** The dateline's date where there is no `date` to format — a tour across a year, a season.
        Copy, not a date, so it is held per locale ("jesień 2025" → "autumn 2025"). It is also
        what the via-rail's abbreviation falls back to when there is no `date` to shorten
        (`viaMoment`, lib/dates). */
    dateLabel: localized.optional(),
    /** Venue name alone — feeds schema.org Place.name (`metaPlace` is display-only). */
    venue: z.string().optional(),
    /** ISO date (YYYY-MM-DD) for schema.org startDate. Omitted when the date is vague
        (a season or bare year); JSON-LD then skips startDate rather than fabricate one. */
    date: z.string().optional(),
    /** Concert hour "HH:MM" for a single-date concert — shown after `meta` in the detail
        hero and folded into the JSON-LD startDate. Tour entries carry time per-date. */
    time: z.string().optional(),
    /** Street address of the venue (e.g. "ul. Kopernika 26, Kraków") — JSON-LD Place.address
        only; the visible page keeps the quieter `meta`/`venue` register. */
    address: z.string().optional(),
    /** What the door cost — JSON-LD `offers`/`isAccessibleForFree` only, never rendered.
        Set it ONLY where the ensemble actually recorded the answer: "free" emits a price-0
        Offer, "paid" emits the honest negative without inventing a ticket price, and leaving
        it unset emits neither. A touring concert states this per date instead (see `dates`),
        since one programme can be free in one city and ticketed in the next. */
    admission: z.enum(["free", "paid"]).optional(),
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
      .strict()
      .optional(),
    accent: z.string(),
    essence: z.string(),
    facts: z.array(z.string()).default([]),
    variant: z.enum(["default", "memoriam", "liturgy"]).default("default"),
    reverse: z.boolean().default(false),
    /** Pre-blurred station-card wash — photo() base name, generated by blur-stations.cjs and
        served raw (~4 kB) as a CSS background on /koncerty. Blurred to nothing, so it never
        needs responsive variants. */
    bg: z.string(),
    /** The station's photograph, used full-bleed on the detail-page hero — photo() base name,
        resolved through bleedPair (so `-desktop` / `-mobile` can be genuinely different frames,
        not two sizes of one). Names the SAME canonical file as `about.img` wherever the milestone
        and the hero can share a frame: one file, one emit, no duplicate original in dist. Two
        stations cannot, and name a purpose-cut `kd-*-hero` pair instead — see the note on each.
        Falls back to `<bg>-desktop` for stations with no separate canonical original (the
        liturgy plate). This is also the JSON-LD / OG image for the station (koncerty.astro),
        so it is the frame that stands for the evening off-site as well as on it. */
    heroImg: z.string().optional(),
    /** Extra black rising from the hero's bottom edge, 0–1, fading out by 60% height. The veil's
        standing gradients are shaped for a dark church interior, where the foot only has to seat
        the title; a frame carrying a SATURATED COLOUR in its foreground (Wołanie's red velvet
        seats) needs that foot deeper and taller, and needs it without touching the upper frame —
        a flat scrim would have dulled the raking light that is the reason to use the photograph.
        Per station: the six evenings have no single correct veil. */
    heroFoot: z.number().min(0).max(1).optional(),
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
    /** A quiet factual footnote for the WHOLE programme, rendered in the programme foot beside
        the standing texts/translations note. For what the work-list itself cannot carry — e.g.
        a touring concert whose instrumental interludes differed between evenings, so the list
        shows the ogniwa common to both. Facts only; the editorial voice belongs to programArc. */
    programNote: z.string().optional(),
    /** Overrides the standing provenance line under the programme ("Teksty łacińskie i
        oryginalne — z programów zespołu; przekłady polskie własne"). Set it whenever that
        sentence would not be true of THIS page — e.g. 9 Kart, whose Polish comes from the
        concert programme (the psalter the ensemble actually sang), not from us. Provenance is
        a claim like any other: it has to be right per page, so state less rather than guess. */
    textNote: z.string().optional(),
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
          /** The act's name in the reader's language, under the Latin. */
          gloss: localized,
          line: z.string().optional(),
          /** A full-bleed dark scripture beat rendered BEFORE this act — the night nave
              returning mid-reading at a dramatic hinge. Use sparingly (earned pivots only). */
          interlude: z
            .object({
              lat: z.string(),
              gloss: localized.optional(),
              ref: scriptureRef.optional(),
            })
            .optional(),
        }),
      )
      .default([]),
    /** Self-hosted concert film (selected fragments), rendered in the shared custom player.
        `asset` is resolved through `lib/videos.ts`; `poster` is a photo() base name
        (falls back to the hero bg). `portrait` switches the player to the height-driven 9:16
        frame for phone-shot audience documents (their caption + note hang as a plaque beside
        it); `note` is the honest provenance line — which work, whose recording. */
    video: z
      .object({
        asset: z.enum(["landing-modal", "landing-wolanie", "landing-aeternam"]),
        caption: z.string().optional(),
        note: z.string().optional(),
        poster: z.string().optional(),
        portrait: z.boolean().default(false),
      })
      .optional(),
    /** Named "obsada" credits for the detail page — role → person (conductor, the Jesuit
        who gives the opening word, light direction…). Rendered as a quiet colophon block. */
    credits: z.array(z.object({ role: z.string(), name: z.string() })).default([]),
    /** The voices of THIS evening — the singers as they stood that night, grouped by voice
        part. CONSENT SCOPE: names are cleared for concert pages ONLY — never reuse them on
        /o-nas, the landing or press materials. Line-ups are per-evening (guests, later
        departures), so never frame the list as the ensemble's fixed roster or "founders".
        `detail` glosses a group (e.g. which works the solo quartet joined); `note` is a
        quiet factual footnote for the whole block (e.g. the debut sung without fees). */
    roster: z
      .object({
        groups: z.array(
          z.object({
            voice: z.string(),
            names: z.array(z.string()),
            detail: z.string().optional(),
          }),
        ),
        note: z.string().optional(),
      })
      .optional(),
    /** Multi-city tour dates. When present the detail page shows a "Wykonania" itinerary and
        JSON-LD emits one MusicEvent per date; single-date concerts keep using `date`/`venue`. */
    dates: z
      .array(
        z.object({
          date: z.string(), // ISO YYYY-MM-DD
          venue: z.string(), // full venue + city
          time: z.string().optional(), // e.g. "20:00"
          /** Street address of THIS evening's venue — JSON-LD Place.address, same contract
              as the concert-level `address`. */
          address: z.string().optional(),
          /** Admission for THIS evening (see the concert-level `admission`). */
          admission: z.enum(["free", "paid"]).optional(),
        }),
      )
      .default([]),
    /** Documentary photographs from the evening (detail page gallery + the /obrazy archive).
        Each `img` is a bare photo() base name; missing files are skipped at build
        (photoOptional), so a slot can be declared before the image is uploaded.

        THE UNIT IS THE RUN, NOT THE FRAME. Consecutive entries sharing (moment, venue, date)
        form one run — the rehearsal, or a single city of a tour — and it is the RUN that carries
        an inscription on both surfaces (lib/galleryRuns). Everything a whole run shares is
        therefore stated per frame and read once: the place is not a sentence repeated under
        fifteen photographs, which is what these captions were before 2026-08-08. Frames are
        stored in the order they were taken, because the run boundary is derived from adjacency.

        `credit` is the photographer, and it is a FIELD rather than a substring of `caption`
        for the same reason: the gallery foot gathers the evening's photographers into one
        colophon and the lightbox sets the name in its own voice. It names a hand from OUTSIDE
        the ensemble, and an entry with neither `credit` nor `source` was taken by the ensemble
        itself — every surface prints that as "archiwum zespołu" (lib/photoCredit) instead of
        leaving the frame unattributed. Absence is therefore a claim rather than a gap, so a
        third-party frame always carries one of the two. */
    gallery: z
      .array(
        z.object({
          img: z.string(),
          alt: z.string().optional(),
          /** A note about THIS photograph and no other — the rare frame whose own subject needs
              stating. It is NOT the place: a caption that repeats across a run belongs in
              `venue`/`date`, where it is read once. Empty across the archive today, and that is
              the correct resting state rather than a gap to fill. */
          caption: z.string().optional(),
          credit: z.string().optional(),
          /** The outlet a frame comes from, where no individual photographer is on record —
              a title's own coverage of the evening. Held apart from `credit` because "fot."
              over a masthead credits it with an authorship nobody claimed; the surfaces label
              it "źródło:" and print it after the hands. Set one or the other, never both. */
          source: z.string().optional(),
          /** Which run this frame belongs to. `rehearsal` is set only where true — a rehearsal
              held in the concert's own church would otherwise merge into the evening itself,
              which venue alone cannot prevent. */
          moment: z.enum(["rehearsal", "concert"]).default("concert"),
          /** Display venue for this frame, set only where the evening had more than one — on a
              tour, which city a photograph comes from is a fact about the PHOTOGRAPH and cannot
              be derived from `dates`. Falls back to the concert's own `venue`. Deliberately
              shorter than `dates[].venue`, which carries the legal name for JSON-LD; this one is
              read in a run's inscription at 26px. */
          venue: z.string().optional(),
          /** ISO date (YYYY-MM-DD) of the evening this frame documents — again only where the
              concert has several. Falls back to the concert's `date`; a run whose date resolves
              to nothing prints its place alone rather than inventing one. */
          date: z.string().optional(),
          /** Opens its run as the PLATE on /obrazy — one photograph at up to 904px against the
              rest of the run at a third of that. The default is the run's first frame, which is
              right for nine of the ten runs because a run opens where the evening did. Set this
              only where the default is measurably wrong, and measure before setting it: the one
              case is `kd-hymn-0`, which led its run at mean luma 9 and p90 24 — a black
              rectangle standing 698px tall. Same lever, for the same reason, as `Path.frame` on
              the landing band (docs/web-imagines-spec.md §8). */
          plate: z.boolean().default(false),
        }),
      )
      .default([]),
    /** Verbum — the spoken threshold word: the live introduction given before the music
        begins (rite 01 on /koncerty). Distinct from `reflection` (the conductor's own
        authored note): this is someone else's live voice, transcribed and lightly edited
        for readability — edits are subtractive/corrective only, never paraphrase, and the
        page discloses the editing in a micro note. `quote` is a verbatim excerpt for the
        prominent blockquote; `text` is the full transcript behind a native reveal,
        `\n\n`-separated into paragraphs; `bridge` is OUR unsigned hand-off line closing
        the section (editorial register, not the speaker's). CONSENT: speaker consent
        covers the concert page — do not lift quotes to the landing or /koncerty without
        asking again. A film of the word (if any) joins later as a player under the
        transcript once its asset lands in assets/videos. */
    verbum: z
      .object({
        /** The speaker's name and title alone — "o." is "Fr" in English and "P." in French, so it
            is copy. The evening's date is appended from the concert's own `date` at render. */
        speaker: localized,
        quote: z.string(),
        text: z.string(),
        bridge: z.string().optional(),
      })
      .optional(),
    /** Florent-authored single reflection paragraph (concert page). */
    reflection: z.string().optional(),
    /** Author attribution for the reflection paragraph. */
    reflectionAttribution: z.string().optional(),
    /** OUR editorial bridge paragraph — rendered UNSIGNED, beneath the signed `reflection`.
        Never place editorial prose under `reflectionAttribution` (see concert-pages spec §1). */
    reflectionNote: z.string().optional(),
    /** Latin epigraph that opens the concert page (typically a biblical source). */
    inscriptio: z.string().optional(),
    /** The epigraph in the reader's language. Note that this slot ALSO carries a standalone
        editorial gloss where a work has no `inscriptio` at all ("tekst: H. M. MacGill (1876)",
        "aranżacja współczesna kolędy polskiej") — those entries are notes, not translations, and
        must be rendered per locale rather than translated back against a Latin that isn't there. */
    inscriptioGloss: localized.optional(),
    /** Structural citation for the inscription — see the `scriptureRef` note above. */
    inscriptioRef: scriptureRef.optional(),
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
          /** A rubric — what HAPPENED in the room while this work sounded, printed the way a
              missal prints its instructions: not what was sung, but what was done. Reserved for
              an action the ensemble's own run-sheet wrote against the work ("OTWARCIE OŁTARZA
              podczas utworu" — the Veit Stoss altarpiece opening under Elgar's Lux aeterna).
              It is a stage direction, so keep it short, past-tense and attestable: prose about
              the work belongs in `note`, and an action BETWEEN works is a `clasp`. */
          rubric: z.string().optional(),
          /** Sung text in the original language (Latin / German / English…), verbatim. Store
              as a YAML block scalar to preserve line breaks. */
          text: z.string().optional(),
          /** The sung text in the reader's language, per locale. Where a canonical published
              translation of a hymn exists, use it and credit it rather than inventing one — an
              invented English of "Es ist ein Ros'" reads as an error to anyone who knows the
              repertoire. Store as a YAML block scalar under each locale key. */
          textGloss: localized.optional(),
          /** A clasp/refrain label rendered as a slim hairline row AFTER this item — used for
              "9 Kart", where Miserere returns between the psalms (e.g. "Miserere — część II"). */
          clasp: z.string().optional(),
          /** The words the clasp actually sang, verbatim — for a clasp that is a performed
              fragment rather than a mere marker ("Przerwa" carries none). In 9 Kart each return
              of the Miserere brings the next two verses of Psalm 51, so the psalm runs across
              the whole programme exactly as the evening distributed it. Store as a block scalar. */
          claspText: z.string().optional(),
          /** The clasp's words in the reader's language, per locale. */
          claspTextGloss: localized.optional(),
          /** Liturgical incipit / source verse in Latin (concert page only). */
          inscriptio: z.string().optional(),
          /** The incipit in the reader's language — or, where there is no `inscriptio`, the
              work's standalone editorial gloss (see the concert-level field). */
          inscriptioGloss: localized.optional(),
          inscriptioRef: scriptureRef.optional(),
          bis: z.boolean().default(false),
        }),
      )
      .default([]),
  })
  /**
   * The landing's WHERE tile is DERIVED — it counts the evenings the register's five concerts
   * stood and names the places they stood in, so that a sixth concert adds itself instead of
   * rotting a hand-kept number (EnsembleSection). Both halves of that derivation read this file
   * and neither can tell a mistake from data, which is why they are guarded here rather than
   * described in a comment the person editing the YAML never opens.
   *
   * The failure both rules prevent is the same one and it is silent: the tile still renders, the
   * build still passes, and the page states something false about where this ensemble has sung.
   * That is the class of drift `lib/litany` refuses by failing the build over an ambiguous
   * surname, and this tile was the one derivation on the landing with no such floor.
   */
  .superRefine((concert, ctx) => {
    // The dateline is now half data and half copy, and the data half has two possible homes: an
    // ISO `date` the formatter renders, or a `dateLabel` for an evening whose day is genuinely
    // vague. With neither, the hero prints a place and no moment at all — and it prints it
    // cleanly, which is the same silent class of failure the venue rules below refuse.
    if (!concert.date && !concert.dateLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message:
          "A concert needs a `date` to format, or a `dateLabel` where the day is vague (a season," +
          " a bare year) — otherwise its dateline prints a place with no moment.",
      });
    }

    // A per-date venue is ONE evening in ONE place by definition, so a slash there is a tour
    // written into a single row — it would be counted once and named by its last city alone.
    for (const [index, date] of concert.dates.entries()) {
      if (date.venue.includes("/")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dates", index, "venue"],
          message:
            `"${date.venue}" names more than one place. A dates[] row is one evening — give each` +
            ` its own row, so the landing counts the evenings it actually stood.`,
        });
        continue;
      }
      const tail = placeTail(date.venue);
      if (!PLACE_TAIL.test(tail)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dates", index, "venue"],
          message:
            `"${date.venue}" must end with its town — the landing prints everything after the` +
            ` last comma as a place name, and here that is "${tail}".`,
        });
      }
    }

    if (concert.venue === undefined || concert.dates.length > 0) return;
    // With no dates[] the concert-level venue IS the evening, so a slash-joined line collapses a
    // tour into one night: 9 Kart's own "Kraków / Łódź / Rybnik" would count once and name Rybnik.
    if (concert.venue.includes("/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venue"],
        message:
          `"${concert.venue}" names more than one place, so this concert needs a dates[] row per` +
          ` evening — without them the landing counts it as a single night in the last city.`,
      });
      return;
    }
    const tail = placeTail(concert.venue);
    if (!PLACE_TAIL.test(tail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venue"],
        message:
          `"${concert.venue}" must end with its town — the landing prints everything after the` +
          ` last comma as a place name, and here that is "${tail}".`,
      });
    }
  }),
});

/** The catalogue holds no copy: composers, work titles and datings are names and structure. An
 *  era's heading and span are labels printed by two surfaces (/koncerty and the landing's litany
 *  plate) and live in `i18n/content/repertuar.ts` in all three locales — `eraName(id, locale)`. */
const repertoire = defineCollection({
  loader: file("src/content/repertoire.yaml"),
  schema: z.object({
    order: z.number(),
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
