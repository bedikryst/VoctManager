/**
 * @file landing.ts
 * @description Cross-browser motion controller for the landing (`/`). Re-implements the
 *  scroll-driven behaviours the SPA expressed as React hooks AND the kinetic typography the
 *  CSS expressed via `animation-timeline` / `view-timeline` — neither of which runs in the
 *  target browser (native scroll-driven CSS is unsupported here; that was the parallax bug).
 *
 *  Owns: rite-glow (cursor spotlight), the path cards' exclusivity and phone follow-scroll,
 *  Lenis anchor smooth-scroll, the hero's variable-font breath on a single rAF scroll loop,
 *  the manifest light (one-shot `.is-lit` per line-group, `.is-spent` when its sweep is over —
 *  the sweep itself is a CSS transition),
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
 *  NOT owned here (deliberately): the reveal registers — this page runs the SHARED controller
 *  (`scripts/reveal.ts`) like every other, and passes the one parameter that is genuinely the
 *  landing's: `cadence: "queue"`, because its siblings are generated in bulk and would otherwise
 *  enter in unison. The path cards' unfold, likewise — `scripts/disclosure.ts` measures the box,
 *  this file supplies only what is the landing's about it. Parallax (the global BaseLayout
 *  `[data-parallax]` controller,
 *  the fixed cross-browser one), chrome tint (the StickyHeader island owns it via React state),
 *  and the footer wordmark cursor reactivity (the SiteFooter island). All re-bind on
 *  `astro:page-load` so ClientRouter navigations stay live; bindings target only `.voct-landing`.
 * @architecture Astro islands 2026
 * @module scripts/landing
 */

import { horaForWarsaw, msToNextHora } from "../islands/landing/lib/horaeCanonicae";
import { DISCLOSURE_CLOSE_MS, setupDisclosure } from "./disclosure";
import { setupReveal } from "./reveal";

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

