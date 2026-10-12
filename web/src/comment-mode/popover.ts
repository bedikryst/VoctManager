/**
 * @file popover.ts
 * @description The small panel a tap opens when it cannot go straight to the edit sheet, hung from
 *  the line of text that was tapped:
 *  - copy inside a link or a button: "Edytuj tekst" or "Otwórz", so the page stays navigable
 *    without switching editing off;
 *  - one span held by several fields: a chooser of their labels with their pages;
 *  - a shared word (several fields hold it, none is the page's own): no guess, an explanation, and
 *    each field with a link to its own page, where it is that page's field and opens directly.
 *
 *  It follows its line while the page scrolls and closes once the line has left the viewport.
 * @module comment-mode/popover
 */

import type { IndexRow } from "./api";
import { localizePath, type Locale } from "../i18n/config";
import { button, el } from "./dom";
import type { Strings } from "./strings";

/** The text the popover hangs from, re-measured on every scroll. */
export type Anchor = () => DOMRect | null;

const GAP = 8;
const GUTTER = 16;

export class Popover {
  readonly element: HTMLElement;
  private anchor: Anchor | null = null;
  private readonly follow = (): void => this.place();

  constructor(root: ShadowRoot) {
    this.element = el("div", "panel popover");
    this.element.setAttribute("role", "dialog");
    this.element.hidden = true;
    root.append(this.element);
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  show(anchor: Anchor, label: string, content: readonly Node[]): void {
    this.anchor = anchor;
    this.element.setAttribute("aria-label", label);
    this.element.replaceChildren(...content);
    this.element.hidden = false;
    this.place();
    window.addEventListener("scroll", this.follow, { capture: true, passive: true });
    window.addEventListener("resize", this.follow, { passive: true });
    this.element.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
  }

  hide(): void {
    if (!this.isOpen) return;
    this.element.hidden = true;
    this.element.replaceChildren();
    this.anchor = null;
    window.removeEventListener("scroll", this.follow, { capture: true });
    window.removeEventListener("resize", this.follow);
  }

  private place(): void {
    const rect = this.anchor?.();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect || rect.bottom < 0 || rect.top > vh) {
      this.hide();
      return;
    }
    const box = this.element.getBoundingClientRect();
    let top = rect.bottom + GAP;
    if (top + box.height > vh - GUTTER && rect.top - GAP - box.height >= GUTTER) {
      top = rect.top - GAP - box.height;
    }
    top = Math.min(Math.max(top, GUTTER), Math.max(GUTTER, vh - box.height - GUTTER));
    const left = Math.min(Math.max(rect.left, GUTTER), Math.max(GUTTER, vw - box.width - GUTTER));
    this.element.style.top = `${Math.round(top)}px`;
    this.element.style.left = `${Math.round(left)}px`;
  }
}

/** One button per field: its label, and the page it belongs to beneath. */
export function fieldChoices(fields: readonly IndexRow[], pick: (row: IndexRow) => void): HTMLElement {
  return el(
    "ul",
    "choices",
    ...fields.map((row) => {
      const choice = button("", () => pick(row), "btn choice");
      choice.replaceChildren(el("span", "", row.label || row.key), el("span", "choice-scope", row.scope_label));
      return el("li", "", choice);
    }),
  );
}

/**
 * The explanation for a word several fields share and none of the page's own holds. Each field
 * links to its page in the language being read, when it has one.
 */
export function sharedWordContent(fields: readonly IndexRow[], locale: Locale, s: Strings): Node[] {
  const list = el(
    "ul",
    "fields",
    ...fields.map((row) => {
      const path = row.scope_path;
      const link = path ? el("a", "", s.openOnItsPage) : null;
      if (link) link.href = localizePath(path, locale);
      return el(
        "li",
        "",
        el("span", "", row.label || row.key),
        el("span", "field-scope", row.scope_label),
        link,
      );
    }),
  );
  return [
    el("p", "popover-title", s.sharedTitle),
    el("p", "popover-text", s.sharedBody),
    el("p", "popover-label", s.sharedFields),
    list,
  ];
}
