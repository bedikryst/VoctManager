/**
 * @file useSiteCursor.ts
 * @description Custom site cursor with lerp easing + magnetic snap + click feedback.
 *
 *  Refinements layered onto the original lerp follower:
 *   • Magnetic snap (15% weight) — over interactive elements the target nudges toward the
 *     element's centre, so the cursor settles ON the link/button instead of next to it.
 *     Subtle enough not to feel "draggy" — just polished. Precision surfaces whose centre
 *     is far from the pointer (full-width scrubbers, full-viewport backdrops) opt out via
 *     `data-cursor="no-snap"` on the element or an ancestor; the states that own their own
 *     glyph (seek, video, frame) opt out by construction, since the snap is applied only in
 *     the branches beneath them.
 *   • Click feedback (`.is-down`) — `mousedown` adds the class, `mouseup` clears it; CSS
 *     contracts the ring + expands the inner dot for tactile pressure.
 *   • Reduced-motion + coarse-pointer + no-hover → opt out entirely (no body class, no DOM).
 *
 *  CSS hides the native cursor only when `has-custom-cursor` is set, and only inside the
 *  `(pointer: fine) and (hover: hover)` media query, so touch users keep their OS cursor.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useSiteCursor
 */

import { useEffect } from "react";

import { formatTime } from "../video/formatTime";

const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, summary, [role="button"], [role="link"]';

// Magnetic snap pulls the cursor 15% toward the element centre — strong enough to read
// as "settled on" the link, gentle enough that fast cross-screen sweeps don't feel sticky.
const MAGNETIC_WEIGHT = 0.15;

// Autoscroll (middle-click) tuning.
//   DEADZONE — cursor must travel this far from the anchor before any scroll fires.
//   Stops jitter when the user holds still.
//   RAMP     — distance past DEADZONE at which speed reaches MAX. Beyond, speed clamps.
//   MAX      — pixels per RAF frame at full ramp (~40 * 60fps ≈ 2400 px/s).
const AUTOSCROLL_DEADZONE = 12;
const AUTOSCROLL_RAMP = 60;
const AUTOSCROLL_MAX = 40;

// The loupe over a `[data-image-open]` photograph (styles/cursor.css, `.is-frame.has-lens`).
//   SIZE  — the lens's diameter, and the same 60 the stylesheet draws. The sampled point has to
//           land at the lens's own centre, so these are one number kept in two files.
//   Z     — magnification against the rendition the PAGE is showing. A trigger publishes the
//           frame's renditions (up to 1920) where its panel is served 560 or 1200, so at this
//           factor the lens is still reading real pixels rather than stretching the panel's.
//   PRESS — where Z travels while the button is held. The lens pushing INTO the picture is the
//           press cue, in place of a box that changes size and takes the sampled centre with it.
//   LERP  — how fast it travels. Slower than the follower's 0.24 on purpose: magnification that
//           snaps reads as a glitch, magnification that eases reads as glass.
const LENS_SIZE = 60;
const LENS_Z = 2.2;
const LENS_Z_PRESS = 2.9;
const LENS_Z_LERP = 0.16;

/**
 * Lens renditions, keyed by the trigger's `data-image-src`. The value is the candidate the
 * browser CHOSE, not the attribute: the loader hands it the trigger's own `sizes` + `srcset`
 * unchanged so it resolves to the same file `scripts/image-triggers.ts` warms on the same hover.
 * Requesting `src` directly would pull the 1920 into a window that had already fetched the 1200
 * — a second copy of a photograph already on its way.
 *
 * Module scope rather than effect scope because a decoded photograph outlives a hover, and the
 * hook mounts once per document. Nothing is evicted: one short string per photograph the pointer
 * has actually rested on.
 */
const lensSources = new Map<string, string>();
/** Requests in flight, so a pointer resting on a panel asks once instead of once per frame. */
const lensRequested = new Set<string>();

/** The rendition to sample, or `null` while it is still arriving — the ring keeps its drawn
 *  plate until then, and the frame after the decode lands is the one that lights the glass. */
