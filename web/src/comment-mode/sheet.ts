/**
 * @file sheet.ts
 * @description The edit sheet: a side panel on desktop, a bottom sheet on a phone. It holds either
 *  one field to rewrite or a list of the page's fields to pick one from ("Pozostałe teksty", the
 *  editor's proposals on the page; `lists.ts` builds them).
 *
 *  THE FIELD is edited by a `FieldEditor` (`editor.ts`). A clean save or a withdrawal closes the
 *  sheet, unless another language in it still holds unsaved text; a save the server changed keeps
 *  it open with the stored value.
 *
 *  BESIDE IT, read when the sheet opens (`GET segments/?scope=`, every locale with its history):
 *  - the other languages, Polish first, collapsed. Each reads as text with "Popraw", which turns it
 *    into an editor of its own: one sentence fixed in all three without finding it again, each
 *    language its own proposal. A language holding the editor's draft or open proposal opens as an
 *    editor at once. The editor's own proposal there is read from the history by the site index's
 *    rule: the open one, else the accepted, unapplied one that is the field's latest acceptance;
 *  - the current Polish, beneath the warning, when the translation is stale;
 *  - other editors' open proposals on the field.
 *
 *  ON A PHONE the sheet sits on the keyboard: what the keyboard covers is read from
 *  `visualViewport` on `resize` and `scroll` (the formula of the panel's `useKeyboardInset`), and
 *  the sheet never grows taller than what is visible. A touch tap does not focus the textarea, so
 *  the keyboard does not cover the page the moment the sheet opens.
 * @architecture Astro islands 2026
 * @module comment-mode/sheet
 */

import { fetchScopeSegments, type DeskProposal, type DeskSegment, type IndexRow, type OwnProposal } from "./api";
import { LOCALES, type Locale } from "../i18n/config";
import { button, el, fill } from "./dom";
import { FieldEditor, hasDraft, openProposal, type EditorEvents } from "./editor";
import { FRENCH_SPACING_NOTE, type Strings } from "./strings";

export interface SheetEvents {
  saved(row: IndexRow, locale: Locale): void;
  withdrawn(row: IndexRow, locale: Locale): void;
  /** The session ended under the sheet: the bar offers a sign-in. */
  signedOut(): void;
  /** This account may not edit: the bar says so. */
  refused(): void;
  /** The sheet left the screen, a field or a list. */
  closed(): void;
}

export interface OpenOptions {
  /** The list the field was picked from: the sheet offers the way back to it. */
  readonly back?: () => void;
}

/** Below this many covered pixels the viewport only lost a toolbar, not to a keyboard. */
const KEYBOARD_MIN = 80;

/** What the open sheet holds while it edits a field. */
interface Session {
  readonly row: IndexRow;
  readonly locale: Locale;
  readonly strings: Strings;
  readonly main: FieldEditor;
  /** The other languages the editor has opened, each its own proposal. */
  readonly others: Map<Locale, FieldEditor>;
  /** Where the current Polish goes when the translation is stale. */
  readonly polish: HTMLElement;
  readonly details: HTMLElement;
}

function ownOf(proposal: DeskProposal): OwnProposal {
  return { id: proposal.id, status: proposal.status, value: proposal.value, comment: proposal.comment };
}

/** When a proposal was decided; an undecided one counts as the latest, as Postgres sorts NULLs last. */
function decidedAt(proposal: DeskProposal): number {
  return proposal.reviewed_at ? Date.parse(proposal.reviewed_at) : Number.POSITIVE_INFINITY;
}

/**
 * The reader's accepted proposal not yet applied, while it is the field's latest acceptance: the
 * decision `copy:apply` writes last. The site index's rule (`CopyDeskService.site_index`): latest
 * `reviewed_at`, then latest `created_at`. `segments/` lists the newest first, so on a tie the
 * first one met stands.
 */
function ownShipping(proposals: readonly DeskProposal[]): OwnProposal | null {
  let shipping: DeskProposal | null = null;
  for (const proposal of proposals) {
    if (proposal.status !== "ACCEPTED" || proposal.applied_at) continue;
    if (!shipping || decidedAt(proposal) > decidedAt(shipping)) shipping = proposal;
  }
  return shipping?.is_mine ? ownOf(shipping) : null;
}

