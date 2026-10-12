/**
 * @file pressGuard.ts
 * @description Keeps the ink press (`.ink-press`, styles/registers.css) from re-wrapping a heading.
 *  The press drives Cormorant's weight axis from --wght-press to --wght-rest, and that axis moves
 *  advance widths: at the press weight a line sets 0.6–1.7% wider than at rest. A heading whose rest
 *  width lies within that margin of its measure therefore waits on screen one line taller than it
 *  will end, and drops the line — and everything laid out under it — the moment the press lands.
 *
 *  No CSS compensation is exact. Tracking would overwrite each heading's own letter-spacing, and
 *  word-spacing hands width back per SPACE while the press takes it per GLYPH: calibrated on the
 *  site's heading copy it only narrows the band to about ±0.7%, and opens it in the other
 *  direction. So this measures instead. Every heading still waiting for its entrance is laid out
 *  once at the rest weight and once at the press weight; one whose height differs — a line gained
 *  or lost — is marked `.ink-press-flat`, which keeps its ink entrance and drops its press. Every
 *  other heading keeps the gesture.
 * @module scripts/pressGuard
 */

const PRESS_SELECTOR = ".ink-press";
/** The press's own trigger (registers.css): `.is-in` on the heading or on its register node. */
const ENTERED_SELECTOR = ".is-in.ink-press, .is-in .ink-press";
const FLAT_CLASS = "ink-press-flat";
/** Sub-pixel rounding between the two layouts is not a line; the smallest press heading's line
 *  is tens of pixels tall. */
const LINE_TOLERANCE_PX = 1;

interface Measured {
  el: HTMLElement;
  rest: number;
  pressed: number;
}

/**
 * Marks every waiting press heading under `root` whose line count the press would change, once
 * the webfonts have loaded and again whenever the viewport's width changes. Returns a cleanup.
 */
export function guardInkPress(root: ParentNode): () => void {
  let disposed = false;
  let frame = 0;
  let lastWidth = window.innerWidth;

  const check = (): void => {
    frame = 0;
    if (disposed) return;
    const waiting = Array.from(root.querySelectorAll<HTMLElement>(PRESS_SELECTOR)).filter(
      (el) => !el.matches(ENTERED_SELECTOR),
    );
    if (!waiting.length) return;

    // Batched as writes, then reads, so the whole set costs three layouts rather than three per
    // heading. `transition: none` stays on until after the last of them: a style change between
    // two flushes is a transition start, and a heading must never be seen thinning or swelling
    // because it was measured.
    for (const el of waiting) {
      el.classList.remove(FLAT_CLASS);
      el.style.setProperty("transition", "none");
      el.style.setProperty("--wght", "var(--wght-rest)");
    }
    const measured: Measured[] = waiting.map((el) => ({
      el,
      rest: el.getBoundingClientRect().height,
      pressed: 0,
    }));
    for (const m of measured) m.el.style.removeProperty("--wght");
    for (const m of measured) m.pressed = m.el.getBoundingClientRect().height;
    for (const m of measured) {
      m.el.classList.toggle(FLAT_CLASS, Math.abs(m.pressed - m.rest) > LINE_TOLERANCE_PX);
    }
    // Flush the flattened weight while transitions are still off, then hand them back.
    waiting[0]?.getBoundingClientRect();
    for (const el of waiting) el.style.removeProperty("transition");
  };

  const schedule = (): void => {
    if (disposed || frame) return;
    frame = window.requestAnimationFrame(check);
  };

  // Only the inline size moves a line break. A phone's toolbar resizes the height on every scroll
  // direction change, and that must not re-measure every heading on the page.
  const onResize = (): void => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    schedule();
  };

  // Measured against the webfont, never the fallback: Georgia sets wider, and a verdict taken in
  // it would flatten headings that are safe once Cormorant arrives.
  void document.fonts.ready.then(schedule);
  window.addEventListener("resize", onResize, { passive: true });

  return () => {
    disposed = true;
    if (frame) window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
  };
}
