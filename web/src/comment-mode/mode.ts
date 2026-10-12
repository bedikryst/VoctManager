/**
 * @file mode.ts
 * @description The comment mode: the copy desk's proposal pipeline behind the live page. An editor
 *  taps a paragraph, rewrites it in the sheet, saves a proposal, and sees it on the page; everything
 *  after that (review queue, digest, `copy:apply`, deploy) is the desk's. Loaded as a chunk of its
 *  own by `loader.ts`, only for an editor who opened the site with `?uwagi`.
 *
 *  THE INDEX REQUEST IS THE AUTH PROBE. `GET site-index/` answers 401 (sign in), 403 (this account
 *  cannot edit) or every field of the page's locale. Never `/api/users/me/`: the panel's service
 *  worker answers that from its cache on site pages too. One request per locale per full load; the
 *  mode stays in memory across client-router navigations and patches the index after each save.
 *
 *  A PAGE READ walks the text, re-applies the editor's proposals in place (`preview.ts`), walks
 *  again if that changed the text, and paints the highlights (`highlights.ts`). It runs on every
 *  `astro:page-load`, after every save or withdrawal, and whenever the page's text changes under
 *  the mode (`watch.ts`: islands rendering, the rite unmounting, an overlay opening). A proposal
 *  that cannot stand in place is shown in the popover, hung from the text it was saved from, once
 *  the sheet has closed over it.
 *
 *  THE LISTS ("Moje propozycje na tej stronie", "Pozostałe teksty", `lists.ts`) open in the sheet
 *  from the bar's menu, follow the page while they are open, and a field picked from one offers
 *  the way back to it.
 *
 *  A SAVE IN ANOTHER LANGUAGE (the sheet's other languages) patches that locale's index, if it was
 *  loaded, so switching the page to it shows the proposal at once.
 *
 *  TAPS are read from pointer events on `window` in the capture phase, ahead of the site's own
 *  document-level capture handlers, Plausible's tagged links and the client router: iOS has long
 *  not delivered a delegated `click` for a tap on plain text. Short and still is a tap; a long
 *  press stays native selection, and modified and middle clicks always pass through. A tap on a
 *  field calls `preventDefault` and `stopPropagation`, and swallows the mouse events that follow it
 *  wherever they land, the tool's own sheet included: Android and iOS hit-test them after the tap
 *  has opened the sheet under the finger. A tap on nothing passes through untouched. A mouse
 *  pointer gets the field under it highlighted.
 *
 *  ONLY AN EDITOR THE SERVER LETS IN KEEPS THE FLAG. A reader it turns away (signed out, or an
 *  account that may not edit) keeps the bar for this visit and is disarmed and counted in the
 *  statistics again, so a forwarded `?uwagi` link arms nobody for good. The sign-in link carries
 *  `?uwagi` back, and a session that comes back arms the flag again.
 *
 *  ON THE SITE: one host element (`host.ts`), re-attached in `astro:after-swap` before the new
 *  page's snapshot so the bar does not blink; the previews put back in `astro:before-swap`, so an
 *  element the router persists never carries one into the next page; the page re-read in
 *  `astro:page-load`, and `<html lang>` read every time, never cached. The custom cursor steps
 *  aside through `presence.ts`, and the statistics through `stats.ts`. The window listeners are
 *  bound once and removed by "Zakończ", which also puts every published text back.
 * @architecture Astro islands 2026
 * @module comment-mode/mode
 */

import { navigate } from "astro:transitions/client";
import { DEFAULT_LOCALE, LOCALES, isTranslated, localizePath, type Locale } from "../i18n/config";
import { documentLocale } from "../i18n/documentLocale";
import { ApiError, fetchSiteIndex, notifyReviewers, type IndexRow, type SiteIndex } from "./api";
import { Bar, type BarState, type BarView, type ListCounts } from "./bar";
import { button, el } from "./dom";
import { Highlights } from "./highlights";
import { Host } from "./host";
import { listSignature, mineList, pageFields, restList, type ListKind, type PageFields } from "./lists";
import { compileCorpus, type Corpus } from "./match";
import { hitAt, rangeOf, scanPage, type Hit, type PageScan, type Pinned } from "./pageText";
import { Popover, fieldChoices, sharedWordContent, type Anchor } from "./popover";
import { setCommentModeActive } from "./presence";
import { Previews, proposalNodes, proposalValue } from "./preview";
import { basePath, pathScope } from "./scopePath";
import { Sheet } from "./sheet";
import { restoreStats, silenceStats } from "./stats";
import { STRINGS, type Strings } from "./strings";
import { PageWatcher } from "./watch";

