// @ts-check
/**
 * @file htmlText.mjs
 * @description The text nodes a browser would build from one page of `dist/`, for the comment
 *  mode's matcher to read without a DOM. Only what `copy:coverage` needs: the text of `<body>` in
 *  document order with a flag for every line break crossed, and, set apart, the text a visitor
 *  never reads as page prose — attributes, the head, JSON-LD, `<noscript>` — the props and JSON
 *  data islands render from on the client, and the chrome marked `data-desk="none"`.
 *
 *  A tokenizer, not a parser: the build's own output is well formed, and text order is all the
 *  matcher needs. Implied end tags change nothing in that order. Which elements hide their text
 *  and which break a line come from the matcher, so the live walk and this one draw both lines in
 *  the same place.
 * @architecture Astro islands 2026
 * @module copydesk/htmlText
 */

import {
  breaksText,
  decodeEntities,
  htmlText,
  OUTSIDE_DESK_ATTRIBUTE,
  OUTSIDE_DESK_VALUE,
  skipsText,
} from "../src/comment-mode/match.ts";

/** One attribute after the tag name: name, then a double-, single- or un-quoted value. */
const ATTRIBUTE = /\s*([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/y;
const TAG_NAME = /<(\/?)([A-Za-z][A-Za-z0-9-]*)/y;

/**
 * @typedef {object} HtmlText
 * @property {string} lang `<html lang>`.
 * @property {string} htmlClass
 * @property {string} bodyClass
 * @property {{ text: string, breakBefore: boolean }[]} nodes The body's text nodes.
 * @property {string[]} hidden Attribute values, the head's text, JSON-LD strings, `<noscript>`.
 * @property {string[]} scripted Strings in island props and JSON data blocks: copy that only
 *  reaches the page when client code renders it.
 * @property {string[]} outside The text of subtrees marked `data-desk="none"`: chrome the walk
 *  skips, kept so a desk field printed there anyway can be named.
 */

/**
 * Every string leaf of a JSON value.
 *
 * @param {unknown} value
 * @param {string[]} out
 */
function jsonStrings(value, out) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) jsonStrings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) jsonStrings(item, out);
}

/**
 * @param {string} raw
 * @param {string[]} out
 */
function parseJsonInto(raw, out) {
  try {
    jsonStrings(JSON.parse(raw), out);
  } catch {
    out.push(raw);
  }
}

/**
 * A `mailto:` link with its subject readable: the corpus holds mail subjects as copy.
 *
 * @param {string} href
 */
function decodeMailto(href) {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

/**
 * Where the element opened just before `from` closes: the index of its end tag's `<`, or -1.
 * Elements of the same name nested inside it are counted, so a `<div>` closes on its own `</div>`.
 *
 * @param {string} html
 * @param {string} name lowercase
 * @param {number} from
 */
function matchingClose(html, name, from) {
  const tag = new RegExp(`<(/?)${name}(?=[\\s/>])[^>]*?(/?)>`, "giu");
  tag.lastIndex = from;
  let depth = 1;
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    if (match[1] === "/") depth -= 1;
    else if (match[2] !== "/") depth += 1;
    if (depth === 0) return match.index;
  }
  return -1;
}

/**
 * @param {string} html
 * @returns {HtmlText}
 */
export function readHtmlText(html) {
  /** @type {HtmlText} */
  const result = { lang: "", htmlClass: "", bodyClass: "", nodes: [], hidden: [], scripted: [], outside: [] };
  let inBody = false;
  let templateDepth = 0;
  let pendingBreak = true;

  /**
   * Whitespace-only runs are kept: between two inline elements one is the only word gap there.
   *
   * @param {string} raw
   */
  const pushText = (raw) => {
    if (!inBody || templateDepth > 0 || raw === "") return;
    result.nodes.push({ text: decodeEntities(raw), breakBefore: pendingBreak });
    pendingBreak = false;
  };

  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    pushText(html.slice(i, lt < 0 ? html.length : lt));
    if (lt < 0) break;
    i = lt;

    if (html.startsWith("<!--", i)) {
      const close = html.indexOf("-->", i + 4);
      i = close < 0 ? html.length : close + 3;
      continue;
    }
    if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
      const close = html.indexOf(">", i);
      i = close < 0 ? html.length : close + 1;
      continue;
    }

    TAG_NAME.lastIndex = i;
    const tag = TAG_NAME.exec(html);
    if (!tag) {
      pushText("<");
      i += 1;
      continue;
    }
    const closing = tag[1] === "/";
    const name = tag[2].toLowerCase();

    /** @type {Record<string, string>} */
    const attributes = {};
    let p = TAG_NAME.lastIndex;
    let selfClosing = false;
    while (p < html.length) {
      const char = html[p];
      if (char === ">") {
        p += 1;
        break;
      }
      if (char === "/" || /\s/u.test(char)) {
        selfClosing = char === "/";
        p += 1;
        continue;
      }
      ATTRIBUTE.lastIndex = p;
      const match = ATTRIBUTE.exec(html);
      if (!match) {
        p += 1;
        continue;
      }
      attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
      selfClosing = false;
      p = ATTRIBUTE.lastIndex;
    }
    i = p;

    if (closing) {
      if (name === "template" && templateDepth > 0) templateDepth -= 1;
      if (name === "body") inBody = false;
      if (breaksText(name)) pendingBreak = true;
      continue;
    }

    if (name === "html") {
      result.lang = attributes.lang ?? "";
      result.htmlClass = attributes.class ?? "";
    }
    if (name === "body") {
      result.bodyClass = attributes.class ?? "";
      inBody = true;
    }
    for (const [attribute, value] of Object.entries(attributes)) {
      if (value === "") continue;
      if (name === "astro-island" && attribute === "props") parseJsonInto(value, result.scripted);
      else if (attribute === "href" && value.startsWith("mailto:")) result.hidden.push(decodeMailto(value));
      else result.hidden.push(value);
    }
    if (breaksText(name)) pendingBreak = true;

    if (inBody && !selfClosing && attributes[OUTSIDE_DESK_ATTRIBUTE] === OUTSIDE_DESK_VALUE) {
      const close = matchingClose(html, name, i);
      result.outside.push(htmlText(html.slice(i, close < 0 ? html.length : close)));
      const end = close < 0 ? html.length : html.indexOf(">", close);
      i = end < 0 ? html.length : end + 1;
      pendingBreak = true;
      continue;
    }

    if (skipsText(name) && name !== "template") {
      const endTag = new RegExp(`</${name}`, "giu");
      endTag.lastIndex = i;
      const close = endTag.exec(html)?.index ?? -1;
      const content = html.slice(i, close < 0 ? html.length : close);
      const type = attributes.type ?? "";
      if (name === "script" && type === "application/ld+json") parseJsonInto(content, result.hidden);
      else if (name === "script" && type === "application/json") parseJsonInto(content, result.scripted);
      else if (name !== "script" && name !== "style") result.hidden.push(htmlText(content).trim());
      const end = close < 0 ? html.length : html.indexOf(">", close);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    if (name === "template" && !selfClosing) templateDepth += 1;
  }
  return result;
}
