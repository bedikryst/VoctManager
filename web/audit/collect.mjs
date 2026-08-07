// @ts-check
/**
 * @file collect.mjs
 * @description Reading layer for the register audit: it turns the finished build into two
 *  indexes the checks can ask questions of — every emitted CSS rule (selector parsed into
 *  compounds, specificity computed, declarations flattened) and every element that wears a
 *  register class, with its ancestor chain.
 *
 *  It reads `dist/`, not `src/`, and that is the whole point. Astro scopes a page's styles by
 *  appending `[data-astro-cid-…]` to EVERY compound, so a two-class page rule is emitted at
 *  (0,4,0) and silently outranks `html.voct-motion .reveal` at (0,2,1). None of that is visible
 *  in the source; the specificity a register actually competes against exists only in the bundle.
 *
 *  Two deliberate imprecisions, both chosen to fail toward silence rather than toward noise:
 *  sibling combinators are treated as satisfiable (the element scanner keeps no sibling order),
 *  and a class the runtime adds — `voct-motion`, `is-in`, `vt-nav`, `menu-open` — is treated as
 *  present, because the static artifact never carries it and every register rule is gated on one.
 * @architecture Astro islands 2026
 * @module audit/collect
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import postcss from "postcss";

/** The register vocabulary, as `scripts/reveal.ts` defines it. `.ink-press` is the ink's second
 *  dimension rather than a register of its own, but it collides the same way, so it is indexed
 *  with them. */
export const REGISTER_CLASSES = Object.freeze([
  "reveal",
  "reveal-rule",
  "reveal-rule-v",
  "reveal-light",
  "reveal-cue",
  "ink-press",
]);

/** Classes only ever present at runtime: JS gates (`html.voct-motion`, `html.vt-nav`), trigger
 *  and release states, and island visibility. A selector asking for one is satisfiable — the
 *  static HTML cannot show it, and refusing to match would blind every check to the exact rules
 *  that matter. */
const RUNTIME_CLASS = /^(is-|has-|js-)|^(voct-motion|vt-nav|reveal-ready|preloader-skip|rite-brief|menu-open|audio-on|no-motion)$/;

/** Attributes written by JS after paint. An attribute selector naming one is satisfiable for the
 *  same reason; anything else must be present on the element or the selector does not match. */
const RUNTIME_ATTR = /^(data-lumen|data-rite|data-reveal|data-open|data-state|aria-|hidden$)/;

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/* ── selector parsing ────────────────────────────────────────────────────────── */

/**
 * Split on top-level occurrences of any separator character, ignoring anything nested in
 * brackets or quotes. `:is(.a, .b)` must survive a comma split; `[href="a b"]` a space split.
 * @param {string} input
 * @param {string} separators
 * @returns {{ text: string, separator: string }[]}
 */