export interface StartOptions {
  /** Sets the loader's flag: the next page load starts the mode again. */
  arm(): void;
  /** Clears the loader's flag: the next page load is an ordinary visitor's. */
  disarm(): void;
  /** The address parameter that arms the mode; the way back from a sign-in carries it. */
  readonly param: string;
}

let running: CommentMode | null = null;

/** Start the mode once; later calls (every `astro:page-load`) find it running. */
export function start(options: StartOptions): void {
  running ??= new CommentMode(options);
}

interface LoadedIndex {
  readonly index: SiteIndex;
  readonly corpus: Corpus<IndexRow>;
}

/** A tap moves no further than this (CSS px) and lasts no longer than this (ms). */
const TAP_SLOP = 10;
const TAP_MS = 500;
/** How long after a handled tap the browser's click for it may still arrive. */
const CLICK_WINDOW_MS = 800;
/** Where an edited text is brought to, from the viewport's top: clear of the fixed header. */
const REVEAL_TOP = 96;
/** `match.ts`'s placeholder: a proposal holding one gets a word on what the braces mean. */
const SLOT = /\{[A-Za-z][A-Za-z0-9_]*\}/u;
/**
 * `astro dev` has no panel: the dev proxy sends `/api` to the nginx stack, so signing in happens
 * there. Cookies do not isolate ports, so that login also serves the dev server.
 */
const DEV_PANEL_ORIGIN = "http://localhost";

interface LenisWindow {
  __lenis?: { scrollTo(target: number, options?: { duration?: number }): void };
}

function ownScope(): string | null {
  return pathScope(window.location.pathname, { notFound: document.body.classList.contains("page-404") });
}

/** The panel's sign-in, coming back to this page with `param`: a signed-out reader is disarmed. */
function signInUrl(param: string): string {
  const back = new URL(window.location.href);
  back.searchParams.set(param, "");
  const next = `${back.pathname}${back.search}${back.hash}`;
  const origin = import.meta.env.DEV ? DEV_PANEL_ORIGIN : "";
  return `${origin}/login?next=${encodeURIComponent(next)}`;
}

function stateFor(error: unknown): BarState {
  if (error instanceof ApiError && error.status === 401) return { kind: "signed-out" };
  if (error instanceof ApiError && error.status === 403 && !error.csrf) return { kind: "refused" };
  return { kind: "failed" };
}

class CommentMode {
  private readonly options: StartOptions;
  private readonly host = new Host();
  private readonly highlights = new Highlights();
  private readonly previews = new Previews();
  private readonly bar: Bar;
  private readonly popover: Popover;
  private readonly sheet: Sheet;
  private readonly watcher: PageWatcher;
  private readonly indexes = new Map<Locale, Promise<LoadedIndex>>();
  /** The indexes that have arrived: a save in another language patches its row here. */
  private readonly resolved = new Map<Locale, LoadedIndex>();
  private readonly undo: Array<() => void> = [];
  private loaded: LoadedIndex | null = null;
  private scan: PageScan | null = null;
  /** The previewed elements and their fields, as of the last change to the previews. */
  private pins: Pinned = new Map();
  private state: BarState = { kind: "loading" };
  private editing = true;
  /** The wash over every editable text. A touch screen has no hover to find them with. */
  private showFields = window.matchMedia("(pointer: coarse)").matches;
  private sending = false;
  /** The editor's `Profile.language`, once the index has told us. */
  private language: Locale | null = null;
  /** Bumped by every page read and by "Zakończ": an answer for an older one is dropped. */
  private generation = 0;
  private press: { readonly id: number; readonly x: number; readonly y: number; readonly time: number } | null =
    null;
  private swallowUntil = 0;
  /** True while "Otwórz" replays a click on the page's own link. */
  private forwarding = false;
  /** The field the sheet edits and the span it was opened from: a save shows the proposal there. */
  private target: { readonly row: IndexRow; readonly range: Range | null } | null = null;
  private pointer: { readonly x: number; readonly y: number; readonly target: EventTarget | null } | null = null;
  private hoverFrame = 0;
  /** The list the sheet shows, and what it showed last: an unchanged list is not re-rendered. */
  private list: ListKind | null = null;
  private listShape = "";

