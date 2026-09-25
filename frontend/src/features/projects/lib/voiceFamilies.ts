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
 * Also the seat → SATB section mapping a sectional rehearsal calls by,
 * mirrored from the server's `core/voice_labels.py`.
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

/**
 * The four sections a sectional rehearsal calls, in the order they are
 * written into `Rehearsal.called_sections` ("SA", "TB"). Mirror of
 * `core/voice_labels.py` on the server — the same table on both sides is what
 * keeps the count the form previews equal to the roll call the server builds.
 */
export type SectionLetter = "S" | "A" | "T" | "B";
export const SECTION_LETTERS: readonly SectionLetter[] = ["S", "A", "T", "B"];

/**
 * Which sections a VOICE TYPE belongs to — the declared home of the three
 * intermediate voices (a mezzo is called with the sopranos AND the altos, a
 * countertenor with the altos, a baritone with the tenors AND the basses;
 * over-calling is the chosen failure mode). A conductor or a player belongs
 * to no section.
 */
const SECTIONS_BY_VOICE_TYPE: Readonly<Record<VoiceType, string>> = {
  SOP: "S",
  MEZ: "SA",
  ALT: "A",
  CT: "A",
  TEN: "T",
  BAR: "TB",
  BAS: "B",
  DIR: "",
  INS: "",
};

/** Which sections a standalone VOICE LINE belongs to; divisi lines answer by family. */
const SECTIONS_BY_STANDALONE_LINE: Readonly<Record<string, string>> = {
  MS: "SA",
  CT: "A",
  BAR: "TB",
};

/** "AS" / ["A", "S", "S"] → "SA": deduplicated, in SATB order, unknown letters dropped. */
export const canonicalSectionLetters = (letters: Iterable<string>): string => {
  const wanted = new Set(letters);
  return SECTION_LETTERS.filter((letter) => wanted.has(letter)).join("");
};

export const sectionLettersOfVoiceType = (voiceType: VoiceType | null): string =>
  voiceType ? SECTIONS_BY_VOICE_TYPE[voiceType] : "";

export const sectionLettersOfVoiceLine = (voiceLine: string | null): string => {
  if (!voiceLine) return "";
  const family = voiceFamilyOf(voiceLine);
  if (family === "S" || family === "A" || family === "T" || family === "B") return family;
  return SECTIONS_BY_STANDALONE_LINE[voiceLine.toUpperCase()] ?? "";
};

/**
 * The sections that call one seat of a line-up: the declared seat wins over
 * the voice type (a mezzo seated as A1 is an alto for this concert's
 * sectionals); a seat on a role line, or no seat, falls back to the voice.
 */
export const sectionLettersOfSeat = (
  voiceType: VoiceType | null,
  voiceLine: string | null,
): string => sectionLettersOfVoiceLine(voiceLine) || sectionLettersOfVoiceType(voiceType);

/**
 * The section a singer stands in, named by the voice type that heads it — a
 * mirror of `section_of_seat` in `core/voice_labels.py`, which the cast order
 * and every printed list read. A baritone stands with the basses and a
 * countertenor with the altos; a mezzo has no single home, so an unseated one
 * keeps a section of her own. A declared seat answers first, so a baritone
 * seated T2 stands with the tenors. Conductor and players keep their own type.
 */
const SECTION_BY_VOICE_TYPE: Partial<Record<VoiceType, VoiceType>> = {
  SOP: "SOP",
  MEZ: "MEZ",
  ALT: "ALT",
  CT: "ALT",
  TEN: "TEN",
  BAR: "BAS",
  BAS: "BAS",
};
const SECTION_BY_FAMILY: Readonly<Record<SectionLetter, VoiceType>> = {
  S: "SOP",
  A: "ALT",
  T: "TEN",
  B: "BAS",
};
const SECTION_BY_STANDALONE_LINE: Readonly<Record<string, VoiceType>> = {
  MS: "MEZ",
  CT: "ALT",
  BAR: "BAS",
};

export const sectionOf = (
  voiceType: VoiceType | null,
  voiceLine: string | null,
): VoiceType | null => {
  if (!voiceType) return null;
  const ownSection = SECTION_BY_VOICE_TYPE[voiceType];
  if (!ownSection) return voiceType;
  if (voiceLine) {
    const family = voiceFamilyOf(voiceLine);
    if (family === "S" || family === "A" || family === "T" || family === "B") {
      return SECTION_BY_FAMILY[family];
    }
    const standalone = SECTION_BY_STANDALONE_LINE[voiceLine.toUpperCase()];
    if (standalone) return standalone;
  }
  return ownSection;
};

/** Whether a seat answering to `seatLetters` is called by `calledSections` ("" = everyone). */
export const sectionsCallSeat = (calledSections: string, seatLetters: string): boolean =>
  calledSections === "" || [...seatLetters].some((letter) => calledSections.includes(letter));
