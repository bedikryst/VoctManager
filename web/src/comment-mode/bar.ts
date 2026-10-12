/**
 * @file bar.ts
 * @description The comment mode's bar: a compact pill at the bottom left that says what state the
 *  mode is in. "Zakończ" is in every state, signed-out and refused included, so an editor can
 *  always leave. Once the mode is ready, the pill's menu opens above it: the editor's proposals
 *  on this page, the page's language, the highlights, the editor's proposals or the published
 *  text, editing on or off, "Pozostałe teksty", "Gotowe", "Zakończ". The two lists show how many
 *  fields they hold, counted when the menu opens.
 *
 *  The language buttons offer only the locales the page exists in (`TRANSLATED_ROUTES`): the
 *  public switcher is off, so this is the editor's one way between languages.
 * @architecture Astro islands 2026
 * @module comment-mode/bar
 */

import { LOCALES, type Locale } from "../i18n/config";
import { button, el } from "./dom";
import type { Strings } from "./strings";

export type BarState =
  | { readonly kind: "loading" }
  | { readonly kind: "signed-out" }
  | { readonly kind: "refused" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly editing: boolean };

/** What the ready bar shows besides its state. */
export interface BarView {
  readonly state: BarState;
  /** The page's locale, and the ones it exists in. */
  readonly locale: Locale;
  readonly locales: readonly Locale[];
  /** The wash over editable texts; `null` when the browser cannot paint highlights. */
  readonly fields: boolean | null;
  /** The page shows the editor's proposals (true) or the published text (false). */
  readonly previews: boolean;
  /** "Gotowe" is on its way. */
  readonly sending: boolean;
  /** How many fields each list holds; measures the page, so it is asked only by an open menu. */
  readonly counts: () => ListCounts;
}

export interface ListCounts {
  readonly mine: number;
  readonly rest: number;
}

export interface BarActions {
  signIn(): void;
  retry(): void;
  showMine(): void;
  showRest(): void;
  toggleEditing(): void;
  switchLocale(locale: Locale): void;
  toggleFields(): void;
  togglePreviews(): void;
  done(): void;
  end(): void;
}

/** How long a confirmation stands in the bar before the status returns. */
const NOTICE_MS = 6000;

/** A menu row that switches something on or off. */
function toggle(label: string, on: boolean, onPress: () => void): HTMLButtonElement {
  const control = button("", onPress, "btn menu-item");
  control.setAttribute("aria-pressed", String(on));
  control.replaceChildren(el("span", "", label), el("span", "switch"));
  return control;
}

/** A menu row that opens a list, with how many fields it holds. */
function listItem(label: string, count: number, onPress: () => void): HTMLButtonElement {
  const control = button("", onPress, "btn menu-item");
  control.replaceChildren(el("span", "", label), el("span", "count", String(count)));
  return control;
}

export class Bar {
  readonly element: HTMLElement;
  private readonly actions: BarActions;
  private readonly name: HTMLElement;
  /**
   * One live region for the bar's whole life, only its text rewritten: a screen reader announces
   * a change inside a region it knows, not the text of a region inserted already holding it.
   */
  private readonly status: HTMLElement;
  private readonly commands: HTMLElement;
  private menu: HTMLElement | null = null;
  private view: BarView;
  private strings: Strings;
  private notice = "";
  private noticeTimer = 0;
  private menuOpen = false;
  /** The lists' counts, measured once per opening of the menu: its re-renders reuse them. */
  private counts: ListCounts | null = null;

  constructor(root: ShadowRoot, actions: BarActions, view: BarView, strings: Strings) {
    this.actions = actions;
    this.view = view;
    this.strings = strings;
    this.element = el("div", "panel bar");
    this.element.setAttribute("role", "region");
    this.name = el("span", "bar-name");
    this.status = el("span", "bar-status");
    this.status.setAttribute("aria-live", "polite");
    this.commands = el("span", "bar-actions");
    this.element.append(el("div", "bar-row", this.name, this.status, this.commands));
    root.append(this.element);
    this.render();
  }

  get isMenuOpen(): boolean {
    return this.menuOpen;
  }

  update(view: BarView, strings: Strings): void {
    this.view = view;
    this.strings = strings;
    if (view.state.kind !== "ready") this.menuOpen = false;
    this.render();
  }

  closeMenu(): void {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.render();
  }

