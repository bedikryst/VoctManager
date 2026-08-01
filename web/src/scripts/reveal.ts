/**
 * @file reveal.ts
 * @description The site's one entrance controller. It flips `.is-in` on every register node it
 *  is given — ink (`.reveal`), lead (`.reveal-rule[-v]`), light (`.reveal-light`) and the
 *  appearance-less cue (`.reveal-cue`) — then lets go. What a class then DOES is entirely CSS's
 *  business (styles/registers.css); this decides only WHEN, and in what order.
 *
 *  Two callers, one implementation: `scripts/landing.ts` for the landing and `BaseLayout` for
 *  every other page. They differ in ONE authored parameter, the cadence, and in nothing else —
 *  the trigger geometry, the settle state machine and the trigger class are the site's, not the
 *  page's. Before 2026-08 they were two controllers whose geometries had quietly drifted apart
 *  (a ratio threshold on one side, a flat inset on the other), which is the kind of divergence
 *  this file exists to make impossible rather than to police.
 * @architecture Astro islands 2026
 * @module scripts/reveal
 */

/** Every register class, plus the cue. A node may wear ink and lead together and no other pair. */
const REVEAL_SELECTOR = ".reveal, .reveal-rule, .reveal-rule-v, .reveal-light, .reveal-cue";

const ONSET_GAP_MS = 220;
const MAX_BACKLOG_MS = 450;

/**
 * Guarantees `is-settled` when no transitionend arrives — a node scrolled past while hidden, a
 * transition cancelled mid-flight. It is therefore a HARD CEILING on every register choreography,
 * because `is-settled` strips the transition: a register that runs longer than this is cut off
 * mid-gesture, silently and only on the slowest path. Keep it clear of the longest one, which is
 * light (`--veil-delay` 0.6s + `--veil-lift` 1.8s = 2.4s). Cue nodes never reach it — `settle()`
 * returns early for them, which is what keeps the coda's 2.6s caption out of this budget.
 */
const SETTLE_FALLBACK_MS = 3400;

/**
 * How onsets are spaced when several nodes cross the trigger in one callback.
 *
 * `queue` — a shared onset queue, for a page whose siblings are generated in bulk. A bare
 * observer flips everything the scroll crossed inside one callback, so N siblings enter in
 * perfect unison, and unison is what makes a page read as machine-made far more than the choice
 * of effect does. Each onset starts at least `ONSET_GAP_MS` after the previous START, so the next
 * voice enters while the last is still moving — points of imitation. Two properties carry it:
 * document order rather than callback order, so a fast scroll still enters top-down; and a node
 * that arrives later than the gap on its own fires immediately, so a slow reader never pays added
 * latency.
 *
 * `authored` — no queue at all: the page has staggered its own nodes with `data-d`, which is a
 * CSS `transition-delay` and therefore independent of when the observer fires. Layering the queue
 * on top would delay those nodes twice. This is not a lesser mode; a hand-set cadence runs a
 * tighter step (90ms) than the queue's 220ms, and a threshold is crossed faster than a page is
 * read.
 */
export type RevealCadence = "queue" | "authored";

export interface RevealOptions {
  /** Reduced motion: settle everything at once and observe nothing. */
  reduce: boolean;
  cadence: RevealCadence;
}

/**
 * Observes every register node under `root` and returns a cleanup. Safe to call again after a
 * ClientRouter navigation: nodes already carrying `.is-in` are skipped, so a re-scan of a
 * partially entered page does not replay it.
 */
export function setupReveal(root: ParentNode, { reduce, cadence }: RevealOptions): () => void {
  const items = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)).filter(
    (el) => !el.classList.contains("is-in"),
  );
  if (!items.length) return () => {};

  if (reduce) {
    items.forEach((el) => el.classList.add("is-in", "is-settled"));
    return () => {};
  }

  const order = new Map(items.map((el, i) => [el, i] as const));
  const timers: number[] = [];
  let lastOnset = Number.NEGATIVE_INFINITY;

  // A cue has no transition of its own, so there is nothing to strip and no end event to wait
  // for — settling one would only leave a dead timer per interlude.
  const settle = (el: HTMLElement): void => {
    if (el.classList.contains("reveal-cue")) return;
    // A node carrying ink AND lead runs two transitions: opacity on itself, transform on the
    // pseudo-rule. `is-settled` kills BOTH, so accepting whichever ends first would cut the
    // other one off. The element's own transition is the one to wait for (it is the later of
    // the pair by design — the rule leads, the ink follows), and a transition on `::before`
    // reports the ORIGINATING element as `target`, so the only thing separating them is
    // `pseudoElement`. Without this guard the pair is locked at their current durations:
    // giving the rule a shorter clock — which is the natural tuning, a ruled line is fast —
    // would silently start snapping the ink to full.
    const inkBearing = el.classList.contains("reveal");
    const onEnd = (event: TransitionEvent): void => {
      if (event.target !== el) return;
      if (inkBearing && event.pseudoElement) return;
      if (event.propertyName !== "opacity" && event.propertyName !== "transform") return;
      el.classList.add("is-settled");
      el.removeEventListener("transitionend", onEnd);
    };
    el.addEventListener("transitionend", onEnd);
    timers.push(
      window.setTimeout(() => {
        el.classList.add("is-settled");
        el.removeEventListener("transitionend", onEnd);
      }, SETTLE_FALLBACK_MS),
    );
  };

  const enter = (el: HTMLElement): void => {
    el.classList.add("is-in");
    settle(el);
  };

  const io = new IntersectionObserver(
    (entries) => {
      const hit = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement)
        .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

      for (const el of hit) {
        io.unobserve(el);
        if (cadence === "authored") {
          enter(el);
          continue;
        }
        // The queue is CAPPED, and that cap is not a detail. `lastOnset` accumulates across the
        // whole page, so an unbounded queue means a fling from hero to coda schedules ~30 onsets
        // 220ms apart — a six-second tail in which element after element inks itself well above
        // the visitor, who is already at the bottom. THE CAP IS A SCROLL DISTANCE, not a comfort
        // margin: at an unhurried desktop reading pace (~400px/s through Lenis) every 100ms of
        // latency carries a node ~40px further up, and backlog only ever builds during a fast
        // scroll — exactly when the node is already moving fastest. Two onsets deep is enough to
        // break unison, which is all the queue is for.
        const now = performance.now();
        const onset = Math.min(Math.max(now, lastOnset + ONSET_GAP_MS), now + MAX_BACKLOG_MS);
        lastOnset = onset;
        if (onset <= now) enter(el);
        else timers.push(window.setTimeout(() => enter(el), onset - now));
      }
    },
    // threshold 0 + a bottom inset, NOT a ratio: "10% of the element is visible" means a
    // different trigger line for a one-line paragraph than for a section-tall veil, so node size
    // was quietly setting the tempo — which is the defect that made the subpage observer differ
    // from this one in the first place. A zero threshold against an inset root fires when the top
    // edge crosses 88% of the viewport, identically for every node, which is what the queue needs
    // as input and what the whole timing budget in docs/web-reveal-remediation.md is measured
    // against. Same shape setupManifestLight uses.
    { threshold: 0, rootMargin: "0px 0px -12% 0px" },
  );

  items.forEach((el) => io.observe(el));

  return () => {
    io.disconnect();
    timers.forEach((t) => window.clearTimeout(t));
  };
}