  constructor(options: StartOptions) {
    this.options = options;
    setCommentModeActive(true);
    silenceStats();
    this.host.attach();
    this.bar = new Bar(
      this.host.root,
      {
        signIn: () => {
          this.sheet.close();
          window.location.assign(signInUrl(this.options.param));
        },
        retry: () => void this.readPage(),
        showMine: () => this.showList("mine"),
        showRest: () => this.showList("rest"),
        toggleEditing: () => this.toggleEditing(),
        switchLocale: (locale) => this.switchLocale(locale),
        toggleFields: () => this.toggleFields(),
        togglePreviews: () => this.togglePreviews(),
        done: () => void this.done(),
        end: () => this.end(),
      },
      this.barView(),
      this.strings(),
    );
    this.popover = new Popover(this.host.root);
    // A save or a withdrawal in flight answers after "Zakończ" too: the page is the visitor's by then.
    this.sheet = new Sheet(this.host.root, {
      saved: (row, locale) => {
        if (running !== this) return;
        const s = this.strings();
        const label = row.label || row.key;
        if (locale === this.loaded?.index.locale) {
          this.bar.announce(s.saved(label));
          this.afterChange(row);
        } else {
          this.bar.announce(s.savedIn(label, s.localeAdverbs[locale]));
          this.patchIndex(row, locale);
        }
      },
      withdrawn: (row, locale) => {
        if (running !== this) return;
        const s = this.strings();
        const label = row.label || row.key;
        if (locale === this.loaded?.index.locale) {
          this.bar.announce(s.withdrawn(label));
          this.afterChange(row);
        } else {
          this.bar.announce(s.withdrawnIn(label, s.localeAdverbs[locale]));
          this.patchIndex(row, locale);
        }
      },
      signedOut: () => {
        if (running === this) this.setState({ kind: "signed-out" });
      },
      refused: () => {
        if (running === this) this.setState({ kind: "refused" });
      },
      closed: () => {
        this.target = null;
        this.list = null;
        this.bar.setUnderSheet(false);
        this.watcher.resume();
      },
    });
    this.watcher = new PageWatcher(this.host.element, {
      text: () => {
        if (running === this && this.state.kind === "ready") this.readText();
      },
      shown: () => {
        if (running === this) this.refreshList();
      },
    });
    this.watcher.watch();

    this.on(window, "pointerdown", (event) => {
      if (event instanceof PointerEvent) this.onPointerDown(event);
    });
    this.on(window, "pointerup", (event) => {
      if (event instanceof PointerEvent) this.onPointerUp(event);
    });
    this.on(window, "pointercancel", () => {
      this.press = null;
    });
    this.on(window, "pointermove", (event) => {
      if (event instanceof PointerEvent) this.onPointerMove(event);
    });
    this.on(window, "pointerout", (event) => {
      if (event instanceof PointerEvent && event.relatedTarget === null) {
        this.pointer = null;
        this.highlights.hover(null);
      }
    });
    this.on(window, "mousedown", (event) => this.swallow(event, false));
    this.on(window, "click", (event) => this.swallow(event, true));
    this.on(window, "keydown", (event) => {
      if (event instanceof KeyboardEvent) this.onKeyDown(event);
    });
    this.on(document, "astro:before-preparation", () => {
      this.popover.hide();
      this.sheet.close();
      this.bar.closeMenu();
    });
    this.on(document, "astro:before-swap", () => {
      this.watcher.stop();
      this.previews.restoreAll();
      this.pins = new Map();
      this.highlights.clear();
    });
    this.on(document, "astro:after-swap", () => {
      this.host.attach();
      this.watcher.watch();
    });
    this.on(document, "astro:page-load", () => void this.readPage());

    void this.readPage();
  }

  private on(target: Window | Document, type: string, handler: (event: Event) => void): void {
    target.addEventListener(type, handler, true);
    this.undo.push(() => target.removeEventListener(type, handler, true));
  }

  private strings(): Strings {
    return STRINGS[this.language ?? documentLocale()];
  }

