/**
 * @file castOrder.ts
 * @description The one order the cast is read in, mirrored from the backend's
 * `roster/cast_order.py` so the tab, the divisi board, the songbook and the
 * printed sheet cannot disagree about who comes before whom.
 * The conductor's arrangement of a section decides it; everything under that is
 * a tie-breaker for sections nobody has arranged yet.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/castOrder
 */

import type { VoiceLine, VoiceType } from "@/shared/types";

import { LINE_UP_SEATS } from "./autoCast";
import { voiceTypeRank } from "./voiceFamilies";

/**
 * Everything the order depends on, and nothing else — so a list of chips and a
 * list of table rows can be sorted by the same function.
 */
export interface CastOrderFacts {
  readonly voiceType: VoiceType | null;
  /**
   * Where the conductor put this singer inside their voice section. `null` =
   * this section has never been arranged, which is the resting state and sorts
   * after every arranged singer.
   */
  readonly sectionRank: number | null;
  readonly isSectionLeader: boolean;
  /** Their seat in the line-up; empty when none was recorded. */
  readonly seat: VoiceLine | "" | null;
  readonly displayName: string;
}

/**
 * Where an unseated singer sorts among the seated ones: after all of them.
 * `LINE_UP_SEATS` gives every real seat its score-order index, and an empty seat
 * is not in that list — so the miss has to be sent to the end rather than to -1,
 * which would file everyone with no seat above Sopran 1.
 */
export const seatRank = (seat: VoiceLine | "" | null): number => {
  const index = seat ? LINE_UP_SEATS.indexOf(seat) : -1;
  return index === -1 ? LINE_UP_SEATS.length : index;
};

/**
 * The cast in the order a conductor reads it: voice family, then the
 * arrangement they gave that family, then — only where they gave none — the
 * leader, the line-up from the top down, and the surname.
 *
 * The arrangement outranks both the star and the seat deliberately: a singer
 * dragged above the marked leader has to stay there, or the gesture would
 * silently do nothing. And a section nobody has touched still reads
 * alphabetically, exactly as it did before any of this existed.
 */
export const byCastOrder = (
  left: CastOrderFacts,
  right: CastOrderFacts,
): number => {
  const voiceDelta = voiceTypeRank(left.voiceType) - voiceTypeRank(right.voiceType);
  if (voiceDelta !== 0) return voiceDelta;

  // Two comparisons rather than a sentinel: an unarranged singer goes after
  // every arranged one, whatever numbers the arrangement happens to use.
  const leftRanked = left.sectionRank !== null;
  const rightRanked = right.sectionRank !== null;
  if (leftRanked !== rightRanked) return leftRanked ? -1 : 1;
  if (leftRanked && rightRanked && left.sectionRank !== right.sectionRank) {
    return (left.sectionRank ?? 0) - (right.sectionRank ?? 0);
  }

  if (left.isSectionLeader !== right.isSectionLeader) {
    return left.isSectionLeader ? -1 : 1;
  }

  const seatDelta = seatRank(left.seat) - seatRank(right.seat);
  if (seatDelta !== 0) return seatDelta;

  return left.displayName.localeCompare(right.displayName, "pl");
};
