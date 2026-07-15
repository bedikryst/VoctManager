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
import { useBodyClass } from "./hooks/useBodyClass";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { VideoPlayer } from "./video/VideoPlayer";

interface OpenDetail {
  readonly src?: string;
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
    if (history.state?.videoOpen) history.back();
    else setOpen(null);
  }, []);

  useBodyClass(open ? "video-open" : null);
  useFocusTrap(panelRef, isOpen, { onEscape: dismiss });

  useEffect(() => {
    (window as Window & { __voctVideoReady?: boolean }).__voctVideoReady = true;
    window.dispatchEvent(new Event("voct:video-ready"));
    const onOpen = (event: Event): void => {
      const detail = (event as CustomEvent<OpenDetail>).detail;
      setOpen({
        src: detail?.src,
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

  // History integration: open → push a state entry, mobile back / edge-swipe → close (so the
  // gesture dismisses the projection instead of leaving the landing). Mirrors VaultModal.
  useEffect(() => {
    if (!isOpen) return;
    if (!history.state?.videoOpen) {
      history.pushState({ videoOpen: true }, "");
    }
    const onPop = (): void => close();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen, close]);

  if (!open) return null;

  const src = open.src ?? MODAL_VIDEO.src;

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
