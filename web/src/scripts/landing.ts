/**
 * @file landing.ts
 * @description Cross-browser motion controller for the landing (`/`). Re-implements the
 *  scroll-driven behaviours the SPA expressed as React hooks AND the kinetic typography the
 *  CSS expressed via `animation-timeline` / `view-timeline` — neither of which runs in the
 *  target browser (native scroll-driven CSS is unsupported here; that was the parallax bug).
 *
 *  Owns: reveal (`.is-visible`/`.is-settled`, mirroring useReveals), rite-glow (cursor
 *  spotlight), smooth-details (animated accordion), Lenis anchor smooth-scroll, and the
 *  kinetic variable-font choreography (hero breath, heading breath, coda per-letter wave,
 *  manifest breath) on a single rAF scroll loop.
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
const coarsePointer = (): boolean =>
  window.matchMedia("(pointer: coarse), (hover: none)").matches;

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

  // Per-letter variable-font weaving is the one genuinely expensive scroll effect: each tick
  // re-rasters six Cormorant glyphs in the Coda. On a fine pointer (desktop) that's budgeted;
  // on a coarse pointer the wave is imperceptible at phone scale yet re-rasters mid native
  // momentum-scroll — the documented stutter. So on touch we keep the cheap one-element hero
  // breath + heading settle, and drop the Coda per-letter wave (the tail fade still runs).
  const heavyKinetic = !coarsePointer();

  const heroTitle = root.querySelector<HTMLElement>(".hero-title");
  const heroEm = root.querySelector<HTMLElement>(".hero-title em");
  const headings = Array.from(
    root.querySelectorAll<HTMLElement>(
      ".ensemble h2, .path h2, .section-title, .final-support h2",
    ),
  );
  const coda = root.querySelector<HTMLElement>(".coda");
  const codaLetters = coda
    ? Array.from(coda.querySelectorAll<HTMLElement>(".coda-letter"))
    : [];
  const codaTail = coda ? coda.querySelector<HTMLElement>(".coda-tail") : null;

  if (!heroTitle && !headings.length && !codaLetters.length) {
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
    const codaRect = coda && (codaLetters.length || codaTail) ? coda.getBoundingClientRect() : null;

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

    // Coda — per-letter weight wave (360 → 560 → 360) staggered across the section's pass,
    // then the italic tail emerges. Approximates the `--coda-scroll` view-timeline ranges.
    if (codaRect) {
      const pCoda = clamp01((vh - codaRect.top) / (vh + codaRect.height));
      if (heavyKinetic) {
        codaLetters.forEach((letter, i) => {
          const start = 0.05 + i * 0.06;
          const end = start + 0.42;
          const local = clamp01((pCoda - start) / (end - start));
          wght(letter, 360 + 200 * Math.sin(local * Math.PI));
        });
      }
      if (codaTail) {
        const t = clamp01((pCoda - 0.4) / 0.3);
        codaTail.style.opacity = String(t);
        codaTail.style.transform = `translateY(${(1 - t) * 18}px)`;
      }
    }
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

// ── Manifest "raking light" ─────────────────────────────────────────────────────────────────
// The Nawa metaphor made literal: one slow shaft of warm light holds at ~45% of the viewport;
// as you scroll, each manifest line passes through it, lifts out of half-light to full ink
// (with a faint gold bloom at the peak), and stays gently lit once the light has passed —
// "sacrum nie zdobi, odsłania". LIGHT ONLY: colour and text-shadow, never the weight axis —
// animating wght changes glyph advance widths and reflows the whole line (the "jumping text"
// defect). The answer group ("Odsłania.") is entirely class-driven: its entrance + one-shot
// bloom live in CSS, keyed to `.is-lit`/`.is-settled` set here.
function setupManifestRake(root: HTMLElement, reduce: boolean): void {
  if (reduce) return;
  const manifest = root.querySelector<HTMLElement>(".manifest");
  if (!manifest) return;
  const lines = Array.from(manifest.querySelectorAll<HTMLElement>(".manifest-line-group"));
  if (!lines.length) return;

  // Split each statement into word-spans once so the active line can stagger words in
  // under the raking light (opacity + lift per word — no blur, no weight axis).
  // Preserves whitespace between words. The answer group has no .manifest-text-inner,
  // so it is naturally skipped here.
  lines.forEach((line) => {
    const text = line.querySelector<HTMLElement>(".manifest-text-inner");
    if (!text || text.dataset.split === "1") return;
    const original = text.textContent ?? "";
    text.innerHTML = original
      .split(/(\s+)/)
      .map((part, j) =>
        /\s/.test(part) || !part
          ? part
          : `<span class="manifest-word" style="--word-i:${j}">${part}</span>`,
      )
      .join("");
    text.dataset.split = "1";
  });

  const LIT_COLOR = [22, 21, 20]; // var(--ink)
  const DIM_COLOR = [138, 131, 118]; // readable half-light (old 200,195,185 was ghost-gray)
  const SETTLED = 0.32;
  const passed = new Array<boolean>(lines.length).fill(false);

  // Touch: the cursorless rake read as a defect — stop a swipe mid-section and the
  // unlit stanzas sat in flat gray with the emphasis half-blurred, looking like text
  // that failed to load. On coarse pointers the rake degrades to a binary reveal:
  // a line lights fully (class-driven, CSS transitions) once its top crosses 85% of
  // the viewport and stays lit. No per-frame color/wght/textShadow writes at all.
  const coarse = coarsePointer();

  let ticking = false;
  let active = false;
  const update = (): void => {
    ticking = false;
    if (!active) return;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const beamY = vh * 0.45;
    const reach = vh * 0.3;
    // READ phase: measure every line before writing colour / wght / textShadow below, so one
    // line's style writes don't force a reflow on the next line's rect read.
    const rects = lines.map((line) => line.getBoundingClientRect());
    lines.forEach((line, i) => {
      const r = rects[i];
      if (coarse) {
        if (!passed[i] && r.top < vh * 0.85) {
          passed[i] = true;
          line.classList.add("is-lit", "is-settled");
        }
        return;
      }
      const cy = r.top + r.height / 2;
      const d = Math.abs(cy - beamY);
      let lit = d < reach ? 1 - d / reach : 0;
      if (cy <= beamY) passed[i] = true;
      if (passed[i]) lit = Math.max(lit, SETTLED);

      // `is-lit` arms the per-word stagger; `is-settled` keeps words present after the beam
      // has passed. The answer's lit threshold is higher: it resolves only when the beam
      // actually rests on it — a beat after stanza III, never alongside it.
      const isAnswer = line.classList.contains("manifest-answer");
      line.classList.toggle("is-lit", lit > (isAnswer ? 0.55 : 0.34));
      line.classList.toggle("is-settled", passed[i]);
      if (isAnswer) return; // entrance + bloom are class-driven in CSS — no inline writes

      const statement = line.querySelector<HTMLElement>(".manifest-statement");
      if (statement) {
        const c = LIT_COLOR.map((v, k) => Math.round(DIM_COLOR[k] + (v - DIM_COLOR[k]) * lit));
        statement.style.color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        const bloom = lit > 0.62 ? (lit - 0.62) / 0.38 : 0;
        statement.style.textShadow =
          bloom > 0
            ? `0 0 ${(bloom * 30).toFixed(0)}px rgba(198, 164, 91, ${(bloom * 0.55).toFixed(2)})`
            : "none";
      }

      const roman = line.querySelector<HTMLElement>(".manifest-roman");
      if (roman) {
        roman.style.opacity = (0.22 + lit * 0.55).toFixed(3);
      }
    });
  };

  const schedule = (): void => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };
  const onScroll = (): void => {
    if (!active) return;
    schedule();
  };
  // Only spend frames on the raking light while the manifest is in (or near) view; off-screen
  // the scroll handler early-returns and the lines hold their last settled state.
  const io = new IntersectionObserver(
    (entries) => {
      active = entries[0]?.isIntersecting ?? false;
      if (active) schedule();
    },
    { rootMargin: "25% 0px 25% 0px" },
  );
  io.observe(manifest);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  cleanups.push(() => {
    io.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
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

// ── Interactions: IBAN copy buttons + vault-open dispatch from static sections ──────────────
// Vault lives in its own React island (Faza 3c); static "Wesprzyj" triggers reach it over the
// `voct:open-vault` event. Until that island exists the dispatch is a graceful no-op.
function setupInteractions(root: HTMLElement): void {
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
  setupManifestRake(root, reduce);
  setupInterludeBreath(root, reduce);
  setupSilenceMoment(root, reduce);
  setupInteractions(root);
}

document.addEventListener("astro:page-load", () => {
  teardown();
  bind();
});
document.addEventListener("astro:before-swap", teardown);
