/**
 * @file disclosure.ts
 * @description The site's one disclosure controller. A native `<details>` swaps its content in and
 *  out in a single frame; everywhere this site opens text in place — the landing's path cards, the
 *  /koncerty programme lists, a concert page's sung texts and its transcribed word — what it wants
 *  instead is for the box to GROW, with the text arriving behind the growing edge. That is an
 *  animation of `height`, which cannot start from `auto`, so the box is measured here rather than
 *  declared in CSS.
 *
 *  What happens INSIDE an opened box stays with the page: the per-item cascade is a CSS animation
 *  keyed on `[open]` (`.path-works li`, `.kd-text-cols > p`). The attribute is already the signal,
 *  and a second one could only ever disagree with it.
 *
 *  This lived in two copies until 2026-08, with a third site — koncerty/[id] — carrying the same
 *  disclosures and no controller at all, so its texts snapped. The two copies had already drifted:
 *  only one reconciled a `<details>` the BROWSER opens rather than the reader (find-in-page, a
 *  `#:~:text=` fragment), so on the other a search result scrolled to text pinned at height 0.
 *  Same reason scripts/reveal.ts is one file — the geometry is the site's, not the page's.
 * @architecture Astro islands 2026
 * @module scripts/disclosure
 */

/**
 * One clock for every disclosure on the site. Opening is the slower half deliberately: an opening
 * box is being read into and the eye follows its edge, a closing one has already been dismissed
 * and lingering over it only delays what the reader turned to next.
 */
export const DISCLOSURE_OPEN_MS = 480;
export const DISCLOSURE_CLOSE_MS = 340;

/** The site's general interaction curve (tokens.css). A transition assembled in JS inherits no
 *  cascade, so the token is read through `var()` — with the literal behind it, because an unknown
 *  custom property would invalidate the whole declaration and the box would snap again. */
const EASE = "var(--ease, cubic-bezier(0.22, 0.61, 0.16, 1))";

/** Slack over the transition, after which the gesture is finished by hand. `transitionend` does
 *  not arrive when nothing actually moves (a body measuring 0, an interrupted layout), and without
 *  this the `animating` flag would latch and leave the disclosure dead for the life of the page. */
const FINISH_GRACE_MS = 120;

export interface DisclosureOptions {
  /** Which `<details>` under `root` this call owns. */
  selector: string;
  /**
   * Class of the box whose height is animated. A direct child already carrying it is used as
   * authored (`.station-program`); otherwise everything after the `<summary>` is moved into a new
   * div with this class.
   *
   * The box is not cosmetic and not optional: `overflow: hidden` on it establishes a block
   * formatting context, which is what keeps the content's own top margin INSIDE the measured
   * height. Animating a margin-bearing element directly instead leaves that margin standing under
   * a closed summary as a gap that nothing accounts for.
   */
  bodyClass: string;
  /** One open at a time — for a set that reads as alternatives (the landing's path entries). */
  exclusive?: boolean;
  /** Runs once an opening gesture is committed. `displaced` is how many others were closed for
   *  it, which is the only thing a caller cannot work out afterwards. */
  onOpen?: (summary: HTMLElement, displaced: number) => void;
}

/** The animated box: the one the page authored, or one made to hold what follows the summary. */
function resolveBody(
  details: HTMLDetailsElement,
  summary: HTMLElement,
  bodyClass: string,
): HTMLElement {
  const authored = details.querySelector<HTMLElement>(`:scope > .${bodyClass}`);
  if (authored) return authored;
  const wrap = document.createElement("div");
  wrap.className = bodyClass;
  while (summary.nextSibling) wrap.appendChild(summary.nextSibling);
  details.appendChild(wrap);
  return wrap;
}

/**
 * Binds every `<details>` matching `options.selector` under `root` and returns a cleanup. Callers
 * re-run this per `astro:page-load` and drop the previous binding first, exactly as they do with
 * `setupReveal` — a ClientRouter swap hands over a fresh DOM, and the listeners left behind point
 * at elements that no longer exist.
 */
