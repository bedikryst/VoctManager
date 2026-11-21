/**
 * @file recordContradictions.test.ts
 * @description The three self-contradictions the piece card notes on a field.
 */

import { describe, expect, it } from "vitest";

import type { Composer } from "@/shared/types";
import { recordContradictions } from "./recordContradictions";

type Checked = Parameters<typeof recordContradictions>[0];

const composer = (birth: string, death: string): Composer =>
  ({ birth_year: birth, death_year: death } as Partial<Composer> as Composer);

const piece = (overrides: Partial<Checked>): Checked => ({
  composition_year: null,
  composer: undefined,
  lyrics_original: "",
  lyrics_ipa: "",
  arranger: "",
  epoch: "",
  ...overrides,
});

describe("recordContradictions", () => {
  it("finds nothing in a consistent record", () => {
    expect(recordContradictions(piece({
      composition_year: 1733,
      composer: composer("1685", "1750"),
      lyrics_original: "Magnificat\nanima mea",
      lyrics_ipa: "maɲˈɲifikat\nˈanima ˈmea",
      arranger: "",
      epoch: "BAR",
    }))).toEqual({ year: null, lines: null, epoch: false });
  });

  it("flags a year before the composer's birth", () => {
    expect(recordContradictions(piece({ composition_year: 1741, composer: composer("1873", "1943") })).year)
      .toEqual({ kind: "before_birth", year: 1741, birth: 1873 });
  });

  it("allows posthumous years up to fifty years after death, then flags them", () => {
    const bach = composer("ca. 1685", "1750");
    expect(recordContradictions(piece({ composition_year: 1800, composer: bach })).year).toBeNull();
    expect(recordContradictions(piece({ composition_year: 1801, composer: bach })).year)
      .toEqual({ kind: "long_after_death", year: 1801, death: 1750 });
  });

  it("compares non-empty line counts of the lyrics and the IPA", () => {
    expect(recordContradictions(piece({ lyrics_original: "a\n\nb\nc", lyrics_ipa: "a\nb" })).lines)
      .toEqual({ lyrics: 3, ipa: 2 });
    expect(recordContradictions(piece({ lyrics_original: "a\nb", lyrics_ipa: "" })).lines).toBeNull();
  });

  it("flags a modern epoch on an arranged work only", () => {
    expect(recordContradictions(piece({ arranger: "T. Kuras", epoch: "CON" })).epoch).toBe(true);
    expect(recordContradictions(piece({ arranger: "  ", epoch: "M20" })).epoch).toBe(false);
    expect(recordContradictions(piece({ arranger: "T. Kuras", epoch: "REN" })).epoch).toBe(false);
  });
});
