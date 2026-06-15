/**
 * @file navSearch.ts
 * @description Diacritic-insensitive navigation filtering shared by the desktop
 * Command Palette and the mobile search sheet, so both surfaces resolve a query
 * to the exact same destination set (one matching contract, zero drift).
 * @module widgets/panel-shell/lib
 * @architecture Enterprise SaaS 2026
 */

import type { TFunction } from "i18next";

import type { NavGroup, NavLinkItem } from "@/shared/config/navigation/dashboard.config";

export interface NavSearchHit {
  readonly group: NavGroup;
  readonly link: NavLinkItem;
}

type Translate = TFunction;

/**
 * Fold a string to a comparable form: lowercase, diacritics stripped
 * (Obecności → obecnosci) so a conductor typing on an ASCII keyboard still
 * resolves accented Polish labels.
 */
export const foldSearchText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const buildLinkHaystack = (
  group: NavGroup,
  link: NavLinkItem,
  t: Translate,
): string =>
  foldSearchText(
    [t(link.labelKey), t(group.labelKey), link.to.replace(/[/-]/g, " ")].join(
      " ",
    ),
  );

/**
 * Every authorised destination as a flat, ordered hit list. Used for keyboard
 * traversal (a single highlighted index across all groups).
 */
export const flattenNavGroups = (
  groups: readonly NavGroup[],
): readonly NavSearchHit[] =>
  groups.flatMap((group) => group.links.map((link) => ({ group, link })));

/**
 * Filter the flat hit list by a free-text query. Every whitespace-separated
 * token must match somewhere in the link's label / group / path (AND semantics),
 * which keeps multi-word queries ("proby obec") precise without a fuzzy library.
 * Empty query returns the full ordered list untouched.
 */
export const searchNavGroups = (
  groups: readonly NavGroup[],
  query: string,
  t: Translate,
): readonly NavSearchHit[] => {
  const tokens = foldSearchText(query).split(/\s+/).filter(Boolean);
  const hits = flattenNavGroups(groups);
  if (tokens.length === 0) return hits;

  return hits.filter(({ group, link }) => {
    const haystack = buildLinkHaystack(group, link, t);
    return tokens.every((token) => haystack.includes(token));
  });
};

/**
 * Re-group a flat hit list back into ordered, non-empty groups for sectioned
 * rendering (the mobile sheet keeps its grouped layout while filtering).
 */
export const groupNavHits = (
  hits: readonly NavSearchHit[],
): readonly { readonly group: NavGroup; readonly links: readonly NavLinkItem[] }[] => {
  const order: NavGroup[] = [];
  const byGroup = new Map<NavGroup, NavLinkItem[]>();

  for (const { group, link } of hits) {
    const bucket = byGroup.get(group);
    if (bucket) {
      bucket.push(link);
    } else {
      order.push(group);
      byGroup.set(group, [link]);
    }
  }

  return order.map((group) => ({ group, links: byGroup.get(group) ?? [] }));
};
