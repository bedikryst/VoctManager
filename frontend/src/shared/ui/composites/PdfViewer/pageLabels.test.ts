/**
 * @file pageLabels.test.ts
 * @description Pins the two directions between printed numbers and file pages,
 * and the rule that labels which do not cover the document page for page are
 * dropped: a counter one page off sends a singer to the wrong page.
 * @module shared/ui/composites/PdfViewer/pageLabels.test
 */

import { describe, expect, it } from "vitest";

import { resolvePageLabelling } from "./pageLabels";
import type { PdfPageLabel } from "./types";

// Title page and a blank, then printed pages 1–2, a blank verso, page 3.
const labels: PdfPageLabel[] = [
  { folio: null, name: "Strona tytułowa" },
  { folio: null },
  { folio: 1 },
  { folio: 2 },
  { folio: null },
  { folio: 3 },
];

describe("resolvePageLabelling", () => {
  it("reads the printed number off a file page and back", () => {
    const labelling = resolvePageLabelling(labels, labels.length);
    expect(labelling?.folioOf(4)).toBe(2);
    expect(labelling?.pageOf(3)).toBe(6);
    expect(labelling?.lastFolio).toBe(3);
  });

  it("names the pages that carry no number only where the host named them", () => {
    const labelling = resolvePageLabelling(labels, labels.length);
    expect(labelling?.folioOf(1)).toBeNull();
    expect(labelling?.nameOf(1)).toBe("Strona tytułowa");
    expect(labelling?.nameOf(2)).toBeNull();
  });

  it("drops labels that do not match the document page for page", () => {
    expect(resolvePageLabelling(labels, labels.length + 1)).toBeNull();
    expect(resolvePageLabelling(labels, null)).toBeNull();
    expect(resolvePageLabelling(undefined, 6)).toBeNull();
  });

  it("drops labels that print no number at all", () => {
    expect(resolvePageLabelling([{ folio: null }, { folio: null }], 2)).toBeNull();
  });
});
