/**
 * @file useSiteCursor.ts
 * @description Custom site cursor with lerp easing + magnetic snap + click feedback.
 *
 *  Awwwards-grade refinements layered onto the original lerp follower:
 *   • Magnetic snap (15% weight) — over interactive elements the target nudges toward the
 *     element's centre, so the cursor settles ON the link/button instead of next to it.
 *     Subtle enough not to feel "draggy" — just polished.
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
      el.classList.remove("is-pointer", "is-video", "is-download", "is-playing");
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
      // Detection priority: video → download → standard interactive. The first three are
      // mutually exclusive states with distinct cursor visuals:
      //   .is-video   — ring + ▶/⏸ glyph (paused/playing reflects video.paused)
      //   .is-download — ring + ↓ arrow (line + triangle stacked vertically)
      //   .is-pointer — ring + small dot (standard link/button)
      const videoEl =
        target instanceof Element ? target.closest<HTMLVideoElement>("video") : null;
      const onVideo = Boolean(videoEl);

      // Download surface: `<a download>` (semantic) OR any element with `data-cursor="download"`
      // (opt-in for non-anchor download tiles or unconventional triggers).
      const downloadEl =
        !onVideo && target instanceof Element
          ? target.closest<HTMLElement>('a[download], [data-cursor="download"]')
          : null;
      const onDownload = Boolean(downloadEl);

      const interactiveEl =
        !onVideo && !onDownload && target instanceof Element
          ? target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
          : null;
      const interactive = Boolean(interactiveEl);

      // Magnetic snap — applied to .is-pointer AND .is-download (both are intentional
      // landings); skipped on video (mouse needs precision over the scrubber/controls).
      const snapEl = interactive ? interactiveEl : onDownload ? downloadEl : null;
      if (snapEl) {
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

      el.classList.toggle("is-pointer", interactive);
      el.classList.toggle("is-video", onVideo);
      el.classList.toggle("is-download", onDownload);
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
