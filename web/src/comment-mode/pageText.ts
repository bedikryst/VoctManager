/**
 * @file pageText.ts
 * @description The live page as the matcher reads it, and the way back from a tap to a field.
 *
 *  The walk is the one `copydesk/htmlText.mjs` makes over the built HTML, over the DOM instead:
 *  `<body>`'s text nodes in document order, without the tool's own host and without the elements
 *  `skipsText` names, each flagged when crossing an element `breaksText` names — entering it or
 *  leaving it — lies between it and the text node before. Both walks share those two predicates
 *  from `match.ts`, so the live page and `copy:coverage` agree on what a field is.
 *
 *  A tap is resolved through the caret under the point (`caretPositionFromPoint`, or WebKit's
 *  `caretRangeFromPoint`) and then confirmed against the occurrence's own line boxes, because a
 *  caret API answers with the NEAREST caret: a tap in a paragraph's margin would otherwise land on
 *  the closest word. Without a caret API, the occurrences inside the tapped element whose boxes
 *  hold the point decide.
 *
 *  PINNED ELEMENTS are the ones holding a preview (`preview.ts`): their whole text is one known
 *  field. The walk skips them, so a proposal's wording is never matched against the corpus, and a
 *  tap inside one goes straight to its field. Skipping one breaks the line on both sides, so the
 *  words around it never join into a phrase the page does not print.
 * @architecture Astro islands 2026
 * @module comment-mode/pageText
 */

import type { IndexRow } from "./api";
import {
  breaksText,
  findOccurrences,
  readPage,
  skipsText,
  type Corpus,
  type Occurrence,
  type TextNodeInput,
  type TextPoint,
} from "./match";

export type FieldOccurrence = Occurrence<IndexRow>;

export interface PageScan {
  /** The walked text nodes; an occurrence's `start.node` / `end.node` index this list. */
  readonly nodes: readonly Text[];
  readonly position: ReadonlyMap<Text, number>;
  readonly occurrences: readonly FieldOccurrence[];
}

/** Copy inside one of these opens a choice between editing it and following it. */
const INTERACTIVE = "a[href], button, summary, [role='button'], [role='link']";

/** How far outside a line box a tap still counts as on it, in CSS px. */
const SLOP = 3;

/** Elements whose whole text is a known field, and that field. */
export type Pinned = ReadonlyMap<Element, IndexRow>;

export interface ScanOptions {
  /** The tool's own host. */
  readonly host: Element;
  readonly pinned: Pinned;
}

export function scanPage(corpus: Corpus<IndexRow>, ownScope: string | null, { host, pinned }: ScanOptions): PageScan {
  const nodes: Text[] = [];
  const inputs: TextNodeInput[] = [];
  let pendingBreak = false;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node === host) return NodeFilter.FILTER_REJECT;
      if (node instanceof Element && pinned.has(node)) {
        pendingBreak = true;
        return NodeFilter.FILTER_REJECT;
      }
      if (node instanceof Element) {
        const tag = node.localName.toLowerCase();
        if (skipsText(tag)) {
          if (breaksText(tag)) pendingBreak = true;
          return NodeFilter.FILTER_REJECT;
        }
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  // The elements the walk is inside. Popping one that no longer contains the next node is
  // leaving it, which breaks the line exactly as entering it does.
  const open: Element[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    while (open.length > 0 && !open[open.length - 1].contains(node)) {
      const left = open.pop();
      if (left && breaksText(left.localName.toLowerCase())) pendingBreak = true;
    }
    if (node instanceof Element) {
      open.push(node);
      if (breaksText(node.localName.toLowerCase())) pendingBreak = true;
    } else if (node instanceof Text) {
      nodes.push(node);
      inputs.push({ text: node.data, breakBefore: pendingBreak });
      pendingBreak = false;
    }
  }

  const position = new Map<Text, number>();
  nodes.forEach((node, index) => position.set(node, index));
  return { nodes, position, occurrences: findOccurrences(corpus, readPage(inputs), { ownScope }) };
}

/** The occurrence as a live Range, or `null` once its text nodes have left the page or changed. */
export function rangeOf(scan: PageScan, occurrence: FieldOccurrence): Range | null {
  const start = scan.nodes[occurrence.start.node];
  const end = scan.nodes[occurrence.end.node];
  if (!start?.isConnected || !end?.isConnected) return null;
  if (occurrence.start.offset > start.length || occurrence.end.offset > end.length) return null;
  const range = document.createRange();
  range.setStart(start, occurrence.start.offset);
  range.setEnd(end, occurrence.end.offset);
  return range;
}

