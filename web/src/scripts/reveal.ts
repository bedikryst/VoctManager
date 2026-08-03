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
 * The step the queue falls back to once it is running behind. It is a PERCEPTUAL floor, not a
 * comfort value: against the ink's 390 ms of perceived travel (--ease-ink reaches 82 % at 43 %
 * of --ink-in) two onsets 70 ms apart still read as two voices, and anything below that reads
 * as one event with a soft edge. See `claim()` for why the queue needs a floor at all.
 */
const MIN_GAP_MS = 70;

/**
 * The trigger line, as a whole-number percentage of the viewport inset from its bottom edge: a
 * node enters when its top crosses 88% vh. Kept as an integer because the same number is read
 * twice — once as a `rootMargin` string, once as a ratio by `outOfReach` — and `0.12 * 100` is
 * not 12 in binary floating point. The whole timing budget in docs/web-reveal-remediation.md is
 * measured against this line; moving it re-times every register on the site.
 */
const TRIGGER_INSET_PCT = 12;

/**
 * Guarantees `is-settled` when no transitionend arrives — a node scrolled past while hidden, a
 * transition cancelled mid-flight. It is therefore a HARD CEILING on every register choreography,
 * because `is-settled` strips the transition: a register that runs longer than this is cut off
 * mid-gesture, silently and only on the slowest path. Keep it clear of the longest one, which is
 * light: `--veil-lift` 1.8s plus a delay that is the SUM of the host's `--veil-delay` (0.6s at
 * most, landing sections) and the subtree's `data-d` (0.36s at most), so 2.76s is the ceiling a
 * new register has to stay under. Cue nodes never reach it — `settle()` returns early for them,
 * which is what keeps the coda's 2.6s caption out of this budget.
 */
const SETTLE_FALLBACK_MS = 3400;

/**
 * Is this node in the document's TAIL — the strip the trigger line can never reach?
 *
 * The line stands 12% of a viewport above its bottom edge, but the scroll runs out when the
 * document's foot meets that bottom edge. Everything whose top sits inside the last 12%-of-a-
 * viewport of the document is therefore still BELOW the line at maximum scroll: the inset root
 * never intersects it, the observer callback never runs for it, and it stays at half-ink for the
 * life of the page with nothing in the console to say so. The landing's colophon lived exactly
 * there — at 1920×950 its top came to rest 852px down against a line at 836.
 *
 * Measured, not assumed, because the answer changes with the viewport and with whatever the page
 * last laid out; `boundingClientRect` comes from the observer entry, so the only reads here are
 * one document height and one scroll offset per callback.
 */
