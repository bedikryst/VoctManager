/**
 * @file scopeGroups.ts
 * @description Turns the flat contents payload into the shape the desk reads it
 * in: families of pages, each family sorted by the title an editor knows it by.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/lib/scopeGroups
 */

import { FileText, Music2, type LucideIcon } from "lucide-react";

import type { CopyDeskScopeSummary } from "../types/copydesk.dto";

/**
 * A scope is the first two parts of a segment key (`concert.wcielenie`), so the
 * first part is the FAMILY of page it belongs to. The desk groups by it because
 * that is the only structure the key contract carries; stage G brings `page.*`
 * alongside today's `concert.*`.
 */
export const scopeFamily = (scope: string): string => scope.split(".")[0] ?? scope;

export interface CopyDeskScopeGroup {
  readonly family: string;
  readonly scopes: readonly CopyDeskScopeSummary[];
  readonly segments: number;
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
 * Alphabetical within a family, by the page's own title.
 *
 * The payload arrives ordered by scope KEY, which is the slug — so the six
 * concerts come back in an order that means nothing to a reader ("9-kart" then
 * "aeternam" then "bobola"). The site's own sequence is chronological and the
 * desk does not carry a date per page, so title order is the honest option: it
 * is at least the order somebody scanning for a title would look in.
 * `numeric` so a title that opens with a figure sorts as a number.
 */
export const groupScopes = (
  scopes: readonly CopyDeskScopeSummary[],
  language: string,
): readonly CopyDeskScopeGroup[] => {
  const collator = new Intl.Collator(language, {
    numeric: true,
    sensitivity: "base",
  });

  const byFamily = new Map<string, CopyDeskScopeSummary[]>();
  for (const scope of scopes) {
    const family = scopeFamily(scope.scope);
    const bucket = byFamily.get(family);
    if (bucket) {
      bucket.push(scope);
    } else {
      byFamily.set(family, [scope]);
    }
  }

  const rank = (family: string): number => {
    const index = FAMILY_ORDER.indexOf(family);
    return index === -1 ? FAMILY_ORDER.length : index;
  };

  return [...byFamily.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || collator.compare(a, b))
    .map(([family, entries]) => ({
      family,
      scopes: [...entries].sort((a, b) =>
        collator.compare(a.label || a.scope, b.label || b.scope),
      ),
      segments: entries.reduce((total, entry) => total + entry.segments, 0),
    }));
};

/**
 * A figure the way the reader's language writes it. The corpus runs to four
 * digits, and `1281` beside Polish prose is a number nobody typed.
 */
export const formatCount = (value: number, language: string): string =>
  new Intl.NumberFormat(language).format(value);
