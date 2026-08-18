/**
 * @file PieceMetadataForm.test.ts
 * @description Guards the one clause of the Piece Card's form contract that
 * fails silently: `composition_year` has to parse `null`.
 *
 * `null` is what the API returns for a piece without a year, what the card
 * loads as its default and what the fact strip writes when the cell is cleared
 * — but the resting layout edits that field through an inline cell with no
 * error slot, so a schema that rejects it does not produce a visible error. It
 * produces a save button that does nothing, on a form the typecheck, the build
 * and the screen all call healthy.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceMetadataForm.test
 */

import { describe, expect, it } from "vitest";

import { pieceCardSchema } from "@/features/archive/components/PieceMetadataForm";

/** The card's payload with only the year varied — everything else is valid. */
const parseYear = (
  composition_year: unknown,
): ReturnType<typeof pieceCardSchema.safeParse> =>
  pieceCardSchema.safeParse({
    title: "Magnificat",
    arranger: "",
    opus_catalog: "",
    musical_key: "",
    language: "",
    voicing: "",
    text_source: "",
    composition_year,
    epoch: "",
    lyrics_original: "",
    lyrics_ipa: "",
    description: "",
    duration_mins: 0,
    duration_secs: 0,
  });

describe("pieceCardSchema.composition_year", () => {
  it("accepts a piece that has no year", () => {
    const result = parseYear(null);
    expect(result.success).toBe(true);
    expect(result.success && result.data.composition_year).toBeNull();
  });

  it("reads a cleared cell as no year", () => {
    const result = parseYear("");
    expect(result.success).toBe(true);
    expect(result.success && result.data.composition_year).toBeNull();
  });

  it("coerces the number input's string", () => {
    const result = parseYear("1723");
    expect(result.success).toBe(true);
    expect(result.success && result.data.composition_year).toBe(1723);
  });

  it("refuses a year outside the archive's range", () => {
    expect(parseYear(42).success).toBe(false);
    expect(parseYear(2500).success).toBe(false);
  });
});
