/**
 * @file registrum.ts
 * @description Data layer for the "registrum" — the desktop concert navigation set as
 *  BREVIARY REGISTER RIBBONS beside an ink INDEX. A breviary carries its reader between
 *  places with narrow silk bookmarks hanging from the top of the block; on desktop the
 *  chrome hangs one MUTE silk per page-bearing concert under the KONCERTY link, and an
 *  index line (roman numeral · Polish title · place — via date) runs a hairline leader
 *  to each silk's tip — the silk marks, the index names. Everything a row shows already
 *  lives in concerts.yaml (SSoT) — this module only derives and never invents; silk
 *  lengths are NOT data (the no-crossing staircase is pure geometry, see registrum.css).
 *  Consumed by BOTH headers: SiteChrome.astro reads the collection itself; the landing's
 *  React StickyHeader receives the derived list as island props from index.astro. The
 *  concert shape is structural (NO astro:content import) so the types cross into the
 *  client island bundle without dragging server-only modules along.
 *
 *  THE ISLAND MUST IMPORT ONLY THE TYPE. `RibbonEntry` is the island's contract and
 *  `import type` is erased, which is what keeps this module's build-time reads — the copy
 *  overlay's two YAML files — out of the client bundle. Calling `toRibbons` from an island
 *  would ship both locales' prose to every reader; derive the list on the server and pass it
 *  as props, which is what index.astro does.
 * @architecture Astro islands 2026
 * @module lib/registrum
 */
import { concertKey, withOverlay } from "./copyOverlay";
import { viaMoment } from "./dates";
import type { Locale, LocalizedText } from "../i18n/config";

/** The slice of a `concerts` collection entry the ribbons read (structural on purpose). */
export interface ConcertStation {
  readonly id: string;
  readonly data: {
    readonly order: number;
    readonly roman: string;
    readonly latin: string;
    readonly title: string;
    readonly accent: string;
    readonly hasPage: boolean;
    readonly venue?: string;
    /** ISO day, where the evening has one. Every printed form of it is FORMATTED per locale. */
    readonly date?: string;
    /** The vague moment ("jesień 2025") an evening without a `date` states instead — copy, so it
        is a locale map whose translation lives in the overlay under `<id>.dateLabel`. */
    readonly dateLabel?: LocalizedText;
    readonly about?: { readonly place?: string };
  };
}

/** One row of the registrum — the markup in either header renders this verbatim. */
export interface RibbonEntry {
  readonly id: string;
  readonly href: string;
  readonly roman: string;
  readonly latin: string;
  readonly title: string;
  /** Index second line: short place — via date ("Bazylika NSPJ · Kraków — sty 2024"). */
  readonly meta: string;
  /** The via date alone ("sty 2024"). The mobile card's Via register sets it as the row's
      right-hand column, where the desktop index has room for the place and the card has not. */
  readonly viaDate: string;
  /** The concert's dye — the accent hex straight from concerts.yaml; tints the row's
      silk. */
  readonly accent: string;
}

/**
 * Page-bearing concerts only (a ribbon must not 404), in Via order, in `locale`.
 *
 * The title and the place are COPY and come from the copy desk's overlay, falling back per field
 * to the Polish the corpus holds — the same rule the rest of the site reads translations by. The
 * href stays the canonical Polish path: it is a base path, and the caller localizes it, because
 * only the caller knows which concerts are translated (`TRANSLATED_ROUTES`).
 *
 * THE VIA DATE IS DERIVED, not stored. It used to be a hand-written `viaDate` field, which put a
 * Polish month inside the corpus and would have printed "sty 2024" in the chrome of every English
 * and French concert page. ICU reproduces all four hand-written Polish values exactly, so the
 * field is gone and this is the one place the abbreviation is composed; the two evenings whose day
 * is genuinely vague carry no `date` at all and state a `dateLabel`, which is copy.
 */
export const toRibbons = (
  concerts: readonly ConcertStation[],
  locale: Locale,
): RibbonEntry[] =>
  concerts
    .filter((e) => e.data.hasPage)
    .sort((a, b) => a.data.order - b.data.order)
    .map((e) => {
      const say = (field: string, polish: string) =>
        withOverlay(concertKey(e.id, field), locale, polish);
      // One expression for both kinds of evening: a dated one formats its `date` and holds no
      // `dateLabel` key in the overlay, so the lookup misses and the formatted date stands; a
      // vague one ("jesień 2025") states copy, and the overlay is where its translation lives.
      const viaDate = say("dateLabel", viaMoment(e.data, locale));
      const place = e.data.about?.place
        ? say("about.place", e.data.about.place)
        : (e.data.venue ?? "");
      return {
        id: e.id,
        href: `/koncerty/${e.id}`,
        roman: e.data.roman,
        latin: e.data.latin,
        title: say("title", e.data.title),
        meta: `${place} — ${viaDate}`,
        viaDate,
        accent: e.data.accent,
      };
    });
