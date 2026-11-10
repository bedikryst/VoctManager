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
 *
 * Ahead of the presets ride the writer's own words: what they keep on this
 * device across every piece (`rememberPhrase`, stored by `useSavedPhrases`),
 * then their short notes on the edition open, which a second device also has.
 * A word the catalogue lacks ("più", "o.n.") is typed once and tapped after.
 * @module features/annotations/lib
 */

export interface QuickPhrase {
  key: string;
  /** Polish, because Polish is the primary locale and these are its words. */
  fallback: string;
}

/** A chip's words, and whether they are set italic in the dynamics' face. */
export interface Phrase {
  text: string;
  italic: boolean;
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

/** How many of the writer's own notes on the open edition ride in front of the presets. */
export const MAX_RECENT_PHRASES = 8;
/** How many phrases a writer keeps on a device, across every piece. */
export const MAX_SAVED_PHRASES = 12;
/**
 * A note longer than this is a sentence, not a chip: it would either be cut off
 * or push the presets off the row, and nobody repeats a whole sentence verbatim.
 */
export const MAX_PHRASE_LENGTH = 24;

const fold = (text: string): string => text.trim().toLowerCase();

/**
 * The kept list with `phrase` at its front, carrying its italic flag: added when
 * a short note is committed, moved up when its chip is tapped. One entry per
 * word, so the phrase used last decides its slant. A typo is never tapped, so it
 * sinks and falls off the end. A sentence, or a preset (always in the row
 * anyway), is not kept.
 */
export const rememberPhrase = (
  kept: readonly Phrase[],
  phrase: Phrase,
  presets: readonly string[] = [],
  limit: number = MAX_SAVED_PHRASES,
): Phrase[] => {
  const text = phrase.text.trim();
  const key = fold(text);
  if (!text || text.length > MAX_PHRASE_LENGTH || presets.some((p) => fold(p) === key)) {
    return [...kept];
  }
  return [
    { text, italic: phrase.italic },
    ...kept.filter((entry) => fold(entry.text) !== key),
  ].slice(0, limit);
};

/**
 * The chip row: the phrases kept on this device, then the writer's short notes
 * on this edition (newest first, at most `MAX_RECENT_PHRASES`), then the
 * presets. Each word once — a phrase offered twice in one row is a row that
 * fits half as much — and the first offer of it wins, slant included.
 */
export const quickPhraseRow = (
  kept: readonly Phrase[],
  recent: readonly Phrase[],
  presets: readonly string[],
): Phrase[] => {
  const taken = new Set(presets.map(fold));
  const own: Phrase[] = [];
  const take = (list: readonly Phrase[], limit: number): void => {
    let added = 0;
    for (const entry of list) {
      if (added >= limit) return;
      const text = entry.text.trim();
      if (!text || text.length > MAX_PHRASE_LENGTH) continue;
      const key = fold(text);
      if (taken.has(key)) continue;
      taken.add(key);
      own.push({ text, italic: entry.italic });
      added += 1;
    }
  };
  take(kept, MAX_SAVED_PHRASES);
  take(recent, MAX_RECENT_PHRASES);
  return [...own, ...presets.map((text) => ({ text, italic: false }))];
};

/**
 * Append a phrase to what is already written. Tapping two chips has to read as
 * one note ("końcówki razem"), and a chip must never eat a half-typed word.
 */
export const appendPhrase = (current: string, phrase: string): string => {
  const head = current.replace(/\s+$/, "");
  return head ? `${head} ${phrase}` : phrase;
};