  /** A confirmation that stands in place of the status for a few seconds. */
  announce(text: string): void {
    this.notice = text;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      this.notice = "";
      this.render();
    }, NOTICE_MS);
    this.render();
  }

  /** On a phone the sheet covers the bar's corner; the bar steps aside while it is open. */
  setUnderSheet(under: boolean): void {
    this.element.classList.toggle("is-under-sheet", under);
    if (under) this.closeMenu();
  }

  dispose(): void {
    window.clearTimeout(this.noticeTimer);
    this.element.remove();
  }

  private render(): void {
    const s = this.strings;
    const { actions, view } = this;
    const { state } = view;
    this.element.setAttribute("aria-label", s.modeName);

    let status: string;
    const commands: HTMLButtonElement[] = [];
    switch (state.kind) {
      case "loading":
        status = s.loading;
        break;
      case "signed-out":
        status = s.signedOut;
        commands.push(button(s.signIn, () => actions.signIn(), "btn btn-primary"));
        break;
      case "refused":
        status = s.refused;
        break;
      case "failed":
        status = s.loadFailed;
        commands.push(button(s.retry, () => actions.retry()));
        break;
      case "ready": {
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        if (!state.editing) status = s.paused;
        else if (!view.previews) status = s.showingPublished;
        else status = coarse ? s.hintCoarse : s.hintFine;
        break;
      }
    }
    if (state.kind === "ready") {
      const menu = button(s.menu, () => {
        this.menuOpen = !this.menuOpen;
        this.render();
      });
      menu.setAttribute("aria-expanded", String(this.menuOpen));
      commands.push(menu);
    } else {
      commands.push(button(s.end, () => actions.end()));
    }

    // A re-render replaces the buttons; a keyboard user keeps their place among them.
    const root = this.element.getRootNode();
    const focused = root instanceof ShadowRoot ? root.activeElement : null;
    const before = [...this.element.querySelectorAll("button")];
    const focusIndex = before.findIndex((b) => b === focused);

    this.name.textContent = s.modeName;
    const text = this.notice || status;
    this.status.className = this.notice ? "bar-status is-notice" : "bar-status";
    if (this.status.textContent !== text) this.status.textContent = text;
    this.commands.replaceChildren(...commands);
    // The menu follows the pill in the DOM, so Tab goes from "Menu" into it; CSS stacks it above.
    const menu = this.menuOpen && state.kind === "ready" ? this.renderMenu(state.editing) : null;
    if (!menu) this.counts = null;
    this.element.classList.toggle("is-open", menu !== null);
    this.menu?.remove();
    this.menu = menu;
    if (menu) this.element.append(menu);

    if (focusIndex >= 0) {
      const after = [...this.element.querySelectorAll("button")];
      after[Math.min(focusIndex, after.length - 1)]?.focus();
    }
  }

  private renderMenu(editing: boolean): HTMLElement {
    const s = this.strings;
    const { actions, view } = this;

    const languages = el(
      "div",
      "langs",
      el("span", "menu-label", s.pageLanguage),
      ...LOCALES.map((locale) => {
        const choice = button(locale.toUpperCase(), () => actions.switchLocale(locale), "btn lang");
        choice.lang = locale;
        choice.setAttribute("aria-label", s.localeNames[locale]);
        if (locale === view.locale) choice.setAttribute("aria-current", "page");
        else choice.disabled = !view.locales.includes(locale);
        return choice;
      }),
    );
    const polishOnly = view.locales.length < LOCALES.length ? el("p", "menu-note", s.polishOnly) : null;

    const done = button(view.sending ? s.sending : s.done, () => actions.done(), "btn menu-item");
    done.disabled = view.sending;
    const counts = (this.counts ??= view.counts());

    return el(
      "div",
      "menu",
      listItem(s.myProposals, counts.mine, () => actions.showMine()),
      languages,
      polishOnly,
      view.fields === null ? null : toggle(s.showFields, view.fields, () => actions.toggleFields()),
      toggle(s.showPreviews, view.previews, () => actions.togglePreviews()),
      button(editing ? s.pause : s.resume, () => actions.toggleEditing(), "btn menu-item"),
      listItem(s.restTexts, counts.rest, () => actions.showRest()),
      done,
      el("p", "menu-note", s.doneHint),
      button(s.end, () => actions.end(), "btn menu-item"),
    );
  }
}
