/**
 * @file text.test.ts
 * @description Guards the search fold that the roster, crew, logistics,
 * messages and archive searches all sit on. The cases below are real names from
 * the ensemble's own repertoire and roster, because the failure this prevents is
 * specific and silent: a conductor types a surname without diacritics, gets an
 * empty list, and concludes the piece is not in the library.
 *
 * The stroked-letter cases are the ones worth pinning. `ń` and `ó` fall out of
 * NFD for free; `ł` does not decompose at all, so it needs the explicit map and
 * a plain `.normalize("NFD")` implementation would pass every other assertion
 * here while still failing Łukaszewski.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/text.test
 */

import { describe, expect, it } from "vitest";

import { foldDiacritics } from "@/shared/lib/text";

/** The way the call sites use it: fold both sides, then substring-match. */
const finds = (haystack: string, typed: string): boolean =>
  foldDiacritics(haystack).includes(foldDiacritics(typed));

describe("foldDiacritics", () => {
  it("strips combining marks and lowercases", () => {
    expect(foldDiacritics("Górecki")).toBe("gorecki");
    expect(foldDiacritics("Zielińska")).toBe("zielinska");
    expect(foldDiacritics("Świder")).toBe("swider");
    expect(foldDiacritics("Żeleński")).toBe("zelenski");
  });

  it("folds stroked letters, which NFD cannot decompose", () => {
    expect(foldDiacritics("Łukaszewski")).toBe("lukaszewski");
    expect(foldDiacritics("Łuciuk")).toBe("luciuk");
    expect(foldDiacritics("Straße")).toBe("strasse");
    expect(foldDiacritics("Ø")).toBe("o");
  });

  it("finds a Polish name typed without its diacritics", () => {
    expect(finds("Łukaszewski", "lukaszewski")).toBe(true);
    expect(finds("Henryk Mikołaj Górecki", "gorecki")).toBe(true);
    expect(finds("Anna Zielińska", "zielinska")).toBe(true);
    expect(finds("Kościół Mariacki", "kosciol")).toBe(true);
  });

  it("still matches when the diacritics ARE typed", () => {
    expect(finds("Łukaszewski", "Łukasz")).toBe(true);
    expect(finds("Górecki", "Górecki")).toBe(true);
  });

  it("does not collapse distinct letters into false matches", () => {
    expect(finds("Górecki", "warszawa")).toBe(false);
    expect(finds("Moniuszko", "monteverdi")).toBe(false);
  });

  it("is a no-op on plain ASCII and on the empty string", () => {
    expect(foldDiacritics("Penderecki")).toBe("penderecki");
    expect(foldDiacritics("")).toBe("");
  });
});
