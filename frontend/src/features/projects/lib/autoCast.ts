/**
 * @file autoCast.ts
 * @description Filling a divisi board from the concert's line-up: which voice
 * line each singer takes on a piece nobody has cast by hand.
 *
 * One rule, applied in order, and it never guesses:
 *   1. the seat the line-up gives them, when this piece declares that line;
 *   2. otherwise their family's line here — but only when the family has exactly
 *      ONE, the same reading that lets an undivided family print without its
 *      index (`collapseVoiceLabels`);
 *   3. otherwise TUTTI, when the piece declares it and nothing of their family:
 *      a unison setting is sung by everybody.
 * Anyone else is left unplaced. A singer the rule cannot seat is a hole the
 * conductor has to see, not a part quietly written onto a page they will sing
 * from — and the pieces that stop the rule (a divided family, a voice type that
 * sits in two of them) are exactly the ones a musician has to decide.
 *
 * The fill only ever adds: a seat already on the board is never moved, so an
 * automatic pass can extend the conductor's work but never overwrite it.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/autoCast
 */

import type { ParticipationStatus, VoiceLine, VoiceType } from "@/shared/types";

import { voiceFamilyOf, type VoiceFamilyId } from "./voiceFamilies";

/**
 * The seats a line-up can hand out: the twelve choral lines and nothing else.
 * TUTTI and SOLO are properties of a piece rather than standing places in a
 * concert, and the untyped V1…V4 exist only inside the canon that declares them
 * — none of the three describes where a singer sits all evening. All of them
 * remain reachable by hand, on the piece that needs them.
 */
export const LINE_UP_SEATS: readonly VoiceLine[] = [
  "S1", "S2", "S3",
  "A1", "A2", "A3",
  "T1", "T2", "T3",
  "B1", "B2", "B3",
];

/** One castable person, as the line-up describes them. */
export interface LineUpMember {
  readonly participationId: string;
  readonly voiceType: VoiceType | null;
  /** Their seat in this concert's line-up; `null` when none was recorded. */
  readonly seat: VoiceLine | null;
  readonly status: ParticipationStatus;
}

export interface AutoCastSeat {
  readonly participationId: string;
  readonly voiceLine: VoiceLine;
}

export interface AutoCastResult {
  readonly seats: readonly AutoCastSeat[];
  /** Participation ids the rule refused to place — they need a seat or a hand. */
  readonly skipped: readonly string[];
}

/**
 * What a piece with no divisi on record is filled into. Nothing declared is not
 * the same as no voices: the board offers every line for such a piece, and the
 * first line of each family is what a plain four-part reading means — those four
 * print as "Sopran", "Alt"… precisely because nothing else of their family ends
 * up on the board.
 *
 * A singer whose line-up seat carries an index therefore lands on their family's
 * first line here, not on the seat: "Sopran 2" against a divisi nobody wrote
 * promises the singer a second soprano part the score never mentions. Declare
 * the divisi and the seat is honoured exactly.
 */
const IMPLICIT_LINES: readonly VoiceLine[] = ["S1", "A1", "T1", "B1"];

/**
 * Voice type → choral family, for the types where that is a fact and not a
 * decision. Mezzo, countertenor and baritone are deliberately absent: they sing
 * S2 *or* A1, A1 *or* T2, T2 *or* B1 depending on the piece, so an automatic
 * choice would print a part nobody agreed to. Those singers are placed by their
 * line-up seat, or by hand.
 */
const FAMILY_BY_VOICE_TYPE: Partial<Record<VoiceType, VoiceFamilyId>> = {
  SOP: "S",
  ALT: "A",
  TEN: "T",
  BAS: "B",
};

/**
 * The family this singer folds into. A line-up seat answers it outright — except
 * for the standalone roles (SOLO, TUTTI), which belong to no family and must not
 * drag their holder onto another role that happens to be the only one declared.
 */
const familyOf = (member: LineUpMember): VoiceFamilyId | null => {
  if (member.seat) {
    const family = voiceFamilyOf(member.seat);
    return family === "ROLE" ? null : family;
  }
  return member.voiceType
    ? (FAMILY_BY_VOICE_TYPE[member.voiceType] ?? null)
    : null;
};

/** The line one singer takes on a piece declaring `declaredLines`, or null. */
export const resolveAutoSeat = (
  member: LineUpMember,
  declaredLines: readonly VoiceLine[],
): VoiceLine | null => {
  // A declined seat is known to be empty, and the server refuses to fill one.
  if (member.status === "DEC") return null;

  const lines = declaredLines.length > 0 ? declaredLines : IMPLICIT_LINES;

  if (member.seat && lines.includes(member.seat)) return member.seat;

  const family = familyOf(member);
  if (family) {
    const ofFamily = lines.filter((line) => voiceFamilyOf(line) === family);
    if (ofFamily.length === 1) return ofFamily[0];
    // Divided here, and the line-up did not say which half: the conductor's call.
    if (ofFamily.length > 1) return null;
  }

  return lines.includes("TUTTI") ? "TUTTI" : null;
};

/**
 * The seats one piece would gain. `alreadyCast` is every participation already
 * holding a seat on it — the fill adds to a board, it does not rebuild one.
 */
export const autoCastPiece = (
  members: readonly LineUpMember[],
  declaredLines: readonly VoiceLine[],
  alreadyCast: ReadonlySet<string>,
): AutoCastResult => {
  const seats: AutoCastSeat[] = [];
  const skipped: string[] = [];

  for (const member of members) {
    if (alreadyCast.has(member.participationId)) continue;
    // Not "skipped": there is nothing to place, so nothing to report either.
    if (member.status === "DEC") continue;

    const voiceLine = resolveAutoSeat(member, declaredLines);
    if (voiceLine) {
      seats.push({ participationId: member.participationId, voiceLine });
    } else {
      skipped.push(member.participationId);
    }
  }

  return { seats, skipped };
};
