/**
 * @file highlights.ts
 * @description What the comment mode paints over the page, through the CSS Custom Highlight API:
 *  ranges styled by `::highlight()` rules, which change no DOM at all. Nothing is written into the
 *  site's nodes or React's, there is no outline for `overflow: hidden` to clip, and an island's
 *  `display: contents` wrapper does not matter.
 *  - `field`: a faint wash over every text a tap can edit (a bar toggle);
 *  - `hover`: the field under a mouse pointer, so a desktop editor needs no wash at all;
 *  - `mine`: gold over every field carrying the editor's own proposal, previewed or not.
 *
 *  The `::highlight()` rules must live in the document, not in the tool's shadow root, since the
 *  ranges are in the page. They go in as an adopted stylesheet: the client router swaps `<head>`
 *  and `<body>` and never touches `document.adoptedStyleSheets`. A browser without the API (or
 *  without adopted stylesheets) shows no affordance, and taps still work.
 *
 *  The gold is the tool's own (`styles.ts` `--cm-gold`), translucent so it reads on parchment and
 *  night pages alike.
 * @architecture Astro islands 2026
 * @module comment-mode/highlights
 */

const FIELD = "voct-comment-field";
const HOVER = "voct-comment-hover";
const MINE = "voct-comment-mine";

const RULES = `
::highlight(${FIELD}) { background-color: rgba(214, 182, 108, 0.16); }
::highlight(${HOVER}) { background-color: rgba(214, 182, 108, 0.3); }
::highlight(${MINE}) { background-color: rgba(214, 182, 108, 0.42); }
`;

function sameRange(a: Range | null, b: Range | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
  );
}

export class Highlights {
  readonly supported: boolean;
  private readonly sheet: CSSStyleSheet | null = null;
  private hovered: Range | null = null;

  constructor() {
    this.supported =
      typeof CSS !== "undefined" &&
      "highlights" in CSS &&
      typeof Highlight === "function" &&
      "adoptedStyleSheets" in document;
    if (!this.supported) return;
    this.sheet = new CSSStyleSheet();
    this.sheet.replaceSync(RULES);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.sheet];
  }

  /** Paint the editable fields and the editor's own; either list may be empty. */
  paint(fields: readonly Range[], mine: readonly Range[]): void {
    if (!this.supported) return;
    this.set(FIELD, fields, 0);
    this.set(MINE, mine, 1);
  }

  /** The field under the mouse, or `null`. */
  hover(range: Range | null): void {
    if (!this.supported || sameRange(range, this.hovered)) return;
    this.hovered = range;
    this.set(HOVER, range ? [range] : [], 2);
  }

  clear(): void {
    if (!this.supported) return;
    this.hovered = null;
    for (const name of [FIELD, HOVER, MINE]) CSS.highlights.delete(name);
  }

  dispose(): void {
    this.clear();
    const sheet = this.sheet;
    if (sheet) document.adoptedStyleSheets = document.adoptedStyleSheets.filter((known) => known !== sheet);
  }

  private set(name: string, ranges: readonly Range[], priority: number): void {
    if (ranges.length === 0) {
      CSS.highlights.delete(name);
      return;
    }
    const highlight = new Highlight(...ranges);
    highlight.priority = priority;
    CSS.highlights.set(name, highlight);
  }
}
