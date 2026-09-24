/**
 * @file soloAssignments.ts
 * @description The named-solo layer of a piece's casting, kept apart from the
 * divisi board. A solo is a duty added to a performer, never a voice line: the
 * board saves choral seats only, the solo editor saves named positions only,
 * and neither payload can carry the other's rows — which is what lets the two
 * editors share one screen without one save erasing the other.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/soloAssignments
 */

import type {
  ParticipationStatus,
  PieceCasting,
  ProjectSoloAssignment,
  VoiceRequirement,
} from "@/shared/types";

import type { SoloAssignmentRowDTO } from "../types/project.dto";

/**
 * The voice line of the rows written before named positions existed. Such a row
 * is a solo of unknown extent: it is shown, counted as a duty and offered for
 * conversion, but it is never a seat on the board.
 */
export const LEGACY_SOLO_LINE = "SOLO";

/** One named position as the editor holds it between saves. */
export interface SoloDraftRow {
  /** Stable React key: the server id once saved, a local one before. */
  readonly key: string;
  readonly id: string | null;
  readonly label: string;
  readonly scoreReference: string;
  readonly participation: string | null;
  readonly notes: string;
  readonly givesPitch: boolean;
  /**
   * The server's cue that the programme now binds another edition than the
   * reference was written against. Cleared once the reference is edited — the
   * save stamps it against the edition bound now.
   */
  readonly referenceNeedsReview: boolean;
}

/**
 * How far a piece's named solos are filled. Counted per position, not per
 * person: one singer holding three passages fills three positions and is still
 * one performer. Legacy rows are reported beside the figure, never inside it —
 * they have no position to fill.
 */
export interface SoloCoverage {
  readonly filled: number;
  readonly total: number;
  readonly legacy: number;
}

/** The divisi board's own rows: every casting except the legacy solos. */
export const boardCastings = (
  castings: readonly PieceCasting[],
): PieceCasting[] =>
  castings.filter((casting) => casting.voice_line !== LEGACY_SOLO_LINE);

/**
 * The requirements the board seats singers against. A declared SOLO count
 * describes the score, not a line anyone can be dragged onto; named positions
 * answer it instead.
 */
export const choralRequirements = (
  requirements: readonly VoiceRequirement[],
): VoiceRequirement[] =>
  requirements.filter(
    (requirement) => requirement.voice_line !== LEGACY_SOLO_LINE,
  );

/** How many soloists the piece's divisi declares, for the editor's hint. */
export const declaredSoloCount = (
  requirements: readonly VoiceRequirement[],
): number =>
  requirements
    .filter((requirement) => requirement.voice_line === LEGACY_SOLO_LINE)
    .reduce((sum, requirement) => sum + requirement.quantity, 0);

export const soloRowsFromServer = (
  solos: readonly ProjectSoloAssignment[],
): SoloDraftRow[] =>
  [...solos]
    .sort((left, right) => left.position - right.position)
    .map((solo) => ({
      key: String(solo.id),
      id: String(solo.id),
      label: solo.label,
      scoreReference: solo.score_reference ?? "",
      participation: solo.participation ? String(solo.participation) : null,
      notes: solo.notes ?? "",
      givesPitch: Boolean(solo.gives_pitch),
      referenceNeedsReview: Boolean(solo.reference_needs_review),
    }));

/**
 * A position counts as filled only while its performer can sing it: a singer
 * who declined after being given the passage leaves it open, exactly as a
 * declined singer leaves a choral seat open.
 */
export const soloCoverage = (
  rows: readonly SoloDraftRow[],
  legacyCount: number,
  statusOf: (participationId: string) => ParticipationStatus | undefined,
): SoloCoverage => ({
  filled: rows.filter((row) => {
    if (!row.participation) return false;
    const status = statusOf(row.participation);
    return status !== undefined && status !== "DEC";
  }).length,
  total: rows.length,
  legacy: legacyCount,
});

const rowSignature = (row: SoloDraftRow): string =>
  JSON.stringify([
    row.id,
    row.label.trim(),
    row.scoreReference.trim(),
    row.participation,
    row.notes.trim(),
    row.givesPitch,
  ]);

/** Order is part of the draft: moving a position is a change worth saving. */
export const soloDraftsDiffer = (
  draft: readonly SoloDraftRow[],
  saved: readonly SoloDraftRow[],
): boolean =>
  draft.length !== saved.length ||
  draft.some((row, index) => rowSignature(row) !== rowSignature(saved[index]));

export const hasBlankSoloLabel = (rows: readonly SoloDraftRow[]): boolean =>
  rows.some((row) => row.label.trim() === "");

/** The declarative write for one piece: every position, in the order shown. */
export const toSoloPayload = (
  rows: readonly SoloDraftRow[],
): SoloAssignmentRowDTO[] =>
  rows.map((row, index) => ({
    ...(row.id ? { id: row.id } : {}),
    label: row.label.trim(),
    score_reference: row.scoreReference.trim(),
    participation: row.participation,
    notes: row.notes.trim(),
    gives_pitch: row.givesPitch,
    position: index,
  }));

/** Participations performing a filled named or legacy solo, per piece. */
export const soloPerformersByPiece = (
  solos: readonly ProjectSoloAssignment[],
  legacy: readonly PieceCasting[],
): Map<string, Set<string>> => {
  const performers = new Map<string, Set<string>>();
  const add = (pieceId: string, participationId: string): void => {
    const set = performers.get(pieceId) ?? new Set<string>();
    set.add(participationId);
    performers.set(pieceId, set);
  };
  solos.forEach((solo) => {
    if (solo.participation) add(String(solo.piece), String(solo.participation));
  });
  legacy.forEach((casting) =>
    add(String(casting.piece), String(casting.participation)),
  );
  return performers;
};
