// @ts-check
/**
 * @file markup.test.mjs
 * @description `npm run test:comment-mode` — the markup editor's document model and the checklist
 *  beside it, without a browser.
 *
 *  THE CORPUS IS READ FROM THE YAML through the copy desk's own extractor (`extractSegments`), never
 *  from `segments.json`, which is generated and untracked. Every non-empty value of every field the
 *  editor opens, in all three locales, has to load and save back unchanged: a field that does not
 *  falls back to the textarea, and a miss here is a field the editor never opens.
 *
 *  EDITED DOCUMENTS go through ProseMirror's own commands and transactions, and every value they
 *  save has to be a fixed point: parsing it gives the same document, and saving that gives the
 *  same string. The checklist is checked on the guard's cases in `backend/copydesk/tests.py`.
 * @module copydesk/markup.test
 */

import assert from "node:assert/strict";
import test from "node:test";

import { toggleMark } from "prosemirror-commands";
import { EditorState, TextSelection } from "prosemirror-state";

import {
  checklist,
  decidedPolish,
  emphasis,
  fieldMarkup,
  holdReason,
  holdReasonOf,
  linkChoices,
  linksOf,
  opensMarkupEditor,
  slotsOf,
} from "../src/comment-mode/checklist.ts";
import { decodeEntities } from "../src/comment-mode/match.ts";
import {
  loadValue,
  parseValue,
  pastedSlice,
  removeLink,
  schema,
  serializeValue,
  setLink,
} from "../src/comment-mode/markup.ts";
import { extractSegments } from "./index.mjs";

/** @typedef {import("prosemirror-model").Node} ProseNode */
/** @typedef {import("../src/comment-mode/checklist.ts").FieldMarkup} FieldMarkup */

const { payload } = await extractSegments();

/** @type {Map<string, Map<string, { kind: string, value: string }>>} Every key's rows by locale. */
const corpus = new Map();
for (const segment of payload.segments) {
  const rows = corpus.get(segment.key) ?? new Map();
  rows.set(segment.locale, { kind: segment.kind, value: segment.value });
  corpus.set(segment.key, rows);
}

/** @param {string} key */
function polishOf(key) {
  return corpus.get(key)?.get("pl")?.value ?? "";
}

/**
 * @param {ProseNode} doc
 * @returns {number}
 */
function slotCount(doc) {
  let count = 0;
  doc.descendants((node) => {
    if (node.type === schema.nodes.slot) count += 1;
  });
  return count;
}

/**
 * The editor on a value, which has to load.
 *
 * @param {string} value
 * @param {FieldMarkup} markup
 */
function editorOn(value, markup) {
  const doc = loadValue(value, markup);
  assert.ok(doc, `refused: ${JSON.stringify(value)}`);
  return EditorState.create({ doc });
}

/**
 * The range `needle` covers in the field's text, across marks; a slot reads as its `{name}`.
 *
 * @param {ProseNode} doc
 * @param {string} needle
 * @returns {[number, number]}
 */
function rangeIn(doc, needle) {
  let text = "";
  /** @type {number[]} The document position of each character of `text`. */
  const positions = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      for (let index = 0; index < (node.text ?? "").length; index += 1) positions.push(pos + index);
      text += node.text;
    } else if (node.isLeaf) {
      const leaf = `{${String(node.attrs["name"])}}`;
      for (let index = 0; index < leaf.length; index += 1) positions.push(pos);
      text += leaf;
    }
  });
  const index = text.indexOf(needle);
  assert.ok(index >= 0 && needle.length > 0, `not in the document: ${needle}`);
  return [positions[index] ?? 0, (positions[index + needle.length - 1] ?? 0) + 1];
}

/**
 * Where `needle` starts in the document.
 *
 * @param {ProseNode} doc
 * @param {string} needle
 */
function positionOf(doc, needle) {
  return rangeIn(doc, needle)[0];
}

/**
 * @param {EditorState} state
 * @param {string} needle
 */
