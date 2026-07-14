/**
 * @file landing.ts
 * @description Cross-browser motion controller for the landing (`/`). Re-implements the
 *  scroll-driven behaviours the SPA expressed as React hooks AND the kinetic typography the
 *  CSS expressed via `animation-timeline` / `view-timeline` — neither of which runs in the
 *  target browser (native scroll-driven CSS is unsupported here; that was the parallax bug).
 *
 *  Owns: reveal (`.is-visible`/`.is-settled`, mirroring useReveals), rite-glow (cursor
 *  spotlight), smooth-details (animated accordion), Lenis anchor smooth-scroll, the
 *  kinetic variable-font choreography (hero breath, heading breath) on a single rAF
 *  scroll loop, and the manifest light (one-shot `.is-lit` per stanza — the sweep itself
 *  is a CSS transition). (The coda's old per-letter wave is gone — the "Ostatni takt"
 *  coda draws itself via the shared .knot-draw reveal choreography, no JS of its own.)
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

const wght = (el: HTMLElement, value: number): void => {
  el.style.fontVariationSettings = `"wght" ${Math.round(value)}`;
};

const cleanups: Array<() => void> = [];
const teardown = (): void => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) fn();
  }
};

// ── Reveal: one-shot entrance, then persists (mirrors features/landing/useReveals) ──────────
function setupReveal(root: HTMLElement, reduce: boolean): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
  if (!items.length) return;

  if (reduce) {
    items.forEach((el) => el.classList.add("is-visible", "is-settled"));
    return;
  }

  const settle = (el: HTMLElement): void => {
    const onEnd = (event: TransitionEvent): void => {
      if (event.target !== el) return;
      if (event.propertyName !== "opacity" && event.propertyName !== "transform") return;
      el.classList.add("is-settled");
      el.removeEventListener("transitionend", onEnd);
    };
    el.addEventListener("transitionend", onEnd);
    window.setTimeout(() => {
      el.classList.add("is-settled");
      el.removeEventListener("transitionend", onEnd);
    }, 2400);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        el.classList.add("is-visible");
        settle(el);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -12% 0px" },
  );

  items.forEach((el) => io.observe(el));
  cleanups.push(() => io.disconnect());
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
  document.addEventListener("click", onClick);
  cleanups.push(() => document.removeEventListener("click", onClick));
}

// ── Kinetic typography: variable-font breath scrubbed against scroll (one rAF loop) ──────────
function setupKinetic(root: HTMLElement, reduce: boolean): void {
  if (reduce) return;

  const heroTitle = root.querySelector<HTMLElement>(".hero-title");
  const heroEm = root.querySelector<HTMLElement>(".hero-title em");
  const headings = Array.from(
    root.querySelectorAll<HTMLElement>(
      ".ensemble h2, .path h2, .section-title, .final-support h2",
    ),
  );

  if (!heroTitle && !headings.length) {
    return;
  }

  let ticking = false;
  const update = (): void => {
    ticking = false;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const scrollY = window.scrollY;

    // READ phase — gather every layout measurement up front. Mixing a getBoundingClientRect()
    // read after a font-variation-settings write (below) forces a synchronous reflow on each
    // iteration; batching the reads keeps the whole frame to a single layout pass.
    const headingRects = headings.map((h) => h.getBoundingClientRect());

    // WRITE phase — only style mutations from here down.
    // Hero "breath" — scrubbed against the first 90vh of root scroll.
    if (heroTitle) {
      const p = clamp01(scrollY / (vh * 0.9));
      wght(heroTitle, breath3(p, 540, 380, 300));
      if (heroEm) wght(heroEm, breath3(p, 620, 380, 300));
    }

    // Editorial headings — heavier on entry, settling to 320 as they cross the viewport.
    headings.forEach((h, i) => {
      const rect = headingRects[i];
      if (rect.bottom < -100 || rect.top > vh + 100) return;
      const p = clamp01((vh - rect.top) / (vh * 0.75));
      wght(h, 520 - 200 * p);
    });

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
// zero added latency. The answer waits longest — "Odsłania." may only begin once "Sacrum
// nie zdobi." reads as fully inked (its glyphs sit in the sweep's fast early stretch, so
// ~3.4s into the 4.6s transition the line looks done).
function setupManifestLight(root: HTMLElement, reduce: boolean): void {
  // Under reduced motion MotionGate never adds html.voct-motion, so the CSS half-light
  // states stay inert and the manifest is plain full ink — nothing to drive here.
  if (reduce) return;
  const manifest = root.querySelector<HTMLElement>(".manifest");
  if (!manifest) return;
  const lines = Array.from(manifest.querySelectorAll<HTMLElement>(".manifest-line-group"));
  if (!lines.length) return;

  const GAP_MS = 1600;
  const ANSWER_GAP_MS = 3400;
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

// ── Silence moment: an ambient sacred beat (no scroll-lock, ever) ────────────────────────────
// Previously this halted scroll for ~2.8s as an "enforced stillness". On touch — and in desktop
// DevTools device emulation, where `pointer` can still report `fine` — that reads as a frozen or
// broken page (the visitor swipes/scrolls and nothing moves). The lock is removed entirely: the
// silence line and its ornament reveal in place as the section is reached (the existing reveal
// IntersectionObserver in setupReveal drives the `.silence-*` `.reveal` nodes), and the page
// never hijacks the visitor's scroll. The visual beat remains; the hostage moment is gone.
function setupSilenceMoment(root: HTMLElement, _reduce: boolean): void {
  const moment = root.querySelector<HTMLElement>("[data-silence]");
  if (!moment) return;
  moment.classList.add("is-listening", "is-settled");
}

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
  setupKinetic(root, reduce);
  setupManifestLight(root, reduce);
  setupInterludeBreath(root, reduce);
  setupSilenceMoment(root, reduce);
  setupInteractions(root);
}

document.addEventListener("astro:page-load", () => {
  teardown();
  bind();
});
document.addEventListener("astro:before-swap", teardown);
