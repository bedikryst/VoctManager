/**
 * @file quickPhrases.test.ts
 * @description Pins the writer's own phrases: what a device keeps (the last used
 * first, twelve at most, each word once, its slant carried) and the chip row
 * built from it, the edition's short notes and the presets.
 * @module features/annotations/lib
 */

import { describe, expect, it } from "vitest";

import {
  MAX_RECENT_PHRASES,
  MAX_SAVED_PHRASES,
  quickPhraseRow,
  rememberPhrase,
  type Phrase,
} from "./quickPhrases";

const upright = (text: string): Phrase => ({ text, italic: false });
const slanted = (text: string): Phrase => ({ text, italic: true });

describe("rememberPhrase", () => {
  it("puts the phrase used last at the front", () => {
    const kept = [upright("razem"), slanted("più")];
    expect(rememberPhrase(kept, slanted("o.n."))).toEqual([
      slanted("o.n."),
      upright("razem"),
      slanted("più"),
    ]);
  });

  it("moves a word it already holds instead of keeping it twice, and takes its new slant", () => {
    const kept = [upright("razem"), upright("Più"), upright("lżej")];
    expect(rememberPhrase(kept, slanted(" più "))).toEqual([
      slanted("più"),
      upright("razem"),
      upright("lżej"),
    ]);
  });

  it("keeps twelve, so the least used falls off the end", () => {
    const kept = Array.from({ length: MAX_SAVED_PHRASES }, (_, i) => upright(`słowo ${i}`));
    const next = rememberPhrase(kept, upright("nowe"));
    expect(next).toHaveLength(MAX_SAVED_PHRASES);
    expect(next[0]).toEqual(upright("nowe"));
    expect(next).not.toContainEqual(upright(`słowo ${MAX_SAVED_PHRASES - 1}`));
  });

  it("keeps no sentence and no preset", () => {
    const kept = [upright("razem")];
    expect(rememberPhrase(kept, upright("a sentence far too long for a chip"))).toEqual(kept);
    expect(rememberPhrase(kept, upright("Wejście"), ["wejście"])).toEqual(kept);
    expect(rememberPhrase(kept, upright("   "))).toEqual(kept);
  });
});

describe("quickPhraseRow", () => {
  it("offers the device's phrases, then the edition's notes, then the presets, each word once", () => {
    const row = quickPhraseRow(
      [slanted("più"), upright("razem")],
      [upright("Più"), upright("oddech"), upright("końcówki")],
      ["razem", "końcówki", "lżej"],
    );
    expect(row).toEqual([
      slanted("più"),
      upright("oddech"),
      upright("razem"),
      upright("końcówki"),
      upright("lżej"),
    ]);
  });

  it("takes at most eight of the edition's notes, skipping sentences", () => {
    const notes = [
      upright("this one is far too long to be a chip"),
      ...Array.from({ length: MAX_RECENT_PHRASES + 2 }, (_, i) => upright(`nuta ${i}`)),
    ];
    const row = quickPhraseRow([], notes, []);
    expect(row).toHaveLength(MAX_RECENT_PHRASES);
    expect(row[0]).toEqual(upright("nuta 0"));
  });
});
