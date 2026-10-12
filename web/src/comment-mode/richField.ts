/**
 * @file richField.ts
 * @description The markup editor in the sheet: a ProseMirror view over one field's value, showing
 *  the text as it reads, with the build's slots as chips that cannot be edited inside, and above it
 *  the controls the field takes: italic, bold and the link in an `HTML` field, the braces link in a
 *  `TEXT` field whose Polish has one. The document, the parser, the serializer and what the
 *  controls do to the document are `markup.ts`; this module only puts them on the screen.
 *
 *  A CHUNK OF ITS OWN. Only `fieldInput.ts` loads it, dynamically: ProseMirror never reaches the
 *  mode's chunk, and a visitor never loads either.
 *
 *  ONE TEXTBLOCK. Enter types `\n`, and the field saves what the serializer writes, so the value
 *  goes back to the server in the form the sanitizer itself writes. Pasted text keeps its line
 *  breaks, where ProseMirror would split it into blocks the field does not have. A paste from
 *  outside the field arrives as its plain text: a pasted page's paragraphs would run together.
 *
 *  LINKS ONLY FROM THE POLISH. The link control offers the targets it is given (`linkChoices`), each
 *  with the Polish words it sits on, and there is no field to type an address into. A paste or a
 *  drop out of a field keeps only those targets, the marks this field holds and the Polish's slots
 *  (`pastedSlice`); any other link becomes its words.
 *
 *  A CONTROL KEEPS THE SELECTION. Pressing one does not take the focus from the text (its
 *  `mousedown` is cancelled), so the words selected are the words it changes. iOS's own bold and
 *  italic (`formatBold`, `formatItalic`) run the same commands, and its other formats do nothing:
 *  the browser would write tags the schema does not read.
 * @module comment-mode/richField
 */

