/**
 * @file preview.ts
 * @description The editor's proposals shown on the page in place of the published text, for the
 *  editor alone. Every page read re-applies their open proposals and their accepted ones not yet
 *  published, so a reviewer's acceptance never makes an edit look lost before the deploy.
 *
 *  ONLY WHERE THE PAGE IS THE SITE'S OWN, AND ONLY WHOLE. A preview replaces the children of one
 *  element, the element whose whole text the field is:
 *  - never inside an `<astro-island>`: React owns that DOM and would overwrite or trip over it;
 *  - the element holds no other visible text and nothing else besides: an icon or a second field
 *    beside the text would vanish with it. A `TEXT` field's element holds text only; an `HTML`
 *    field's holds the inline markup the server keeps (`em, strong, a, code`) and nothing more;
 *  - the value has no blank line (the page builds paragraphs itself) and no braces (a `{slot}`
 *    the build fills, or a link marker the template turns into a link).
 *  Everything else keeps the published text and the gold highlight; popovers for those are
 *  stage 4.
 *
 *  THE BUILD'S OWN TYPOGRAPHY: `typoFor(locale)` for `TEXT`, `typographyHtml` for `HTML`, so the
 *  lines break as they will on the deployed page. `HTML` is the STORED value, which the server has
 *  already sanitized; it is sanitized here again to the same whitelist before it touches the page.
 *
 *  RESTORE PUTS THE SAME NODES BACK. The published children are kept as they were taken out, and
 *  the bar's toggle swaps them in again; the published text is never re-rendered from a value.
 *  A previewed element is PINNED: the page walk skips it and a tap in it goes to its field
 *  (`pageText.ts`), so a proposal's wording is never matched against the corpus.
 * @architecture Astro islands 2026
 * @module comment-mode/preview
 */

import type { Locale } from "../i18n/config";
import { typoFor } from "../lib/typo";
import { typographyHtml } from "../lib/typoHtml";
import type { IndexRow } from "./api";
import { printedValue } from "./match";
import { rangeOf, type PageScan, type Pinned } from "./pageText";

/** The server's whitelist (`copydesk/sanitizers.py` ALLOWED_TAGS and ALLOWED_ATTRIBUTES). */
const KEPT_ATTRIBUTES: Readonly<Record<string, ReadonlySet<string>>> = {
  em: new Set(["lang"]),
  strong: new Set(["lang"]),
  a: new Set(["href", "lang"]),
  code: new Set(),
};
const LINK_SCHEMES: ReadonlySet<string> = new Set(["http", "https", "mailto"]);
const SCHEME = /^\s*([a-z][a-z0-9+.-]*):/iu;

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

/** The proposal to show for `row`, or `null` when there is none or it cannot stand in place. */
function wanted(row: IndexRow): string | null {
  const value = row.mine?.value ?? "";
  if (value.trim() === "" || BLANK_LINE.test(value) || BRACES.test(value)) return null;
  return value === printedValue(row) ? null : value;
}

/** The element whose whole text `range` is, when a `kind` field can be shown in place there. */
function placeOf(range: Range, kind: string): Element | null {
  // A range whose text has left the page collapses: there is nothing left to stand in for.
  if (range.collapsed || !VISIBLE.test(range.toString())) return null;
  const common = range.commonAncestorContainer;
  const element = common instanceof Element ? common : common.parentElement;
  if (!element || element === document.body || element.closest("astro-island, [data-comment-mode-host]")) {
    return null;
  }
  for (const inner of element.querySelectorAll("*")) {
    if (kind !== "HTML" || !(inner.localName in KEPT_ATTRIBUTES) || !range.intersectsNode(inner)) return null;
  }
  const before = document.createRange();
  before.setStart(element, 0);
  before.setEnd(range.startContainer, range.startOffset);
  const after = document.createRange();
  after.setStart(range.endContainer, range.endOffset);
  after.setEnd(element, element.childNodes.length);
  return VISIBLE.test(before.toString()) || VISIBLE.test(after.toString()) ? null : element;
}

function safeHref(href: string): boolean {
  const scheme = SCHEME.exec(href)?.[1].toLowerCase();
  return scheme === undefined || LINK_SCHEMES.has(scheme);
}

/** Keep the whitelist: other elements give up their children, other attributes go. */
function keepWhitelist(parent: ParentNode): void {
  for (const node of [...parent.childNodes]) {
    if (node instanceof Element) {
      keepWhitelist(node);
      const kept = KEPT_ATTRIBUTES[node.localName];
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

/** The nodes that print `value` in `element`, keeping the whitespace its own text starts and ends with. */
function render(row: IndexRow, value: string, locale: Locale, element: Element): Node[] {
  const text = element.textContent ?? "";
  const lead = /^\s*/u.exec(text)?.[0] ?? "";
  const trail = text.trim() === "" ? "" : (/\s*$/u.exec(text)?.[0] ?? "");
  let body: Node[];
  if (row.kind === "HTML") {
    const template = document.createElement("template");
    template.innerHTML = typographyHtml(value, locale);
    keepWhitelist(template.content);
    body = [...template.content.childNodes];
  } else {
    body = [document.createTextNode(typoFor(locale)(value))];
  }
  return [
    ...(lead ? [document.createTextNode(lead)] : []),
    ...body,
    ...(trail ? [document.createTextNode(trail)] : []),
  ];
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
    let changed = false;
    for (const [element, entry] of this.entries) {
      if (!element.isConnected) {
        this.entries.delete(element);
        changed = true;
        continue;
      }
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

  /** Swap the proposals and the published text. True when the page changed. */
  setShown(shown: boolean): boolean {
    if (shown === this.shownState) return false;
    this.shownState = shown;
    for (const [element, entry] of this.entries) {
      if (element.isConnected) element.replaceChildren(...(shown ? entry.preview : entry.original));
    }
    return this.entries.size > 0;
  }

  /** Put every published text back and forget the previews: the page is the visitor's again. */
  restoreAll(): void {
    if (this.shownState) {
      for (const [element, entry] of this.entries) {
        if (element.isConnected) element.replaceChildren(...entry.original);
      }
    }
    this.entries.clear();
  }
}
