/**
 * @file autoCast.ts
 * @description Filling a divisi board from the concert's line-up: which voice
 * line each singer takes on a piece nobody has cast by hand.
 *
 * One rule, applied in order, and it never guesses:
 *   1. the part the piece writes for their own voice type (Ms, Ct, Bar), when
 *      it writes one — a baritone seated `B1` for the concert still sings the
 *      baritone part of the one piece that has it;
 *   2. the seat the line-up gives them, when this piece declares that line —
 *      the conductor's decision for this concert;
 *   3. otherwise their family's line here — but only when the family has
 *      exactly ONE, the same reading that lets an undivided family print
 *      without its index (`collapseVoiceLabels`). A baritone is a bass wherever
 *      no baritone part is written, and on a B1/B2 split takes the upper line;
 *   4. otherwise TUTTI, when the piece declares it and nothing of their family:
 *      a unison setting is sung by everybody.
 * An instrumentalist is outside that ladder: they take ACC when the piece
 * declares an accompaniment and are skipped otherwise — never TUTTI, which is
 * a sung part, and never a family line. A conductor in the cast (the seat that
 * carries their fee) sings nothing and is never placed.
 * Anyone else is left unplaced. A singer the rule cannot seat is a hole the
 * conductor has to see, not a part quietly written onto a page they will sing
 * from — and the pieces that stop the rule (a divided family, a voice type that
 * sits in two of them) are exactly the ones a musician has to decide. Which
 * basses sing B1 and which B2 is one of them: that depends on who else is in
 * the section, so it takes a seat.
 *
 * The fill only ever adds: a seat already on the board is never moved, so an
 * automatic pass can extend the conductor's work but never overwrite it.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/autoCast
 */

import { isInstrumentalist } from "@/shared/lib/voiceTypes";
import type { ParticipationStatus, VoiceLine, VoiceType } from "@/shared/types";

import { voiceFamilyOf, type VoiceFamilyId } from "./voiceFamilies";

/**
 * The seats a line-up can hand out: the twelve choral lines, the three
 * intermediate parts, and nothing else. TUTTI and SOLO are properties of a
 * piece rather than standing places in a concert, and the untyped V1…V4 exist
 * only inside the canon that declares them — none of the three describes where
 * a singer sits all evening. All of them remain reachable by hand, on the
 * piece that needs them. Score order, top staff down, as `castOrder` ranks
 * seats by their index here.
 */
export const LINE_UP_SEATS: readonly VoiceLine[] = [
  "S1", "S2", "S3",
  "MS",
  "A1", "A2", "A3",
  "CT",
  "T1", "T2", "T3",
  "BAR",
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
 * The part an arrangement writes for a voice type itself — an S/Ms/A treble
 * score, a T/Bar/B men's one. It outranks the line-up seat: the seat says where
 * a singer stands across the concert, and a piece that writes their own voice
 * a part has said where they stand in it.
 */
const OWN_LINE_BY_VOICE_TYPE: Partial<Record<VoiceType, VoiceLine>> = {
  MEZ: "MS",
  CT: "CT",
  BAR: "BAR",
};

/**
 * Voice type → choral family, for the types where that is a fact and not a
 * decision. A baritone is a bass wherever no baritone part is written. A mezzo
 * or countertenor folds into their own one-line family, so outside a part of
 * their own they are left unplaced: on an SATB piece they sing S2 *or* A1,
 * A1 *or* T2, and an automatic choice there would print a part nobody agreed
 * to. Those singers are placed by their line-up seat, or by hand.
 */
const FAMILY_BY_VOICE_TYPE: Partial<Record<VoiceType, VoiceFamilyId>> = {
  SOP: "S",
  MEZ: "MS",
  ALT: "A",
  CT: "CT",
  TEN: "T",
  BAR: "B",
  BAS: "B",
};

/**
 * The family this singer folds into. A line-up seat answers it outright — except
 * for the standalone roles (SOLO, TUTTI), which belong to no family and must not
 * drag their holder onto another role that happens to be the only one declared.
 * A baritone seat folds into the basses like the baritone voice type does.
 */
const familyOf = (member: LineUpMember): VoiceFamilyId | null => {
  if (member.seat) {
    const family = voiceFamilyOf(member.seat);
    if (family === "ROLE") return null;
    return family === "BAR" ? "B" : family;
  }
  return member.voiceType
    ? (FAMILY_BY_VOICE_TYPE[member.voiceType] ?? null)
    : null;
};

/**
 * Whether this singer is the concert's baritone: seated on the baritone line,
 * or, with no seat, a baritone by voice type. On a piece that divides its
 * basses into exactly B1 and B2 and writes no baritone part, that singer takes
 * B1 — the reading a choral bass split is written for. Only the baritone is
 * placed this way: a bass may sing either half, depending on who else stands
 * in the section, so the basses' split stays with their seats.
 */
const isBaritone = (member: LineUpMember): boolean =>
  member.seat ? member.seat === "BAR" : member.voiceType === "BAR";

const isExactBassSplit = (ofFamily: readonly VoiceLine[]): boolean =>
  ofFamily.length === 2 && ofFamily.includes("B1") && ofFamily.includes("B2");

/** The line one singer takes on a piece declaring `declaredLines`, or null. */
export const resolveAutoSeat = (
  member: LineUpMember,
  declaredLines: readonly VoiceLine[],
): VoiceLine | null => {
  // A declined seat is known to be empty, and the server refuses to fill one.
  if (member.status === "DEC") return null;

  // A player is placed by the piece, not by a family: on ACC when the
  // arrangement declares an accompaniment, nowhere when it does not. Decided
  // before the ladder below, whose TUTTI fallback would otherwise hand the
  // organist a sung part on every a cappella motet.
  if (isInstrumentalist(member.voiceType)) {
    return declaredLines.includes("ACC") ? "ACC" : null;
  }
  if (member.voiceType === "DIR") return null;

  const lines = declaredLines.length > 0 ? declaredLines : IMPLICIT_LINES;

  const ownLine = member.voiceType
    ? OWN_LINE_BY_VOICE_TYPE[member.voiceType]
    : undefined;
  if (ownLine && lines.includes(ownLine)) return ownLine;

  if (member.seat && lines.includes(member.seat)) return member.seat;

  const family = familyOf(member);
  if (family) {
    const ofFamily = lines.filter((line) => voiceFamilyOf(line) === family);
    if (ofFamily.length === 1) return ofFamily[0];
    if (family === "B" && isBaritone(member) && isExactBassSplit(ofFamily)) {
      return "B1";
    }
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
