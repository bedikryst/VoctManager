/**
 * @file vocalRangeProposal.test.ts
 * @description Pins how the two ranges are read off an artist, and which one a
 * roster surface shows: the conductor's assessment whenever it is set, the
 * singer's proposal otherwise.
 * @module features/artists/lib/vocalRangeProposal.test
 */

import { describe, expect, it } from "vitest";

import type { Artist } from "@/shared/types";
import {
  assessmentOf,
  proposalOf,
  rangeShown,
  sameRange,
} from "./vocalRangeProposal";

const base: Artist = {
  id: "1",
  first_name: "Anna",
  last_name: "Nowak",
  voice_type: "SOP",
  is_active: true,
} as Artist;

const proposed: Artist = {
  ...base,
  proposed_tessitura_low: 57,
  proposed_tessitura_high: 81,
  proposed_extreme_low: 55,
  proposed_extreme_high: null,
  vocal_range_proposed_at: "2026-09-27T10:00:00Z",
};

const assessed: Artist = {
  ...base,
  assessed_tessitura_low: 60,
  assessed_tessitura_high: 79,
  assessed_extreme_low: null,
  assessed_extreme_high: 84,
};

describe("proposalOf", () => {
  it("is null until the singer has sent one", () => {
    expect(proposalOf(base)).toBeNull();
    expect(proposalOf({ ...proposed, vocal_range_proposed_at: null })).toBeNull();
  });

  it("maps the MIDI fields", () => {
    expect(proposalOf(proposed)).toEqual({
      tessituraLow: 57,
      tessituraHigh: 81,
      extremeLow: 55,
      extremeHigh: null,
    });
  });
});

describe("assessmentOf", () => {
  it("is null while the conductor has not assessed", () => {
    expect(assessmentOf(base)).toBeNull();
    expect(assessmentOf(undefined)).toBeNull();
  });

  it("maps the MIDI fields", () => {
    expect(assessmentOf(assessed)).toEqual({
      tessituraLow: 60,
      tessituraHigh: 79,
      extremeLow: null,
      extremeHigh: 84,
    });
  });
});

describe("rangeShown", () => {
  it("prefers the conductor's assessment", () => {
    expect(rangeShown({ ...proposed, ...assessed })).toEqual({
      source: "conductor",
      range: {
        tessituraLow: 60,
        tessituraHigh: 79,
        extremeLow: null,
        extremeHigh: 84,
      },
    });
  });

  it("falls back to the singer's proposal", () => {
    expect(rangeShown(proposed)?.source).toBe("singer");
  });

  it("is null when neither exists", () => {
    expect(rangeShown(base)).toBeNull();
    expect(rangeShown(undefined)).toBeNull();
  });
});

describe("sameRange", () => {
  const range = { tessituraLow: 57, tessituraHigh: 81, extremeLow: 55, extremeHigh: null };

  it("holds for the same four notes", () => {
    expect(sameRange(range, { ...range })).toBe(true);
  });

  it("fails on any one note, an empty extreme included", () => {
    expect(sameRange(range, { ...range, tessituraHigh: 79 })).toBe(false);
    expect(sameRange(range, { ...range, extremeLow: null })).toBe(false);
    expect(sameRange(range, { ...range, extremeHigh: 84 })).toBe(false);
  });
});