function rangeOf(state, needle) {
  return rangeIn(state.doc, needle);
}

/**
 * Run a command with `needle` selected, as a click on a control would.
 *
 * @param {EditorState} state
 * @param {string} needle
 * @param {import("prosemirror-state").Command} command
 */
function onSelection(state, needle, command) {
  const [from, to] = rangeOf(state, needle);
  const selected = state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
  let next = selected;
  assert.ok(command(selected, (tr) => (next = selected.apply(tr))), "the command did not apply");
  return next;
}

/**
 * The caret where `needle` starts.
 *
 * @param {EditorState} state
 * @param {string} needle
 */
function caretAt(state, needle) {
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, positionOf(state.doc, needle))));
}

/**
 * Run a command on the selection as it stands.
 *
 * @param {EditorState} state
 * @param {import("prosemirror-state").Command} command
 */
function apply(state, command) {
  let next = state;
  assert.ok(command(state, (tr) => (next = state.apply(tr))), "the command did not apply");
  return next;
}

/**
 * What the document saves as, checked to be a fixed point.
 *
 * @param {EditorState} state
 * @param {FieldMarkup} markup
 */
function saved(state, markup) {
  const value = serializeValue(state.doc);
  const again = parseValue(value, markup);
  assert.ok(again, `refused its own output: ${JSON.stringify(value)}`);
  assert.ok(again.eq(state.doc), `the document changed through its own output: ${JSON.stringify(value)}`);
  assert.equal(serializeValue(again), value);
  return value;
}

test("every value of every field the editor opens, in all three locales, loads and saves unchanged", (t) => {
  /** @type {string[]} */
  const refused = [];
  const picked = { html: 0, bare: 0, braced: 0, values: 0 };
  for (const [key, rows] of corpus) {
    const polish = polishOf(key);
    const kind = rows.get("pl")?.kind ?? "";
    const opens = [...rows.values()].some((row) => opensMarkupEditor({ kind, value: row.value, polish }));
    if (!opens) continue;
    if (kind === "HTML") {
      picked.html += 1;
      if (!/[<&]/u.test(polish)) picked.bare += 1;
    } else {
      picked.braced += 1;
    }

    const markup = fieldMarkup(kind, polish);
    for (const [locale, row] of rows) {
      if (!row.value) continue;
      picked.values += 1;
      const doc = loadValue(row.value, markup);
      if (!doc) {
        refused.push(`${key} [${locale}]`);
        continue;
      }
      // The slots the build fills came in as atoms, not as typed text.
      const slots = [...row.value.matchAll(/\{[^{}]*\}/gu)].filter((match) => markup.slots.has(match[0])).length;
      assert.equal(slotCount(doc), slots, `${key} [${locale}] slots`);
      if (markup.html) {
        // Nothing of the markup leaked into the text, and every entity was decoded.
        assert.equal(doc.textContent, decodeEntities(row.value.replace(/<[^>]*>/gu, "")), `${key} [${locale}] text`);
      }
    }
  }
  assert.deepEqual(refused, []);
  assert.ok(picked.html > 0 && picked.bare > 0 && picked.braced > 0);
  t.diagnostic(
    `${picked.html} HTML keys (${picked.bare} without markup), ${picked.braced} TEXT keys with braces, ` +
      `${picked.values} values`,
  );
});

test("the predicate opens every HTML field, and a TEXT field only where its value or Polish has braces", () => {
  assert.equal(opensMarkupEditor({ kind: "HTML", value: "", polish: "Zapraszamy" }), true);
  assert.equal(opensMarkupEditor({ kind: "TEXT", value: "", polish: "{Zostaw kontakt}, a napiszemy." }), true);
  // A translation that lost its slot still opens where the slot can be put back.
  assert.equal(opensMarkupEditor({ kind: "TEXT", value: "Support us", polish: "Wspieraj {name}" }), true);
  assert.equal(opensMarkupEditor({ kind: "TEXT", value: "Support {x}", polish: "Wspieraj nas" }), true);
  assert.equal(opensMarkupEditor({ kind: "TEXT", value: "Support us", polish: "Wspieraj nas" }), false);
});

