/**
 * @file sheet.ts
 * @description The edit sheet: one field, rewritten whole, saved as the editor's proposal.
 *
 *  SAVE IS EXPLICIT. Over a public page an explicit act is what closes the sheet. Every save sends
 *  `value`, `comment` and `status: "PROPOSED"` (`api.saveProposal`), and the button is disabled
 *  while one is in flight, because two first saves at once end in a server error. An empty value is
 *  refused here with the reason: the server would accept it and only `copy:apply` refuses it. An
 *  unchanged value with a note is a real proposal; an unchanged value without one has nothing to
 *  save.
 *
 *  WHAT WAS STORED IS WHAT IS SHOWN. The server sanitizes (inline `em, strong, a, code` survive)
 *  and tidies whitespace. When the stored value differs from what was typed beyond that tidying,
 *  the sheet stays open with the stored value and says markup was removed.
 *
 *  NOTHING TYPED IS LOST. A failed save keeps the sheet and the text. Closing with unsaved text
 *  keeps a draft per field in `sessionStorage` until the tab closes, which also carries it across
 *  a sign-in.
 *
 *  THE TEXTAREA STARTS FROM WHAT THE PAGE SHOWS THE EDITOR: their open proposal, else their
 *  accepted one not yet published (the preview prints it), else the published value. Starting an
 *  accepted field from the published text would make a second edit undo the first: the new
 *  proposal, once accepted, is the last decision `copy:apply` writes. The note starts empty
 *  there, since the old one explained a change the reviewers have settled.
 *
 *  Beside the textarea, read when the sheet opens (`GET segments/?scope=`): the field in the other
 *  languages, Polish first, for reference; and other editors' open proposals on it.
 *
 *  ON A PHONE the sheet sits on the keyboard: what the keyboard covers is read from
 *  `visualViewport` on `resize` and `scroll` (the formula of the panel's `useKeyboardInset`), and
 *  the sheet never grows taller than what is visible. A touch tap does not focus the textarea, so
 *  the keyboard does not cover the page the moment the sheet opens.
 * @architecture Astro islands 2026
 * @module comment-mode/sheet
 */

import {
  ApiError,
  fetchScopeSegments,
  saveProposal,
  withdrawProposal,
  type DeskSegment,
  type IndexRow,
  type OwnProposal,
} from "./api";
import { LOCALES, type Locale } from "../i18n/config";
import { button, el } from "./dom";
import { htmlText } from "./match";
import { FRENCH_SPACING_NOTE, type Strings } from "./strings";

export interface SheetEvents {
  saved(row: IndexRow): void;
  withdrawn(row: IndexRow): void;
  /** The session ended under the sheet: the bar offers a sign-in. */
  signedOut(): void;
  /** This account may not edit: the bar says so. */
  refused(): void;
  closed(): void;
}

interface Draft {
  readonly value: string;
  readonly comment: string;
}

const DRAFT_PREFIX = "voct:comment-draft:";

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

