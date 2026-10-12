/**
 * @file paragraphs.ts
 * @description A multi-paragraph `…Html` copy field as the block markup it renders to.
 *
 *  WHY THE FIELD DOES NOT CARRY `<p>`. The copy desk's sanitizer keeps only inline tags and turns
 *  every opening block tag into a single line break, because a browser's contenteditable wraps each
 *  typed line in a block element. A field stored as `<p>…</p><p>…</p>` therefore loses its
 *  paragraphs on the first accepted proposal. The field is stored with a blank line between
 *  paragraphs instead — a shape the sanitizer keeps — and the page wraps each paragraph here.
 *
 *  PURE: no `?raw`, no `astro:*`, so plain Node can import it.
 * @module lib/paragraphs
 */

/**
 * `source` with each blank-line-separated paragraph wrapped in `<p>`, joined by a newline.
 *
 * A value that already carries `<p>` is returned untouched: a translation applied before the field
 * changed shape must not end up with its paragraphs nested.
 */
export function paragraphsToHtml(source: string): string {
  if (/<p[\s>]/i.test(source)) return source;
  return source
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n");
}