function outOfReach(top: number, docHeight: number, viewport: number): boolean {
  return docHeight - top < viewport * (TRIGGER_INSET_PCT / 100);
}

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
  const taken = new Set<HTMLElement>();
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

  /** Claim a node for its entrance: it leaves both observers, then takes its place in the queue. */
  const claim = (el: HTMLElement): void => {
    if (taken.has(el)) return;
    taken.add(el);
    io.unobserve(el);
    tail.unobserve(el);

    if (cadence === "authored") {
      enter(el);
      return;
    }
    // The queue is CAPPED, and that cap is not a detail. `lastOnset` accumulates across the
    // whole page, so an unbounded queue means a fling from hero to coda schedules ~30 onsets
    // 220ms apart — a six-second tail in which element after element inks itself well above
    // the visitor, who is already at the bottom. THE CAP IS A SCROLL DISTANCE, not a comfort
    // margin: at an unhurried desktop reading pace (~400px/s through Lenis) every 100ms of
    // latency carries a node ~40px further up, and backlog only ever builds during a fast
    // scroll — exactly when the node is already moving fastest.
    //
    // Behind the cap the step SHRINKS to MIN_GAP_MS; it never collapses, and the difference is
    // the whole reason this is three lines instead of one. Clamping the onset itself to
    // `now + MAX_BACKLOG_MS` reads as the same idea and is its opposite: once the queue is
    // that deep EVERY node returns the ceiling, and nodes that crossed the trigger in one
    // frame share a `now` — so they share an onset and enter in exact unison, which is the one
    // thing the queue exists to prevent. It bites where the page is most likely to be flung
    // rather than read: `.final-support` carries six register nodes at the foot of a 15,600px
    // document, so the queue is saturated every time they are reached, and measured that way
    // six of them entered within 0–52ms of each other. The floor keeps the tail bounded too —
    // it grows 70ms per node instead of 220, so the cap's own promise survives it.
    const now = performance.now();
    const slot = Math.max(now, lastOnset + ONSET_GAP_MS);
    const ceiling = now + MAX_BACKLOG_MS;
    const onset = slot <= ceiling ? slot : Math.max(ceiling, lastOnset + MIN_GAP_MS);
    lastOnset = onset;
    if (onset <= now) enter(el);
    else timers.push(window.setTimeout(() => enter(el), onset - now));
  };

  /**
   * Top-down by GEOMETRY, not by callback order — a fling that crosses several nodes in one
   * frame must still enter them the way they are read.
   *
   * Document order is only a PROXY for reading order, and it holds exactly as long as nothing
   * re-sequences the layout. The landing's phone footer breaks it: its bands are re-ordered
   * with flex `order` (11-mobile.css), so the record that prints last stands third in the
   * markup and used to ink two bands ahead of its turn. The rect the observer already hands us
   * is the real answer, and it costs nothing to read.
   *
   * Rounded into 4px buckets so siblings hanging from one grid line TIE rather than sorting on
   * sub-pixel noise, and a tie falls back to document order — `Array#sort` is stable, which is
   * what still enters the desktop footer's four columns left to right.
   */
  const hits = (entries: IntersectionObserverEntry[]): IntersectionObserverEntry[] =>
    entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => {
        const band =
          Math.round(a.boundingClientRect.top / 4) - Math.round(b.boundingClientRect.top / 4);
        if (band !== 0) return band;
        return (order.get(a.target as HTMLElement) ?? 0) - (order.get(b.target as HTMLElement) ?? 0);
      });

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of hits(entries)) claim(entry.target as HTMLElement);
    },
    // threshold 0 + a bottom inset, NOT a ratio: "10% of the element is visible" means a
    // different trigger line for a one-line paragraph than for a section-tall veil, so node size
    // was quietly setting the tempo — which is the defect that made the subpage observer differ
    // from this one in the first place. A zero threshold against an inset root fires when the top
    // edge crosses 88% of the viewport, identically for every node, which is what the queue needs
    // as input and what the whole timing budget in docs/web-reveal-remediation.md is measured
    // against. Same shape setupManifestLight uses.
    { threshold: 0, rootMargin: `0px 0px -${TRIGGER_INSET_PCT}% 0px` },
  );

  // The document's tail, on the viewport's own bottom edge — the only trigger a node in the last
  // 12% of the page can ever cross (see `outOfReach`). It watches every node, because which nodes
  // are unreachable is a fact about layout at the moment of asking, not at setup: fonts, images
  // and a footer that reflows all move the document's foot. Nodes the main line WILL reach are
  // dropped here on their way past, so the extra work is one comparison per node per page and no
  // register fires a viewport early.
  const tail = new IntersectionObserver(
    (entries) => {
      const docHeight = document.documentElement.scrollHeight;
      const viewport = window.innerHeight;
      const scroll = window.scrollY;
      for (const entry of hits(entries)) {
        const el = entry.target as HTMLElement;
        if (outOfReach(entry.boundingClientRect.top + scroll, docHeight, viewport)) claim(el);
        else tail.unobserve(el);
      }
    },
    { threshold: 0 },
  );

  items.forEach((el) => {
    io.observe(el);
    tail.observe(el);
  });

  return () => {
    io.disconnect();
    tail.disconnect();
    timers.forEach((t) => window.clearTimeout(t));
  };
}
