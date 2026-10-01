/**
 * @file foundation-rail.ts
 * @description Marks the section being read in /fundacja's rail: the rail link whose section has
 *  crossed a line 30 % down the viewport carries `aria-current="location"`, and the page's CSS
 *  draws the mark from that attribute. Without this script the rail is a plain index.
 *
 *  THE MARK STAYS THROUGH A GAP. Sections are separated by margins no section covers; scrolling
 *  down through one keeps the section just left marked until the next one reaches the line.
 *  Scrolling up past a section's top hands the mark back to the one above it, and above the first
 *  section nothing is marked — the hero is not an entry in the index.
 *
 *  ClientRouter-safe: the observer is rebuilt on every `astro:page-load` and dropped first, so a
 *  navigation never leaves one watching a detached body.
 * @architecture Astro islands 2026
 * @module scripts/foundation-rail
 */

/** The reading line, as an inset from the viewport's top; the band below it is one pixel deep. */
const LINE_MARGIN = "-30% 0px -69% 0px";

let observer: IntersectionObserver | undefined;

function setupRail(): void {
  observer?.disconnect();
  observer = undefined;

  const rail = document.querySelector<HTMLElement>("[data-rail]");
  if (!rail) return;
  const links = [...rail.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const pairs = links
    .map((link) => ({ link, section: document.getElementById(decodeURIComponent(link.hash.slice(1))) }))
    .filter((pair): pair is { link: HTMLAnchorElement; section: HTMLElement } => pair.section !== null);
  if (!pairs.length) return;

  const sections = pairs.map((pair) => pair.section);
  let current = -1;

  const render = () => {
    pairs.forEach(({ link }, index) => {
      if (index === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const index = sections.indexOf(entry.target as HTMLElement);
        if (entry.isIntersecting) current = index;
        // The section fell below the line: the reader scrolled up past its top.
        else if (index === current && entry.boundingClientRect.top > (entry.rootBounds?.top ?? 0)) current = index - 1;
      }
      render();
    },
    { rootMargin: LINE_MARGIN },
  );
  sections.forEach((section) => observer!.observe(section));
}

document.addEventListener("astro:page-load", setupRail);
