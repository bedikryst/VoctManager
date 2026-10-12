/**
 * @file match.ts
 * @description The comment mode's matcher: which copy-desk field printed which run of a page's
 *  text. DOM-free on purpose — the mode feeds it the live page's text nodes, `copy:coverage` feeds
 *  it the built HTML, and both get the same answer.
 *
 *  FIELDS ARE FOUND BY THEIR TEXT, against every field of the page's locale. A page prints far
 *  more than its own scope (the notice block, the vault, concert titles in the chrome), so the
 *  URL only ranks: when one span belongs to several fields, the page's own scope wins.
 *
 *  BLIND TO TYPOGRAPHY AND CASE. Both sides lose every whitespace and format character and are
 *  lowercased before they are compared. `lib/typo.ts` only ever swaps a breakable space for a hard
 *  one and adds word joiners to year ranges, templates leave indentation inside text nodes, an
 *  `HTML` field's tags and entities are not what the page's text holds, and templates lowercase
 *  credit roles ("Florent de Bazelaire, conductor", `lib/realisations.ts`) — deleting all of it,
 *  rather than collapsing it, is what makes the build's output and the corpus agree.
 *
 *  A SPAN STARTS AND ENDS ON A WORD BOUNDARY of the original text, so "Pieniny" is found in "za
 *  oknami Pieniny." and never inside a longer word. Every text node's edge counts as one: the site
 *  sets a numeral and its label in sibling spans with no space between them (`01` · `First
 *  production`). A field may run across several text nodes (a phrase in `<em>`, two `.line`
 *  spans, paragraphs of one value), and several fields may sit in one text node (the hero
 *  dateline, `place — date` ribbons).
 *
 *  Plain erasable TypeScript importing only `.ts` modules by their full name, so bare `node` runs
 *  it for the coverage script and the tests, and Vite bundles it for the mode.
 * @architecture Astro islands 2026
 * @module comment-mode/match
 */

import { INLINE_ELEMENTS } from "../lib/typo.ts";

/** One text node of the page, in document order. */
export interface TextNodeInput {
  readonly text: string;
  /**
   * A line-breaking element — a block, `<br>`, a control — lies between this node and the
   * previous one. Surfaces as `BREAK`, which tells lines of the page apart.
   */
  readonly breakBefore: boolean;
}

/** The part of a site-index row the matcher reads. The page prints `value || fallback_value`. */
export interface MatchField {
  readonly key: string;
  readonly scope: string;
  readonly kind: string;
  readonly value: string;
  readonly fallback_value?: string;
}

/** A position in the input, as `Range.setStart` takes it: a node index and a UTF-16 offset. */
export interface TextPoint {
  readonly node: number;
  readonly offset: number;
}

export interface Occurrence<F extends MatchField> {
  readonly start: TextPoint;
  /** Exclusive, as `Range.setEnd` takes it. */
  readonly end: TextPoint;
  /** The span in `PageText.text` coordinates, `[from, to)`. */
  readonly from: number;
  readonly to: number;
  /** Every field whose printed value is exactly this span. */
  readonly fields: readonly F[];
  /**
   * What a tap offers: the page's own scope's fields when any is here, else all of them. EMPTY
   * for a single word that no own field holds and several fields share ("VoctEnsemble",
   * "Images"): the menu and the footer print such words on their own, so nothing says which
   * field, if any, printed it here, and a tap explains that instead of offering a guess.
   */
  readonly candidates: readonly F[];
}

/** The page's text as the matcher compares it, with the way back to the input. */
export interface PageText {
  /** NFC, without whitespace or format characters. */
  readonly text: string;
  /** Per UTF-16 unit of `text`: a word gap (bit 1) and/or `BREAK` when one precedes it. */
  readonly flags: Uint8Array;
  /** Per unit: the input node it came from, and its `[start, end)` offsets in that node. */
  readonly node: Int32Array;
  readonly start: Int32Array;
  readonly end: Int32Array;
}

/** Whitespace, a zero-width space or a text node's edge separated this unit from the one before. */
const GAP = 1;
/** A line-breaking element lies between this unit and the one before it. */
export const BREAK = 2;

/** Elements whose text never reaches the walk: not rendered as page text, or not the page's. */
const SKIPPED_ELEMENTS: ReadonlySet<string> = new Set([
  "script",
  "style",
  "template",
  "noscript",
  "textarea",
  "title",
]);

