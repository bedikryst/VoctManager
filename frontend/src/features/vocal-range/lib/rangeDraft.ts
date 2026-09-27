/**
 * @file rangeDraft.ts
 * @description The singer's range while they write it: four slots filled by
 * touching keys, checked by the same rules the server's
 * `VocalRangeProposalDTO` applies, and turned into what the keyboard draws,
 * what the send button plays and what the PUT carries.
 * @module features/vocal-range/lib/rangeDraft
 */

import type { VocalRangeProposal } from "@/shared/auth/auth.types";
import type { VocalRangeMidi } from "@/shared/lib/music/pitchNotation";
import type { KeyboardBand } from "@/shared/ui/instruments/VerticalKeyboard";

export type RangeSlot = keyof VocalRangeMidi;

/** The order the conductor writes them: `a (g) – a² (c³)`. */
export const RANGE_SLOTS: readonly RangeSlot[] = [
  "tessituraLow",
  "extremeLow",
  "tessituraHigh",
  "extremeHigh",
];

export const isExtremeSlot = (slot: RangeSlot): boolean =>
  slot === "extremeLow" || slot === "extremeHigh";

export const EMPTY_DRAFT: VocalRangeMidi = {
  tessituraLow: null,
  tessituraHigh: null,
  extremeLow: null,
  extremeHigh: null,
};

export const draftFromProposal = (
  proposal: VocalRangeProposal | null | undefined,
): VocalRangeMidi =>
  proposal
    ? {
        tessituraLow: proposal.tessitura_low,
        tessituraHigh: proposal.tessitura_high,
        extremeLow: proposal.extreme_low,
        extremeHigh: proposal.extreme_high,
      }
    : EMPTY_DRAFT;

export type RangeProblem =
  | "tessituraOrder"
  | "extremeLowOrder"
  | "extremeHighOrder"
  | "incomplete";

/**
 * The first thing that keeps the draft from being sent, or null when it can go.
 * A contradiction among the notes already chosen comes before a missing one: it
 * is the thing the singer has to undo. An extreme may equal its tessitura bound,
 * as the server allows.
 */
export const rangeProblem = (draft: VocalRangeMidi): RangeProblem | null => {
  const { tessituraLow, tessituraHigh, extremeLow, extremeHigh } = draft;
  if (tessituraLow !== null && tessituraHigh !== null && tessituraLow >= tessituraHigh) {
    return "tessituraOrder";
  }
  if (extremeLow !== null && tessituraLow !== null && extremeLow > tessituraLow) {
    return "extremeLowOrder";
  }
  if (extremeHigh !== null && tessituraHigh !== null && extremeHigh < tessituraHigh) {
    return "extremeHighOrder";
  }
  if (tessituraLow === null || tessituraHigh === null) return "incomplete";
  return null;
};

/**
 * What the keyboard tints: the tessitura bright, each reach beyond it thin. A
 * lone or contradictory bound is still drawn, as the one key it is, so the
 * keyboard never hides a note the slots show.
 */
export const rangeBands = (draft: VocalRangeMidi): readonly KeyboardBand[] => {
  const { tessituraLow, tessituraHigh, extremeLow, extremeHigh } = draft;
  const bands: KeyboardBand[] = [];
  const point = (midi: number, weight: KeyboardBand["weight"]): KeyboardBand => ({
    low: midi,
    high: midi,
    weight,
  });

  if (tessituraLow !== null && tessituraHigh !== null && tessituraLow < tessituraHigh) {
    bands.push({ low: tessituraLow, high: tessituraHigh, weight: "bright" });
  } else {
    if (tessituraLow !== null) bands.push(point(tessituraLow, "bright"));
    if (tessituraHigh !== null) bands.push(point(tessituraHigh, "bright"));
  }
  if (extremeLow !== null) {
    bands.push(
      tessituraLow !== null && extremeLow <= tessituraLow
        ? { low: extremeLow, high: tessituraLow, weight: "thin" }
        : point(extremeLow, "thin"),
    );
  }
  if (extremeHigh !== null) {
    bands.push(
      tessituraHigh !== null && extremeHigh >= tessituraHigh
        ? { low: tessituraHigh, high: extremeHigh, weight: "thin" }
        : point(extremeHigh, "thin"),
    );
  }
  return bands;
};

