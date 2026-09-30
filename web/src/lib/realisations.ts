/**
 * @file realisations.ts
 * @description The foundation's work as /fundacja and /mecenat print it: each realisation resolved
 *  against the concert corpus into a fact sheet (when, where, who, what, within what, admission,
 *  budget, and the account once it exists), and the ensemble's record before the foundation
 *  counted from the same corpus. Both pages read these views; neither types a fact of its own.
 *
 *  EVERY NUMBER IS COMPUTED OR ENTERED ONCE. The budget and the account come from
 *  `data/foundationSupport.ts`, the dates, places, performers and composers from `concerts.yaml`,
 *  the record's counts from the corpus against `FOUNDATION.foundedOn`. Nothing here holds a figure.
 *
 *  THE TENSE IS BUILD-TIME. A realisation is `ahead` until the end of its concert's own day at the
 *  moment of the build — the rule `lib/cycle.upcomingStation` applies — so a deploy after the date
 *  is what turns both pages to the past tense.
 * @architecture Astro islands 2026
 * @module lib/realisations
 */
import type { ImageMetadata } from "astro";
import type { CollectionEntry } from "astro:content";

import { FOUNDATION } from "../data/foundation";
import { FEATURED_REALISATION, REALISATIONS, type Realisation } from "../data/foundationSupport";
import { localizePath, pickLocale, type Locale } from "../i18n/config";
import { concertKey, overlayValue } from "./copyOverlay";
import { cycleStations } from "./cycle";
import { INTL_LOCALE, longDate } from "./dates";
import { programmeSurnames } from "./litany";
import { bleedPair } from "./photos";

type Concert = CollectionEntry<"concerts">;
type Era = CollectionEntry<"repertoire">;

/** Whole złoty in the locale's grouping — "28 000", "28,000". The unit belongs to the sentence. */
export const formatPln = (amount: number, locale: Locale): string =>
  new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 }).format(amount);

export type AccountRowKey = "total" | "patrons" | "donors" | "partners" | "grants" | "own";

export interface RealisationView {
  readonly id: string;
  readonly year: string;
  /** Whether the concert is one of the numbered Koncerty Duchowe (lib/cycle) — the form the
      rubric names. */
  readonly cycle: boolean;
  readonly title: string;
  /** The concert's own accent — the only colour a foundation page carries. */
  readonly accent: string;
  readonly ahead: boolean;
  readonly dateIso: string;
  readonly when: string;
  readonly where: string;
  /** The ensemble first, then each named performer as "name, role". */
  readonly performers: readonly string[];
  /** The evening's forces counted, no names ("12 głosów · skrzypce · organy"), where confirmed. */
  readonly forces?: string;
  /** Composer surnames, `·`-joined, the returning piece last. A surname of several words is bound
      with no-break spaces, so "Vaughan Williams" never splits across a line. */
  readonly programme: string;
  readonly festival?: { readonly name: string; readonly url: string; readonly finale: boolean };
  readonly admission?: "free" | "paid";
  readonly budget: {
    readonly amount: string;
    readonly asOf: string;
    /** Formatted amounts by area id, only for the areas whose amount has been entered. */
    readonly areas: Readonly<Record<string, string>>;
  };
  readonly account?: {
    readonly asOf: string;
    readonly rows: readonly { readonly key: AccountRowKey; readonly amount: string }[];
  };
  readonly visual?: { readonly desktop: ImageMetadata; readonly mobile: ImageMetadata };
  /** The concert's page in this locale, where it has one. */
  readonly href?: string;
}

/** End of the concert's own day, so an evening happening today is still ahead all day. */
const isAhead = (iso: string, now: Date): boolean =>
  new Date(`${iso}T23:59:59`).getTime() >= now.getTime();

/**
 * The named hands of the evening. Credits carry a role and a name; `realizacja` is a free line
 * that is a performer only when it opens on an instrument ("Skrzypce: Radu Ropotan") and a
 * production credit when it opens on "Realizacja", which is not a performer and is left out.
 */
