/**
 * @file vocalRangeProposal.ts
 * @description The two ranges a singer can carry, as MIDI notes: the
 * conductor's assessment and the singer's own proposal. Baza Artystów shows
 * both (`rangesOf`); Obsada has one line per singer and shows the assessment
 * whenever there is one, else the proposal (`rangeShown`). Every surface marks
 * a proposal as the singer's, so it is never read as the conductor's verdict.
 *
 * The roster's range filter (`matchesRangeFilter`) lives here too, so the
 * filter and the lines on screen answer from the same two reads.
 *
 * Both arrive only on the manager's detailed payload. Anyone else gets
 * neither, and every helper answers null.
 * @module features/artists/lib/vocalRangeProposal
 */

import type { Artist } from "@/shared/types";
import type { VocalRangeMidi } from "@/shared/lib/music/pitchNotation";
import { RANGE_SLOTS } from "@/shared/lib/music/rangeDraft";
import { isSingingVoiceType } from "@/shared/lib/voiceTypes";

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

export interface VocalRanges {
  readonly assessed: VocalRangeMidi | null;
  readonly proposed: VocalRangeMidi | null;
}

/** Both ranges at once, for a surface that shows them side by side. */
export const rangesOf = (artist: Artist | undefined): VocalRanges => ({
  assessed: assessmentOf(artist),
  proposed: proposalOf(artist),
});

/** `all` keeps everyone; the other three keep singers only, since a player
 *  has no range to propose. `differs` needs both ranges and a note apart. */
export type RangeFilter = "all" | "proposed" | "missing" | "differs";

export const matchesRangeFilter = (artist: Artist, filter: RangeFilter): boolean => {
  if (filter === "all") return true;
  if (!isSingingVoiceType(artist.voice_type)) return false;
  const { assessed, proposed } = rangesOf(artist);
  if (filter === "proposed") return proposed !== null;
  if (filter === "missing") return proposed === null;
  return assessed !== null && proposed !== null && !sameRange(assessed, proposed);
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
