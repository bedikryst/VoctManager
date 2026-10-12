/**
 * @file editor.ts
 * @description One field in one language, rewritten whole and saved as the editor's proposal. The
 *  sheet holds one for the tapped field and one for each other language the editor opens.
 *
 *  SAVE IS EXPLICIT. Every save sends `value`, `comment` and `status: "PROPOSED"`
 *  (`api.saveProposal`), and the button is disabled while one is in flight, because two first
 *  saves at once end in a server error. An empty value is refused here with the reason: the server
 *  would accept it and only `copy:apply` refuses it. An unchanged value with a note is a real
 *  proposal; an unchanged value without one has nothing to save.
 *
 *  WHAT WAS STORED IS WHAT IS SHOWN. The server sanitizes (inline `em, strong, a, code` survive)
 *  and tidies whitespace. When the stored value differs from what was typed beyond that tidying
 *  (and, for an `HTML` field, beyond the escaping its text comes back with), the editor shows the
 *  stored value and says markup was removed.
 *
 *  NOTHING TYPED IS LOST. A failed save keeps the text. `persist` keeps unsaved text as a draft
 *  per field in `sessionStorage` until the tab closes, which also carries it across a sign-in.
 *
 *  THE FIELD IS A TEXTAREA OR THE MARKUP EDITOR (`fieldInput.ts`), and everything here reads its
 *  value as the string it saves. The markup editor opens where `opensMarkupEditor` says, once the
 *  sheet has the decided Polish (`readPolish`) and the editor's chunk is in; until then a box holds
 *  the field's place, so the tags never flash in a textarea first. The box cannot be typed in, so it
 *  waits `PENDING_LIMIT_MS` at most: then the textarea takes over, and gives way to the markup
 *  editor later only if nobody has typed in it. A value the markup editor refuses, a chunk that
 *  does not load and a history that does not arrive leave the textarea.
 *
 *  THE CHECKLIST UNDER THE FIELD reads the string the field saves against the decided Polish
 *  (`checklist.ts`), so the textarea has it as much as the markup editor: what the server checks
 *  before it accepts a trusted save, in the server's order. In a trusted language a line under it
 *  says what a save will do; elsewhere an unticked item only warns. A missing slot is put back at
 *  the caret from its line. A quiet line compares emphasis with the Polish, which nothing holds.
 *
 *  THE FIELD STARTS FROM WHAT THE PAGE SHOWS THE EDITOR: their open proposal, else their
 *  accepted one not yet published (the preview prints it), else the published value. Starting an
 *  accepted field from the published text would make a second edit undo the first: the new
 *  proposal, once accepted, is the last decision `copy:apply` writes. The note starts empty
 *  there, since the old one explained a change the reviewers have settled. An untranslated field
 *  starts from the Polish the page prints in its place in the sheet's own field, tapped or picked
 *  from a list; in another language's editor it starts empty, and any text is worth saving there.
 *
 *  AN OPEN PROPOSAL CAN HIDE AN ACCEPTED ONE. The index carries only the open one; the sheet reads
 *  the accepted one beneath it from the desk history (`shipsBeneath`), so withdrawing the open one
 *  leaves the field showing what will still be published.
 *
 *  A TRUSTED LANGUAGE (every one but Polish, for a trusted translator) accepts a save at once.
 *  The change it made stays the editor's until it is published: the next save revises it and
 *  "Cofnij" withdraws it, like an open proposal. A save the server held back (`{ }` or links that
 *  differ from the Polish) keeps the sheet open and says why; the acceptance beneath still ships.
 *  A save with a note is addressed to the reviewers, so it waits for them, and the server takes
 *  the editor's own acceptance on the field along with it (`CopyDeskService.save_proposal`).
 * @module comment-mode/editor
 */

import {
  ApiError,
  saveProposal,
  withdrawProposal,
  type IndexRow,
  type OwnProposal,
  type StoredProposal,
} from "./api";
import type { Locale } from "../i18n/config";
import { checklist, emphasis, fieldMarkup, linkChoices, opensMarkupEditor, type ChecklistItem } from "./checklist";
import { button, el, fill, type Child } from "./dom";
import { loadRichField, pendingInput, textareaInput, type ValueInput } from "./fieldInput";
import { htmlText } from "./match";
import type { Strings } from "./strings";

