/**
 * @file fieldInput.ts
 * @description The text a `FieldEditor` edits, behind one interface with three implementations: the
 *  textarea; the markup editor (`richField.ts`); and the box that holds the field's place while the
 *  sheet waits for what the markup editor needs, its chunk and the Polish it reads.
 *
 *  THE MARKUP EDITOR IS NEVER IMPORTED STATICALLY. ProseMirror stays out of the mode's chunk:
 *  `loadRichField` asks for a chunk of its own, the mode does so as soon as it is ready, and a field
 *  that cannot have it (the chunk failed, or a deploy renamed it under an open page) is a textarea.
 *  Only types cross from `richField.ts` into this module.
 * @module comment-mode/fieldInput
 */

import type { Locale } from "../i18n/config";
import { el } from "./dom";
import { decodeEntities } from "./match";

export interface ValueInput {
  /** The markup note teaches typing tags, so it shows over a textarea only. */
  readonly kind: "textarea" | "rich" | "pending";
  readonly element: HTMLElement;
  /** The value as it will be saved. */
  readonly value: string;
  /** Show `value` in place of the text; `false` when this input cannot hold it. */
  setValue(value: string): boolean;
  /**
   * Put a slot of the Polish (`{name}`) back at the caret, whole; `null` where the input has no
   * slots to put back and the editor types the braces.
   */
  readonly insertSlot: ((slot: string) => void) | null;
  focus(): void;
  /** The input left the sheet: let go of what it holds on the document. */
  destroy(): void;
}

type RichFieldModule = typeof import("./richField");

let richChunk: Promise<RichFieldModule> | null = null;

/** The markup editor's chunk. A failed load is forgotten, so the next sheet asks again. */
export function loadRichField(): Promise<RichFieldModule> {
  richChunk ??= import("./richField").catch((error: unknown) => {
    richChunk = null;
    throw error;
  });
  return richChunk;
}

function textareaRows(value: string): number {
  return Math.min(14, Math.max(3, Math.ceil(value.length / 46) + value.split("\n").length - 1));
}

export function textareaInput(value: string, id: string, locale: Locale, onInput: () => void): ValueInput {
  const area = el("textarea", "");
  area.value = value;
  area.rows = textareaRows(value);
  area.spellcheck = true;
  area.lang = locale;
  area.id = id;
  area.addEventListener("input", onInput);
  return {
    kind: "textarea",
    element: area,
    get value() {
      return area.value;
    },
    setValue(next) {
      area.value = next;
      area.rows = textareaRows(next);
      return true;
    },
    insertSlot: null,
    focus() {
      area.focus({ preventScroll: true });
    },
    destroy() {
      // A textarea holds nothing outside itself.
    },
  };
}

/** The words of a value without its tags, as the markup editor will show them. */
function shownText(value: string, kind: string): string {
  return kind === "HTML" ? decodeEntities(value.replace(/<[^>]*>/gu, "")) : value;
}

/**
 * The field's place while the markup editor is on its way: the text as it will read, not editable.
 * It takes focus, so the field that replaces it can take it over.
 */
export function pendingInput(value: string, kind: string, locale: Locale, labelledBy: string): ValueInput {
  const box = el("div", "rich is-pending", shownText(value, kind));
  box.lang = locale;
  box.tabIndex = -1;
  box.setAttribute("aria-busy", "true");
  box.setAttribute("aria-labelledby", labelledBy);
  let current = value;
  return {
    kind: "pending",
    element: box,
    get value() {
      return current;
    },
    setValue(next) {
      current = next;
      box.textContent = shownText(next, kind);
      return true;
    },
    insertSlot: null,
    focus() {
      box.focus({ preventScroll: true });
    },
    destroy() {
      // Nothing outside itself.
    },
  };
}
