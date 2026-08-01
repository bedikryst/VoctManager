/**
 * @file landing.ts
 * @description Cross-browser motion controller for the landing (`/`). Re-implements the
 *  scroll-driven behaviours the SPA expressed as React hooks AND the kinetic typography the
 *  CSS expressed via `animation-timeline` / `view-timeline` — neither of which runs in the
 *  target browser (native scroll-driven CSS is unsupported here; that was the parallax bug).
 *
 *  Owns: reveal (`.is-visible`/`.is-settled` across the four register classes, paced by one
 *  shared onset queue), rite-glow (cursor spotlight), smooth-details (animated accordion),
 *  Lenis anchor smooth-scroll, the hero's variable-font breath on a single rAF scroll loop,
 *  the manifest light (one-shot `.is-lit` per stanza — the sweep itself is a CSS transition),
 *  the interlude breath (scroll-velocity knot bloom while the ambient is silent) and the
 *  static-section interactions (IBAN copy, vault and video triggers). (The coda's old
 *  per-letter wave is gone — the "Ostatni takt" coda draws itself via the shared .knot-draw
 *  choreography, no JS of its own.)
 *
 *  The editorial headings' weight is NOT driven here any more: it is the ink register's own
 *  second dimension (`.ink-press`, styles/registers.css). Nothing on this page scrubs a
 *  weight against scroll except the hero, which is keyed to the threshold rather than to an
 *  entrance.
 *
 *  NOT owned here (deliberately): parallax (the global BaseLayout `[data-parallax]` controller,
 *  the fixed cross-browser one), chrome tint (the StickyHeader island owns it via React state),
 *  and the footer wordmark cursor reactivity (the SiteFooter island). All re-bind on
 *  `astro:page-load` so ClientRouter navigations stay live; bindings target only `.voct-landing`.
 * @architecture Astro islands 2026
 * @module scripts/landing
 */

interface LenisLike {
  scrollTo: (target: number | string | HTMLElement, opts?: { offset?: number }) => void;
  stop?: () => void;
  start?: () => void;
}

const reduceMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = (): boolean =>
  window.matchMedia("(pointer: fine) and (hover: hover)").matches;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Two-segment ease through a mid keyframe — replicates the CSS breath keyframes. */
const breath3 = (p: number, a: number, mid: number, b: number, midAt = 0.55): number => {
  if (p <= midAt) return a + (mid - a) * (p / midAt);
  return mid + (b - mid) * ((p - midAt) / (1 - midAt));
};

/** Writes only on a real change. Past the hero's 90vh the scrubbed value is pinned, yet the
 *  scroll loop keeps running for the rest of the page — and re-setting an identical inline
 *  declaration still dirties the element's style on every one of those frames. */
const wght = (el: HTMLElement, value: number): void => {
  const next = `"wght" ${Math.round(value)}`;
  if (el.style.fontVariationSettings === next) return;
  el.style.fontVariationSettings = next;
};

const cleanups: Array<() => void> = [];
const teardown = (): void => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) fn();
  }
};

