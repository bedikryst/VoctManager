/**
 * @file pitchNotation.ts
 * @description Pitch names for a MIDI number in the three notations the panel's
 * readers write: international (scientific pitch notation, A4 = 440 Hz), Polish
 * Helmholtz (a¹ = 440 Hz, with h = B and b = B♭) and French solfège (la3 =
 * 440 Hz). A pitch is stored as MIDI everywhere; a notation is presentation
 * only, so nothing parses these strings back.
 *
 * The three disagree exactly where musicians misread one another, and the suite
 * pins those places: "A1" is 55 Hz internationally while a¹ is 440 Hz in Polish,
 * and middle C is C4, c¹ and do3 at once.
 *
 * A name is spelled once, by `spellPitch`, into its parts: the name, a sharp,
 * and the octave with where it sits. `formatPitch` joins the parts into plain
 * text with Unicode super- and subscripts, for a sentence or a copied value. On
 * screen `PitchName` sets the same parts as markup, because the panel's font
 * subsets carry ¹ ² ³ but not ⁴ ⁵ ₁ ₂ or ♯, and those would fall back to a
 * system face beside their neighbours. `spokenPitch` is the name as a musician
 * says it, for an aria-label: screen readers voice `a¹` and `C₁` inconsistently,
 * and never distinguish `C` from `c`.
 * @module shared/lib/music/pitchNotation
 */

export type PitchNotation = "international" | "polish" | "french";

/** A reader's stored choice of notation: one of the three, or blank to follow
 *  the UI language. */
export type PitchNotationPreference = PitchNotation | "";

/** Every notation, in the order the panel lists them whichever the reader
 *  uses: international first, as the one every country reads the same way. */
export const ALL_NOTATIONS: readonly PitchNotation[] = [
  "international",
  "polish",
  "french",
];

/** The black keys. International and French spell each as the white key below
 *  it plus a sharp, as `PitchPipe` prints them. */
const SHARP_PITCH_CLASSES: ReadonlySet<number> = new Set([1, 3, 6, 8, 10]);

const INTERNATIONAL_LETTERS = [
  "C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B",
] as const;

const FRENCH_SYLLABLES = [
  "do", "do", "ré", "ré", "mi", "fa", "fa", "sol", "sol", "la", "la", "si",
] as const;

/** Polish usage: `h` is B natural and `b` is B flat, so the black key between
 *  a and h is always `b`, never `ais`. Every black key is a whole word here, so
 *  a Polish name never takes a sharp. */
const POLISH_NAMES = [
  "c", "cis", "d", "dis", "e", "f", "fis", "g", "gis", "a", "b", "h",
] as const;

const SHARP_SIGN = "♯";

const SUPERSCRIPT_DIGITS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
const SUBSCRIPT_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

/** Where a notation writes the octave: on the line after the name, or as a
 *  raised or lowered mark. */
export type OctavePlacement = "inline" | "superscript" | "subscript";

export interface PitchSpelling {
  /** The name without its accidental: `C`, `cis`, `ré`. */
  readonly name: string;
  readonly sharp: boolean;
  /** Plain digits, with a true minus sign when negative. Empty where the name
   *  alone says the octave: the Polish small and great octaves (`a`, `A`). */
  readonly octave: string;
  readonly placement: OctavePlacement;
}

/** 0 = C … 11 = B, for any integer including negatives. */
export const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12;

/** Scientific octave number: C4 is MIDI 60, the numbering `PitchPipe` uses. */
const scientificOctave = (midi: number): number => Math.floor(midi / 12) - 1;

const toScript = (digits: string, script: readonly string[]): string =>
  digits
    .split("")
    .map((digit) => script[Number(digit)])
    .join("");

/** Octave numbers below zero carry a true minus sign, not a hyphen that would
 *  read as part of the name. */
const signed = (value: number): string =>
  value < 0 ? `−${Math.abs(value)}` : String(value);

export const midiToHz = (midi: number): number =>
  440 * Math.pow(2, (midi - 69) / 12);

/**
 * Helmholtz as Polish musicians write it: the small octave (c–h, below middle C)
 * is bare lowercase, each octave above adds a superscript (c¹ = middle C), the
 * great octave is capitalised (C–H), and each octave below it adds a subscript
 * (C₁ contra, C₂ subcontra).
 */
