/**
 * @file preview.ts
 * @description The editor's proposals shown on the page in place of the published text, for the
 *  editor alone. Every page read re-applies their open proposals and their accepted ones not yet
 *  published, so a reviewer's acceptance never makes an edit look lost before the deploy.
 *
 *  ONLY WHERE THE PAGE IS THE SITE'S OWN, AND ONLY WHOLE. A preview replaces the children of one
 *  element, the element whose whole text the field is:
 *  - never inside an `<astro-island>`: React owns that DOM and would overwrite or trip over it;
 *  - never inside a `<button>`: the site's scripts say a button's state by rewriting its label
 *    (copied, accepted), and the copy buttons read the label back to restore it, so they would
 *    keep the proposal's wording after the mode has put the published text back;
 *  - the element holds no other visible text and nothing else besides: an icon or a second field
 *    beside the text would vanish with it. A `TEXT` field's element holds text only; an `HTML`
 *    field's holds the inline markup the server keeps (`em, strong, a, code`) and nothing more;
 *  - the value has no blank line (the page builds paragraphs itself) and no braces (a `{slot}`
 *    the build fills, or a link marker the template turns into a link).
 *  Everything else keeps the published text and the gold highlight; `proposalNodes` lays such a
 *  proposal out for the popover the mode opens over it after a save.
 *
 *  THE BUILD'S OWN TYPOGRAPHY: `typoFor(locale)` for `TEXT`, `typographyHtml` for `HTML`, so the
 *  lines break as they will on the deployed page. `HTML` is the STORED value, which the server has
 *  already sanitized; it is sanitized here again to the same whitelist and the same link rule
 *  (`_safe_href`) before it touches the page.
 *
 *  RESTORE PUTS THE SAME NODES BACK. The published children are kept as they were taken out, and
 *  the bar's toggle swaps them in again; the published text is never re-rendered from a value.
 *  A previewed element is PINNED: the page walk skips it and a tap in it goes to its field
 *  (`pageText.ts`), so a proposal's wording is never matched against the corpus.
 *
 *  AN ELEMENT A SCRIPT WRITES INTO IS LET GO. A preview holds its element only while the element's
 *  children are the nodes the preview last put there. Once a page script has replaced them (the
 *  menu's canonical hour, the litany's readout), the preview is forgotten and nothing is written
 *  back: a restore never lays stale text over the script's, and a tap there is read afresh.
 * @module comment-mode/preview
 */

import type { Locale } from "../i18n/config";
import { typoFor } from "../lib/typo";
import { typographyHtml } from "../lib/typoHtml";
import type { IndexRow } from "./api";
import { PLACEHOLDER, printedValue } from "./match";
import { rangeOf, type PageScan, type Pinned } from "./pageText";

/**
 * The server's whitelist (`copydesk/sanitizers.py` ALLOWED_TAGS and ALLOWED_ATTRIBUTES). A Map, so
 * an element named like an `Object.prototype` key (`<constructor>`) finds nothing.
 */
const KEPT_ATTRIBUTES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["em", new Set(["lang"])],
  ["strong", new Set(["lang"])],
  ["a", new Set(["href", "lang"])],
  ["code", new Set<string>()],
]);
const LINK_SCHEMES: ReadonlySet<string> = new Set(["http", "https", "mailto"]);

const BLANK_LINE = /\n[ \t]*\n/u;
const BRACES = /[{}]/u;
/** A character that prints: anything but whitespace and format characters. */
const VISIBLE = /[^\s\p{Cf}]/u;

interface Entry {
  readonly row: IndexRow;
  /** The published children, as they were taken out of the element. */
  readonly original: readonly Node[];
  value: string;
  preview: readonly Node[];
}

/** The editor's proposal on `row` where it changes what the page prints, else `null`. */
export function proposalValue(row: IndexRow): string | null {
  const value = row.mine?.value ?? "";
  return value.trim() === "" || value === printedValue(row) ? null : value;
}

/** The proposal to show for `row` in place, or `null` when there is none or it cannot stand there. */
function wanted(row: IndexRow): string | null {
  const value = proposalValue(row);
  return value === null || BLANK_LINE.test(value) || BRACES.test(value) ? null : value;
}

