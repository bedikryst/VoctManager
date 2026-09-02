// @ts-check
/**
 * @file yamlEdit.mjs
 * @description Replace a scalar inside `concerts.yaml` without the file ever meeting a serializer.
 *  This is the one operation in the copy desk that can destroy the corpus, and §8's overlay decision
 *  exists to keep it to exactly this shape: a value is REPLACED IN PLACE. Nothing here inserts a
 *  key, opens a flow map, indents a block under a new locale or removes a line.
 *
 *  WHY NOT A ROUND TRIP. `concerts.yaml` carries ~150 comment lines that record decisions nothing
 *  else does — the veil depth per station, the crop a hero is tuned to, the consent scope on the
 *  roster. A parse-and-dump deletes every one of them and the build stays green (§7). So the
 *  document is parsed only to LOCATE — the CST hands back the exact byte range of each scalar — and
 *  the write is a splice into the original text.
 *
 *  FOUR PROOFS, and they are the reason to trust the splice rather than the emitter:
 *
 *  1. **Pre-image.** Before a byte is touched, the scalar already there must equal the value the
 *     caller says is there — the desk's mirror of git. A mismatch means the file moved under the
 *     desk (a hand edit, an un-synced tree), and overwriting it would silently discard somebody's
 *     work. Value-level, not byte-level: the folded blocks in this corpus are hand-wrapped at
 *     deliberate points, so no emitter reproduces their bytes, and claiming otherwise would mean
 *     re-wrapping every paragraph it touched.
 *  2. **In situ.** Each candidate rendering is spliced into the real document and PARSED THERE, and
 *     is only kept if the value comes back exactly. Indentation, style and quoting are therefore
 *     never argued about — they are tried. The candidate order preserves the field's existing style
 *     where it can express the new value, so a diff shows the sentence that changed and not a
 *     reflowed block.
 *  3. **Reconstruction.** With every span reverted to the bytes it replaced, the result must be the
 *     original file byte for byte. This is stage A's rule and it is what proves nothing else moved.
 *  4. **Survey.** The rewritten document is walked beside the original: every scalar the caller did
 *     not name must be unchanged, and the comment lines must be identical.
 *
 *  The file is CRLF on a Windows checkout, so the line ending is read from the text and restored on
 *  write — a script that assumes `\n` here matches nothing and reports a clean run over no changes.
 * @architecture Astro islands 2026
 * @module copydesk/yamlEdit
 */

import YAML from "yaml";

/** Where a folded block is re-wrapped, indent included. The corpus sits at 92–109. */
const FOLD_WIDTH = 100;

/**
 * @typedef {object} ScalarEdit
 * @property {(string|number)[]} path Absolute path in the document (concert index first).
 * @property {string} expected The value the caller believes is there — the pre-image.
 * @property {string} value The value to write.
 * @property {string} [label] What to call this edit in an error.
 */

/**
 * @typedef {object} ScalarChange
 * @property {(string|number)[]} path
 * @property {string} label
 * @property {string} style The YAML style the new value was written in.
 * @property {string} before The exact bytes that were replaced.
 * @property {string} after The exact bytes written.
 * @property {[number, number]} span Offsets into the ORIGINAL text.
 */

/**
 * The line ending the file already uses. A mixed file is treated as CRLF, which is this one.
 *
 * @param {string} text
 * @returns {string}
 */
export function detectEol(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Comment lines, in order — the thing a parse-and-dump silently deletes.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function commentLines(text) {
  return text.split(/\r?\n/u).filter((line) => /^\s*#/u.test(line));
}

/**
 * Every leaf of a parsed corpus, keyed by its path. The survey's two sides.
 *
 * Walked over the plain JavaScript the document parses to rather than over the CST, because the
 * question being asked is the reader's — does this field still say what it said — and a node's
 * style, anchors and comments are no part of it.
 *
 * @param {unknown} value
 * @param {(string|number)[]} [prefix]
 * @param {Map<string, unknown>} [into]
 * @returns {Map<string, unknown>}
 */
export function collectScalars(value, prefix = [], into = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectScalars(item, [...prefix, index], into));
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) collectScalars(item, [...prefix, key], into);
  } else {
    into.set(prefix.join(" "), value);
  }
  return into;
}

