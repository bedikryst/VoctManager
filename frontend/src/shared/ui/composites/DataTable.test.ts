/**
 * @file DataTable.test.ts
 * @description The table's sort contract: the `ordering` spelling it reads
 * from the URL, and the in-memory order it gives rows that arrive whole.
 * @module shared/ui/composites/DataTable.test
 */

import { describe, expect, it } from "vitest";

import { formatSort, parseSort, sortRows, type DataTableColumn } from "./DataTable";

interface Row {
  readonly name: string;
  readonly amount: number | null;
}

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Name", cell: (row) => row.name, sortValue: (row) => row.name },
  { id: "amount", header: "Amount", cell: (row) => row.amount, sortValue: (row) => row.amount },
  { id: "plain", header: "Plain", cell: (row) => row.name },
];

const rows: Row[] = [
  { name: "Żak", amount: 200 },
  { name: "adam", amount: null },
  { name: "Łucja", amount: 1000 },
  { name: "Ewa", amount: 200 },
];

const names = (sorted: readonly Row[]): string[] => sorted.map((row) => row.name);

describe("sort params", () => {
  it("reads and writes the ordering spelling", () => {
    expect(parseSort("-amount")).toEqual({ key: "amount", direction: "desc" });
    expect(parseSort("name")).toEqual({ key: "name", direction: "asc" });
    expect(parseSort(null)).toBeNull();
    expect(formatSort({ key: "amount", direction: "desc" })).toBe("-amount");
  });
});

describe("sortRows", () => {
  it("orders text the Polish way, ignoring case", () => {
    expect(names(sortRows(rows, columns, { key: "name", direction: "asc" }))).toEqual([
      "adam",
      "Ewa",
      "Łucja",
      "Żak",
    ]);
  });

  it("keeps ties in arrival order and puts nothing last in both directions", () => {
    expect(names(sortRows(rows, columns, { key: "amount", direction: "desc" }))).toEqual([
      "Łucja",
      "Żak",
      "Ewa",
      "adam",
    ]);
    expect(names(sortRows(rows, columns, { key: "amount", direction: "asc" }))).toEqual([
      "Żak",
      "Ewa",
      "Łucja",
      "adam",
    ]);
  });

  it("leaves rows as they came for an unknown or unsortable key", () => {
    expect(sortRows(rows, columns, { key: "missing", direction: "asc" })).toBe(rows);
    expect(sortRows(rows, columns, { key: "plain", direction: "asc" })).toBe(rows);
    expect(sortRows(rows, columns, null)).toBe(rows);
  });
});