  private barView(): BarView {
    return {
      state: this.state,
      locale: documentLocale(),
      locales: isTranslated(basePath(window.location.pathname)) ? LOCALES : [DEFAULT_LOCALE],
      fields: this.highlights.supported ? this.showFields : null,
      previews: this.previews.shown,
      sending: this.sending,
      counts: () => this.counts(),
    };
  }

  private renderBar(): void {
    this.bar.update(this.barView(), this.strings());
  }

  private setState(state: BarState): void {
    if (state.kind !== this.state.kind) this.settleFlag(state);
    this.state = state;
    if (state.kind !== "ready") this.popover.hide();
    this.renderBar();
    this.paint();
  }

  /** The server's answer decides the flag and the statistics; loading and network failures leave both. */
  private settleFlag(state: BarState): void {
    if (state.kind === "ready") {
      this.options.arm();
      silenceStats();
    } else if (state.kind === "signed-out" || state.kind === "refused") {
      this.options.disarm();
      restoreStats();
    }
  }

  private tapsLive(): boolean {
    return this.state.kind === "ready" && this.state.editing;
  }

  private toggleEditing(): void {
    this.editing = !this.editing;
    if (!this.editing) this.popover.hide();
    if (this.state.kind === "ready") this.setState({ kind: "ready", editing: this.editing });
  }

  private toggleFields(): void {
    this.showFields = !this.showFields;
    this.paint();
    this.renderBar();
  }

  private togglePreviews(): void {
    const shown = !this.previews.shown;
    if (this.watcher.quietly(() => this.previews.setShown(shown))) this.readText();
    this.popover.hide();
    this.renderBar();
  }

  /** The page in the other language, through the client router so the mode stays loaded. */
  private switchLocale(locale: Locale): void {
    this.bar.closeMenu();
    const base = basePath(window.location.pathname);
    if (locale === documentLocale() || (locale !== DEFAULT_LOCALE && !isTranslated(base))) return;
    this.sheet.close();
    void navigate(localizePath(base, locale));
  }

  /** "Gotowe": the reviewers hear about this sitting now, not after half an hour of quiet. */
  private async done(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    this.renderBar();
    try {
      const outcome = await notifyReviewers();
      if (running !== this) return;
      const s = this.strings();
      this.bar.closeMenu();
      this.bar.announce(outcome.proposals === 0 ? s.doneNothing : outcome.delivered ? s.doneSent : s.doneNobody);
    } catch (error) {
      if (running !== this) return;
      const next = stateFor(error);
      if (next.kind === "failed") this.bar.announce(this.strings().doneFailed);
      else this.setState(next);
    } finally {
      this.sending = false;
      if (running === this) this.renderBar();
    }
  }

  private indexFor(locale: Locale): Promise<LoadedIndex> {
    const known = this.indexes.get(locale);
    if (known) return known;
    const loading = fetchSiteIndex(locale).then((index) => {
      const loaded = { index, corpus: compileCorpus(index.segments) };
      this.resolved.set(locale, loaded);
      return loaded;
    });
    this.indexes.set(locale, loading);
    // A refusal is not remembered: after a sign-in, or once the network is back, ask again.
    loading.catch(() => {
      if (this.indexes.get(locale) === loading) this.indexes.delete(locale);
    });
    return loading;
  }

  /** Read the page the router just put in place: its locale's index, then its text. */
  private async readPage(): Promise<void> {
    const generation = ++this.generation;
    this.host.attach();
    this.popover.hide();
    this.scan = null;
    const locale = documentLocale();
    if (this.state.kind !== "ready" || this.loaded?.index.locale !== locale) this.setState({ kind: "loading" });

    let loaded: LoadedIndex;
    try {
      loaded = await this.indexFor(locale);
    } catch (error) {
      if (generation === this.generation) this.setState(stateFor(error));
      return;
    }
    if (generation !== this.generation) return;

    this.loaded = loaded;
    this.language = LOCALES.find((candidate) => candidate === loaded.index.language) ?? this.language;
    this.readText();
    this.setState({ kind: "ready", editing: this.editing });
  }

  private scanNow(loaded: LoadedIndex): PageScan {
    return scanPage(loaded.corpus, ownScope(), { host: this.host.element, pinned: this.pins });
  }

