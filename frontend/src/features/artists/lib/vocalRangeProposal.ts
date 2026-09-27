/**
 * @file vocalRangeProposal.ts
 * @description The two ranges a singer can carry, as MIDI notes: the
 * conductor's assessment and the singer's own proposal. A roster surface shows
 * the assessment whenever there is one; otherwise the proposal stands in, and
 * every surface marks it as the singer's, so a proposal is never read as the
 * conductor's verdict.
 *
 * Both arrive only on the manager's detailed payload. Anyone else gets
 * neither, and every helper answers null.
 * @module features/artists/lib/vocalRangeProposal
 */

import type { Artist } from "@/shared/types";
import type { VocalRangeMidi } from "@/shared/lib/music/pitchNotation";
import { RANGE_SLOTS } from "@/shared/lib/music/rangeDraft";

/** The same four notes, an empty extreme matching only an empty one. */
export const sameRange = (a: VocalRangeMidi, b: VocalRangeMidi): boolean =>
  RANGE_SLOTS.every((slot) => a[slot] === b[slot]);

/** The conductor's assessment, or null while it is not set. The server keeps
 *  the tessitura pair set whenever any of the four is. */
export const assessmentOf = (artist: Artist | undefined): VocalRangeMidi | null => {
  const tessituraLow = artist?.assessed_tessitura_low ?? null;
  const tessituraHigh = artist?.assessed_tessitura_high ?? null;
  if (tessituraLow === null || tessituraHigh === null) return null;
  return {
    tessituraLow,
    tessituraHigh,
    extremeLow: artist?.assessed_extreme_low ?? null,
    extremeHigh: artist?.assessed_extreme_high ?? null,
  };
};

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

export interface RangeShown {
  readonly source: "conductor" | "singer";
  readonly range: VocalRangeMidi;
}

/** The conductor's assessment, else the singer's proposal, else null. */
export const rangeShown = (artist: Artist | undefined): RangeShown | null => {
  const assessed = assessmentOf(artist);
  if (assessed) return { source: "conductor", range: assessed };
  const proposed = proposalOf(artist);
  return proposed ? { source: "singer", range: proposed } : null;
};
