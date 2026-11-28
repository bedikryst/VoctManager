/**
 * @file polishVocative.test.ts
 * @description The vocative table lookup: a listed name gives its form, an
 * unlisted one gives nothing to fill.
 * @module features/artists/lib/polishVocative.test
 */

import { describe, expect, it } from "vitest";
import { vocativeFromTable } from "./polishVocative";

describe("vocativeFromTable", () => {
  it("gives the listed vocative", () => {
    expect(vocativeFromTable("Michał")).toBe("Michale");
    expect(vocativeFromTable("Anna")).toBe("Anno");
    expect(vocativeFromTable("Kacper")).toBe("Kacprze");
  });

  it("ignores case and surrounding space", () => {
    expect(vocativeFromTable("  ŁUKASZ ")).toBe("Łukaszu");
    expect(vocativeFromTable("zofia")).toBe("Zofio");
  });

  it("looks up the first of several given names", () => {
    expect(vocativeFromTable("Michał Jan")).toBe("Michale");
  });

  it("gives nothing for a name the table does not list", () => {
    expect(vocativeFromTable("Florent")).toBe("");
    expect(vocativeFromTable("Anna-Maria")).toBe("");
    expect(vocativeFromTable("Michal")).toBe("");
    expect(vocativeFromTable("")).toBe("");
  });
});