import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Fragment, Slice, type MarkType } from "prosemirror-model";
import { EditorState, type Command, type Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import type { Locale } from "../i18n/config";
import type { FieldMarkup, LinkChoice } from "./checklist";
import { button, el, fill } from "./dom";
import type { ValueInput } from "./fieldInput";
import { loadValue, pastedSlice, removeLink, schema, serializeValue, setLink } from "./markup";
import type { Strings } from "./strings";

export interface RichFieldOptions {
  readonly value: string;
  /** What the field may hold, read off the decided Polish (`fieldMarkup`). */
  readonly markup: FieldMarkup;
  /** The link targets the control offers and a paste keeps (`linkChoices`). */
  readonly links: readonly LinkChoice[];
  readonly strings: Strings;
  readonly locale: Locale;
  /** The id of the field's label. */
  readonly labelledBy: string;
  /** The text changed under the editor's hand. */
  readonly onInput: () => void;
}

const newline: Command = (state, dispatch) => {
  dispatch?.(state.tr.insertText("\n").scrollIntoView());
  return true;
};

const italic = toggleMark(schema.marks.em);
const bold = toggleMark(schema.marks.strong);

function plugins(markup: FieldMarkup): Plugin[] {
  return [
    history(),
    keymap({
      Enter: newline,
      "Shift-Enter": newline,
      "Mod-z": undo,
      "Shift-Mod-z": redo,
      "Mod-y": redo,
      ...(markup.html ? { "Mod-i": italic, "Mod-b": bold } : {}),
    }),
    keymap(baseKeymap),
  ];
}

/**
 * What a `beforeinput` the browser would carry out itself does here instead: a command, `null` to
 * do nothing, `undefined` to let the browser and ProseMirror handle it.
 */
function commandFor(inputType: string, markup: FieldMarkup): Command | null | undefined {
  if (inputType === "historyUndo") return undo;
  if (inputType === "historyRedo") return redo;
  if (inputType === "formatBold") return markup.html ? bold : null;
  if (inputType === "formatItalic") return markup.html ? italic : null;
  return inputType.startsWith("format") ? null : undefined;
}

/** The mark is on the selected text, or on what the caret will type. */
function active(state: EditorState, type: MarkType): boolean {
  const { from, to, empty, $from } = state.selection;
  return empty ? type.isInSet(state.storedMarks ?? $from.marks()) !== undefined : state.doc.rangeHasMark(from, to, type);
}

/** A control that leaves the focus, and with it the selection, in the text. */
function tool(label: string, className: string, onPress: () => void): HTMLButtonElement {
  const control = button(label, onPress, `btn ${className}`.trim());
  control.addEventListener("mousedown", (event) => event.preventDefault());
  return control;
}

/** ProseMirror's clipboard marker: the HTML was copied out of a field. */
const FROM_A_FIELD = "data-pm-slice";

function lines(text: string): string {
  return text.replace(/\r\n?/gu, "\n");
}

/**
 * The markup editor over `value`, or `null` when the value has to open in the textarea: the
 * grammar refuses it, or it would not save back as the same string (`loadValue`).
 */
export function richField({
  value,
  markup,
  links,
  strings: s,
  locale,
  labelledBy,
  onInput,
}: RichFieldOptions): ValueInput | null {
  const doc = loadValue(value, markup);
  if (!doc) return null;

  const hrefs: ReadonlySet<string> = new Set(links.map((link) => link.href));
  const mount = document.createElement("div");
  let current = value;

  const chooser = el("div", "link-chooser");
  chooser.hidden = true;
  /** The chooser says only that nothing is selected: the next transaction takes it away. */
  let chooserHint = false;

  const run = (command: Command): boolean => {
    const applied = command(view.state, view.dispatch);
    view.focus();
    return applied;
  };

  const closeChooser = (): void => {
    chooser.hidden = true;
    chooser.replaceChildren();
    chooserHint = false;
    linkControl?.setAttribute("aria-expanded", "false");
  };

  const selectFirst = (): void => {
    fill(chooser, el("p", "note note-warn", s.linkSelectFirst));
    chooser.hidden = false;
    chooserHint = true;
  };

  const choice = (link: LinkChoice): HTMLButtonElement => {
    const control = tool("", "choice", () => {
      closeChooser();
      if (!run(setLink(link.href))) selectFirst();
    });
    fill(control, link.words ? el("span", "", s.quoted(link.words)) : null, el("span", "choice-scope", link.href));
    return control;
  };

  const offerLink = (): void => {
    if (!chooser.hidden) {
      closeChooser();
      return;
    }
    // Nothing selected and the caret outside a link: there are no words to link.
    if (!setLink("")(view.state)) {
      selectFirst();
      return;
    }
    // The braces link has one target, the one the page gives it.
    if (!markup.html) {
      run(setLink(""));
      return;
    }
    fill(
      chooser,
      el("p", "note", s.linkChoose),
      el("ul", "choices", ...links.map((link) => el("li", "", choice(link)))),
      el("div", "chooser-actions", tool(s.close, "btn-quiet", closeChooser)),
    );
    chooser.hidden = false;
    linkControl?.setAttribute("aria-expanded", "true");
  };

  const italicControl = markup.html ? tool(s.italic, "tool tool-em", () => run(italic)) : null;
  const boldControl = markup.html ? tool(s.bold, "tool tool-strong", () => run(bold)) : null;
  const linkControl = (markup.html ? links.length > 0 : markup.braceLink) ? tool(s.link, "tool", offerLink) : null;
  // A link the Polish does not have can still be taken off, where there is nothing to offer.
  const unlinkControl =
    linkControl || (markup.html && doc.rangeHasMark(0, doc.content.size, schema.marks.a))
      ? tool(s.unlink, "tool", () => run(removeLink))
      : null;
  linkControl?.setAttribute("aria-expanded", "false");
  const controls = [italicControl, boldControl, linkControl, unlinkControl].filter(
    (control): control is HTMLButtonElement => control !== null,
  );
  const toolbar = controls.length > 0 ? el("div", "tools", ...controls) : null;
  toolbar?.setAttribute("role", "group");
  toolbar?.setAttribute("aria-label", s.toolsLabel);

  const update = (state: EditorState): void => {
    italicControl?.setAttribute("aria-pressed", String(active(state, schema.marks.em)));
    boldControl?.setAttribute("aria-pressed", String(active(state, schema.marks.strong)));
    if (unlinkControl) unlinkControl.disabled = !removeLink(state);
  };

  const view: EditorView = new EditorView(
    { mount },
    {
      state: EditorState.create({ doc, plugins: plugins(markup) }),
      attributes: {
        class: "rich",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        lang: locale,
        spellcheck: "true",
      },
      dispatchTransaction(transaction) {
        view.updateState(view.state.apply(transaction));
        if (chooserHint || transaction.docChanged) closeChooser();
        update(view.state);
        if (!transaction.docChanged) return;
        current = serializeValue(view.state.doc);
        onInput();
      },
      clipboardTextParser(text, $context) {
        const pasted = lines(text);
        return pasted === "" ? Slice.empty : new Slice(Fragment.from(schema.text(pasted, $context.marks())), 0, 0);
      },
      transformPasted(slice) {
        return pastedSlice(slice, markup, hrefs);
      },
      handlePaste(target, event) {
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (html === "" || html.includes(FROM_A_FIELD)) return false;
        const text = lines(event.clipboardData?.getData("text/plain") ?? "");
        if (text === "") return false;
        target.dispatch(target.state.tr.insertText(text).scrollIntoView());
        return true;
      },
      handleDOMEvents: {
        // iOS undoes on a shake or a three-finger swipe and formats from its edit menu, and says so
        // only through `beforeinput`.
        beforeinput(target, event) {
          const command = commandFor(event.inputType, markup);
          if (command === undefined) return false;
          event.preventDefault();
          command?.(target.state, target.dispatch);
          return true;
        },
      },
    },
  );
  update(view.state);

  return {
    kind: "rich",
    element: el("div", "rich-field", toolbar, chooser, mount),
    get value() {
      return current;
    },
    setValue(next) {
      const loaded = loadValue(next, markup);
      if (!loaded) return false;
      view.updateState(EditorState.create({ doc: loaded, plugins: plugins(markup) }));
      current = next;
      closeChooser();
      update(view.state);
      return true;
    },
    insertSlot:
      markup.slots.size > 0
        ? (slot) => {
            const name = slot.slice(1, -1);
            view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.slot.create({ name })).scrollIntoView());
          }
        : null,
    focus() {
      view.focus();
    },
    destroy() {
      view.destroy();
    },
  };
}