  /**
   * Walk the page, bring the previews in line with the index, walk again when that changed the
   * text or the pinned elements, and repaint.
   */
  private readText(): void {
    const loaded = this.loaded;
    // Between a language switch and its index the page is in another language than the corpus;
    // the read that index ends in does this.
    if (!loaded || loaded.index.locale !== documentLocale()) return;
    const scan = this.scanNow(loaded);
    this.scan = scan;
    const locale = documentLocale();
    if (this.watcher.quietly(() => this.previews.sync(scan, locale))) {
      this.pins = this.previews.pinned();
      this.scan = this.scanNow(loaded);
    }
    this.paint();
    this.refreshList();
  }

  /**
   * After a save or a withdrawal: the proposal shows where the sheet was opened from, then
   * everywhere it can. Where it cannot stand in place, the popover shows it, once the sheet has
   * closed: a sheet that stays open (another language still unsaved, markup removed) shows the
   * stored text itself, and the popover would only take its focus.
   */
  private afterChange(row: IndexRow): void {
    const target = this.target;
    const range = target?.row === row ? target.range : null;
    const locale = documentLocale();
    if (range) this.watcher.quietly(() => this.previews.place(range, row, locale));
    this.pins = this.previews.pinned();
    this.readText();
    if (!range || !this.previews.shown || proposalValue(row) === null || this.previews.covers(range.startContainer)) {
      return;
    }
    // The sheet decides whether to close after this event returns.
    queueMicrotask(() => {
      if (running === this && !this.sheet.isOpen && this.tapsLive()) this.showProposal(row, range);
    });
  }

  /** The editor's proposal in the popover, hung from the text it replaces. */
  private showProposal(row: IndexRow, range: Range): void {
    const value = proposalValue(row);
    if (value === null) return;
    const s = this.strings();
    this.popover.show(
      () => (range.startContainer.isConnected && !range.collapsed ? range.getBoundingClientRect() : null),
      s.previewTitle,
      [
        el("p", "popover-title", s.previewTitle),
        el("p", "popover-text", s.previewWhy),
        proposalNodes(row, value, documentLocale()),
        SLOT.test(value) ? el("p", "note", s.slotNote) : null,
        el(
          "div",
          "popover-actions",
          button(s.editText, () => this.edit(row, range), "btn"),
          button(s.close, () => this.popover.hide(), "btn btn-quiet"),
        ),
      ].filter((node): node is HTMLElement => node !== null),
    );
  }

  /** A save or a withdrawal in another language: that locale's index, if loaded, learns of it. */
  private patchIndex(row: IndexRow, locale: Locale): void {
    const cached = this.resolved.get(locale)?.index.segments.find((candidate) => candidate.id === row.id);
    if (cached) cached.mine = row.mine;
  }

  /** The page's fields sorted for the lists, from the last read or a fresh one. */
  private fields(): PageFields | null {
    const loaded = this.loaded;
    if (!loaded || loaded.index.locale !== documentLocale()) return null;
    this.scan ??= this.scanNow(loaded);
    return pageFields(loaded.index.segments, this.scan, this.pins, ownScope());
  }

  private counts(): ListCounts {
    const fields = this.fields();
    return { mine: fields?.mine.length ?? 0, rest: fields?.rest.length ?? 0 };
  }

  private listContent(kind: ListKind, fields: PageFields): Node[] {
    const s = this.strings();
    const back = (): void => this.showList(kind);
    return kind === "mine"
      ? mineList(fields, ownScope(), s, (entry) => this.edit(entry.row, entry.range, back))
      : restList(fields, s, (row) => this.edit(row, null, back));
  }

  private showList(kind: ListKind): void {
    const fields = this.fields();
    if (!fields) return;
    const s = this.strings();
    this.bar.closeMenu();
    this.popover.hide();
    this.sheet.showList(s, kind === "mine" ? s.myProposals : s.restTexts, this.listContent(kind, fields));
    // After `showList`: closing what the sheet held before reports `closed`, which clears the list.
    this.list = kind;
    this.listShape = listSignature(kind, fields);
    this.bar.setUnderSheet(true);
  }

