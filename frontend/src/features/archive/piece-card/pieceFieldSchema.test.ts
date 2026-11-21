/**
 * @file pieceFieldSchema.test.ts
 * @description Guards the clause of the card's field limits that fails
 * silently: `composition_year` has to parse `null` and a cleared row.
 * @module features/archive/piece-card/pieceFieldSchema.test
 */

import { describe, expect, it } from "vitest";

import { pieceFieldSchema } from "./pieceFieldSchema";

const parseYear = (value: unknown) => pieceFieldSchema.shape.composition_year.safeParse(value);

describe("pieceFieldSchema.composition_year", () => {
  it("accepts a piece that has no year", () => {
    const result = parseYear(null);
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBeNull();
  });

  it("reads a cleared row as no year", () => {
    const result = parseYear("");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBeNull();
  });

  it("coerces the typed string", () => {
    const result = parseYear("1723");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(1723);
  });

  it("refuses a year outside the archive's range", () => {
    expect(parseYear(42).success).toBe(false);
    expect(parseYear(2500).success).toBe(false);
  });
});
