/**
 * @file rosterScope.ts
 * @description The roster's list state as a query string, so a reload, a link
 * and the way back from a singer's preview keep the section, the search and
 * the filters.
 *
 * The section is the page's partition, a tab (`?sekcja=alty`), and tabs are
 * links: it is read from the address whenever it changes. The rest is typed
 * and picked on the page, so the page reads it once on arrival and mirrors it
 * back into the address as it changes (`useArtistData`), the way the library
 * does.
 *
 * The quick filters (`only`) are the roster's exceptions, one at a time, each
 * a chip that names its size. All but the archive narrow the active roster;
 * the archive is the list of archived members, who leave the roster's
 * default list.
 * @module features/artists/lib/rosterScope
 */

import type { Artist } from "@/shared/types";

import type { SectionKey } from "../constants/voiceSections";
import { isAwaitingActivation, isWithoutPush } from "./accountState";
import { isRangeFilter, matchesRangeFilter, type RangeFilter } from "./vocalRangeProposal";

export type RosterSort = "name" | "section" | "skill";

export type RosterQuickFilter = "pending" | "range" | "archived" | "no_push";

/** The chips' order on the census line. */
export const ROSTER_QUICK_FILTERS: readonly RosterQuickFilter[] = [
  "pending",
  "range",
  "archived",
  "no_push",
];

/**
 * Who each quick filter keeps. The range chip keeps exactly what the range
 * filter's "awaiting" option keeps, so the chip's count and that option agree.
 */
export const matchesQuickFilter = (artist: Artist, filter: RosterQuickFilter): boolean => {
  if (filter === "archived") return !artist.is_active;
  if (!artist.is_active) return false;
  if (filter === "pending") return isAwaitingActivation(artist);
  if (filter === "range") return matchesRangeFilter(artist, "awaiting");
  return isWithoutPush(artist);
};

/** The filters picked on the page, everything but the section. */
export interface RosterFilters {
  readonly search: string;
  readonly range: RangeFilter;
  readonly sort: RosterSort;
  readonly only: RosterQuickFilter | "";
}

const SECTION_PARAM = "sekcja";

const PARAM: Readonly<Record<keyof RosterFilters, string>> = {
  search: "q",
  range: "range",
  sort: "sort",
  only: "only",
};

/** The section's word in the address, Polish like the page it names. */
const SECTION_SLUG: Readonly<Record<SectionKey, string>> = {
  S: "soprany",
  A: "alty",
  T: "tenory",
  B: "basy",
};

const sectionFromSlug = (slug: string | null): SectionKey | "" => {
  const match = (Object.keys(SECTION_SLUG) as SectionKey[]).find(
    (key) => SECTION_SLUG[key] === slug,
  );
  return match ?? "";
};

const isSort = (value: string | null): value is RosterSort =>
  value === "name" || value === "section" || value === "skill";

const isQuickFilter = (value: string | null): value is RosterQuickFilter =>
  (ROSTER_QUICK_FILTERS as readonly (string | null)[]).includes(value);

export const sectionFromParams = (params: URLSearchParams): SectionKey | "" =>
  sectionFromSlug(params.get(SECTION_PARAM));

export const rosterFiltersFromParams = (params: URLSearchParams): RosterFilters => {
  const range = params.get(PARAM.range);
  const sort = params.get(PARAM.sort);
  const only = params.get(PARAM.only);
  return {
    search: params.get(PARAM.search) ?? "",
    range: isRangeFilter(range) ? range : "all",
    sort: isSort(sort) ? sort : "name",
    only: isQuickFilter(only) ? only : "",
  };
};

/**
 * The roster's query string, without its "?": the section first, then only
 * the filters in use, so the whole roster keeps a bare address. The tabs and
 * the mirror build it the same way, so a tab's link is the address the mirror
 * would write.
 */
export const rosterQuery = (section: SectionKey | "", filters: RosterFilters): string => {
  const params = new URLSearchParams();
  if (section) params.set(SECTION_PARAM, SECTION_SLUG[section]);
  const search = filters.search.trim();
  if (search) params.set(PARAM.search, search);
  if (filters.range !== "all") params.set(PARAM.range, filters.range);
  if (filters.sort !== "name") params.set(PARAM.sort, filters.sort);
  if (filters.only) params.set(PARAM.only, filters.only);
  return params.toString();
};
