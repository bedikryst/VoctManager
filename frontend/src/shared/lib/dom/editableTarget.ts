/**
 * @file editableTarget.ts
 * @description Whether a key event belongs to a field the reader is typing
 * into. Every shortcut that listens on the window asks this first, so a letter
 * typed into a search box or a note never also turns a page or picks up a tool.
 * @module shared/lib/dom/editableTarget
 */

const FIELD_TAGS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True for a text field, a select, or anything content-editable. */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || FIELD_TAGS.has(target.tagName);
};