/**
 * Elements a run of text flows through without a line break, beyond the typography pass's own
 * inline set: `<wbr>` is only a break opportunity, and Astro's island wrappers are
 * `display: contents`.
 */
const TRANSPARENT_ELEMENTS: ReadonlySet<string> = new Set([
  "wbr",
  "astro-island",
  "astro-slot",
  "astro-static-slot",
]);

/** True when the walk must not read text inside `tag` (lowercase). */
export function skipsText(tag: string): boolean {
  return SKIPPED_ELEMENTS.has(tag);
}

/** True when crossing `tag` (lowercase) — entering or leaving it — breaks the line. */
export function breaksText(tag: string): boolean {
  return !INLINE_ELEMENTS.has(tag) && !TRANSPARENT_ELEMENTS.has(tag);
}

/** Below this many normalized characters a value is punctuation (`·`, `→`), not a field. */
const MIN_LITERAL = 3;

/** The longest text one inner `{placeholder}` stands for, in normalized UTF-16 units. */
const MAX_PLACEHOLDER = 60;

const WHITESPACE = /\s/u;
const FORMAT = /\p{Cf}/u;
const MARK = /\p{M}/u;
const WORD = /[\p{L}\p{N}\p{M}]/u;
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const DELETED = /[\s\p{Cf}]+/gu;

/**
 * Build-time `{name}` slots (`page.fundacja`, `page.mecenat`): an identifier between braces.
 * Any other braces are a link marker (`page.press.contact.list`), whose words the page prints.
 */
export const PLACEHOLDER = /\{[A-Za-z][A-Za-z0-9_]*\}/u;
const BRACE = /[{}]/gu;

/**
 * Named entities beyond the five the build emits (`&amp; &lt; &gt; &quot; &nbsp;`): what authors
 * type into `HTML` values. One missing here leaves its field unmatched, and `copy:coverage` says so.
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: String.fromCharCode(0xa0),
  shy: String.fromCharCode(0xad),
  thinsp: String.fromCharCode(0x2009),
  ensp: String.fromCharCode(0x2002),
  emsp: String.fromCharCode(0x2003),
  zwj: String.fromCharCode(0x200d),
  zwnj: String.fromCharCode(0x200c),
  ndash: String.fromCharCode(0x2013),
  mdash: String.fromCharCode(0x2014),
  hellip: String.fromCharCode(0x2026),
  middot: String.fromCharCode(0xb7),
  laquo: String.fromCharCode(0xab),
  raquo: String.fromCharCode(0xbb),
  bdquo: String.fromCharCode(0x201e),
  ldquo: String.fromCharCode(0x201c),
  rdquo: String.fromCharCode(0x201d),
  lsquo: String.fromCharCode(0x2018),
  rsquo: String.fromCharCode(0x2019),
  copy: String.fromCharCode(0xa9),
  rarr: String.fromCharCode(0x2192),
};

const ENTITY = /&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/gu;

/** Decode character references; an unknown name stays as written. */
export function decodeEntities(html: string): string {
  return html.replace(ENTITY, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

/** The text an `HTML` value prints: no tags, entities decoded. */
export function htmlText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/gu, " "));
}

/** The comparison form of a string: NFC, every whitespace and format character deleted, lowercase. */
export function normalizeText(text: string): string {
  return text.normalize("NFC").replace(DELETED, "").toLowerCase();
}

/** What the page prints for a field. */
export function printedValue(field: MatchField): string {
  return field.value || field.fallback_value || "";
}

/**
 * A field's value as a search pattern: literal pieces with a placeholder between each pair, and
 * whether a placeholder also opens or closes it.
 */
interface Pattern {
  readonly pieces: readonly string[];
  readonly leading: boolean;
  readonly trailing: boolean;
}

/**
 * A slot can hold anything, so off its own page a field with one matches whatever surrounds its
 * few literal words: `{function} VoctFoundation` would claim every "… VoctFoundation" in the
 * footer. Such fields are looked for on their own scope's page only, where the build fills them.
 */
function hasSlot(pattern: Pattern): boolean {
  return pattern.pieces.length > 1 || pattern.leading || pattern.trailing;
}