  /** The open list follows the page: re-rendered only when what it lists has changed. */
  private refreshList(): void {
    const kind = this.list;
    if (!kind || !this.sheet.showsList) return;
    const fields = this.fields();
    if (!fields) return;
    const shape = listSignature(kind, fields);
    if (shape === this.listShape) return;
    this.listShape = shape;
    this.sheet.updateList(this.listContent(kind, fields));
  }

  /** The highlights: off unless taps are live; gold for the editor's fields, the wash when asked for. */
  private paint(): void {
    const scan = this.scan;
    if (!this.tapsLive() || !scan) {
      this.highlights.clear();
      return;
    }
    if (!this.highlights.supported) return;
    const fields: Range[] = [];
    const mine: Range[] = [];
    for (const occurrence of scan.occurrences) {
      if (occurrence.candidates.length === 0) continue;
      const isMine = occurrence.candidates.some((row) => row.mine !== null);
      if (!isMine && !this.showFields) continue;
      const range = rangeOf(scan, occurrence);
      if (range) (isMine ? mine : fields).push(range);
    }
    for (const element of this.pins.keys()) {
      const range = document.createRange();
      range.selectNodeContents(element);
      mine.push(range);
    }
    this.highlights.paint(fields, mine);
  }

  private onPointerDown(event: PointerEvent): void {
    this.press = null;
    // A new press means the last tap's click is not coming: iOS sends none for plain text, and a
    // window left open would eat this press's click on a link the mode does not handle.
    this.swallowUntil = 0;
    if (this.host.holds(event)) return;
    this.bar.closeMenu();
    if (!this.tapsLive() || !event.isPrimary || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    this.press = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
  }

  private onPointerUp(event: PointerEvent): void {
    const press = this.press;
    this.press = null;
    if (!press || event.pointerId !== press.id || !this.tapsLive()) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP) return;
    if (event.timeStamp - press.time > TAP_MS) return;

    const hit = this.hitAt(event.clientX, event.clientY, event.target);
    if (!hit) {
      // A tap that only dismisses the popover must not also act on the page beneath it.
      if (!this.popover.isOpen) return;
      this.popover.hide();
    }
    event.preventDefault();
    event.stopPropagation();
    this.swallowUntil = performance.now() + CLICK_WINDOW_MS;
    if (hit) this.handle(hit);
  }

  /** A mouse over the page: the field under it is highlighted, once per frame at most. */
  private onPointerMove(event: PointerEvent): void {
    if (event.pointerType !== "mouse" || !this.highlights.supported) return;
    this.pointer = this.host.holds(event) ? null : { x: event.clientX, y: event.clientY, target: event.target };
    if (this.hoverFrame !== 0) return;
    this.hoverFrame = window.requestAnimationFrame(() => {
      this.hoverFrame = 0;
      this.hover();
    });
  }

  private hover(): void {
    const { pointer, scan } = this;
    if (!pointer || !scan || !this.tapsLive()) {
      this.highlights.hover(null);
      return;
    }
    // No re-read here: a hover over an island that keeps re-rendering would walk the page each frame.
    const result = hitAt(scan, this.pins, pointer.x, pointer.y, pointer.target);
    this.highlights.hover(result.kind === "hit" && result.hit.candidates.length > 0 ? result.hit.range : null);
  }