// ── Reveal: one-shot entrance in the page's three registers, then persists ───────────────────
// Flips `.is-visible` once on every register node — ink (.reveal), lead (.reveal-rule[-v]),
// light (.reveal-light) and the appearance-less cue (.reveal-cue) — then lets go. What each
// class then DOES is entirely CSS's business (the register block in landing/06-footer.css);
// this controller only decides WHEN, and in what order.
//
// THE ONSET QUEUE is the part that matters. A bare IntersectionObserver flips everything the
// scroll crossed inside one callback, so N siblings enter in perfect unison — and unison is
// what makes a page read as machine-made, far more than the choice of effect does. The seven
// register entries were the worst case: a single flick of the thumb fired four of them as one
// block. setupManifestLight already solved this for the stanzas (points of imitation — each
// onset starts ≥GAP after the previous START, so the next voice enters while the last is still
// moving), and that queue now governs every entrance on the page. Two properties carry over:
// document order rather than callback order, so a fast scroll still enters top-down; and an
// element that arrives later than the gap on its own fires immediately, so a slow reader never
// pays added latency.
//
// The queue is CAPPED, and that cap is not a detail. `lastOnset` accumulates across the whole
// page, so an unbounded queue means a fling from hero to coda schedules ~30 onsets 220ms apart
// — a six-second tail in which element after element inks itself well above the visitor, who is
// already at the bottom. That is precisely the defect this pass removed from SilenceMoment, and
// it would have been reintroduced by the machinery meant to fix the page's timing. With the cap,
// a fast scroll degrades gracefully: each node inks at most MAX_BACKLOG_MS after it crossed the
// trigger, so the stagger falls back to the natural spacing of the scroll itself.
//
// THE CAP IS A SCROLL DISTANCE, not a comfort margin. A node fires when its top crosses ~88%
// of the viewport and then keeps travelling: at an unhurried desktop reading pace (~400px/s
// through Lenis) every 100ms of latency carries it ~40px further up, so backlog + duration is
// the whole budget for the gesture to happen where the eye is. 900ms of backlog on top of a
// 900ms ink put the node ~720px higher by the time it finished — off the top of a laptop
// screen — and the backlog only ever builds during a fast scroll, i.e. exactly when the node
// is already moving fastest. Two onsets deep is enough to break unison, which is all the
// queue is for.
const REVEAL_SELECTOR = ".reveal, .reveal-rule, .reveal-rule-v, .reveal-light, .reveal-cue";
const ONSET_GAP_MS = 220;
const MAX_BACKLOG_MS = 450;

function setupReveal(root: HTMLElement, reduce: boolean): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
  if (!items.length) return;

  if (reduce) {
    items.forEach((el) => el.classList.add("is-visible", "is-settled"));
    return;
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
      }, 2400),
    );
  };

  const enter = (el: HTMLElement): void => {
    el.classList.add("is-visible");
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
        const now = performance.now();
        const onset = Math.min(Math.max(now, lastOnset + ONSET_GAP_MS), now + MAX_BACKLOG_MS);
        lastOnset = onset;
        if (onset <= now) enter(el);
        else timers.push(window.setTimeout(() => enter(el), onset - now));
      }
    },
    // threshold 0 + a bottom inset, NOT a ratio: "12% of the element is visible" means a
    // different trigger line for a one-line paragraph than for a section-tall veil, so node
    // size was quietly setting the tempo. A zero threshold against an inset root fires when the
    // top edge crosses ~88% of the viewport, identically for every node, which is what the
    // queue needs as input. Same shape setupManifestLight uses.
    { threshold: 0, rootMargin: "0px 0px -12% 0px" },
  );

  items.forEach((el) => io.observe(el));
  cleanups.push(() => {
    io.disconnect();
    timers.forEach((t) => window.clearTimeout(t));
  });
}

// ── Rite glow: cursor-tracked spotlight on the image-rite section (desktop only) ────────────
function setupRiteGlow(root: HTMLElement, reduce: boolean): void {
  const rite = root.querySelector<HTMLElement>(".image-rite");
  if (!rite || reduce || !finePointer()) return;

  let pending = false;
  let lastX = 50;
  let lastY = 50;
  const apply = (): void => {
    rite.style.setProperty("--glow-x", `${lastX}%`);
    rite.style.setProperty("--glow-y", `${lastY}%`);
    pending = false;
  };
  const onEnter = (): void => rite.classList.add("is-glowing");
  const onLeave = (): void => rite.classList.remove("is-glowing");
  const onMove = (event: PointerEvent): void => {
    const rect = rite.getBoundingClientRect();
    lastX = ((event.clientX - rect.left) / rect.width) * 100;
    lastY = ((event.clientY - rect.top) / rect.height) * 100;
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(apply);
  };

  rite.addEventListener("pointerenter", onEnter);
  rite.addEventListener("pointerleave", onLeave);
  rite.addEventListener("pointermove", onMove);
  cleanups.push(() => {
    rite.removeEventListener("pointerenter", onEnter);
    rite.removeEventListener("pointerleave", onLeave);
    rite.removeEventListener("pointermove", onMove);
  });
}