test("emphasis goes on and comes off", () => {
  const markup = fieldMarkup("HTML", "");
  const plain = "Śpiewamy w Warszawie i w Krakowie";
  let state = editorOn(plain, markup);

  state = onSelection(state, "w Warszawie", toggleMark(schema.marks.em));
  assert.equal(saved(state, markup), "Śpiewamy <em>w Warszawie</em> i w Krakowie");
  state = onSelection(state, "Krakowie", toggleMark(schema.marks.strong));
  assert.equal(saved(state, markup), "Śpiewamy <em>w Warszawie</em> i w <strong>Krakowie</strong>");

  state = onSelection(state, "w Warszawie", toggleMark(schema.marks.em));
  state = onSelection(state, "Krakowie", toggleMark(schema.marks.strong));
  assert.equal(saved(state, markup), plain);
});

test("a link comes off and goes back on, and the checklist follows it", () => {
  const polish = 'W <a href="/press">materiałach prasowych</a> i na stronie';
  const markup = fieldMarkup("HTML", polish);
  let state = editorOn(polish, markup);

  const [from, to] = rangeOf(state, "materiałach prasowych");
  state = state.apply(state.tr.removeMark(from, to, schema.marks.a));
  const unlinked = saved(state, markup);
  assert.equal(unlinked, "W materiałach prasowych i na stronie");
  assert.equal(holdReason({ value: unlinked, polish, kind: "HTML" }), "links");

  state = state.apply(state.tr.addMark(from, to, schema.marks.a.create({ href: "/press" })));
  assert.equal(saved(state, markup), polish);
  assert.equal(holdReason({ value: polish, polish, kind: "HTML" }), null);
});

test("marks nest: emphasis around a link keeps one link, overlapping marks close and reopen", () => {
  const markup = fieldMarkup("HTML", "");
  const linked = 'Czytaj <a href="/press">materiały prasowe</a> teraz';

  let state = onSelection(editorOn(linked, markup), "Czytaj materiały prasowe", toggleMark(schema.marks.em));
  assert.equal(saved(state, markup), '<em>Czytaj <a href="/press">materiały prasowe</a></em> teraz');

  state = onSelection(editorOn(linked, markup), "materiały prasowe", toggleMark(schema.marks.strong));
  assert.equal(saved(state, markup), 'Czytaj <a href="/press"><strong>materiały prasowe</strong></a> teraz');

  // Emphasis over half a link has to split the link in two: still the same target, still one hint.
  state = onSelection(editorOn(linked, markup), "Czytaj materiały", toggleMark(schema.marks.em));
  const split = saved(state, markup);
  assert.equal(split, '<em>Czytaj <a href="/press">materiały</a></em><a href="/press"> prasowe</a> teraz');
  assert.equal(holdReason({ value: split, polish: linked, kind: "HTML" }), null);

  // `lang` is carried through a mark added inside it.
  const french = '<em lang="fr">Concerts Spirituels</em> w Paryżu';
  state = onSelection(editorOn(french, markup), "Spirituels w", toggleMark(schema.marks.strong));
  assert.equal(
    saved(state, markup),
    '<em lang="fr">Concerts <strong>Spirituels</strong></em><strong> w</strong> Paryżu',
  );
});

test("typed & < > are text in an HTML field and stay as typed in a TEXT field", () => {
  const html = fieldMarkup("HTML", "");
  let state = editorOn("Bach", html);
  state = state.apply(state.tr.insertText(' & <a href="/x">Händel</a>', state.doc.content.size - 1));
  const value = saved(state, html);
  assert.equal(value, 'Bach &amp; &lt;a href="/x"&gt;Händel&lt;/a&gt;');
  assert.deepEqual(linksOf(value), []);
  assert.equal(parseValue(value, html)?.textContent, 'Bach & <a href="/x">Händel</a>');

  const text = fieldMarkup("TEXT", "stan na {date}");
  state = editorOn("stan na {date}", text);
  state = state.apply(state.tr.insertText(" <b>&</b>", state.doc.content.size - 1));
  assert.equal(saved(state, text), "stan na {date} <b>&</b>");
});

