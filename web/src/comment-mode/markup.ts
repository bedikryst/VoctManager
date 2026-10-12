/**
 * @file markup.ts
 * @description The markup editor's document: the ProseMirror schema, the parser and serializer
 *  between a field's stored value and that document, and what the view's controls and paste do to
 *  it (the link commands, `pastedSlice`). DOM-free; `richField.ts` is the view, and only its chunk
 *  imports this module.
 *
 *  THE SCHEMA IS THE SANITIZER'S WHITELIST (`backend/copydesk/sanitizers.py`): marks `em` and
 *  `strong` (`lang`), `a` (`href`, `lang`) and `code` in an `HTML` field; only the braces link in a
 *  `TEXT` field; `slot`, an inline atom for a build-time `{name}`, in both. One textblock holds the
 *  whole value with `\n` as a character, so `\n` and `\n\n` come back as they went in.
 *
 *  LOAD AND SAVE ARE OURS, NOT THE BROWSER'S. The parser reads exactly the form the sanitizer
 *  writes: text escaping `& < >` and nothing else, the four tags with double-quoted attributes in
 *  the whitelist's order, no nesting of a tag in itself. The serializer writes the same form, which
 *  `innerHTML` does not (it turns U+00A0 into `&nbsp;` and does not run in node). `loadValue` keeps a
 *  document only if serializing it gives the value back, so the editor never rewrites what nobody
 *  touched; a value it refuses opens in the textarea.
 *
 *  NESTING IS THE SERIALIZER'S CHOICE. A document records which marks each run carries, not how
 *  tags nest. Links rank outermost, so a link with an emphasized word stays one `<a>`; a mark the
 *  next run keeps stays open; marks opening together open longest-running first. Hand-nested markup
 *  the serializer would nest otherwise goes to the textarea, and the corpus holds none.
 *
 *  Plain erasable TypeScript importing only `.ts` modules by their full name, so bare `node` runs
 *  it for the tests.
 * @module comment-mode/markup
 */

import { Fragment, Mark, Schema, Slice, type Attrs, type MarkType, type Node as ProseNode } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { BRACE_PAIR, type FieldMarkup } from "./checklist.ts";

/** A `lang` the sanitizer kept, or none. */
const LANG = { default: null, validate: "string|null" } as const;

function langOf(dom: HTMLElement): Attrs {
  return { lang: dom.getAttribute("lang") };
}

/** Attributes for `toDOM`, without the ones a mark does not carry. */
function present(attrs: Attrs): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) if (typeof value === "string") out[name] = value;
  return out;
}

export const schema = new Schema<
  "doc" | "html_field" | "text_field" | "text" | "slot",
  "a" | "em" | "strong" | "code" | "braces"
>({
  nodes: {
    doc: { content: "html_field | text_field" },
    // The rules read a field copied to the clipboard back with its line breaks: a paste parses with
    // whitespace kept but `\n` turned into spaces, unless a rule asks for all of it.
    html_field: {
      content: "inline*",
      marks: "a em strong code",
      whitespace: "pre",
      toDOM: () => ["div", { "data-field": "html" }, 0],
      parseDOM: [{ tag: 'div[data-field="html"]', preserveWhitespace: "full" }],
    },
    text_field: {
      content: "inline*",
      marks: "braces",
      whitespace: "pre",
      toDOM: () => ["div", { "data-field": "text" }, 0],
      parseDOM: [{ tag: 'div[data-field="text"]', preserveWhitespace: "full" }],
    },
    text: { group: "inline" },
    slot: {
      group: "inline",
      inline: true,
      atom: true,
      attrs: { name: { validate: "string" } },
      leafText: (node) => `{${String(node.attrs["name"])}}`,
      toDOM: (node) => {
        const name = String(node.attrs["name"]);
        return ["span", { class: "slot", "data-slot": name }, `{${name}}`];
      },
      parseDOM: [{ tag: "span[data-slot]", getAttrs: (dom) => ({ name: dom.getAttribute("data-slot") ?? "" }) }],
    },
  },
  // In rank order, which is also the nesting order: the earlier mark is the outer tag.
  marks: {
    a: {
      attrs: { href: { default: null, validate: "string|null" }, lang: LANG },
      inclusive: false,
      toDOM: (mark) => ["a", present(mark.attrs), 0],
      parseDOM: [{ tag: "a", getAttrs: (dom) => ({ href: dom.getAttribute("href"), lang: dom.getAttribute("lang") }) }],
    },
    em: {
      attrs: { lang: LANG },
      toDOM: (mark) => ["em", present(mark.attrs), 0],
      parseDOM: [{ tag: "em", getAttrs: langOf }],
    },
    strong: {
      attrs: { lang: LANG },
      toDOM: (mark) => ["strong", present(mark.attrs), 0],
      parseDOM: [{ tag: "strong", getAttrs: langOf }],
    },
    code: {
      toDOM: () => ["code", 0],
      parseDOM: [{ tag: "code" }],
    },
    /** `page.press.contact.list`'s link: the page links whatever the braces hold. */
    braces: {
      inclusive: false,
      toDOM: () => ["span", { class: "as-link" }, 0],
      parseDOM: [{ tag: "span.as-link" }],
    },
  },
});

