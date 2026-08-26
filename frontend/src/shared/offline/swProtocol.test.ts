/**
 * @file swProtocol.test.ts
 * @description The two predicates the service worker routes the concert binder
 * with. They are worth asserting because both failure directions are silent: a
 * pattern that is too loose puts a neighbouring endpoint — the conductor's
 * cockpit state, the marks availability probe — into a thirty-day CacheFirst
 * store, and one that is too tight simply never keeps the book, which nobody
 * discovers until a church with no signal.
 * @module shared/offline
 */

import { describe, expect, it } from "vitest";

import { isBinderMapPath, isBinderPdfPath } from "./swProtocol";

const PROJECT = "/api/projects/9f1c2d3e-0000-4a5b-8c9d-000000000001";

describe("binder path predicates", () => {
  it("recognises the book and its map", () => {
    expect(isBinderPdfPath(`${PROJECT}/score_pdf/`)).toBe(true);
    expect(isBinderMapPath(`${PROJECT}/score_map/`)).toBe(true);
  });

  it("keeps the binder's neighbours out of the cache", () => {
    for (const path of [
      `${PROJECT}/score_package/`,
      `${PROJECT}/score_package/preview/`,
      `${PROJECT}/score_marks/`,
      `${PROJECT}/export_day_sheet/`,
    ]) {
      expect(isBinderPdfPath(path)).toBe(false);
      expect(isBinderMapPath(path)).toBe(false);
    }
  });

  it("does not answer for a path that only ends the same way", () => {
    // Another resource's own score_pdf would be a different gate entirely.
    expect(isBinderPdfPath("/api/pieces/1/score_pdf/")).toBe(false);
    expect(isBinderPdfPath(`${PROJECT}/items/7/score_pdf/`)).toBe(false);
  });
});
