/**
 * @file wordDiff.ts
 * @description What actually changed between the text the site is serving and
 * the text somebody proposed — word by word, so a reviewer reads one paragraph
 * instead of two.
 *
 * It exists because of what the copy desk is FOR. §1 of the spec measured the
 * editing to expect: nuance, word choice, clause order — not rewriting. A
 * `note` runs to several hundred words, and printing the old one above the new
 * one to report a changed conjunction is six hundred words of reading for a
 * verdict about one. The diff collapses that to a paragraph with two marks.
 *
 * The output is exact rather than approximate, and one property makes it worth
 * trusting: the `same` and `removed` parts concatenate back to the original,
 * the `same` and `added` parts back to the proposal. `wordDiff.test.ts` asserts
 * both, which is the same proof `apply-copy` makes each of its transforms carry.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/lib/wordDiff
 */

export type DiffKind = "same" | "added" | "removed";

export interface DiffPart {
  readonly kind: DiffKind;
  readonly text: string;
}

export interface TextDiff {
  readonly parts: readonly DiffPart[];
  /**
   * How much of the longer text survived, ignoring whitespace: 1 for an
   * untouched string, near 0 for a replacement. The surface reads it to decide
   * whether an inline diff is a reading of the change or a shredded pair of
   * unrelated paragraphs.
   */
  readonly kept: number;
}

/** Words and the whitespace between them, so the runs rebuild the text exactly. */
const TOKENS = /\s+|\S+/g;

const tokenize = (text: string): readonly string[] => text.match(TOKENS) ?? [];

/**
 * Beyond this many table cells the alignment stops being worth its cost and the
 * middle is reported as one replacement.
 *
 * It is nearly unreachable in practice: the common head and tail are trimmed
 * first, so the table only ever spans the region that actually differs, and a
 * one-word edit in the corpus's longest `note` builds a table of a few cells.
 * What the cap is really for is the paste of an unrelated text into a long
 * field, where the alignment would be both expensive and meaningless.
 */
const MAX_CELLS = 1_500_000;

const push = (parts: DiffPart[], kind: DiffKind, text: string): void => {
  if (text === "") return;
  const last = parts[parts.length - 1];
  if (last && last.kind === kind) {
    parts[parts.length - 1] = { kind, text: last.text + text };
    return;
  }
  parts.push({ kind, text });
};

/**
 * The classic longest-common-subsequence alignment, walked forwards so the
 * parts come out in reading order.
 *
 * `Uint32Array` rather than a nested array: the table is the one allocation
 * this makes, and a several-hundred-word paragraph pasted over another would
 * otherwise be a few hundred thousand boxed numbers.
 */
const alignTokens = (
  before: readonly string[],
  after: readonly string[],
): DiffPart[] => {
  const rows = before.length;
  const columns = after.length;
  const width = columns + 1;
  const table = new Uint32Array((rows + 1) * width);

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        before[i] === after[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    if (before[i] === after[j]) {
      push(parts, "same", before[i]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      // Deletions before insertions on a tie: a replaced word then reads
      // "old new" rather than "new old", which is the order the eye expects
      // from a surface that calls itself old → new.
      push(parts, "removed", before[i]);
      i += 1;
    } else {
      push(parts, "added", after[j]);
      j += 1;
    }
  }
  while (i < rows) {
    push(parts, "removed", before[i]);
    i += 1;
  }
  while (j < columns) {
    push(parts, "added", after[j]);
    j += 1;
  }
  return parts;
};

/** Letters only: whitespace is structure, and counting it would make a reflowed
 *  paragraph look like a rewritten one. */
const weigh = (text: string): number => text.replace(/\s+/g, "").length;

export const wordDiff = (before: string, after: string): TextDiff => {
  if (before === after) {
    return {
      parts: before === "" ? [] : [{ kind: "same", text: before }],
      kept: 1,
    };
  }

  const source = tokenize(before);
  const target = tokenize(after);

  // Trim what both texts share at each end before aligning anything. This is
  // what makes the usual case — one clause changed in a long paragraph — cost a
  // table of a few cells instead of one of a hundred thousand.
  let head = 0;
  while (
    head < source.length &&
    head < target.length &&
    source[head] === target[head]
  ) {
    head += 1;
  }
  let tail = 0;
  while (
    tail < source.length - head &&
    tail < target.length - head &&
    source[source.length - 1 - tail] === target[target.length - 1 - tail]
  ) {
    tail += 1;
  }

  const middleSource = source.slice(head, source.length - tail);
  const middleTarget = target.slice(head, target.length - tail);

  const parts: DiffPart[] = [];
  push(parts, "same", source.slice(0, head).join(""));
  if (middleSource.length * middleTarget.length > MAX_CELLS) {
    push(parts, "removed", middleSource.join(""));
    push(parts, "added", middleTarget.join(""));
  } else {
    for (const part of alignTokens(middleSource, middleTarget)) {
      push(parts, part.kind, part.text);
    }
  }
  push(parts, "same", source.slice(source.length - tail).join(""));

  const total = Math.max(weigh(before), weigh(after));
  const survived = parts.reduce(
    (sum, part) => (part.kind === "same" ? sum + weigh(part.text) : sum),
    0,
  );

  return { parts, kept: total === 0 ? 1 : survived / total };
};