/** The reader's proposal on a field, by the site index's rule: the open one, else the one that ships. */
function ownProposalOf(proposals: readonly DeskProposal[]): OwnProposal | null {
  const open = proposals.find((p) => p.is_mine && (p.status === "PROPOSED" || p.status === "DRAFT"));
  return open ? ownOf(open) : ownShipping(proposals);
}

/** Another language of `main` as an index row, so it is edited exactly as the tapped one is. */
function sideRow(main: IndexRow, segment: DeskSegment): IndexRow {
  return {
    id: segment.id,
    key: segment.key,
    scope: main.scope,
    scope_label: main.scope_label,
    scope_path: main.scope_path,
    label: main.label,
    kind: segment.kind,
    value: segment.value,
    fallback_value: segment.value ? "" : segment.source_value,
    is_stale: segment.is_stale,
    mine: ownProposalOf(segment.proposals),
    others_open: segment.proposals.filter((p) => !p.is_mine && (p.status === "PROPOSED" || p.status === "DRAFT"))
      .length,
  };
}

export class Sheet {
  readonly element: HTMLElement;
  private readonly events: SheetEvents;
  private current: Session | null = null;
  private listShown = false;
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
    return this.current !== null || this.listShown;
  }

  /** The field being edited, if any. */
  get row(): IndexRow | null {
    return this.current?.row ?? null;
  }

  /** True while the sheet shows a list rather than a field. */
  get showsList(): boolean {
    return this.listShown;
  }

  open(row: IndexRow, locale: Locale, strings: Strings, options: OpenOptions = {}): void {
    this.close();
    const s = strings;
    const others = new Map<Locale, FieldEditor>();
    const main = new FieldEditor({ row, locale, strings, startFromFallback: true, events: this.editorEvents() });
    const session: Session = {
      row,
      locale,
      strings,
      main,
      others,
      polish: el("div", "notes"),
      details: el("div", "notes", el("p", "note", s.detailsLoading)),
    };
    session.polish.hidden = true;
    this.current = session;

    const notes: Node[] = [];
    if (locale === "fr") notes.push(el("p", "note", FRENCH_SPACING_NOTE));
    if (row.kind === "HTML") notes.push(el("p", "note", s.markupNote));

    const back = options.back;
    this.element.setAttribute("aria-label", s.sheetLabel);
    this.element.replaceChildren(
      this.head(
        s,
        back
          ? button(
              s.backToList,
              () => {
                this.close();
                back();
              },
              "btn btn-quiet back",
            )
          : null,
        el("p", "sheet-title", row.label || row.key),
        el("p", "sheet-scope", row.scope_label),
      ),
      el(
        "div",
        "sheet-body",
        main.status,
        session.polish,
        main.draftNote,
        main.valueField,
        notes.length > 0 ? el("div", "notes", ...notes) : null,
        main.commentField,
        main.message,
        session.details,
      ),
      el("div", "sheet-foot", main.save, main.withdraw, el("span", "grow")),
    );
    this.show();
    void this.loadDetails(session);

    if (window.matchMedia("(pointer: coarse)").matches) this.element.focus({ preventScroll: true });
    else main.value.focus({ preventScroll: true });
  }

  /** A list of fields in place of a field; picking one opens it through `open`. */
  showList(strings: Strings, title: string, content: readonly Node[]): void {
    this.close();
    this.listShown = true;
    this.element.setAttribute("aria-label", title);
    this.element.replaceChildren(
      this.head(strings, null, el("p", "sheet-title", title)),
      el("div", "sheet-body", ...content),
    );
    this.show();
    this.element.focus({ preventScroll: true });
  }

  /** New contents for the list on show, keeping its scroll and the keyboard's place in it. */
  updateList(content: readonly Node[]): void {
    const body = this.listShown ? this.element.querySelector(".sheet-body") : null;
    if (!body) return;
    const root = this.element.getRootNode();
    const focused = root instanceof ShadowRoot ? root.activeElement : null;
    const at = [...body.querySelectorAll("button")].findIndex((control) => control === focused);
    body.replaceChildren(...content);
    if (at < 0) return;
    const after = [...body.querySelectorAll("button")];
    (after[Math.min(at, after.length - 1)] ?? this.element).focus({ preventScroll: true });
  }

  /** The field tapped again: the textarea takes focus, except where that raises a touch keyboard. */
  focusText(): void {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    this.current?.main.value.focus({ preventScroll: true });
  }

  /** Close, keeping unsaved text as a draft for this tab in every language that holds some. */
  close(): void {
    const session = this.current;
    if (!session && !this.listShown) return;
    if (session) {
      session.main.release();
      for (const editor of session.others.values()) editor.release();
    }
    this.current = null;
    this.listShown = false;
    window.visualViewport?.removeEventListener("resize", this.fitKeyboard);
    window.visualViewport?.removeEventListener("scroll", this.fitKeyboard);
    this.element.hidden = true;
    this.element.replaceChildren();
    this.events.closed();
  }

  private head(s: Strings, back: HTMLElement | null, ...titles: Node[]): HTMLElement {
    return el(
      "div",
      "sheet-head",
      el("div", "sheet-heading", back, ...titles),
      button(s.close, () => this.close(), "btn"),
    );
  }

  private show(): void {
    this.element.hidden = false;
    this.fitKeyboard();
    window.visualViewport?.addEventListener("resize", this.fitKeyboard);
    window.visualViewport?.addEventListener("scroll", this.fitKeyboard);
  }

  private editorEvents(): EditorEvents {
    return {
      saved: (editor, clean) => {
        this.events.saved(editor.row, editor.locale);
        const session = this.current;
        if (session && editor === session.main && clean && !this.othersDirty(session)) this.close();
      },
      withdrawn: (editor) => {
        this.events.withdrawn(editor.row, editor.locale);
        const session = this.current;
        if (session && editor === session.main && !this.othersDirty(session)) this.close();
      },
      signedOut: () => this.events.signedOut(),
      refused: () => this.events.refused(),
    };
  }

  private othersDirty(session: Session): boolean {
    return [...session.others.values()].some((editor) => editor.dirty || editor.busy);
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

    const own = rows.find((segment) => segment.locale === session.locale);
    if (own) session.main.shipsBeneath(ownShipping(own.proposals));
    const polish = own?.source_value || rows.find((segment) => segment.locale === "pl")?.value || "";
    if (session.row.is_stale && polish) {
      const text = el("p", "reference-text", polish);
      text.lang = "pl";
      session.polish.replaceChildren(el("p", "reference-head", s.polishNow), text);
      session.polish.hidden = false;
    }

    // Polish first: it is what every translation is read against.
    const sides = LOCALES.filter((locale) => locale !== session.locale)
      .map((locale) => rows.find((segment) => segment.locale === locale))
      .filter((segment): segment is DeskSegment => segment !== undefined);
    const languages = el("details", "");
    const blocks = sides.map((segment) => this.sideBlock(session, segment));
    languages.append(el("summary", "", s.otherLanguages), el("ul", "reference", ...blocks));
    languages.open = session.others.size > 0;

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

    session.details.replaceChildren(...(sides.length > 0 ? [languages] : []), ...(proposals ? [proposals] : []));
  }

  /**
   * One other language: its text and "Popraw", or its editor straight away when it holds the
   * editor's draft or open proposal.
   */
  private sideBlock(session: Session, segment: DeskSegment): HTMLElement {
    const s = session.strings;
    const { locale } = segment;
    const row = sideRow(session.row, segment);
    const block = el("li", "side");
    const expand = (focus: boolean): void => {
      if (session.others.has(locale)) return;
      const editor = new FieldEditor({ row, locale, strings: s, startFromFallback: false, events: this.editorEvents() });
      editor.shipsBeneath(ownShipping(segment.proposals));
      session.others.set(locale, editor);
      fill(
        block,
        el("p", "reference-head", s.localeNames[locale]),
        editor.status,
        editor.draftNote,
        editor.valueField,
        locale === "fr" ? el("p", "note", FRENCH_SPACING_NOTE) : null,
        editor.commentField,
        editor.message,
        el("div", "side-actions", editor.save, editor.withdraw),
      );
      if (focus && !window.matchMedia("(pointer: coarse)").matches) editor.value.focus({ preventScroll: true });
    };

    const text = row.value ? el("p", "reference-text", row.value) : el("p", "reference-empty", s.notTranslated);
    if (row.value) text.lang = locale;
    const state = row.mine?.status === "ACCEPTED" ? s.statusAccepted : row.is_stale ? s.stale : "";
    fill(
      block,
      el("p", "reference-head", s.localeNames[locale]),
      state ? el("p", "note note-warn", state) : null,
      text,
      el("div", "side-actions", button(s.editOther, () => expand(true), "btn")),
    );
    if (hasDraft(row.id) || openProposal(row.mine)) expand(false);
    return block;
  }
}