/** The server's tidying (`copydesk/sanitizers.py` `_tidy`): LF, no trailing spaces, one blank line. */
function tidy(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

/** The reader's proposal while it is still open, or `null` (none, or accepted and awaiting publication). */
function openProposal(proposal: OwnProposal | null): OwnProposal | null {
  return proposal !== null && (proposal.status === "PROPOSED" || proposal.status === "DRAFT") ? proposal : null;
}

/** The reader's proposal once accepted and still awaiting publication, or `null`. */
function acceptedProposal(proposal: OwnProposal | null): OwnProposal | null {
  return proposal?.status === "ACCEPTED" ? proposal : null;
}

/** Below this many covered pixels the viewport only lost a toolbar, not to a keyboard. */
const KEYBOARD_MIN = 80;

const SPACE = /[\s   ]/u;
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

function textareaRows(value: string): number {
  return Math.min(14, Math.max(3, Math.ceil(value.length / 46) + value.split("\n").length - 1));
}

/** What the open sheet holds. */
interface Session {
  readonly row: IndexRow;
  readonly locale: Locale;
  readonly strings: Strings;
  /** The editor's accepted proposal when the sheet opened: it stands again if a newer one is withdrawn. */
  readonly accepted: OwnProposal | null;
  /** What the textarea and the note held when the sheet opened, or after the last save. */
  baseline: Draft;
  saving: boolean;
  /** The editor has typed: from then on a disabled Save says why. */
  touched: boolean;
  readonly value: HTMLTextAreaElement;
  readonly comment: HTMLTextAreaElement;
  readonly hint: HTMLElement;
  readonly status: HTMLElement;
  readonly message: HTMLElement;
  readonly save: HTMLButtonElement;
  readonly withdraw: HTMLButtonElement;
  readonly details: HTMLElement;
}

export class Sheet {
  readonly element: HTMLElement;
  private readonly events: SheetEvents;
  private current: Session | null = null;
  private readonly fitKeyboard = (): void => {
    const viewport = window.visualViewport;
    const covered = viewport ? Math.max(0, Math.round(window.innerHeight - (viewport.height + viewport.offsetTop))) : 0;
    const visible = Math.round(viewport?.height ?? window.innerHeight);
    this.element.style.setProperty("--cm-keyboard", `${covered}px`);
    this.element.style.setProperty("--cm-visible", `${visible}px`);
    this.element.classList.toggle("has-keyboard", covered > KEYBOARD_MIN);
  };

  constructor(root: ShadowRoot, events: SheetEvents) {
    this.events = events;
    this.element = el("div", "panel sheet");
    this.element.setAttribute("role", "dialog");
    this.element.tabIndex = -1;
    this.element.hidden = true;
    root.append(this.element);
  }

  get isOpen(): boolean {
    return this.current !== null;
  }

  /** The field being edited, if any. */
  get row(): IndexRow | null {
    return this.current?.row ?? null;
  }

  open(row: IndexRow, locale: Locale, strings: Strings): void {
    this.close();
    const s = strings;
    const printed = row.value || row.fallback_value;
    const own = openProposal(row.mine);
    const accepted = acceptedProposal(row.mine);
    const baseline: Draft = own
      ? { value: own.value, comment: own.comment }
      : { value: accepted?.value ?? printed, comment: "" };
    const draft = readDraft(row.id);
    const start = draft ?? baseline;

    const value = el("textarea", "");
    value.value = start.value;
    value.rows = textareaRows(start.value);
    value.spellcheck = true;
    value.lang = locale;
    value.id = "comment-mode-value";

    const comment = el("textarea", "");
    comment.value = start.comment;
    comment.rows = 2;
    comment.id = "comment-mode-comment";

    const valueLabel = el("label", "field-label", s.textLabel);
    valueLabel.htmlFor = value.id;
    const commentLabel = el("label", "field-label", s.commentLabel);
    commentLabel.htmlFor = comment.id;

    const session: Session = {
      row,
      locale,
      strings: s,
      accepted,
      baseline,
      saving: false,
      touched: false,
      value,
      comment,
      hint: el("p", "note"),
      status: el("div", "notes"),
      message: el("p", "note"),
      save: button(s.save, () => void this.submit(), "btn btn-primary"),
      withdraw: button(s.withdraw, () => void this.retract(), "btn"),
      details: el("div", "notes", el("p", "note", s.detailsLoading)),
    };
    session.message.setAttribute("aria-live", "polite");
    this.current = session;

    const draftNote = draft
      ? el(
          "div",
          "draft note note-warn",
          s.draftRestored,
          button(s.discardDraft, () => this.discardDraft(), "btn btn-quiet"),
        )
      : null;

    const notes: Node[] = [];
    if (locale === "fr") notes.push(el("p", "note", FRENCH_SPACING_NOTE));
    if (row.kind === "HTML") notes.push(el("p", "note", s.markupNote));

    this.element.setAttribute("aria-label", s.sheetLabel);
    this.element.replaceChildren(
      el(
        "div",
        "sheet-head",
        el(
          "div",
          "sheet-heading",
          el("p", "sheet-title", row.label || row.key),
          el("p", "sheet-scope", row.scope_label),
        ),
        button(s.close, () => this.close(), "btn"),
      ),
      el(
        "div",
        "sheet-body",
        session.status,
        draftNote,
        el("div", "field", valueLabel, value, session.hint),
        notes.length > 0 ? el("div", "notes", ...notes) : null,
        el("div", "field", commentLabel, el("p", "note", s.commentHint), comment),
        session.message,
        session.details,
      ),
      el("div", "sheet-foot", session.save, session.withdraw, el("span", "grow")),
    );
    this.element.hidden = false;

    const typed = (): void => {
      session.touched = true;
      this.refresh();
    };
    value.addEventListener("input", typed);
    comment.addEventListener("input", typed);
    this.renderStatus();
    this.refresh();
    void this.loadDetails(session);

    this.fitKeyboard();
    window.visualViewport?.addEventListener("resize", this.fitKeyboard);
    window.visualViewport?.addEventListener("scroll", this.fitKeyboard);
    if (window.matchMedia("(pointer: coarse)").matches) this.element.focus({ preventScroll: true });
    else value.focus({ preventScroll: true });
  }

  focusText(): void {
    this.current?.value.focus({ preventScroll: true });
  }

  /** Close, keeping unsaved text as a draft for this tab. */
  close(): void {
    const session = this.current;
    if (!session) return;
    const draft: Draft = { value: session.value.value, comment: session.comment.value };
    if (draft.value !== session.baseline.value || draft.comment !== session.baseline.comment) {
      writeDraft(session.row.id, draft);
    } else {
      clearDraft(session.row.id);
    }
    this.dismiss();
  }

  private dismiss(): void {
    this.current = null;
    window.visualViewport?.removeEventListener("resize", this.fitKeyboard);
    window.visualViewport?.removeEventListener("scroll", this.fitKeyboard);
    this.element.hidden = true;
    this.element.replaceChildren();
    this.events.closed();
  }

  private discardDraft(): void {
    const session = this.current;
    if (!session) return;
    clearDraft(session.row.id);
    session.value.value = session.baseline.value;
    session.comment.value = session.baseline.comment;
    session.value.rows = textareaRows(session.baseline.value);
    this.element.querySelector(".draft")?.remove();
    this.refresh();
  }

  /** Why Save is off, or `null` when it may go. */
  private blocker(session: Session): string | null {
    const s = session.strings;
    const value = session.value.value;
    const comment = session.comment.value.trim();
    if (value.trim() === "") return s.empty;
    const printed = session.row.value || session.row.fallback_value;
    const accepted = acceptedProposal(session.row.mine);
    // Over an accepted proposal the published text is a real proposal: it takes the change back.
    if (!accepted && tidy(value) === tidy(printed) && comment === "") return s.nothingToSave;
    if (accepted && tidy(value) === tidy(accepted.value) && comment === "") return s.nothingToSave;
    const own = openProposal(session.row.mine);
    if (own && tidy(value) === tidy(own.value) && comment === own.comment.trim()) return s.nothingToSave;
    return null;
  }

  private refresh(): void {
    const session = this.current;
    if (!session) return;
    const blocker = this.blocker(session);
    session.save.disabled = session.saving || blocker !== null;
    session.save.textContent = session.saving ? session.strings.saving : session.strings.save;

    const s = session.strings;
    const french = session.locale === "fr" ? missingFrenchSpaces(session.value.value, session.row.kind) : [];
    let hint = "";
    let warn = false;
    if (blocker === s.empty) {
      hint = blocker;
      warn = true;
    } else if (french.length > 0) {
      hint = s.frenchMissingSpace(french.join(", "));
      warn = true;
    } else if (blocker && session.touched) {
      hint = blocker;
    }
    session.hint.textContent = hint;
    session.hint.className = warn ? "note note-warn" : "note";
    session.hint.hidden = hint === "";
  }

  private renderStatus(): void {
    const session = this.current;
    if (!session) return;
    const { row, strings: s } = session;
    const lines: string[] = [];
    if (row.fallback_value) lines.push(s.untranslated);
    if (row.is_stale) lines.push(s.stale);
    if (openProposal(row.mine)) lines.push(s.mineOpen);
    else if (row.mine?.status === "ACCEPTED") lines.push(s.mineAccepted);
    session.status.replaceChildren(...lines.map((line) => el("p", "note note-warn", line)));
    session.status.hidden = lines.length === 0;
    session.withdraw.hidden = !openProposal(row.mine);
  }

  private say(session: Session, text: string, tone: "plain" | "warn" | "error"): void {
    session.message.textContent = text;
    session.message.className = tone === "plain" ? "note" : `note note-${tone}`;
  }

  private async submit(): Promise<void> {
    const session = this.current;
    if (!session || session.saving || this.blocker(session) !== null) return;
    const s = session.strings;
    const typed = session.value.value;
    const comment = session.comment.value;
    session.saving = true;
    this.say(session, "", "plain");
    this.refresh();
    try {
      const stored = await saveProposal(session.row.id, typed, comment);
      session.row.mine = { id: stored.id, status: stored.status, value: stored.value, comment: stored.comment };
      clearDraft(session.row.id);
      this.events.saved(session.row);
      if (this.current !== session) return;
      if (stored.value !== tidy(typed)) {
        session.baseline = { value: stored.value, comment: stored.comment };
        session.value.value = stored.value;
        session.comment.value = stored.comment;
        this.say(session, s.sanitized, "warn");
        this.renderStatus();
        return;
      }
      this.dismiss();
    } catch (error) {
      if (this.current === session) this.failed(session, error, s.saveFailed);
      else writeDraft(session.row.id, { value: typed, comment });
    } finally {
      session.saving = false;
      if (this.current === session) this.refresh();
    }
  }

  private async retract(): Promise<void> {
    const session = this.current;
    const own = session ? openProposal(session.row.mine) : null;
    if (!session || !own || session.saving) return;
    const s = session.strings;
    session.saving = true;
    session.withdraw.disabled = true;
    session.withdraw.textContent = s.withdrawing;
    this.refresh();
    try {
      await withdrawProposal(own.id);
      this.forget(session);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Already gone: what the editor asked for is the state of things.
        this.forget(session);
      } else if (this.current === session) {
        if (error instanceof ApiError && error.status === 409) this.say(session, s.settled, "error");
        else this.failed(session, error, s.withdrawFailed);
      }
    } finally {
      session.saving = false;
      session.withdraw.disabled = false;
      session.withdraw.textContent = s.withdraw;
      if (this.current === session) this.refresh();
    }
  }

  private forget(session: Session): void {
    session.row.mine = session.accepted;
    clearDraft(session.row.id);
    this.events.withdrawn(session.row);
    if (this.current === session) this.dismiss();
  }

  private failed(session: Session, error: unknown, fallback: string): void {
    const s = session.strings;
    if (error instanceof ApiError && error.status === 401) {
      writeDraft(session.row.id, { value: session.value.value, comment: session.comment.value });
      this.say(session, s.sessionEnded, "error");
      this.events.signedOut();
    } else if (error instanceof ApiError && error.status === 403 && !error.csrf) {
      this.say(session, s.refused, "error");
      this.events.refused();
    } else {
      this.say(session, fallback, "error");
    }
  }

  private async loadDetails(session: Session): Promise<void> {
    const s = session.strings;
    let rows: readonly DeskSegment[];
    try {
      rows = (await fetchScopeSegments(session.row.scope)).filter((segment) => segment.key === session.row.key);
    } catch {
      if (this.current === session) session.details.replaceChildren(el("p", "note", s.detailsFailed));
      return;
    }
    if (this.current !== session) return;

    const others = LOCALES.filter((locale) => locale !== session.locale)
      .map((locale) => rows.find((segment) => segment.locale === locale))
      .filter((segment): segment is DeskSegment => segment !== undefined);
    const languages = el("details", "");
    languages.append(
      el("summary", "", s.otherLanguages),
      el(
        "ul",
        "reference",
        ...others.map((segment) =>
          el(
            "li",
            "",
            el("p", "reference-head", s.localeNames[segment.locale]),
            segment.value
              ? el("p", "reference-text", segment.value)
              : el("p", "reference-empty", s.notTranslated),
          ),
        ),
      ),
    );

    const own = rows.find((segment) => segment.locale === session.locale);
    const pending = (own?.proposals ?? []).filter(
      (proposal) => !proposal.is_mine && (proposal.status === "PROPOSED" || proposal.status === "DRAFT"),
    );
    const proposals =
      pending.length > 0
        ? el(
            "details",
            "",
            el("summary", "", `${s.othersProposals} (${pending.length})`),
            el(
              "ul",
              "reference",
              ...pending.map((proposal) =>
                el(
                  "li",
                  "",
                  el("p", "reference-head", proposal.author_name),
                  el("p", "reference-text", proposal.value),
                  proposal.comment ? el("p", "note", proposal.comment) : null,
                ),
              ),
            ),
          )
        : null;
    if (proposals) proposals.open = true;

    session.details.replaceChildren(...(others.length > 0 ? [languages] : []), ...(proposals ? [proposals] : []));
  }
}
