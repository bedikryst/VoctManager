/**
 * @file pairLyrics.test.ts
 * @description Reading pairs preserve line order and never drop an unmatched line.
 */

import { describe, expect, it } from "vitest";

import { pairLyrics } from "./pairLyrics";

describe("pairLyrics", () => {
  it("pairs matching stanza lines across newline conventions", () => {
    expect(pairLyrics("Kyrie\r\n\r\neleison\r\n", "ˈky.ri.e\n\neˈle.i.son")).toEqual([
      { lyric: "Kyrie", ipa: "ˈky.ri.e" },
      { lyric: "", ipa: "" },
      { lyric: "eleison", ipa: "eˈle.i.son" },
    ]);
  });

  it("leaves either input intact for the separate editors when the counts differ", () => {
    expect(pairLyrics("Canite\ntuba", "kaˈni.te")).toBeNull();
    expect(pairLyrics("Canite", "kaˈni.te\nˈtu.ba")).toBeNull();
    expect(pairLyrics("Canite", "  ")).toBeNull();
  });
});