test("Enter types a line break, and a blank line comes back as it went in", () => {
  const markup = fieldMarkup("HTML", "");
  let state = editorOn("Pierwszy akapit. <strong>Drugi</strong>", markup);
  const at = positionOf(state.doc, "Drugi");
  state = state.apply(state.tr.insertText("\n\n", at - 1, at));
  assert.equal(saved(state, markup), "Pierwszy akapit.\n\n<strong>Drugi</strong>");
  state = state.apply(state.tr.insertText("\n", positionOf(state.doc, "akapit"), positionOf(state.doc, "akapit")));
  assert.equal(saved(state, markup), "Pierwszy \nakapit.\n\n<strong>Drugi</strong>");
});

test("a slot is deleted whole and put back where a translation wants it", () => {
  const polish = "festiwal {name}";
  const markup = fieldMarkup("TEXT", polish);
  let state = editorOn("the {name} festival", markup);
  assert.equal(slotCount(state.doc), 1);

  /** @type {number} */
  let slotAt = -1;
  state.doc.descendants((node, pos) => {
    if (node.type === schema.nodes.slot) slotAt = pos;
  });
  state = state.apply(state.tr.delete(slotAt, slotAt + 2));
  const dropped = saved(state, markup);
  assert.equal(dropped, "the festival");
  const items = checklist({ value: dropped, polish, kind: "TEXT" });
  assert.deepEqual(items, [
    { kind: "filled", ok: true },
    { kind: "slot", slot: "{name}", ok: false },
  ]);
  assert.equal(holdReasonOf(items), "slots");

  const end = state.doc.content.size - 1;
  state = state.apply(state.tr.insertText(" ", end).insert(end + 1, schema.nodes.slot.create({ name: "name" })));
  const moved = saved(state, markup);
  assert.equal(moved, "the festival {name}");
  assert.equal(holdReason({ value: moved, polish, kind: "TEXT" }), null);

  // Braces typed around a name the Polish does not use stay text, and count as the guard counts them.
  state = state.apply(state.tr.insertText(" {year}", state.doc.content.size - 1));
  const typed = saved(state, markup);
  assert.equal(typed, "the festival {name} {year}");
  assert.equal(slotCount(state.doc), 1);
  assert.equal(holdReason({ value: typed, polish, kind: "TEXT" }), "slots");
});

test("the braces link is a mark written as braces", () => {
  const key = [...corpus.keys()].find((candidate) => {
    const rows = corpus.get(candidate);
    return rows?.get("pl")?.kind === "TEXT" && fieldMarkup("TEXT", polishOf(candidate)).braceLink;
  });
  assert.ok(key, "the corpus has no TEXT field with a braces link");
  const polish = polishOf(key);
  const markup = fieldMarkup("TEXT", polish);
  assert.equal(markup.slots.size, 0);

  const loaded = editorOn(polish, markup);
  const words = /\{([^{}]*)\}/u.exec(polish)?.[1] ?? "";
  let linked = "";
  loaded.doc.descendants((node) => {
    if (node.isText && schema.marks.braces.isInSet(node.marks)) linked += node.text;
  });
  assert.equal(linked, words);

  let state = editorOn("", markup);
  state = state.apply(state.tr.insertText("Leave your details and we will send press releases.", 1));
  assert.equal(holdReason({ value: saved(state, markup), polish, kind: "TEXT" }), "slots");
  const [from, to] = rangeOf(state, "Leave your details");
  state = state.apply(state.tr.addMark(from, to, schema.marks.braces.create()));
  const value = saved(state, markup);
  assert.equal(value, "{Leave your details} and we will send press releases.");
  assert.equal(holdReason({ value, polish, kind: "TEXT" }), null);
  // A link translated into one word looks like a slot and is still the link.
  assert.ok(loadValue("{Subscribe} to receive press releases.", markup));
});