export function setupDisclosure(root: ParentNode, options: DisclosureOptions): () => void {
  const items = Array.from(root.querySelectorAll<HTMLDetailsElement>(options.selector));
  if (!items.length) return () => {};

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** Every bound disclosure and the handle that closes it — only `exclusive` reads it. */
  const registry = new Map<HTMLDetailsElement, () => void>();
  const drop: (() => void)[] = [];
  const timers = new Set<number>();

  for (const details of items) {
    const summary = details.querySelector("summary");
    if (!summary) continue;
    const body = resolveBody(details, summary, options.bodyClass);

    // The collapsed state is written by JS and only by JS: without it a no-script visitor gets the
    // native `<details>`, which works, rather than a box pinned shut by a stylesheet.
    body.style.overflow = "hidden";
    body.style.height = details.open ? "auto" : "0px";
    body.style.opacity = details.open ? "1" : "0";

    let animating = false;

    const finish = (toOpen: boolean): void => {
      // `auto`, not the measured pixel height — the box has to keep following its content once the
      // gesture is over (a font landing, a rotation, a reflowed column).
      body.style.height = toOpen ? "auto" : "0px";
      body.style.opacity = toOpen ? "1" : "0";
      body.style.transition = "";
      body.style.willChange = "";
      if (!toOpen) details.removeAttribute("open");
      animating = false;
    };

    const animate = (toOpen: boolean): void => {
      if (reduced) {
        if (toOpen) details.setAttribute("open", "");
        finish(toOpen);
        return;
      }
      animating = true;
      // `open` goes on FIRST when opening: a closed `<details>` renders nothing after its summary,
      // so there is no laid-out content to measure until the browser has been told to show it.
      if (toOpen) details.setAttribute("open", "");
      body.style.willChange = "height";
      const start = body.getBoundingClientRect().height;
      body.style.height = `${start}px`;
      body.style.opacity = toOpen ? "0" : "1";
      void body.getBoundingClientRect(); // flush, so the transition has a from-value to leave
      const target = toOpen ? body.scrollHeight : 0;
      const ms = toOpen ? DISCLOSURE_OPEN_MS : DISCLOSURE_CLOSE_MS;
      body.style.transition = `height ${ms}ms ${EASE}, opacity ${ms}ms ${EASE}`;
      window.requestAnimationFrame(() => {
        body.style.height = `${target}px`;
        body.style.opacity = toOpen ? "1" : "0";
      });

      const guard = window.setTimeout(() => {
        body.removeEventListener("transitionend", done);
        finish(toOpen);
      }, ms + FINISH_GRACE_MS);
      timers.add(guard);
      function done(event: TransitionEvent): void {
        if (event.target !== body || event.propertyName !== "height") return;
        body.removeEventListener("transitionend", done);
        window.clearTimeout(guard);
        timers.delete(guard);
        finish(toOpen);
      }
      body.addEventListener("transitionend", done);
    };

    registry.set(details, () => {
      if (details.open && !animating) animate(false);
    });

    const onClick = (event: Event): void => {
      // The native toggle is what snaps, so it never happens: `open` is ours to write, at the
      // start of an opening gesture and at the end of a closing one. Keyboard activation of a
      // summary dispatches a click too, so this is the whole input surface.
      event.preventDefault();
      if (animating) return;
      const toOpen = !details.open;
      let displaced = 0;
      if (toOpen && options.exclusive) {
        for (const [other, close] of registry) {
          if (other === details || !other.open) continue;
          close();
          displaced += 1;
        }
      }
      animate(toOpen);
      if (toOpen) options.onOpen?.(summary, displaced);
    };
    summary.addEventListener("click", onClick);
    drop.push(() => summary.removeEventListener("click", onClick));

    // A `<details>` can be opened WITHOUT a click, and this box's collapsed state is inline style
    // that only the click path clears: the browser sets `open` directly for find-in-page and for a
    // `#:~:text=` scroll-to-text fragment (which is how a search result lands on a composer's name
    // inside a programme). Both then scroll to a match inside a box still pinned at height 0 — the
    // text is found and invisible. Reconciling on `toggle` covers every such path at once instead
    // of enumerating them. Our own `animate()` fires this too, so it is gated twice: `animating`
    // is still set when the event lands, and an already-open box is never re-finished.
    const onToggle = (): void => {
      if (animating || !details.open) return;
      if (body.style.height !== "0px") return;
      finish(true);
    };
    details.addEventListener("toggle", onToggle);
    drop.push(() => details.removeEventListener("toggle", onToggle));
  }

  return () => {
    drop.forEach((fn) => fn());
    timers.forEach((t) => window.clearTimeout(t));
    timers.clear();
  };
}