// ── Smooth details: animated, exclusive accordion for the path cards ────────────────────────
function setupSmoothDetails(root: HTMLElement): void {
  const SELECTOR = ".path-card-detail";
  const OPEN = 520;
  const CLOSE = 380;
  const EASING = "cubic-bezier(0.22, 0.61, 0.16, 1)";
  const items = Array.from(root.querySelectorAll<HTMLDetailsElement>(SELECTOR));
  if (!items.length) return;

  const reduced = reduceMotion();
  const registry = new Map<HTMLDetailsElement, { close: () => void }>();

  items.forEach((details) => {
    const summary = details.querySelector("summary");
    if (!summary) return;
    // Wrap the post-summary content once so its height can be transitioned.
    let wrap = details.querySelector<HTMLElement>(".path-card-detail-body");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "path-card-detail-body";
      while (summary.nextSibling) wrap.appendChild(summary.nextSibling);
      details.appendChild(wrap);
    }
    const body = wrap;

    body.style.overflow = "hidden";
    body.style.willChange = "height, opacity";
    body.style.height = details.open ? "auto" : "0px";
    body.style.opacity = details.open ? "1" : "0";

    let animating = false;
    const finish = (toOpen: boolean): void => {
      body.style.height = toOpen ? "auto" : "0px";
      body.style.opacity = toOpen ? "1" : "0";
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
      if (toOpen) details.setAttribute("open", "");
      const start = body.getBoundingClientRect().height;
      body.style.height = `${start}px`;
      body.style.opacity = toOpen ? "0" : "1";
      void body.getBoundingClientRect();
      const target = toOpen ? body.scrollHeight : 0;
      const duration = toOpen ? OPEN : CLOSE;
      body.style.transition = `height ${duration}ms ${EASING}, opacity ${duration}ms ${EASING}`;
      window.requestAnimationFrame(() => {
        body.style.height = `${target}px`;
        body.style.opacity = toOpen ? "1" : "0";
      });
      const done = (event: TransitionEvent): void => {
        if (event.target !== body || event.propertyName !== "height") return;
        body.removeEventListener("transitionend", done);
        body.style.transition = "";
        finish(toOpen);
      };
      body.addEventListener("transitionend", done);
    };

    registry.set(details, {
      close: () => {
        if (details.open && !animating) animate(false);
      },
    });

    const onClick = (event: Event): void => {
      event.preventDefault();
      if (animating) return;
      const toOpen = !details.open;
      const others = toOpen
        ? Array.from(registry.entries()).filter(([el]) => el !== details && el.open)
        : [];
      if (toOpen) others.forEach(([, api]) => api.close());
      animate(toOpen);
      if (toOpen && window.matchMedia("(max-width: 980px)").matches) {
        const delay = others.length > 0 ? 420 : 0;
        window.setTimeout(() => {
          const rect = summary.getBoundingClientRect();
          const targetY = window.scrollY + rect.top - window.innerHeight * 0.22;
          window.scrollTo({ top: targetY, behavior: reduced ? "auto" : "smooth" });
        }, delay);
      }
    };

    summary.addEventListener("click", onClick);
    cleanups.push(() => summary.removeEventListener("click", onClick));
  });
}

