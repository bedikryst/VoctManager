/**
 * @file rangeDraft.test.ts
 * @description Holds the draft's checks to the server's `VocalRangeProposalDTO`
 * rules, so the send button is never live for a range the PUT would refuse, and
 * pins what the keyboard draws, where it opens for each slot, which keys it
 * dims, and what the send button plays.
 * @module features/vocal-range/lib/rangeDraft
 */

import { describe, expect, it } from "vitest";

import type { VocalRangeMidi } from "@/shared/lib/music/pitchNotation";

import {
  EMPTY_DRAFT,
  rangeBands,
  rangePitches,
  rangeProblem,
  slotCentre,
  slotSpan,
  toSubmission,
} from "./rangeDraft";

// The conductor's brief: a (g) – a² (c³).
const BRIEF: VocalRangeMidi = {
  tessituraLow: 57,
  extremeLow: 55,
  tessituraHigh: 81,
  extremeHigh: 84,
};

describe("rangeProblem", () => {
  it("accepts the brief, and a tessitura alone", () => {
    expect(rangeProblem(BRIEF)).toBeNull();
    expect(
      rangeProblem({ ...BRIEF, extremeLow: null, extremeHigh: null }),
    ).toBeNull();
  });

  it("needs both tessitura bounds", () => {
    expect(rangeProblem(EMPTY_DRAFT)).toBe("incomplete");
    expect(rangeProblem({ ...BRIEF, tessituraHigh: null, extremeHigh: null })).toBe(
      "incomplete",
    );
  });

  it("refuses a tessitura that does not rise", () => {
    expect(rangeProblem({ ...BRIEF, tessituraHigh: 57 })).toBe("tessituraOrder");
  });

  it("refuses an extreme inside the tessitura, but allows one on its bound", () => {
    expect(rangeProblem({ ...BRIEF, extremeLow: 58 })).toBe("extremeLowOrder");
    expect(rangeProblem({ ...BRIEF, extremeHigh: 80 })).toBe("extremeHighOrder");
    expect(rangeProblem({ ...BRIEF, extremeLow: 57, extremeHigh: 81 })).toBeNull();
  });

  it("names a contradiction before a missing bound", () => {
    expect(
      rangeProblem({ ...EMPTY_DRAFT, tessituraLow: 60, extremeLow: 62 }),
    ).toBe("extremeLowOrder");
  });
});

describe("rangeBands", () => {
  it("draws the tessitura bright and the reaches thin", () => {
    expect(rangeBands(BRIEF)).toEqual([
      { low: 57, high: 81, weight: "bright" },
      { low: 55, high: 57, weight: "thin" },
      { low: 81, high: 84, weight: "thin" },
    ]);
  });

  it("draws a lone bound as its one key", () => {
    expect(rangeBands({ ...EMPTY_DRAFT, tessituraLow: 57 })).toEqual([
      { low: 57, high: 57, weight: "bright" },
    ]);
  });
});

describe("slotCentre", () => {
  const SOPRANO_CENTRE = 69;

  it("opens a filled slot on its own note", () => {
    expect(slotCentre("tessituraHigh", BRIEF, SOPRANO_CENTRE)).toBe(81);
  });

  it("opens an empty slot on its own side of the voice", () => {
    expect(slotCentre("tessituraLow", EMPTY_DRAFT, SOPRANO_CENTRE)).toBe(62);
    expect(slotCentre("tessituraHigh", EMPTY_DRAFT, SOPRANO_CENTRE)).toBe(76);
  });

  it("opens an empty extreme just past its tessitura bound", () => {
    const tessitura = { ...EMPTY_DRAFT, tessituraLow: 60, tessituraHigh: 81 };
    expect(slotCentre("extremeLow", tessitura, SOPRANO_CENTRE)).toBe(57);
    expect(slotCentre("extremeHigh", tessitura, SOPRANO_CENTRE)).toBe(84);
  });
});

describe("slotSpan", () => {
  it("keeps each extreme outside its bound, the bound itself allowed", () => {
    expect(slotSpan("extremeLow", BRIEF)).toEqual({
      low: Number.NEGATIVE_INFINITY,
      high: 57,
    });
    expect(slotSpan("extremeHigh", BRIEF)).toEqual({
      low: 81,
      high: Number.POSITIVE_INFINITY,
    });
  });

  it("keeps the two tessitura bounds strictly apart", () => {
    expect(slotSpan("tessituraLow", BRIEF)?.high).toBe(80);
    expect(slotSpan("tessituraHigh", BRIEF)?.low).toBe(58);
  });

  it("constrains nothing before the bound it answers to exists", () => {
    expect(slotSpan("extremeHigh", EMPTY_DRAFT)).toBeNull();
    expect(slotSpan("tessituraLow", EMPTY_DRAFT)).toBeNull();
  });
});

describe("rangePitches", () => {
  it("plays each chosen note once, lowest first", () => {
    expect(rangePitches(BRIEF)).toEqual([55, 57, 81, 84]);
    expect(rangePitches({ ...BRIEF, extremeLow: 57, extremeHigh: null })).toEqual([
      57, 81,
    ]);
  });
});

describe("toSubmission", () => {
  it("carries MIDI numbers and a trimmed comment", () => {
    expect(toSubmission(BRIEF, "  Wysoki sopran ")).toEqual({
      tessitura_low: 57,
      tessitura_high: 81,
      extreme_low: 55,
      extreme_high: 84,
      comment: "Wysoki sopran",
    });
  });

  it("is null for a draft the server would refuse", () => {
    expect(toSubmission({ ...BRIEF, extremeLow: 60 }, "")).toBeNull();
    expect(toSubmission(EMPTY_DRAFT, "")).toBeNull();
  });
});