/** The value's pattern, or `null` when too little of it is literal to be found by text. */
export function fieldPattern(field: MatchField): Pattern | null {
  const printed = printedValue(field);
  const text = field.kind === "HTML" ? htmlText(printed) : printed;
  const pieces = text.split(PLACEHOLDER).map((piece) => normalizeText(piece.replace(BRACE, "")));

  const leading = pieces.length > 1 && pieces[0] === "";
  const trailing = pieces.length > 1 && pieces[pieces.length - 1] === "";
  const literal = pieces.filter((piece) => piece !== "");
  const length = literal.reduce((sum, piece) => sum + [...piece].length, 0);
  if (length < MIN_LITERAL) return null;
  return { pieces: literal, leading, trailing };
}

/** The fields of one locale compiled once: identical patterns share one search. */
export interface Corpus<F extends MatchField> {
  readonly patterns: ReadonlyArray<{ readonly pattern: Pattern; readonly fields: readonly F[] }>;
  /** Fields too short to be found by text. */
  readonly skipped: readonly F[];
}

export function compileCorpus<F extends MatchField>(fields: readonly F[]): Corpus<F> {
  const bySignature = new Map<string, { pattern: Pattern; fields: F[] }>();
  const skipped: F[] = [];
  for (const field of fields) {
    const pattern = fieldPattern(field);
    if (!pattern) {
      skipped.push(field);
      continue;
    }
    const signature = JSON.stringify(pattern);
    const entry = bySignature.get(signature);
    if (entry) entry.fields.push(field);
    else bySignature.set(signature, { pattern, fields: [field] });
  }
  return { patterns: [...bySignature.values()], skipped };
}

/**
 * Flatten the page's text nodes into the comparison form, keeping for every unit where it came
 * from. A base character and the combining marks after it are normalized together, so text typed
 * decomposed still compares equal and still maps back to whole characters.
 */
export function readPage(nodes: readonly TextNodeInput[]): PageText {
  let text = "";
  const flags: number[] = [];
  const node: number[] = [];
  const start: number[] = [];
  const end: number[] = [];

  let gap = true;
  let lineBreak = true;
  nodes.forEach((input, index) => {
    gap = true;
    if (input.breakBefore) lineBreak = true;
    const source = input.text;
    let i = 0;
    while (i < source.length) {
      const char = String.fromCodePoint(source.codePointAt(i) ?? 0);
      if (WHITESPACE.test(char) || char === ZERO_WIDTH_SPACE) {
        gap = true;
        i += char.length;
        continue;
      }
      if (FORMAT.test(char)) {
        i += char.length;
        continue;
      }
      let j = i + char.length;
      while (j < source.length) {
        const next = String.fromCodePoint(source.codePointAt(j) ?? 0);
        if (!MARK.test(next)) break;
        j += next.length;
      }
      const cluster = (j - i === char.length ? char : source.slice(i, j).normalize("NFC")).toLowerCase();
      for (let k = 0; k < cluster.length; k++) {
        text += cluster[k];
        flags.push(k === 0 ? (gap ? GAP : 0) | (lineBreak ? BREAK : 0) : 0);
        node.push(index);
        start.push(i);
        end.push(j);
      }
      gap = false;
      lineBreak = false;
      i = j;
    }
  });

  return {
    text,
    flags: Uint8Array.from(flags),
    node: Int32Array.from(node),
    start: Int32Array.from(start),
    end: Int32Array.from(end),
  };
}

function isWordUnit(text: string, index: number): boolean {
  return WORD.test(text[index] ?? "");
}

/** A word boundary of the original text lies right before `text[index]`. */
function isBoundary(page: PageText, index: number): boolean {
  if (index <= 0 || index >= page.text.length) return true;
  if (page.flags[index] & GAP) return true;
  return !isWordUnit(page.text, index - 1) || !isWordUnit(page.text, index);
}

/** The first unit of the text node `index` sits in. */
function nodeStart(page: PageText, index: number): number {
  let i = index;
  while (i > 0 && page.node[i - 1] === page.node[index]) i--;
  return i;
}

/** One past the last unit of the text node `index - 1` sits in. */
function nodeEnd(page: PageText, index: number): number {
  let i = index;
  while (i < page.text.length && page.node[i] === page.node[index - 1]) i++;
  return i;
}

/**
 * Every span of the page that `pattern` matches. An inner placeholder takes the shortest stretch
 * up to the next piece. A leading or trailing one takes the rest of its text node, because the
 * build fills a slot by string replacement, and must take at least one character —
 * `{function}, VoctFoundation` is not every "VoctFoundation" on the page.
 */