// ── Lenis anchors: route in-document anchor clicks through the shared Lenis instance ─────────
// CAPTURE phase, like scripts/vault-triggers.ts: ClientRouter's click handler is a BUBBLING
// document listener registered ahead of this script (its own sits in <head>), and a bare `#hash`
// anchor is a same-origin link as far as it is concerned — so bubbling here means the router has
// already consumed the click and taken its same-page hash path, which jumps natively (no
// ANCHOR_OFFSET, so the fixed bar covers the target) and leaves a junk history entry per click.
// The removal below must repeat the flag: capture is part of a listener's identity.
function setupLenisAnchors(): void {
  const ANCHOR_OFFSET = -80;
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!anchor || anchor.dataset.noLenis !== undefined) return;
    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;
    const dest = document.querySelector<HTMLElement>(href);
    if (!dest) return;
    event.preventDefault();
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (lenis) {
      lenis.scrollTo(dest, { offset: ANCHOR_OFFSET });
    } else {
      const top = window.scrollY + dest.getBoundingClientRect().top + ANCHOR_OFFSET;
      window.scrollTo({ top, behavior: reduceMotion() ? "auto" : "smooth" });
    }
  };
  document.addEventListener("click", onClick, true);
  cleanups.push(() => document.removeEventListener("click", onClick, true));
}

// ── Hero breath: the only weight axis on the page scrubbed against scroll ───────────────────
// Scrubbed deliberately, and this is the one place it is defensible: the hero's weight is keyed
// to the THRESHOLD — an authored moment the visitor crosses once and leaves behind — so a value
// that tracks position, and runs backwards when they scroll back, is the honest reading.
//
// DO NOT extend this loop to the editorial headings. Their weight is part of the ink register
// (`.ink-press`, styles/registers.css) and must stay one-shot: an entrance is not a position.
// Scrubbed, it ran over 0.75vh (~1.7s at reading pace) against the ink's 0.9s, opened 12% of the
// viewport ahead of the ink's own trigger, and reversed on scroll-up — a page un-writing what it
// had already written.
function setupHeroBreath(root: HTMLElement, reduce: boolean): void {
  if (reduce) return;

  const heroTitle = root.querySelector<HTMLElement>(".hero-title");
  if (!heroTitle) return;
  const heroEm = root.querySelector<HTMLElement>(".hero-title em");

  let ticking = false;
  const update = (): void => {
    ticking = false;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const p = clamp01(window.scrollY / (vh * 0.9));
    wght(heroTitle, breath3(p, 540, 380, 300));
    if (heroEm) wght(heroEm, breath3(p, 620, 380, 300));
  };

  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
  cleanups.push(() => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  });
}

// ── Manifest light ──────────────────────────────────────────────────────────────────────────
// JS owns exactly ONE bit per line: `.is-lit`, set once when the stanza's top crosses ~74%
// of the viewport (the reading zone), then the observer lets go. Everything visual — the
// left→right light sweep on the stanzas (--ink-reveal mask transition) and the answer's
// blur-into-focus + gold bloom — lives in 03-manifest-rite.css, so the draw is TIME-based
// and always completes: a fast scroll at worst catches it mid-flight, never strands it.
// This replaced the scroll-scrubbed raking light (per-frame color/textShadow writes +
// per-word stagger + delayed group reveal): scrubbing tied the tempo to scroll velocity,
// and its 0.32 "settled floor" left every read stanza regressed to gray — the manifest
// un-revealing what it had revealed. One-shot light, permanent ink.
//
// CANON ENTRIES: stanza I is one line tall, so a single scroll gesture often carries both
// I and II past the trigger — and two sweeps running in unison read as a copy-pasted
// effect, not choreography. The onset queue makes the voices enter in imitation instead:
// each lit start must come ≥GAP_MS after the previous one's start (start-to-start, like
// points of imitation — the previous sweep is still running when the next voice enters).
// A stanza that arrives naturally later than the gap lights immediately: slow readers pay
// zero added latency. The answer replies a short breath behind III (ANSWER_GAP_MS) — enough
// that "Odsłania." reads as a response, not a fourth voice firing in unison, but NOT a full-
// inking wait: it is the manifest's payoff word and must land in view. The old 3.4s hold
// stranded the reveal off-screen even on slow scroll (III and the answer cross the trigger
// close together, so the gap kept biting), and its own blur-into-focus then played where no
// one was looking. Short reply + a quick entrance (03-manifest-rite.css) keeps the moment.
function setupManifestLight(root: HTMLElement, reduce: boolean): void {
  // Under reduced motion DocumentGates never adds html.voct-motion, so the CSS half-light
  // states stay inert and the manifest is plain full ink — nothing to drive here.
  if (reduce) return;
  const manifest = root.querySelector<HTMLElement>(".manifest");
  if (!manifest) return;
  const lines = Array.from(manifest.querySelectorAll<HTMLElement>(".manifest-line-group"));
  if (!lines.length) return;

  const GAP_MS = 1600;
  const ANSWER_GAP_MS = 1000;
  let lastOnset = Number.NEGATIVE_INFINITY;
  const timers: number[] = [];

  const light = (line: HTMLElement): void => {
    const gap = line.classList.contains("manifest-answer") ? ANSWER_GAP_MS : GAP_MS;
    const now = performance.now();
    const onset = Math.max(now, lastOnset + gap);
    lastOnset = onset;
    if (onset <= now) {
      line.classList.add("is-lit");
    } else {
      timers.push(window.setTimeout(() => line.classList.add("is-lit"), onset - now));
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      // Document order, not callback order — the canon must enter top-down even when
      // one callback delivers several stanzas at once (fast scroll, mid-page load).
      const hit = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement)
        .sort((a, b) => lines.indexOf(a) - lines.indexOf(b));
      hit.forEach((line) => {
        light(line);
        io.unobserve(line);
      });
    },
    // Bottom inset puts the trigger line at ~74% of the viewport: low enough that the
    // visitor watches the light pass ("wjeżdżam i już stoi" was the 85% defect), high
    // enough that a stanza in view on load lights immediately.
    { threshold: 0, rootMargin: "0px 0px -26% 0px" },
  );
  lines.forEach((line) => io.observe(line));
  cleanups.push(() => {
    io.disconnect();
    timers.forEach((t) => window.clearTimeout(t));
  });
}

