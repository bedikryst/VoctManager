/**
 * @file foundationSupport.ts
 * @description The editorial selections /fundacja makes over facts that live elsewhere: which
 *  concert stands as the current work, which two stand as the record, the standing-order
 *  examples, and the documents the foundation actually has. Every fact about a concert is read
 *  from the corpus by id; every fact about the foundation from `data/foundation.ts`. This module
 *  only points.
 *
 *  THE CURRENT WORK IS CHOSEN, NEVER PICKED. `lib/cycle.upcomingStation` would hand the page the
 *  next evening automatically, and the page must not take it: a concert becomes the example of
 *  current work by a decision, because the words around it ("what we are preparing now") are a
 *  claim about the foundation's effort, not a calendar. Once the chosen evening has passed the
 *  page keeps the same concert and turns the sentence into the past tense at the next build —
 *  it never slides to a newer one on its own. The date logic is build-time, the same standing
 *  obligation `lib/cycle` documents: a deploy after the date is what changes the tense.
 *
 *  NO BUDGET. The brief (docs/specs/web-foundation-brief-2026-09.md §4B) defines a numeric
 *  appeal — line items, secured cash, remaining need, an "as of" date — and none of it has been
 *  approved. The qualitative cost state is a complete launch state, so nothing here holds a
 *  placeholder for numbers that do not exist.
 *
 *  NO REPORTS. The foundation has published no activity or financial report yet, and a shelf of
 *  disabled downloads is worse than no shelf. When a report is approved it is a link added here,
 *  named by type and year, and the documents list grows by one row.
 * @architecture Astro islands 2026
 * @module data/foundationSupport
 */

export interface FoundationSupport {
  /** The concert the costs band shows as current work — by corpus id. See the header. */
  readonly featuredConcertId: string;
  /** The two programmes the record shows, in the order they are printed. Corpus ids. */
  readonly recordConcertIds: readonly [string, string];
  /** Standing-order examples in PLN. Examples, not tiers, not minimums. */
  readonly monthlyExamples: readonly number[];
  /** The statute, as a public path under `web/public`. */
  readonly statutePath: string;
}

export const FOUNDATION_SUPPORT: FoundationSupport = {
  featuredConcertId: "pochwala-stworzenia",
  recordConcertIds: ["wcielenie", "9-kart"],
  monthlyExamples: [50, 100, 200],
  statutePath: "/docs/Statut-VoctFoundation.pdf",
};

/**
 * Whether the site points at /fundacja yet. The page is built and deployed in every state — this
 * only decides who is told about it. While `false` the page is `noindex` and reachable through
 * the two quiet doors the developer keeps open on purpose (the vault's closing line, the footers),
 * and everything that would announce it stays silent: the nav bar and the mobile card's fine print
 * (SiteChrome, StickyHeader), the second button on /o-nas's foundation band and that band's NGO
 * `url`, /kontakt's locus link (which falls back to /o-nas#fundacja), the landing's third door in
 * FinalSupportSection. Flip it once the page has passed its section-by-section review — and drop
 * the matching `/fundacja$` clause from the sitemap filter in `astro.config.mjs`, which is JS and
 * cannot read this flag (the integration lists noindex routes by hand, see its comment).
 */
export const FOUNDATION_PAGE_LINKED = false;