export function splitTopLevel(input, separators) {
  /** @type {{ text: string, separator: string }[]} */
  const parts = [];
  let depth = 0;
  let quote = "";
  let buffer = "";
  let pendingSeparator = "";

  for (const char of input) {
    if (quote) {
      buffer += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;

    if (depth === 0 && separators.includes(char)) {
      parts.push({ text: buffer, separator: pendingSeparator });
      pendingSeparator = char;
      buffer = "";
      continue;
    }
    buffer += char;
  }
  parts.push({ text: buffer, separator: pendingSeparator });
  return parts.filter((part) => part.text.trim() !== "" || part.separator !== "");
}

/**
 * Parse one compound (`li.rep-row:hover`) into the pieces the matcher compares.
 * @param {string} text
 */
function parseCompound(text) {
  const compound = {
    tag: /** @type {string | null} */ (null),
    universal: false,
    ids: /** @type {string[]} */ ([]),
    classes: /** @type {string[]} */ ([]),
    attrs: /** @type {{ name: string, op: string, value: string }[]} */ ([]),
    pseudoClasses: /** @type {{ name: string, args: string }[]} */ ([]),
    pseudoElements: /** @type {string[]} */ ([]),
  };

  let index = 0;
  while (index < text.length) {
    const char = text[index];

    if (char === "*") {
      compound.universal = true;
      index += 1;
      continue;
    }
    if (char === "[") {
      let depth = 0;
      let end = index;
      for (; end < text.length; end++) {
        if (text[end] === "[") depth += 1;
        if (text[end] === "]") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      const body = text.slice(index + 1, end);
      const match = /^\s*([^\s~^|$*=]+)\s*(?:([~^|$*]?=)\s*(.*?))?\s*(?:[iIsS])?\s*$/.exec(body);
      if (match) {
        compound.attrs.push({
          name: match[1],
          op: match[2] ?? "",
          value: (match[3] ?? "").replace(/^["']|["']$/g, ""),
        });
      }
      index = end + 1;
      continue;
    }
    if (char === ":") {
      const isElement = text[index + 1] === ":";
      let cursor = index + (isElement ? 2 : 1);
      let name = "";
      while (cursor < text.length && /[\w-]/.test(text[cursor])) {
        name += text[cursor];
        cursor += 1;
      }
      let args = "";
      if (text[cursor] === "(") {
        let depth = 0;
        let end = cursor;
        for (; end < text.length; end++) {
          if (text[end] === "(") depth += 1;
          if (text[end] === ")") {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        args = text.slice(cursor + 1, end);
        cursor = end + 1;
      }
      // `:before` / `:after` in their one-colon legacy form is what a minifier emits.
      if (isElement || name === "before" || name === "after") compound.pseudoElements.push(name);
      else compound.pseudoClasses.push({ name, args });
      index = cursor;
      continue;
    }
    if (char === "." || char === "#") {
      let cursor = index + 1;
      let name = "";
      while (cursor < text.length && /[\w-]|\\/.test(text[cursor])) {
        name += text[cursor];
        cursor += 1;
      }
      if (char === ".") compound.classes.push(name);
      else compound.ids.push(name);
      index = cursor;
      continue;
    }
    if (/[\w-]/.test(char)) {
      let cursor = index;
      let name = "";
      while (cursor < text.length && /[\w-]/.test(text[cursor])) {
        name += text[cursor];
        cursor += 1;
      }
      compound.tag = name.toLowerCase();
      index = cursor;
      continue;
    }
    index += 1;
  }
  return compound;
}

/** @typedef {ReturnType<typeof parseCompound>} Compound */

/**
 * Parse a single (comma-free) selector into compounds, root-first, each carrying the combinator
 * that joins it to the compound on its left.
 * @param {string} selector
 */
export function parseSelector(selector) {
  const normalized = selector.replace(/\s+/g, " ").trim();
  const segments = splitTopLevel(normalized, " >+~");

  /** @type {{ combinator: string, compound: Compound, text: string }[]} */
  const compounds = [];
  let pendingCombinator = "";

  for (const segment of segments) {
    const text = segment.text.trim();
    if (segment.separator && segment.separator !== " ") pendingCombinator = segment.separator;
    else if (segment.separator === " " && pendingCombinator === "") pendingCombinator = " ";
    if (text === "") continue;
    compounds.push({
      combinator: compounds.length === 0 ? "" : pendingCombinator || " ",
      compound: parseCompound(text),
      text,
    });
    pendingCombinator = "";
  }
  return { selector: normalized, compounds };
}

/**
 * CSS specificity as [ids, classes, types]. `:is()`/`:not()`/`:has()` contribute their most
 * specific argument, `:where()` contributes nothing — the two rules that decide most of the
 * contests on this site, because `registers.css` leans on `:is()` throughout.
 * @param {string} selector
 * @returns {[number, number, number]}
 */
export function specificity(selector) {
  const alternatives = splitTopLevel(selector, ",").map((part) => part.text.trim()).filter(Boolean);
  if (alternatives.length > 1) {
    return alternatives
      .map((alternative) => specificity(alternative))
      .reduce((best, candidate) => (compareSpecificity(candidate, best) > 0 ? candidate : best));
  }

  /** @type {[number, number, number]} */
  const total = [0, 0, 0];
  for (const { compound } of parseSelector(selector).compounds) {
    total[0] += compound.ids.length;
    total[1] += compound.classes.length + compound.attrs.length;
    total[2] += (compound.tag ? 1 : 0) + compound.pseudoElements.length;

    for (const pseudo of compound.pseudoClasses) {
      if (pseudo.name === "where") continue;
      if (["is", "not", "has", "matches", "any"].includes(pseudo.name)) {
        if (!pseudo.args.trim()) continue;
        const inner = specificity(pseudo.args);
        total[0] += inner[0];
        total[1] += inner[1];
        total[2] += inner[2];
        continue;
      }
      if (pseudo.name === "nth-child" || pseudo.name === "nth-last-child") {
        total[1] += 1;
        const ofClause = /\bof\b(.+)$/s.exec(pseudo.args);
        if (ofClause) {
          const inner = specificity(ofClause[1]);
          total[0] += inner[0];
          total[1] += inner[1];
          total[2] += inner[2];
        }
        continue;
      }
      total[1] += 1;
    }
  }
  return total;
}

/**
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @returns {number} >0 when `a` wins
 */
export function compareSpecificity(a, b) {
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

/** @param {[number, number, number]} value */
export const formatSpecificity = (value) => `(${value.join(",")})`;

/* ── matching ────────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} ElementRecord
 * @property {string} tag
 * @property {Set<string>} classes
 * @property {Map<string, string>} attrs
 * @property {number} parent  Index into the page's element array; -1 for the root.
 * @property {number} line
 */

/**
 * @param {ElementRecord} element
 * @param {Compound} compound
 */
function compoundMatches(element, compound) {
  if (compound.tag && compound.tag !== element.tag) return false;
  if (compound.ids.length && compound.ids.some((id) => element.attrs.get("id") !== id)) return false;

  for (const className of compound.classes) {
    if (RUNTIME_CLASS.test(className)) continue;
    if (!element.classes.has(className)) return false;
  }

  for (const attr of compound.attrs) {
    if (!element.attrs.has(attr.name)) {
      if (RUNTIME_ATTR.test(attr.name)) continue;
      return false;
    }
    if (!attr.op) continue;
    const actual = element.attrs.get(attr.name) ?? "";
    if (attr.op === "=" && actual !== attr.value) return false;
    if (attr.op === "~=" && !actual.split(/\s+/).includes(attr.value)) return false;
    if (attr.op === "^=" && !actual.startsWith(attr.value)) return false;
    if (attr.op === "$=" && !actual.endsWith(attr.value)) return false;
    if (attr.op === "*=" && !actual.includes(attr.value)) return false;
  }

  for (const pseudo of compound.pseudoClasses) {
    if (pseudo.name === "not" && pseudo.args.trim()) {
      const negated = splitTopLevel(pseudo.args, ",").map((part) => part.text.trim()).filter(Boolean);
      // A runtime class inside `:not()` is the register's own hidden state (`:not(.is-in)`), which
      // the static element genuinely satisfies — so only a static class can reject the match.
      if (negated.some((inner) => {
        const parsed = parseSelector(inner).compounds;
        if (parsed.length !== 1) return false;
        const only = parsed[0].compound;
        if (only.classes.some((name) => RUNTIME_CLASS.test(name))) return false;
        return compoundMatches(element, only);
      })) return false;
    }
    if (pseudo.name === "is" || pseudo.name === "where" || pseudo.name === "matches") {
      const alternatives = splitTopLevel(pseudo.args, ",").map((part) => part.text.trim()).filter(Boolean);
      if (alternatives.length && !alternatives.some((inner) => {
        const parsed = parseSelector(inner).compounds;
        return parsed.length === 1 && compoundMatches(element, parsed[0].compound);
      })) return false;
    }
  }
  return true;
}

/**
 * Walk a parsed selector right-to-left over the element's ancestor chain, with backtracking on
 * descendant combinators. Sibling combinators are accepted without proof — see the file header.
 * @param {ElementRecord[]} page
 * @param {number} index
 * @param {ReturnType<typeof parseSelector>["compounds"]} compounds
 */
export function selectorMatches(page, index, compounds) {
  /**
   * @param {number} elementIndex
   * @param {number} compoundIndex
   * @returns {boolean}
   */
  const walk = (elementIndex, compoundIndex) => {
    if (compoundIndex < 0) return true;
    if (elementIndex < 0) return false;
    const step = compounds[compoundIndex];
    const element = page[elementIndex];

    if (step.combinator === "+" || step.combinator === "~") {
      return compoundMatches(element, step.compound) && walk(element.parent, compoundIndex - 1);
    }
    if (!compoundMatches(element, step.compound)) {
      // Only a descendant combinator may skip an ancestor; `>` and the key compound may not.
      return compoundIndex < compounds.length - 1 && compounds[compoundIndex + 1].combinator === " "
        ? walk(element.parent, compoundIndex)
        : false;
    }
    if (compoundIndex === 0) return true;
    return walk(element.parent, compoundIndex - 1);
  };

  return walk(index, compounds.length - 1);
}

/* ── CSS collection ──────────────────────────────────────────────────────────── */

/**
 * @typedef {object} CssRule
 * @property {string} file
 * @property {string} selector           One comma-free alternative.
 * @property {ReturnType<typeof parseSelector>["compounds"]} compounds
 * @property {[number, number, number]} specificity
 * @property {Map<string, string>} declarations  Last declaration per property wins.
 * @property {string[]} atRules          Enclosing at-rule prelude chain, outermost first.
 * @property {number} line
 */

/**
 * @param {string} dir
 * @param {string} extension
 * @returns {Promise<string[]>}
 */
async function walkFiles(dir, extension) {
  /** @type {string[]} */
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walkFiles(full, extension)));
    else if (entry.name.endsWith(extension)) found.push(full);
  }
  return found;
}

/**
 * Flatten one stylesheet into rules, one per comma-separated alternative. Keyframe blocks are
 * dropped: their "selectors" are percentages and would only ever match nothing.
 * @param {string} css
 * @param {string} label  What the findings should call this sheet.
 * @returns {CssRule[]}
 */
export function rulesFromCss(css, label) {
  /** @type {CssRule[]} */
  const rules = [];
  /** @type {import("postcss").Root} */
  let parsed;
  try {
    parsed = postcss.parse(css, { from: label });
  } catch {
    return rules;
  }

  parsed.walkRules((rule) => {
    /** @type {string[]} */
    const atRules = [];
    let parent = rule.parent;
    while (parent && parent.type === "atrule") {
      const atRule = /** @type {import("postcss").AtRule} */ (parent);
      if (atRule.name === "keyframes" || atRule.name === "property") return;
      atRules.unshift(`@${atRule.name} ${atRule.params}`.trim());
      parent = atRule.parent;
    }

    /** @type {Map<string, string>} */
    const declarations = new Map();
    rule.each((node) => {
      if (node.type === "decl") declarations.set(node.prop.toLowerCase(), node.value.trim());
    });
    if (declarations.size === 0) return;

    for (const part of splitTopLevel(rule.selector, ",")) {
      const selector = part.text.trim();
      if (!selector) continue;
      rules.push({
        file: label,
        selector,
        compounds: parseSelector(selector).compounds,
        specificity: specificity(selector),
        declarations,
        atRules,
        line: rule.source?.start?.line ?? 0,
      });
    }
  });
  return rules;
}

/**
 * Flatten every stylesheet under `dir` into one rule index.
 * @param {string} dir
 * @param {string} root  Path the reported `file` is relative to.
 * @returns {Promise<CssRule[]>}
 */
export async function collectCss(dir, root) {
  const files = await walkFiles(dir, ".css");
  /** @type {CssRule[]} */
  const rules = [];
  for (const file of files) {
    const css = await readFile(file, "utf8");
    rules.push(...rulesFromCss(css, path.relative(root, file).replace(/\\/g, "/")));
  }
  return rules;
}

/**
 * `@property` blocks, indexed by name so a second registration of one name is visible.
 * @param {string} dir
 * @param {string} root
 */
export async function collectRegisteredProperties(dir, root) {
  const files = await walkFiles(dir, ".css");
  /** @type {Map<string, { file: string, line: number, descriptors: Map<string, string> }[]>} */
  const registrations = new Map();

  for (const file of files) {
    const css = await readFile(file, "utf8");
    let parsed;
    try {
      parsed = postcss.parse(css, { from: file });
    } catch {
      continue;
    }
    parsed.walkAtRules("property", (atRule) => {
      const name = atRule.params.trim();
      /** @type {Map<string, string>} */
      const descriptors = new Map();
      atRule.each((node) => {
        if (node.type === "decl") descriptors.set(node.prop.toLowerCase(), node.value.trim());
      });
      const entry = {
        file: path.relative(root, file).replace(/\\/g, "/"),
        line: atRule.source?.start?.line ?? 0,
        descriptors,
      };
      const existing = registrations.get(name);
      if (existing) existing.push(entry);
      else registrations.set(name, [entry]);
    });
  }
  return registrations;
}

/**
 * Every comment in every stylesheet, kept with its position so a swallowed rule can be pointed at.
 * @param {string} dir
 * @param {string} root
 */
export async function collectComments(dir, root) {
  const files = await walkFiles(dir, ".css");
  /** @type {{ file: string, line: number, text: string }[]} */
  const comments = [];

  for (const file of files) {
    const css = await readFile(file, "utf8");
    let parsed;
    try {
      parsed = postcss.parse(css, { from: file });
    } catch {
      continue;
    }
    parsed.walkComments((comment) => {
      comments.push({
        file: path.relative(root, file).replace(/\\/g, "/"),
        line: comment.source?.start?.line ?? 0,
        text: comment.text,
      });
    });
  }
  return comments;
}

/* ── HTML collection ─────────────────────────────────────────────────────────── */

const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTR_PATTERN = /([a-zA-Z_:@][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/**
 * Scan one built page into a flat element array with parent links. A full DOM is not needed —
 * the matcher only ever asks for a tag, its classes, its attributes and its ancestors — and not
 * building one keeps the audit free of a parser dependency.
 * @param {string} html
 * @returns {ElementRecord[]}
 */
export function scanHtml(html) {
  /** @type {ElementRecord[]} */
  const elements = [];
  /** @type {number[]} */
  const stack = [];

  // Script and style bodies are text, and a `<` inside them is not a tag. Blanking them keeps
  // the stack honest without teaching the scanner to tokenize JS.
  const source = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) =>
    match.replace(/[^\n]/g, " "));

  let lastIndex = 0;
  let line = 1;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(source)) !== null) {
    for (let index = lastIndex; index < match.index; index++) {
      if (source[index] === "\n") line += 1;
    }
    lastIndex = match.index;

    const [, closing, rawTag, rawAttrs] = match;
    const tag = rawTag.toLowerCase();

    if (closing) {
      for (let depth = stack.length - 1; depth >= 0; depth--) {
        if (elements[stack[depth]].tag === tag) {
          stack.length = depth;
          break;
        }
      }
      continue;
    }

    /** @type {Map<string, string>} */
    const attrs = new Map();
    ATTR_PATTERN.lastIndex = 0;
    let attrMatch;
    while ((attrMatch = ATTR_PATTERN.exec(rawAttrs)) !== null) {
      const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
      attrs.set(attrMatch[1].toLowerCase(), value);
    }

    const classes = new Set((attrs.get("class") ?? "").split(/\s+/).filter(Boolean));
    elements.push({
      tag,
      classes,
      attrs,
      parent: stack.length ? stack[stack.length - 1] : -1,
      line,
    });

    const selfClosing = rawAttrs.trimEnd().endsWith("/");
    if (!VOID_TAGS.has(tag) && !selfClosing) stack.push(elements.length - 1);
  }
  return elements;
}

/**
 * @param {string} dir
 * @param {string} root
 * @returns {Promise<{ page: string, elements: ElementRecord[] }[]>}
 */
export async function collectPages(dir, root) {
  const files = await walkFiles(dir, ".html");
  const pages = [];
  for (const file of files) {
    const html = await readFile(file, "utf8");
    pages.push({
      page: path.relative(root, file).replace(/\\/g, "/"),
      elements: scanHtml(html),
    });
  }
  return pages;
}

/** @param {ElementRecord} element */
export function describeElement(element) {
  const classes = [...element.classes].filter((name) => !RUNTIME_CLASS.test(name));
  return `<${element.tag}${classes.length ? `.${classes.join(".")}` : ""}>`;
}

/** @param {ElementRecord} element */
export function registersOn(element) {
  return REGISTER_CLASSES.filter((name) => element.classes.has(name));
}
