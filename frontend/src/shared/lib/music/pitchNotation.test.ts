/**
 * @file pitchNotation.test.ts
 * @description Pins the conductor's own example in all three notations and the
 * places where the notations disagree: the "A1" that is 55 Hz internationally
 * but 440 Hz as Polish a¹, middle C under three names, and the Polish h/b pair
 * that an English reader takes for B and B. Also pins the spelled parts that
 * `PitchName` sets as markup, where the octave mark sits apart from the name,
 * and the spoken forms a screen reader voices.
 * @module shared/lib/music/pitchNotation
 */

import { describe, expect, it } from "vitest";

import {
  formatPitch,
  formatVocalRange,
  midiToFrench,
  midiToHz,
  midiToPolish,
  midiToScientific,
  notationForLanguage,
  resolveNotation,
  spellPitch,
  spokenPitch,
  vocalRangeTokens,
  type VocalRangeMidi,
} from "./pitchNotation";

// The conductor's brief: a (g) – a² (c³).
const BRIEF: VocalRangeMidi = {
  tessituraLow: 57, // A3
  extremeLow: 55, // G3
  tessituraHigh: 81, // A5
  extremeHigh: 84, // C6
};

describe("formatVocalRange", () => {
  it("writes the conductor's example in each notation", () => {
    expect(formatVocalRange(BRIEF, "polish")).toBe("a (g) – a² (c³)");
    expect(formatVocalRange(BRIEF, "international")).toBe("A3 (G3) – A5 (C6)");
    expect(formatVocalRange(BRIEF, "french")).toBe("la2 (sol2) – la4 (do5)");
  });

  it("leaves out the extremes a singer did not give", () => {
    expect(
      formatVocalRange(
        { ...BRIEF, extremeLow: null, extremeHigh: null },
        "polish",
      ),
    ).toBe("a – a²");
    expect(formatVocalRange({ ...BRIEF, extremeLow: null }, "polish")).toBe(
      "a – a² (c³)",
    );
  });

  it("keeps the dash beside a lone bound so its side stays readable", () => {
    expect(
      formatVocalRange(
        { ...BRIEF, tessituraHigh: null, extremeHigh: null },
        "polish",
      ),
    ).toBe("a (g) –");
    expect(
      formatVocalRange(
        { ...BRIEF, tessituraLow: null, extremeLow: null },
        "polish",
      ),
    ).toBe("– a² (c³)");
  });

  it("is empty for an empty range", () => {
    expect(
      formatVocalRange(
        {
          tessituraLow: null,
          tessituraHigh: null,
          extremeLow: null,
          extremeHigh: null,
        },
        "international",
      ),
    ).toBe("");
  });
});

describe("the traps", () => {
  it("A1 is 55 Hz, and so is Polish A₁ — not a¹", () => {
    expect(midiToScientific(33)).toBe("A1");
    expect(midiToPolish(33)).toBe("A₁");
    expect(midiToHz(33)).toBe(55);
  });

  it("a¹ is 440 Hz: A4, la3", () => {
    expect(midiToPolish(69)).toBe("a¹");
    expect(midiToScientific(69)).toBe("A4");
    expect(midiToFrench(69)).toBe("la3");
    expect(midiToHz(69)).toBe(440);
  });

  it("middle C is C4, c¹ and do3", () => {
    expect(midiToScientific(60)).toBe("C4");
    expect(midiToPolish(60)).toBe("c¹");
    expect(midiToFrench(60)).toBe("do3");
    expect(midiToHz(60)).toBeCloseTo(261.626, 3);
  });

  it("Polish h is B natural and b is B flat", () => {
    expect(midiToPolish(71)).toBe("h¹");
    expect(midiToScientific(71)).toBe("B4");
    expect(midiToPolish(70)).toBe("b¹");
    expect(midiToScientific(70)).toBe("A♯4");
    expect(midiToPolish(47)).toBe("H");
    expect(midiToPolish(46)).toBe("B");
  });
});

describe("midiToPolish", () => {
  it("spells the other black keys with -is", () => {
    expect([61, 63, 66, 68].map(midiToPolish)).toEqual([
      "cis¹",
      "dis¹",
      "fis¹",
      "gis¹",
    ]);
    expect(midiToPolish(42)).toBe("Fis");
    expect(midiToPolish(30)).toBe("Fis₁");
  });

  it("changes case and mark exactly at each C", () => {
    expect(midiToPolish(21)).toBe("A₂");
    expect(midiToPolish(23)).toBe("H₂");
    expect(midiToPolish(24)).toBe("C₁");
    expect(midiToPolish(35)).toBe("H₁");
    expect(midiToPolish(36)).toBe("C");
    expect(midiToPolish(48)).toBe("c");
    expect(midiToPolish(59)).toBe("h");
    expect(midiToPolish(72)).toBe("c²");
    expect(midiToPolish(84)).toBe("c³");
    expect(midiToPolish(96)).toBe("c⁴");
    expect(midiToPolish(108)).toBe("c⁵");
  });
});

