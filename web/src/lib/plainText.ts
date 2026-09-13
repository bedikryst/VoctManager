/**
 * @file plainText.ts
 * @description An `HTML` copy field as the plain text somebody pastes into a programme book.
 *
 *  WHY THIS EXISTS AT ALL. /press prints the biogram in three measures and offers each one to the
 *  clipboard. The rendered paragraph carries `<strong>` and `<em>`; what the reader pastes into
 *  Word must not. The obvious shape — a second YAML field holding the plain version beside the
 *  marked-up one — is the shape that goes wrong: two fields saying the same thing diverge the
 *  first time somebody edits one of them, and the desk would show an editor two rows for one
 *  sentence. So there is ONE field, and the plain text is derived from it here.
 *
 *  IT IS ALSO WHAT THE PACK SHIPS. `scripts/press-pack.mjs` writes `biogram-*.txt` from the same
 *  YAML through this same function, so the file in an organiser's zip and the text on the page
 *  cannot say different things. That is the reason this module is PURE — no `?raw`, no `astro:*`
 *  — so plain Node can import it.
 *
 *  NOT A SANITIZER. It renders trusted, hand-authored copy as text; it is not a defence against
 *  hostile markup and must never be used as one.
 * @architecture Astro islands 2026
 * @module lib/plainText
 */

/** The entities this site's copy actually uses. Anything else is written as the character. */
const ENTITIES: Readonly<Record<string, string>> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
};

/**
 * `html` as plain text: paragraphs separated by a blank line, markup gone, whitespace collapsed.
 *
 * The blank line between paragraphs is the point of doing this by hand rather than with a naive
 * tag strip — a biogram pasted as one wall of text is what an organiser then has to re-break, and
 * they will do it in the wrong places.
 */
export function htmlToPlainText(html: string): string {
  return (
    html
      // Block boundaries become paragraph breaks BEFORE the tags are dropped, or the text loses
      // the only structure it had.
      .replace(/<\/(?:p|div|h[1-6]|li)\s*>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
      // Runs of spaces and tabs collapse; newlines are structure and survive.
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * How long a piece of copy is, as a reader of a brief counts it: characters of the plain text.
 *
 * Printed on /press beside each biogram so the measure can never be a stale claim — "ok. 2000
 * znaków" was typed by hand and stayed typed after the sentence under it changed.
 */
export function plainTextLength(html: string): number {
  return htmlToPlainText(html).length;
}
