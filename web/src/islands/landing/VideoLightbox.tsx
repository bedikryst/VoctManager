/**
 * @file VideoLightbox.tsx
 * @description Full-screen video room — the nave goes dark for the projection. Opens on
 *  `voct:open-video` ({ src?, caption? }, defaults to MODAL_VIDEO), closes on ✕ / Escape /
 *  backdrop / the mobile back button (open pushes a history entry; back pops it → close). The
 *  player mounts only while open, so its unmount cleanup pauses the video and
 *  restores the ambient bed. Sets `window.__voctVideoReady` and emits `voct:video-ready`
 *  so static-DOM triggers can queue an early click until hydration completes.
 * @architecture Astro islands 2026
 * @module islands/landing/VideoLightbox
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { MODAL_VIDEO } from "../../data/landing/video";
import { dismissOverlayEntry, isOverlayEntry, pushOverlayEntry } from "../../lib/overlayHistory";
import { useBodyClass } from "./hooks/useBodyClass";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { VideoPlayer } from "./video/VideoPlayer";

interface OpenDetail {
  readonly src?: string;
  /** AV1 twin of `src`. Travels beside it rather than being derived, because the trigger reads
   *  both off the DOM and this island cannot resolve a bundled asset URL on its own. */
  readonly srcAv1?: string;
  readonly caption?: string;
  /** 9:16 audience document — the player switches to a portrait, height-driven frame. */
  readonly portrait?: boolean;
  /** Provenance line under the caption (piece credit · recording origin). */
  readonly note?: string;
}

interface VideoLightboxProps {
  /** Optimized poster for the default reel (computed by index.astro via astro:assets). */
  readonly poster: string;
}

export function VideoLightbox({ poster }: VideoLightboxProps): React.JSX.Element | null {
  const [open, setOpen] = useState<OpenDetail | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((): void => setOpen(null), []);
  const isOpen = open !== null;

  // User-initiated close routes through `dismiss`: pop the entry we pushed on open (→ popstate →
  // close) so no "swallowed" back press lingers; a genuine back / edge-swipe lands straight in the
  // popstate handler. Falls back to a direct close if our entry isn't on top (defensive).
  const dismiss = useCallback((): void => {
    dismissOverlayEntry("videoOpen", close);
  }, [close]);

  useBodyClass(open ? "video-open" : null);
  useFocusTrap(panelRef, isOpen, { onEscape: dismiss });

  useEffect(() => {
    (window as Window & { __voctVideoReady?: boolean }).__voctVideoReady = true;
    window.dispatchEvent(new Event("voct:video-ready"));
    const onOpen = (event: Event): void => {
      const detail = (event as CustomEvent<OpenDetail>).detail;
      setOpen({
        src: detail?.src,
        srcAv1: detail?.srcAv1,
        caption: detail?.caption,
        portrait: detail?.portrait,
        note: detail?.note,
      });
    };
    window.addEventListener("voct:open-video", onOpen);
    return () => {
      (window as Window & { __voctVideoReady?: boolean }).__voctVideoReady = false;
      window.removeEventListener("voct:open-video", onOpen);
    };
  }, []);

  // History integration: open → push a hash-marked entry via ClientRouter's navigate() (see
  // overlayHistory.ts — a raw pushState made the router re-swap the whole document on back,
  // re-running every reveal), mobile back / edge-swipe → close (so the gesture dismisses the
  // projection instead of leaving the landing). Mirrors VaultModal; no #projekcja element
  // exists, so nothing scrolls on open.
  useEffect(() => {
    if (!isOpen) return;
    pushOverlayEntry("videoOpen", "projekcja");
    const onPop = (): void => {
      if (!isOverlayEntry("videoOpen")) close();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen, close]);

  if (!open) return null;

  // The pair falls back TOGETHER: a trigger that published neither opens the default reel in both
  // codecs, and one that published only `src` (an older surface, or a film with no AV1 twin) must
  // not inherit the default's AV1 — that would hand the browser a preferred source showing a
  // different film. Hence the pairing on `open.src`, not two independent `??`.
  const src = open.src ?? MODAL_VIDEO.src;
  const srcAv1 = open.src ? open.srcAv1 : MODAL_VIDEO.srcAv1;

  return (
    <div
      className="video-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Wideo z koncertu"
    >
      {/* data-cursor="no-snap": full-viewport surface — the magnetic cursor snap would
          yank the cursor toward the screen centre everywhere around the panel. */}
      <button
        type="button"
        className="video-lightbox-backdrop"
        aria-label="Zamknij"
        data-cursor="no-snap"
        onClick={dismiss}
        tabIndex={-1}
      />
      <div className="video-lightbox-panel" data-lenis-prevent ref={panelRef}>
        <button type="button" className="video-lightbox-close" aria-label="Zamknij" onClick={dismiss}>
          ✕
        </button>
        {/* tone="dark" flips the chrome for the night room; idleHide fades it after
            stillness; glow bleeds the frame's light past the panel into the dark nave. */}
        <VideoPlayer
          src={src}
          srcAv1={srcAv1}
          poster={src === MODAL_VIDEO.src ? poster : undefined}
          caption={open.caption ?? MODAL_VIDEO.caption}
          note={open.note}
          portrait={open.portrait}
          autoPlay
          tone="dark"
          idleHide
          glow
        />
      </div>
    </div>
  );
}
