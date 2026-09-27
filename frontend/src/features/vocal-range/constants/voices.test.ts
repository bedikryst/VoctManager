/**
 * @file voices.test.ts
 * @description Pins the keyboard window: the conductor's range for the voice
 * and two white keys each side, widened three white keys at a time on the
 * singer's request, ending on white keys, never past G1–C7, and never hiding a
 * note the singer has already chosen.
 * @module features/vocal-range/constants/voices
 */

import { describe, expect, it } from "vitest";

import { keyboardWindow } from "./voices";

describe("keyboardWindow", () => {
  it("shows the conductor's range and two white keys past it", () => {
    // Soprano (g – c³) → e–e³.
    expect(keyboardWindow("SOP", [])).toEqual({ low: 52, high: 88 });
    // Tenor (A – c²) → F–e².
    expect(keyboardWindow("TEN", [])).toEqual({ low: 41, high: 76 });
    // Bass (D – e¹) → down to A₁, at the conductor's word; up to g¹.
    expect(keyboardWindow("BAS", [])).toEqual({ low: 33, high: 67 });
  });

  it("widens three white keys per step, on each side separately", () => {
    // Soprano e³ → a³ above; e unchanged below.
    expect(keyboardWindow("SOP", [], { below: 0, above: 1 })).toEqual({
      low: 52,
      high: 93,
    });
    // Alto c → G, then D.
    expect(keyboardWindow("ALT", [], { below: 2, above: 0 })).toEqual({
      low: 38,
      high: 83,
    });
  });

  it("takes in a chosen note outside the window, ending on a white key", () => {
    expect(keyboardWindow("SOP", [49, 69])).toEqual({ low: 48, high: 88 });
  });

  it("stays inside G1–C7", () => {
    expect(keyboardWindow("BAS", [20])).toEqual({ low: 31, high: 67 });
    expect(keyboardWindow("SOP", [], { below: 0, above: 5 })).toEqual({
      low: 52,
      high: 96,
    });
  });
});
