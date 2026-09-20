/**
 * @file voiceFamilies.ts
 * @description Ordering rules for the two vocal enums the casting board reads.
 * `VoiceLine` mixes three kinds of value — the four choral families with their
 * divisi index (S1…B3), the intermediate parts that are one line each (MS, CT,
 * BAR) and standalone roles (SOLO, VP, TUTTI, BACK, ACC, PRON) — so membership
 * has to be declared rather than tested by prefix: a prefix test files SOLO
 * under the sopranos, ACC under the altos, BAR under the basses, and leaves VP
 * and PRON in no group at all, which is how those lines became unreachable on
 * the board. `VoiceType` (the singer's own voice) is a different enum and gets
 * its own order, used to group the unassigned pool the way a roster is read.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/voiceFamilies
 */

import type { VoiceType } from "@/shared/types";

/**
 * An intermediate part is its own one-member family: the casting rule asks
 * "how many lines of this singer's family does the piece declare", and a
 * mezzo-soprano's answer must be the MS line alone — never the sopranos' or
 * the altos', which is precisely the decision the rule refuses to make.
 */
export type VoiceFamilyId =
  | "S"
  | "MS"
  | "A"
  | "CT"
  | "T"
  | "BAR"
  | "B"
  | "V"
  | "ROLE";

/**
 * Score order: top staff downwards, then the untyped parts a canon divides
 * into (they have no tessitura, so they sit below the choral staves rather
 * than inside them), then everything that is not a voice line at all.
 */
export const VOICE_FAMILY_ORDER: readonly VoiceFamilyId[] = [
  "S",
  "MS",
  "A",
  "CT",
  "T",
  "BAR",
  "B",
  "V",
  "ROLE",
];

const DIVISI_LINE = /^([SATBV])\d+$/;

/** The lines that are a family of one; their code is their family id. */
const INTERMEDIATE_LINES: ReadonlySet<string> = new Set(["MS", "CT", "BAR"]);

export const voiceFamilyOf = (voiceLine: string): VoiceFamilyId => {
  const code = voiceLine.toUpperCase();
  if (INTERMEDIATE_LINES.has(code)) return code as VoiceFamilyId;
  const match = DIVISI_LINE.exec(code);
  return match ? (match[1] as VoiceFamilyId) : "ROLE";
};

/** Sort key that keeps S1, S2, A1… adjacent instead of in requirement order. */
export const voiceFamilyRank = (voiceLine: string): number =>
  VOICE_FAMILY_ORDER.indexOf(voiceFamilyOf(voiceLine));

/**
 * Roster order for the cast, by the singer's own voice. It runs parallel to
 * the family list above but is a different axis: a mezzo-soprano is cast on
 * the MS line only where the arrangement writes one, and on S2 or A1
 * everywhere else. The players come after the choir and before the podium,
 * as they sit below the staves in a score.
 */
export const VOICE_TYPE_ORDER: readonly VoiceType[] = [
  "SOP",
  "MEZ",
  "ALT",
  "CT",
  "TEN",
  "BAR",
  "BAS",
  "INS",
  "DIR",
];

export const voiceTypeRank = (voiceType: VoiceType | null): number => {
  if (!voiceType) return VOICE_TYPE_ORDER.length;
  const index = VOICE_TYPE_ORDER.indexOf(voiceType);
  return index === -1 ? VOICE_TYPE_ORDER.length : index;
};
