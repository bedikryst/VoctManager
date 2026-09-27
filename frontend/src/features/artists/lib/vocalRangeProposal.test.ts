/**
 * @file vocalRangeProposal.test.ts
 * @description Pins which range a roster surface shows: the conductor's text
 * whenever either bound is written, the singer's proposal otherwise.
 * @module features/artists/lib/vocalRangeProposal.test
 */

import { describe, expect, it } from "vitest";

import type { Artist } from "@/shared/types";
import { proposalOf, rangeShown } from "./vocalRangeProposal";

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

describe("rangeShown", () => {
  it("prefers the conductor's text, even a single bound", () => {
    expect(rangeShown({ ...proposed, vocal_range_top: "C6" })).toEqual({
      source: "conductor",
      text: "? – C6",
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