// ── Interlude breath: scroll-driven knot bloom while the ambient is silent ──────────────────
// The aether knots are audio-reactive (--knot-intensity, written by useChantAudio's analyser),
// but only visitors who chose voice ever saw them alive — for everyone else they sat inert.
// Silent visits now drive the same custom property from smoothed scroll velocity, so the
// bloom + brightness flare with movement through the rite and dim like an ember at rest.
// Ownership: the analyser keeps the var whenever the ambient plays (body.audio-on guards
// every write here), so the two drivers never fight.
function setupInterludeBreath(root: HTMLElement, reduce: boolean): void {
  if (reduce) return;
  const knots = Array.from(root.querySelectorAll<HTMLElement>(".aether-knot"));
  if (!knots.length) return;

  let lastY = window.scrollY;
  let level = 0;
  let raf: number | null = null;

  const tick = (): void => {
    raf = null;
    if (document.body.classList.contains("audio-on")) {
      level = 0;
      return; // analyser owns --knot-intensity while the ambient plays
    }
    const y = window.scrollY;
    const velocity = Math.min(1, Math.abs(y - lastY) / 28);
    lastY = y;
    // Attack fast, release slow — flare with the gesture, fade like a candle.
    level += (velocity - level) * (velocity > level ? 0.3 : 0.045);
    const settled = level < 0.006;
    const value = settled ? "0" : level.toFixed(3);
    const vh = window.innerHeight;
    for (const knot of knots) {
      const r = knot.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      knot.style.setProperty("--knot-intensity", value);
    }
    if (!settled) raf = window.requestAnimationFrame(tick);
  };

  const onScroll = (): void => {
    if (raf === null) raf = window.requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  cleanups.push(() => {
    window.removeEventListener("scroll", onScroll);
    if (raf !== null) window.cancelAnimationFrame(raf);
    knots.forEach((knot) => knot.style.setProperty("--knot-intensity", "0"));
  });
}

// ── Silence moment: NO controller, by two separate decisions ─────────────────────────────────
// 1. No scroll-lock, ever. This once halted scroll for ~2.8s as an "enforced stillness"; on
//    touch — and in desktop DevTools emulation, where `pointer` can still report `fine` — a page
//    that ignores a swipe reads as broken. A musical rest is measured time, but on a page the
//    reader holds the clock, so the only honest rest is space: the section's own height.
// 2. No entrance code either. What stood here added `is-listening` AND `is-settled` in the same
//    call at bind time, which resolved the ornament and the line to their resting opacities
//    while the visitor was still six screens up in the hero — the 1.6s entrance played to an
//    empty room, and `tacet.` was simply present by the time anyone arrived. The section is now
//    a `.reveal-cue` like the interludes and the coda: the shared observer reaches it when the
//    visitor does, and 10-silence.css draws the ornament outward from its centre dot.

// ── Interactions: IBAN copy + vault-open + video-open dispatch from static sections ─────────
// Vault and VideoLightbox live in their own React islands (Faza 3c); static "Wesprzyj" triggers
// reach the vault over `voct:open-vault`, and static "Zobacz i usłysz"/"Zobacz fragment" links
// reach the lightbox over `voct:open-video`. Video triggers are controls, not media anchors:
// source URLs are bundled asset URLs passed via `data-video-src`.
function setupInteractions(root: HTMLElement): void {
  type VideoOpenDetail = {
    src?: string;
    caption?: string;
    portrait?: boolean;
    note?: string;
  };

  let pendingVideo: VideoOpenDetail | null = null;
  const dispatchVideo = (detail: VideoOpenDetail): void => {
    window.dispatchEvent(new CustomEvent("voct:open-video", { detail }));
  };
  const flushPendingVideo = (): void => {
    if (!pendingVideo) return;
    const detail = pendingVideo;
    pendingVideo = null;
    dispatchVideo(detail);
  };

  window.addEventListener("voct:video-ready", flushPendingVideo);
  cleanups.push(() => window.removeEventListener("voct:video-ready", flushPendingVideo));

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const copyBtn = target.closest<HTMLButtonElement>("[data-copy]");
    if (copyBtn) {
      const value = copyBtn.dataset.copy ?? "";
      void navigator.clipboard?.writeText(value).then(() => {
        const original = copyBtn.dataset.label ?? copyBtn.textContent ?? "Kopiuj";
        copyBtn.dataset.label = original;
        copyBtn.textContent = "Skopiowano";
        window.setTimeout(() => {
          copyBtn.textContent = original;
        }, 1600);
      });
      return;
    }

    const vaultBtn = target.closest<HTMLElement>("[data-vault-open]");
    if (vaultBtn) {
      event.preventDefault();
      const amount = Number(vaultBtn.dataset.vaultOpen);
      window.dispatchEvent(
        new CustomEvent("voct:open-vault", {
          detail: { amount: Number.isFinite(amount) ? amount : undefined },
        }),
      );
    }

    const videoBtn = target.closest<HTMLElement>("[data-video-open]");
    if (videoBtn) {
      event.preventDefault();
      const detail = {
        src: videoBtn.dataset.videoSrc,
        caption: videoBtn.dataset.videoCaption,
        portrait: videoBtn.dataset.videoPortrait === "true",
        note: videoBtn.dataset.videoNote,
      };
      if (!(window as Window & { __voctVideoReady?: boolean }).__voctVideoReady) {
        pendingVideo = detail;
        return;
      }
      dispatchVideo(detail);
    }
  };
  root.addEventListener("click", onClick);
  cleanups.push(() => root.removeEventListener("click", onClick));
}

function bind(): void {
  const root = document.querySelector<HTMLElement>(".voct-landing");
  if (!root) return;
  const reduce = reduceMotion();
  setupReveal(root, reduce);
  setupRiteGlow(root, reduce);
  setupSmoothDetails(root);
  setupLenisAnchors();
  setupHeroBreath(root, reduce);
  setupManifestLight(root, reduce);
  setupInterludeBreath(root, reduce);
  setupInteractions(root);
}

document.addEventListener("astro:page-load", () => {
  teardown();
  bind();
});
document.addEventListener("astro:before-swap", teardown);
