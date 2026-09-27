/**
 * @file vocalRangeProposal.ts
 * @description Which range a roster surface shows for a singer. The
 * conductor's own assessment wins whenever either bound is written; otherwise
 * the singer's proposal stands in, and every surface marks it as the singer's,
 * so a proposal is never read as the conductor's verdict.
 *
 * The proposal fields arrive only on the manager's detailed payload. Anyone
 * else gets neither half, and both helpers answer null.
 * @module features/artists/lib/vocalRangeProposal
 */

import type { Artist } from "@/shared/types";
import type { VocalRangeMidi } from "@/shared/lib/music/pitchNotation";

/** The singer's proposal, or null when they have sent none. */
export const proposalOf = (artist: Artist | undefined): VocalRangeMidi | null => {
  if (!artist?.vocal_range_proposed_at) return null;
  const tessituraLow = artist.proposed_tessitura_low ?? null;
  const tessituraHigh = artist.proposed_tessitura_high ?? null;
  if (tessituraLow === null || tessituraHigh === null) return null;
  return {
    tessituraLow,
    tessituraHigh,
    extremeLow: artist.proposed_extreme_low ?? null,
    extremeHigh: artist.proposed_extreme_high ?? null,
  };
};

export type RangeShown =
  | { readonly source: "conductor"; readonly text: string }
  | { readonly source: "singer"; readonly range: VocalRangeMidi };

/**
 * The conductor's text when they wrote either bound, joined by `separator`;
 * else the singer's proposal; else null.
 */
export const rangeShown = (
  artist: Artist | undefined,
  separator = " – ",
): RangeShown | null => {
  if (artist?.vocal_range_bottom || artist?.vocal_range_top) {
    return {
      source: "conductor",
      text: `${artist.vocal_range_bottom || "?"}${separator}${artist.vocal_range_top || "?"}`,
    };
  }
  const range = proposalOf(artist);
  return range ? { source: "singer", range } : null;
};
