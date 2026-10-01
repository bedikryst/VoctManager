/**
 * @file foundationSupport.ts
 * @description The editorial selections /fundacja and /mecenat make over facts that live
 *  elsewhere: which concerts are the foundation's realisations and which of them leads, what each
 *  cost and — once it is known — who paid for it, the documents the foundation actually has, and
 *  the switches that wait on a person (the page's announcement, the tax line).
 *  Every fact about a concert is read from the corpus by id; every fact about the foundation from
 *  `data/foundation.ts`. Spec: docs/specs/web-foundation-rebuild-2026-09.md.
 *
 *  A REALISATION IS CHOSEN, NEVER PICKED. `lib/cycle.upcomingStation` would hand the page the next
 *  evening automatically, and the page must not take it: a concert becomes the foundation's
 *  realisation by a decision, because the words around it are a claim about the foundation's own
 *  effort. Once the evening has passed the module keeps the same concert and turns to the past
 *  tense at the next build (build-time, the standing obligation `lib/cycle` documents).
 *
 *  THE BUDGET IS PUBLISHED, THE GATEWAY IS NOT. A realisation carries the cost the board confirmed
 *  and the date it was confirmed on — never an amount raised, a shortfall or a progress figure.
 *  The account (who paid, by source) is entered once the numbers exist, and is the one recurring
 *  duty these pages create: a few lines per concert.
 *
 *  THE RECORD IS NOT HERE. The ensemble's evenings before the foundation are computed from the
 *  corpus against `FOUNDATION.foundedOn` (lib/realisations), so no list of ids can go stale.
 * @architecture Astro islands 2026
 * @module data/foundationSupport
 */

import type { BoardMember } from "./foundation";

/** What a realisation was budgeted at, as the board confirmed it. */
export interface RealisationBudget {
  /** Whole złoty, gross. Printed rounded as "ok. …" — it is a production budget, not an invoice. */
  readonly amountPln: number;
  /** ISO date the amount was confirmed on — printed beside it, so a later change is visible. */
  readonly asOf: string;
  /**
   * What each area a patron may take on costs, keyed by the area's id in `mecenat.yaml`
   * (`realisation.areas[].id`). Entered only once the line breakdown is confirmed; an area with
   * no amount prints its name alone, so a partial breakdown is honest as far as it goes.
   */
  readonly areasPln?: Readonly<Record<string, number>>;
}

/** Who paid for a realisation, in whole złoty, gross. Every source is printed, zeros included. */
export interface RealisationAccount {
  readonly asOf: string;
  readonly totalPln: number;
  readonly patronsPln: number;
  readonly donorsPln: number;
  readonly partnersPln: number;
  readonly grantsPln: number;
  readonly ownContributionPln: number;
}

export interface Realisation {
  /** The copy key this realisation's lead is written under, in both pages' YAML. */
  readonly id: string;
  /** The concert, by corpus id. */
  readonly concertId: string;
  readonly budget: RealisationBudget;
  /** Entered after the concert, once the costs and their sources are known. */
  readonly account?: RealisationAccount;
}

/** The foundation's realisations, oldest first — their position is the number the page prints. */
export const REALISATIONS: readonly Realisation[] = [
  {
    id: "pochwala-stworzenia",
    concertId: "pochwala-stworzenia",
    budget: { amountPln: 28000, asOf: "2026-09-24" },
  },
];

/** The realisation /fundacja leads with and /mecenat presents. */
export const FEATURED_REALISATION: Realisation["id"] = "pochwala-stworzenia";

/**
 * The monthly amount the donation module scales a budget against ("…tyle, ile w ciągu roku
 * przekazują N osoby, wpłacając po 100 zł miesięcznie"). An example, not a tier or a minimum.
 */
export const SCALE_MONTHLY_PLN = 100;

/**
 * The board member who answers about patronage, by id — named on /fundacja and /mecenat, and
 * addressed on /mecenat at their own `mail`. The /fundacja sentence that names them is declined
 * Polish copy (`support.mecenat.body`), so changing this id means rewriting that sentence too.
 */
export const MECENAT_CONTACT: BoardMember["id"] = "ania";

/** The statute, as a public path under `web/public`. */
export const STATUTE_PATH = "/docs/Statut-VoctFoundation.pdf";

/**
 * Whether the accountant has confirmed in writing that the page may say donations are deductible
 * (spec D8). The sentence is written and waits in the copy; a wrong tax claim harms the donor.
 */
export const TAX_LINE_CONFIRMED = false;

/**
 * Whether the site points at /fundacja and /mecenat yet. Both pages are built and deployed in
 * every state — this only decides who is told about them. While `false` both are `noindex` and
 * reachable through the doors the developer keeps open on purpose (the vault's closing line, the
 * footers, a link sent to a patron), and everything that would announce them stays silent: the
 * nav bar and the mobile card's fine print (SiteChrome, StickyHeader), the second button on
 * /o-nas's foundation band, the foundation's JSON-LD `url` (lib/foundationSchema, which points at
 * /o-nas#fundacja until then), /kontakt's locus link (which falls back to
 * /o-nas#fundacja), the landing's third door in FinalSupportSection. Flip it once the pages have
 * passed their review — and drop the matching `/(fundacja|mecenat)$` clause from the sitemap
 * filter in `astro.config.mjs`, which is JS and cannot read this flag.
 */
export const FOUNDATION_PAGE_LINKED = false;
