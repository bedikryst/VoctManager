/**
 * @file voices.test.ts
 * @description Pins the keyboard window: a voice's usual range and a fifth each
 * side, ending on white keys, never past G1–C7, and never hiding a note the
 * singer has already chosen.
 * @module features/vocal-range/constants/voices
 */

import { describe, expect, it } from "vitest";

import { keyboardWindow } from "./voices";

describe("keyboardWindow", () => {
  it("reaches a fifth past the usual range", () => {
    // Soprano c¹–c³ → f–g³.
    expect(keyboardWindow("SOP", [])).toEqual({ low: 53, high: 91 });
    // Bass E–e¹ → A₁–h¹.
    expect(keyboardWindow("BAS", [])).toEqual({ low: 33, high: 71 });
  });

  it("ends on white keys", () => {
    // Alto f–f²: a fifth below is B♭, widened to A.
    expect(keyboardWindow("ALT", [])).toEqual({ low: 45, high: 84 });
  });

  it("takes in a chosen note outside the window", () => {
    expect(keyboardWindow("SOP", [40, 69])).toEqual({ low: 40, high: 91 });
  });

  it("stays inside G1–C7", () => {
    expect(keyboardWindow("BAS", [20])).toEqual({ low: 31, high: 71 });
  });
});