// ── Path cards: the shared disclosure, exclusive, and the phone's follow-scroll ──────────────
// The unfold itself is the site's (scripts/disclosure.ts). What is the landing's is that these
// entries read as ALTERNATIVES — opening one closes the rest — and that on a phone the summary
// has to be brought back under the thumb afterwards, since a card that opens below the fold opens
// out of sight.
function setupSmoothDetails(root: HTMLElement): void {
  cleanups.push(
    setupDisclosure(root, {
      selector: ".path-card-detail",
      bodyClass: "path-card-detail-body",
      exclusive: true,
      onOpen: (summary, displaced) => {
        if (!window.matchMedia("(max-width: 980px)").matches) return;
        // Wait out the card that was displaced: scrolling to a summary whose neighbour is still
        // collapsing aims at a position the page is about to leave.
        const delay = displaced > 0 ? DISCLOSURE_CLOSE_MS + 60 : 0;
        window.setTimeout(() => {
          const rect = summary.getBoundingClientRect();
          const targetY = window.scrollY + rect.top - window.innerHeight * 0.22;
          window.scrollTo({ top: targetY, behavior: reduceMotion() ? "auto" : "smooth" });
        }, delay);
      },
    }),
  );
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
// JS owns exactly two bits per line-group: `.is-lit` when its top crosses ~74% of the viewport
// (the reading zone), and `.is-spent` when the sweep is over. Everything visual — the left→right
// light edge crossing the group (--ink-reveal mask transition) — lives in 03-manifest-rite.css,
// so the draw is TIME-based and always completes: a fast scroll at worst catches it mid-flight,
// never strands it. Scrubbing it against scroll is not an option and once was one: the tempo
// followed scroll velocity, and the "settled floor" that approach needs left every read stanza
// regressed to gray — the manifest un-revealing what it had revealed. One-shot light, permanent
// ink.
//
// CANON ENTRIES. Stanza I is one line tall, so a single scroll gesture often carries two
// line-groups past the trigger, and sweeps running in unison read as a copy-pasted effect rather
// than as choreography. The onset queue makes the voices enter in imitation instead: each lit
// start comes ≥GAP_MS after the previous one's START, so the earlier sweep is still crossing its
// line when the next voice enters. A group that arrives later than the gap on its own lights
// immediately — at an unhurried reading pace (~400px/s) that is every one of them, because the
// natural spacing between these four triggers is only 0.4–0.8s. The queue is for the flick, not
// for the reader. The answer replies a shorter breath behind III (ANSWER_GAP_MS): enough that
// "Odsłania." reads as a response and not as a fourth voice in unison.
//
// THE CAP IS THE LOAD-BEARING PART, and it is a SCROLL DISTANCE rather than a comfort margin.
// `lastOnset` accumulates across the whole section, so uncapped the four onsets land at fixed
// multiples of the gap however fast the page is actually moving. With a 1.6s gap that put the
// answer 2.4s behind its own trigger at desktop reading pace — a third of a screen above the
// window — and more than three screens above a visitor flicking through on a phone, so the
// page's one negation ("Sacrum nie zdobi.") was left standing unanswered on screen. The value
// matches the shared controller's (scripts/reveal.ts) because the argument is the same one: two
// onsets deep is enough to break unison, which is all a queue is for.
//
// ORDER. A hit lights every unlit group ABOVE it as well. Document order holds only within a
// single observer callback, so a visitor who loads the page below the manifest and scrolls back
// up reaches the answer first — and the reply would arrive before the theses it answers.
function setupManifestLight(root: HTMLElement, reduce: boolean): void {
  // Under reduced motion DocumentGates never adds html.voct-motion, so the CSS half-light
  // states stay inert and the manifest is plain full ink — nothing to drive here.
  if (reduce) return;
  const manifest = root.querySelector<HTMLElement>(".manifest");
  if (!manifest) return;
  const lines = Array.from(manifest.querySelectorAll<HTMLElement>(".manifest-line"));
  if (!lines.length) return;

  const GAP_MS = 480;
  const ANSWER_GAP_MS = 380;
  const MAX_BACKLOG_MS = 450;
  /** `--sweep-in` (03-manifest-rite.css) plus a margin: the guarantee behind `transitionend`
   *  for a group whose sweep is cancelled or whose browser never reports the custom property.
   *  It only ever drops a mask that is already fully opaque, so firing late costs nothing and
   *  firing early is what must not happen — keep it clear of the sweep's clock. */
  const SPEND_FALLBACK_MS = 2600;

  let lastOnset = Number.NEGATIVE_INFINITY;
  const timers: number[] = [];
  const scheduled = new Set<HTMLElement>();

  const spend = (line: HTMLElement): void => {
    const onEnd = (event: TransitionEvent): void => {
      if (event.target !== line || event.propertyName !== "--ink-reveal") return;
      line.classList.add("is-spent");
      line.removeEventListener("transitionend", onEnd);
    };
    line.addEventListener("transitionend", onEnd);
    timers.push(
      window.setTimeout(() => {
        line.classList.add("is-spent");
        line.removeEventListener("transitionend", onEnd);
      }, SPEND_FALLBACK_MS),
    );
  };

  const light = (line: HTMLElement): void => {
    line.classList.add("is-lit");
    spend(line);
  };

  const schedule = (line: HTMLElement): void => {
    if (scheduled.has(line)) return;
    scheduled.add(line);
    io.unobserve(line);
    const gap = line.classList.contains("manifest-answer") ? ANSWER_GAP_MS : GAP_MS;
    const now = performance.now();
    const onset = Math.min(Math.max(now, lastOnset + gap), now + MAX_BACKLOG_MS);
    lastOnset = onset;
    if (onset <= now) light(line);
    else timers.push(window.setTimeout(() => light(line), onset - now));
  };

  const io = new IntersectionObserver(
    (entries) => {
      const hit = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement)
        .sort((a, b) => lines.indexOf(a) - lines.indexOf(b));
      for (const line of hit) {
        // Everything above enters first, whichever end the visitor arrived from.
        for (let i = 0; i <= lines.indexOf(line); i += 1) {
          const above = lines[i];
          if (above) schedule(above);
        }
      }
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

// ── Lumen: which of the footer's two grounds the page ends on ───────────────────────────────
//
// The footer prints the hora canonica it is being read in, and since this pass it is PRINTED ON
// THAT HOUR'S GROUND too — parchment through the day, a night plate at Completorium and
// Matutinum. Two full palettes on one axis (`--nox`, styles/landing/06-footer.css); this writes
// the single attribute that picks between them, and nothing else.
//
// IT IS NOT IN THE FOOTER ISLAND, and that is the whole reason it is here. `<SiteFooter
// client:visible />` hydrates when the footer ENTERS THE VIEWPORT, so a tone applied on mount
// would land in front of the reader every time — the plate would arrive parchment and turn under
// their eyes. The page's palette is not island state; it belongs to the document, and it has to
// be settled long before anyone reaches the foot of a 15,000px page.
//
// It writes `<body>` rather than `<html>`: `--edge-foot` (the colour iOS Safari samples for the
// band under the home indicator) is read off the body by BaseLayout, and Astro's swap replaces
// the body wholesale — so the attribute leaves with the page instead of having to be stripped,
// which is exactly the trap `<html>` gates fall into (docs/web-landing-guardrails.md).
//
// The clock's own SSOT is `horaeCanonicae.ts`; this is a reader of that table, never a second
// copy of the hours.
let lumenTimer: number | undefined;

function applyLumen(): void {
  window.clearTimeout(lumenTimer);
  // Followed a navigation off the landing: the module stays loaded in an SPA, and a timer that
  // kept stamping a subpage's body would be writing an attribute nothing reads. Coming back
  // re-arms from astro:after-swap.
  if (!document.querySelector(".voct-landing")) return;
  const now = new Date();
  document.body.dataset.lumen = horaForWarsaw(now).lumen;
  lumenTimer = window.setTimeout(applyLumen, msToNextHora(now));
}

function bind(): void {
  const root = document.querySelector<HTMLElement>(".voct-landing");
  if (!root) return;
  const reduce = reduceMotion();
  cleanups.push(setupReveal(root, { reduce, cadence: "queue" }));
  setupRiteGlow(root, reduce);
  setupSmoothDetails(root);
  setupLenisAnchors();
  setupHeroBreath(root, reduce);
  setupManifestLight(root, reduce);
  setupInterludeBreath(root, reduce);
  setupInteractions(root);
}

// The palette is part of the page's first painted state, not a correction to it — the same
// contract the parallax controller keeps, and for the same reason: `astro:page-load` is the
// window `load` event on a cold start and fires POST-SNAPSHOT on a navigation, so a page arriving
// through the turned leaf would be captured on the wrong ground and settle onto the right one
// mid-dissolve. Module time covers the cold start, `astro:after-swap` covers every navigation.
applyLumen();
document.addEventListener("astro:after-swap", applyLumen);

document.addEventListener("astro:page-load", () => {
  teardown();
  bind();
});
document.addEventListener("astro:before-swap", teardown);
