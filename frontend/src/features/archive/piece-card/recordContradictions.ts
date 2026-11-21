/**
 * @file recordContradictions.ts
 * @description The contradictions a piece record can be checked against
 * itself for: a composition year outside the composer's life, lyrics and IPA
 * with different line counts, and a modern epoch on an arranged work (the
 * classic misfire on a traditional carol set today, whose epoch is its
 * origin's). Each is bound to the data, not to the review: a published record
 * that contradicts itself goes on saying so. The card shows each as a note on
 * the field it concerns.
 * @module features/archive/piece-card/recordContradictions
 */

import type { Piece } from "@/shared/types";

/** Posthumous first editions and completions are common; past this, suspect. */
const POSTHUMOUS_YEARS = 50;

const MODERN_EPOCHS: ReadonlySet<string> = new Set(["CON", "M20"]);

export type YearContradiction =
  | { readonly kind: "before_birth"; readonly year: number; readonly birth: number }
  | { readonly kind: "long_after_death"; readonly year: number; readonly death: number };

export interface LineCountContradiction {
  readonly lyrics: number;
  readonly ipa: number;
}

export interface RecordContradictions {
  readonly year: YearContradiction | null;
  readonly lines: LineCountContradiction | null;
  readonly epoch: boolean;
}

type CheckedPiece = Pick<Piece, "composition_year" | "composer" | "lyrics_original" | "lyrics_ipa" | "arranger" | "epoch">;

const parseYear = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const match = /\d{3,4}/.exec(String(value));
  return match ? parseInt(match[0], 10) : null;
};

const countLines = (value: string | null | undefined): number =>
  (value ?? "").split("\n").filter((line) => line.trim() !== "").length;

const yearContradiction = (piece: CheckedPiece): YearContradiction | null => {
  const year = piece.composition_year;
  if (!year || !piece.composer) return null;
  const birth = parseYear(piece.composer.birth_year);
  if (birth !== null && year < birth) return { kind: "before_birth", year, birth };
  const death = parseYear(piece.composer.death_year);
  if (death !== null && year > death + POSTHUMOUS_YEARS) return { kind: "long_after_death", year, death };
  return null;
};

export const recordContradictions = (piece: CheckedPiece): RecordContradictions => {
  const lyrics = countLines(piece.lyrics_original);
  const ipa = countLines(piece.lyrics_ipa);
  return {
    year: yearContradiction(piece),
    lines: lyrics > 0 && ipa > 0 && lyrics !== ipa ? { lyrics, ipa } : null,
    epoch: Boolean(piece.arranger?.trim()) && MODERN_EPOCHS.has(piece.epoch ?? ""),
  };
};