test("a value outside the sanitizer's form opens in the textarea", () => {
  const markup = fieldMarkup("HTML", "");
  for (const value of [
    "<span>tekst</span>",
    "<em>niezamknięte",
    "zamknięte</em>",
    "<em>a <strong>b</em> c</strong>",
    "<em><em>podwójne</em></em>",
    "a & b",
    "a &nbsp; b",
    "a > b",
    "<a href='/press'>pojedyncze cudzysłowy</a>",
    '<a href="/press" class="x">obcy atrybut</a>',
    '<em lang="fr" lang="en">dwa razy</em>',
    '<a lang="fr" href="/press">odwrotna kolejność</a>',
    "<em>a</em><em>b</em>",
    "<em></em>",
    "<EM>wielkie</EM>",
    "<br>",
  ]) {
    assert.equal(loadValue(value, markup), null, value);
  }
  // The same characters are plain text in a TEXT field.
  assert.ok(loadValue("a & b <span>", fieldMarkup("TEXT", "")));
});

test("the checklist holds what the server holds (backend/copydesk/tests.py)", () => {
  // Empty.
  assert.equal(holdReason({ value: "  ", polish: "Zapraszamy", kind: "TEXT" }), "empty");
  // A dropped slot.
  assert.equal(holdReason({ value: "Support us today", polish: "Wspieraj {name} już dziś", kind: "TEXT" }), "slots");
  // A slot used once where the Polish uses it twice.
  assert.equal(holdReason({ value: "Support {name}", polish: "{name}: wspieraj {name}", kind: "TEXT" }), null);
  // A link marker keeps its braces but not its words; one translated into a single word is no slot.
  const marker = "{Zostaw kontakt}, a napiszemy.";
  assert.equal(holdReason({ value: "{Leave your details} and we will write.", polish: marker, kind: "TEXT" }), null);
  assert.equal(holdReason({ value: "Leave your details and we will write.", polish: marker, kind: "TEXT" }), "slots");
  assert.equal(holdReason({ value: "{Subscribe} to receive press releases.", polish: marker, kind: "TEXT" }), null);
  assert.equal(holdReason({ value: "{Subscribe} to {name}.", polish: marker, kind: "TEXT" }), "slots");
  // A dropped or moved link.
  const linked = 'W <a href="/press">materiałach prasowych →</a>';
  assert.equal(holdReason({ value: "In the press materials →", polish: linked, kind: "HTML" }), "links");
  assert.equal(holdReason({ value: 'In the <a href="/kontakt">press materials →</a>', polish: linked, kind: "HTML" }), "links");
  assert.equal(holdReason({ value: 'In the <a href="/press">press kit →</a>', polish: linked, kind: "HTML" }), null);
  // Links are not read in a TEXT field.
  assert.equal(holdReason({ value: "W materiałach", polish: '<a href="/press">x</a>', kind: "TEXT" }), null);
  // The first unticked item names the reason, in the server's order.
  assert.equal(holdReason({ value: "", polish: "Wspieraj {name}", kind: "TEXT" }), "empty");
  assert.equal(holdReason({ value: "Back us", polish: 'Wspieraj <a href="/x">{name}</a>', kind: "HTML" }), "slots");
});

test("the checklist lists each slot, the other braces and each link, extra links last", () => {
  assert.deepEqual(
    checklist({
      value: 'Back <a href="/b">{name}</a> and <a href="/c">us</a> {x}',
      polish: 'Wspieraj <a href="/a">{name}</a> i <a href="/b">{date}</a>',
      kind: "HTML",
    }),
    [
      { kind: "filled", ok: true },
      { kind: "slot", slot: "{name}", ok: true },
      { kind: "slot", slot: "{date}", ok: false },
      { kind: "braces", expected: 0, actual: 1, ok: false },
      { kind: "link", href: "/a", ok: false },
      { kind: "link", href: "/b", ok: true },
      { kind: "extraLink", href: "/c", ok: false },
    ],
  );
  assert.deepEqual([...slotsOf("{name}, {Zostaw kontakt} i {name}")], ["{name}"]);
});

