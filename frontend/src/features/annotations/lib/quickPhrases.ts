/**
 * @file quickPhrases.ts
 * @description The dozen words a rehearsal is actually made of, one tap away.
 * On a tablet the bottleneck in writing a note is not the dialog, it is the
 * on-screen keyboard: a conductor types the same fifteen words all evening,
 * half the score hidden behind the keyboard while they do it.
 *
 * The list deliberately says nothing a STAMP already says — dynamics, hairpins,
 * breath and "watch me" are symbols, and offering them twice in two vocabularies
 * would only make the writer choose. What is left is the part a symbol cannot
 * carry: diction, ensemble, and the size of a gesture.
 * @module features/annotations/lib
 * @architecture Enterprise SaaS 2026
 */

export interface QuickPhrase {
  key: string;
  /** Polish, because Polish is the primary locale and these are its words. */
  fallback: string;
}

export const QUICK_PHRASES: ReadonlyArray<QuickPhrase> = [
  { key: "annotations.phrases.together", fallback: "razem" },
  { key: "annotations.phrases.count", fallback: "licz!" },
  { key: "annotations.phrases.entry", fallback: "wejście" },
  { key: "annotations.phrases.endings", fallback: "końcówki" },
  { key: "annotations.phrases.consonants", fallback: "spółgłoski" },
  { key: "annotations.phrases.clearer", fallback: "wyraźniej" },
  { key: "annotations.phrases.lighter", fallback: "lżej" },
  { key: "annotations.phrases.softly", fallback: "miękko" },
  { key: "annotations.phrases.shorter", fallback: "krócej" },
  { key: "annotations.phrases.longer", fallback: "dłużej" },
  { key: "annotations.phrases.no_slowing", fallback: "nie zwalniać" },
  { key: "annotations.phrases.practise", fallback: "ćwiczyć" },
];

/** How many of the writer's own recent notes ride in front of the presets. */
export const MAX_RECENT_PHRASES = 4;
/**
 * A note longer than this is a sentence, not a chip: it would either be cut off
 * or push the presets off the row, and nobody repeats a whole sentence verbatim.
 */
const MAX_PHRASE_LENGTH = 24;

const fold = (text: string): string => text.trim().toLowerCase();

/**
 * The writer's own short notes on this edition, newest first, deduped against
 * each other and against the presets — a phrase offered twice in one row is a
 * row that fits half as much.
 */
export const pickRecentPhrases = (
  texts: readonly string[],
  presets: readonly string[],
  limit: number = MAX_RECENT_PHRASES,
): string[] => {
  const taken = new Set(presets.map(fold));
  const recent: string[] = [];
  for (const raw of texts) {
    const text = raw.trim();
    if (!text || text.length > MAX_PHRASE_LENGTH) continue;
    const key = fold(text);
    if (taken.has(key)) continue;
    taken.add(key);
    recent.push(text);
    if (recent.length >= limit) break;
  }
  return recent;
};

/**
 * Append a phrase to what is already written. Tapping two chips has to read as
 * one note ("końcówki razem"), and a chip must never eat a half-typed word.
 */
export const appendPhrase = (current: string, phrase: string): string => {
  const head = current.replace(/\s+$/, "");
  return head ? `${head} ${phrase}` : phrase;
};
