/**
 * @file voices.ts
 * @description Which voices a score mark is addressed to, and whether it is
 * addressed to the reader. Mirror of `backend/archive/annotation_voices.py`.
 *
 * A mark names sections, never parts: S, A, T, B, the letters a sectional
 * rehearsal is called by. No voices is tutti, and so are all four, which the
 * server stores as none. The voices filter what a reader is shown and who
 * "Powiadom chór" tells; they are not access control, and a mark for the tenors
 * is as readable to a soprano as any other on the choir's layer.
 *
 * The reader answers to the letters of their seat on the music, which the
 * fingerprint carries (`reader_sections`): a divisi S1 singer is a soprano, an
 * unseated mezzo answers to the sopranos and the altos alike. A reader with no
 * letters (a manager, a player, a stand opened outside any concert) is
 * addressed by everything, and so is everybody by their own marks.
 * @module features/annotations/lib
 */

export type VoiceSection = "S" | "A" | "T" | "B";

export const VOICE_SECTIONS: readonly VoiceSection[] = ["S", "A", "T", "B"];

/** What the reader is shown: marks for their voice and tutti, or everything. */
export type VoiceFilter = "mine" | "all";

/**
 * Voices in SATB order, each once, unknown codes dropped, and tutti as an
 * empty list. A row cached by a build that predates voices has none: tutti.
 */
export const canonicalVoices = (voices: Iterable<unknown> | undefined): VoiceSection[] => {
  if (!voices) return [];
  const wanted = new Set<unknown>(voices);
  const letters = VOICE_SECTIONS.filter((section) => wanted.has(section));
  return letters.length === VOICE_SECTIONS.length ? [] : letters;
};

/** Whether a mark with these voices is addressed to a reader answering to `readerSections`. */
export const addressesSections = (
  voices: Iterable<unknown> | undefined,
  readerSections: string,
): boolean => {
  const letters = canonicalVoices(voices);
  if (letters.length === 0 || readerSections === "") return true;
  return letters.some((letter) => readerSections.includes(letter));
};

/**
 * Whether a mark is the reader's to see under "Mój głos + tutti": addressed to
 * their section, or written by them.
 */
export const isAddressedTo = (
  mark: { voices?: readonly string[]; created_by: string | null },
  readerSections: string,
  userId: string | null,
): boolean =>
  (userId !== null && mark.created_by === userId) ||
  addressesSections(mark.voices, readerSections);

/** The voices with `section` added or taken away. */
export const toggleVoice = (
  voices: readonly VoiceSection[],
  section: VoiceSection,
): VoiceSection[] =>
  canonicalVoices(
    voices.includes(section)
      ? voices.filter((voice) => voice !== section)
      : [...voices, section],
  );

/**
 * Whether marks on this layer are addressed to voices. The choir's layer is,
 * and the leader's cues are ("check the tenors here"). A private pencil has one
 * reader, and the conductor's own layer is read by managers only, so neither
 * is offered voices.
 */
export const layerTakesVoices = (layerName: string): boolean =>
  layerName !== "personal" && layerName !== "conductor";

/** Whether two voice lists name the same audience. */
export const sameVoices = (
  a: Iterable<unknown> | undefined,
  b: Iterable<unknown> | undefined,
): boolean => canonicalVoices(a).join("") === canonicalVoices(b).join("");