describe("midiToScientific and midiToFrench", () => {
  it("number the octave from C, one apart", () => {
    expect(midiToScientific(59)).toBe("B3");
    expect(midiToFrench(59)).toBe("si2");
    expect(midiToScientific(21)).toBe("A0");
    expect(midiToFrench(21)).toBe("la−1");
    expect(midiToFrench(62)).toBe("ré3");
    expect(midiToFrench(66)).toBe("fa♯3");
  });
});

describe("spellPitch", () => {
  it("parts the marks the font subsets lack from the name", () => {
    expect(spellPitch(96, "polish")).toEqual({
      name: "c",
      sharp: false,
      octave: "4",
      placement: "superscript",
    });
    expect(spellPitch(31, "polish")).toEqual({
      name: "G",
      sharp: false,
      octave: "1",
      placement: "subscript",
    });
    expect(spellPitch(70, "international")).toEqual({
      name: "A",
      sharp: true,
      octave: "4",
      placement: "inline",
    });
    expect(spellPitch(21, "french")).toEqual({
      name: "la",
      sharp: false,
      octave: "−1",
      placement: "inline",
    });
  });

  it("leaves the octave to the name in the Polish small and great octaves", () => {
    expect(spellPitch(57, "polish")).toMatchObject({ name: "a", octave: "" });
    expect(spellPitch(42, "polish")).toMatchObject({ name: "Fis", octave: "" });
  });
});

describe("vocalRangeTokens", () => {
  it("orders each side tessitura first, extreme after", () => {
    expect(vocalRangeTokens(BRIEF)).toEqual([
      { kind: "pitch", midi: 57, extreme: false },
      { kind: "pitch", midi: 55, extreme: true },
      { kind: "dash" },
      { kind: "pitch", midi: 81, extreme: false },
      { kind: "pitch", midi: 84, extreme: true },
    ]);
  });
});

describe("notationForLanguage", () => {
  it("maps the three UI languages, regional tags included", () => {
    expect(notationForLanguage("pl")).toBe("polish");
    expect(notationForLanguage("pl-PL")).toBe("polish");
    expect(notationForLanguage("en")).toBe("international");
    expect(notationForLanguage("en-GB")).toBe("international");
    expect(notationForLanguage("fr")).toBe("french");
  });

  it("reads anything else as international", () => {
    expect(notationForLanguage("de")).toBe("international");
    expect(notationForLanguage(undefined)).toBe("international");
  });

  it("drives formatPitch", () => {
    expect(formatPitch(69, notationForLanguage("pl"))).toBe("a¹");
    expect(formatPitch(69, notationForLanguage("fr"))).toBe("la3");
  });
});

describe("resolveNotation", () => {
  it("follows the language when the reader has not chosen", () => {
    expect(resolveNotation("", "pl")).toBe("polish");
    expect(resolveNotation("", "fr")).toBe("french");
    expect(resolveNotation(undefined, "en")).toBe("international");
    expect(resolveNotation(null, "pl-PL")).toBe("polish");
  });

  it("puts the reader's choice above the language", () => {
    // The German conductor in the English panel: B4 would read as B-flat.
    expect(resolveNotation("polish", "en")).toBe("polish");
    expect(formatPitch(71, resolveNotation("polish", "en"))).toBe("h¹");
    expect(resolveNotation("international", "pl")).toBe("international");
    expect(resolveNotation("french", "pl")).toBe("french");
  });
});

describe("spokenPitch", () => {
  it("names the Polish octave aloud, so C₁ and c¹ never sound alike", () => {
    expect(spokenPitch(69, "polish")).toBe("a razkreślne");
    expect(spokenPitch(24, "polish")).toBe("C kontra");
    expect(spokenPitch(60, "polish")).toBe("c razkreślne");
    expect(spokenPitch(57, "polish")).toBe("a małe");
    expect(spokenPitch(45, "polish")).toBe("A wielkie");
    expect(spokenPitch(61, "polish")).toBe("cis razkreślne");
  });

  it("says the sharp as a word in the notation's own language", () => {
    expect(spokenPitch(61, "international")).toBe("C sharp 4");
    expect(spokenPitch(61, "french")).toBe("do dièse 3");
    expect(spokenPitch(69, "international")).toBe("A 4");
  });

  it("falls back to international outside the named Polish octaves", () => {
    expect(spokenPitch(120, "polish")).toBe("C 9");
  });
});
