/**
 * @file scoreBookOpening.test.ts
 * @description Book opening and edition fallback decisions.
 */
import { describe, expect, it } from "vitest";
import type { ScoreBookMap } from "../api/project.service";
import { bookOpeningPage, boundItemPage } from "./scoreBookOpening";

const map: ScoreBookMap = {
  available: true,
  stamp: "build-1",
  items: [{ id: "a", order: 2, title: "A", composer: "", is_encore: false, first_page: 4, last_page: 6 }],
  pages: [{ page: 5, edition: "edition", src_page: 1, box: [0, 0, 1, 1] }],
};

describe("opening a score book", () => {
  it("opens the selected bound item and falls back for unbound or unavailable items", () => {
    expect(boundItemPage(map, 2)).toBe(4);
    expect(boundItemPage(map, 1)).toBeNull();
    expect(boundItemPage({ ...map, pages: [] }, 2)).toBeNull();
    expect(boundItemPage({ ...map, available: false }, 2)).toBeNull();
  });
  it("prefers the selected piece, then a valid saved page, then the first piece", () => {
    expect(bookOpeningPage(4, "12", 3)).toBe(4);
    expect(bookOpeningPage(null, "12", 3)).toBe(12);
    expect(bookOpeningPage(null, "-2", 3)).toBe(3);
    expect(bookOpeningPage(null, "NaN", undefined)).toBe(1);
  });
});
