/**
 * @file watch.ts
 * @description The page changing under the comment mode: islands rendering and unmounting (the
 *  rite takes its words with it when it ends), overlays opening, scripts rewriting a line. One
 *  `MutationObserver` over `<body>` tells the mode when to read the page again, so the highlights,
 *  the previews and "Pozostałe teksty" follow what is on the screen, not what was there at load.
 *
 *  - `childList` and `characterData` mean the text changed: the page is read again. Only a change
 *    that adds or removes a letter counts. The landing ticks every second (the liturgical clock's
 *    seconds, a video's time readout, the notice form's resend countdown), and none of that is
 *    copy: a rewritten text node counts when its letters differ from before, an added or removed
 *    node when it carries any. Text the walk never reads (`skipsText`: scripts, styles; chrome
 *    marked `data-desk="none"`, where the clock lives) and comments do not count.
 *  - `hidden`, `aria-hidden`, `inert`, `open` (a `<details>`) and `class` mean only what is shown
 *    changed: the text is the same, only the lists that ask what is visible refresh. Inline
 *    `style` is not watched: animations write it every frame.
 *  - Bursts (islands hydrating, the rite unmounting) settle for `QUIET_MS` before anything runs,
 *    and a page that never settles (a typewriter, a label rewritten through a long scroll) is
 *    still read every `MAX_WAIT_MS`.
 *  - The tool's own host is ignored; its shadow root lies outside the observed tree anyway.
 *  - `quietly` runs the tool's own writes (previews) with the observer disconnected, after taking
 *    the records that came before them, so the mode never reacts to itself and loses nothing.
 *  - `caughtUp` drops what is pending once the mode has read the page anyway.
 *  - Paused while the edit sheet is open: re-reading the page under the editor's typing is work
 *    nobody sees. Changes are still noted, and the page is read on `resume` only if there were any.
 *
 *  The client router replaces `<body>`: `watch()` observes the one in place now.
 * @module comment-mode/watch
 */

import { OUTSIDE_DESK_SELECTOR, skipsText } from "./match";

export interface WatchEvents {
  /** Text was added, removed or rewritten: read the page again. */
  text(): void;
  /** Only what is shown changed. */
  shown(): void;
}

const QUIET_MS = 300;
const MAX_WAIT_MS = 1500;
const LETTERS = /\p{L}/gu;
const LETTER = /\p{L}/u;

const OPTIONS: MutationObserverInit = {
  subtree: true,
  childList: true,
  characterData: true,
  characterDataOldValue: true,
  attributes: true,
  attributeFilter: ["hidden", "aria-hidden", "inert", "open", "class"],
};

function letters(text: string | null): string {
  return text?.match(LETTERS)?.join("") ?? "";
}

/** An added or removed node that carries copy: a letter in text the walk reads. */
function carriesLetters(node: Node): boolean {
  if (node instanceof Text) return LETTER.test(node.data);
  if (!(node instanceof Element) || skipsText(node.localName.toLowerCase())) return false;
  if (node.matches(OUTSIDE_DESK_SELECTOR)) return false;
  return LETTER.test(node.textContent ?? "");
}

/** A change inside chrome marked `data-desk="none"`, which the walk never reads. */
function outsideDesk(target: Node): boolean {
  const element = target instanceof Element ? target : target.parentElement;
  return element?.closest(OUTSIDE_DESK_SELECTOR) != null;
}

export class PageWatcher {
  private readonly host: Element;
  private readonly events: WatchEvents;
  private readonly observer: MutationObserver;
  private observing = false;
  private paused = false;
  private timer = 0;
  /** When the first change still waiting for a read arrived. */
  private since = 0;
  private textChanged = false;
  private shownChanged = false;

  constructor(host: Element, events: WatchEvents) {
    this.host = host;
    this.events = events;
    this.observer = new MutationObserver((records) => this.take(records));
  }

  /** Observe the `<body>` in place now. */
  watch(): void {
    this.observer.disconnect();
    this.observer.observe(document.body, OPTIONS);
    this.observing = true;
  }

  /** Stop observing and drop what is pending: the page is about to go, or the mode is. */
  stop(): void {
    this.observer.disconnect();
    this.observing = false;
    this.clear();
  }

  /** Read nothing until `resume`, but keep noting what changes. */
  pause(): void {
    this.paused = true;
    window.clearTimeout(this.timer);
    this.timer = 0;
  }

  /** Read the page once if anything changed while paused. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.textChanged || this.shownChanged) this.schedule();
  }

  /** The mode has just read the page: whatever changed before now is covered. */
  caughtUp(): void {
    if (this.observing) this.observer.takeRecords();
    this.clear();
  }

  /** Run the tool's own write to the page without reacting to it. */
  quietly<T>(write: () => T): T {
    if (!this.observing) return write();
    this.take(this.observer.takeRecords());
    this.observer.disconnect();
    try {
      return write();
    } finally {
      this.observer.observe(document.body, OPTIONS);
    }
  }

  private take(records: readonly MutationRecord[]): void {
    for (const record of records) {
      if (record.target === this.host || this.host.contains(record.target)) continue;
      if (outsideDesk(record.target)) continue;
      if (record.type === "attributes") {
        this.shownChanged = true;
      } else if (this.textChanged) {
        continue;
      } else if (record.type === "characterData") {
        if (record.target instanceof Text && letters(record.oldValue) !== letters(record.target.data)) {
          this.textChanged = true;
        }
      } else {
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (nodes.some((node) => node !== this.host && carriesLetters(node))) this.textChanged = true;
      }
    }
    if ((this.textChanged || this.shownChanged) && !this.paused) this.schedule();
  }

  private schedule(): void {
    const now = performance.now();
    if (this.timer === 0) this.since = now;
    window.clearTimeout(this.timer);
    const wait = Math.max(0, Math.min(QUIET_MS, this.since + MAX_WAIT_MS - now));
    this.timer = window.setTimeout(() => {
      const text = this.textChanged;
      this.clear();
      if (text) this.events.text();
      else this.events.shown();
    }, wait);
  }

  private clear(): void {
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.textChanged = false;
    this.shownChanged = false;
  }
}