export interface EditorEvents {
  /**
   * Stored and patched into `row.mine`. `clean`: stored as typed and not held back, so the editor
   * has nothing left to say.
   */
  saved(editor: FieldEditor, clean: boolean): void;
  withdrawn(editor: FieldEditor): void;
  /** The session ended under the editor: the bar offers a sign-in. */
  signedOut(): void;
  /** This account may not edit: the bar says so. */
  refused(): void;
}

export interface EditorOptions {
  readonly row: IndexRow;
  readonly locale: Locale;
  readonly strings: Strings;
  /** Start an untranslated field from the Polish the page prints in its place. */
  readonly startFromFallback: boolean;
  /** The reader's saves in this language are accepted without a review. */
  readonly trusted: boolean;
  /**
   * The decided Polish when the sheet already has the history (`null`: it holds none); left out,
   * `readPolish` brings it.
   */
  readonly polish?: string | null;
  readonly events: EditorEvents;
}

interface Draft {
  readonly value: string;
  readonly comment: string;
}

const DRAFT_PREFIX = "voct:comment-draft:";

/** How long the box keeps the field's place on a slow history or chunk before the textarea does. */
const PENDING_LIMIT_MS = 4000;

function readDraft(id: string): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_PREFIX + id);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<Draft>;
    return typeof draft.value === "string" && typeof draft.comment === "string"
      ? { value: draft.value, comment: draft.comment }
      : null;
  } catch {
    return null;
  }
}

function writeDraft(id: string, draft: Draft): void {
  try {
    window.sessionStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(draft));
  } catch {
    // Storage refused: the text lives as long as the sheet does.
  }
}

