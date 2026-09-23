/**
 * @file tapZone.test.ts
 * @description Pins where a tap turns the page on the two layouts a reader
 * meets: a whole page floating in black on a landscape screen, and a page
 * wider than the screen. The failure this prevents is a tap beside the paper
 * that leaves performance mode when the reader meant to turn.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewer/tapZone.test
 */

import { describe, expect, it } from "vitest";

import { resolveTapZone } from "./tapZone";

// A 1536px-wide laptop screen showing a whole A4 page 611px wide, centred.
const screen = { left: 0, right: 1536 };
const wholePage = { left: 462, right: 1073 };

describe("resolveTapZone", () => {
  it("turns on a tap in the black beside a whole page", () => {
    expect(resolveTapZone(1100, screen, wholePage)).toBe(1);
    expect(resolveTapZone(430, screen, wholePage)).toBe(-1);
  });

  it("turns on a tap on the outer third of the paper", () => {
    expect(resolveTapZone(1030, screen, wholePage)).toBe(1);
    expect(resolveTapZone(500, screen, wholePage)).toBe(-1);
  });

  it("keeps the middle of the paper for the centre tap", () => {
    expect(resolveTapZone(768, screen, wholePage)).toBe(0);
  });

  it("measures a page wider than the screen by what is visible", () => {
    const zoomed = { left: -400, right: 1936 };
    expect(resolveTapZone(1400, screen, zoomed)).toBe(1);
    expect(resolveTapZone(100, screen, zoomed)).toBe(-1);
    expect(resolveTapZone(768, screen, zoomed)).toBe(0);
  });

  it("falls back to the screen when the page is not measured", () => {
    expect(resolveTapZone(1500, screen, null)).toBe(1);
    expect(resolveTapZone(768, screen, null)).toBe(0);
  });
});