test("links are read as the server's parser reads them", () => {
  assert.deepEqual(linksOf('<a href="/x?a=1&amp;b=2">x</a>'), ["/x?a=1&b=2"]);
  assert.deepEqual(linksOf("<A HREF='/y'>y</A> <a href = /z>z</a>"), ["/y", "/z"]);
  assert.deepEqual(linksOf('<abbr href="/no">no</abbr> <a lang="fr">bare</a> <a href=" /t ">t</a>'), ["/t"]);
});

test("emphasis is only compared, never held", () => {
  const polish = "<em>Jeden</em> i <strong>dwa</strong>";
  assert.deepEqual(emphasis("<em>One</em> and two", polish), {
    value: { em: 1, strong: 0 },
    polish: { em: 1, strong: 1 },
    same: false,
  });
  assert.equal(emphasis('<em lang="fr">Un</em> et <strong>deux</strong>', polish).same, true);
  assert.equal(holdReason({ value: "One and two", polish, kind: "HTML" }), null);
});

test("the decided Polish is the latest accepted, unapplied proposal, else the value", () => {
  /**
   * @param {string} value
   * @param {"DRAFT" | "PROPOSED" | "ACCEPTED" | "REJECTED"} status
   * @param {string | null} reviewedAt
   * @param {string | null} [appliedAt]
   */
  const proposal = (value, status, reviewedAt, appliedAt = null) => ({
    id: value,
    value,
    status,
    comment: "",
    author_name: "",
    is_mine: false,
    self_accepted: false,
    updated_at: "2026-10-12T10:00:00Z",
    reviewed_at: reviewedAt,
    applied_at: appliedAt,
  });
  const published = 'W <a href="/press">materiałach</a>';
  assert.equal(decidedPolish({ value: published, proposals: [] }), published);
  assert.equal(
    decidedPolish({
      value: published,
      // Newest first, as the history lists them.
      proposals: [
        proposal("otwarta", "PROPOSED", null),
        proposal("wcześniejsza", "ACCEPTED", "2026-10-12T09:00:00+02:00"),
        proposal("opublikowana", "ACCEPTED", "2026-10-12T12:00:00Z", "2026-10-12T12:30:00Z"),
        proposal('W <a href="/prasa">materiałach</a>', "ACCEPTED", "2026-10-12T08:00:00Z"),
        proposal("odrzucona", "REJECTED", "2026-10-12T13:00:00Z"),
      ],
    }),
    'W <a href="/prasa">materiałach</a>',
  );
  assert.equal(
    decidedPolish({ value: published, proposals: [proposal("otwarta", "PROPOSED", null)] }),
    published,
  );
});

test("the link control offers each Polish target once, with every phrase it sits on", () => {
  assert.deepEqual(
    linkChoices(
      '<a href="/a">jeden</a> i <a href="/a"><em>dwa</em></a> &amp; <a href="/b">trzy &amp; cztery</a> <a href="/a">jeden</a>',
      '<a href="/c">x</a> <a href="/b">inne</a>',
    ),
    [
      { href: "/a", words: "jeden … dwa" },
      { href: "/b", words: "trzy & cztery … inne" },
      { href: "/c", words: "x" },
    ],
  );
  assert.deepEqual(linkChoices("bez odnośników"), []);
});