function clearDraft(id: string): void {
  try {
    window.sessionStorage.removeItem(DRAFT_PREFIX + id);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/** True when this tab keeps unsaved text for the field. */
export function hasDraft(id: string): boolean {
  return readDraft(id) !== null;
}

/** The server's tidying (`copydesk/sanitizers.py` `_tidy`): LF, no trailing spaces, one blank line. */
function tidy(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

/**
 * `value` as the browser's parser writes it back. The server re-emits an `HTML` field's text
 * escaped (`&` as `&amp;`), so two values compare as markup, not as strings.
 */
function asMarkup(value: string): string {
  const template = document.createElement("template");
  template.innerHTML = value;
  return template.innerHTML;
}

/** True when the server changed `typed` beyond its tidying: markup was removed. */
function sanitizedAway(kind: string, typed: string, stored: string): boolean {
  return kind === "HTML" ? asMarkup(stored) !== asMarkup(tidy(typed)) : stored !== tidy(typed);
}

/** The reader's proposal while it is still open, or `null` (none, or accepted and awaiting publication). */
export function openProposal(proposal: OwnProposal | null): OwnProposal | null {
  return proposal !== null && (proposal.status === "PROPOSED" || proposal.status === "DRAFT") ? proposal : null;
}

/** The reader's proposal once accepted and still awaiting publication, or `null`. */
export function acceptedProposal(proposal: OwnProposal | null): OwnProposal | null {
  return proposal?.status === "ACCEPTED" ? proposal : null;
}

/**
 * The reader's proposal a save revises and "Cofnij" withdraws: the open one, or in a trusted
 * language the change their own save accepted. `null` otherwise.
 */
export function revisableProposal(proposal: OwnProposal | null, trusted: boolean): OwnProposal | null {
  return openProposal(proposal) ?? (trusted && proposal?.self_accepted ? proposal : null);
}

const SPACE = /[\s   ]/u;
const FRENCH_MARKS = "?!:;";

/**
 * Where French text puts `? ! : ;` straight after a word. `typo.ts` makes an existing space
 * before them unbreakable and never inserts one, so a missing space stays missing on the page.
 * A colon between digits (a time) and before `//` (an address) is not punctuation.
 */
function missingFrenchSpaces(value: string, kind: string): string[] {
  const text = kind === "HTML" ? htmlText(value) : value;
  const found: string[] = [];
  for (let i = 1; i < text.length && found.length < 3; i++) {
    const mark = text[i];
    if (!FRENCH_MARKS.includes(mark)) continue;
    const before = text[i - 1];
    if (SPACE.test(before) || FRENCH_MARKS.includes(before)) continue;
    if (mark === ":" && ((/\d/u.test(before) && /\d/u.test(text[i + 1] ?? "")) || text.startsWith("//", i + 1))) {
      continue;
    }
    let start = i;
    while (start > 0 && i - start < 14 && !SPACE.test(text[start - 1])) start--;
    found.push(text.slice(start, i + 1));
  }
  return found;
}

export class FieldEditor {
  readonly row: IndexRow;
  readonly locale: Locale;
  readonly comment: HTMLTextAreaElement;
  /** The text field with its label and the hints beneath. */
  readonly valueField: HTMLElement;
  /** The note with its label. */
  readonly commentField: HTMLElement;
  /** The proposal's state: untranslated, stale, waiting, accepted. */
  readonly status: HTMLElement;
  /** "Draft restored", with a way to drop it; `null` when there was none. */
  readonly draftNote: HTMLElement | null;
  readonly message: HTMLElement;
  readonly save: HTMLButtonElement;
  readonly withdraw: HTMLButtonElement;
  private readonly strings: Strings;
  private readonly events: EditorEvents;
  private readonly trusted: boolean;
  /** What holds the text: a textarea, the markup editor, or the box keeping its place. */
  private input: ValueInput;
  private readonly valueLabel: HTMLLabelElement;
  private readonly hint: HTMLElement;
  /** How to type tags, over a textarea only. */
  private readonly markupNote: HTMLElement;
  /** What the server checks before it accepts a trusted save, ticked against `reference`. */
  private readonly checks: HTMLElement;
  /** The value's emphasis against the Polish's, where they differ. */
  private readonly emphasisNote: HTMLElement;
  /** The decided Polish the checklist reads, once the history is in; `null` before or without it. */
  private reference: string | null = null;
  /**
   * The editor's accepted proposal awaiting publication beneath the one they may still revise, or
   * the one the page shows when there is nothing to revise: it stands again after a withdrawal.
   */
  private accepted: OwnProposal | null;
  /**
   * What the textarea starts from when the editor has no proposal on the field, and what a value
   * without a note must differ from to be worth saving.
   */
  private readonly published: string;
  /** What the textarea and the note held when the editor opened, or after the last save. */
  private baseline: Draft;
  private saving = false;
  /** The editor has typed: from then on a disabled Save says why. */
  private touched = false;
  /** The editor has typed into the text: a textarea they typed in stays a textarea. */
  private valueTyped = false;
  /** The sheet let go of this editor; answers still arriving only patch the row. */
  private released = false;

  private readonly typed = (): void => {
    this.touched = true;
    this.refresh();
  };

  private readonly typedValue = (): void => {
    this.valueTyped = true;
    this.typed();
  };

  constructor({ row, locale, strings, startFromFallback, trusted, polish, events }: EditorOptions) {
    this.row = row;
    this.locale = locale;
    this.strings = strings;
    this.events = events;
    this.trusted = trusted;
    const s = strings;
    const own = revisableProposal(row.mine, trusted);
    // Beneath a revisable proposal the accepted one is unknown until the history arrives.
    this.accepted = own ? null : acceptedProposal(row.mine);
    this.published = startFromFallback ? row.value || row.fallback_value : row.value;
    this.baseline = own
      ? { value: own.value, comment: own.comment }
      : { value: this.accepted?.value ?? this.published, comment: "" };
    const draft = readDraft(row.id);
    const start = draft ?? this.baseline;

    this.valueLabel = el("label", "field-label", s.textLabel);
    this.valueLabel.id = `comment-mode-value-label-${locale}`;
    // `for` reaches a form control only: a click on the label hands the markup editor the focus.
    this.valueLabel.addEventListener("click", () => {
      if (this.input.kind === "rich") this.input.focus();
    });
    // Until the decided Polish is in, the Polish the page prints in the field's place stands for it.
    this.input = opensMarkupEditor({ kind: row.kind, value: start.value, polish: polish ?? row.fallback_value })
      ? pendingInput(start.value, row.kind, locale, this.valueLabel.id)
      : this.textarea(start.value);
    if (this.input.kind === "pending") {
      window.setTimeout(() => {
        if (!this.released) this.leavePending();
      }, PENDING_LIMIT_MS);
    }

    this.comment = el("textarea", "");
    this.comment.value = start.comment;
    this.comment.rows = 2;
    this.comment.id = `comment-mode-comment-${locale}`;

    const commentLabel = el("label", "field-label", s.commentLabel);
    commentLabel.htmlFor = this.comment.id;

    this.hint = el("p", "note");
    this.markupNote = el("p", "note", s.markupNote);
    this.checks = el("div", "checks");
    this.emphasisNote = el("p", "note");
    this.valueField = el(
      "div",
      "field",
      this.valueLabel,
      this.input.element,
      this.checks,
      this.emphasisNote,
      this.hint,
      this.markupNote,
    );
    this.fitInput();
    const commentHint = trusted ? s.commentHintTrusted : s.commentHint;
    this.commentField = el("div", "field", commentLabel, el("p", "note", commentHint), this.comment);
    this.status = el("div", "notes");
    this.message = el("p", "note");
    this.message.setAttribute("aria-live", "polite");
    this.save = button(s.save, () => void this.submit(), "btn btn-primary");
    this.withdraw = button(s.withdraw, () => void this.retract(), "btn");
    this.draftNote = draft
      ? el("div", "draft note note-warn", s.draftRestored, button(s.discardDraft, () => this.discardDraft(), "btn btn-quiet"))
      : null;

    this.comment.addEventListener("input", this.typed);
    this.renderStatus();
    this.refresh();
    if (polish !== undefined) this.readPolish(polish);
  }

  /** The text differs from what the editor opened with or last saved. */
  get dirty(): boolean {
    return this.input.value !== this.baseline.value || this.comment.value !== this.baseline.comment;
  }

  focus(): void {
    this.input.focus();
  }

  /**
   * The decided Polish beside the field (`decidedPolish`), or `null` when the sheet could not read
   * the history. Where the field opens the markup editor, it mounts once its chunk is in too; a
   * field left without it is a textarea.
   */
  readPolish(polish: string | null): void {
    void this.settle(polish);
  }

  private async settle(polish: string | null): Promise<void> {
    const { kind } = this.row;
    if (this.released) return;
    this.reference = polish;
    this.refresh();
    if (polish === null || !opensMarkupEditor({ kind, value: this.input.value, polish })) {
      this.leavePending();
      return;
    }
    if (!this.swappable()) return;
    let chunk: Awaited<ReturnType<typeof loadRichField>> | null = null;
    try {
      chunk = await loadRichField();
    } catch {
      // The textarea stands in.
    }
    if (this.released || !this.swappable()) return;
    const rich = chunk?.richField({
      value: this.input.value,
      markup: fieldMarkup(kind, polish),
      // On a Polish row the text it started from is Polish too: its links are offered beside these.
      links: linkChoices(polish, ...(this.locale === "pl" ? [this.baseline.value, this.input.value] : [])),
      strings: this.strings,
      locale: this.locale,
      labelledBy: this.valueLabel.id,
      onInput: this.typedValue,
    });
    if (rich) this.useInput(rich);
    else this.leavePending();
  }

  /** The input may still give way to the markup editor: it holds the place, or nobody typed in it. */
  private swappable(): boolean {
    return this.input.kind === "pending" || (this.input.kind === "textarea" && !this.valueTyped);
  }

  private leavePending(): void {
    if (this.input.kind === "pending") this.useInput(this.textarea(this.input.value));
  }

  private textarea(value: string): ValueInput {
    return textareaInput(value, `comment-mode-value-${this.locale}`, this.locale, this.typedValue);
  }

  /** `next` in the field in place of the current input, with the focus if the current one had it. */
  private useInput(next: ValueInput): void {
    const previous = this.input;
    const root = previous.element.getRootNode();
    const active = root instanceof ShadowRoot || root instanceof Document ? root.activeElement : null;
    const focused = active !== null && previous.element.contains(active);
    previous.element.replaceWith(next.element);
    previous.destroy();
    this.input = next;
    this.fitInput();
    // The checklist offers to put a slot back only where the input can.
    this.refresh();
    if (focused) next.focus();
  }

  /** The label and the markup note follow the input that holds the text. */
  private fitInput(): void {
    if (this.input.kind === "textarea") this.valueLabel.htmlFor = this.input.element.id;
    else this.valueLabel.removeAttribute("for");
    this.markupNote.hidden = !(this.input.kind === "textarea" && this.row.kind === "HTML");
  }

  /** `value` in the field; one the markup editor refuses opens in a textarea. */
  private show(value: string): void {
    if (!this.input.setValue(value)) this.useInput(this.textarea(value));
  }

  get busy(): boolean {
    return this.saving;
  }

  /** The editor's accepted proposal that the revisable one stands over, read from the desk history. */
  shipsBeneath(accepted: OwnProposal | null): void {
    if (this.own()) this.accepted = accepted;
  }

  /** The proposal a save revises and "Cofnij" withdraws (`revisableProposal`). */
  private own(): OwnProposal | null {
    return revisableProposal(this.row.mine, this.trusted);
  }

  /** Keep unsaved text as this tab's draft, or drop a draft the text has caught up with. */
  persist(): void {
    if (this.dirty) writeDraft(this.row.id, { value: this.input.value, comment: this.comment.value });
    else clearDraft(this.row.id);
  }

  /** The sheet is done with this editor: persist, and let answers in flight only patch the row. */
  release(): void {
    this.persist();
    this.released = true;
    this.input.destroy();
  }

  private discardDraft(): void {
    clearDraft(this.row.id);
    this.show(this.baseline.value);
    this.comment.value = this.baseline.comment;
    this.draftNote?.remove();
    this.refresh();
  }

  /** Why Save is off, or `null` when it may go. */
  private blocker(): string | null {
    const s = this.strings;
    const value = this.input.value;
    const comment = this.comment.value.trim();
    if (value.trim() === "") return s.empty;
    const accepted = acceptedProposal(this.row.mine);
    const own = this.own();
    // Over an accepted proposal the published text is a real proposal: it takes the change back.
    if (!accepted && tidy(value) === tidy(this.published) && comment === "") return s.nothingToSave;
    if (accepted && accepted !== own && tidy(value) === tidy(accepted.value) && comment === "") {
      return s.nothingToSave;
    }
    if (own && tidy(value) === tidy(own.value) && comment === own.comment.trim()) return s.nothingToSave;
    return null;
  }

  private refresh(): void {
    const s = this.strings;
    const blocker = this.blocker();
    this.save.disabled = this.saving || blocker !== null;
    this.save.textContent = this.saving ? s.saving : s.save;

    const value = this.input.value;
    const french = this.locale === "fr" ? missingFrenchSpaces(value, this.row.kind) : [];
    let hint = "";
    let warn = false;
    if (blocker === s.empty && (this.touched || value !== "")) {
      hint = blocker;
      warn = true;
    } else if (french.length > 0) {
      hint = s.frenchMissingSpace(french.join(", "));
      warn = true;
    } else if (blocker && this.touched) {
      hint = blocker;
    }
    this.hint.textContent = hint;
    this.hint.className = warn ? "note note-warn" : "note";
    this.hint.hidden = hint === "";
    this.renderChecks(value);
  }

  /** The checklist and the emphasis hint for `value`, once the decided Polish is in. */
  private renderChecks(value: string): void {
    const s = this.strings;
    const polish = this.reference;
    const { kind } = this.row;
    // "Not empty" is the Save hint's to say.
    const items = polish === null ? [] : checklist({ value, polish, kind }).filter((item) => item.kind !== "filled");
    if (polish === null || items.length === 0) {
      this.checks.replaceChildren();
      this.checks.hidden = true;
    } else {
      const words = new Map(linkChoices(polish).map((link) => [link.href, link.words]));
      const braceLink = fieldMarkup(kind, polish).braceLink;
      const ok = items.every((item) => item.ok);
      const outcome = !this.trusted
        ? null
        : !ok
          ? s.checkTrustedHeld
          : this.comment.value.trim() !== ""
            ? s.checkTrustedNoted
            : s.checkTrustedOk;
      fill(
        this.checks,
        el("p", "checks-head", s.checksHead),
        el("ul", "checks-list", ...items.map((item) => this.checkLine(item, words, braceLink))),
        outcome ? el("p", ok ? "note" : "note note-warn", outcome) : null,
      );
      this.checks.hidden = false;
    }

    const compared =
      polish !== null && kind === "HTML" && this.locale !== "pl" && value.trim() !== "" ? emphasis(value, polish) : null;
    if (compared && !compared.same) {
      const { value: here, polish: there } = compared;
      this.emphasisNote.textContent = s.emphasisHint(
        here.em === there.em ? null : [here.em, there.em],
        here.strong === there.strong ? null : [here.strong, there.strong],
      );
      this.emphasisNote.hidden = false;
    } else {
      this.emphasisNote.hidden = true;
    }
  }

  /** One line of the checklist: ticked or not, what it checks, and a way to put a slot back. */
  private checkLine(item: ChecklistItem, words: ReadonlyMap<string, string>, braceLink: boolean): HTMLElement {
    const s = this.strings;
    let parts: Child[] = [];
    if (item.kind === "slot") {
      parts = [el("span", "slot", item.slot)];
    } else if (item.kind === "braces") {
      parts = [(braceLink ? s.checkBraceLink : s.checkBraces)(item.actual, item.expected)];
    } else if (item.kind === "link") {
      const said = words.get(item.href);
      parts = [said ? `${s.quoted(said)} → ` : null, el("span", "check-href", item.href)];
    } else if (item.kind === "extraLink") {
      parts = [`${s.checkExtraLink} → `, el("span", "check-href", item.href)];
    }
    const mark = el("span", "check-mark", item.ok ? "✓" : "✗");
    mark.setAttribute("aria-hidden", "true");
    const missing = !item.ok && item.kind !== "extraLink";
    const insert = this.input.insertSlot;
    return el(
      "li",
      item.ok ? "check" : "check is-missing",
      mark,
      el("span", "check-text", ...parts),
      missing ? el("span", "sr", s.checkMissing) : null,
      item.kind === "slot" && !item.ok && insert
        ? button(s.insertSlot, () => this.putBack(insert, item.slot), "btn btn-quiet")
        : null,
    );
  }

  /** A slot back at the caret; the focus follows it where that raises no touch keyboard. */
  private putBack(insert: (slot: string) => void, slot: string): void {
    insert(slot);
    if (!window.matchMedia("(pointer: coarse)").matches) this.input.focus();
  }

  private renderStatus(): void {
    const { row, strings: s } = this;
    const lines: string[] = [];
    if (!row.value) lines.push(s.untranslated);
    if (row.is_stale) lines.push(s.stale);
    if (openProposal(row.mine)) lines.push(s.mineOpen);
    else if (row.mine?.status === "ACCEPTED") lines.push(this.trusted ? s.mineAcceptedTrusted : s.mineAccepted);
    this.status.replaceChildren(...lines.map((line) => el("p", "note note-warn", line)));
    this.status.hidden = lines.length === 0;
    this.withdraw.hidden = !this.own();
    this.withdraw.textContent = this.withdrawLabel();
  }

  private withdrawLabel(): string {
    return this.own()?.status === "ACCEPTED" ? this.strings.withdrawChange : this.strings.withdraw;
  }

  /** What a save says when it is through: held back, changed by the sanitizer, accepted, or saved. */
  private outcome(stored: StoredProposal, clean: boolean): { readonly text: string; readonly warn: boolean } {
    const s = this.strings;
    if (stored.held === "slots") return { text: s.heldSlots, warn: true };
    if (stored.held === "links") return { text: s.heldLinks, warn: true };
    if (stored.held === "empty") return { text: s.empty, warn: true };
    if (!clean) return { text: s.sanitized, warn: true };
    return { text: stored.status === "ACCEPTED" ? s.savedAccepted : s.savedHere, warn: false };
  }

  say(text: string, tone: "plain" | "warn" | "error"): void {
    this.message.textContent = text;
    this.message.className = tone === "plain" ? "note" : `note note-${tone}`;
  }

  private async submit(): Promise<void> {
    if (this.saving || this.blocker() !== null) return;
    const s = this.strings;
    const typed = this.input.value;
    const comment = this.comment.value;
    this.saving = true;
    this.say("", "plain");
    this.refresh();
    try {
      const previous = this.row.mine;
      const noted = this.trusted && comment.trim() !== "";
      const stored = await saveProposal(this.row.id, typed, comment);
      if (stored.status !== "ACCEPTED") {
        // A note took the editor's own acceptance to the reviewers: it became this proposal, or the
        // server withdrew it beside this one. Nothing of theirs ships there until the verdict.
        if (noted) {
          if (this.accepted?.self_accepted) this.accepted = null;
        }
        // Held back beside the editor's acceptance, the new proposal leaves that acceptance to ship.
        else if (previous?.status === "ACCEPTED") this.accepted = previous;
      }
      // Accepted, it replaces the editor's own acceptance it stood beside: the server withdrew that one.
      else if (stored.self_accepted && this.accepted?.self_accepted) this.accepted = null;
      this.row.mine = {
        id: stored.id,
        status: stored.status,
        value: stored.value,
        comment: stored.comment,
        self_accepted: stored.self_accepted,
      };
      clearDraft(this.row.id);
      const clean = !sanitizedAway(this.row.kind, typed, stored.value);
      this.baseline = clean ? { value: typed, comment } : { value: stored.value, comment: stored.comment };
      if (!this.released) {
        if (!clean) {
          this.show(stored.value);
          this.comment.value = stored.comment;
        }
        const said = this.outcome(stored, clean);
        this.say(said.text, said.warn ? "warn" : "plain");
        this.touched = false;
        this.renderStatus();
      }
      this.events.saved(this, clean && stored.held === null);
    } catch (error) {
      if (this.released) writeDraft(this.row.id, { value: typed, comment });
      else this.failed(error, s.saveFailed);
    } finally {
      this.saving = false;
      if (!this.released) this.refresh();
    }
  }

  private async retract(): Promise<void> {
    const own = this.own();
    if (!own || this.saving) return;
    const s = this.strings;
    this.saving = true;
    this.withdraw.disabled = true;
    this.withdraw.textContent = s.withdrawing;
    this.refresh();
    try {
      await withdrawProposal(own.id);
      this.forget();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Already gone: what the editor asked for is the state of things.
        this.forget();
      } else if (!this.released) {
        if (error instanceof ApiError && error.status === 409) this.say(s.settled, "error");
        else this.failed(error, s.withdrawFailed);
      }
    } finally {
      this.saving = false;
      this.withdraw.disabled = false;
      this.withdraw.textContent = this.withdrawLabel();
      if (!this.released) this.refresh();
    }
  }

  private forget(): void {
    this.row.mine = this.accepted;
    clearDraft(this.row.id);
    if (!this.released) {
      this.baseline = { value: this.accepted?.value ?? this.published, comment: "" };
      this.show(this.baseline.value);
      this.comment.value = "";
      this.touched = false;
      this.say(this.strings.withdrawnHere, "plain");
      this.renderStatus();
    }
    this.events.withdrawn(this);
  }

  private failed(error: unknown, fallback: string): void {
    const s = this.strings;
    if (error instanceof ApiError && error.status === 401) {
      writeDraft(this.row.id, { value: this.input.value, comment: this.comment.value });
      this.say(s.sessionEnded, "error");
      this.events.signedOut();
    } else if (error instanceof ApiError && error.status === 403 && !error.csrf) {
      this.say(s.refused, "error");
      this.events.refused();
    } else {
      this.say(fallback, "error");
    }
  }
}