const lensSourceFor = (trigger: HTMLElement): string | null => {
  const key = trigger.dataset.imageSrc;
  if (!key) return null;
  const ready = lensSources.get(key);
  if (ready) return ready;
  if (lensRequested.has(key)) return null;
  lensRequested.add(key);
  const img = new Image();
  img.decoding = "async";
  // `sizes` before `srcset` before `src`: the candidate is chosen the moment the source set is,
  // and an unset `sizes` at that moment is chosen against a 100vw default.
  if (trigger.dataset.imageSizes) img.sizes = trigger.dataset.imageSizes;
  if (trigger.dataset.imageSrcset) img.srcset = trigger.dataset.imageSrcset;
  img.src = key;
  const settle = (): void => {
    lensSources.set(key, img.currentSrc || key);
  };
  if (img.complete && img.naturalWidth > 0) settle();
  else img.addEventListener("load", settle, { once: true });
  return null;
};

export function useSiteCursor(cursorRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine) and (hover: hover)").matches) return;
    // Honour the platform-level reduced-motion preference — a lerp-following cursor is
    // motion, even subtle. Users who opted out should see the native pointer untouched.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.body.classList.add("has-custom-cursor");

    // SiteCursor is persisted across ClientRouter swaps (transition:persist) so its useEffect
    // runs only once — BUT Astro replaces body.className entirely with the new page's
    // bodyClass on swap, wiping our `has-custom-cursor` class. Without this listener the
    // native pointer flashes back on the very first navigation. Re-apply on every swap.
    const onAfterSwap = () => document.body.classList.add("has-custom-cursor");
    document.addEventListener("astro:after-swap", onAfterSwap);

    let targetX = -120;
    let targetY = -120;
    let currentX = -120;
    let currentY = -120;
    let raf: number | null = null;

    // Tracked video the cursor is currently over — kept here so play/pause events can flip
    // the .is-playing class without waiting for the next mousemove (otherwise a user who
    // hovers a video then clicks play without moving the mouse would see the play glyph
    // stick around even though the video is now running).
    let currentVideo: HTMLVideoElement | null = null;

    // Loupe state: the rendition being sampled and the photograph's box in viewport coordinates,
    // both captured on move. The painting itself happens per frame in render(), because it has
    // to follow the position the cursor is DRAWN at rather than the pointer's.
    let lensUrl: string | null = null;
    let lensRect: DOMRect | null = null;
    let lensZ = LENS_Z;

    const clearLens = (): void => {
      if (!lensUrl) return;
      lensUrl = null;
      lensRect = null;
      lensZ = LENS_Z;
      el.classList.remove("has-lens");
      el.style.removeProperty("--lens");
      el.style.removeProperty("--lens-w");
      el.style.removeProperty("--lens-h");
      el.style.removeProperty("--lens-x");
      el.style.removeProperty("--lens-y");
    };

    /**
     * Put the point the lens is standing on at the lens's centre.
     *
     * Sampled at (currentX, currentY) — where the ring is DRAWN — and not at the pointer, because
     * the follower trails the mouse by render()'s lerp: a lens magnifying where the mouse IS
     * would show something other than what it is sitting on, which is the one mistake this figure
     * cannot survive.
     *
     * Clamped to the photograph's own edges, as a loupe reaching the margin of a print stops
     * panning rather than sliding off onto the table. A photograph narrower than the lens has no
     * room to pan at all and is centred instead — neither gallery packs one that small, but any
     * trigger can reach this state.
     */
    const paintLens = (): void => {
      const rect = lensRect;
      if (!rect) return;
      const wanted = el.classList.contains("is-down") ? LENS_Z_PRESS : LENS_Z;
      lensZ += (wanted - lensZ) * LENS_Z_LERP;
      const w = rect.width * lensZ;
      const h = rect.height * lensZ;
      const half = LENS_SIZE / 2;
      const x =
        w > LENS_SIZE
          ? Math.min(0, Math.max(LENS_SIZE - w, half - (currentX - rect.left) * lensZ))
          : (LENS_SIZE - w) / 2;
      const y =
        h > LENS_SIZE
          ? Math.min(0, Math.max(LENS_SIZE - h, half - (currentY - rect.top) * lensZ))
          : (LENS_SIZE - h) / 2;
      el.style.setProperty("--lens-w", `${w}px`);
      el.style.setProperty("--lens-h", `${h}px`);
      el.style.setProperty("--lens-x", `${x}px`);
      el.style.setProperty("--lens-y", `${y}px`);
    };

    // Autoscroll state — engaged on middle-click outside interactive elements. Replaces the
    // OS-level autoscroll widget (the 4-arrow icon) with our cursor's .is-autoscroll glyph,
    // pinning the cursor to the anchor and scrolling at a speed proportional to mouse
    // distance from the anchor. preventDefault on the originating mousedown suppresses the
    // browser's native autoscroll — but only when the click is on inert content (not links,
    // since middle-click on a link is the sacred open-in-new-tab shortcut).
    let autoscrollActive = false;
    let autoscrollAnchorX = 0;
    let autoscrollAnchorY = 0;
    let autoscrollMouseX = 0;
    let autoscrollMouseY = 0;
    let autoscrollRaf: number | null = null;
    interface LenisLike {
      stop?: () => void;
      start?: () => void;
    }
    const getLenis = (): LenisLike | undefined =>
      (window as unknown as { __lenis?: LenisLike }).__lenis;

    const stopAutoscroll = (): void => {
      if (!autoscrollActive) return;
      autoscrollActive = false;
      el.classList.remove("is-autoscroll");
      el.style.removeProperty("--ascroll-up");
      el.style.removeProperty("--ascroll-down");
      if (autoscrollRaf !== null) {
        window.cancelAnimationFrame(autoscrollRaf);
        autoscrollRaf = null;
      }
      getLenis()?.start?.();
    };

    const autoscrollTick = (): void => {
      if (!autoscrollActive) {
        autoscrollRaf = null;
        return;
      }
      const dy = autoscrollMouseY - autoscrollAnchorY;
      const ady = Math.abs(dy);
      // Normalised 0→1 intensity past the deadzone. Drives both the scroll speed and the
      // visible gold trail length — so what the user sees == what they feel.
      const t = ady > AUTOSCROLL_DEADZONE
        ? Math.min((ady - AUTOSCROLL_DEADZONE) / AUTOSCROLL_RAMP, 1)
        : 0;
      if (t > 0) {
        const speed = t * AUTOSCROLL_MAX * Math.sign(dy);
        window.scrollBy({ top: speed, behavior: "instant" as ScrollBehavior });
      }
      // Live-paint the gauge: one trail goes up when scrolling up (negative dy), the other
      // goes down. CSS reads these vars and stretches the gold strokes from the centre dot.
      el.style.setProperty("--ascroll-up", dy < 0 ? String(t) : "0");
      el.style.setProperty("--ascroll-down", dy > 0 ? String(t) : "0");
      autoscrollRaf = window.requestAnimationFrame(autoscrollTick);
    };

    const startAutoscroll = (event: MouseEvent): void => {
      // Spare the sacred middle-click-on-link → open-in-new-tab shortcut. We engage
      // autoscroll only over inert content where the OS widget would have fired anyway.
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('a, button, video, [role="button"], [role="link"]')
      ) {
        return;
      }
      event.preventDefault();
      autoscrollActive = true;
      autoscrollAnchorX = event.clientX;
      autoscrollAnchorY = event.clientY;
      autoscrollMouseX = event.clientX;
      autoscrollMouseY = event.clientY;
      // Pin the visual cursor to the anchor and snap-skip lerp so it lands instantly.
      targetX = autoscrollAnchorX;
      targetY = autoscrollAnchorY;
      currentX = autoscrollAnchorX;
      currentY = autoscrollAnchorY;
      el.classList.add("is-autoscroll");
      el.classList.remove(
        "is-pointer",
        "is-video",
        "is-download",
        "is-playing",
        "is-seek",
        "is-frame",
        "is-frame-prev",
        "is-frame-next",
      );
      clearLens();
      // Pause Lenis so its lerp loop doesn't fight our discrete scrollBy ticks.
      getLenis()?.stop?.();
      if (autoscrollRaf === null) autoscrollRaf = window.requestAnimationFrame(autoscrollTick);
    };
    const syncPlayingClass = (): void => {
      if (currentVideo) el.classList.toggle("is-playing", !currentVideo.paused);
      else el.classList.remove("is-playing");
    };
    const attachVideoListeners = (v: HTMLVideoElement): void => {
      v.addEventListener("play", syncPlayingClass);
      v.addEventListener("pause", syncPlayingClass);
      v.addEventListener("ended", syncPlayingClass);
    };
    const detachVideoListeners = (v: HTMLVideoElement): void => {
      v.removeEventListener("play", syncPlayingClass);
      v.removeEventListener("pause", syncPlayingClass);
      v.removeEventListener("ended", syncPlayingClass);
    };

    const render = () => {
      currentX += (targetX - currentX) * 0.24;
      currentY += (targetY - currentY) * 0.24;
      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      if (lensUrl) paintLens();
      raf = window.requestAnimationFrame(render);
    };

    const move = (event: MouseEvent) => {
      // During autoscroll: cursor is pinned at anchor; we only track mouse for the scroll
      // tick to read distance from anchor. Skip the hover/state detection — the cursor's
      // state is locked to .is-autoscroll and the visual stays put.
      if (autoscrollActive) {
        autoscrollMouseX = event.clientX;
        autoscrollMouseY = event.clientY;
        targetX = autoscrollAnchorX;
        targetY = autoscrollAnchorY;
        return;
      }

      const target = event.target;
      // Detection priority: seek → video → frame → download → standard interactive. These are
      // mutually exclusive states with distinct cursor visuals:
      //   .is-seek    — caret + timestamp (the cursor IS the scrub tooltip)
      //   .is-video   — ring + ▶/⏸ glyph (paused/playing reflects video.paused)
      //   .is-frame   — loupe over a photograph that opens (`[data-image-open]`)
      //   .is-frame-prev / .is-frame-next — the arrow the half of an open frame will perform
      //   .is-download — ring + ↓ arrow (line + triangle stacked vertically)
      //   .is-pointer — ring + small dot (standard link/button)

      // Seek surface (`data-cursor="seek"`, the player's scrub rail): precision beats
      // everything — no snap, no ring. The player publishes the media duration on the
      // element (data-duration); the hovered X maps to a timestamp mirrored into
      // data-time, which CSS renders above the caret (empty until metadata arrives).
      // Pointer capture during a drag keeps retargeting mousemove here, so the
      // timestamp stays live even when the pointer strays off the rail mid-scrub.
      const seekEl =
        target instanceof Element ? target.closest<HTMLElement>('[data-cursor="seek"]') : null;
      const onSeek = Boolean(seekEl);
      if (seekEl) {
        const rect = seekEl.getBoundingClientRect();
        const duration = Number(seekEl.dataset.duration);
        el.setAttribute(
          "data-time",
          Number.isFinite(duration) && duration > 0 && rect.width > 0
            ? formatTime(
                Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * duration,
              )
            : "",
        );
      }

      const videoEl =
        !onSeek && target instanceof Element ? target.closest<HTMLVideoElement>("video") : null;
      const onVideo = Boolean(videoEl);

      // Photograph surfaces. A `[data-image-open]` trigger is a <button> wrapped around a whole
      // photograph, so the generic branch below would give it the link ring AND the magnetic
      // snap — and a panel 370 × 462 pulls the cursor a long way toward its own centre, which
      // over a picture reads as the pointer being taken away from what it is pointing at. Its
      // own state removes both: the glyph is a loupe holding the photograph magnified
      // (styles/cursor.css), and being here rather than in the interactive branch is what leaves
      // `snapEl` null — which the lens needs harder than the ring ever did, since a drifting
      // target would show the reader a patch of picture their hand is not on. A surface that
      // wraps a photograph in an ordinary LINK gets neither for free and has to opt out of the
      // snap by hand (the landing's Imagines plate).
      //
      // Inside an open frame the two halves declare which way they turn it, and the cursor
      // becomes that arrow — the affordance those halves deliberately do not draw.
      const frameEl =
        !onSeek && !onVideo && target instanceof Element
          ? target.closest<HTMLElement>(
              '[data-image-open], [data-cursor="frame-prev"], [data-cursor="frame-next"]',
            )
          : null;
      const onFrame = Boolean(frameEl);
      const frameStep = frameEl?.dataset.cursor;

      // Download surface: `<a download>` (semantic) OR any element with `data-cursor="download"`
      // (opt-in for non-anchor download tiles or unconventional triggers).
      const downloadEl =
        !onSeek && !onVideo && !onFrame && target instanceof Element
          ? target.closest<HTMLElement>('a[download], [data-cursor="download"]')
          : null;
      const onDownload = Boolean(downloadEl);

      const interactiveEl =
        !onSeek && !onVideo && !onFrame && !onDownload && target instanceof Element
          ? target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
          : null;
      const interactive = Boolean(interactiveEl);

      // Magnetic snap — applied to .is-pointer AND .is-download (both are intentional
      // landings); skipped on seek/video/frame (mouse needs precision over the scrubber, the
      // controls, and the picture) and on no-snap surfaces, where a pull toward a distant
      // centre becomes a yank (over a scrubber the visible cursor must equal the click point).
      const snapEl = interactive ? interactiveEl : onDownload ? downloadEl : null;
      if (snapEl && !snapEl.closest('[data-cursor="no-snap"]')) {
        const rect = snapEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        targetX = event.clientX + (cx - event.clientX) * MAGNETIC_WEIGHT;
        targetY = event.clientY + (cy - event.clientY) * MAGNETIC_WEIGHT;
      } else {
        targetX = event.clientX;
        targetY = event.clientY;
      }

      // Sync video tracking + play/pause listeners. Detach when leaving a video; attach
      // when entering a new one. syncPlayingClass keeps .is-playing in step with state.
      if (videoEl !== currentVideo) {
        if (currentVideo) detachVideoListeners(currentVideo);
        currentVideo = videoEl;
        if (currentVideo) attachVideoListeners(currentVideo);
      }

      el.classList.toggle("is-seek", onSeek);
      el.classList.toggle("is-pointer", interactive);
      el.classList.toggle("is-video", onVideo);
      el.classList.toggle("is-frame", onFrame && !frameStep);
      el.classList.toggle("is-frame-prev", frameStep === "frame-prev");
      el.classList.toggle("is-frame-next", frameStep === "frame-next");
      el.classList.toggle("is-download", onDownload);

      // The loupe measures the IMAGE's box, not the trigger's. The two coincide on both galleries
      // (`width: 100%; height: auto` — the panel IS the photograph, uncropped), and the
      // distinction is what keeps the state honest where they would not: a trigger that is a NAME
      // rather than a picture has no `<img>` to measure and keeps the ring's drawn plate, which
      // is the colophon's row of photographers.
      const lensImg =
        onFrame && !frameStep && frameEl ? frameEl.querySelector<HTMLImageElement>("img") : null;
      const nextLens = frameEl && lensImg ? lensSourceFor(frameEl) : null;
      if (lensImg && nextLens) {
        lensRect = lensImg.getBoundingClientRect();
        if (nextLens !== lensUrl) {
          lensUrl = nextLens;
          el.style.setProperty("--lens", `url("${nextLens}")`);
          el.classList.add("has-lens");
        }
        paintLens();
      } else {
        clearLens();
      }

      syncPlayingClass();
      if (raf === null) render();
    };

    const leave = () => {
      el.style.opacity = "0";
    };
    const enter = () => {
      el.style.opacity = "";
    };
    // Click feedback — adds `.is-down` for the duration of the press. CSS contracts the
    // ring and expands the inner dot, reading as a tactile press without firing animation.
    const down = (event: MouseEvent): void => {
      if (event.button === 1) {
        // Middle button: enter or exit autoscroll. If already engaged, any middle-click
        // exits (matches the native widget's behavior).
        if (autoscrollActive) {
          event.preventDefault();
          stopAutoscroll();
        } else {
          startAutoscroll(event);
        }
        return;
      }
      // Any non-middle click while autoscroll is engaged exits the mode (and does NOT
      // perform the underlying action — matches native autoscroll).
      if (autoscrollActive) {
        event.preventDefault();
        stopAutoscroll();
        return;
      }
      el.classList.add("is-down");
    };
    const up = (): void => {
      el.classList.remove("is-down");
    };
    const onKey = (event: KeyboardEvent): void => {
      if (autoscrollActive && event.key === "Escape") {
        event.preventDefault();
        stopAutoscroll();
      }
    };

    const onBlur = (): void => {
      el.classList.remove("is-down");
      stopAutoscroll();
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseleave", leave);
    window.addEventListener("mouseenter", enter);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", leave);
      window.removeEventListener("mouseenter", enter);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("astro:after-swap", onAfterSwap);
      if (currentVideo) detachVideoListeners(currentVideo);
      if (autoscrollRaf !== null) window.cancelAnimationFrame(autoscrollRaf);
      if (raf !== null) window.cancelAnimationFrame(raf);
      document.body.classList.remove("has-custom-cursor");
    };
  }, [cursorRef]);
}
