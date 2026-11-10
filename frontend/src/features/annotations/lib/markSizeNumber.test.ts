/**
 * @file markSizeNumber.test.ts
 * @description Pins the number beside the size slider: `scale × 20`, one whole
 * number per slider step, the slider's ends at 10 and 48, and a typed number
 * outside them clamped back into the range rather than refused.
 * @module features/annotations/lib
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MARK_SCALE,
  MARK_SCALE_MAX,
  MARK_SCALE_MIN,
  MARK_SCALE_STEP,
  MARK_SIZE_NUMBER_MAX,
  MARK_SIZE_NUMBER_MIN,
  markSizeNumber,
  scaleOfSizeNumber,
} from "./useAnnotationTools";

describe("the size number", () => {
  it("reads 10 and 48 at the slider's ends and 20 at the base size", () => {
    expect(MARK_SIZE_NUMBER_MIN).toBe(10);
    expect(MARK_SIZE_NUMBER_MAX).toBe(48);
    expect(markSizeNumber(MARK_SCALE_MIN)).toBe(10);
    expect(markSizeNumber(MARK_SCALE_MAX)).toBe(48);
    expect(markSizeNumber(DEFAULT_MARK_SCALE)).toBe(20);
  });

  it("is one whole number per slider step, and maps back to the same step", () => {
    for (let scale = MARK_SCALE_MIN; scale <= MARK_SCALE_MAX + 1e-9; scale += MARK_SCALE_STEP) {
      const number = markSizeNumber(scale);
      expect(Number.isInteger(number)).toBe(true);
      expect(scaleOfSizeNumber(number)).toBeCloseTo(scale, 9);
    }
  });

  it("clamps a typed number into the slider's range", () => {
    expect(scaleOfSizeNumber(9)).toBe(MARK_SCALE_MIN);
    expect(scaleOfSizeNumber(0)).toBe(MARK_SCALE_MIN);
    expect(scaleOfSizeNumber(49)).toBe(MARK_SCALE_MAX);
    expect(scaleOfSizeNumber(99)).toBe(MARK_SCALE_MAX);
  });

  it("shows a size off the grid (an older note's) as its nearest number", () => {
    expect(markSizeNumber(1.33)).toBe(27);
    expect(markSizeNumber(undefined)).toBe(20);
  });
});