/** The element whose whole text `range` is, when a `kind` field can be shown in place there. */
function placeOf(range: Range, kind: string): Element | null {
  // A range whose text has left the page collapses: there is nothing left to stand in for.
  if (range.collapsed || !VISIBLE.test(range.toString())) return null;
  const common = range.commonAncestorContainer;
  const element = common instanceof Element ? common : common.parentElement;
  if (!element || element === document.body || element.closest("astro-island, button, [data-comment-mode-host]")) {
    return null;
  }
  for (const inner of element.querySelectorAll("*")) {
    if (kind !== "HTML" || !KEPT_ATTRIBUTES.has(inner.localName) || !range.intersectsNode(inner)) return null;
  }
  const before = document.createRange();
  before.setStart(element, 0);
  before.setEnd(range.startContainer, range.startOffset);
  const after = document.createRange();
  after.setStart(range.endContainer, range.endOffset);
  after.setEnd(element, element.childNodes.length);
  return VISIBLE.test(before.toString()) || VISIBLE.test(after.toString()) ? null : element;
}

/**
 * The server's `_safe_href`: a path or a fragment stays, a value with no colon stays, and whatever
 * stands before the first colon must be an allowed scheme. Nothing is parsed as a URL here: a URL
 * parser drops tabs and control characters, so `java&#9;script:` would read as no scheme at all.
 */
function safeHref(href: string): boolean {
  const value = href.trim();
  if (value === "") return false;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  const colon = value.indexOf(":");
  return colon < 0 || LINK_SCHEMES.has(value.slice(0, colon).toLowerCase());
}

/** Keep the whitelist: other elements give up their children, other attributes go. */
function keepWhitelist(parent: ParentNode): void {
  for (const node of [...parent.childNodes]) {
    if (node instanceof Element) {
      keepWhitelist(node);
      const kept = KEPT_ATTRIBUTES.get(node.localName);
      if (!kept) {
        node.replaceWith(...node.childNodes);
        continue;
      }
      for (const attribute of [...node.attributes]) {
        const unsafe = attribute.name === "href" && !safeHref(attribute.value);
        if (!kept.has(attribute.name) || unsafe) node.removeAttribute(attribute.name);
      }
    } else if (!(node instanceof Text)) {
      node.remove();
    }
  }
}

/** `value` as the build prints it in `locale`: typography applied, `HTML` held to the whitelist. */
function printed(row: IndexRow, value: string, locale: Locale): Node[] {
  if (row.kind !== "HTML") return [document.createTextNode(typoFor(locale)(value))];
  const template = document.createElement("template");
  template.innerHTML = typographyHtml(value, locale);
  keepWhitelist(template.content);
  return [...template.content.childNodes];
}

/** `match.ts`'s placeholder, whole: anything else in braces is a link marker. */
const SLOT = new RegExp(`^${PLACEHOLDER.source}$`, "u");
const IN_BRACES = /\{([^{}]*)\}/gu;

/**
 * A slot the build fills (`{function}`) as a marked token, and a link marker the template turns
 * into a link (`{napisz do nas}`) as its words, underlined.
 */
function markBraces(parent: ParentNode): void {
  for (const node of [...parent.childNodes]) {
    if (!(node instanceof Text)) {
      if (node instanceof Element) markBraces(node);
      continue;
    }
    const text = node.data;
    if (!text.includes("{")) continue;
    const parts: Node[] = [];
    let last = 0;
    for (const match of text.matchAll(IN_BRACES)) {
      const at = match.index;
      if (at > last) parts.push(document.createTextNode(text.slice(last, at)));
      const isSlot = SLOT.test(match[0]);
      const token = document.createElement("span");
      token.className = isSlot ? "slot" : "as-link";
      token.textContent = isSlot ? match[0] : (match[1] ?? "");
      parts.push(token);
      last = at + match[0].length;
    }
    if (last === 0) continue;
    if (last < text.length) parts.push(document.createTextNode(text.slice(last)));
    node.replaceWith(...parts);
  }
}

/**
 * The proposal laid out for the popover over a field it cannot replace in place: one paragraph per
 * blank-line block, the build's typography, links as underlined text that goes nowhere, slots
 * marked.
 */
export function proposalNodes(row: IndexRow, value: string, locale: Locale): HTMLElement {
  const box = document.createElement("div");
  box.className = "proposal";
  box.lang = locale;
  for (const block of value.split(BLANK_LINE)) {
    if (block.trim() === "") continue;
    const paragraph = document.createElement("p");
    paragraph.append(...printed(row, block.trim(), locale));
    for (const link of [...paragraph.querySelectorAll("a")]) {
      const span = document.createElement("span");
      span.className = "as-link";
      span.append(...link.childNodes);
      link.replaceWith(span);
    }
    markBraces(paragraph);
    box.append(paragraph);
  }
  return box;
}

