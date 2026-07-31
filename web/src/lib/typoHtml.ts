/**
 * @file typoHtml.ts
 * @description Applies the `typo.ts` rules to the TEXT of a finished HTML document and to nothing
 *  else. It is a splicer, not a parser: it walks the string, hands every run of text between two
 *  tags to the locale's pass, and copies everything else through byte for byte. Tags, attributes,
 *  entities and document order are therefore untouched by construction — the worst a bad rule
 *  could do is put a no-break space in the wrong place, never damage the markup.
 *
 *  A run is not a sentence: `<em>9 Kart</em> — nabierają` is three runs, and the dash rule needs
 *  the "t" that ended the previous one. So the walker carries the last rendered character across
 *  INLINE tags and prepends it as context (dropped again afterwards). A block tag or a `<br>`
 *  clears the carry — text on the other side of one is a different line, and pinning across it
 *  would put a stray no-break space at the head of a paragraph.
 *
 *  Left alone:
 *   - raw-text and verbatim elements — `<script>`, `<style>`, `<pre>`, `<code>`, `<svg>`,
 *     `<textarea>`, `<template>`, and `<title>` (a tab label gains nothing from a pinned space,
 *     and it is quoted verbatim by search engines);
 *   - `<astro-island>` subtrees — see the hydration note in typo.ts;
 *   - anything under `data-typo="off"`, the escape hatch for copy whose spacing is layout
 *     (a `white-space: pre-line` block, an ASCII figure).
 * @architecture Astro islands 2026
 * @module lib/typoHtml
 */

import { DEFAULT_LOCALE, LOCALES, type Locale } from "../i18n/config";
import { INLINE_ELEMENTS as INLINE, typoFor } from "./typo";

/** Content is not markup (or must survive verbatim) — copy the whole subtree through. */
const VERBATIM = new Set([
  "script",
  "style",
  "textarea",
  "title",
  "pre",
  "code",
  "kbd",
  "samp",
  "svg",
  "math",
  "template",
  // React owns this subtree from hydration onwards; rewriting it desynchronises the two renders.
  "astro-island",
]);

/** Of those, the ones whose content is NOT markup: scan straight to the matching close tag. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);

/** Per-element opt-out, for copy whose spacing carries meaning. */
const TYPO_OFF = /\sdata-typo=(["'])off\1/i;

/** End of the tag that starts at `lt`, honouring quoted attribute values (which may contain `>`). */
function tagEndOf(html: string, lt: number): number {
  let quote: string | null = null;
  for (let j = lt + 1; j < html.length; j++) {
    const c = html[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return j + 1;
    }
  }
  return html.length;
}

/** True when the tag at `lt` closes a block-level element (so a space before it is collapsed away). */
function closesBlock(html: string, lt: number): boolean {
  const m = /^<\/([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 24));
  return m ? !INLINE.has(m[1].toLowerCase()) : false;
}

/** The document's own `<html lang>`, which is what decides whose typographic conventions apply. */
export function detectLocale(html: string): Locale {
  const lang = /<html[^>]*\blang=["']?([a-zA-Z-]+)/.exec(html)?.[1]?.slice(0, 2).toLowerCase();
  return (LOCALES as readonly string[]).includes(lang ?? "") ? (lang as Locale) : DEFAULT_LOCALE;
}

/** Apply the locale's micro-typography to every eligible text node of `html`. */
export function typographyHtml(html: string, locale: Locale = detectLocale(html)): string {
  const pass = typoFor(locale);
  const out: string[] = [];
  let i = 0;
  /** Name of the verbatim element we are inside, and how deep the same name is nested. */
  let skipRoot: string | null = null;
  let skipDepth = 0;
  /** Last rendered character of the current inline flow — "" when a block boundary ended it. */
  let carry = "";

  /**
   * Transform one text run in the context of what precedes it. The carry is prepended so a rule
   * can see across an inline tag, then sliced back off — every rule re-emits its left context
   * unchanged as `$1`, so the offset holds.
   *
   * A trailing whitespace run is held back when a BLOCK tag closes right after it: the renderer
   * collapses that space away, and turning it into an NBSP would materialise it as a visible one
   * hanging off the end of the line.
   */
  const runText = (text: string, blockCloseFollows: boolean): string => {
    if (!text) return text;
    if (!/\S/.test(text)) return text;
    const trailing = blockCloseFollows ? /[ \t\r\n]+$/.exec(text) : null;
    const body = trailing ? text.slice(0, trailing.index) : text;
    return pass(carry + body).slice(carry.length) + (trailing ? trailing[0] : "");
  };

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    const text = html.slice(i, lt === -1 ? html.length : lt);
    if (skipRoot) {
      out.push(text);
    } else {
      out.push(runText(text, lt !== -1 && closesBlock(html, lt)));
      if (text) carry = /\S/.test(text) ? text.slice(-1) : " ";
    }
    if (lt === -1) break;

    // Comments and doctype carry no prose worth breaking — copy verbatim.
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt);
      const stop = end === -1 ? html.length : end + 3;
      out.push(html.slice(lt, stop));
      i = stop;
      continue;
    }

    const tagEnd = tagEndOf(html, lt);
    const tag = html.slice(lt, tagEnd);
    out.push(tag);
    i = tagEnd;

    const named = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag);
    if (!named) continue;
    const closing = named[1] === "/";
    const name = named[2].toLowerCase();

    if (skipRoot) {
      if (name !== skipRoot) continue;
      if (closing) {
        skipDepth -= 1;
        if (skipDepth === 0) skipRoot = null;
      } else if (!tag.endsWith("/>")) {
        skipDepth += 1;
      }
      continue;
    }

    if (!INLINE.has(name)) carry = "";
    if (closing || tag.endsWith("/>")) continue;
    if (!VERBATIM.has(name) && !TYPO_OFF.test(tag)) continue;

    carry = "";
    if (RAW_TEXT.has(name)) {
      // Content is not markup — a `<` inside it is data. Jump to the matching end tag.
      const close = html.toLowerCase().indexOf(`</${name}`, i);
      const stop = close === -1 ? html.length : close;
      out.push(html.slice(i, stop));
      i = stop;
      continue;
    }
    skipRoot = name;
    skipDepth = 1;
  }

  return out.join("");
}