  /**
   * The mouse events that follow a handled tap. Its click must not reach the page (a link, the
   * vault's trigger, a lightbox). On touch the compatibility `mousedown` and `click` arrive after
   * `pointerup` and are hit-tested then, so they land on the sheet or the popover that tap just
   * opened under the finger: there the `mousedown` would focus the textarea and raise the keyboard,
   * and the click would press whichever button is under it. The tool's own controls are reached
   * by a press of their own, and every press closes this window in `onPointerDown`.
   */
  private swallow(event: Event, isClick: boolean): void {
    if (this.forwarding || performance.now() > this.swallowUntil) return;
    event.preventDefault();
    if (!isClick) return;
    this.swallowUntil = 0;
    event.stopImmediatePropagation();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    if (this.popover.isOpen) this.popover.hide();
    else if (this.sheet.isOpen) this.sheet.close();
    else if (this.bar.isMenuOpen) this.bar.closeMenu();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  private hitAt(x: number, y: number, target: EventTarget | null): Hit | null {
    const loaded = this.loaded;
    if (!loaded) return null;
    // A page script that wrote over a preview owns that element again: read it as the page prints it.
    if (this.previews.prune()) {
      this.pins = this.previews.pinned();
      this.scan = this.scanNow(loaded);
      this.paint();
    }
    this.scan ??= this.scanNow(loaded);
    let result = hitAt(this.scan, this.pins, x, y, target);
    if (result.kind === "unseen") {
      // An island re-rendered since the page was read: its text nodes are new, and so are its ranges.
      this.scan = this.scanNow(loaded);
      this.paint();
      result = hitAt(this.scan, this.pins, x, y, target);
    }
    return result.kind === "hit" ? result.hit : null;
  }

  private handle(hit: Hit): void {
    const { candidates, control } = hit;
    const s = this.strings();
    const anchor = this.anchorFor(hit);
    const follow = control ? button(s.open, () => this.follow(control), "btn") : null;
    const close = button(s.close, () => this.popover.hide(), "btn btn-quiet");

    if (candidates.length === 0) {
      this.popover.show(anchor, s.sharedTitle, [
        ...sharedWordContent(hit.fields, documentLocale(), s),
        el("div", "popover-actions", follow, close),
      ]);
      return;
    }

    const pick = (row: IndexRow): void => this.edit(row, hit.range);
    if (control) {
      const only = candidates.length === 1 ? candidates[0] : null;
      this.popover.show(
        anchor,
        s.editText,
        only
          ? [el("div", "popover-actions", button(s.editText, () => pick(only), "btn btn-primary"), follow)]
          : [
              el("p", "popover-label", s.chooseField),
              fieldChoices(candidates, pick),
              el("div", "popover-actions", follow, close),
            ],
      );
      return;
    }

    if (candidates.length > 1) {
      this.popover.show(anchor, s.chooseField, [
        el("p", "popover-label", s.chooseField),
        fieldChoices(candidates, pick),
        el("div", "popover-actions", close),
      ]);
      return;
    }

    pick(candidates[0]);
  }

  /** The tapped line of the span, measured afresh on every scroll. */
  private anchorFor(hit: Hit): Anchor {
    const { range, line } = hit;
    return () => {
      if (!range.startContainer.isConnected) return null;
      return range.getClientRects()[line] ?? range.getBoundingClientRect();
    };
  }

  /** "Otwórz": the page's own link or button does what it would have done. */
  private follow(control: HTMLElement): void {
    this.popover.hide();
    this.forwarding = true;
    try {
      control.click();
    } finally {
      this.forwarding = false;
    }
  }

  /** Open `row` in the sheet; `back` returns to the list it was picked from. */
  private edit(row: IndexRow, range: Range | null, back?: () => void): void {
    this.popover.hide();
    const loaded = this.loaded;
    if (!loaded) return;
    if (this.sheet.row === row) {
      this.sheet.focusText();
    } else {
      this.sheet.open(row, loaded.index.locale, this.strings(), { back });
      this.bar.setUnderSheet(true);
      // After `open`: closing what the sheet held before resumes the watcher.
      this.watcher.pause();
    }
    this.target = { row, range };
    if (range) this.reveal(range);
  }

  /** Bring the edited text into view beside the sheet, unless it already is. */
  private reveal(range: Range): void {
    const rect = range.getBoundingClientRect();
    const sheetTop = this.sheet.element.getBoundingClientRect().top;
    const visibleBottom = sheetTop > 0 ? sheetTop : window.innerHeight;
    if (rect.top >= REVEAL_TOP && rect.bottom <= visibleBottom - 24) return;
    const target = window.scrollY + rect.top - REVEAL_TOP;
    const lenis = (window as Window & LenisWindow).__lenis;
    // Lenis runs only where motion is allowed (BaseLayout), so its glide needs no reduced branch.
    if (lenis) lenis.scrollTo(target, { duration: 0.6 });
    else {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
    }
  }

  private end(): void {
    this.generation += 1;
    this.sheet.close();
    this.watcher.stop();
    this.popover.hide();
    this.previews.restoreAll();
    this.highlights.dispose();
    if (this.hoverFrame !== 0) window.cancelAnimationFrame(this.hoverFrame);
    this.bar.dispose();
    for (const undo of this.undo.splice(0)) undo();
    this.host.detach();
    setCommentModeActive(false);
    restoreStats();
    this.options.disarm();
    running = null;
  }
}
