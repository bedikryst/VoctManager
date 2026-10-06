/**
 * @file voiceFamilies.ts
 * @description Which voice family a `VoiceLine` code belongs to, the score
 * order of those families, and a cast list laid out by them. `VoiceLine` mixes
 * three kinds of value — the four choral families with their divisi index
 * (S1…B3) plus the untyped canon parts (V1…), the intermediate parts that are
 * one line each (MS, CT, BAR) and standalone roles (SOLO, VP, TUTTI, BACK,
 * ACC, PRON) — so membership has to be declared rather than tested by prefix:
 * a prefix test files SOLO under the sopranos, ACC under the altos, BAR under
 * the basses, and leaves VP and PRON in no group at all.
 *
 * The casting board, the plan editor and every read-only cast list share this
 * one table; the seat → section rules that only the project's own screens
 * read stay in `features/projects/lib/voiceFamilies`.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/voiceFamilies
 */

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

/** One line of a cast list: its code, its name, and who stands on it. */
export interface CastLineGroup<T> {
  /** The `VoiceLine` code; empty for members cast on no line. */
  readonly code: string;
  readonly label: string;
  readonly members: readonly T[];
}

/** One voice family's lines, read across one row of a cast list. */
export interface CastFamilyRow<T> {
  readonly family: VoiceFamilyId;
  readonly lines: readonly CastLineGroup<T>[];
}

/**
 * A cast list as a score reads: one row per voice family in score order, the
 * family's own lines across it (S1 beside S2), so a soprano line never shares
 * a row with a tenor one. Members are grouped by code, and the label is the
 * caller's — the server's display name, which knows whether the family is
 * divided in this piece; nothing here re-derives a name from a code. Members
 * without a line gather in one line at the end of the role row.
 */
export const castRowsByFamily = <T>(
  members: readonly T[],
  codeOf: (member: T) => string,
  labelOf: (member: T) => string,
): CastFamilyRow<T>[] => {
  const lines = new Map<string, { label: string; members: T[] }>();
  for (const member of members) {
    const code = codeOf(member);
    const line = lines.get(code);
    if (line) line.members.push(member);
    else lines.set(code, { label: labelOf(member), members: [member] });
  }

  const byFamily = new Map<VoiceFamilyId, CastLineGroup<T>[]>();
  for (const [code, line] of lines) {
    const family = voiceFamilyOf(code);
    const group: CastLineGroup<T> = { code, label: line.label, members: line.members };
    const bucket = byFamily.get(family);
    if (bucket) bucket.push(group);
    else byFamily.set(family, [group]);
  }

  return VOICE_FAMILY_ORDER.flatMap((family) => {
    const familyLines = byFamily.get(family);
    if (!familyLines) return [];
    const ordered = [...familyLines].sort((left, right) => {
      if (left.code === "" || right.code === "") return left.code === "" ? 1 : -1;
      return left.code.localeCompare(right.code, undefined, { numeric: true });
    });
    return [{ family, lines: ordered }];
  });
};