function spansOf(page: PageText, pattern: Pattern): Array<[number, number]> {
  /** Per end, the latest start: "the {name} festival" is not "the closing concert of the … festival". */
  const startByEnd = new Map<number, number>();
  const [first, ...rest] = pattern.pieces;
  let from = 0;
  for (;;) {
    const at = page.text.indexOf(first, from);
    if (at < 0) break;
    from = at + 1;
    if (!isBoundary(page, at)) continue;

    let to = at + first.length;
    let matched = true;
    for (const piece of rest) {
      let next = page.text.indexOf(piece, to + 1);
      while (next >= 0 && next - to <= MAX_PLACEHOLDER && !isBoundary(page, next)) {
        next = page.text.indexOf(piece, next + 1);
      }
      if (next < 0 || next - to > MAX_PLACEHOLDER) {
        matched = false;
        break;
      }
      to = next + piece.length;
    }
    if (!matched || !isBoundary(page, to)) continue;

    let spanStart = at;
    let spanEnd = to;
    if (pattern.leading) {
      spanStart = nodeStart(page, at);
      if (spanStart === at) continue;
    }
    if (pattern.trailing) {
      spanEnd = nodeEnd(page, to);
      if (spanEnd === to) continue;
    }
    startByEnd.set(spanEnd, Math.max(spanStart, startByEnd.get(spanEnd) ?? -1));
  }
  return [...startByEnd].map(([to, from]) => [from, to]);
}

/** True when `field`'s text is on the page at all, inside another field's span or not. */
export function isOnPage(page: PageText, field: MatchField): boolean {
  const pattern = fieldPattern(field);
  return pattern !== null && spansOf(page, pattern).length > 0;
}

/**
 * Every field occurrence on the page, in document order. Identical spans become one occurrence
 * with several fields, where a value matched letter for letter outranks one matched through a
 * slot ("Mecenat · VoctFoundation" is the eyebrow, not `{function} VoctFoundation`). A span lying
 * strictly inside another is dropped — a paragraph that contains a concert's place name is that
 * paragraph, not the place. The exception runs the other way: a span holding no field of the
 * page's own scope, whose every character the own fields already account for, is a coincidence
 * of neighbours — /koncerty's heading "Spiritual" + "Concerts." is not the landing's link
 * "Spiritual Concerts".
 */
export function findOccurrences<F extends MatchField>(
  corpus: Corpus<F>,
  page: PageText,
  { ownScope = null }: { ownScope?: string | null } = {},
): Occurrence<F>[] {
  const bySpan = new Map<string, { from: number; to: number; fields: F[]; slotted: boolean }>();
  for (const { pattern, fields: all } of corpus.patterns) {
    const slotted = hasSlot(pattern);
    const fields = slotted ? all.filter((field) => field.scope === ownScope) : all;
    if (fields.length === 0) continue;
    for (const [from, to] of spansOf(page, pattern)) {
      const id = `${from}:${to}`;
      const entry = bySpan.get(id);
      if (!entry || (entry.slotted && !slotted)) bySpan.set(id, { from, to, fields: [...fields], slotted });
      else if (entry.slotted === slotted) entry.fields.push(...fields);
    }
  }

  const isOwn = (field: F) => field.scope === ownScope;
  const ownCover = new Uint8Array(page.text.length);
  for (const span of bySpan.values()) if (span.fields.some(isOwn)) ownCover.fill(1, span.from, span.to);
  const coveredByOwn = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (!ownCover[i]) return false;
    return true;
  };

  const spans = [...bySpan.values()]
    .filter((span) => span.fields.some(isOwn) || !coveredByOwn(span.from, span.to))
    .sort((a, b) => a.from - b.from || b.to - a.to);
  const occurrences: Occurrence<F>[] = [];
  let reach = -1;
  for (const span of spans) {
    if (span.to <= reach) continue;
    reach = span.to;
    const fields = span.fields.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const own = fields.filter(isOwn);
    const unclaimed = own.length === 0 && fields.length > 1 && isOneWord(page, span.from, span.to);
    occurrences.push({
      start: { node: page.node[span.from], offset: page.start[span.from] },
      end: { node: page.node[span.to - 1], offset: page.end[span.to - 1] },
      from: span.from,
      to: span.to,
      fields,
      candidates: unclaimed ? [] : own.length > 0 ? own : fields,
    });
  }
  return occurrences;
}

/** No word gap inside `[from, to)`. */
function isOneWord(page: PageText, from: number, to: number): boolean {
  for (let i = from + 1; i < to; i++) if (page.flags[i] & GAP) return false;
  return true;
}