/** The nodes that print `value` in `element`, keeping the whitespace its own text starts and ends with. */
function render(row: IndexRow, value: string, locale: Locale, element: Element): Node[] {
  const text = element.textContent ?? "";
  const lead = /^\s*/u.exec(text)?.[0] ?? "";
  const trail = text.trim() === "" ? "" : (/\s*$/u.exec(text)?.[0] ?? "");
  return [
    ...(lead ? [document.createTextNode(lead)] : []),
    ...printed(row, value, locale),
    ...(trail ? [document.createTextNode(trail)] : []),
  ];
}

/** True while `element`'s children are exactly `nodes`: nothing else has written into it. */
function holds(element: Element, nodes: readonly Node[]): boolean {
  const children = element.childNodes;
  return children.length === nodes.length && nodes.every((node, i) => children[i] === node);
}

export class Previews {
  private readonly entries = new Map<Element, Entry>();
  private shownState = true;

  /** True while the page shows the proposals; false while it shows the published text. */
  get shown(): boolean {
    return this.shownState;
  }

  get size(): number {
    return this.entries.size;
  }

  /** True when `node` lies in an element that shows a proposal in place. */
  covers(node: Node): boolean {
    for (const element of this.entries.keys()) if (element.contains(node)) return true;
    return false;
  }

  /** The previewed elements and their fields: what the page walk skips and taps go straight to. */
  pinned(): Pinned {
    return new Map([...this.entries].map(([element, entry]) => [element, entry.row]));
  }

  /**
   * Bring the page in line with the index after a read, a save or a withdrawal: follow the
   * proposals that changed, put the published text back where one is gone, and show every
   * proposal whose field is the only one a span can be. True when the page walk must run again.
   */
  sync(scan: PageScan, locale: Locale): boolean {
    let changed = this.prune();
    for (const [element, entry] of this.entries) {
      const value = wanted(entry.row);
      if (value === null) {
        if (this.shownState) element.replaceChildren(...entry.original);
        this.entries.delete(element);
        changed = true;
      } else if (value !== entry.value) {
        entry.value = value;
        entry.preview = render(entry.row, value, locale, element);
        if (this.shownState) element.replaceChildren(...entry.preview);
        changed = true;
      }
    }
    for (const occurrence of scan.occurrences) {
      if (occurrence.candidates.length !== 1) continue;
      const range = rangeOf(scan, occurrence);
      if (range && this.place(range, occurrence.candidates[0], locale)) changed = true;
    }
    return changed;
  }

  /**
   * Show `row`'s proposal over `range`, when it can stand there. Used for the span a save started
   * from too, which may be one a chooser resolved: after a reload such a span is shown again only
   * when the field is its only candidate.
   */
  place(range: Range, row: IndexRow, locale: Locale): boolean {
    const value = wanted(row);
    if (value === null) return false;
    const element = placeOf(range, row.kind);
    if (!element || this.entries.has(element)) return false;
    const entry: Entry = { row, original: [...element.childNodes], value, preview: [] };
    entry.preview = render(row, value, locale, element);
    this.entries.set(element, entry);
    if (this.shownState) element.replaceChildren(...entry.preview);
    return true;
  }

  /**
   * Forget every preview whose element has left the page or no longer holds the nodes the preview
   * put there, without writing anything back. True when one was forgotten: the pins changed.
   */
  prune(): boolean {
    let changed = false;
    for (const [element, entry] of this.entries) {
      if (element.isConnected && holds(element, this.shownState ? entry.preview : entry.original)) continue;
      this.entries.delete(element);
      changed = true;
    }
    return changed;
  }

  /** Swap the proposals and the published text. True when the page or the pins changed. */
  setShown(shown: boolean): boolean {
    if (shown === this.shownState) return false;
    const pruned = this.prune();
    this.shownState = shown;
    for (const [element, entry] of this.entries) {
      element.replaceChildren(...(shown ? entry.preview : entry.original));
    }
    return pruned || this.entries.size > 0;
  }

  /** Put every published text back and forget the previews: the page is the visitor's again. */
  restoreAll(): void {
    this.prune();
    if (this.shownState) {
      for (const [element, entry] of this.entries) element.replaceChildren(...entry.original);
    }
    this.entries.clear();
  }
}
