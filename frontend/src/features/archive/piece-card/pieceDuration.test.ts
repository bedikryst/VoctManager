/**
 * @file pieceDuration.test.ts
 * @description Round-trip checks for editable durations and the nullable API value.
 */

import { describe, expect, it } from "vitest";
import { pieceDuration } from "./pieceDuration";

describe("pieceDuration", () => {
  it.each([
    [1, "0:01"],
    [1680, "28:00"],
    [3600, "1:00:00"],
    [3750, "1:02:30"],
    [2_147_483_647, "596523:14:07"],
  ] as const)("round-trips %i seconds as %s", (seconds, clock) => {
    expect(pieceDuration(seconds)).toBe(clock);
    expect(pieceDuration(clock)).toEqual({ valid: true, seconds });
  });

  it("accepts bare minutes and keeps empty and legacy zero durations blank", () => {
    expect(pieceDuration(" 28 ")).toEqual({ valid: true, seconds: 1680 });
    expect(pieceDuration("90:00")).toEqual({ valid: true, seconds: 5400 });
    for (const input of ["", "0", "0:00"]) {
      expect(pieceDuration(input)).toEqual({ valid: true, seconds: null });
    }
    expect(pieceDuration(null)).toBe("");
    expect(pieceDuration(0)).toBe("");
  });

  it.each(["1:60", "1:60:00", "1:0", "1:", "-1", "4.5", "1e2", "596523:14:08"])(
    "rejects invalid or overflowing input %s",
    (input) => expect(pieceDuration(input)).toEqual({ valid: false }),
  );
});
