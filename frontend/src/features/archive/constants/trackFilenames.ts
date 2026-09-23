/**
 * @file trackFilenames.ts
 * @description Reads the voice a rehearsal file is for out of its name.
 * The choir's audio arrives as `(A1) Title.mp3`, `(Ms) Title.mp3`,
 * `(B) Title.mp3`, `(mp3) Title.mp3` — the bracketed prefix is the part, and
 * `(mp3)` is the mix of every voice, i.e. Tutti. `(Tempo giusto)` / `(TG)` is
 * not a voice at all but the target-tempo take, and resolves to its picker
 * slot (see [trackSlots]). Pure functions; [PieceRowTracks] uses them to
 * pre-fill the voice on every file dropped at once.
 *
 * A bare family letter (`(B)`) is only unambiguous when the piece has ONE
 * line of that family. With B1 and B2 declared the file is not guessed at —
 * it comes back unresolved and the user picks. A piece that declares nothing
 * is read four-voice (S1/A1/T1/B1), the same reading the casting rule uses.
 * @module features/archive/constants/trackFilenames
 */

import { TEMPO_GIUSTO_SLOT } from "./trackSlots";

const PREFIX = /^\s*[([]\s*([^)\]]{1,12}?)\s*[)\]]\s*(.*?)\s*$/;
const FULL_CODE = /^([SATBV])([1-9])$/;

/** Prefixes that mean "everybody", in the spellings the choir actually uses. */
const TUTTI_ALIASES: ReadonlySet<string> = new Set(["MP3", "TUTTI", "ALL", "WSZYSCY", "RAZEM"]);

/**
 * Prefixes of the conductor's target-tempo take, read after whitespace is
 * dropped — `(Tempo giusto)` arrives as `TEMPOGIUSTO`. "Tiempo gusto" is a
 * spelling the conductor has used, so it is kept rather than corrected.
 */
const TEMPO_GIUSTO_ALIASES: ReadonlySet<string> = new Set([
  "TEMPOGIUSTO", "GIUSTO", "TG", "TIEMPOGUSTO",
]);

/**
 * Word forms of the instrumental take, whose code `INSTR` is itself longer
 * than a prefix anyone types. `PODKŁAD` is spelled twice: the stroked `ł` does
 * not fold away under case-mapping, so the plain-letter spelling has to be its
 * own key.
 */
const INSTRUMENTAL_ALIASES: ReadonlySet<string> = new Set([
  "INST", "INSTRUMENTAL", "INSTRUMENTALNY", "PODKLAD", "PODKŁAD",
]);

/** Word-form family names, so `(Alt)` and `(Bass)` read like `(A)` and `(B)`. */
const FAMILY_WORDS: ReadonlyMap<string, string> = new Map([
  ["S", "S"], ["SOP", "S"], ["SOPRAN", "S"], ["SOPRANO", "S"],
  ["A", "A"], ["ALT", "A"], ["ALTO", "A"],
  ["T", "T"], ["TEN", "T"], ["TENOR", "T"],
  ["B", "B"], ["BAS", "B"], ["BASS", "B"], ["BASSO", "B"],
  ["V", "V"],
]);

/**
 * Word forms of the intermediate parts, which are one line each and so need
 * no family reading: `(Ms)` itself is the code and resolves via the
 * dictionary. `BAR` is claimed by the code, so `(Bar)` is never a bass.
 */
const INTERMEDIATE_WORDS: ReadonlyMap<string, string> = new Map([
  ["MEZ", "MS"], ["MEZZO", "MS"], ["MEZZOSOPRAN", "MS"], ["MEZZOSOPRANO", "MS"],
  ["MEZZO-SOPRANO", "MS"],
  ["BARYTON", "BAR"], ["BARITONE", "BAR"], ["BARI", "BAR"],
  ["KONTRATENOR", "CT"], ["COUNTERTENOR", "CT"], ["CONTRATENOR", "CT"],
]);

export interface ParsedTrackFilename {
  /** Upper-cased bracket content, or null when the name carries no prefix. */
  readonly prefix: string | null;
  /** The name with prefix and extension stripped — what the file is called. */
  readonly title: string;
}

export const stripExtension = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
};

export const parseTrackFilename = (name: string): ParsedTrackFilename => {
  const base = stripExtension(name);
  const match = PREFIX.exec(base);
  if (!match) return { prefix: null, title: base.trim() };
  return { prefix: match[1].toUpperCase(), title: match[2] };
};

export type VoiceResolution =
  | { readonly kind: "resolved"; readonly code: string }
  /** The prefix names a family the piece divides — pick by hand. */
  | { readonly kind: "ambiguous"; readonly family: string; readonly candidates: string[] }
  | { readonly kind: "unknown" };

/**
 * Map a parsed prefix onto one voice code.
 *
 * @param prefix upper-cased bracket content, or null
 * @param scope voice codes the piece already speaks of — its piece-wide
 *   divisi plus the parts of the takes it holds — used to read a family
 *   letter the way the singer will see it
 * @param dictionary every voice code the server accepts
 */
export const resolveVoiceFromPrefix = (
  prefix: string | null,
  scope: readonly string[],
  dictionary: ReadonlySet<string>,
): VoiceResolution => {
  if (!prefix) return { kind: "unknown" };
  // The trailing dot of an abbreviation is dropped: `(instr.)`, `(sop.)` and
  // `(bar.)` are how the parts get written by hand, and no voice code holds a
  // dot, so nothing legible is lost by ignoring it.
  const normalized = prefix
    .replace(/\s+/g, "")
    .replace(/\.+$/, "")
    .toUpperCase();

  if (TUTTI_ALIASES.has(normalized) && dictionary.has("TUTTI")) {
    return { kind: "resolved", code: "TUTTI" };
  }

  if (TEMPO_GIUSTO_ALIASES.has(normalized)) {
    return { kind: "resolved", code: TEMPO_GIUSTO_SLOT };
  }

  if (INSTRUMENTAL_ALIASES.has(normalized) && dictionary.has("INSTR")) {
    return { kind: "resolved", code: "INSTR" };
  }

  // A code the server knows (`A1`, `MS`, `SOLO`, `ACC`…) needs no reading.
  if (dictionary.has(normalized)) {
    return { kind: "resolved", code: normalized };
  }

  const intermediate = INTERMEDIATE_WORDS.get(normalized);
  if (intermediate) {
    return dictionary.has(intermediate)
      ? { kind: "resolved", code: intermediate }
      : { kind: "unknown" };
  }

  const family = FAMILY_WORDS.get(normalized);
  if (!family) return { kind: "unknown" };

  const candidates = Array.from(
    new Set(scope.filter((code) => code.startsWith(family) && FULL_CODE.test(code))),
  ).sort();
  if (candidates.length === 1) return { kind: "resolved", code: candidates[0] };
  if (candidates.length > 1) return { kind: "ambiguous", family, candidates };

  const fourVoice = `${family}1`;
  return dictionary.has(fourVoice)
    ? { kind: "resolved", code: fourVoice }
    : { kind: "unknown" };
};
