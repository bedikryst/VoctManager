/**
 * @file voiceFamilies.ts
 * @description Ordering rules for the two vocal enums the casting board reads.
 * `VoiceLine` mixes two kinds of value — the four choral families with their
 * divisi index (S1…B3) and standalone roles (SOLO, VP, TUTTI, BACK, ACC, PRON)
 * — so membership has to be declared rather than tested by prefix: a prefix
 * test files SOLO under the sopranos, ACC under the altos, and leaves VP and
 * PRON in no group at all, which is how those lines became unreachable on the
 * board. `VoiceType` (the singer's own voice) is a different enum and gets its
 * own order, used to group the unassigned pool the way a roster is read.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/voiceFamilies
 */

import type { VoiceType } from "@/shared/types";

export type VoiceFamilyId = "S" | "A" | "T" | "B" | "ROLE";

/** Score order: top staff downwards, then everything that is not a choral line. */
export const VOICE_FAMILY_ORDER: readonly VoiceFamilyId[] = [
  "S",
  "A",
  "T",
  "B",
  "ROLE",
];

const DIVISI_LINE = /^([SATB])\d+$/;

export const voiceFamilyOf = (voiceLine: string): VoiceFamilyId => {
  const match = DIVISI_LINE.exec(voiceLine.toUpperCase());
  return match ? (match[1] as VoiceFamilyId) : "ROLE";
};

/** Sort key that keeps S1, S2, A1… adjacent instead of in requirement order. */
export const voiceFamilyRank = (voiceLine: string): number =>
  VOICE_FAMILY_ORDER.indexOf(voiceFamilyOf(voiceLine));

/**
 * Roster order for singers. There is no mezzo, countertenor or baritone VOICE
 * LINE — those are voice types, and they get cast on S2/A1/T2/B1 — which is why
 * they belong here and not in the family list above.
 */
export const VOICE_TYPE_ORDER: readonly VoiceType[] = [
  "SOP",
  "MEZ",
  "ALT",
  "CT",
  "TEN",
  "BAR",
  "BAS",
  "DIR",
];

export const voiceTypeRank = (voiceType: VoiceType | null): number => {
  if (!voiceType) return VOICE_TYPE_ORDER.length;
  const index = VOICE_TYPE_ORDER.indexOf(voiceType);
  return index === -1 ? VOICE_TYPE_ORDER.length : index;
};
