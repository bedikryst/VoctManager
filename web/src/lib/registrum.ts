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
 * @architecture Astro islands 2026
 * @module lib/registrum
 */

/** The slice of a `concerts` collection entry the ribbons read (structural on purpose). */
export interface ConcertStation {
  readonly id: string;
  readonly data: {
    readonly order: number;
    readonly roman: string;
    readonly latin: string;
    readonly title: string;
    readonly accent: string;
    readonly viaDate: string;
    readonly hasPage: boolean;
    readonly venue?: string;
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
  /** The concert's dye — the accent hex straight from concerts.yaml; tints the row's
      silk. */
  readonly accent: string;
}

/** Page-bearing concerts only (a ribbon must not 404), in Via order. */
export const toRibbons = (concerts: readonly ConcertStation[]): RibbonEntry[] =>
  concerts
    .filter((e) => e.data.hasPage)
    .sort((a, b) => a.data.order - b.data.order)
    .map((e) => ({
      id: e.id,
      href: `/koncerty/${e.id}`,
      roman: e.data.roman,
      latin: e.data.latin,
      title: e.data.title,
      meta: `${e.data.about?.place ?? e.data.venue ?? ""} — ${e.data.viaDate}`,
      accent: e.data.accent,
    }));