/**
 * The indentation of the line `offset` sits on, and where that line starts.
 *
 * @param {string} text
 * @param {number} offset
 */
function lineAt(text, offset) {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  const indent = /^[ \t]*/u.exec(text.slice(start, offset))?.[0].length ?? 0;
  return { start, indent };
}

/**
 * A double-quoted scalar. Non-ASCII stays literal — the file is UTF-8 Polish prose and escaping it
 * would make every edited line unreadable — but the three characters YAML reads as line breaks
 * escape, because a literal one would silently split the scalar.
 *
 * @param {string} value
 * @returns {string}
 */
export function doubleQuoted(value) {
  let out = '"';
  for (const ch of value) {
    const code = /** @type {number} */ (ch.codePointAt(0));
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (code === 0x85) out += "\\N"; // NEL
    else if (code === 0x2028) out += "\\L"; // LINE SEPARATOR
    else if (code === 0x2029) out += "\\P"; // PARAGRAPH SEPARATOR
    else if (code < 0x20 || code === 0x7f) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return `${out}"`;
}

/**
 * A single-quoted scalar; the only escape the style has is a doubled quote.
 *
 * @param {string} value
 * @returns {string}
 */
function singleQuoted(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * A literal block (`|-`). Every line break in the value survives as one, which is what the
 * transcriptions in this corpus need.
 *
 * A line that BEGINS with whitespace cannot be told from the block's own indentation, so the
 * header carries an explicit indentation indicator in that case — the alternative is a 2 000
 * character double-quoted line where a transcript used to be.
 *
 * @param {string} value
 * @param {{indent: number, parentIndent: number, eol: string}} ctx
 */
export function literalBlock(value, { indent, parentIndent, eol }) {
  const lines = value.split("\n");
  const indicator = /^[ \t]/u.test(lines[0]) ? String(indent - parentIndent) : "";
  const pad = " ".repeat(indent);
  const body = lines.map((line) => (line.length ? pad + line : "")).join(eol);
  return `|${indicator}-${eol}${body}`;
}

/**
 * A folded block (`>-`), re-wrapped the way the corpus is wrapped: paragraphs greedily filled to
 * ~100 columns, blank line between them.
 *
 * Returns null where folding cannot express the value at all — a SINGLE newline inside a paragraph
 * folds to a space, so a value carrying one has to be written literally instead. A line beginning
 * with whitespace is refused for the same reason it is in a literal block, except that here the
 * fallback is the right answer rather than a workaround.
 *
 * @param {string} value
 * @param {{indent: number, eol: string}} ctx
 * @returns {string|null}
 */
function foldedBlock(value, { indent, eol }) {
  const paragraphs = value.split("\n\n");
  if (paragraphs.some((p) => p.includes("\n"))) return null;
  if (/(^|\n)[ \t]/u.test(value)) return null;

  const pad = " ".repeat(indent);
  const wrapped = paragraphs.map((paragraph) => {
    /** @type {string[]} */
    const lines = [];
    let line = "";
    for (const word of paragraph.split(" ").filter(Boolean)) {
      if (!line) line = word;
      else if (`${pad}${line} ${word}`.length <= FOLD_WIDTH) line += ` ${word}`;
      else {
        lines.push(pad + line);
        line = word;
      }
    }
    if (line) lines.push(pad + line);
    return lines.join(eol);
  });
  return `>-${eol}${wrapped.join(`${eol}${eol}`)}`;
}

/**
 * Renderings to try, best first. "Best" means the style the field already has, because a diff that
 * also restyles a paragraph hides the sentence that changed inside it.
 *
 * @param {string} value
 * @param {{style: string, indent: number, parentIndent: number, eol: string}} ctx
 * @returns {{style: string, text: string}[]}
 */
function candidates(value, ctx) {
  const multiline = value.includes("\n");
  /** @type {{style: string, text: string|null}[]} */
  const ordered = [];

  if (ctx.style === "BLOCK_FOLDED") {
    ordered.push({ style: "BLOCK_FOLDED", text: foldedBlock(value, ctx) });
    ordered.push({ style: "BLOCK_LITERAL", text: literalBlock(value, ctx) });
  } else if (ctx.style === "BLOCK_LITERAL") {
    ordered.push({ style: "BLOCK_LITERAL", text: literalBlock(value, ctx) });
  } else if (!multiline) {
    if (ctx.style === "PLAIN") ordered.push({ style: "PLAIN", text: value });
    if (ctx.style === "QUOTE_SINGLE") ordered.push({ style: "QUOTE_SINGLE", text: singleQuoted(value) });
  } else {
    // A one-line field that has become a paragraph: a block is the only readable answer.
    ordered.push({ style: "BLOCK_LITERAL", text: literalBlock(value, ctx) });
  }

  ordered.push({ style: "QUOTE_DOUBLE", text: multiline ? null : doubleQuoted(value) });
  return /** @type {{style: string, text: string}[]} */ (ordered.filter((c) => c.text !== null));
}

/**
 * Locate a scalar and describe the span its source occupies.
 *
 * The trailing line break of a block scalar belongs to the block's range but not to the write: the
 * next line starts there, and taking it would fuse two fields together.
 *
 * @param {string} text
 * @param {any} doc
 * @param {(string|number)[]} path
 */
function locate(text, doc, path) {
  const node = doc.getIn(path, true);
  if (!YAML.isScalar(node)) {
    throw new Error(`[copydesk] ${path.join(".")}: not a scalar in the document.`);
  }
  if (!node.range) throw new Error(`[copydesk] ${path.join(".")}: no source range to write into.`);
  const [start] = node.range;
  let end = node.range[1];
  while (end > start && (text[end - 1] === "\n" || text[end - 1] === "\r")) end -= 1;

  const line = lineAt(text, start);
  const style = String(node.type ?? "PLAIN");
  let indent = line.indent + 2;
  if (style === "BLOCK_FOLDED" || style === "BLOCK_LITERAL") {
    const firstBreak = text.indexOf("\n", start);
    const measured = /^[ \t]*/u.exec(text.slice(firstBreak + 1, end))?.[0].length ?? 0;
    if (measured > 0) indent = measured;
  }
  return { node, start, end, style, indent, parentIndent: line.indent };
}

/**
 * Replace scalars in place, or throw having written nothing.
 *
 * @param {string} raw The whole file.
 * @param {ScalarEdit[]} edits
 * @returns {{text: string, changes: ScalarChange[]}}
 */
export function replaceScalars(raw, edits) {
  const eol = detectEol(raw);
  const doc = YAML.parseDocument(raw);
  if (doc.errors.length) {
    throw new Error(`[copydesk] the corpus does not parse: ${doc.errors[0].message}`);
  }

  /** @type {ScalarChange[]} */
  const changes = [];
  const claimed = new Set();

  for (const edit of edits) {
    const label = edit.label ?? edit.path.join(".");
    if (edit.value.length === 0) {
      throw new Error(
        `[copydesk] ${label}: an empty value would delete the field rather than change it. ` +
          "Reject the proposal instead.",
      );
    }
    const at = edit.path.join(" ");
    if (claimed.has(at)) throw new Error(`[copydesk] ${label}: two edits address one scalar.`);
    claimed.add(at);

    const { node, start, end, style, indent, parentIndent } = locate(raw, doc, edit.path);

    // Proof 1 — the pre-image. Value-level: the hand-wrapped folded blocks in this corpus have no
    // byte-level emitter, so the claim being made is "the string I am about to destroy is the
    // string the desk says is there", which is the one that catches an un-synced tree.
    if (node.value !== edit.expected) {
      throw new Error(
        `[copydesk] ${label}: the file does not hold the value the desk recorded.\n` +
          `  in the file: ${JSON.stringify(String(node.value).slice(0, 120))}\n` +
          `  on the desk: ${JSON.stringify(edit.expected.slice(0, 120))}\n` +
          "  Run `npm run copy:sync` and review the patch again — applying now would " +
          "overwrite an edit nobody proposed.",
      );
    }
    if (edit.value === edit.expected) continue;

    // Proof 2 — in situ. Every rendering is spliced into the real document and parsed there.
    const tried = [];
    let written = null;
    for (const candidate of candidates(edit.value, { style, indent, parentIndent, eol })) {
      const probe = raw.slice(0, start) + candidate.text + raw.slice(end);
      const parsed = YAML.parseDocument(probe);
      if (!parsed.errors.length && parsed.getIn(edit.path) === edit.value) {
        written = candidate;
        break;
      }
      tried.push(candidate.style);
    }
    if (written === null) {
      throw new Error(
        `[copydesk] ${label}: no rendering of this value survives a re-parse (tried ${tried.join(", ")}).`,
      );
    }

    changes.push({
      path: edit.path,
      label,
      style: written.style,
      before: raw.slice(start, end),
      after: written.text,
      span: [start, end],
    });
  }

  // Spliced back to front so that an earlier span's offsets stay valid.
  let text = raw;
  for (const change of [...changes].sort((a, b) => b.span[0] - a.span[0])) {
    text = text.slice(0, change.span[0]) + change.after + text.slice(change.span[1]);
  }

  verify(raw, text, changes);
  return { text, changes };
}

/**
 * Proofs 3 and 4, run over the finished text before anything reaches the disk.
 *
 * @param {string} raw
 * @param {string} text
 * @param {ScalarChange[]} changes
 */
export function verify(raw, text, changes) {
  // Proof 3 — reconstruction. Put every replaced span back and the original must return, byte for
  // byte. Nothing but these spans can have moved, comments included.
  // Left to right, and no running offset: reverting a span restores its original length, so every
  // span still to the right is already back at the coordinates it had in the original file.
  let reverted = text;
  for (const change of [...changes].sort((a, b) => a.span[0] - b.span[0])) {
    const [start] = change.span;
    reverted = reverted.slice(0, start) + change.before + reverted.slice(start + change.after.length);
  }
  if (reverted !== raw) {
    throw new Error("[copydesk] the edits do not reconstruct the original file. Nothing written.");
  }

  // Proof 4 — the survey. Read as documents this time: every scalar the edits did not name must
  // still say what it said, and the comments must be identical.
  const before = collectScalars(YAML.parse(raw));
  const after = collectScalars(YAML.parse(text));
  const edited = new Set(changes.map((change) => change.path.join(" ")));

  if (before.size !== after.size) {
    throw new Error(
      `[copydesk] the rewrite changed the number of scalars (${before.size} → ${after.size}).`,
    );
  }
  for (const [at, value] of before) {
    if (edited.has(at)) continue;
    if (!after.has(at)) throw new Error(`[copydesk] ${at.replaceAll(" ", ".")} disappeared.`);
    if (after.get(at) !== value) {
      throw new Error(`[copydesk] ${at.replaceAll(" ", ".")} changed and nobody asked it to.`);
    }
  }

  const commentsBefore = commentLines(raw);
  const commentsAfter = commentLines(text);
  if (commentsBefore.length !== commentsAfter.length) {
    throw new Error(
      `[copydesk] comment lines went from ${commentsBefore.length} to ${commentsAfter.length}. ` +
        "That is the signature of a parse-and-dump.",
    );
  }
  for (let i = 0; i < commentsBefore.length; i += 1) {
    if (commentsBefore[i] !== commentsAfter[i]) {
      throw new Error(`[copydesk] a comment line changed: ${commentsBefore[i].trim()}`);
    }
  }
}