type Tag = "a" | "em" | "strong" | "code";

/** The attributes each tag may carry, in the order the serializer writes them. */
const TAG_ATTRIBUTES: Readonly<Record<Tag, readonly string[]>> = {
  a: ["href", "lang"],
  em: ["lang"],
  strong: ["lang"],
  code: [],
};

const OPEN_TAG = /<(em|strong|a|code)((?: [a-z]+="[^"<>]*")*)>/uy;
const CLOSE_TAG = /<\/(em|strong|a|code)>/uy;
const ATTRIBUTE = / ([a-z]+)="([^"<>]*)"/gu;
const TEXT_REFERENCE = /&(amp|lt|gt);/uy;
const ATTRIBUTE_REFERENCE = /&(amp|lt|gt|quot|#x27);/gu;
const BRACE_PAIRS = new RegExp(BRACE_PAIR.source, "gu");

const DECODED: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'" };

function isTag(name: string): name is Tag {
  return Object.hasOwn(TAG_ATTRIBUTES, name);
}

/** An attribute value as written by Python's `html.escape(quote=True)`, decoded; `null` if not. */
function decodeAttribute(raw: string): string | null {
  if (raw.replace(ATTRIBUTE_REFERENCE, "").includes("&")) return null;
  return raw.replace(ATTRIBUTE_REFERENCE, (_whole, name: string) => DECODED[name] ?? "");
}

/** The mark an opening tag stands for, or `null` when the sanitizer would not have written it. */
function markOf(tag: Tag, rawAttributes: string): Mark | null {
  const allowed = TAG_ATTRIBUTES[tag];
  const attrs: Record<string, string> = {};
  for (const [, name = "", raw = ""] of rawAttributes.matchAll(ATTRIBUTE)) {
    if (!allowed.includes(name) || name in attrs) return null;
    const value = decodeAttribute(raw);
    if (value === null) return null;
    attrs[name] = value;
  }
  return schema.marks[tag].create(attrs);
}

/**
 * One run of text carrying `marks`, as inline nodes: the Polish's slots become atoms, and in a
 * `TEXT` field with a braces link every other non-empty pair becomes its words under the link mark.
 * Any other brace stays text, and the serializer writes it back as it came.
 */
function runNodes(text: string, marks: readonly Mark[], markup: FieldMarkup, out: ProseNode[]): void {
  let last = 0;
  for (const match of text.matchAll(BRACE_PAIRS)) {
    const group = match[0];
    const at = match.index;
    const isSlot = markup.slots.has(group);
    const isLink = !isSlot && markup.braceLink && group.length > 2;
    if (!isSlot && !isLink) continue;
    if (at > last) out.push(schema.text(text.slice(last, at), marks));
    out.push(
      isSlot
        ? schema.nodes.slot.create({ name: group.slice(1, -1) }, null, marks)
        : schema.text(group.slice(1, -1), [...marks, schema.marks.braces.create()]),
    );
    last = at + group.length;
  }
  if (last < text.length) out.push(schema.text(text.slice(last), marks));
}

/** The inline content of an `HTML` value, or `null` where it is not in the sanitizer's form. */
function parseHtml(value: string, markup: FieldMarkup): ProseNode[] | null {
  const out: ProseNode[] = [];
  const open: { readonly tag: Tag; readonly mark: Mark }[] = [];
  let text = "";
  const flush = (): void => {
    if (text) runNodes(text, open.map((entry) => entry.mark), markup, out);
    text = "";
  };

  let at = 0;
  while (at < value.length) {
    const char = value[at];
    if (char === "<") {
      CLOSE_TAG.lastIndex = at;
      const close = CLOSE_TAG.exec(value);
      if (close) {
        if (open[open.length - 1]?.tag !== close[1]) return null;
        flush();
        open.pop();
        at = CLOSE_TAG.lastIndex;
        continue;
      }
      OPEN_TAG.lastIndex = at;
      const opening = OPEN_TAG.exec(value);
      const tag = opening?.[1] ?? "";
      if (!opening || !isTag(tag) || open.some((entry) => entry.tag === tag)) return null;
      const mark = markOf(tag, opening[2] ?? "");
      if (!mark) return null;
      flush();
      open.push({ tag, mark });
      at = OPEN_TAG.lastIndex;
      continue;
    }
    if (char === "&") {
      TEXT_REFERENCE.lastIndex = at;
      const reference = TEXT_REFERENCE.exec(value);
      if (!reference) return null;
      text += DECODED[reference[1] ?? ""] ?? "";
      at = TEXT_REFERENCE.lastIndex;
      continue;
    }
    if (char === ">") return null;
    text += char;
    at += 1;
  }
  if (open.length > 0) return null;
  flush();
  return out;
}

/**
 * A stored value as the editor's document, or `null` when the grammar refuses it. A `TEXT` value is
 * text throughout: a typed `<b>` is three characters.
 */
export function parseValue(value: string, markup: FieldMarkup): ProseNode | null {
  let inline: ProseNode[] | null;
  if (markup.html) {
    inline = parseHtml(value, markup);
  } else {
    inline = [];
    runNodes(value, [], markup, inline);
  }
  if (!inline) return null;
  try {
    const field = (markup.html ? schema.nodes.html_field : schema.nodes.text_field).createChecked(
      null,
      Fragment.fromArray(inline),
    );
    return schema.nodes.doc.createChecked(null, field);
  } catch {
    return null;
  }
}

function escapeText(text: string): string {
  return text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/gu, "&quot;").replace(/'/gu, "&#x27;");
}

function openTag(mark: Mark): string {
  const name = mark.type.name;
  if (name === "braces") return "{";
  const attributes = isTag(name)
    ? TAG_ATTRIBUTES[name]
        .map((attribute) => {
          const value: unknown = mark.attrs[attribute];
          return typeof value === "string" ? ` ${attribute}="${escapeAttribute(value)}"` : "";
        })
        .join("")
    : "";
  return `<${name}${attributes}>`;
}

function closeTag(mark: Mark): string {
  return mark.type.name === "braces" ? "}" : `</${mark.type.name}>`;
}

/** The value a document saves as, in the form the sanitizer writes. */
export function serializeValue(doc: ProseNode): string {
  const field = doc.firstChild;
  if (!field) return "";
  const html = field.type === schema.nodes.html_field;
  const inline: ProseNode[] = [];
  field.forEach((node) => inline.push(node));

  /** How many runs from `index` on carry `mark`: the longer one opens outside. */
  const reach = (mark: Mark, index: number): number => {
    let end = index;
    while (end < inline.length && mark.isInSet(inline[end]?.marks ?? [])) end += 1;
    return end - index;
  };

  let out = "";
  const open: Mark[] = [];
  const closeDownTo = (depth: number): void => {
    while (open.length > depth) {
      const closing = open.pop();
      if (closing) out += closeTag(closing);
    }
  };
  inline.forEach((node, index) => {
    let keep = 0;
    while (keep < open.length && open[keep]?.isInSet(node.marks)) keep += 1;
    closeDownTo(keep);
    const opening = node.marks
      .filter((mark) => !mark.isInSet(open))
      .sort((a, b) => reach(b, index) - reach(a, index));
    for (const mark of opening) {
      out += openTag(mark);
      open.push(mark);
    }
    if (node.isText) {
      const text = node.text ?? "";
      out += html ? escapeText(text) : text;
    } else {
      out += `{${String(node.attrs["name"])}}`;
    }
  });
  closeDownTo(0);
  return out;
}

/**
 * The document for a stored value, or `null` when the value has to open in the textarea: the
 * grammar refuses it, or the document would not save back as exactly the same string.
 */
export function loadValue(value: string, markup: FieldMarkup): ProseNode | null {
  const doc = parseValue(value, markup);
  return doc && serializeValue(doc) === value ? doc : null;
}

/** The field's link: `a` in an `HTML` field, the braces link in a `TEXT` one. */
export function linkMarkType(state: EditorState): MarkType {
  return state.doc.firstChild?.type === schema.nodes.text_field ? schema.marks.braces : schema.marks.a;
}

/**
 * The whole run carrying a mark of `type` that the caret touches, or `null`. The text after the
 * caret wins over the text before it, as a click lands in the word it is on.
 */
export function markRun(state: EditorState, type: MarkType): { readonly from: number; readonly to: number; readonly mark: Mark } | null {
  const { $from } = state.selection;
  const mark = type.isInSet($from.nodeAfter?.marks ?? []) ?? type.isInSet($from.nodeBefore?.marks ?? []);
  if (!mark) return null;
  const parent = $from.parent;
  let from = -1;
  let hit: { readonly from: number; readonly to: number } | null = null;
  for (let index = 0, at = $from.start(); index < parent.childCount; index += 1) {
    const child = parent.child(index);
    const end = at + child.nodeSize;
    if (mark.isInSet(child.marks)) {
      if (from < 0) from = at;
      if (from <= $from.pos && $from.pos <= end) hit = { from, to: end };
    } else {
      from = -1;
    }
    at = end;
  }
  return hit ? { ...hit, mark } : null;
}

/**
 * The field's link over the selection, or over the whole link the caret stands in, which then
 * changes its target and keeps its `lang`. `href` is ignored by the braces link. Does not apply
 * with nothing selected outside a link.
 */
export function setLink(href: string): Command {
  return (state, dispatch) => {
    const type = linkMarkType(state);
    const { from, to, empty } = state.selection;
    const run = empty ? markRun(state, type) : null;
    const range = empty ? run : { from, to };
    if (!range) return false;
    const lang: unknown = run?.mark.attrs["lang"];
    const mark = type === schema.marks.a ? type.create({ href, lang: typeof lang === "string" ? lang : null }) : type.create();
    dispatch?.(state.tr.addMark(range.from, range.to, mark).scrollIntoView());
    return true;
  };
}

/** The field's link off the selection, or off the whole link the caret stands in. */
export const removeLink: Command = (state, dispatch) => {
  const type = linkMarkType(state);
  const { from, to, empty } = state.selection;
  const range = empty ? markRun(state, type) : state.doc.rangeHasMark(from, to, type) ? { from, to } : null;
  if (!range) return false;
  dispatch?.(state.tr.removeMark(range.from, range.to, type).scrollIntoView());
  return true;
};

/**
 * What a paste or a drop may put into the field, as flat inline content: the marks the field
 * holds, a link only to one of `hrefs` (any other link becomes its words), and a slot only where
 * the Polish has it. Any other slot saves as the same `{name}` and is read the way the parser
 * reads it there: the braces link in a field that has one, else text.
 */
export function pastedSlice(slice: Slice, markup: FieldMarkup, hrefs: ReadonlySet<string>): Slice {
  const kept = (mark: Mark): boolean => {
    const { name } = mark.type;
    if (name === "braces") return !markup.html && markup.braceLink;
    if (name === "a") return markup.html && hrefs.has(String(mark.attrs["href"]));
    return markup.html;
  };
  const inline: ProseNode[] = [];
  slice.content.descendants((node) => {
    if (!node.isInline) return true;
    const marks = node.marks.filter(kept);
    const group = node.type === schema.nodes.slot ? `{${String(node.attrs["name"])}}` : null;
    if (group === null || markup.slots.has(group)) inline.push(node.mark(marks));
    else if (markup.braceLink) inline.push(schema.text(group.slice(1, -1), schema.marks.braces.create().addToSet(marks)));
    else inline.push(schema.text(group, marks));
    return false;
  });
  return new Slice(Fragment.fromArray(inline), 0, 0);
}