function performersOf(entry: Concert, lang: Locale): string[] {
  const c = entry.data;
  const say = (field: string, polish: string) => overlayValue(concertKey(entry.id, field), lang) ?? polish;
  const lower = (role: string) => role.toLocaleLowerCase(INTL_LOCALE[lang]);
  const out: string[] = [FOUNDATION.ensemble];
  c.credits.forEach((cr, i) => out.push(`${cr.name}, ${lower(say(`credits.${i}.role`, cr.role))}`));
  if (c.realizacja && !/^\s*realizacja\s*:/i.test(c.realizacja)) {
    const m = say("realizacja", c.realizacja).match(/^\s*([^:]{2,24}?)\s*:\s*(.+)$/);
    if (m?.[1] && m[2]) out.push(`${m[2]}, ${lower(m[1])}`);
  }
  return out;
}

function viewOf(
  realisation: Realisation,
  concerts: readonly Concert[],
  eras: Era[],
  lang: Locale,
  now: Date,
): RealisationView {
  const entry = concerts.find((c) => c.id === realisation.concertId);
  if (!entry) {
    throw new Error(`[realisations] "${realisation.id}" names concert "${realisation.concertId}", which is not in the corpus.`);
  }
  const c = entry.data;
  if (!c.date) {
    throw new Error(`[realisations] concert "${entry.id}" has no single \`date\`; a realisation is one dated evening.`);
  }
  const composers = [
    ...c.program.filter((p) => !p.bis).map((p) => p.composer),
    ...(c.ritornello ? [c.ritornello.composer] : []),
  ];
  const account = realisation.account;
  const areas = Object.fromEntries(
    Object.entries(realisation.budget.areasPln ?? {}).map(([id, pln]) => [id, formatPln(pln, lang)]),
  );
  return {
    id: realisation.id,
    year: c.date.slice(0, 4),
    cycle: c.cycle,
    title: overlayValue(concertKey(entry.id, "title"), lang) ?? c.title,
    accent: c.accent,
    ahead: isAhead(c.date, now),
    dateIso: c.date,
    when: c.time ? `${longDate(c.date, lang)}, ${c.time}` : longDate(c.date, lang),
    where: c.venue ?? pickLocale(c.metaPlace, lang),
    performers: performersOf(entry, lang),
    ...(c.forces ? { forces: overlayValue(concertKey(entry.id, "forces"), lang) ?? c.forces.pl } : {}),
    programme: programmeSurnames(composers, eras)
      .map((surname) => surname.replace(/ /g, " "))
      .join(" · "),
    ...(c.festival
      ? { festival: { name: c.festival.name, url: c.festival.url, finale: c.festival.role === "finale" } }
      : {}),
    ...(c.admission ? { admission: c.admission } : {}),
    budget: {
      amount: formatPln(realisation.budget.amountPln, lang),
      asOf: longDate(realisation.budget.asOf, lang),
      areas,
    },
    ...(account
      ? {
          account: {
            asOf: longDate(account.asOf, lang),
            rows: (
              [
                ["total", account.totalPln],
                ["patrons", account.patronsPln],
                ["donors", account.donorsPln],
                ["partners", account.partnersPln],
                ["grants", account.grantsPln],
                ["own", account.ownContributionPln],
              ] as const
            ).map(([key, pln]) => ({ key, amount: formatPln(pln, lang) })),
          },
        }
      : {}),
    ...(c.heroImg ? { visual: bleedPair(c.heroImg) } : {}),
    ...(c.hasPage ? { href: `${localizePath("/koncerty", lang)}/${entry.id}` } : {}),
  };
}

/** Every realisation, the featured one first and the rest newest first. */
export function realisationViews(
  concerts: readonly Concert[],
  eras: Era[],
  lang: Locale,
  now: Date = new Date(),
): RealisationView[] {
  const featured = REALISATIONS.find((r) => r.id === FEATURED_REALISATION);
  if (!featured) throw new Error(`[realisations] FEATURED_REALISATION "${FEATURED_REALISATION}" is not in REALISATIONS.`);
  const rest = REALISATIONS.filter((r) => r !== featured).reverse();
  return [featured, ...rest].map((r) => viewOf(r, concerts, eras, lang, now));
}

