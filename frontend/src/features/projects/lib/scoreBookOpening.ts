/**
 * @file scoreBookOpening.ts
 * @description Selects a book's initial page and checks whether it binds a programme item.
 */
import type { ScoreBookMap } from "../api/project.service";

export const boundItemPage = (map: ScoreBookMap, order: number): number | null => {
  const item = map.items.find((entry) => entry.order === order);
  return map.available && item && map.pages.some((page) => page.page >= item.first_page && page.page <= item.last_page)
    ? item.first_page
    : null;
};

export const bookOpeningPage = (target: number | null, stored: string | null, first: number | undefined): number => {
  if (target !== null) return target;
  const remembered = Number(stored);
  return Number.isSafeInteger(remembered) && remembered > 0 ? remembered : (first ?? 1);
};