test("the link control links the selection, retargets the link at the caret and takes it off whole", () => {
  const polish = 'Napisz <a href="/kontakt">do nas</a> albo <a href="/press">do prasy</a>';
  const markup = fieldMarkup("HTML", polish);

  let state = editorOn("Write to us or to the press", markup);
  state = onSelection(state, "to us", setLink("/kontakt"));
  state = onSelection(state, "the press", setLink("/press"));
  const linked = saved(state, markup);
  assert.equal(linked, 'Write <a href="/kontakt">to us</a> or to <a href="/press">the press</a>');
  assert.equal(holdReason({ value: linked, polish, kind: "HTML" }), null);

  // Nothing selected outside a link: there are no words to link, and nothing to take off.
  assert.equal(setLink("/press")(caretAt(state, "Write")), false);
  assert.equal(removeLink(caretAt(state, "Write")), false);

  // The caret inside a link retargets all of it.
  state = apply(caretAt(state, "us"), setLink("/press"));
  assert.equal(saved(state, markup), 'Write <a href="/press">to us</a> or to <a href="/press">the press</a>');

  // The caret just after a link still stands in it, and the link comes off whole.
  state = apply(caretAt(state, " or"), removeLink);
  assert.equal(saved(state, markup), 'Write to us or to <a href="/press">the press</a>');

  // A selection takes the link off only the selected words.
  state = onSelection(state, "press", removeLink);
  assert.equal(saved(state, markup), 'Write to us or to <a href="/press">the </a>press');

  // A new target keeps the link's `lang`.
  const french = '<a href="/x" lang="fr">Concerts Spirituels</a> w Paryżu';
  state = apply(caretAt(editorOn(french, markup), "Spirituels"), setLink("/y"));
  assert.equal(saved(state, markup), '<a href="/y" lang="fr">Concerts Spirituels</a> w Paryżu');
});

test("the braces link goes on and comes off through the same control", () => {
  const marker = "{Zostaw kontakt}, a napiszemy.";
  const markup = fieldMarkup("TEXT", marker);
  let state = editorOn("Leave your details and we will write.", markup);
  state = onSelection(state, "Leave your details", setLink(""));
  const linked = saved(state, markup);
  assert.equal(linked, "{Leave your details} and we will write.");
  assert.equal(holdReason({ value: linked, polish: marker, kind: "TEXT" }), null);
  state = apply(caretAt(state, "your"), removeLink);
  assert.equal(saved(state, markup), "Leave your details and we will write.");
});

test("a paste keeps the Polish's targets, the field's marks and its slots, and nothing else", () => {
  const copiedFrom = fieldMarkup("HTML", "{name} {other}");
  const source = parseValue(
    '<em>Pisz</em> <a href="/kontakt">tu</a> lub <a href="https://example.org">tam</a> {name} {other}',
    copiedFrom,
  );
  assert.ok(source);
  // What a copy of the whole field puts on the clipboard: the field's block, open on both sides.
  const slice = source.slice(1, source.content.size - 1);

  const polish = 'Napisz <a href="/kontakt">do nas</a> o {name}';
  const html = fieldMarkup("HTML", polish);
  const hrefs = new Set(linkChoices(polish).map((link) => link.href));
  let state = editorOn("", html);
  state = state.apply(state.tr.replaceSelection(pastedSlice(slice, html, hrefs)));
  assert.equal(saved(state, html), '<em>Pisz</em> <a href="/kontakt">tu</a> lub tam {name} {other}');
  assert.equal(slotCount(state.doc), 1);

  // A TEXT field takes text, its slots and its own braces link.
  const marker = "{Zostaw kontakt}, a napiszemy.";
  const text = fieldMarkup("TEXT", marker);
  state = editorOn("", text);
  state = state.apply(state.tr.replaceSelection(pastedSlice(slice, text, hrefs)));
  assert.equal(saved(state, text), "Pisz tu lub tam {name} {other}");
  assert.equal(slotCount(state.doc), 0);

  const plain = fieldMarkup("TEXT", "festiwal {name}");
  state = editorOn("", plain);
  state = state.apply(state.tr.replaceSelection(pastedSlice(slice, plain, hrefs)));
  assert.equal(saved(state, plain), "Pisz tu lub tam {name} {other}");
  assert.equal(slotCount(state.doc), 1);
});