/** The featured realisation alone — what /mecenat presents. */
export function featuredRealisationView(
  concerts: readonly Concert[],
  eras: Era[],
  lang: Locale,
  now: Date = new Date(),
): RealisationView {
  const [featured] = realisationViews(concerts, eras, lang, now);
  if (!featured) throw new Error("[realisations] REALISATIONS is empty.");
  return featured;
}

// ── The ensemble's record before the foundation ──────────────────────────────────────────────

export interface EnsembleRecord {
  /** First and last year the record spans. */
  readonly from: string;
  readonly to: string;
  readonly programmes: number;
  /** Evenings — a programme sung in three cities is three concerts. */
  readonly concerts: number;
  /** Evenings whose admission is recorded as free; an unrecorded one is not counted. */
  readonly free: number;
  readonly years: readonly {
    readonly year: string;
    readonly items: readonly { readonly title: string; readonly href?: string }[];
  }[];
}

/**
 * The numbered cycle's evenings dated before `FOUNDATION.foundedOn`. The line never moves, so the
 * counts never change once the corpus is complete — and they are exact, which a hand-typed tally
 * that mixed the two periods was not.
 */
export function recordBeforeFoundation(concerts: readonly Concert[], lang: Locale): EnsembleRecord {
  const hrefConcerts = localizePath("/koncerty", lang);
  const programmes = cycleStations(concerts)
    .map((entry) => {
      const c = entry.data;
      const evenings = (
        c.dates.length > 0
          ? c.dates.map((d) => ({ date: d.date, admission: d.admission ?? c.admission }))
          : c.date
            ? [{ date: c.date, admission: c.admission }]
            : []
      ).filter((e) => e.date < FOUNDATION.foundedOn);
      return { entry, evenings: evenings.sort((a, b) => a.date.localeCompare(b.date)) };
    })
    .filter((p) => p.evenings.length > 0)
    .sort((a, b) => (a.evenings[0]?.date ?? "").localeCompare(b.evenings[0]?.date ?? ""));

  const evenings = programmes.flatMap((p) => p.evenings);
  const years = [...new Set(programmes.map((p) => p.evenings[0]?.date.slice(0, 4) ?? ""))].sort();
  const first = years[0];
  const last = years[years.length - 1];
  if (!first || !last) throw new Error("[realisations] no cycle concert is dated before the foundation.");

  return {
    from: first,
    to: last,
    programmes: programmes.length,
    concerts: evenings.length,
    free: evenings.filter((e) => e.admission === "free").length,
    years: years.map((year) => ({
      year,
      items: programmes
        .filter((p) => p.evenings[0]?.date.startsWith(year))
        .map(({ entry }) => {
          const title = overlayValue(concertKey(entry.id, "title"), lang) ?? entry.data.title;
          const subtitle = entry.data.subtitle
            ? (overlayValue(concertKey(entry.id, "subtitle"), lang) ?? entry.data.subtitle.pl)
            : undefined;
          return {
            title: subtitle ? `${title} — ${subtitle}` : title,
            ...(entry.data.hasPage ? { href: `${hrefConcerts}/${entry.id}` } : {}),
          };
        }),
    })),
  };
}

/**
 * Fails the build when a count would need a different Polish form than the sentence around it was
 * written in ("24 osoby przekazują" but "25 osób przekazuje"). Polish is the source; the other
 * locales' copy is written against the same number by the desk.
 */
export function assertPolishForm(count: number, form: "one" | "few" | "many", where: string): void {
  const actual = new Intl.PluralRules("pl-PL").select(count);
  if (actual !== form) {
    throw new Error(
      `[realisations] ${where}: ${count} takes the Polish "${actual}" form, but the copy is written in the "${form}" form. Rewrite the sentence for this number.`,
    );
  }
}
