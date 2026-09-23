/**
 * @file scrollTurn.test.ts
 * @description Pins how many taps a page costs. The two-thirds fit makes a page
 * one and a half screens tall, and its promise — every system whole on one of
 * two screens — holds only if a page takes exactly two stops, top and bottom.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewer/scrollTurn.test
 */

import { describe, expect, it } from "vitest";

import { planScrollTurn, readableScrollRange } from "./scrollTurn";
import { FIT_SCROLL_OVERLAP_PX } from "./constants";

const SCREEN = 820;

/** Stops a reader makes on one page, top included, turning forward from the top. */
const stopsOnPage = (pageHeight: number, clientHeight: number): number[] => {
  const maxScroll = pageHeight - clientHeight;
  const stops = [0];
  let scrollTop = 0;
  for (;;) {
    const advance = planScrollTurn(maxScroll - scrollTop, clientHeight);
    if (advance === 0) return stops;
    scrollTop += advance;
    stops.push(scrollTop);
  }
};

describe("planScrollTurn", () => {
  it("shows a page one and a half screens tall in exactly two stops", () => {
    expect(stopsOnPage(SCREEN * 1.5, SCREEN)).toEqual([0, SCREEN * 0.5]);
  });

  it("shows a page exactly two screens tall in two stops, with no sliver turn", () => {
    expect(stopsOnPage(SCREEN * 2, SCREEN)).toEqual([0, SCREEN]);
  });

  it("splits a longer rest into equal turns that each keep the overlap", () => {
    const stops = stopsOnPage(SCREEN * 3.2, SCREEN);
    const steps = stops.slice(1).map((stop, index) => stop - stops[index]!);
    expect(stops.at(-1)).toBeCloseTo(SCREEN * 2.2);
    expect(steps.length).toBe(3);
    for (const step of steps) {
      expect(step).toBeCloseTo(steps[0]!);
      expect(step).toBeLessThanOrEqual(SCREEN - FIT_SCROLL_OVERLAP_PX);
    }
  });

  it("hands the turn to the next page once the viewport is parked at the edge", () => {
    expect(planScrollTurn(0, SCREEN)).toBe(0);
    expect(planScrollTurn(3, SCREEN)).toBe(0);
  });
});

describe("readableScrollRange", () => {
  it("reads a whole page whose foot runs on under the nav as one screen", () => {
    // Outside performance mode the whole-page fit may overrun the box by 50px.
    // A tap spent scrolling those pixels shows no new music and turns no page.
    expect(readableScrollRange(50, 50)).toBe(0);
    expect(readableScrollRange(51, 50)).toBe(0); // a pixel of layout rounding
  });

  it("keeps every pixel of an overflow that holds music", () => {
    expect(readableScrollRange(410, 50)).toBe(410); // zoom, width floor, partial fit
    expect(readableScrollRange(60, 0)).toBe(60); // performance mode grants nothing
  });
});
