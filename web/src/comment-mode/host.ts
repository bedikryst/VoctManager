/**
 * @file host.ts
 * @description The one element the comment mode puts on the page: a host appended to `<body>`,
 *  with an open shadow root holding the bar, the popover and the sheet.
 *
 *  - Outside `main` and `footer`, which the nav overlay makes `inert`.
 *  - `all: initial` inline, so no site rule reaches the host itself; the shadow root does the rest.
 *  - `data-lenis-prevent`: Lenis smooth-wheels the page on fine pointers and would otherwise take
 *    the sheet's own scroll.
 *  - `keydown`, `keyup` and `keypress` stop here: the site's focus traps listen on `document` and
 *    close the vault or a lightbox on Escape.
 *  - z-index above the vault stack (vault 110, terms 130, gratitude and failure 140) and below the
 *    skip link (200).
 *
 *  The client router replaces `<body>`, so the host is re-attached on every swap; it keeps its
 *  shadow root and everything in it.
 * @module comment-mode/host
 */

import { STYLES } from "./styles";

const HOST_STYLE = "all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 170;";

export class Host {
  readonly element: HTMLDivElement;
  readonly root: ShadowRoot;

  constructor() {
    this.element = document.createElement("div");
    this.element.setAttribute("data-comment-mode-host", "");
    this.element.setAttribute("data-lenis-prevent", "");
    this.element.style.cssText = HOST_STYLE;
    for (const type of ["keydown", "keyup", "keypress"] as const) {
      this.element.addEventListener(type, (event) => event.stopPropagation());
    }
    this.root = this.element.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLES;
    this.root.append(style);
  }

  attach(): void {
    if (this.element.parentNode !== document.body) document.body.append(this.element);
  }

  detach(): void {
    this.element.remove();
  }

  /** The event started inside the tool. */
  holds(event: Event): boolean {
    return event.composedPath().includes(this.element);
  }
}
