/**
 * @file foundation-rail.ts
 * @description Marks the section being read in /fundacja's rail: the rail link whose section's top
 *  has passed a line 30 % down the viewport carries `aria-current="location"`, and the page's CSS
 *  draws the mark from that attribute. Without this script the rail is a plain index.
 *
 *  THE MARK IS READ FROM GEOMETRY, NOT FROM EVENTS. On every scroll frame the mark goes to the
 *  last section whose top is above the line, so it stays through the margins between sections,
 *  and above the first section nothing is marked — the hero is not an entry in the index. Because
 *  the state is recomputed rather than stepped, a jump (Home, a hash link, a restored scroll
 *  position) lands on the right entry; an observer that steps "back one section" when the current
 *  one falls below the line leaves a stale mark after any jump that skips sections. Five
 *  rectangles a frame are cheaper than that bookkeeping.
 *
 *  ClientRouter-safe: re-armed on every `astro:page-load`, and a page without a rail drops the
 *  listener.
 * @architecture Astro islands 2026
 * @module scripts/foundation-rail
 */

/** The reading line, as a fraction of the viewport's height from its top. */
const LINE = 0.3;

let disarm: (() => void) | undefined;

function setupRail(): void {
  disarm?.();
  disarm = undefined;

  const rail = document.querySelector<HTMLElement>("[data-rail]");
  if (!rail) return;
  const pairs = [...rail.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
    .map((link) => ({ link, section: document.getElementById(decodeURIComponent(link.hash.slice(1))) }))
    .filter((pair): pair is { link: HTMLAnchorElement; section: HTMLElement } => pair.section !== null);
  if (!pairs.length) return;

  let frame = 0;
  let current = -2;
  const update = () => {
    frame = 0;
    const line = window.innerHeight * LINE;
    let next = -1;
    pairs.forEach(({ section }, index) => {
      if (section.getBoundingClientRect().top <= line) next = index;
    });
    if (next === current) return;
    current = next;
    pairs.forEach(({ link }, index) => {
      if (index === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();
  disarm = () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}

document.addEventListener("astro:page-load", setupRail);
