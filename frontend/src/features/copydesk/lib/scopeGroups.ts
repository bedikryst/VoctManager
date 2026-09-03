/**
 * @file scopeGroups.ts
 * @description Turns the flat contents payload into the shape the desk reads it
 * in: families of pages, each family sorted by the title an editor knows it by.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/lib/scopeGroups
 */

import { FileText, Music2, type LucideIcon } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import type { CopyDeskScopeSummary } from "../types/copydesk.dto";

/**
 * A scope is the first two parts of a segment key (`concert.wcielenie`), so the
 * first part is the FAMILY of page it belongs to. The desk groups by it because
 * that is the only structure the key contract carries; stage G brings `page.*`
 * alongside today's `concert.*`.
 */
export const scopeFamily = (scope: string): string => scope.split(".")[0] ?? scope;

/**
 * Whether a page still wants this reader's eyes.
 *
 * Three cases, one predicate: they have never declared it read, something has
 * appeared on it since they did, or something that was already there has moved.
 * All three are comparisons the server makes against one watermark — nothing
 * here is a state anybody maintains, which is why the list needs no tick-boxes.
 *
 * `stale` is deliberately absent. A translation whose Polish has moved is work
 * outstanding, and it does not clear by being read: folding it in would make a
 * page that can never leave the pending half however often its reader goes
 * through it. It stays a count on the row, on whichever side the row sits.
 */
export const isPendingReview = (scope: CopyDeskScopeSummary): boolean =>
  scope.seen_at === null || scope.new > 0 || scope.changed > 0;

export interface CopyDeskScopeSplit {
  /** Never read, or moved since it was. */
  readonly pending: readonly CopyDeskScopeSummary[];
  /** Read, and nothing has happened to it since. */
  readonly reviewed: readonly CopyDeskScopeSummary[];
}

/**
 * Families the desk has a name for, in the order it prints them. A family that
 * is not here keeps its raw prefix as its heading — visible, and therefore
 * fixable, the day a new one appears; inventing a label for it would be a
 * heading nobody wrote.
 */
const FAMILY_ORDER: readonly string[] = ["concert"];

export const FAMILY_LABELS: Readonly<
  Record<string, { readonly key: string; readonly fallback: string }>
> = {
  concert: { key: "copy_desk.families.concert", fallback: "Koncerty" },
};

/**
 * Same map as the labels, and in the same place for the same reason: the
 * contents list and the reviewer's queue both head a page with it, and two
 * private copies is how one surface starts marking a concert with a different
 * glyph than the other. A family the desk has no icon for keeps the neutral one.
 */
const FAMILY_ICONS: Readonly<Record<string, LucideIcon>> = {
  concert: Music2,
};

export const familyIcon = (family: string): LucideIcon =>
  FAMILY_ICONS[family] ?? FileText;

/**
 * The two halves the desk opens on, each in reading order.
 *
 * The division is by review state rather than by family, because that is the
 * question an editor arrives with — where is there something I have not looked
 * at — and it answers it before they have read a single title. Family survives
 * as the first sort key and as the glyph on the row, which is as much structure
 * as a corpus of a dozen pages can carry without a second level of nesting.
 *
 * Within a family: alphabetical by the page's own title. The payload arrives
 * ordered by scope KEY, which is the slug — so the six concerts come back in an
 * order that means nothing to a reader ("9-kart" then "aeternam" then "bobola").
 * The site's own sequence is chronological and the desk does not carry a date
 * per page, so title order is the honest option: it is at least the order
 * somebody scanning for a title would look in. `numeric` so a title that opens
 * with a figure sorts as a number.
 */
export const splitScopes = (
  scopes: readonly CopyDeskScopeSummary[],
  language: string,
): CopyDeskScopeSplit => {
  const collator = new Intl.Collator(language, {
    numeric: true,
    sensitivity: "base",
  });

  const rank = (family: string): number => {
    const index = FAMILY_ORDER.indexOf(family);
    return index === -1 ? FAMILY_ORDER.length : index;
  };

  const inReadingOrder = (
    entries: readonly CopyDeskScopeSummary[],
  ): readonly CopyDeskScopeSummary[] =>
    [...entries].sort(
      (a, b) =>
        rank(scopeFamily(a.scope)) - rank(scopeFamily(b.scope)) ||
        collator.compare(scopeFamily(a.scope), scopeFamily(b.scope)) ||
        collator.compare(a.label || a.scope, b.label || b.scope),
    );

  return {
    pending: inReadingOrder(scopes.filter(isPendingReview)),
    reviewed: inReadingOrder(scopes.filter((scope) => !isPendingReview(scope))),
  };
};

/**
 * A figure the way the reader's language writes it. The corpus runs to four
 * digits, and `1281` beside Polish prose is a number nobody typed.
 */
export const formatCount = (value: number, language: string): string =>
  new Intl.NumberFormat(language).format(value);

/**
 * The day a watermark carries. A day and not a timestamp: nobody reads a page
 * twice in a minute, and the two surfaces that print it — the contents row and
 * the mark at the foot of a page — have to print the same words.
 */
export const seenOnDate = (seenAt: string, language: string): string =>
  formatLocalizedDate(
    seenAt,
    { year: "numeric", month: "long", day: "numeric" },
    language,
  );
