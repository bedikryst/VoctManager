/**
 * @file give-kindle.ts
 * @description Lights the bar's WESPRZYJ once per page. The first time the reader reaches the
 *  page's moment, `body.give-kindled` is set: the frame flares, holds, and settles to a glow
 *  that stays. The CSS lives with each bar (`.nav-support` in SiteChrome.astro,
 *  `.support-link--give` in landing 01-foundation.css). It never loops: motion in the bar is
 *  reserved for the ensemble singing.
 *
 *  THE MOMENT IS THE VIA. Elements marked `data-give-kindle` are the road of past evenings — the
 *  landing's register (#droga) and its support section, the stations of /koncerty, the milestones
 *  on /o-nas, a concert page's closing Via. Almost every one of those evenings was free to enter
 *  and someone paid for it, which is when the ask makes sense. A page with no mark falls back to
 *  its footer. A mark counts once its top passes the lower third of the viewport, so a section
 *  merely peeking in at the bottom edge does not light it; the footer counts on first sight,
 *  because on a short page it may never rise that far.
 *
 *  Re-armed on every `astro:page-load`. ClientRouter swaps the body on navigation, so the class
 *  never carries over to the next page. The landing's footer is an island (`.site-footer`), every
 *  other page's is markup (`.site-foot`); hydration reuses the server's node, so the observer
 *  keeps watching the same element.
 * @module scripts/give-kindle
 */

let observer: IntersectionObserver | null = null;

/** Reached = on screen, or already above it: a back navigation restores the scroll position past
    the mark, and the observer's first report then says "not intersecting" for a road walked. */
function kindle(entries: IntersectionObserverEntry[]): void {
  const reached = entries.some(
    (entry) => entry.isIntersecting || entry.boundingClientRect.top < 0,
  );
  if (!reached) return;
  document.body.classList.add("give-kindled");
  observer?.disconnect();
  observer = null;
}

function arm(): void {
  observer?.disconnect();
  observer = null;

  const moments = Array.from(document.querySelectorAll("[data-give-kindle]"));
  if (moments.length > 0) {
    observer = new IntersectionObserver(kindle, { rootMargin: "0px 0px -30% 0px" });
    moments.forEach((moment) => observer?.observe(moment));
    return;
  }

  const foot = document.querySelector(".site-foot, .site-footer");
  if (!foot) return;
  observer = new IntersectionObserver(kindle);
  observer.observe(foot);
}

document.addEventListener("astro:page-load", arm);
