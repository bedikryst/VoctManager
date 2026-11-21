/**
 * @file musicalKey.ts
 * @description Shows a piece's key in the notation of the screen's language.
 *
 * The key column is free text: the analysis writes English ("C major",
 * "B-flat minor"), people type the notation they read ("D-dur", "fis-moll"),
 * and a catalogue may hold a mode or a spelling no rule covers. A value that
 * names a major or minor key in English, German/Polish or French notation is
 * shown in the reader's notation: Polish "C-dur", "b-moll", "H-dur" (B is B-flat
 * and H is B natural), English "B♭ major", French "si bémol majeur". Anything
 * else (a mode, a bare letter, a typo) is shown exactly as stored. The column
 * itself is never rewritten by this.
 * @module features/archive/piece-card/musicalKey
 */

type Letter = "C" | "D" | "E" | "F" | "G" | "A" | "B";
type Accidental = -1 | 0 | 1;
type Mode = "major" | "minor";

interface ParsedKey {
  readonly letter: Letter;
  readonly accidental: Accidental;
  readonly mode: Mode;
}

const ENGLISH = /^([a-g])\s*(?:(#|♯|-?\s*sharp)|(b|♭|-?\s*flat))?\s*(major|minor)$/i;
const GERMAN = /^([a-h])(is|es|s)?\s*-?\s*(dur|moll)$/i;
const FRENCH = /^(do|ut|ré|re|mi|fa|sol|la|si)\s*(dièse|diese|bémol|bemol)?\s*(majeur|mineur)$/i;

const SOLFEGE: Record<string, Letter> = {
  do: "C", ut: "C", ré: "D", re: "D", mi: "E", fa: "F", sol: "G", la: "A", si: "B",
};

const parseGerman = (letter: string, suffix: string | undefined, word: string): ParsedKey | null => {
  const upper = letter.toUpperCase();
  const mode: Mode = word.toLowerCase() === "dur" ? "major" : "minor";
  // B is B-flat and H is B natural; neither takes a further suffix here.
  if (upper === "H") return suffix ? null : { letter: "B", accidental: 0, mode };
  if (upper === "B") return suffix ? null : { letter: "B", accidental: -1, mode };
  const lowerSuffix = suffix?.toLowerCase();
  // A bare "s" flattens only the vowels: Es, As.
  if (lowerSuffix === "s" && upper !== "E" && upper !== "A") return null;
  if (lowerSuffix === "es" && (upper === "E" || upper === "A")) return null;
  const accidental: Accidental = lowerSuffix === "is" ? 1 : lowerSuffix ? -1 : 0;
  return { letter: upper as Letter, accidental, mode };
};

export const parseMusicalKey = (raw: string): ParsedKey | null => {
  const text = raw.trim();
  const english = ENGLISH.exec(text);
  if (english) {
    const [, letter = "", sharp, flat, word = ""] = english;
    return {
      letter: letter.toUpperCase() as Letter,
      accidental: sharp ? 1 : flat ? -1 : 0,
      mode: word.toLowerCase() as Mode,
    };
  }
  const german = GERMAN.exec(text);
  if (german) {
    const [, letter = "", suffix, word = ""] = german;
    return parseGerman(letter, suffix, word);
  }
  const french = FRENCH.exec(text);
  if (french) {
    const [, syllable = "", accidental, word = ""] = french;
    const letter = SOLFEGE[syllable.toLowerCase()];
    if (!letter) return null;
    const sign = accidental?.toLowerCase();
    return {
      letter,
      accidental: sign?.startsWith("di") ? 1 : sign ? -1 : 0,
      mode: word.toLowerCase() === "majeur" ? "major" : "minor",
    };
  }
  return null;
};

const polishName = ({ letter, accidental }: ParsedKey): string => {
  if (letter === "B") return accidental === -1 ? "B" : accidental === 1 ? "His" : "H";
  if (accidental === 1) return `${letter}is`;
  if (accidental === -1) return letter === "E" || letter === "A" ? `${letter}s` : `${letter}es`;
  return letter;
};

const FRENCH_NAMES: Record<Letter, string> = {
  C: "do", D: "ré", E: "mi", F: "fa", G: "sol", A: "la", B: "si",
};

const formatKey = (key: ParsedKey, language: string): string => {
  if (language.startsWith("pl")) {
    const name = polishName(key);
    return key.mode === "major" ? `${name}-dur` : `${name.toLowerCase()}-moll`;
  }
  if (language.startsWith("fr")) {
    const sign = key.accidental === 1 ? " dièse" : key.accidental === -1 ? " bémol" : "";
    return `${FRENCH_NAMES[key.letter]}${sign} ${key.mode === "major" ? "majeur" : "mineur"}`;
  }
  const sign = key.accidental === 1 ? "♯" : key.accidental === -1 ? "♭" : "";
  return `${key.letter}${sign} ${key.mode}`;
};

/** The stored key in the reader's notation, or the stored text when it names no major or minor key. */
export const displayMusicalKey = (raw: string, language: string): string => {
  const key = parseMusicalKey(raw);
  return key ? formatKey(key, language) : raw;
};
