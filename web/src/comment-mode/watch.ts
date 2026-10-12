/**
 * @file watch.ts
 * @description The page changing under the comment mode: islands rendering and unmounting (the
 *  rite takes its words with it when it ends), overlays opening, scripts rewriting a line. One
 *  `MutationObserver` over `<body>` tells the mode when to read the page again, so the highlights,
 *  the previews and "Pozostałe teksty" follow what is on the screen, not what was there at load.
 *
 *  - `childList` and `characterData` mean the text changed: the page is read again. Only a change
 *    that adds or removes a letter counts. The landing ticks every second (the liturgical clock's
 *    seconds, a video's time readout), and none of that is copy.
 *  - `hidden` and `aria-hidden` mean only what is shown changed (the vault is always in the DOM and
 *    opens through them): the text is the same, only the lists that ask what is visible refresh.
 *  - Bursts (islands hydrating, the rite unmounting) settle for `QUIET_MS` before anything runs.
 *  - The tool's own host is ignored; its shadow root lies outside the observed tree anyway.
 *  - `quietly` runs the tool's own writes (previews) with the observer disconnected, after taking
 *    the records that came before them, so the mode never reacts to itself and loses nothing.
 *  - Paused while the edit sheet is open: re-reading the page under the editor's typing is work
 *    nobody sees, and the page is read once more when the sheet closes.
 *
 *  The client router replaces `<body>`: `watch()` observes the one in place now.
 * @architecture Astro islands 2026
 * @module comment-mode/watch
 */

export interface WatchEvents {
  /** Text was added, removed or rewritten: read the page again. */
  text(): void;
  /** Only what is shown changed. */
  shown(): void;
}

const QUIET_MS = 300;
const LETTER = /\p{L}/u;

const OPTIONS: MutationObserverInit = {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["hidden", "aria-hidden"],
};

function hasLetters(node: Node): boolean {
  return LETTER.test(node.textContent ?? "");
}

export class PageWatcher {
  private readonly host: Element;
  private readonly events: WatchEvents;
  private readonly observer: MutationObserver;
  private observing = false;
  private paused = false;
  private timer = 0;
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
    this.observing = false;
    if (this.paused) return;
    this.observer.observe(document.body, OPTIONS);
    this.observing = true;
  }

  /** Stop observing and drop what is pending: the page is about to go, or the mode is. */
  stop(): void {
    this.observer.disconnect();
    this.observing = false;
    this.clear();
  }

  /** Stop observing until `resume`; what is pending is dropped, since `resume` reads the page anyway. */
  pause(): void {
    this.paused = true;
    this.stop();
  }

  /** Observe again and read the page once, for whatever changed while paused. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.watch();
    this.textChanged = true;
    this.schedule();
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
      if (record.type === "attributes") {
        this.shownChanged = true;
      } else if (record.type === "characterData") {
        if (hasLetters(record.target)) this.textChanged = true;
      } else {
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (nodes.some((node) => node !== this.host && hasLetters(node))) this.textChanged = true;
      }
    }
    if (this.textChanged || this.shownChanged) this.schedule();
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      const text = this.textChanged;
      this.clear();
      if (text) this.events.text();
      else this.events.shown();
    }, QUIET_MS);
  }

  private clear(): void {
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.textChanged = false;
    this.shownChanged = false;
  }
}