const spellPolish = (midi: number): PitchSpelling => {
  const name = POLISH_NAMES[pitchClass(midi)];
  const octave = scientificOctave(midi);
  if (octave >= 4) {
    return { name, sharp: false, octave: String(octave - 3), placement: "superscript" };
  }
  if (octave === 3) return { name, sharp: false, octave: "", placement: "inline" };
  const capital = `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  if (octave === 2) {
    return { name: capital, sharp: false, octave: "", placement: "inline" };
  }
  return {
    name: capital,
    sharp: false,
    octave: String(2 - octave),
    placement: "subscript",
  };
};

export const spellPitch = (
  midi: number,
  notation: PitchNotation,
): PitchSpelling => {
  const pc = pitchClass(midi);
  const sharp = SHARP_PITCH_CLASSES.has(pc);
  const octave = scientificOctave(midi);
  switch (notation) {
    case "international":
      return {
        name: INTERNATIONAL_LETTERS[pc],
        sharp,
        octave: signed(octave),
        placement: "inline",
      };
    case "french":
      // French octaves run one below the scientific ones: middle C is do3.
      return {
        name: FRENCH_SYLLABLES[pc],
        sharp,
        octave: signed(octave - 1),
        placement: "inline",
      };
    case "polish":
      return spellPolish(midi);
  }
};

export const formatPitch = (midi: number, notation: PitchNotation): string => {
  const { name, sharp, octave, placement } = spellPitch(midi, notation);
  const mark =
    placement === "superscript"
      ? toScript(octave, SUPERSCRIPT_DIGITS)
      : placement === "subscript"
        ? toScript(octave, SUBSCRIPT_DIGITS)
        : octave;
  return `${name}${sharp ? SHARP_SIGN : ""}${mark}`;
};

/** Polish octave names by scientific octave number, as they are said aloud:
 *  `a razkreślne` for a¹, `G kontra` for G₁. The adjective is neuter, agreeing
 *  with "dźwięk" understood. */
const POLISH_SPOKEN_OCTAVES: Readonly<Record<number, string>> = {
  0: "subkontra",
  1: "kontra",
  2: "wielkie",
  3: "małe",
  4: "razkreślne",
  5: "dwukreślne",
  6: "trzykreślne",
  7: "czterokreślne",
  8: "pięciokreślne",
};

/**
 * The name as a musician says it. Each notation is voiced in its own language,
 * since that is the language its readers learned it in: `C sharp 4`,
 * `do dièse 3`, `cis razkreślne`. Outside the named Polish octaves the Polish
 * form falls back to the international one.
 */
export const spokenPitch = (midi: number, notation: PitchNotation): string => {
  const { name, sharp, octave } = spellPitch(midi, notation);
  switch (notation) {
    case "international":
      return `${name}${sharp ? " sharp" : ""} ${octave}`;
    case "french":
      return `${name}${sharp ? " dièse" : ""} ${octave}`;
    case "polish": {
      const word = POLISH_SPOKEN_OCTAVES[scientificOctave(midi)];
      return word === undefined
        ? spokenPitch(midi, "international")
        : `${name} ${word}`;
    }
  }
};

export const midiToScientific = (midi: number): string =>
  formatPitch(midi, "international");

export const midiToPolish = (midi: number): string =>
  formatPitch(midi, "polish");

export const midiToFrench = (midi: number): string =>
  formatPitch(midi, "french");

/**
 * The notation a reader of this UI language writes. Takes a language tag
 * (`pl`, `en-GB`); anything but Polish or French reads international, the one
 * notation that means the same pitch in every country.
 */
export const notationForLanguage = (
  language: string | null | undefined,
): PitchNotation => {
  const base = (language ?? "").split("-")[0].toLowerCase();
  if (base === "pl") return "polish";
  if (base === "fr") return "french";
  return "international";
};

/**
 * The notation this reader sees: their own choice when they made one, otherwise
 * their UI language's. A missing preference (no profile loaded yet) follows the
 * language too.
 */
export const resolveNotation = (
  preference: PitchNotationPreference | null | undefined,
  language: string | null | undefined,
): PitchNotation => preference || notationForLanguage(language);

/** A singer's range as MIDI numbers. The extremes lie outside the tessitura:
 *  reachable, but not in the voice's comfortable span. */
export interface VocalRangeMidi {
  readonly tessituraLow: number | null;
  readonly tessituraHigh: number | null;
  readonly extremeLow: number | null;
  readonly extremeHigh: number | null;
}

/** One piece of a written range: a pitch, which sits in parentheses when it is
 *  an extreme, or the dash between the two sides. */
export type VocalRangeToken =
  | { readonly kind: "pitch"; readonly midi: number; readonly extreme: boolean }
  | { readonly kind: "dash" };

/**
 * The range in the order a conductor writes it: `a (g) – a² (c³)`, tessitura
 * first on each side and the extreme after it. Missing parts are left out; the
 * dash stays whenever either side exists, so a lone low bound still reads as
 * the low one (`a (g) –`). An empty range has no tokens.
 */
export const vocalRangeTokens = (
  range: VocalRangeMidi,
): readonly VocalRangeToken[] => {
  const side = (main: number | null, extreme: number | null): VocalRangeToken[] => {
    const tokens: VocalRangeToken[] = [];
    if (main !== null) tokens.push({ kind: "pitch", midi: main, extreme: false });
    if (extreme !== null) tokens.push({ kind: "pitch", midi: extreme, extreme: true });
    return tokens;
  };

  const low = side(range.tessituraLow, range.extremeLow);
  const high = side(range.tessituraHigh, range.extremeHigh);
  if (low.length === 0 && high.length === 0) return [];
  return [...low, { kind: "dash" }, ...high];
};

/** `vocalRangeTokens` as plain text; an empty range is an empty string. */
export const formatVocalRange = (
  range: VocalRangeMidi,
  notation: PitchNotation,
): string =>
  vocalRangeTokens(range)
    .map((token) => {
      if (token.kind === "dash") return "–";
      const name = formatPitch(token.midi, notation);
      return token.extreme ? `(${name})` : name;
    })
    .join(" ");
