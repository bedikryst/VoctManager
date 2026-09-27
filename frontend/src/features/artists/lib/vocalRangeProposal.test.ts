/**
 * @file vocalRangeProposal.test.ts
 * @description Pins how the two ranges are read off an artist, which one a
 * one-line surface shows (the conductor's assessment whenever it is set, the
 * singer's proposal otherwise), and who each roster range filter keeps.
 * @module features/artists/lib/vocalRangeProposal.test
 */

import { describe, expect, it } from "vitest";

import type { Artist } from "@/shared/types";
import {
  assessmentOf,
  matchesRangeFilter,
  proposalOf,
  rangeShown,
  rangesOf,
  sameRange,
  type RangeFilter,
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

describe("rangesOf", () => {
  it("reads both ranges at once", () => {
    expect(rangesOf({ ...proposed, ...assessed })).toEqual({
      assessed: assessmentOf(assessed),
      proposed: proposalOf(proposed),
    });
  });

  it("answers null for each range that is missing", () => {
    expect(rangesOf(base)).toEqual({ assessed: null, proposed: null });
    expect(rangesOf(undefined)).toEqual({ assessed: null, proposed: null });
  });
});

describe("matchesRangeFilter", () => {
  const agreed: Artist = {
    ...proposed,
    assessed_tessitura_low: 57,
    assessed_tessitura_high: 81,
    assessed_extreme_low: 55,
    assessed_extreme_high: null,
  };
  const differs: Artist = { ...proposed, ...assessed };
  const player: Artist = { ...base, voice_type: "INS" };
  const playerWithRanges: Artist = { ...differs, voice_type: "INS" };

  const kept = (filter: RangeFilter): Artist[] =>
    [base, proposed, assessed, agreed, differs, player].filter((artist) =>
      matchesRangeFilter(artist, filter),
    );

  it("keeps everyone, players included, with no filter", () => {
    expect(kept("all")).toHaveLength(6);
  });

  it("splits the singers on whether they have proposed", () => {
    expect(kept("proposed")).toEqual([proposed, agreed, differs]);
    expect(kept("missing")).toEqual([base, assessed]);
  });

  it("keeps only a proposal set against an assessment it differs from", () => {
    expect(kept("differs")).toEqual([differs]);
  });

  it("never keeps a player once a filter is set", () => {
    const filters: RangeFilter[] = ["proposed", "missing", "differs"];
    for (const filter of filters) {
      expect(matchesRangeFilter(player, filter)).toBe(false);
      expect(matchesRangeFilter(playerWithRanges, filter)).toBe(false);
    }
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