/** Which of the range's line boxes holds the point, or -1. */
export function lineAt(range: Range, x: number, y: number): number {
  const rects = range.getClientRects();
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    if (x >= rect.left - SLOP && x <= rect.right + SLOP && y >= rect.top - SLOP && y <= rect.bottom + SLOP) {
      return i;
    }
  }
  return -1;
}

interface CaretDocument {
  caretPositionFromPoint?(x: number, y: number): { readonly offsetNode: Node; readonly offset: number } | null;
  caretRangeFromPoint?(x: number, y: number): Range | null;
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc: CaretDocument = document;
  if (typeof doc.caretPositionFromPoint === "function") {
    const caret = doc.caretPositionFromPoint(x, y);
    return caret ? { node: caret.offsetNode, offset: caret.offset } : null;
  }
  if (typeof doc.caretRangeFromPoint === "function") {
    const caret = doc.caretRangeFromPoint(x, y);
    return caret ? { node: caret.startContainer, offset: caret.startOffset } : null;
  }
  return null;
}

function compare(a: TextPoint, b: TextPoint): number {
  return a.node - b.node || a.offset - b.offset;
}

export interface Hit {
  /** What the tap offers: one field, a choice, or none (a shared word the tap explains). */
  readonly candidates: readonly IndexRow[];
  /** Every field whose printed value is the tapped span: the context a shared word lists. */
  readonly fields: readonly IndexRow[];
  readonly range: Range;
  /** The line box the tap landed in: the popover hangs from it. */
  readonly line: number;
  /** The link or button the copy sits in, if any. */
  readonly control: HTMLElement | null;
}

export type HitResult =
  | { readonly kind: "hit"; readonly hit: Hit }
  | { readonly kind: "miss" }
  /** The caret is in text the scan has never seen (an island re-rendered): scan again. */
  | { readonly kind: "unseen" };

function confirm(scan: PageScan, occurrence: FieldOccurrence, x: number, y: number): Hit | null {
  const range = rangeOf(scan, occurrence);
  if (!range) return null;
  const line = lineAt(range, x, y);
  if (line < 0) return null;
  const startNode = scan.nodes[occurrence.start.node];
  const control = startNode.parentElement?.closest<HTMLElement>(INTERACTIVE) ?? null;
  return { candidates: occurrence.candidates, fields: occurrence.fields, range, line, control };
}

/** The pinned element `node` lies in, if any. */
function pinnedAround(node: Node | null, pinned: Pinned): Element | null {
  for (let element = node instanceof Element ? node : (node?.parentElement ?? null); element; element = element.parentElement) {
    if (pinned.has(element)) return element;
  }
  return null;
}

function confirmPinned(element: Element, row: IndexRow, x: number, y: number): Hit | null {
  const range = document.createRange();
  range.selectNodeContents(element);
  const line = lineAt(range, x, y);
  if (line < 0) return null;
  const control = element.closest<HTMLElement>(INTERACTIVE);
  return { candidates: [row], fields: [row], range, line, control };
}

/** The field under a tap at viewport point `(x, y)` on `target`. */
export function hitAt(scan: PageScan, pinned: Pinned, x: number, y: number, target: EventTarget | null): HitResult {
  const caret = caretAt(x, y);
  const caretPin = pinnedAround(caret?.node ?? null, pinned);
  const element = caretPin ?? pinnedAround(target instanceof Node ? target : null, pinned);
  const row = element ? pinned.get(element) : undefined;
  if (element && row) {
    const hit = confirmPinned(element, row, x, y);
    if (hit) return { kind: "hit", hit };
  }
  // The scan never reads a pinned element's text, so a caret in one is not "unseen".
  if (caretPin) return { kind: "miss" };

  if (caret && caret.node instanceof Text) {
    const index = scan.position.get(caret.node);
    if (index === undefined) return caret.node.isConnected ? { kind: "unseen" } : { kind: "miss" };
    const point: TextPoint = { node: index, offset: caret.offset };
    // A caret at an occurrence's very end is a tap on the right half of its last letter; one
    // that is strictly inside wins over that when two occurrences meet at the point.
    const covering = scan.occurrences
      .filter((o) => compare(o.start, point) <= 0 && compare(point, o.end) <= 0)
      .sort((a, b) => Number(compare(point, a.end) === 0) - Number(compare(point, b.end) === 0));
    for (const occurrence of covering) {
      const hit = confirm(scan, occurrence, x, y);
      if (hit) return { kind: "hit", hit };
    }
    return { kind: "miss" };
  }

  if (!(target instanceof Element)) return { kind: "miss" };
  for (const occurrence of scan.occurrences) {
    if (!target.contains(scan.nodes[occurrence.start.node])) continue;
    const hit = confirm(scan, occurrence, x, y);
    if (hit) return { kind: "hit", hit };
  }
  return { kind: "miss" };
}
