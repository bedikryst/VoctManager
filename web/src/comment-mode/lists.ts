/**
 * @file lists.ts
 * @description The page's fields as lists, for what a tap cannot reach or the editor wants to find
 *  again. Both open in the sheet from the bar's menu, and picking a row opens its editor.
 *  - "Moje propozycje na tej stronie": every field carrying the editor's proposal that a tap on
 *    this page can open, in document order, then the page's own ones with nothing to tap (a meta
 *    description). A shared word's fields are not among them: nothing says the page prints them.
 *  - "Pozostałe teksty": the page's own fields (its scope, by path) with no occurrence on show:
 *    the meta title and description, `alt`s, JSON-LD and `data-*` values, the rite's words once
 *    the preloader is gone, text inside a closed overlay, a field lying inside another field's
 *    span. Edited from the list, without a preview.
 *
 *  "On show" means the text takes room and is not `visibility: hidden` (the vault's closed state).
 *  Opacity is not asked: the site fades text in as it scrolls into view, and that text is there.
 * @module comment-mode/lists
 */

import type { IndexRow } from "./api";
import { button, el, fill } from "./dom";
import { htmlText } from "./match";
import { rangeOf, type PageScan, type Pinned } from "./pageText";
import type { Strings } from "./strings";

export interface ListedField {
  readonly row: IndexRow;
  /** Where the field is on show, for the sheet to bring into view; `null` when nowhere. */
  readonly range: Range | null;
}

export interface PageFields {
  readonly mine: readonly ListedField[];
  readonly rest: readonly IndexRow[];
  /** The page has fields of its own scope. */
  readonly hasOwn: boolean;
  /** Some field of any scope is on the page. */
  readonly hasAny: boolean;
}

export type ListKind = "mine" | "rest";

/** The text takes room and is not hidden by `visibility`. */
function isShown(range: Range): boolean {
  const node = range.startContainer;
  const element = node instanceof Element ? node : node.parentElement;
  if (!element) return false;
  const rect = range.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  return window.getComputedStyle(element).visibility === "visible";
}

function byPosition(a: ListedField, b: ListedField): number {
  if (!a.range || !b.range) return Number(a.range === null) - Number(b.range === null);
  return a.range.compareBoundaryPoints(Range.START_TO_START, b.range);
}

/** Sort the page's fields into the two lists. Only spans that matter to either are measured. */
export function pageFields(
  rows: readonly IndexRow[],
  scan: PageScan,
  pinned: Pinned,
  ownScope: string | null,
): PageFields {
  const shown = new Set<IndexRow>();
  const found: ListedField[] = [];

  for (const occurrence of scan.occurrences) {
    const mine = occurrence.candidates.filter((row) => row.mine !== null);
    const own = occurrence.fields.some((row) => row.scope === ownScope);
    if (mine.length === 0 && !own) continue;
    const range = rangeOf(scan, occurrence);
    if (!range || !isShown(range)) continue;
    for (const row of occurrence.fields) shown.add(row);
    for (const row of mine) found.push({ row, range });
  }
  for (const [element, row] of pinned) {
    const range = document.createRange();
    range.selectNodeContents(element);
    if (!isShown(range)) continue;
    shown.add(row);
    found.push({ row, range });
  }

  found.sort(byPosition);
  const seen = new Set<IndexRow>();
  const mine: ListedField[] = [];
  for (const entry of found) {
    if (seen.has(entry.row)) continue;
    seen.add(entry.row);
    mine.push(entry);
  }
  const own = rows.filter((row) => row.scope === ownScope);
  for (const row of own) {
    if (row.mine !== null && !seen.has(row)) mine.push({ row, range: null });
  }

  return {
    mine,
    rest: own.filter((row) => !shown.has(row)),
    hasOwn: own.length > 0,
    hasAny: scan.occurrences.length > 0 || pinned.size > 0,
  };
}

/** What changes a list's look: re-rendering an unchanged one would only lose its scroll. */
export function listSignature(kind: ListKind, fields: PageFields): string {
  const rows = kind === "mine" ? fields.mine.map((entry) => entry.row) : fields.rest;
  return [kind, ...rows.map((row) => `${row.id}:${row.mine?.status ?? ""}:${row.mine?.value ?? ""}`)].join("|");
}

function plain(row: IndexRow, value: string): string {
  return row.kind === "HTML" ? htmlText(value) : value;
}

function item(
  row: IndexRow,
  text: string,
  state: string,
  scope: string,
  pick: () => void,
): HTMLElement {
  const control = button("", pick, "btn list-item");
  fill(
    control,
    el("span", "list-label", row.label || row.key),
    scope ? el("span", "list-scope", scope) : null,
    state ? el("span", "list-state", state) : null,
    text ? el("span", "list-text", text) : null,
  );
  return el("li", "", control);
}

function stateOf(row: IndexRow, s: Strings): string {
  if (row.mine === null) return "";
  return row.mine.status === "ACCEPTED" ? s.statusAccepted : s.statusOpen;
}

/**
 * "Moje propozycje na tej stronie": each with its state and the proposal's text. `pick` gets the
 * row alone: the list outlives page reads that leave its look unchanged, so where the field is on
 * show is asked when it is picked.
 */
export function mineList(
  fields: PageFields,
  ownScope: string | null,
  s: Strings,
  pick: (row: IndexRow) => void,
): Node[] {
  if (fields.mine.length === 0) return [el("p", "note", s.mineEmpty)];
  return [
    el(
      "ul",
      "list",
      ...fields.mine.map((entry) =>
        item(
          entry.row,
          plain(entry.row, entry.row.mine?.value ?? ""),
          stateOf(entry.row, s),
          entry.row.scope === ownScope ? "" : entry.row.scope_label,
          () => pick(entry.row),
        ),
      ),
    ),
  ];
}

/** "Pozostałe teksty": the page's own fields nothing on show prints, with what they say now. */
export function restList(fields: PageFields, s: Strings, pick: (row: IndexRow) => void): Node[] {
  if (!fields.hasOwn) return [el("p", "note", fields.hasAny ? s.noOwnFields : s.notInDesk)];
  if (fields.rest.length === 0) return [el("p", "note", s.allVisible)];
  return [
    el("p", "note", s.restIntro),
    el(
      "ul",
      "list",
      ...fields.rest.map((row) =>
        item(row, plain(row, row.value || row.fallback_value), stateOf(row, s), "", () => pick(row)),
      ),
    ),
  ];
}