/** How far an empty tessitura slot opens from the voice's centre: a fifth. */
const EMPTY_TESSITURA_SHIFT = 7;
/** How far an empty extreme opens past its tessitura bound: a minor third. */
const EMPTY_EXTREME_SHIFT = 3;

/**
 * The key the keyboard brings to the middle when a slot is selected: the
 * slot's own note, or, for an empty slot, a guess on the slot's side, so the
 * high slot does not open on the low register just chosen.
 */
export const slotCentre = (
  slot: RangeSlot,
  draft: VocalRangeMidi,
  voiceCentre: number,
): number => {
  const value = draft[slot];
  if (value !== null) return value;
  const lowGuess = voiceCentre - EMPTY_TESSITURA_SHIFT;
  const highGuess = voiceCentre + EMPTY_TESSITURA_SHIFT;
  switch (slot) {
    case "tessituraLow":
      return lowGuess;
    case "tessituraHigh":
      return highGuess;
    case "extremeLow":
      return (draft.tessituraLow ?? lowGuess) - EMPTY_EXTREME_SHIFT;
    case "extremeHigh":
      return (draft.tessituraHigh ?? highGuess) + EMPTY_EXTREME_SHIFT;
  }
};

/** Inclusive MIDI bounds; either may be infinite. */
export interface PitchSpan {
  readonly low: number;
  readonly high: number;
}

/**
 * The keys that keep the selected slot on the right side of the tessitura, or
 * null when nothing constrains it yet. An extreme answers to its own tessitura
 * bound and may equal it; each tessitura bound answers to the other and may
 * not. The keyboard dims the rest, so an order error is rare rather than
 * forbidden: a dimmed key still sounds and still fills the slot.
 */
export const slotSpan = (
  slot: RangeSlot,
  draft: VocalRangeMidi,
): PitchSpan | null => {
  const below = Number.NEGATIVE_INFINITY;
  const above = Number.POSITIVE_INFINITY;
  const { tessituraLow, tessituraHigh } = draft;
  switch (slot) {
    case "tessituraLow":
      return tessituraHigh === null ? null : { low: below, high: tessituraHigh - 1 };
    case "tessituraHigh":
      return tessituraLow === null ? null : { low: tessituraLow + 1, high: above };
    case "extremeLow":
      return tessituraLow === null ? null : { low: below, high: tessituraLow };
    case "extremeHigh":
      return tessituraHigh === null ? null : { low: tessituraHigh, high: above };
  }
};

/** Every note the singer chose, lowest first and each once: what the send
 *  button plays back, so the singer hears what the conductor will read. */
export const rangePitches = (draft: VocalRangeMidi): readonly number[] =>
  Array.from(
    new Set(
      RANGE_SLOTS.map((slot) => draft[slot]).filter(
        (midi): midi is number => midi !== null,
      ),
    ),
  ).sort((a, b) => a - b);

/** The body of `PUT /api/artists/me/vocal-range/`. */
export interface VocalRangeSubmission {
  readonly tessitura_low: number;
  readonly tessitura_high: number;
  readonly extreme_low: number | null;
  readonly extreme_high: number | null;
  readonly comment: string;
}

/** Null while the draft has a problem; the server would refuse it anyway. */
export const toSubmission = (
  draft: VocalRangeMidi,
  comment: string,
): VocalRangeSubmission | null => {
  if (rangeProblem(draft) !== null) return null;
  if (draft.tessituraLow === null || draft.tessituraHigh === null) return null;
  return {
    tessitura_low: draft.tessituraLow,
    tessitura_high: draft.tessituraHigh,
    extreme_low: draft.extremeLow,
    extreme_high: draft.extremeHigh,
    comment: comment.trim(),
  };
};
